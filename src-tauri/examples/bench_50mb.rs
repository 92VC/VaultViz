//! Bench B-023 — exécute trois requêtes représentatives sur un Parquet
//! synthétique ~50 Mo et mesure le temps wall-clock par requête. La RAM
//! peak (RSS) est mesurée externellement via `/usr/bin/time -v` sur le
//! processus complet (cf. `docs/scripts/bench-50mb.sh`).
//!
//! Le binaire est volontairement minimal : il **n'utilise pas** le wrapper
//! `query_parquet` (introduit en B-021) pour rester indépendant et
//! exécutable dès B-020. Cela mesure le coût brut DuckDB + I/O Parquet,
//! sans le surcoût de la sérialisation Arrow IPC (qui sera benchée
//! séparément en B-080 sur 300 Mo).
//!
//! Usage :
//! ```bash
//! cd src-tauri
//! cargo run --release --example bench_50mb -- ../examples/synth_50mb.parquet
//! ```
//!
//! Pré-requis : `examples/synth_50mb.parquet`, généré par le script
//! `docs/scripts/gen-synth-parquet.sh` (~50 Mo Snappy).

use std::env;
use std::error::Error;
use std::path::{Path, PathBuf};
use std::time::Instant;

use duckdb::Connection;

fn main() -> Result<(), Box<dyn Error>> {
    let parquet = locate_parquet()?;
    let size_bytes = std::fs::metadata(&parquet)?.len();
    println!("== Bench Parquet 50 Mo (Linux local NVMe, DuckDB embarqué) ==");
    println!("Fichier : {}", parquet.display());
    println!(
        "Taille  : {size_bytes} octets ({} Mo)\n",
        size_bytes / (1024 * 1024)
    );

    let path_sql = parquet.to_string_lossy().replace('\\', "/");
    let queries = [
        ("COUNT(*)", format!("SELECT COUNT(*) FROM '{path_sql}'")),
        (
            "GROUP BY code_dept",
            format!(
                "SELECT code_dept, AVG(effectif) AS m, COUNT(*) AS n
                 FROM '{path_sql}' GROUP BY code_dept ORDER BY code_dept"
            ),
        ),
        (
            "Filter + AGG",
            format!(
                "SELECT code_dept, AVG(taux) FROM '{path_sql}'
                 WHERE jour > '2020-06-01' GROUP BY code_dept"
            ),
        ),
    ];

    for (label, sql) in &queries {
        let conn = Connection::open_in_memory()?;
        let start = Instant::now();
        let mut stmt = conn.prepare(sql)?;
        let mut rows_consumed = 0usize;
        let mut rows = stmt.query([])?;
        while let Some(_row) = rows.next()? {
            rows_consumed += 1;
        }
        let elapsed = start.elapsed();
        println!(
            "[{label:>20}] elapsed = {:>8.3} ms — lignes consommées : {rows_consumed}",
            elapsed.as_secs_f64() * 1000.0,
        );
    }
    Ok(())
}

fn locate_parquet() -> Result<PathBuf, Box<dyn Error>> {
    // Résolution dans l'ordre :
    //   1. argv[1] (`bench_50mb /path/to/parquet`)
    //   2. variable d'env `VV_BENCH_PARQUET`
    //   3. `<repo>/examples/synth_50mb.parquet` via `CARGO_MANIFEST_DIR`
    //   4. fallback `./examples/synth_50mb.parquet` (cwd)
    if let Some(arg) = env::args().nth(1) {
        return check(&PathBuf::from(arg));
    }
    if let Ok(env_path) = env::var("VV_BENCH_PARQUET") {
        return check(&PathBuf::from(env_path));
    }
    if let Ok(manifest_dir) = env::var("CARGO_MANIFEST_DIR") {
        let p = Path::new(&manifest_dir)
            .parent()
            .ok_or("racine repo introuvable")?
            .join("examples")
            .join("synth_50mb.parquet");
        if p.exists() {
            return Ok(p);
        }
    }
    check(&PathBuf::from("./examples/synth_50mb.parquet"))
}

fn check(p: &Path) -> Result<PathBuf, Box<dyn Error>> {
    if !p.exists() {
        return Err(format!(
            "fichier manquant : {}\n   regénérer via : docs/scripts/gen-synth-parquet.sh 50",
            p.display()
        )
        .into());
    }
    Ok(p.to_path_buf())
}
