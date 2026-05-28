//! VaultViz — Tauri 2 application library.
//!
//! Le binaire `main.rs` ne contient qu'un appel à [`run`]. Cette séparation
//! permet (1) la réutilisation pour cible mobile (out of scope ici, mais le
//! pattern reste conforme au template Tauri 2 officiel), (2) des tests
//! d'intégration ciblant directement les implémentations pures (suffix
//! `_impl`) sans démarrer un runtime Tauri.

pub mod commands;
pub mod error;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![commands::vviz::read_vviz])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
