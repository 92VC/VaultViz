//! Wrapper DuckDB : exécution d'une requête SQL → sortie Apache Arrow IPC
//! (format *stream*, pas *file*).
//!
//! Cette fonction est le cœur du pipeline ADR-003 : DuckDB lit le Parquet
//! (push-down filtres/projections), produit des `RecordBatch` Arrow en
//! zéro-copie, et on les sérialise en IPC stream pour transit Rust →
//! WebView2 (cf. B-022). Aucun JSON intermédiaire — le buffer renvoyé
//! peut être passé tel quel à `apache-arrow.tableFromIPC()` côté JS.
//!
//! Choix de version : `arrow` est déclaré côté Cargo.toml *uniquement*
//! avec la feature `ipc` et la même version majeure (58.x) que celle
//! utilisée en interne par `duckdb-rs`. Cargo unifie les deux en un
//! unique artefact — pas de version skew sur `RecordBatch` / `Schema`.

use arrow::ipc::writer::StreamWriter;
use duckdb::Connection;

use crate::error::VVizError;

/// Exécute `sql` sur une **connexion existante** et renvoie le résultat
/// Arrow IPC stream. C'est cette variante qui doit être utilisée par
/// la commande Tauri afin que les `CREATE VIEW` / `INSTALL` / `LOAD` /
/// etc. persistent entre appels — sinon chaque vue redevient invisible
/// dès le retour de la fonction (bug V0 rc5).
pub fn query_parquet_on(conn: &Connection, sql: &str) -> Result<Vec<u8>, VVizError> {
    let mut stmt = conn
        .prepare(sql)
        .map_err(|e| map_duck_error("préparation SQL", e))?;

    let arrow_iter = stmt
        .query_arrow([])
        .map_err(|e| map_duck_error("exécution SQL", e))?;
    let schema = arrow_iter.get_schema();

    let mut buffer: Vec<u8> = Vec::with_capacity(64 * 1024);
    {
        let mut writer = StreamWriter::try_new(&mut buffer, &schema)
            .map_err(|e| VVizError::Io(format!("init Arrow IPC writer : {e}")))?;
        for batch in arrow_iter {
            writer
                .write(&batch)
                .map_err(|e| VVizError::Io(format!("écriture batch Arrow : {e}")))?;
        }
        writer
            .finish()
            .map_err(|e| VVizError::Io(format!("finalisation Arrow IPC : {e}")))?;
    }
    Ok(buffer)
}

/// Compat / tests : exécute `sql` sur une connexion in-memory neuve.
/// **Ne pas utiliser depuis la commande Tauri** (perte d'état entre
/// appels). Réservé aux tests d'intégration `duck_parquet.rs` et au
/// binaire `gen_fixtures.rs`.
pub fn query_parquet(sql: &str) -> Result<Vec<u8>, VVizError> {
    let conn = Connection::open_in_memory()
        .map_err(|e| VVizError::Io(format!("ouverture connexion DuckDB : {e}")))?;
    query_parquet_on(&conn, sql)
}

/// Mappe une erreur DuckDB vers `VVizError` en hedgeant les codes les
/// plus utiles côté UI. DuckDB n'expose pas de codes typés stables pour
/// les erreurs de fichier ; on fait une heuristique sur le message —
/// suffisant pour différencier "fichier inexistant" de "type mismatch".
fn map_duck_error(stage: &str, err: duckdb::Error) -> VVizError {
    let msg = err.to_string();
    let lower = msg.to_lowercase();
    if lower.contains("no such file")
        || lower.contains("file or directory")
        || lower.contains("cannot open file")
        || lower.contains("does not exist")
    {
        VVizError::NotFound(format!("{stage} : {msg}"))
    } else if lower.contains("permission denied") || lower.contains("access denied") {
        VVizError::Forbidden(format!("{stage} : {msg}"))
    } else if lower.contains("invalid") || lower.contains("parser") || lower.contains("syntax") {
        VVizError::Invalid(format!("{stage} : {msg}"))
    } else {
        VVizError::Io(format!("{stage} : {msg}"))
    }
}
