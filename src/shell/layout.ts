// VaultViz — coquille (app shell) neutre.
//
// Construit le squelette DOM `#app` cible (cf. mockups/VaultViz/VaultViz.html) :
//
//   #app
//     .titlebar  (#shell-titlebar)   — en-tête custom, fenêtre sans décorations
//     .toolbar   (#shell-toolbar)    — barre d'outils + statut
//     .stage     (#shell-stage)      — zone principale, contient :
//        .home   (#shell-home)
//        .dash   (#shell-dashboard)
//        .errbar (#shell-error)
//        .overlay(#shell-overlay)    — dialog / loader superposés
//
// Cette coquille est volontairement VIDE : titlebar, toolbar, home, dialog,
// loader et error-banner sont peuplés par des tâches dédiées qui consomment
// les `ShellHandles` exposés ci-dessous. Aucune logique métier ici.

export interface ShellHandles {
  /** Conteneur racine `#app`. */
  app: HTMLElement;
  /** En-tête custom `.titlebar` (#shell-titlebar). */
  titlebar: HTMLElement;
  /** Barre d'outils `.toolbar` (#shell-toolbar). */
  toolbar: HTMLElement;
  /** Zone principale `.stage` (#shell-stage). */
  stage: HTMLElement;
  /** Écran d'accueil `.home` (#shell-home). */
  home: HTMLElement;
  /** Tableau de bord `.dash` (#shell-dashboard). */
  dashboard: HTMLElement;
  /** Bandeau d'erreur `.errbar` (#shell-error). */
  error: HTMLElement;
  /** Overlay dialog/loader `.overlay` (#shell-overlay). */
  overlay: HTMLElement;
}

function div(id: string, className: string): HTMLElement {
  const e = document.createElement("div");
  e.id = id;
  e.className = className;
  return e;
}

/**
 * Monte la coquille applicative dans `root` et renvoie les éléments de montage.
 *
 * Les quatre conteneurs de la stage (home, dashboard, error, overlay) sont
 * créés masqués (`display: none`) ; le routeur (`createRouter`) pilote leur
 * affichage.
 */
export function mountAppShell(root: HTMLElement): ShellHandles {
  root.innerHTML = "";

  // `#app` : conteneur racine neutre (id historique du front).
  const app = div("app", "app");

  const titlebar = div("shell-titlebar", "titlebar");
  const toolbar = div("shell-toolbar", "toolbar");
  const stage = div("shell-stage", "stage");

  const home = div("shell-home", "home");
  const dashboard = div("shell-dashboard", "dash");
  const error = div("shell-error", "errbar");
  const overlay = div("shell-overlay", "overlay");

  // Conteneurs de stage cachés par défaut (le routeur décide quoi montrer).
  for (const el of [home, dashboard, error, overlay]) {
    el.style.display = "none";
  }

  stage.appendChild(home);
  stage.appendChild(dashboard);
  stage.appendChild(error);
  stage.appendChild(overlay);

  app.appendChild(titlebar);
  app.appendChild(toolbar);
  app.appendChild(stage);

  root.appendChild(app);

  return { app, titlebar, toolbar, stage, home, dashboard, error, overlay };
}
