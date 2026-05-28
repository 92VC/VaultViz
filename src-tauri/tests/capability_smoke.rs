//! Sanity check : la capability `main.json` est syntaxiquement valide et
//! les permissions FS attendues sont déclarées.
//!
//! Test de scope réel (refus chemin hors scope) déféré à B-012 (commande
//! `read_vviz` réelle invocable depuis test runtime Tauri).

use std::fs;

#[test]
fn capability_main_is_valid_json() {
    let content = fs::read_to_string("capabilities/main.json").expect("capability file exists");
    let v: serde_json::Value = serde_json::from_str(&content).expect("valid JSON");

    assert_eq!(v["identifier"], "main-capability");
    assert_eq!(v["windows"], serde_json::json!(["main"]));

    let perms = v["permissions"].as_array().expect("permissions is array");
    assert!(!perms.is_empty(), "permissions must not be empty");

    // Les permissions fs:allow-read-* doivent être déclarées
    let needed = ["fs:allow-read-text-file", "fs:allow-read-file", "fs:allow-exists"];
    for needle in &needed {
        let found = perms.iter().any(|p| {
            p.as_str() == Some(needle) || p["identifier"].as_str() == Some(needle)
        });
        assert!(found, "permission {} should be declared", needle);
    }
}

#[test]
fn capability_references_adr_007_in_description() {
    let content = fs::read_to_string("capabilities/main.json").expect("capability file exists");
    assert!(content.contains("ADR-007"), "description must reference ADR-007 (UNC paths)");
}
