//! B-021 — Tests d'intégration du wrapper `query_parquet`.
//!
//! On évite la dépendance à un fichier versionné `examples/sample.parquet`
//! (politique `.gitignore : *.parquet`) en générant la fixture à la volée
//! via DuckDB lui-même dans un `tempfile::tempdir`. Bénéfice : test
//! hermétique, pas de pré-requis d'environnement, exactement le même
//! format Parquet entre fixture et runtime (cf. ADR-003).
//!
//! La fixture pérenne `examples/sample.parquet` est régénérable via
//! `cargo run --release --example gen_fixtures -- sample` (cf.
//! `examples/gen_fixtures.rs`).

use arrow::ipc::reader::StreamReader;
use duckdb::Connection;
use std::io::Cursor;
use tempfile::tempdir;
use vaultviz_lib::duck::query_parquet;
use vaultviz_lib::error::VVizError;

const SAMPLE_ROWS: i64 = 50_000;

/// Génère un Parquet ~1 Mo dans un répertoire temporaire et renvoie son
/// chemin formaté pour SQL DuckDB (séparateurs `/`).
fn build_sample_parquet(dir: &std::path::Path) -> String {
    let parquet = dir.join("sample.parquet");
    let path_sql = parquet.to_string_lossy().replace('\\', "/");
    let conn = Connection::open_in_memory().expect("open in-memory");
    let sql = format!(
        "COPY (SELECT range AS id,
                      'item_' || range AS label,
                      random() AS value
               FROM range({SAMPLE_ROWS}))
         TO '{path_sql}' (FORMAT PARQUET, COMPRESSION SNAPPY);"
    );
    conn.execute_batch(&sql).expect("write sample parquet");
    path_sql
}

/// Décode un buffer Arrow IPC stream et renvoie la première valeur i64 du
/// premier batch (utilitaire de test : permet de vérifier la valeur de
/// retour d'un `COUNT(*)`).
fn first_i64_from_ipc(bytes: &[u8]) -> i64 {
    let cursor = Cursor::new(bytes);
    let reader = StreamReader::try_new(cursor, None).expect("ipc stream reader");
    let batch = reader
        .into_iter()
        .next()
        .expect("au moins un batch")
        .expect("batch sans erreur");
    let col = batch
        .column(0)
        .as_any()
        .downcast_ref::<arrow::array::Int64Array>()
        .expect("première colonne Int64Array");
    col.value(0)
}

#[test]
fn count_sample_parquet_returns_ipc_bytes_and_correct_count() {
    let dir = tempdir().expect("tempdir");
    let path_sql = build_sample_parquet(dir.path());

    let bytes = query_parquet(&format!(
        "SELECT COUNT(*)::BIGINT AS n FROM read_parquet('{path_sql}')"
    ))
    .expect("query ok");
    assert!(!bytes.is_empty(), "buffer IPC non vide");
    // Confirme aussi la sémantique de bout en bout : le COUNT décodé
    // depuis l'IPC vaut bien le nombre de lignes injectées.
    let n = first_i64_from_ipc(&bytes);
    assert_eq!(n, SAMPLE_ROWS);
}

#[test]
fn missing_parquet_returns_not_found_no_panic() {
    let result = query_parquet(
        "SELECT * FROM read_parquet('/tmp/__vaultviz_does_not_exist__.parquet')",
    );
    assert!(result.is_err(), "attendu erreur, obtenu {result:?}");
    // Heuristique mapping → NotFound si le message DuckDB le permet ;
    // sinon Io (acceptable). On vérifie au moins qu'aucun crash ne se
    // produit (critère BACKLOG).
    match result.unwrap_err() {
        VVizError::NotFound(_) | VVizError::Io(_) => {}
        other => panic!("variante d'erreur inattendue : {other:?}"),
    }
}

#[test]
fn malformed_sql_returns_invalid_no_panic() {
    let result = query_parquet("THIS IS NOT SQL");
    assert!(result.is_err());
    // L'erreur du parser SQL est typiquement mappée Invalid (ou Io en
    // fallback). On accepte les deux pour rester robuste à un changement
    // de wording côté DuckDB.
    match result.unwrap_err() {
        VVizError::Invalid(_) | VVizError::Io(_) => {}
        other => panic!("variante d'erreur inattendue : {other:?}"),
    }
}
