//! Commande `read_vviz` : lecture brute d'un fichier `.vviz` depuis le système de
//! fichiers, retourne son contenu texte (JSON) ou une erreur typée.
//!
//! Le contrôle d'accès réel passe par la capability Tauri 2 (`capabilities/main.json`,
//! cf. ADR-007). Cette commande s'appuie sur l'OS pour les erreurs `NotFound` et
//! `PermissionDenied` ; la validation JSON Schema arrive en B-061.

use crate::error::VVizError;

/// Implémentation pure (testable hors runtime Tauri).
///
/// **Limite connue V0** : cette fonction lit directement via `std::fs`. La
/// capability Tauri 2 ne contraint **que** les appels `plugin-fs` côté JS,
/// pas les commandes Rust custom. Conséquence : un appel JS
/// `invoke("read_vviz", { path: "/etc/passwd" })` réussirait. Le PRD §8.1
/// (threat model) suppose un scope FS effectif — la vraie protection viendra
/// en B-061 (validation `.vviz` post-lecture) + extension d'allowlist côté
/// `read_vviz_impl` (à implémenter dans B-061 : pattern UNC + ./ + lecteurs
/// mappés conformes à ADR-007).
pub fn read_vviz_impl(path: &str) -> Result<String, VVizError> {
    // TODO(B-061) : valider `path` contre allowlist (UNC, relatif, drive)
    // avant la lecture. Reporté pour respecter le découpage des stories ;
    // pas de risque d'élévation tant que la CSP bloque les scripts externes
    // et que les seuls appels `invoke` proviennent de notre code.
    std::fs::read_to_string(path).map_err(Into::into)
}

/// Commande Tauri exposée à la WebView. Signature `async` pour respecter le
/// modèle d'invocation Tauri 2 (`invoke()` côté JS retourne une Promise).
#[tauri::command]
pub async fn read_vviz(path: String) -> Result<String, VVizError> {
    read_vviz_impl(&path)
}
