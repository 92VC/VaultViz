/* ============================================================
   VaultViz — service d'ouverture de fichier .vviz
   ============================================================

   T2.5 (Wave 2, SP2) : ouverture d'un .vviz via dialog natif et
   via glisser-déposer.

   - Dialog natif : `@tauri-apps/plugin-dialog` (open()).
   - Glisser-déposer : événement webview Tauri 2
     `getCurrentWebview().onDragDropEvent(...)`.

   Toute API Tauri est importée DYNAMIQUEMENT via un spécificateur
   NON littéral (+ `@vite-ignore`), comme dans `src/ui/theme.ts` :
     - tsc/Rollup ne tentent pas de résoudre les modules,
     - le build ne casse pas si un plugin manque,
     - happy-dom (tests sans Tauri) ne charge jamais Tauri.

   La détection `isTauri()` ne throw jamais (happy-dom-safe). Hors
   Tauri : `openViaDialog()` se résout à `null`, `onFileDrop()` est
   un no-op renvoyant une fonction de désabonnement inerte. */

const VVIZ_EXT = "vviz";

/**
 * Détecte la présence de l'API Tauri sans jamais throw.
 * En happy-dom `window.__TAURI__` (ou `__TAURI_INTERNALS__`) est
 * absent → false.
 */
export function isTauri(): boolean {
  try {
    return (
      typeof window !== "undefined" &&
      ("__TAURI__" in window || "__TAURI_INTERNALS__" in window)
    );
  } catch {
    return false;
  }
}

/** Vrai si le chemin pointe vers un fichier `.vviz` (insensible à la casse). */
function isVVizPath(path: string): boolean {
  return path.toLowerCase().endsWith("." + VVIZ_EXT);
}

/**
 * Ouvre le dialog natif de sélection de fichier filtré sur `.vviz`.
 * Renvoie le chemin choisi, ou `null` si l'utilisateur annule ou hors
 * Tauri. Ne throw pas.
 *
 * Import dynamique LITTÉRAL : Vite le résout et le bundle en chunk async,
 * donc il fonctionne réellement à l'exécution dans la WebView. (Un import
 * à spécificateur variable + `@vite-ignore` resterait non résolu et
 * échouerait au runtime — bug du bouton « Ouvrir ».) En tests happy-dom,
 * la garde `isTauri()` empêche d'atteindre cet import.
 */
export async function openViaDialog(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const dialog = await import("@tauri-apps/plugin-dialog");
    const picked = await dialog.open({
      title: "Ouvrir un fichier .vviz",
      multiple: false,
      directory: false,
      filters: [{ name: "Fichiers VaultViz", extensions: [VVIZ_EXT] }],
    });
    return typeof picked === "string" ? picked : null;
  } catch {
    return null;
  }
}

/**
 * S'abonne au glisser-déposer de la webview. Ne retient que les
 * fichiers `.vviz` (premier rencontré par événement « drop »).
 *
 * Renvoie une fonction de désabonnement. Hors Tauri : no-op, la
 * fonction renvoyée est inerte. Ne throw pas.
 */
export function onFileDrop(handler: (path: string) => void): () => void {
  if (!isTauri()) {
    return () => {
      /* no-op hors Tauri */
    };
  }

  // L'abonnement Tauri est asynchrone ; on capture l'unlisten dès
  // qu'il est disponible. Si un désabonnement est demandé avant, on
  // marque l'intention pour l'appliquer à l'arrivée.
  let unlisten: (() => void) | null = null;
  let cancelled = false;

  void (async () => {
    try {
      const { getCurrentWebview } = await import("@tauri-apps/api/webview");
      const off = await getCurrentWebview().onDragDropEvent((event: any) => {
        const payload = event?.payload;
        if (!payload || payload.type !== "drop") return;
        const paths: unknown = payload.paths;
        if (!Array.isArray(paths)) return;
        for (const p of paths) {
          if (typeof p === "string" && isVVizPath(p)) {
            handler(p);
            break; // un seul .vviz par drop
          }
        }
      });
      if (cancelled) {
        off();
      } else {
        unlisten = off;
      }
    } catch {
      /* abonnement indisponible : reste un no-op */
    }
  })();

  return () => {
    cancelled = true;
    if (unlisten) {
      try {
        unlisten();
      } catch {
        /* no-op */
      }
      unlisten = null;
    }
  };
}
