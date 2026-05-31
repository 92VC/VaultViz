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

import { createDuckConnector } from "./viz-engine/duck-connector";

import { mountAppShell, type ShellHandles } from "./shell/layout";
import { createRouter, type Router } from "./shell/router";
import { mountTitlebar, type TitlebarHandle } from "./components/titlebar";
import { mountToolbar, type ToolbarHandle } from "./components/toolbar";
import { mountHome, type HomeHandle } from "./components/home";
import { mountLoader, type LoaderHandle } from "./components/loader";
import { openViaDialog, onFileDrop } from "./services/file-open";
import { exportToPdf, downloadPdf } from "./services/pdf-export";
import { exportToPng } from "./services/png-export";
import { tableToCsv, downloadCsv } from "./services/csv-export";
import { tableHandleRegistry } from "./components/table-view";
import { createTabsManager, type TabsManager } from "./shell/tabs";
import { mountRefreshBanner } from "./components/refresh-banner";
import { onDataChanged } from "./services/watcher";

let handles: ShellHandles;
let router: Router;
let toolbar: ToolbarHandle;
let titlebar: TitlebarHandle;
let home: HomeHandle;
let loader: LoaderHandle;
let tabs: TabsManager;

/** Ouverture via dialog natif (toolbar « Ouvrir »). */
async function pickAndOpen(): Promise<void> {
  const picked = await openViaDialog();
  if (picked) await tabs.open(picked);
}

/** Export PDF du document actif (B-131 / I-9). */
async function exportActiveToPdf(): Promise<void> {
  const id = tabs.activeId();
  if (!id) return;
  const tab = tabs.list().find((t) => t.docId === id);
  if (!tab) return;
  // Conteneur .vv-doc du document actif (monté dans handles.dashboard).
  const container =
    handles.dashboard.querySelector<HTMLElement>(`[data-doc-id="${id}"]`) ??
    handles.dashboard;
  const bytes = await exportToPdf({
    container,
    title: tab.title,
    author: "VaultViz",
  });
  // Nom de fichier basé sur le titre (sans extension si présente dans le titre)
  const fname = tab.title.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim() + ".pdf";
  downloadPdf(bytes, fname);
}

/** Export PNG du document actif : presse-papier + fichier (B-132). */
async function exportActiveToPng(): Promise<void> {
  const id = tabs.activeId();
  if (!id) return;
  const tab = tabs.list().find((t) => t.docId === id);
  if (!tab) return;
  const container =
    handles.dashboard.querySelector<HTMLElement>(`[data-doc-id="${id}"]`) ??
    handles.dashboard;
  const fname = tab.title.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim() + ".png";
  await exportToPng({ container, filename: fname });
}

/**
 * Export CSV des données filtrées affichées du document actif (B-132).
 *
 * Stratégie :
 *   - Cherche un `.vv-table` dans le conteneur du document actif.
 *   - Récupère le TableViewHandle via le registre WeakMap (tableHandleRegistry).
 *   - Export la Table Arrow courante (après cross-filter / setData).
 *   - Si aucune table active → log console + no-op silencieux (pas de crash).
 */
function exportActiveToCsv(): void {
  const id = tabs.activeId();
  if (!id) return;
  const tab = tabs.list().find((t) => t.docId === id);
  if (!tab) return;
  const container =
    handles.dashboard.querySelector<HTMLElement>(`[data-doc-id="${id}"]`) ??
    handles.dashboard;

  // Cherche le premier .vv-table dans le doc actif.
  const tableRoot = container.querySelector<HTMLElement>(".vv-table");
  if (!tableRoot) {
    console.info("[VaultViz] Aucune table active — export CSV ignoré.");
    return;
  }
  const handle = tableHandleRegistry.get(tableRoot);
  if (!handle) {
    console.info("[VaultViz] Handle table introuvable — export CSV ignoré.");
    return;
  }

  const csv = tableToCsv(handle.getData(), handle.getColumns());
  const fname = tab.title.replace(/[^a-zA-Z0-9_\-\s]/g, "_").trim() + ".csv";
  downloadCsv(csv, fname);
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
  titlebar = mountTitlebar(handles.titlebar);
  toolbar = mountToolbar(handles.toolbar, {
    onOpen: () => {
      pickAndOpen().catch((err) =>
        console.error("[VaultViz] dialog error", err),
      );
    },
    onExportPdf: () => {
      exportActiveToPdf().catch((err) =>
        console.error("[VaultViz] export PDF erreur", err),
      );
    },
    onExportPng: () => {
      exportActiveToPng().catch((err) =>
        console.error("[VaultViz] export PNG erreur", err),
      );
    },
    onExportCsv: () => {
      exportActiveToCsv();
    },
  });
  home = mountHome(handles.home, {
    onOpenPath: (path) => {
      void tabs.open(path);
    },
  });
  loader = mountLoader(handles.overlay);

  // Gestionnaire d'onglets multi-documents : un docId + un RuntimeContext +
  // un conteneur DOM par document, connector DuckDB partagé.
  tabs = createTabsManager({
    handles,
    router,
    titlebar,
    toolbar,
    loader,
    connector: createDuckConnector(),
    onHome: () => {
      void home.refresh();
    },
  });

  // Câblage des onglets de la titlebar.
  titlebar.onTabSelect((id) => tabs.activate(id));
  titlebar.onTabClose((id) => {
    void tabs.close(id);
  });
  titlebar.onNewTab(() => {
    router.show("home");
    void home.refresh();
  });

  // Aucun document ouvert au démarrage → pas d'onglet (l'onglet placeholder
  // de la titlebar est remplacé par la liste réelle, ici vide).
  titlebar.setTabs([]);

  // Statut masqué tant qu'aucun .vviz n'est ouvert.
  toolbar.setStatusVisible(false);

  // Glisser-déposer d'un .vviz (no-op hors Tauri).
  onFileDrop((path) => {
    void tabs.open(path);
  });

  // Bandeau de refresh non intrusif (B-121).
  // Monté UNE FOIS dans handles.stage (zone stable au-dessus du dashboard).
  // AUCUN rechargement automatique (UC-5) : seul le clic « Recharger » déclenche.
  //
  // onReload : ferme l'onglet actif puis le rouvre (close + open).
  // Effet de bord documenté : flash rapide sur l'écran home si c'est le
  // dernier onglet ouvert ; l'onglet reprend la dernière position dans la barre.
  //
  // Note : startWatch(paths) n'est PAS encore câblé dans le pipeline
  // d'ouverture (hors scope B-121) — onDataChanged ne se déclenchera donc
  // jamais en production tant que B-122+ ne complète pas le câblage.
  // La bannière est fonctionnelle ; le watcher doit être démarré séparément.
  const refreshBanner = mountRefreshBanner(handles.stage, {
    onReload: async () => {
      const id = tabs.activeId();
      if (!id) return;
      const activeTab = tabs.list().find((t) => t.docId === id);
      if (!activeTab) return;
      const path = activeTab.path;
      await tabs.close(id);
      await tabs.open(path);
    },
  });

  // Abonnement unique à l'événement watcher (best-effort, ne throw pas).
  void onDataChanged(() => {
    refreshBanner.show();
  });

  const startupPath = await resolveStartupPath();
  if (startupPath) {
    await tabs.open(startupPath);
  } else {
    router.show("home");
    await home.refresh();
  }
}

bootstrap();
