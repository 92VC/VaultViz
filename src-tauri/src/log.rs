//! B-062 — Logger fichier rotatif local.
//!
//! Politique PRD §6.4 / §8.3 :
//! - Un fichier par jour : `YYYY-MM-DD.log` dans
//!   `%LOCALAPPDATA%\VaultViz\logs\` (Linux/macOS : fallback
//!   `~/.local/share/VaultViz/logs/` via `directories::BaseDirs`).
//! - Rotation : suppression des fichiers > 7 jours à chaque write.
//! - Plafond total : 50 Mo (LRU sur date de modification).
//! - **Aucune PII** : seuls les événements de structure sont journalisés
//!   (chemin .vviz ouvert, code d'erreur, latence d'une requête). Pas de
//!   contenu Parquet, pas de row data, pas de SQL avec valeurs
//!   utilisateur. L'helper [`assert_no_pii`] code cette discipline.
//!
//! Conformité ADR-008 (zéro télémétrie, zéro endpoint sortant) : les
//! logs ne quittent jamais le poste — pas de syslog réseau, pas
//! d'envoi automatique.

use chrono::{DateTime, Duration, NaiveDate, Utc};
use std::fs::{read_dir, remove_file, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::OnceLock;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LogLevel {
    Info,
    Warn,
    Error,
}

/// Logger global, initialisé une fois au démarrage (`init_global`). Permet
/// aux commandes Tauri (`run_query`, `log_event`) de tracer dans le même
/// fichier rotatif que le message « started », sans threader le Logger
/// partout. Thread-safe (le Logger l'est déjà en append).
static GLOBAL: OnceLock<Logger> = OnceLock::new();

/// Initialise le logger global (idempotent). À appeler au `setup` Tauri.
pub fn init_global() {
    let _ = GLOBAL.set(Logger::new_default());
}

/// Journalise via le logger global (no-op si non initialisé — ex. tests).
pub fn log(level: LogLevel, msg: &str) {
    if let Some(l) = GLOBAL.get() {
        l.log(level, msg);
    }
}

/// Tronque un message long (SQL) pour garder des lignes de log lisibles.
pub fn truncate(s: &str, max: usize) -> String {
    if s.chars().count() <= max {
        s.to_string()
    } else {
        let head: String = s.chars().take(max).collect();
        format!("{head}… (+{} car.)", s.chars().count() - max)
    }
}

impl LogLevel {
    pub fn as_str(self) -> &'static str {
        match self {
            LogLevel::Info => "INFO",
            LogLevel::Warn => "WARN",
            LogLevel::Error => "ERROR",
        }
    }
}

/// Nombre de jours conservés avant suppression.
pub const RETENTION_DAYS: i64 = 7;

/// Plafond total du dossier de logs (50 Mo, cf. PRD §6.4).
pub const SIZE_CAP_BYTES: u64 = 50 * 1024 * 1024;

/// Logger fichier rotatif. Thread-safe en append (chaque write ouvre/
/// ferme le fichier en mode `append`, l'OS sérialise les writes courts).
pub struct Logger {
    dir: PathBuf,
}

impl Logger {
    /// Dossier de logs par défaut : `%LOCALAPPDATA%\VaultViz\logs` sur
    /// Windows. En dev Linux, `~/.local/share/VaultViz/logs`.
    pub fn default_dir() -> PathBuf {
        directories::BaseDirs::new()
            .map(|b| b.data_local_dir().join("VaultViz").join("logs"))
            .unwrap_or_else(|| PathBuf::from("./logs"))
    }

    pub fn new_default() -> Self {
        Self::with_dir(Self::default_dir())
    }

    pub fn with_dir(dir: PathBuf) -> Self {
        let _ = std::fs::create_dir_all(&dir);
        Self { dir }
    }

    pub fn dir(&self) -> &PathBuf {
        &self.dir
    }

    /// Journalise `msg` au niveau `level` avec timestamp courant.
    pub fn log(&self, level: LogLevel, msg: &str) {
        self.log_at(level, msg, Utc::now())
    }

    /// Variante avec timestamp injecté — utilisée par les tests de
    /// rotation (on simule plusieurs jours d'historique). Le timestamp
    /// `when` détermine le **nom** du fichier (`YYYY-MM-DD.log`) et le
    /// préfixe ISO-8601 ; en revanche la rotation utilise toujours
    /// `Utc::now()` car « > 7 jours » se mesure par rapport à
    /// aujourd'hui, indépendamment de la date écrite dans le contenu.
    pub fn log_at(&self, level: LogLevel, msg: &str, when: DateTime<Utc>) {
        let path = self
            .dir
            .join(format!("{}.log", when.format("%Y-%m-%d")));
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
            let _ = writeln!(f, "[{}] [{}] {}", when.to_rfc3339(), level.as_str(), msg);
        }
        self.rotate(Utc::now());
        self.enforce_size_cap();
    }

    /// Supprime les fichiers `YYYY-MM-DD.log` dont la date encodée dans
    /// le nom est strictement antérieure à `now - RETENTION_DAYS`.
    pub fn rotate(&self, now: DateTime<Utc>) {
        let cutoff = (now - Duration::days(RETENTION_DAYS)).date_naive();
        let Ok(entries) = read_dir(&self.dir) else { return };
        for entry in entries.flatten() {
            let Ok(name) = entry.file_name().into_string() else { continue };
            let Some(stem) = name.strip_suffix(".log") else { continue };
            let Ok(d) = NaiveDate::parse_from_str(stem, "%Y-%m-%d") else { continue };
            if d < cutoff {
                let _ = remove_file(entry.path());
            }
        }
    }

    /// Garantit que la taille totale du dossier ≤ [`SIZE_CAP_BYTES`].
    /// Supprime les fichiers les plus anciens (mtime) en premier.
    pub fn enforce_size_cap(&self) {
        let Ok(entries) = read_dir(&self.dir) else { return };
        let mut files: Vec<(PathBuf, std::time::SystemTime, u64)> = entries
            .flatten()
            .filter_map(|e| {
                let meta = e.metadata().ok()?;
                let mtime = meta.modified().ok()?;
                Some((e.path(), mtime, meta.len()))
            })
            .collect();
        // Tri ascendant : les plus anciens d'abord, candidats à la suppression.
        files.sort_by_key(|(_, mt, _)| *mt);
        let mut total: u64 = files.iter().map(|(_, _, s)| *s).sum();
        for (path, _, size) in files {
            if total <= SIZE_CAP_BYTES {
                break;
            }
            let _ = remove_file(&path);
            total = total.saturating_sub(size);
        }
    }
}

/// Garde-fou anti-PII : refuse les messages qui ressemblent à du SQL avec
/// littéraux utilisateur ou contiennent une apostrophe (suspecte d'un
/// `WHERE name = 'Alice'`).
///
/// **Limites connues** :
/// - Bloque aussi les chemins Windows avec apostrophe (ex.
///   `C:\Users\D'Angelo\…`). Pour le V0 on ne loggue que des chemins de
///   fichiers `.vviz` du share, sans utilisateur — acceptable. Si un
///   futur appelant veut logger un chemin libre, il devra normaliser
///   en amont (extraire le nom de fichier sans le segment user).
/// - Heuristique, pas de garantie sémantique. Le vrai contrôle reste
///   la discipline d'écriture des messages.
pub fn assert_no_pii(msg: &str) -> bool {
    if msg.contains('\'') {
        return false;
    }
    if msg.contains(" WHERE ") && msg.contains('=') {
        return false;
    }
    if msg.len() > 4096 {
        return false;
    }
    true
}
