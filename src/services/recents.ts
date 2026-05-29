/* ============================================================
   VaultViz — service de fichiers récents
   ============================================================

   Liste persistée des .vviz récemment ouverts, app-local
   (invariant I-3 : jamais d'écriture sur le share réseau).

   Persistance via une abstraction `RecentsStore` injectable :
   - En production Tauri 2 : un fichier `recents.json` sous le
     répertoire appLocalData (%LOCALAPPDATA%\VaultViz), via
     @tauri-apps/plugin-fs si disponible.
   - En dev / tests (happy-dom, pas de Tauri) : repli silencieux sur
     localStorage si présent, sinon no-op en mémoire.

   Sérialisation JSON. Aucune URL réseau, aucune dépendance
   sortante. La détection ne throw jamais (happy-dom-safe). */

export interface RecentItem {
  path: string;
  title: string;
  openedAt: number;
  broken?: boolean;
}

const STORAGE_KEY = "vaultviz.recents";
const STORE_FILE = "recents.json";
const MAX_RECENTS = 12;

/* ---------- abstraction de persistance ---------- */

export interface RecentsStore {
  load(): Promise<string | null>;
  save(json: string): Promise<void>;
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
 * Store Tauri : écrit/lit `recents.json` sous appLocalData.
 *
 * L'import de `@tauri-apps/plugin-fs` est dynamique ET via un
 * spécificateur NON littéral (+ `@vite-ignore`) pour que :
 *   - tsc ne tente pas de résoudre le module (typé `any`),
 *   - Rollup/vite n'échoue pas au build si le plugin n'est pas
 *     encore installé.
 * D'ici là cette branche échoue proprement (catch) et on retombe sur
 * localStorage, qui reste app-local (webview) — I-3 respecté.
 */
class TauriRecentsStore implements RecentsStore {
  private async fs(): Promise<any> {
    const spec = "@tauri-apps/plugin-fs";
    return await import(/* @vite-ignore */ spec);
  }

  async load(): Promise<string | null> {
    try {
      const fs = await this.fs();
      const opts = { baseDir: fs.BaseDirectory.AppLocalData };
      if (!(await fs.exists(STORE_FILE, opts))) return null;
      return await fs.readTextFile(STORE_FILE, opts);
    } catch {
      return null;
    }
  }

  async save(json: string): Promise<void> {
    try {
      const fs = await this.fs();
      await fs.writeTextFile(STORE_FILE, json, {
        baseDir: fs.BaseDirectory.AppLocalData,
      });
    } catch {
      /* no-op : échec silencieux */
    }
  }
}

/** Store localStorage : dev / tests. Ne throw jamais. */
class LocalStorageRecentsStore implements RecentsStore {
  async load(): Promise<string | null> {
    try {
      return localStorage.getItem(STORAGE_KEY);
    } catch {
      return null;
    }
  }

  async save(json: string): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, json);
    } catch {
      /* no-op */
    }
  }
}

/** Store mémoire : ultime repli si ni Tauri ni localStorage. */
class MemoryRecentsStore implements RecentsStore {
  private value: string | null = null;
  async load(): Promise<string | null> {
    return this.value;
  }
  async save(json: string): Promise<void> {
    this.value = json;
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
export function defaultStore(): RecentsStore {
  if (hasTauri()) return new TauriRecentsStore();
  if (hasLocalStorage()) return new LocalStorageRecentsStore();
  return new MemoryRecentsStore();
}

let activeStore: RecentsStore = defaultStore();

/** Injecte un store (tests, ou wiring spécifique). */
export function setRecentsStore(s: RecentsStore): void {
  activeStore = s;
}

/* ---------- (dé)sérialisation tolérante ---------- */

function isRecentItem(v: unknown): v is RecentItem {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  return (
    typeof o.path === "string" &&
    typeof o.title === "string" &&
    typeof o.openedAt === "number"
  );
}

function parse(json: string | null): RecentItem[] {
  if (!json) return [];
  try {
    const data = JSON.parse(json);
    if (!Array.isArray(data)) return [];
    return data.filter(isRecentItem).map((o) => {
      const item: RecentItem = {
        path: o.path,
        title: o.title,
        openedAt: o.openedAt,
      };
      if (o.broken === true) item.broken = true;
      return item;
    });
  } catch {
    return [];
  }
}

async function read(): Promise<RecentItem[]> {
  let raw: string | null = null;
  try {
    raw = await activeStore.load();
  } catch {
    raw = null;
  }
  return parse(raw);
}

async function write(items: RecentItem[]): Promise<void> {
  await activeStore.save(JSON.stringify(items));
}

/* ---------- API publique ---------- */

/**
 * Ajoute un récent : dédoublonne par `path` (l'ancien est retiré),
 * place le nouveau en tête, et plafonne la liste à 12.
 */
export async function addRecent(item: RecentItem): Promise<void> {
  const current = await read();
  const deduped = current.filter((r) => r.path !== item.path);
  const next = [item, ...deduped].slice(0, MAX_RECENTS);
  await write(next);
}

/** Renvoie les récents triés par `openedAt` décroissant. */
export async function listRecents(): Promise<RecentItem[]> {
  const items = await read();
  return items.sort((a, b) => b.openedAt - a.openedAt);
}

/** Vide la liste des récents. */
export async function clearRecents(): Promise<void> {
  await write([]);
}
