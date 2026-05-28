// VaultViz — Tauri 2 application entry point
// Shared library so the same entry point can be reused for mobile (out of scope here)
// and so that integration tests can exercise the builder.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
