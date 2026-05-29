// VaultViz — jeu d'icônes SVG inline.
//
// Extrait du design (mockups/VaultViz/assets/app.js fonctions `icon()`, `x()`,
// `plus()`, `themeIcon()` ET de mockups/VaultViz/VaultViz.html toolbar/dialog).
//
// Contraintes :
// - aucune dépendance externe, aucun accès DOM : chaque fonction renvoie une
//   simple chaîne de caractères contenant le markup SVG ;
// - on conserve fidèlement le `viewBox`, ainsi que `fill="none"
//   stroke="currentColor"` lorsque la maquette les utilise, pour que les
//   icônes héritent de la couleur du texte courant (cohérence thème clair/sombre).
//
// Refs: design-integration

/** Identifiants des icônes disponibles. */
export type IconName =
  | "euro"
  | "margin"
  | "target"
  | "gauge"
  | "check"
  | "open"
  | "export"
  | "settings"
  | "search"
  | "close"
  | "plus"
  | "file"
  | "drop"
  | "warning";

/** État de thème accepté par {@link themeIcon}. */
export type ThemeState = "light" | "dark";

// Définition de chaque icône sous forme de chaîne SVG complète.
// Les paths reprennent à l'identique ceux de la maquette.
const ICONS: Record<IconName, string> = {
  // --- KPI (mockups/VaultViz/assets/app.js, fonction icon()) ---
  euro: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 5.5A4.5 4.5 0 0 0 6.2 9M14 12.5A4.5 4.5 0 0 1 6.2 9M4 8h7M4 10.5h6"/></svg>',
  margin:
    '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 13l4-5 3 3 4-6"/><path d="M3 3v11h12"/></svg>',
  target:
    '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="9" r="6"/><circle cx="9" cy="9" r="2.5"/></svg>',
  gauge:
    '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 13a6 6 0 1 1 11 0"/><path d="M9 9l3-2"/></svg>',
  check:
    '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9.5l3.5 3.5L15 5"/></svg>',

  // --- Toolbar / dialog (mockups/VaultViz/VaultViz.html) ---
  open: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 5.5A1.5 1.5 0 0 1 4 4h3l1.5 1.8H14a1.5 1.5 0 0 1 1.5 1.5v6A1.5 1.5 0 0 1 14 14.8H4a1.5 1.5 0 0 1-1.5-1.5z"/></svg>',
  export:
    '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11.5V3M5.8 6.2L9 3l3.2 3.2M3.5 12.5v1.5a1 1 0 0 0 1 1h9a1 1 0 0 0 1-1v-1.5"/></svg>',
  settings:
    '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="9" r="2.3"/><path d="M9 1.8v1.8M9 14.4v1.8M16.2 9h-1.8M3.6 9H1.8M14.1 3.9l-1.3 1.3M5.2 12.8l-1.3 1.3M14.1 14.1l-1.3-1.3M5.2 5.2L3.9 3.9" stroke-linecap="round"/></svg>',
  search:
    '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="7" cy="7" r="4.2"/><path d="M10.2 10.2L14 14" stroke-linecap="round"/></svg>',
  close:
    '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg>',
  plus: '<svg viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 3v8M3 7h8"/></svg>',
  file: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M5 2h5l3 3v11H5z"/><path d="M10 2v3h3"/><path d="M7 9h4M7 11.5h4"/></svg>',
  drop: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"><path d="M12 16V4M7.5 8.5L12 4l4.5 4.5"/><path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15"/></svg>',
  warning:
    '<svg viewBox="0 0 22 22" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M11 2.5L20 18.5H2z"/><path d="M11 9v4M11 15.5v.3"/></svg>',
};

// Variantes de l'icône de thème (mockups/VaultViz/assets/app.js themeIcon()).
// `light` = soleil (affiché quand le thème courant est clair),
// `dark`  = lune (affiché quand le thème courant est sombre).
const THEME_ICONS: Record<ThemeState, string> = {
  light:
    '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><circle cx="9" cy="9" r="3.4"/><path d="M9 1.5v2M9 14.5v2M1.5 9h2M14.5 9h2M3.8 3.8l1.4 1.4M12.8 12.8l1.4 1.4M14.2 3.8l-1.4 1.4M5.2 12.8l-1.4 1.4"/></svg>',
  dark: '<svg viewBox="0 0 18 18" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M15 10.5A6.2 6.2 0 0 1 7.5 3a6.2 6.2 0 1 0 7.5 7.5z"/></svg>',
};

/**
 * Renvoie le markup SVG (chaîne) de l'icône demandée.
 *
 * @param name identifiant de l'icône (voir {@link IconName}).
 * @returns une chaîne `<svg>…</svg>` prête à être injectée en `innerHTML`.
 */
export function icon(name: IconName): string {
  return ICONS[name];
}

/**
 * Renvoie l'icône de thème adaptée à l'état courant.
 *
 * @param state `"light"` (soleil) ou `"dark"` (lune).
 */
export function themeIcon(state: ThemeState): string {
  return THEME_ICONS[state];
}

/** Liste de tous les identifiants d'icônes disponibles. */
export const ICON_NAMES: readonly IconName[] = Object.keys(ICONS) as IconName[];
