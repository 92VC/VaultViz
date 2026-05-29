/* ============================================================
   VaultViz — gestion du thème (dark / light)
   ============================================================

   Toggle de thème persistant, app-local (invariant I-3 : jamais
   d'écriture sur le share réseau).

   Le thème est piloté par l'attribut `data-theme` sur `<html>`
   (cf. mockups/VaultViz/assets/app.js — fonctions toggleTheme /
   themeIcon). Sémantique reprise du mockup : tout sauf "light" est
   considéré comme "dark" (le sombre est le défaut).

   Persistance via une abstraction `ThemeStore` injectable :
   - En production Tauri 2 : un petit fichier `theme` sous le
     répertoire appLocalData (%LOCALAPPDATA%\VaultViz), via
     @tauri-apps/plugin-fs si disponible.
   - En dev / tests (happy-dom, pas de Tauri) : repli silencieux sur
     localStorage si présent, sinon no-op en mémoire.

   Aucune URL réseau, aucune dépendance sortante. La détection ne
   throw jamais (happy-dom-safe). */

export type Theme = "dark" | "light";

const ATTR = "data-theme";
const STORAGE_KEY = "vaultviz.theme";
const STORE_FILE = "theme";

/* ---------- DOM ---------- */

/** Pose `data-theme` sur `<html>`. */
export function applyTheme(theme: Theme): void {
  document.documentElement.setAttribute(ATTR, theme);
}

/**
 * Lit le thème courant depuis `<html>`.
 * Sémantique du mockup : seul "light" est clair, tout le reste
 * (y compris attribut absent) est sombre.
 */
export function getTheme(): Theme {
  return document.documentElement.getAttribute(ATTR) === "light"
    ? "light"
    : "dark";
}

function isTheme(v: unknown): v is Theme {
  return v === "dark" || v === "light";
}

/* ---------- abstraction de persistance ---------- */

export interface ThemeStore {
  load(): Promise<Theme | null>;
  save(theme: Theme): Promise<void>;
}

/**
 * Détecte la présence de l'API Tauri sans jamais throw.
 * En happy-dom `window.__TAURI__` est absent → false.
 */
function hasTauri(): boolean {
  try {
    return typeof window !== "undefined" && "__TAURI__" in window;
  } catch {
    return false;
  }
}

/**
 * Store Tauri : écrit/lit un fichier `theme` sous appLocalData.
 *
 * L'import de `@tauri-apps/plugin-fs` est dynamique ET via un
 * spécificateur NON littéral (+ `@vite-ignore`) pour que :
 *   - tsc ne tente pas de résoudre le module (typé `any`),
 *   - Rollup/vite n'échoue pas au build si le plugin n'est pas
 *     encore installé.
 * Le plugin sera ajouté dans une wave ultérieure ; d'ici là cette
 * branche échoue proprement (catch) et on retombe sur localStorage,
 * qui reste app-local (webview) — I-3 respecté.
 */
class TauriThemeStore implements ThemeStore {
  private async fs(): Promise<any> {
    const spec = "@tauri-apps/plugin-fs";
    return await import(/* @vite-ignore */ spec);
  }

  async load(): Promise<Theme | null> {
    try {
      const fs = await this.fs();
      const opts = { baseDir: fs.BaseDirectory.AppLocalData };
      if (!(await fs.exists(STORE_FILE, opts))) return null;
      const raw = (await fs.readTextFile(STORE_FILE, opts)).trim();
      return isTheme(raw) ? raw : null;
    } catch {
      return null;
    }
  }

  async save(theme: Theme): Promise<void> {
    try {
      const fs = await this.fs();
      await fs.writeTextFile(STORE_FILE, theme, {
        baseDir: fs.BaseDirectory.AppLocalData,
      });
    } catch {
      /* no-op : échec silencieux, le thème reste appliqué en session */
    }
  }
}

/** Store localStorage : dev / tests. Ne throw jamais. */
class LocalStorageThemeStore implements ThemeStore {
  async load(): Promise<Theme | null> {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return isTheme(raw) ? raw : null;
    } catch {
      return null;
    }
  }

  async save(theme: Theme): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, theme);
    } catch {
      /* no-op */
    }
  }
}

/** Store mémoire : ultime repli si ni Tauri ni localStorage. */
class MemoryThemeStore implements ThemeStore {
  private value: Theme | null = null;
  async load(): Promise<Theme | null> {
    return this.value;
  }
  async save(theme: Theme): Promise<void> {
    this.value = theme;
  }
}

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== "undefined" && localStorage !== null;
  } catch {
    return false;
  }
}

/** Sélectionne le store par défaut selon l'environnement. */
export function defaultStore(): ThemeStore {
  if (hasTauri()) return new TauriThemeStore();
  if (hasLocalStorage()) return new LocalStorageThemeStore();
  return new MemoryThemeStore();
}

let activeStore: ThemeStore = defaultStore();

/** Injecte un store (tests, ou wiring spécifique). */
export function setThemeStore(store: ThemeStore): void {
  activeStore = store;
}

/* ---------- API publique ---------- */

/** Bascule dark <-> light, applique, persiste, renvoie le nouveau thème. */
export function toggleTheme(): Theme {
  const next: Theme = getTheme() === "light" ? "dark" : "light";
  applyTheme(next);
  void activeStore.save(next);
  return next;
}

/** Au boot : charge la préférence persistée si dispo et l'applique. */
export async function initTheme(): Promise<void> {
  let stored: Theme | null = null;
  try {
    stored = await activeStore.load();
  } catch {
    stored = null;
  }
  applyTheme(stored ?? getTheme());
}
