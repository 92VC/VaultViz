// VaultViz — routeur d'états du shell.
//
// Bascule entre les vues de la `.stage` (cf. showHome/showDashboard/showError
// de la maquette mockups/VaultViz/assets/app.js), en version neutre : on se
// contente d'afficher/masquer les conteneurs via `style.display`, sans
// peupler leur contenu (tâches dédiées).
//
//   home      → home visible, dashboard/error masqués, overlay masqué
//   dashboard → dashboard visible, home/error masqués, overlay masqué
//   error     → error visible, home/dashboard masqués, overlay masqué
//   loading   → overlay superposé (les vues sous-jacentes restent en l'état)

import type { ShellHandles } from "./layout";

export type AppView = "home" | "dashboard" | "error" | "loading";

export interface Router {
  /** Affiche la vue demandée (et masque les autres le cas échéant). */
  show(view: AppView): void;
  /** Renvoie la dernière vue demandée (par défaut "home"). */
  current(): AppView;
}

/** Crée un routeur pilotant les conteneurs de `handles`. */
export function createRouter(handles: ShellHandles): Router {
  let view: AppView = "home";

  function show(next: AppView): void {
    view = next;
    switch (next) {
      case "home":
        handles.home.style.display = "flex";
        handles.dashboard.style.display = "none";
        handles.error.style.display = "none";
        handles.overlay.style.display = "none";
        break;
      case "dashboard":
        handles.home.style.display = "none";
        handles.dashboard.style.display = "flex";
        handles.error.style.display = "none";
        handles.overlay.style.display = "none";
        break;
      case "error":
        handles.home.style.display = "none";
        handles.dashboard.style.display = "none";
        handles.error.style.display = "flex";
        handles.overlay.style.display = "none";
        break;
      case "loading":
        // L'overlay (loader) se superpose : on ne touche pas aux vues sous-jacentes.
        handles.overlay.style.display = "flex";
        break;
    }
  }

  function current(): AppView {
    return view;
  }

  return { show, current };
}
