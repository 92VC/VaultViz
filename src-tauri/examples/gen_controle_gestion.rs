//! Génère le dataset canonique « contrôle de gestion » (3 Parquet) dans
//! `examples/` : départements, catégories, trimestres.
//!
//! Inspiré de la maquette `mockups/VaultViz/assets/data.js`. L'égalité
//! numérique exacte avec le JS n'est pas requise : on vise une structure
//! fidèle et une forme visuelle plausible. Déterminisme via `setseed` DuckDB
//! (réémis avant chaque statement aléatoire) + `SET threads=1`.
//!
//! Usage : cargo run --manifest-path src-tauri/Cargo.toml --example gen_controle_gestion

use std::collections::HashMap;
use std::env;
use std::error::Error;
use std::path::PathBuf;

use duckdb::Connection;
use serde_json::Value;

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

    // --- Lecture du geojson : code -> nom ---
    let geo_path = repo.join("src").join("assets").join("departements-v0.geojson");
    let geo_raw = std::fs::read_to_string(&geo_path)?;
    let geo: Value = serde_json::from_str(&geo_raw)?;
    let features = geo
        .get("features")
        .and_then(|f| f.as_array())
        .ok_or("geojson sans tableau `features`")?;

    let mut deps: Vec<(String, String)> = Vec::with_capacity(features.len());
    for f in features {
        let props = f.get("properties").ok_or("feature sans `properties`")?;
        let code = props
            .get("code")
            .and_then(|c| c.as_str())
            .ok_or("propriété `code` manquante")?
            .to_string();
        let nom = props
            .get("nom")
            .and_then(|n| n.as_str())
            .ok_or("propriété `nom` manquante")?
            .to_string();
        deps.push((code, nom));
    }
    deps.sort_by(|a, b| a.0.cmp(&b.0));

    // --- REGIONS (recopié exactement de data.js) -> inverse code->region ---
    let regions: &[(&str, &[&str])] = &[
        ("Auvergne-Rhône-Alpes", &["01", "03", "07", "15", "26", "38", "42", "43", "63", "69", "73", "74"]),
        ("Bourgogne-Franche-Comté", &["21", "25", "39", "58", "70", "71", "89", "90"]),
        ("Bretagne", &["22", "29", "35", "56"]),
        ("Centre-Val de Loire", &["18", "28", "36", "37", "41", "45"]),
        ("Corse", &["2A", "2B"]),
        ("Grand Est", &["08", "10", "51", "52", "54", "55", "57", "67", "68", "88"]),
        ("Hauts-de-France", &["02", "59", "60", "62", "80"]),
        ("Île-de-France", &["75", "77", "78", "91", "92", "93", "94", "95"]),
        ("Normandie", &["14", "27", "50", "61", "76"]),
        ("Nouvelle-Aquitaine", &["16", "17", "19", "23", "24", "33", "40", "47", "64", "79", "86", "87"]),
        ("Occitanie", &["09", "11", "12", "30", "31", "32", "34", "46", "48", "65", "66", "81", "82"]),
        ("Pays de la Loire", &["44", "49", "53", "72", "85"]),
        ("Provence-Alpes-Côte d'Azur", &["04", "05", "06", "13", "83", "84"]),
    ];
    let mut region_of: HashMap<&str, &str> = HashMap::new();
    for (r, arr) in regions {
        for c in *arr {
            region_of.insert(c, r);
        }
    }

    // --- WEIGHT (code -> poids CA), défaut 0.75 ---
    let weight_tbl: &[(&str, f64)] = &[
        ("75", 10.0), ("92", 6.4), ("69", 5.2), ("13", 4.6), ("59", 4.4),
        ("33", 3.6), ("31", 3.5), ("44", 3.1), ("06", 3.0), ("78", 2.9),
        ("38", 2.8), ("67", 2.6), ("93", 2.5), ("94", 2.4), ("91", 2.2),
        ("77", 2.1), ("34", 2.0), ("35", 1.9), ("95", 1.9), ("76", 1.8),
        ("83", 1.8), ("62", 1.7), ("68", 1.5), ("74", 1.6), ("57", 1.5),
        ("60", 1.4), ("63", 1.3), ("21", 1.3), ("49", 1.3), ("30", 1.2),
        ("42", 1.2),
    ];
    let weight_of: HashMap<&str, f64> = weight_tbl.iter().copied().collect();

    // --- Construction du VALUES de base (code, nom, region, weight) ---
    let mut rows: Vec<String> = Vec::with_capacity(deps.len());
    for (code, nom) in &deps {
        let region = region_of
            .get(code.as_str())
            .copied()
            .ok_or_else(|| format!("code sans région : {code}"))?;
        let weight = weight_of.get(code.as_str()).copied().unwrap_or(0.75);
        rows.push(format!(
            "('{}','{}','{}',{})",
            sql_lit(code),
            sql_lit(nom),
            sql_lit(region),
            weight
        ));
    }
    let values = rows.join(",\n        ");

    // Catégories : CATS + CAT_BASE
    let cats: &[(&str, f64)] = &[
        ("Logiciel", 0.42),
        ("Services", 0.27),
        ("Matériel", 0.16),
        ("Formation", 0.09),
        ("Support", 0.06),
    ];
    let cats_values = cats
        .iter()
        .map(|(c, b)| format!("('{}',{})", sql_lit(c), b))
        .collect::<Vec<_>>()
        .join(", ");

    // Trimestres : qpat
    let qpat: &[(&str, f64)] = &[("T1", 0.22), ("T2", 0.25), ("T3", 0.24), ("T4", 0.29)];
    let q_values = qpat
        .iter()
        .map(|(t, p)| format!("('{}',{})", t, p))
        .collect::<Vec<_>>()
        .join(", ");

    let conn = Connection::open_in_memory()?;
    conn.execute_batch("SET threads=1;")?;

    // --- Table dep : colonnes dérivées matérialisées ---
    // Inner CTE `base` : matérialise ca et le random du budget pour éviter
    // toute réévaluation de random() lors des références aux alias.
    let create_dep = format!(
        r#"
        SELECT setseed(0.42);
        CREATE TABLE dep AS
        WITH src(code, nom, region, weight) AS (
          VALUES
        {values}
        ),
        base AS (
          SELECT
            code, nom, region, weight,
            CAST(round(weight * 1180000 * (0.82 + random()*0.4)) AS BIGINT) AS ca,
            round((9 + random()*23), 1) AS marge_pct,
            (0.90 + random()*0.22) AS budget_div
          FROM src
        ),
        derived AS (
          SELECT
            code, nom, region, ca, marge_pct,
            CAST(round(ca / budget_div) AS BIGINT) AS budget,
            ca AS realise
          FROM base
        )
        SELECT
          code, nom, region, ca, marge_pct, budget, realise,
          (realise - budget) AS ecart,
          round(((realise - budget)::DOUBLE / budget) * 100, 1) AS ecart_pct,
          CASE
            WHEN round(((realise - budget)::DOUBLE / budget) * 100, 1) >= 1.5 THEN 'Atteint'
            WHEN round(((realise - budget)::DOUBLE / budget) * 100, 1) >= -4 THEN 'À risque'
            ELSE 'Sous-objectif'
          END AS statut,
          round((random()-0.32)*26, 1) AS yoy_ca,
          round((random()-0.45)*7, 1) AS yoy_marge
        FROM derived
        ORDER BY code;
        "#
    );
    conn.execute_batch(&create_dep)?;

    let out_dep = repo.join("examples").join("controle_gestion_departements.parquet");
    let out_cat = repo.join("examples").join("controle_gestion_categories.parquet");
    let out_q = repo.join("examples").join("controle_gestion_quarters.parquet");

    // --- COPY départements ---
    let copy_dep = format!(
        r#"
        SELECT setseed(0.42);
        COPY (
          SELECT
            code, nom, region, ca, marge_pct, budget, realise, ecart, ecart_pct, statut
          FROM dep
          ORDER BY code
        ) TO '{}' (FORMAT PARQUET, COMPRESSION SNAPPY);
        "#,
        sql_lit(&out_dep.to_string_lossy())
    );
    conn.execute_batch(&copy_dep)?;

    // --- COPY catégories : CROSS JOIN cats, poids aléatoire normalisé par dép ---
    let copy_cat = format!(
        r#"
        SELECT setseed(0.42);
        COPY (
          WITH cats(categorie, cat_base) AS (VALUES {cats_values}),
          weighted AS (
            SELECT d.code, d.ca, c.categorie,
                   c.cat_base * (0.7 + random()*0.6) AS raw
            FROM dep d CROSS JOIN cats c
          ),
          tot AS (
            SELECT code, SUM(raw) AS sraw FROM weighted GROUP BY code
          )
          SELECT w.code, w.categorie,
                 CAST(round(w.ca * (w.raw / t.sraw)) AS BIGINT) AS montant
          FROM weighted w JOIN tot t USING (code)
          ORDER BY w.code, w.categorie
        ) TO '{}' (FORMAT PARQUET, COMPRESSION SNAPPY);
        "#,
        sql_lit(&out_cat.to_string_lossy())
    );
    conn.execute_batch(&copy_cat)?;

    // --- COPY trimestres : CROSS JOIN qpat ---
    let copy_q = format!(
        r#"
        SELECT setseed(0.42);
        COPY (
          WITH q(trimestre, p) AS (VALUES {q_values})
          SELECT d.code, q.trimestre,
                 CAST(round(d.realise * q.p * (0.92 + random()*0.16)) AS BIGINT) AS realise,
                 CAST(round(d.budget  * q.p * (0.95 + random()*0.10)) AS BIGINT) AS budget
          FROM dep d CROSS JOIN q
          ORDER BY d.code, q.trimestre
        ) TO '{}' (FORMAT PARQUET, COMPRESSION SNAPPY);
        "#,
        sql_lit(&out_q.to_string_lossy())
    );
    conn.execute_batch(&copy_q)?;

    // --- Comptage des lignes produites ---
    for (label, path) in [
        ("departements", &out_dep),
        ("categories", &out_cat),
        ("quarters", &out_q),
    ] {
        let p = sql_lit(&path.to_string_lossy());
        let n: i64 = conn.query_row(
            &format!("SELECT count(*) FROM read_parquet('{p}')"),
            [],
            |r| r.get(0),
        )?;
        println!("{label:<14} {n:>4} lignes  -> {}", path.display());
    }

    Ok(())
}
