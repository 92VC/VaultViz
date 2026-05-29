//! Commande `startup_path` — retourne le chemin du `.vviz` à ouvrir au
//! démarrage, selon la priorité :
//!
//! 1. **`argv[1]`** — passé par Explorer quand l'utilisateur double-clique
//!    un `.vviz` (association d'extension MSI, cf. `tauri.conf.json`).
//! 2. **Variable d'env `VVIZ_DEFAULT`** — pour les déploiements pilotés
//!    par MECM ou les démos avec une cible fixe sur le share.
//! 3. **Aucun** — renvoie `None` ; le front affiche l'écran d'accueil
//!    (hero + dropzone + récents + bouton « Ouvrir »). On n'ouvre plus
//!    d'exemple embarqué par défaut (décision UX : montrer le sélecteur,
//!    pas un dashboard de démo non sollicité).
//!
//! Cf. PRD §3.1 (persona Camille — double-clic) et §5.2 (mode déconnecté,
//! `./` admis comme chemin).

use std::path::PathBuf;

/// Retourne le chemin à charger au démarrage selon la priorité documentée
/// ci-dessus. Le front (`src/main.ts`) appelle cette commande au boot.
#[tauri::command]
pub async fn startup_path(_app: tauri::AppHandle) -> Option<String> {
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

    // 3. Aucun fichier explicite → écran d'accueil (hero + dropzone +
    //    récents + bouton « Ouvrir »). On n'ouvre PLUS d'exemple embarqué
    //    par défaut : décision UX (l'utilisateur doit arriver sur le
    //    sélecteur, pas sur un dashboard de démo non sollicité). L'écran
    //    d'accueil remplit désormais le rôle « éviter l'écran blanc »
    //    évoqué au PRD §3.1.
    None
}
