//! Commande Tauri `run_query` : exécute du SQL DuckDB et renvoie le
//! résultat en **Arrow IPC stream binaire** (pas de JSON intermédiaire,
//! cf. ADR-003 et critère B-022).
//!
//! Côté Tauri 2, la primitive pour renvoyer des octets bruts est
//! [`tauri::ipc::Response`]. Si on renvoyait un `Result<Vec<u8>, _>` brut,
//! `serde` sérialiserait le buffer en JSON `[12, 34, …]` — ce qui
//! violerait la contrainte « pas de conversion JSON intermédiaire ».
//! Avec [`Response::new(bytes)`], le runtime Tauri sérialise un
//! `InvokeResponseBody::Raw(bytes)` que la WebView reçoit comme un
//! `ArrayBuffer` (cf. `webview.eval` → `new Uint8Array(...).buffer`).

use tauri::ipc::Response;

use crate::duck::query_parquet;
use crate::error::VVizError;

/// Implémentation testable hors runtime Tauri (renvoie le `Vec<u8>` brut
/// avant emballage `Response`). Utilisé par `tests/duck_parquet.rs` et
/// par `gen_fixtures.rs`.
pub fn run_query_impl(sql: &str) -> Result<Vec<u8>, VVizError> {
    query_parquet(sql)
}

/// Commande Tauri exposée à la WebView via `invoke("run_query", { sql })`.
/// Côté JS, la promesse résout en `ArrayBuffer`, à passer directement à
/// `apache-arrow.tableFromIPC(new Uint8Array(buf))`.
#[tauri::command]
pub async fn run_query(sql: String) -> Result<Response, VVizError> {
    run_query_impl(&sql).map(Response::new)
}
