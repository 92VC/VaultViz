//! Génération reproductible des fixtures Parquet + Arrow IPC utilisées
//! par les tests Rust (B-021) et JS (B-022), ainsi que par le bench
//! B-023 50 Mo synthétique.
//!
//! On passe par le crate `duckdb` plutôt que par le CLI `duckdb` (qui n'est
//! pas installé sur la dev box Fedora) : un seul codepath, exactement la
//! même version DuckDB que celle embarquée par VaultViz (cf. B-020). Évite
//! tout risque de différence de format Parquet entre fixtures et runtime.
//!
//! Usage :
//! ```bash
//! # depuis src-tauri/
//! cargo run --release --example gen_fixtures -- sample
//! cargo run --release --example gen_fixtures -- ipc
//! cargo run --release --example gen_fixtures -- synth 50      # ~50 Mo
//! cargo run --release --example gen_fixtures -- all           # sample + ipc
//! ```
//!
//! Sorties (chemins relatifs à la racine du repo) :
//! - `examples/sample.parquet`          ~1 Mo, 50 000 lignes  (versionné ? voir .gitignore)
//! - `examples/fixtures/one_row.ipc`    fixture Arrow IPC stream pour test JS
//! - `examples/synth_<N>mb.parquet`     bench (ignoré par git)

use std::env;
use std::error::Error;
use std::fs;
use std::path::{Path, PathBuf};
use std::process;

use duckdb::Connection;

fn main() {
    let args: Vec<String> = env::args().collect();
    let cmd = args.get(1).cloned().unwrap_or_else(|| "all".to_string());
    let arg2 = args.get(2).cloned();

    if let Err(e) = run(&cmd, arg2.as_deref()) {
        eprintln!("erreur génération fixture {cmd} : {e}");
        process::exit(1);
    }
}

fn run(cmd: &str, arg: Option<&str>) -> Result<(), Box<dyn Error>> {
    let repo_root = repo_root()?;
    match cmd {
        "sample" => gen_sample(&repo_root),
        "ipc" => gen_one_row_ipc(&repo_root),
        "synth" => {
            let size_mb: u32 = arg.unwrap_or("50").parse()?;
            gen_synth(&repo_root, size_mb)
        }
        "all" => {
            gen_sample(&repo_root)?;
            gen_one_row_ipc(&repo_root)
        }
        other => Err(format!(
            "commande inconnue : {other} (attendu : sample | ipc | synth <N> | all)"
        )
        .into()),
    }
}

/// Résout la racine du repo en remontant depuis le `CARGO_MANIFEST_DIR`
/// (`src-tauri/`) d'un niveau.
fn repo_root() -> Result<PathBuf, Box<dyn Error>> {
    let manifest_dir = env::var("CARGO_MANIFEST_DIR")
        .map_err(|_| "CARGO_MANIFEST_DIR absent — lancer via cargo run")?;
    let root = Path::new(&manifest_dir)
        .parent()
        .ok_or("racine repo introuvable")?
        .to_path_buf();
    Ok(root)
}

/// `examples/sample.parquet` — petit (~1 Mo, 50 000 lignes), versionné
/// éventuellement (cf. .gitignore). Sert aux tests `duck_parquet`.
fn gen_sample(root: &Path) -> Result<(), Box<dyn Error>> {
    let out = root.join("examples").join("sample.parquet");
    fs::create_dir_all(out.parent().unwrap())?;
    let out_str = out.to_string_lossy().replace('\\', "/");
    let conn = Connection::open_in_memory()?;
    let sql = format!(
        "COPY (
            SELECT range AS id,
                   'item_' || range AS label,
                   random() AS value
            FROM range(50000)
         ) TO '{out_str}' (FORMAT PARQUET, COMPRESSION SNAPPY);"
    );
    conn.execute_batch(&sql)?;
    println!(
        "OK  examples/sample.parquet ({} octets)",
        fs::metadata(&out)?.len()
    );
    Ok(())
}

/// `examples/fixtures/one_row.ipc` — fixture Arrow IPC stream à 1 ligne,
/// utilisée par le test JS d'aller-retour IPC (B-022) sans avoir besoin
/// de DuckDB côté JS.
///
/// On passe par le wrapper `query_parquet` lui-même afin d'être sûr que
/// le format produit soit strictement identique à celui que verra le JS
/// en production.
fn gen_one_row_ipc(root: &Path) -> Result<(), Box<dyn Error>> {
    let out_dir = root.join("examples").join("fixtures");
    fs::create_dir_all(&out_dir)?;
    let out = out_dir.join("one_row.ipc");
    let bytes = vaultviz_lib::duck::query_parquet("SELECT 42 AS answer")?;
    fs::write(&out, &bytes)?;
    println!("OK  examples/fixtures/one_row.ipc ({} octets)", bytes.len());
    Ok(())
}

/// `examples/synth_<N>mb.parquet` — bench B-023. Ignoré par git
/// (`*.parquet` côté .gitignore).
fn gen_synth(root: &Path, size_mb: u32) -> Result<(), Box<dyn Error>> {
    let out = root
        .join("examples")
        .join(format!("synth_{size_mb}mb.parquet"));
    fs::create_dir_all(out.parent().unwrap())?;
    let out_str = out.to_string_lossy().replace('\\', "/");
    // Heuristique de calibrage : ~50 000 lignes / Mo cible (Snappy, schéma
    // ci-dessous). Réajusté empiriquement en Wave 8 pour la cible 300 Mo.
    let rows: i64 = (size_mb as i64) * 50_000;
    println!("Génération {out_str} (~{size_mb} Mo cible, {rows} lignes)…");
    let conn = Connection::open_in_memory()?;
    let sql = format!(
        "COPY (
            SELECT
                range AS id,
                (range % 96) + 1 AS code_dept,
                'libellé_' || (range % 96) AS lib_dept,
                random() * 1000 AS effectif,
                random() AS taux,
                date_add(DATE '2020-01-01', INTERVAL ((range % 365)::INTEGER) DAY) AS jour,
                CAST((range % 10) AS VARCHAR) AS categorie,
                md5(CAST(range AS VARCHAR)) AS hash
            FROM range({rows})
         ) TO '{out_str}' (FORMAT PARQUET, COMPRESSION SNAPPY);"
    );
    conn.execute_batch(&sql)?;
    println!(
        "OK  {out_str} ({} octets)",
        fs::metadata(&out)?.len()
    );
    Ok(())
}
