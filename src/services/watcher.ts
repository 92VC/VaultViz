/* ============================================================
   VaultViz — service de surveillance FS (B-120)
   ============================================================

   Expose trois fonctions :
     - startWatch(paths)  → invoque la commande Tauri `start_watch`
     - stopWatch()        → invoque la commande Tauri `stop_watch`
     - onDataChanged(cb)  → s'abonne à l'événement `vv://data-changed`

   Toutes les API Tauri sont importées DYNAMIQUEMENT via des
   spécificateurs NON littéraux (+ @vite-ignore) pour que :
     - tsc ne tente pas de résoudre les modules (typé `any`),
     - happy-dom (tests vitest) ne charge jamais les modules Tauri,
     - les mocks vi.mock("@tauri-apps/api/core") fonctionnent.

   En cas d'échec (hors Tauri, réseau, etc.) toutes les fonctions
   échouent silencieusement (catch + no-op) — VaultViz est local-first,
   le watcher est best-effort. */

type UnlistenFn = () => void;

/**
 * Démarre la surveillance des paths Parquet fournis.
 * Délègue à la commande Tauri Rust `start_watch`.
 * Ne throw pas.
 */
export async function startWatch(paths: string[]): Promise<void> {
  try {
    const { invoke } = await import(/* @vite-ignore */ "@tauri-apps/api/core");
    await invoke("start_watch", { paths });
  } catch {
    /* no-op : hors Tauri ou watcher indisponible */
  }
}

/**
 * Arrête la surveillance en cours.
 * Délègue à la commande Tauri Rust `stop_watch`.
 * Ne throw pas.
 */
export async function stopWatch(): Promise<void> {
  try {
    const { invoke } = await import(/* @vite-ignore */ "@tauri-apps/api/core");
    await invoke("stop_watch");
  } catch {
    /* no-op */
  }
}

/**
 * S'abonne à l'événement `vv://data-changed` émis par le watcher Rust.
 *
 * Le callback `cb` reçoit le chemin du fichier modifié (String).
 *
 * Renvoie la fonction de désabonnement (unlisten). Appeler `unlisten()`
 * arrête la réception des événements.
 *
 * Ne throw pas : en cas d'échec d'abonnement, renvoie un no-op.
 */
export async function onDataChanged(
  cb: (path: string) => void
): Promise<UnlistenFn> {
  try {
    const { listen } = await import(/* @vite-ignore */ "@tauri-apps/api/event");
    const unlisten = await listen(
      "vv://data-changed",
      (event: { payload: string }) => {
        cb(event.payload);
      }
    );
    return unlisten as UnlistenFn;
  } catch {
    /* no-op : hors Tauri ou événement indisponible */
    return () => {
      /* unlisten inerte */
    };
  }
}
