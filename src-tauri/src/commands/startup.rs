//! Commande `startup_path` — retourne le chemin du `.vviz` à ouvrir au
//! démarrage, selon la priorité :
//!
//! 1. **`argv[1]`** — passé par Explorer quand l'utilisateur double-clique
//!    un `.vviz` (association d'extension MSI, cf. `tauri.conf.json`).
//! 2. **Variable d'env `VVIZ_DEFAULT`** — pour les déploiements pilotés
//!    par MECM ou les démos avec une cible fixe sur le share.
//! 3. **Exemple embarqué** — `examples/effectifs_2026.vviz` posé dans le
//!    dossier de ressources du MSI (cf. `bundle.resources` dans
//!    `tauri.conf.json`). Évite l'écran blanc à la première ouverture.
//! 4. **Aucun** — renvoie `None`, le front affichera un message d'accueil.
//!
//! Cf. PRD §3.1 (persona Camille — double-clic) et §5.2 (mode déconnecté,
//! `./` admis comme chemin).

use std::path::PathBuf;
use tauri::Manager;

/// Retourne le chemin à charger au démarrage selon la priorité documentée
/// ci-dessus. Le front (`src/main.ts`) appelle cette commande au boot.
#[tauri::command]
pub async fn startup_path(app: tauri::AppHandle) -> Option<String> {
    // 1. argv[1] — double-clic Explorer ou ligne de commande
    let args: Vec<String> = std::env::args().collect();
    if let Some(arg) = args.get(1) {
        let p = PathBuf::from(arg);
        if p.exists() {
            return Some(arg.clone());
        }
    }

    // 2. env VVIZ_DEFAULT — déploiement MECM, démo
    if let Ok(v) = std::env::var("VVIZ_DEFAULT") {
        let p = PathBuf::from(&v);
        if p.exists() {
            return Some(v);
        }
    }

    // 3. exemple embarqué dans le bundle (resources Tauri)
    if let Ok(resource_dir) = app.path().resource_dir() {
        let example = resource_dir.join("examples").join("effectifs_2026.vviz");
        if example.exists() {
            return example.to_str().map(|s| s.to_string());
        }
    }

    None
}
