//! VaultViz — Tauri 2 application library.
//!
//! Le binaire `main.rs` ne contient qu'un appel à [`run`]. Cette séparation
//! permet (1) la réutilisation pour cible mobile (out of scope ici, mais le
//! pattern reste conforme au template Tauri 2 officiel), (2) des tests
//! d'intégration ciblant directement les implémentations pures (suffix
//! `_impl`) sans démarrer un runtime Tauri.

pub mod commands;
pub mod duck;
pub mod error;
pub mod log;
pub mod state;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // `AppState` héberge la connexion DuckDB partagée (cf. `state.rs`).
    // V0 n'en a pas l'usage (chaque `run_query` ouvre sa propre
    // connexion in-memory), mais on l'enregistre dès B-022 pour que
    // B-031 (Mosaic Connector) puisse y accéder via `State<'_, AppState>`.
    let app_state = state::AppState::new().expect("init AppState (DuckDB in-memory)");

    // B-062 — logger rotatif local (`%LOCALAPPDATA%\VaultViz\logs`).
    // Trace minimaliste : on enregistre juste la version au démarrage,
    // sans payload utilisateur. `assert_no_pii` gardera le message.
    // Logger global (accessible aux commandes via `log::log`) + logger
    // managé conservé pour compat.
    log::init_global();
    let logger = log::Logger::new_default();
    let start_msg = format!("VaultViz {} started", env!("CARGO_PKG_VERSION"));
    if log::assert_no_pii(&start_msg) {
        log::log(log::LogLevel::Info, &start_msg);
    }

    // B-120 — état du watcher FS debouncé.
    let watcher_state = commands::watch::WatcherState::new();

    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_dialog::init())
        .manage(app_state)
        .manage(logger)
        .manage(watcher_state)
        .invoke_handler(tauri::generate_handler![
            commands::vviz::read_vviz,
            commands::query::run_query,
            commands::startup::startup_path,
            commands::diag::log_event,
            commands::cache::materialize_source,
            commands::watch::start_watch,
            commands::watch::stop_watch,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
