// SP4 / T4.b — Gestionnaire d'onglets multi-documents.
//
// Chaque document ouvert vit dans son propre ONGLET, totalement isolé :
//
//   - docId unique (`d1`, `d2`, …) → namespace de vues DuckDB
//     `doc_<docId>__<source>` (cf. source-loader.viewName / view-compiler).
//   - RuntimeContext dédié (createRuntime) → ses propres Selection/Param,
//     donc aucun cross-filtre entre onglets.
//   - conteneur DOM dédié (`<div>` enfant de handles.dashboard) ; on
//     affiche l'actif et on masque les autres via `display`.
//
// Le pipeline de rendu (loadVViz → loadSources(docId) → compileView(docId)
// → mountDashboard | mountCompiledView) est repris à l'identique de
// l'ancien openFlow mono-document de main.ts, paramétré par docId + le
// conteneur cible de l'onglet.
//
// Isolation GARANTIE par : RuntimeContext par onglet + namespace de vues
// par docId + conteneur DOM par onglet. Seules la connexion DuckDB et le
// coordinator vgplot sont partagés — sans fuite, car chaque requête /
// chaque Selection est clé sur un namespace / une instance distincts.
//
// LIMITE connue (hors scope du contrat `close`) : les clients vgplot
// montés ne sont pas déconnectés du coordinator global à la fermeture
// (fuite mémoire, pas fuite de données). Le contrat SP4 se limite à
// dropDocViews + retrait du conteneur + de l'état.
//
// Refs: design-integration

import { loadVViz as loadVVizReal } from "../viz-engine/spec-loader";
import { loadSources as loadSourcesReal } from "../viz-engine/source-loader";
import { dropDocViews as dropDocViewsReal } from "../viz-engine/source-loader";
import { compileView } from "../viz-engine/view-compiler";
import { mountCompiledView } from "../viz-engine/view-mounter";
import { mountDashboard as mountDashboardReal } from "./dashboard";
import { vvizDir } from "../viz-engine/path-resolver";
import { createDuckConnector } from "../viz-engine/duck-connector";
import {
  createRuntime as createRuntimeReal,
  ensureSelection,
  type RuntimeContext,
} from "../viz-engine/mosaic-runtime";
import { initMosaicRuntime } from "../viz-engine";

import type { ShellHandles } from "./layout";
import type { Router } from "./router";
import type { TitlebarHandle } from "../components/titlebar";
import type { ToolbarHandle } from "../components/toolbar";
import type { DuckConnector } from "../viz-engine/duck-connector";
import type { LoadResult } from "../viz-engine/spec-loader";
import type { VVizDocument } from "../viz-engine/types";
import type { RecentItem } from "../services/recents";
import { renderErrorBanner, fromVVizError, type ErrorPayload } from "../components/error-banner";
import { mountLoader, LOAD_STEPS, type LoaderHandle } from "../components/loader";

const HELP_HREF = "https://github.com/92VC/VaultViz/tree/main/docs/user";

/** Onglet de document, vue publique. */
export interface OpenTab {
  docId: string;
  path: string;
  title: string;
}

/** État interne d'un onglet (superset d'OpenTab). */
interface TabState {
  docId: string;
  path: string;
  title: string;
  container: HTMLElement;
  ctx: RuntimeContext;
  sourceNames: string[];
}

export interface TabsManager {
  /** Ouvre un .vviz : assigne un docId, charge, monte, active. Ne throw jamais. */
  open(path: string): Promise<void>;
  /** Affiche l'onglet docId, masque les autres, MAJ titlebar/toolbar. */
  activate(docId: string): void;
  /** Ferme un onglet : drop des vues, retrait DOM + état ; sinon → home. */
  close(docId: string): Promise<void>;
  /** Liste des onglets ouverts (vue publique). */
  list(): OpenTab[];
  /** docId de l'onglet actif (null si aucun). */
  activeId(): string | null;
}

