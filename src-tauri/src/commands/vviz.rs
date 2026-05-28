//! Commande `read_vviz` : lecture brute d'un fichier `.vviz` depuis le système de
//! fichiers, retourne son contenu texte (JSON) ou une erreur typée.
//!
//! Le contrôle d'accès réel passe par la capability Tauri 2 (`capabilities/main.json`,
//! cf. ADR-007). Cette commande s'appuie sur l'OS pour les erreurs `NotFound` et
//! `PermissionDenied` ; la validation JSON Schema arrive en B-061.

use crate::error::VVizError;

/// Implémentation pure (testable hors runtime Tauri).
pub fn read_vviz_impl(path: &str) -> Result<String, VVizError> {
    std::fs::read_to_string(path).map_err(Into::into)
}

/// Commande Tauri exposée à la WebView. Signature `async` pour respecter le
/// modèle d'invocation Tauri 2 (`invoke()` côté JS retourne une Promise).
#[tauri::command]
pub async fn read_vviz(path: String) -> Result<String, VVizError> {
    read_vviz_impl(&path)
}
