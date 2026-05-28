// Tests B-062 — rotation + plafond + no-PII pour `log::Logger`.
//
// On utilise `tempfile::tempdir` pour isoler chaque test du logger
// par défaut (`%LOCALAPPDATA%\VaultViz\logs`). Les tests ciblent
// directement la lib `vaultviz_lib::log` (sans runtime Tauri).

use chrono::{Duration, Utc};
use tempfile::tempdir;
use vaultviz_lib::log::{
    assert_no_pii, LogLevel, Logger, RETENTION_DAYS, SIZE_CAP_BYTES,
};

#[test]
fn writes_and_rotates_old_files() {
    let dir = tempdir().unwrap();
    let logger = Logger::with_dir(dir.path().to_path_buf());

    let now = Utc::now();
    // Simule l'écriture quotidienne sur RETENTION_DAYS + 5 jours
    // (today, today-1, …, today-11). La rotation utilise `Utc::now()`
    // et doit éliminer toute date strictement antérieure à
    // `today - RETENTION_DAYS`.
    for d in 0..(RETENTION_DAYS + 5) {
        let when = now - Duration::days(d);
        logger.log_at(LogLevel::Info, &format!("event d-{d}"), when);
    }

    let count = std::fs::read_dir(dir.path()).unwrap().count() as i64;
    assert!(
        count <= RETENTION_DAYS + 1,
        "expected at most {} files (RETENTION_DAYS+1), got {}",
        RETENTION_DAYS + 1,
        count,
    );
    // On garde au moins le fichier du jour.
    assert!(count >= 1, "today's log must remain");
}

#[test]
fn writes_level_prefix_and_iso_timestamp() {
    let dir = tempdir().unwrap();
    let logger = Logger::with_dir(dir.path().to_path_buf());

    logger.log(LogLevel::Warn, "hello");
    let when = Utc::now();
    let path = dir
        .path()
        .join(format!("{}.log", when.format("%Y-%m-%d")));
    let content = std::fs::read_to_string(&path).unwrap();
    assert!(content.contains("[WARN]"), "level prefix missing: {content}");
    assert!(content.contains("hello"), "payload missing: {content}");
    // Timestamp ISO 8601 — au minimum la date + le 'T' séparateur.
    assert!(content.contains('T'), "ISO timestamp marker missing: {content}");
}

#[test]
fn levels_map_to_correct_strings() {
    assert_eq!(LogLevel::Info.as_str(), "INFO");
    assert_eq!(LogLevel::Warn.as_str(), "WARN");
    assert_eq!(LogLevel::Error.as_str(), "ERROR");
}

#[test]
fn assert_no_pii_accepts_structural_messages() {
    assert!(assert_no_pii("opened .vviz file"));
    assert!(assert_no_pii("query latency 12ms"));
    assert!(assert_no_pii("VaultViz 0.0.1 started"));
}

#[test]
fn assert_no_pii_blocks_sql_with_literals() {
    assert!(!assert_no_pii(
        "SELECT * FROM 'x.parquet' WHERE id = 42"
    ));
    assert!(!assert_no_pii("user='alice'"));
    // Ligne avec ` WHERE ` (séparateurs espace) + `=` — déclenchée par
    // la 2e branche de l'heuristique.
    assert!(!assert_no_pii(
        "filter applied WHERE id = 42 AND k = 1"
    ));
}

#[test]
fn assert_no_pii_blocks_oversize_messages() {
    let big = "x".repeat(5000);
    assert!(!assert_no_pii(&big));
}

#[test]
fn enforce_size_cap_below_cap_is_noop() {
    let dir = tempdir().unwrap();
    let logger = Logger::with_dir(dir.path().to_path_buf());

    // 3 fichiers de ~200 ko < 50 Mo cap → tous conservés.
    for d in 0..3 {
        let path = dir.path().join(format!("2026-01-0{}.log", d + 1));
        let big: String = (0..200_000).map(|_| 'x').collect();
        std::fs::write(&path, big).unwrap();
    }
    logger.enforce_size_cap();
    let count = std::fs::read_dir(dir.path()).unwrap().count();
    assert_eq!(count, 3, "below {SIZE_CAP_BYTES} cap, all 3 files kept");
}

#[test]
fn ignores_non_log_files_during_rotation() {
    let dir = tempdir().unwrap();
    let logger = Logger::with_dir(dir.path().to_path_buf());

    // Fichier "intrus" sans extension .log et sans nom date.
    std::fs::write(dir.path().join("README.txt"), "hello").unwrap();
    std::fs::write(dir.path().join("not-a-date.log"), "oops").unwrap();

    let now = Utc::now();
    logger.log(LogLevel::Info, "today");
    logger.rotate(now);

    // Les intrus ne doivent pas être touchés.
    assert!(dir.path().join("README.txt").exists());
    assert!(dir.path().join("not-a-date.log").exists());
}

#[test]
fn default_dir_under_data_local_dir() {
    // On ne dépend pas du contenu exact (CI variable), mais on vérifie
    // que la fonction retourne un chemin se terminant par
    // `VaultViz/logs` (PRD §6.4).
    let p = Logger::default_dir();
    let s = p.to_string_lossy();
    assert!(
        s.ends_with("VaultViz/logs") || s.ends_with("VaultViz\\logs"),
        "expected default_dir to end with VaultViz/logs, got {s}"
    );
}