/** Dépendances injectables (testabilité). */
export interface TabsDeps {
  handles: ShellHandles;
  router: Router;
  titlebar: TitlebarHandle;
  toolbar: ToolbarHandle;
  loader?: LoaderHandle;
  /** Rappelé sur retour « accueil » (rafraîchit la liste des récents). */
  onHome?: () => void;
  loadVViz?: (path: string) => Promise<LoadResult>;
  loadSources?: (
    conn: DuckConnector,
    doc: VVizDocument,
    vvizDirPath: string,
    docId?: string,
  ) => Promise<void>;
  dropDocViews?: (
    conn: DuckConnector,
    docId: string,
    sourceNames: string[],
  ) => Promise<void>;
  mountDashboard?: (
    container: HTMLElement,
    views: ReturnType<typeof compileView>[],
    ctx: RuntimeContext,
    conn: DuckConnector,
  ) => Promise<void>;
  createRuntime?: () => RuntimeContext;
  /** Connector DuckDB partagé (les onglets s'isolent par namespace de vues). */
  connector?: DuckConnector;
  /** Init du runtime Mosaic (idempotent ; best-effort hors Tauri). */
  initRuntime?: () => void;
  addRecent?: (item: RecentItem) => Promise<void>;
}

/** Découpe un chemin .vviz en segments POSIX (breadcrumb / nom fichier). */
function pathSegments(path: string): string[] {
  return path.replace(/\\/g, "/").split("/").filter(Boolean);
}

/** Nom de fichier (dernier segment) d'un chemin .vviz. */
function fileName(path: string): string {
  const segs = pathSegments(path);
  return segs.length > 0 ? segs[segs.length - 1] : path;
}

