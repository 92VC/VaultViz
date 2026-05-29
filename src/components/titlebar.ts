// VaultViz — barre de titre custom (fenêtre sans décoration native).
//
// SOURCE visuelle : `.titlebar` de mockups/VaultViz/VaultViz.html + CSS
// `.titlebar`/`.brand`/`.tabs`/`.tab`/`.win-ctrls`/`.win-btn` dans
// mockups/VaultViz/assets/styles.css. Le logo SVG est repris à l'identique
// de la maquette.
//
// Rend trois zones :
//   - `.brand` : logo + libellé « VaultViz » ;
//   - `.tabs`  : onglets de documents (mono-document en Wave 2, placeholder) ;
//   - `.win-ctrls` : 3 boutons réduire / agrandir / fermer câblés sur l'API
//     fenêtre Tauri 2 (no-op silencieux hors Tauri).
//
// La barre porte `data-tauri-drag-region` (hors boutons) pour le déplacement
// de la fenêtre. Aucun accès réseau, happy-dom-safe (ne throw jamais).
//
// Refs: design-integration

/** Description d'un onglet de document. */
export interface TitlebarTab {
  id: string;
  title: string;
  active: boolean;
}

/** Poignée de contrôle renvoyée par {@link mountTitlebar}. */
export interface TitlebarHandle {
  /** Remplace l'ensemble des onglets affichés. */
  setTabs(tabs: TitlebarTab[]): void;
  /** Enregistre le callback de fermeture d'onglet (clic sur la croix). */
  onTabClose(cb: (id: string) => void): void;
  /** Enregistre le callback de sélection d'onglet (clic sur l'onglet). */
  onTabSelect(cb: (id: string) => void): void;
  /** Enregistre le callback du bouton « nouvel onglet ». */
  onNewTab(cb: () => void): void;
}

const LOGO_SVG = `<svg class="logo" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect x="2.5" y="2.5" width="27" height="27" rx="7" fill="var(--accent)"/><path d="M9 10l4.6 12h0.2L18.4 10" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><rect x="20.5" y="9.5" width="2.7" height="13" rx="1.3" fill="#fff" opacity=".9"/></svg>`;

// Icônes des contrôles fenêtre, reprises à l'identique de la maquette.
const ICO_MIN = `<svg viewBox="0 0 12 12" width="11" height="11"><path d="M2 6h8" stroke="currentColor" stroke-width="1.2"/></svg>`;
const ICO_MAX = `<svg viewBox="0 0 12 12" width="11" height="11" fill="none"><rect x="2.2" y="2.2" width="7.6" height="7.6" rx="1" stroke="currentColor" stroke-width="1.2"/></svg>`;
const ICO_CLOSE = `<svg viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.2"><path d="M3 3l6 6M9 3l-6 6"/></svg>`;
// Croix de fermeture d'onglet (cf. icon("close") du jeu d'icônes).
const ICO_TAB_CLOSE = `<svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M3.5 3.5l7 7M10.5 3.5l-7 7"/></svg>`;
// Bouton « nouvel onglet » (cf. icon("plus")).
const ICO_PLUS = `<svg viewBox="0 0 14 14" width="12" height="12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M7 3v8M3 7h8"/></svg>`;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}

/**
 * Détecte la présence de l'API Tauri sans jamais throw.
 * En happy-dom `window.__TAURI__` / `window.__TAURI_INTERNALS__` sont absents.
 */
function hasTauri(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      ("__TAURI__" in window || "__TAURI_INTERNALS__" in window)
    );
  } catch {
    return false;
  }
}

/**
 * Charge l'API fenêtre Tauri 2 via un import dynamique NON littéral
 * (+ `@vite-ignore`) pour que tsc ne tente pas de résoudre le module et
 * que Rollup/vite n'échoue pas au build si le paquet n'est pas présent.
 * Cf. le pattern de src/ui/theme.ts.
 */
