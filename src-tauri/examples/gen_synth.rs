//! Génère le Parquet synthétique pour B-023 (et plus tard B-080).
//!
//! Substitut au CLI `duckdb` qui n'est pas systématiquement installé sur
//! les dev box. On passe par le crate `duckdb` bundled (cf. B-020), ce
//! qui garantit un format Parquet *exactement* identique à celui qui
//! sera lu en runtime par VaultViz.
//!
//! Usage :
//! ```bash
//! # Taille apparente ≈ 50 Mo Snappy
//! cargo run --release --example gen_synth -- 50 examples/synth_50mb.parquet
//! ```
//!
//! Heuristique de calibrage : ~19 000 lignes par Mo cible (validé empiriquement
//! sur le schéma utilisé : id INT64, code_dept INT32, lib_dept VARCHAR,
//! effectif DOUBLE, taux DOUBLE, jour DATE, categorie VARCHAR, hash VARCHAR).
//! Le facteur exact est `19_000` rows/Mo — vérifier la sortie réelle.

use std::env;
use std::error::Error;
use std::fs;
use std::path::PathBuf;

use duckdb::Connection;

const ROWS_PER_MB: i64 = 19_000;

fn main() -> Result<(), Box<dyn Error>> {
    let mut args = env::args().skip(1);
    let size_mb: u32 = args.next().unwrap_or_else(|| "50".to_string()).parse()?;
    let out_arg = args.next().unwrap_or_else(|| {
        // Si on est lancé via cargo, on connaît la racine via CARGO_MANIFEST_DIR.
        if let Ok(manifest_dir) = env::var("CARGO_MANIFEST_DIR") {
            let p = PathBuf::from(&manifest_dir)
                .parent()
                .unwrap()
                .join("examples")
                .join(format!("synth_{size_mb}mb.parquet"));
            p.to_string_lossy().into_owned()
        } else {
            format!("./examples/synth_{size_mb}mb.parquet")
        }
    });
    let out = PathBuf::from(&out_arg);
    if let Some(parent) = out.parent() {
        fs::create_dir_all(parent)?;
    }
    let out_sql = out.to_string_lossy().replace('\\', "/");
    let rows: i64 = (size_mb as i64) * ROWS_PER_MB;

    println!("Génération {out_sql} (~{size_mb} Mo cible, {rows} lignes)…");
    let conn = Connection::open_in_memory()?;
    let sql = format!(
        "COPY (
            SELECT
                range AS id,
                ((range % 96) + 1)::INTEGER AS code_dept,
                'libellé_' || (range % 96) AS lib_dept,
                random() * 1000 AS effectif,
                random() AS taux,
                date_add(DATE '2020-01-01', INTERVAL ((range % 365)::INTEGER) DAY) AS jour,
                CAST((range % 10) AS VARCHAR) AS categorie,
                md5(CAST(range AS VARCHAR)) AS hash
            FROM range({rows})
         ) TO '{out_sql}' (FORMAT PARQUET, COMPRESSION SNAPPY);"
    );
    conn.execute_batch(&sql)?;
    let size_bytes = fs::metadata(&out)?.len();
    println!(
        "OK  {out_sql} — {} octets ({} Mo)",
        size_bytes,
        size_bytes / (1024 * 1024)
    );
    Ok(())
}