export function createTabsManager(deps: TabsDeps): TabsManager {
  const { handles, router, titlebar, toolbar } = deps;
  const loadVViz = deps.loadVViz ?? loadVVizReal;
  const loadSources = deps.loadSources ?? loadSourcesReal;
  const dropDocViews = deps.dropDocViews ?? dropDocViewsReal;
  const mountDashboard = deps.mountDashboard ?? mountDashboardReal;
  const createRuntime = deps.createRuntime ?? createRuntimeReal;
  const conn = deps.connector ?? createDuckConnector();
  const initRuntime = deps.initRuntime ?? (() => initMosaicRuntime());
  const addRecent = deps.addRecent ?? (async () => {});
  // Loader best-effort : injecté, sinon monté sur l'overlay, sinon no-op.
  const loader: LoaderHandle =
    deps.loader ?? safeLoader(handles.overlay);

  const tabs = new Map<string, TabState>();
  let counter = 0;
  let active: string | null = null;

  function refreshTitlebar(): void {
    titlebar.setTabs(
      [...tabs.values()].map((t) => ({
        id: t.docId,
        title: t.title,
        active: t.docId === active,
      })),
    );
  }

  /** Peint le bandeau d'erreur (aucun onglet n'est créé). */
  function showError(path: string, payload: ErrorPayload): void {
    toolbar.setStatus("error");
    renderErrorBanner(handles.error, payload, {
      onRetry: () => {
        void open(path);
      },
      onHome: () => {
        router.show("home");
        deps.onHome?.();
      },
      helpHref: HELP_HREF,
    });
    loader.hide();
    router.show("error");
  }

  function activate(docId: string): void {
    const tab = tabs.get(docId);
    if (!tab) return;
    active = docId;
    for (const t of tabs.values()) {
      t.container.style.display = t.docId === docId ? "block" : "none";
    }
    refreshTitlebar();
    toolbar.setPath(pathSegments(tab.path));
    toolbar.setStatusVisible(true);
    toolbar.setStatus("ready");
    router.show("dashboard");
  }

  async function open(path: string): Promise<void> {
    counter += 1;
    const docId = `d${counter}`;

    router.show("loading");
    loader.start({ name: fileName(path) });
    loader.setStep(LOAD_STEPS[0]);
    loader.setProgress(10);
    toolbar.setStatusVisible(true);
    toolbar.setStatus("loading");

    // 1. Lecture + parse + validation.
    const { doc, error } = await loadVViz(path);
    if (error || !doc) {
      showError(
        path,
        error ?? fromVVizError({ kind: "Io", message: "doc indisponible" }, path),
      );
      return;
    }
    loader.setStep(LOAD_STEPS[2]);
    loader.setProgress(45);

    // 2. Init runtime Mosaic (idempotent, best-effort) + ctx PAR ONGLET.
    try {
      initRuntime();
    } catch (err) {
      console.warn("[VaultViz] init Mosaic indisponible :", err);
    }
    const ctx = createRuntime();
    for (const s of doc.spec.selections ?? []) {
      ensureSelection(ctx, s.id, s.kind);
    }

    // 3. Charger les sources dans le namespace de CE document.
    loader.setStep(LOAD_STEPS[3]);
    loader.setProgress(65);
    try {
      await loadSources(conn, doc, vvizDir(path), docId);
    } catch (err) {
      showError(path, {
        kind: "Io",
        path,
        message: `Chargement des sources : ${(err as Error).message}`,
      });
      return;
    }

    // 4. Conteneur dédié à l'onglet, enfant de handles.dashboard.
    loader.setStep(LOAD_STEPS[4]);
    loader.setProgress(85);

    const container = document.createElement("div");
    container.className = "vv-doc";
    container.dataset.docId = docId;
    container.style.display = "none";
    handles.dashboard.appendChild(container);

    const title = document.createElement("h1");
    title.className = "vv-doc-title";
    title.textContent = doc.vviz.title;
    container.appendChild(title);
    if (doc.vviz.description) {
      const sub = document.createElement("p");
      sub.className = "vv-doc-sub";
      sub.textContent = doc.vviz.description;
      container.appendChild(sub);
    }

    if (doc.spec.layout === "dashboard") {
      const region = document.createElement("div");
      region.className = "vv-layout vv-layout-dashboard";
      container.appendChild(region);

      const compiled: ReturnType<typeof compileView>[] = [];
      for (const v of doc.spec.views) {
        try {
          compiled.push(compileView(v, docId));
        } catch (err) {
          const msg = (err as Error).message ?? String(err);
          const note = document.createElement("p");
          note.className = "vv-note vv-note-error";
          note.textContent = `Vue "${v.id}" (${v.type}) : ${msg}`;
          region.appendChild(note);
        }
      }
      await mountDashboard(region, compiled, ctx, conn, {
        gridRatio: doc.spec.gridRatio,
      });
    } else {
      const layout = document.createElement("div");
      layout.className = `vv-layout vv-layout-${doc.spec.layout ?? "vstack"}`;
      container.appendChild(layout);

      for (const v of doc.spec.views) {
        const frame = document.createElement("section");
        frame.className = `vv-view-frame vv-view-${v.type}`;
        frame.dataset.viewId = v.id;
        if (v.title) {
          const h = document.createElement("h2");
          h.className = "vv-view-title";
          h.textContent = v.title;
          frame.appendChild(h);
        }
        const mount = document.createElement("div");
        mount.className = "vv-view-mount";
        frame.appendChild(mount);
        layout.appendChild(frame);

        try {
          const compiled = compileView(v, docId);
          await mountCompiledView(compiled, mount, ctx, conn);
        } catch (err) {
          const msg = (err as Error).message ?? String(err);
          const note = document.createElement("p");
          note.className = "vv-note vv-note-error";
          note.textContent = `Vue "${v.id}" (${v.type}) : ${msg}`;
          mount.appendChild(note);
        }
      }
    }

    // 5. Enregistrer l'onglet APRÈS succès du chargement.
    tabs.set(docId, {
      docId,
      path,
      title: doc.vviz.title,
      container,
      ctx,
      sourceNames: doc.data.sources.map((s) => s.name),
    });

    void addRecent({ path, title: doc.vviz.title, openedAt: Date.now() });
    loader.done();
    activate(docId);
    loader.hide();
  }

  async function close(docId: string): Promise<void> {
    const tab = tabs.get(docId);
    if (!tab) return;

    try {
      await dropDocViews(conn, docId, tab.sourceNames);
    } catch (err) {
      console.warn("[VaultViz] dropDocViews :", err);
    }
    tab.container.remove();
    tabs.delete(docId);

    if (active === docId) {
      active = null;
      const next = [...tabs.keys()].pop();
      if (next) {
        activate(next);
      } else {
        toolbar.setStatusVisible(false);
        toolbar.setPath([]);
        refreshTitlebar();
        router.show("home");
        deps.onHome?.();
      }
    } else {
      refreshTitlebar();
    }
  }

  function list(): OpenTab[] {
    return [...tabs.values()].map((t) => ({
      docId: t.docId,
      path: t.path,
      title: t.title,
    }));
  }

  function activeId(): string | null {
    return active;
  }

  return { open, activate, close, list, activeId };
}

/** Monte un loader sur l'overlay sans jamais throw (repli no-op). */
function safeLoader(overlay: HTMLElement): LoaderHandle {
  try {
    return mountLoader(overlay);
  } catch {
    return {
      start: () => {},
      setStep: () => {},
      setProgress: () => {},
      done: () => {},
      hide: () => {},
    } as unknown as LoaderHandle;
  }
}
