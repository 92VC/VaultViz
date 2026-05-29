//! Génère le dataset canonique « suivi mensuel » (2 Parquet) dans `examples/`.
//!
//! Second exemple canonique SANS CARTE : prouve que VaultViz est un outil BI
//! générique, la carte choroplèthe étant optionnelle. Déterminisme via
//! `setseed` DuckDB (réémis avant chaque statement aléatoire) + `SET threads=1`.
//!
//! - `suivi_mensuel_mois.parquet`  : série temporelle mensuelle sur 24 mois
//!   (mois VARCHAR 'YYYY-MM', ca BIGINT, objectif BIGINT, marge_pct DOUBLE).
//! - `suivi_mensuel_canal.parquet` : répartition du CA par canal
//!   (canal VARCHAR, ca BIGINT).
//!
//! Usage : cargo run --manifest-path src-tauri/Cargo.toml --example gen_suivi_mensuel

use std::env;
use std::error::Error;
use std::path::PathBuf;

use duckdb::Connection;

/// Échappe les apostrophes pour un littéral SQL.
fn sql_lit(s: &str) -> String {
    s.replace('\'', "''")
}

fn main() -> Result<(), Box<dyn Error>> {
    let manifest = env::var("CARGO_MANIFEST_DIR")?;
    let repo = PathBuf::from(&manifest)
        .parent()
        .ok_or("CARGO_MANIFEST_DIR sans parent")?
        .to_path_buf();

    let out_mois = repo.join("examples").join("suivi_mensuel_mois.parquet");
    let out_canal = repo.join("examples").join("suivi_mensuel_canal.parquet");

    let conn = Connection::open_in_memory()?;
    conn.execute_batch("SET threads=1;")?;

    // --- Série mensuelle 24 mois : 2024-01 .. 2025-12 ---
    // Tendance + saisonnalité déterministes. Base mensuelle ~1 000 000, croissance
    // ~1,5 %/mois, saisonnalité sinusoïdale (creux estival), bruit via random().
    // L'objectif suit une trajectoire lisse (sans bruit). Marge entre ~11 et ~19 %.
    let copy_mois = format!(
        r#"
        SELECT setseed(0.314);
        COPY (
          WITH seq AS (
            SELECT i AS idx,
                   (DATE '2024-01-01' + (i || ' months')::INTERVAL) AS d
            FROM range(0, 24) t(i)
          ),
          calc AS (
            SELECT
              idx,
              strftime(d, '%Y-%m') AS mois,
              -- tendance : base + croissance composée légère
              1000000.0 * pow(1.015, idx) AS trend,
              -- saisonnalité : +/- 9 %, creux vers juillet/août
              (1 + 0.09 * cos(2 * pi() * (idx % 12) / 12.0)) AS season
            FROM seq
          )
          SELECT
            mois,
            CAST(round(trend * season * (0.97 + random() * 0.06)) AS BIGINT) AS ca,
            CAST(round(trend * (0.99 + 0.012 * idx / 24.0)) AS BIGINT) AS objectif,
            round(14.0 + 3.0 * sin(2 * pi() * idx / 12.0) + (random() - 0.5) * 2.0, 1) AS marge_pct
          FROM calc
          ORDER BY mois
        ) TO '{}' (FORMAT PARQUET, COMPRESSION SNAPPY);
        "#,
        sql_lit(&out_mois.to_string_lossy())
    );
    conn.execute_batch(&copy_mois)?;

    // --- Répartition par canal : 5 canaux, poids déterministes ---
    let canaux: &[(&str, f64)] = &[
        ("Agence", 0.38),
        ("Web", 0.27),
        ("Téléphone", 0.18),
        ("Partenaires", 0.11),
        ("Courrier", 0.06),
    ];
    let canal_values = canaux
        .iter()
        .map(|(c, p)| format!("('{}',{})", sql_lit(c), p))
        .collect::<Vec<_>>()
        .join(", ");

    // CA annuel total de référence ~ 13,2 M€, ventilé par poids + léger bruit.
    let copy_canal = format!(
        r#"
        SELECT setseed(0.271);
        COPY (
          WITH c(canal, p) AS (VALUES {canal_values})
          SELECT
            canal,
            CAST(round(13200000.0 * p * (0.92 + random() * 0.16)) AS BIGINT) AS ca
          FROM c
          ORDER BY ca DESC
        ) TO '{}' (FORMAT PARQUET, COMPRESSION SNAPPY);
        "#,
        sql_lit(&out_canal.to_string_lossy())
    );
    conn.execute_batch(&copy_canal)?;

    // --- Comptage des lignes produites ---
    for (label, path) in [("mois", &out_mois), ("canal", &out_canal)] {
        let p = sql_lit(&path.to_string_lossy());
        let n: i64 = conn.query_row(
            &format!("SELECT count(*) FROM read_parquet('{p}')"),
            [],
            |r| r.get(0),
        )?;
        println!("{label:<6} {n:>3} lignes  -> {}", path.display());
    }

    Ok(())
}
