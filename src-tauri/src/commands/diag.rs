//! Commande de journalisation côté front → fichier log local.
//!
//! Permet au front (`src/main.ts`, `shell/tabs.ts`) de tracer les étapes du
//! pipeline d'ouverture (ouverture, indexation par source, rendu, erreurs)
//! dans le **même fichier rotatif** que le Rust (`%LOCALAPPDATA%\VaultViz\
//! logs\`). Diagnostic récupérable par l'utilisateur, sans devtools.
//!
//! PII : `assert_no_pii` garde chaque ligne (rejet des littéraux SQL). Le
//! front n'envoie que des messages structurés (nom de source + chemin
//! résolu) — pas de valeurs de données.

use crate::log::{self, LogLevel};

/// Journalise un événement émis par le front. `level` ∈ {info, warn, error}.
#[tauri::command]
pub async fn log_event(level: String, msg: String) {
    let lvl = match level.as_str() {
        "error" => LogLevel::Error,
        "warn" => LogLevel::Warn,
        _ => LogLevel::Info,
    };
    let line = format!("[front] {msg}");
    if log::assert_no_pii(&line) {
        log::log(lvl, &line);
    } else {
        log::log(lvl, "[front] (message non journalisé — littéral détecté)");
    }
}
