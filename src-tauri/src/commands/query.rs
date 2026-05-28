//! Commande Tauri `run_query` : exécute du SQL DuckDB **sur la connexion
//! partagée** (AppState) et renvoie le résultat en Arrow IPC stream
//! binaire (cf. ADR-003).
//!
//! Connexion partagée OBLIGATOIRE pour que les `CREATE OR REPLACE VIEW`
//! exécutés par `loadSources` côté front persistent entre les appels
//! suivants. Une connexion in-memory neuve par appel — comme c'était le
//! cas jusqu'à rc5 — perdait toutes les vues et les requêtes des views
//! échouaient avec `Catalog Error: Table with name effectifs does not exist`.

use tauri::ipc::Response;

use crate::duck::{query_parquet, query_parquet_on};
use crate::error::VVizError;
use crate::state::AppState;

/// Implémentation testable hors runtime Tauri (connexion in-memory neuve).
/// Utilisée par `tests/duck_parquet.rs` et `examples/gen_fixtures.rs`.
pub fn run_query_impl(sql: &str) -> Result<Vec<u8>, VVizError> {
    query_parquet(sql)
}

/// Commande Tauri exposée à la WebView via `invoke("run_query", { sql })`.
/// Utilise la connexion DuckDB partagée du `AppState`.
#[tauri::command]
pub async fn run_query(
    sql: String,
    state: tauri::State<'_, AppState>,
) -> Result<Response, VVizError> {
    let guard = state
        .duck
        .lock()
        .map_err(|e| VVizError::Io(format!("verrou connexion DuckDB empoisonné : {e}")))?;
    let bytes = query_parquet_on(&guard, &sql)?;
    Ok(Response::new(bytes))
}
