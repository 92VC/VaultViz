//! B-020 — Smoke test DuckDB embarqué (`feature = "bundled"`).
//!
//! Vérifie qu'au moins la liaison Rust ↔ DuckDB est fonctionnelle :
//! - ouverture d'une connexion in-memory (pas de fichier sur disque, pas de DLL)
//! - exécution d'un `SELECT` scalaire et d'un `COUNT(*)` sur des valeurs inline
//!
//! Si ce test compile et passe, on a la garantie que le binaire embarque
//! bien DuckDB statiquement (cf. ADR-001).

use duckdb::{Connection, Result};

#[test]
fn select_42_returns_42() -> Result<()> {
    let conn = Connection::open_in_memory()?;
    let v: i32 = conn.query_row("SELECT 42", [], |r| r.get(0))?;
    assert_eq!(v, 42);
    Ok(())
}

#[test]
fn count_inline_values() -> Result<()> {
    let conn = Connection::open_in_memory()?;
    let n: i64 = conn.query_row(
        "SELECT COUNT(*) FROM (VALUES (1), (2), (3)) AS t(x)",
        [],
        |r| r.get(0),
    )?;
    assert_eq!(n, 3);
    Ok(())
}