async function tauriWindow(): Promise<any | null> {
  if (!hasTauri()) return null;
  try {
    const spec = "@tauri-apps/api/window";
    const mod: any = await import(/* @vite-ignore */ spec);
    return mod.getCurrentWindow();
  } catch {
    return null;
  }
}

function winAction(method: "minimize" | "toggleMaximize" | "close"): void {
  // no-op silencieux hors Tauri ; échec d'appel avalé.
  void (async () => {
    try {
      const w = await tauriWindow();
      if (w && typeof w[method] === "function") await w[method]();
    } catch {
      /* no-op */
    }
  })();
}

export function mountTitlebar(el: HTMLElement): TitlebarHandle {
  let tabCloseCb: (id: string) => void = () => {};
  let tabSelectCb: (id: string) => void = () => {};
  let newTabCb: () => void = () => {};

  el.innerHTML = `
    <div class="titlebar" data-tauri-drag-region>
      <div class="brand" data-tauri-drag-region>
        ${LOGO_SVG}
        <span>VaultViz</span>
      </div>
      <div class="tabs" id="vv-tabs" data-tauri-drag-region></div>
      <div class="win-ctrls">
        <button type="button" class="win-btn" data-win="min" title="Réduire" aria-label="Réduire">${ICO_MIN}</button>
        <button type="button" class="win-btn" data-win="max" title="Agrandir" aria-label="Agrandir">${ICO_MAX}</button>
        <button type="button" class="win-btn close" data-win="close" title="Fermer" aria-label="Fermer">${ICO_CLOSE}</button>
      </div>
    </div>
  `;

  const root = el.querySelector<HTMLElement>(".titlebar")!;
  const tabsEl = root.querySelector<HTMLElement>("#vv-tabs")!;

  // Contrôles fenêtre.
  root.querySelector<HTMLButtonElement>('[data-win="min"]')
    ?.addEventListener("click", () => winAction("minimize"));
  root.querySelector<HTMLButtonElement>('[data-win="max"]')
    ?.addEventListener("click", () => winAction("toggleMaximize"));
  root.querySelector<HTMLButtonElement>('[data-win="close"]')
    ?.addEventListener("click", () => winAction("close"));

  function renderTabs(tabs: TitlebarTab[]): void {
    const items = tabs
      .map((t) => {
        const cls = t.active ? "tab active" : "tab";
        return `<div class="${cls}" data-tab-id="${escapeAttr(t.id)}" title="${escapeAttr(t.title)}">
            <span class="dot"></span>
            <span class="t-name">${escapeHtml(t.title)}</span>
            <span class="t-close" role="button" aria-label="Fermer l'onglet" data-tab-close="${escapeAttr(t.id)}">${ICO_TAB_CLOSE}</span>
          </div>`;
      })
      .join("");
    tabsEl.innerHTML = `${items}<button type="button" class="tab-add" title="Nouvel onglet" aria-label="Nouvel onglet">${ICO_PLUS}</button>`;
  }

  // Délégation d'événements sur la zone des onglets.
  tabsEl.addEventListener("click", (ev) => {
    const target = ev.target as HTMLElement | null;
    if (!target) return;

    const closeEl = target.closest<HTMLElement>("[data-tab-close]");
    if (closeEl) {
      ev.stopPropagation();
      tabCloseCb(closeEl.getAttribute("data-tab-close") || "");
      return;
    }

    if (target.closest(".tab-add")) {
      newTabCb();
      return;
    }

    const tabEl = target.closest<HTMLElement>(".tab[data-tab-id]");
    if (tabEl) {
      tabSelectCb(tabEl.getAttribute("data-tab-id") || "");
    }
  });

  // Onglet placeholder mono-document (Wave 2).
  renderTabs([{ id: "doc-0", title: "Sans titre", active: true }]);

  return {
    setTabs: (tabs) => renderTabs(tabs),
    onTabClose: (cb) => {
      tabCloseCb = cb;
    },
    onTabSelect: (cb) => {
      tabSelectCb = cb;
    },
    onNewTab: (cb) => {
      newTabCb = cb;
    },
  };
}
