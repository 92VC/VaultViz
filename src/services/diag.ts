// Journalisation des étapes du pipeline vers le fichier log local (via la
// commande Tauri `log_event`). Best-effort : aucune exception ne remonte,
// no-op hors Tauri (tests, navigateur). Sert au diagnostic des blocages
// d'ouverture (ex. « Indexation » figée) récupérable dans
// `%LOCALAPPDATA%\VaultViz\logs\` sans devtools.

import { invoke } from "@tauri-apps/api/core";

export type DiagLevel = "info" | "warn" | "error";

export function logEvent(level: DiagLevel, msg: string): void {
  try {
    void invoke("log_event", { level, msg }).catch(() => {});
  } catch {
    /* hors runtime Tauri : no-op */
  }
}
