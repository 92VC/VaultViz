//! Tests d'intégration de `read_vviz_impl`.
//!
//! L'implémentation pure (suffix `_impl`) est ciblée pour éviter de démarrer
//! un runtime Tauri en test (lent + peu testable hors Windows).

use tempfile::tempdir;
use vaultviz_lib::commands::vviz::read_vviz_impl;
use vaultviz_lib::error::VVizError;

#[test]
fn reads_existing_vviz_file() {
    let dir = tempdir().expect("tempdir");
    let path = dir.path().join("effectifs.vviz");
    std::fs::write(&path, r#"{"vviz":{"version":"1.0","title":"X"}}"#).unwrap();

    let content = read_vviz_impl(path.to_str().unwrap()).expect("read OK");
    assert!(content.contains(r#""version":"1.0""#));
    assert!(content.contains(r#""title":"X""#));
}

#[test]
fn returns_not_found_on_missing_file() {
    let dir = tempdir().expect("tempdir");
    let missing = dir.path().join("does-not-exist.vviz");

    let err = read_vviz_impl(missing.to_str().unwrap()).expect_err("must fail");
    assert!(matches!(err, VVizError::NotFound(_)), "got {:?}", err);
}

#[test]
fn returns_forbidden_on_permission_denied() {
    // Test best-effort : sur certains systèmes une lecture de dossier sans
    // permission de lecture ne lève pas EACCES (selon ACL). On crée donc un
    // fichier puis on retire les permissions de lecture.
    let dir = tempdir().expect("tempdir");
    let path = dir.path().join("noread.vviz");
    std::fs::write(&path, "{}").unwrap();

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut p = std::fs::metadata(&path).unwrap().permissions();
        p.set_mode(0o000);
        std::fs::set_permissions(&path, p).unwrap();

        let err = read_vviz_impl(path.to_str().unwrap()).expect_err("must fail");
        assert!(
            matches!(err, VVizError::Forbidden(_) | VVizError::Io(_)),
            "got {:?}",
            err
        );

        // restaurer pour cleanup tempdir
        let mut p = std::fs::metadata(&path).unwrap().permissions();
        p.set_mode(0o600);
        std::fs::set_permissions(&path, p).unwrap();
    }
}
