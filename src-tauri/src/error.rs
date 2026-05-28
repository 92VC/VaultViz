//! Types d'erreur VaultViz, sérialisables vers la WebView via Tauri IPC.
//!
//! Tracé dans ADR-008 : aucune trace technique exposée à l'utilisateur final ;
//! seul le message lisible francisé est sérialisé.

use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error, Serialize)]
#[serde(tag = "kind", content = "message")]
pub enum VVizError {
    #[error("Fichier introuvable : {0}")]
    NotFound(String),

    #[error("Accès refusé par la politique de capability FS : {0}")]
    Forbidden(String),

    #[error("Erreur d'entrée/sortie : {0}")]
    Io(String),

    #[error("Format invalide : {0}")]
    Invalid(String),
}

impl From<std::io::Error> for VVizError {
    fn from(e: std::io::Error) -> Self {
        match e.kind() {
            std::io::ErrorKind::NotFound => VVizError::NotFound(e.to_string()),
            std::io::ErrorKind::PermissionDenied => VVizError::Forbidden(e.to_string()),
            _ => VVizError::Io(e.to_string()),
        }
    }
}
