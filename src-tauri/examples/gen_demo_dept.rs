//! Génère `examples/demo_dept.parquet` — 96 départements x 8 catégories
//! avec un effectif aléatoire 50..1000 par couple. Tourné au build local
//! et lors de la préparation des resources MSI.
//!
//! Usage : cargo run --release --example gen_demo_dept

use std::env;
use std::error::Error;
use std::path::PathBuf;

use duckdb::Connection;

fn main() -> Result<(), Box<dyn Error>> {
    let manifest = env::var("CARGO_MANIFEST_DIR")?;
    let out = PathBuf::from(&manifest)
        .parent()
        .ok_or("CARGO_MANIFEST_DIR sans parent")?
        .join("examples")
        .join("demo_dept.parquet");

    let conn = Connection::open_in_memory()?;
    let sql = format!(
        r#"
        COPY (
          WITH cats(categorie) AS (VALUES
            ('A'), ('B'), ('C'), ('D'), ('E'), ('F'), ('G'), ('H')
          ),
          deps(code_dept) AS (
            SELECT LPAD(CAST(n AS VARCHAR), 2, '0')
            FROM range(1, 97) AS t(n)
          )
          SELECT d.code_dept,
                 c.categorie,
                 CAST(50 + (random() * 950) AS INTEGER) AS effectif
          FROM deps d CROSS JOIN cats c
          ORDER BY d.code_dept, c.categorie
        )
        TO '{}' (FORMAT PARQUET, COMPRESSION SNAPPY)
        "#,
        out.to_string_lossy().replace('\'', "''")
    );
    conn.execute_batch(&sql)?;

    let bytes = std::fs::metadata(&out)?.len();
    println!("OK : {} ({} octets)", out.display(), bytes);
    Ok(())
}
