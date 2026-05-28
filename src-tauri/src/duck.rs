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

/// Exécute `sql` sur une connexion DuckDB in-memory neuve et renvoie le
/// résultat sérialisé en Arrow IPC stream.
///
/// **V0 — connexion éphémère** : on ouvre/ferme une connexion par appel.
/// C'est volontairement simple ; B-031 (Mosaic Connector) ré-utilisera la
/// connexion partagée via [`crate::state::AppState`].
///
/// Erreurs renvoyées (toutes mappées sur [`VVizError`]) :
/// - `NotFound` / `Forbidden` propagées si le SQL fait un `read_parquet`
///   sur un fichier absent / non accessible (heuristique sur le message).
/// - `Io` pour toute autre erreur DuckDB (parse SQL, type mismatch,
///   parquet corrompu…).
pub fn query_parquet(sql: &str) -> Result<Vec<u8>, VVizError> {
    let conn = Connection::open_in_memory()
        .map_err(|e| VVizError::Io(format!("ouverture connexion DuckDB : {e}")))?;

    let mut stmt = conn
        .prepare(sql)
        .map_err(|e| map_duck_error("préparation SQL", e))?;

    // `query_arrow` exécute la requête et renvoie un itérateur de
    // `RecordBatch` (cf. duckdb-rs `Arrow` struct). `get_schema()` est
    // disponible sur l'itérateur avant la consommation des batches —
    // c'est l'API publique stable depuis duckdb-rs 1.0.
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
    } // `writer` est drop ici, libérant l'emprunt sur `buffer`.

    Ok(buffer)
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
