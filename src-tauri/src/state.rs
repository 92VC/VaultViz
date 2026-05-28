//! État applicatif partagé via le pattern `tauri::Manager::manage`.
//!
//! V0 expose un seul champ : une `Connection` DuckDB in-memory protégée
//! par un `Mutex` (DuckDB est thread-safe au niveau de la base, mais le
//! handle Rust `Connection` n'est pas `Sync` — `Mutex` est l'approche
//! recommandée par `duckdb-rs` pour partager une connexion entre threads
//! de la WebView).
//!
//! En V0 le wrapper `duck::query_parquet` ouvre une *nouvelle* connexion
//! éphémère par appel pour simplifier le scope (cf. B-021/B-022). On
//! garde malgré tout `AppState` enregistré dans Tauri pour pouvoir
//! basculer en V1 vers une connexion réutilisée (pool de connexions,
//! attached files, vues persistantes Mosaic).

use std::sync::Mutex;

use duckdb::Connection;

/// État partagé via `Tauri::manage`. Récupérable côté commandes par
/// `State<'_, AppState>` (cf. `commands::query::run_query` en B-022).
pub struct AppState {
    /// Connexion DuckDB in-memory. Le Mutex est conservatif : aucune des
    /// commandes V0 ne l'utilise effectivement, mais on prépare le terrain
    /// pour B-031+ (Mosaic Connector partageant la connexion).
    pub duck: Mutex<Connection>,
}

impl AppState {
    /// Construit un nouvel `AppState` avec une connexion DuckDB neuve
    /// in-memory. Renvoie l'erreur DuckDB native si l'init échoue (cas
    /// quasi impossible en in-memory, mais on évite tout `unwrap` au
    /// démarrage applicatif).
    pub fn new() -> Result<Self, duckdb::Error> {
        Ok(Self {
            duck: Mutex::new(Connection::open_in_memory()?),
        })
    }
}
