// VaultViz V0 — bootstrap front (interpréteur réel .vviz) sur l'app shell.
//
// Flux :
//   1. mountAppShell(#root) → ShellHandles ; createRouter(handles).
//   2. Montage UNE FOIS de titlebar / toolbar / home / loader dans leurs
//      conteneurs respectifs.
//   3. resolveStartupPath() (argv / VVIZ_DEFAULT / bundle resource) ;
//      drag-drop (onFileDrop) ; dialog natif (openViaDialog).
//   4. openFlow(path) : loader → pipeline loadVViz + loadSources + montage
//      des vues dans handles.dashboard ; succès → dashboard, échec → bandeau
//      d'erreur. Récents persistés (recents.ts), breadcrumb toolbar.
//
// Le pipeline de rendu des vues (init Mosaic, loadSources, compileView,
// mountCompiledView) est PRÉSERVÉ tel quel — seule la cible de montage
// devient handles.dashboard. La grille par zones « dashboard » arrive en
// Wave 3.

// Polices chargées LOCALEMENT via @fontsource (woff2 dans node_modules,
// url() relatifs vers ./files/*) — aucun appel réseau (invariant I-2).
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jetbrains-mono/400.css";
import "@fontsource/jetbrains-mono/500.css";

import { invoke } from "@tauri-apps/api/core";

import { loadVViz } from "./viz-engine/spec-loader";
import { loadSources } from "./viz-engine/source-loader";
import { compileView } from "./viz-engine/view-compiler";
import { mountCompiledView } from "./viz-engine/view-mounter";
import { vvizDir } from "./viz-engine/path-resolver";
import { createDuckConnector } from "./viz-engine/duck-connector";
import { createRuntime, ensureSelection } from "./viz-engine/mosaic-runtime";
import { initMosaicRuntime } from "./viz-engine";

import { mountAppShell, type ShellHandles } from "./shell/layout";
import { createRouter, type Router } from "./shell/router";
import { mountTitlebar } from "./components/titlebar";
import { mountToolbar, type ToolbarHandle } from "./components/toolbar";
import { mountHome, type HomeHandle } from "./components/home";
import { mountLoader, type LoaderHandle, LOAD_STEPS } from "./components/loader";
import { renderErrorBanner, fromVVizError } from "./components/error-banner";
import { openViaDialog, onFileDrop } from "./services/file-open";
import { addRecent } from "./services/recents";

const HELP_HREF = "https://github.com/92VC/VaultViz/tree/main/docs/user";

let handles: ShellHandles;
let router: Router;
let toolbar: ToolbarHandle;
let home: HomeHandle;
let loader: LoaderHandle;

/** Découpe un chemin .vviz en segments POSIX (pour breadcrumb / nom fichier). */
function pathSegments(path: string): string[] {
  return path.replace(/\\/g, "/").split("/").filter(Boolean);
}

/** Nom de fichier (dernier segment) d'un chemin .vviz. */
function fileName(path: string): string {
  const segs = pathSegments(path);
  return segs.length > 0 ? segs[segs.length - 1] : path;
}

/**
 * Flux d'ouverture d'un .vviz : loader → pipeline → dashboard | erreur.
 * Ne lance jamais — toute erreur amont est encodée dans un bandeau.
 */
