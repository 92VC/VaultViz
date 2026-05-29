//! Matérialisation d'une source Parquet embarquée (.vviz AUTOPORTEUR).
//!
//! Un `.vviz` peut porter ses données en `data.sources[].inline` (Parquet
//! base64) → un seul fichier, double-clic, aucune dépendance externe
//! (intention « note Obsidian »). À l'ouverture, le front appelle cette
//! commande : on décode le Parquet et on l'écrit dans le cache local
//! (`%LOCALAPPDATA%\VaultViz\cache`, autorisé PRD §5.2) ; le chemin retourné
//! est ensuite lu par `read_parquet` comme une source classique.

use base64::Engine;

use crate::error::VVizError;

/// Vrai si `name` est un identifiant SQL sûr (donc un nom de fichier sûr,
/// sans séparateur de chemin) — même contrainte que le schéma `.vviz`.
fn safe_name(name: &str) -> bool {
    let mut chars = name.chars();
    match chars.next() {
        Some(c) if c.is_ascii_alphabetic() || c == '_' => {}
        _ => return false,
    }
    name.len() <= 64 && name.chars().all(|c| c.is_ascii_alphanumeric() || c == '_')
}

/// Dossier de cache local : `%LOCALAPPDATA%\VaultViz\cache` (Windows),
/// `~/.local/share/VaultViz/cache` (Linux dev).
fn cache_dir() -> std::path::PathBuf {
    directories::BaseDirs::new()
        .map(|b| b.data_local_dir().join("VaultViz").join("cache"))
        .unwrap_or_else(|| std::path::PathBuf::from("./cache"))
}

/// Décode le Parquet base64 d'une source embarquée, l'écrit dans le cache
/// local et renvoie son chemin (séparateurs `/` pour DuckDB).
#[tauri::command]
pub async fn materialize_source(name: String, b64: String) -> Result<String, VVizError> {
    if !safe_name(&name) {
        return Err(VVizError::Invalid(format!(
            "nom de source invalide : « {name} »"
        )));
    }
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(b64.trim().as_bytes())
        .map_err(|e| VVizError::Invalid(format!("base64 invalide pour « {name} » : {e}")))?;

    let dir = cache_dir();
    std::fs::create_dir_all(&dir).map_err(|e| VVizError::Io(format!("création du cache : {e}")))?;
    let path = dir.join(format!("{name}.parquet"));
    std::fs::write(&path, &bytes)
        .map_err(|e| VVizError::Io(format!("écriture cache « {name} » : {e}")))?;

    Ok(path.to_string_lossy().replace('\\', "/"))
}
