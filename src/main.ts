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
import { createTabsManager, type TabsManager } from "./shell/tabs";

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

  const startupPath = await resolveStartupPath();
  if (startupPath) {
    await tabs.open(startupPath);
  } else {
    router.show("home");
    await home.refresh();
  }
}

bootstrap();
