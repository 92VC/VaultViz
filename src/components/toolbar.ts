// Barre d'outils supérieure permanente (`.toolbar`).
//
// Reprend fidèlement le design de la maquette
// (mockups/VaultViz/VaultViz.html — bloc `.toolbar` ; comportement
// `setStatus`/`setPath` de mockups/VaultViz/assets/app.js) :
//
//   [ breadcrumb .path ]  [spacer]  [ .status .led ]  | [Ouvrir] [Exporter] [Thème] [Paramètres]
//
// - breadcrumb : segments `.seg`, dernier `.seg.file`, séparateurs `›` `.sep` ;
// - statut : `.status[data-s]` + pastille `.led` (ready / loading / error) ;
// - actions : boutons `.tbtn` (icônes SVG inline) repérés par `data-action`
//   pour un ciblage stable (composant réutilisable, pas le singleton maquette) ;
// - bouton thème câblé sur `toggleTheme()` ; son icône reflète l'état courant.
//
// Aucun accès réseau, aucune écriture share (I-2 / I-3). Le câblage du
// dialog d'ouverture / de l'export reste à la charge du caller via `opts`.
//
// Refs: design-integration

import { icon, themeIcon } from "../ui/icons";
import { getTheme, toggleTheme } from "../ui/theme";

/** Options de montage de la toolbar. */
export interface ToolbarOptions {
  /** Appelé au clic sur « Ouvrir ». */
  onOpen: () => void;
  /** Appelé au clic sur « Exporter » (placeholder V0 si absent). */
  onExport?: () => void;
}

/** États possibles du badge de statut. */
export type ToolbarStatus = "ready" | "loading" | "error";

/** Poignée de pilotage retournée par {@link mountToolbar}. */
export interface ToolbarHandle {
  /**
   * Rend le breadcrumb de chemin. Le dernier segment est stylé `.seg.file`
   * (le fichier courant), les précédents sont des dossiers séparés par `›`.
   */
  setPath(segments: string[]): void;
  /** Change l'état du badge de statut (pastille LED + libellé). */
  setStatus(s: ToolbarStatus): void;
  /** Affiche / masque le badge de statut (via `visibility`, pas `display`). */
  setStatusVisible(v: boolean): void;
}

/** Libellés du badge de statut (repris de la maquette `setStatus`). */
const STATUS_LABEL: Record<ToolbarStatus, string> = {
  ready: "Prêt",
  loading: "Chargement",
  error: "Erreur de validation",
};

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/**
 * Monte la toolbar dans `el` et renvoie une poignée de pilotage.
 *
 * @param el conteneur hôte (vidé puis rempli).
 * @param opts callbacks d'actions.
 */
export function mountToolbar(
  el: HTMLElement,
  opts: ToolbarOptions,
): ToolbarHandle {
  el.classList.add("toolbar");
  el.innerHTML = `
    <div class="path-wrap" style="display:none;align-items:center;min-width:0">
      <div class="path"></div>
    </div>
    <div class="spacer"></div>
    <div class="status" data-s="ready"><span class="led"></span><span class="s-txt">Prêt</span></div>
    <div class="tdiv"></div>
    <button type="button" class="tbtn" data-action="open">${icon("open")}Ouvrir</button>
    <button type="button" class="tbtn" data-action="export">${icon("export")}Exporter</button>
    <button type="button" class="tbtn icon" data-action="theme" title="Thème"></button>
    <button type="button" class="tbtn icon" data-action="settings" title="Paramètres">${icon("settings")}</button>
  `;

  const pathWrap = el.querySelector<HTMLElement>(".path-wrap")!;
  const pathEl = el.querySelector<HTMLElement>(".path")!;
  const statusEl = el.querySelector<HTMLElement>(".status")!;
  const statusTxt = el.querySelector<HTMLElement>(".status .s-txt")!;
  const openBtn = el.querySelector<HTMLButtonElement>('[data-action="open"]')!;
  const exportBtn = el.querySelector<HTMLButtonElement>(
    '[data-action="export"]',
  )!;
  const themeBtn = el.querySelector<HTMLButtonElement>(
    '[data-action="theme"]',
  )!;

  // Bouton thème : icône = état courant, clic = bascule + maj icône.
  themeBtn.innerHTML = themeIcon(getTheme());
  themeBtn.addEventListener("click", () => {
    const next = toggleTheme();
    themeBtn.innerHTML = themeIcon(next);
  });

  openBtn.addEventListener("click", () => opts.onOpen());
  exportBtn.addEventListener("click", () => opts.onExport?.());

  return {
    setPath(segments: string[]): void {
      if (segments.length === 0) {
        pathWrap.style.display = "none";
        pathEl.innerHTML = "";
        return;
      }
      const last = segments.length - 1;
      pathEl.innerHTML = segments
        .map((seg, i) =>
          i === last
            ? `<span class="seg file">${escapeHtml(seg)}</span>`
            : `<span class="seg">${escapeHtml(seg)}</span><span class="sep">›</span>`,
        )
        .join("");
      pathWrap.style.display = "flex";
    },
    setStatus(s: ToolbarStatus): void {
      statusEl.dataset.s = s;
      statusTxt.textContent = STATUS_LABEL[s];
    },
    setStatusVisible(v: boolean): void {
      statusEl.style.visibility = v ? "visible" : "hidden";
    },
  };
}