async function openFlow(path: string): Promise<void> {
  router.show("loading");
  loader.start({ name: fileName(path) });
  loader.setStep(LOAD_STEPS[0]);
  loader.setProgress(10);
  toolbar.setStatusVisible(true);
  toolbar.setStatus("loading");

  // 1. Read + parse + validate (atomique : un seul await).
  const { doc, error } = await loadVViz(path);
  if (error || !doc) {
    showError(
      path,
      error ?? fromVVizError({ kind: "Io", message: "doc indisponible" }, path),
    );
    return;
  }
  loader.setStep(LOAD_STEPS[2]); // Validation du schéma OK
  loader.setProgress(45);

  // 2. Init runtime Mosaic (idempotent — best-effort hors Tauri).
  try {
    initMosaicRuntime();
  } catch (err) {
    console.warn("[VaultViz] init Mosaic indisponible :", err);
  }
  const ctx = createRuntime();
  for (const s of doc.spec.selections ?? []) {
    ensureSelection(ctx, s.id, s.kind);
  }

  // 3. Charger les sources DuckDB depuis doc.data.sources[].
  loader.setStep(LOAD_STEPS[3]); // Indexation…
  loader.setProgress(65);
  const conn = createDuckConnector();
  try {
    await loadSources(conn, doc, vvizDir(path));
  } catch (err) {
    showError(path, {
      kind: "Io",
      path,
      message: `Chargement des sources : ${(err as Error).message}`,
    });
    return;
  }

  // 4. Rendu : titre + description + grille des vues dans handles.dashboard.
  loader.setStep(LOAD_STEPS[4]); // Rendu des vues…
  loader.setProgress(85);

  const dash = handles.dashboard;
  dash.innerHTML = "";
  const title = document.createElement("h1");
  title.className = "vv-doc-title";
  title.textContent = doc.vviz.title;
  dash.appendChild(title);
  if (doc.vviz.description) {
    const sub = document.createElement("p");
    sub.className = "vv-doc-sub";
    sub.textContent = doc.vviz.description;
    dash.appendChild(sub);
  }

  const layout = document.createElement("div");
  layout.className = `vv-layout vv-layout-${doc.spec.layout ?? "vstack"}`;
  dash.appendChild(layout);

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
      const compiled = compileView(v);
      await mountCompiledView(compiled, mount, ctx, conn);
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      const note = document.createElement("p");
      note.className = "vv-note vv-note-error";
      note.textContent = `Vue "${v.id}" (${v.type}) : ${msg}`;
      mount.appendChild(note);
    }
  }

  // 5. Succès : breadcrumb, récents, bascule dashboard, masquage loader.
  toolbar.setPath(pathSegments(path));
  toolbar.setStatus("ready");
  void addRecent({ path, title: doc.vviz.title, openedAt: Date.now() });
  loader.done();
  router.show("dashboard");
  loader.hide();
}

/** Peint le bandeau d'erreur et bascule sur l'écran d'erreur. */
function showError(path: string, payload: Parameters<typeof renderErrorBanner>[1]): void {
  toolbar.setStatus("error");
  renderErrorBanner(handles.error, payload, {
    onRetry: () => {
      void openFlow(path);
    },
    onHome: () => {
      router.show("home");
      void home.refresh();
    },
    helpHref: HELP_HREF,
  });
  loader.hide();
  router.show("error");
}

/** Ouverture via dialog natif (toolbar « Ouvrir »). */
async function pickAndOpen(): Promise<void> {
  const picked = await openViaDialog();
  if (picked) await openFlow(picked);
}

async function resolveStartupPath(): Promise<string | null> {
  // Garde-fou : si l'IPC ne répond pas en 2 s, on bascule sur home
  // au lieu de bloquer indéfiniment sur une page blanche.
  try {
    const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), 2000));
    const r = await Promise.race([
      invoke<string | null>("startup_path"),
      timeout,
    ]);
    return typeof r === "string" && r.length > 0 ? r : null;
  } catch (err) {
    console.warn("[VaultViz] startup_path indisponible :", err);
    return null;
  }
}

async function bootstrap(): Promise<void> {
  const root = document.getElementById("root") ?? document.body;

  handles = mountAppShell(root);
  router = createRouter(handles);

  // Montage UNE FOIS des composants permanents.
  mountTitlebar(handles.titlebar);
  toolbar = mountToolbar(handles.toolbar, {
    onOpen: () => {
      pickAndOpen().catch((err) =>
        console.error("[VaultViz] dialog error", err),
      );
    },
  });
  home = mountHome(handles.home, {
    onOpenPath: (path) => {
      void openFlow(path);
    },
  });
  loader = mountLoader(handles.overlay);

  // Statut masqué tant qu'aucun .vviz n'est ouvert.
  toolbar.setStatusVisible(false);

  // Glisser-déposer d'un .vviz (no-op hors Tauri).
  onFileDrop((path) => {
    void openFlow(path);
  });

  const startupPath = await resolveStartupPath();
  if (startupPath) {
    await openFlow(startupPath);
  } else {
    router.show("home");
    await home.refresh();
  }
}

bootstrap();
