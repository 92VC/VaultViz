//! B-120 — Smoke test de la logique de watch debouncée.
//!
//! On teste `start_watch_impl` (la fonction pure sans `tauri::Window`) en :
//!   1. Créant un fichier dans un tmpdir AVANT de démarrer le watch
//!      (pour éviter de capter l'événement `Create`).
//!   2. Démarrant le watch sur ce fichier.
//!   3. Attendant un court settle (100 ms) pour que l'inotify s'arme.
//!   4. Écrivant dans le fichier.
//!   5. Vérifiant via `recv_timeout` qu'exactement 1 événement arrive
//!      avec le bon chemin.
//!   6. Vérifiant qu'un 2e `recv_timeout` court expire → unicité garantie
//!      par le debounce.
//!
//! Pattern « impl pur » : `start_watch_impl` prend un `Fn(String)` en
//! callback au lieu de `tauri::Window`, afin de rester testable sans
//! runtime Tauri (cf. CLAUDE.md §6.1 et `log_rotation.rs`).

use std::sync::mpsc;
use std::time::Duration;
use tempfile::tempdir;
use vaultviz_lib::commands::watch::start_watch_impl;

/// Crée un fichier AVANT de démarrer le watch (évite l'event Create),
/// puis vérifie qu'une écriture produit exactement 1 événement debouncé.
#[test]
fn watch_detects_modification_with_debounce() {
    let dir = tempdir().expect("tempdir");
    let watched_file = dir.path().join("data.parquet");

    // Crée le fichier avant le watch → on ne capte pas le Create.
    std::fs::write(&watched_file, b"init").expect("write init");

    let (tx, rx) = mpsc::channel::<String>();

    let watched_path = watched_file.to_string_lossy().to_string();
    let paths = vec![watched_path.clone()];

    // Démarre le watcher debouncé sur le fichier.
    let _watcher = start_watch_impl(paths, move |changed_path| {
        let _ = tx.send(changed_path);
    })
    .expect("start_watch_impl");

    // Settle : laisse l'inotify s'armer (100 ms largement suffisant).
    std::thread::sleep(Duration::from_millis(100));

    // Écriture atomique simulant un publisher qui remplace le fichier.
    std::fs::write(&watched_file, b"updated content").expect("write update");

    // Reçoit l'événement debouncé (timeout généreux : 5 s pour CI lente).
    let received = rx
        .recv_timeout(Duration::from_secs(5))
        .expect("doit recevoir 1 événement dans 5s");

    // Le chemin reçu doit correspondre au fichier surveillé.
    assert!(
        received.contains("data.parquet"),
        "chemin attendu contient 'data.parquet', reçu : {received}"
    );

    // Vérifie l'unicité : pas de 2e événement (debounce actif).
    // On attend 1.5 s (> debounce 1 s) pour s'assurer qu'aucun event tardif
    // n'arrive après le settle.
    let second = rx.recv_timeout(Duration::from_millis(1500));
    assert!(
        second.is_err(),
        "attendu Timeout pour le 2e recv, reçu : {second:?}"
    );
}

/// Vérifie que le watcher N'émet PAS d'événement pour un fichier
/// non surveillé dans le même dossier.
#[test]
fn watch_ignores_other_files_in_directory() {
    let dir = tempdir().expect("tempdir");
    let watched_file = dir.path().join("watched.parquet");
    let other_file = dir.path().join("ignored.parquet");

    std::fs::write(&watched_file, b"init").expect("write watched");
    std::fs::write(&other_file, b"init").expect("write other");

    let (tx, rx) = mpsc::channel::<String>();

    let watched_path = watched_file.to_string_lossy().to_string();
    let _watcher = start_watch_impl(vec![watched_path], move |p| {
        let _ = tx.send(p);
    })
    .expect("start_watch_impl");

    std::thread::sleep(Duration::from_millis(100));

    // Écrit dans le fichier NON surveillé.
    std::fs::write(&other_file, b"other update").expect("write other update");

    // Aucun événement ne doit arriver dans 1.5 s.
    let got = rx.recv_timeout(Duration::from_millis(1500));
    assert!(
        got.is_err(),
        "ne doit PAS émettre pour un fichier non surveillé, reçu : {got:?}"
    );
}
