//! B-120 — Watcher FS debouncé (notify-debouncer-full).
//!
//! # Architecture testable
//!
//! La logique de watch est dans `start_watch_impl<F>` qui accepte un
//! callback `F: Fn(String) + Send + 'static`. La commande Tauri
//! `start_watch` n'est qu'un **mince adaptateur** qui câble
//! `window.emit("vv://data-changed", path)` comme callback.
//!
//! # Choix du moteur OS
//!
//! `notify_debouncer_full::new_debouncer` utilise sous le capot
//! `RecommendedWatcher`, qui mappe automatiquement sur :
//!   - **Linux**  → inotify  (kernel events, zéro polling)
//!   - **Windows** → ReadDirectoryChangesW  (RDCW, kernel events)
//!   - **macOS**  → FSEvents  (hors scope ADR-010, mais neutre ici)
//! Aucun mode polling agressif n'est activé (pas de `PollWatcher`).
//! Conforme à l'invariant I-2 (local-first, aucun appel sortant).
//!
//! # Debounce
//!
//! Timeout = 1 s (critère B-120 §2). Plusieurs écritures rapprochées
//! (écriture atomique = rename-replace du publisher) → le debouncer
//! fusionne tous les events et n'en émet qu'un seul après 1 s de calme.
//!
//! # Stratégie de watch
//!
//! On surveille le **dossier parent** en mode `NonRecursive`, puis on
//! filtre sur le set de paths surveillés. Raison : l'écriture atomique
//! (rename-replace) tue l'inode du fichier original — un watch posé
//! directement sur le fichier deviendrait aveugle après le replace.
//! Surveiller le parent + filtrer satisfait aussi le critère 3
//! (émission ciblée, pas tout le dossier).

use std::{
    collections::HashSet,
    path::{Path, PathBuf},
    sync::{Arc, Mutex},
    time::Duration,
};

use notify_debouncer_full::{
    new_debouncer,
    notify::{RecursiveMode, RecommendedWatcher},
    Debouncer, RecommendedCache,
};

use crate::error::VVizError;

// ── Type alias pour le debouncer retourné par `new_debouncer` ──────────────
// `Debouncer<RecommendedWatcher, RecommendedCache>` est le type concret
// produit par `new_debouncer` en 0.4.0. On l'alias pour les états Tauri.
pub type VVizDebouncer = Debouncer<RecommendedWatcher, RecommendedCache>;

// ── État managé Tauri ────────────────────────────────────────────────────────
/// Enveloppe Mutex autour d'un `Option<VVizDebouncer>`.
///
/// `start_watch` remplace l'éventuel watcher précédent (drop propre),
/// `stop_watch` met `None` (drop propre aussi).
/// Tauri enregistre cet état via `.manage(watcher_state)` et gère
/// lui-même le partage par `Arc` interne — on ne l'arc-wrappe pas ici.
pub struct WatcherState(pub Mutex<Option<VVizDebouncer>>);

impl WatcherState {
    pub fn new() -> Self {
        WatcherState(Mutex::new(None))
    }
}

// ── Fonction pure testable ────────────────────────────────────────────────────
/// Démarre un watcher debouncé (1 s) sur les `paths` fournis.
///
/// `on_change` est appelé avec le chemin (String) dès qu'un des paths
/// surveillés est modifié. Un seul appel par burst d'écritures (debounce).
///
/// Renvoie le `VVizDebouncer` que l'appelant doit garder en vie aussi
/// longtemps que le watch est actif (drop = arrêt du watcher).
///
/// **Zéro PII loggée** : on ne trace pas les paths en clair.
pub fn start_watch_impl<F>(paths: Vec<String>, on_change: F) -> Result<VVizDebouncer, VVizError>
where
    F: Fn(String) + Send + 'static,
{
    // Normalise les paths en PathBuf absolus et collecte les dossiers parents.
    let path_bufs: Vec<PathBuf> = paths.iter().map(PathBuf::from).collect();

    // Set des paths canoniques surveillés pour le filtre post-debounce.
    // On conserve aussi bien la forme fournie que la forme canonique (si
    // disponible) pour absorber les petites différences de représentation.
    let watched: Arc<HashSet<PathBuf>> = Arc::new(
        path_bufs
            .iter()
            .flat_map(|p| {
                let mut set = vec![p.clone()];
                if let Ok(canon) = p.canonicalize() {
                    set.push(canon);
                }
                set
            })
            .collect(),
    );

    // Dossiers parents à surveiller (dédoublonnés).
    let parent_dirs: HashSet<PathBuf> = path_bufs
        .iter()
        .filter_map(|p| p.parent().map(Path::to_path_buf))
        .collect();

    if parent_dirs.is_empty() {
        return Err(VVizError::Invalid(
            "Aucun dossier parent résolvable pour les paths fournis".into(),
        ));
    }

    // Callback debounce → filtre sur les paths surveillés → appel `on_change`.
    let watched_clone = Arc::clone(&watched);
    let mut debouncer = new_debouncer(
        Duration::from_secs(1),
        None, // tick_rate automatique (1/4 du timeout = 250 ms)
        move |result: notify_debouncer_full::DebounceEventResult| {
            let events = match result {
                Ok(evts) => evts,
                Err(_errors) => {
                    // Erreurs watcher silencieuses (ex. fichier supprimé
                    // entre deux events). Pas de log PII.
                    return;
                }
            };

            // Collecte les paths touchés qui appartiennent à la liste surveillée.
            // Un batch debouncé peut contenir plusieurs events sur le même path
            // (ex. modify + close_write sur Linux inotify) → dédup via HashSet.
            let mut to_emit: HashSet<String> = HashSet::new();
            for event in &events {
                for event_path in &event.event.paths {
                    // Comparaison directe + essai de canonicalisation.
                    let matches = watched_clone.contains(event_path)
                        || event_path
                            .canonicalize()
                            .map(|c| watched_clone.contains(&c))
                            .unwrap_or(false);
                    if matches {
                        to_emit.insert(event_path.to_string_lossy().to_string());
                    }
                }
            }

            for path_str in to_emit {
                on_change(path_str);
            }
        },
    )
    .map_err(|e| VVizError::Io(format!("Impossible de créer le watcher : {e}")))?;

    // Pose le watch sur chaque dossier parent (NonRecursive).
    for dir in &parent_dirs {
        debouncer
            .watch(dir.as_path(), RecursiveMode::NonRecursive)
            .map_err(|e| VVizError::Io(format!("watch() échoue sur dossier parent : {e}")))?;
    }

    Ok(debouncer)
}

// ── Commandes Tauri (mince adaptateur) ──────────────────────────────────────

/// Démarre le watcher FS sur les `paths` donnés.
///
/// À chaque modification d'un de ces paths, émet l'événement
/// `vv://data-changed` vers le front (payload : le chemin modifié).
///
/// Un appel successif à `start_watch` **remplace** le watcher précédent
/// (drop propre de l'ancien).
#[tauri::command]
pub fn start_watch(
    paths: Vec<String>,
    window: tauri::Window,
    state: tauri::State<WatcherState>,
) -> Result<(), VVizError> {
    use tauri::Emitter; // Trait Tauri 2 requis pour `.emit()`

    let debouncer = start_watch_impl(paths, move |changed_path| {
        // On ignore le Result : si la fenêtre est détruite, c'est normal.
        let _ = window.emit("vv://data-changed", changed_path);
    })?;

    // Remplace l'éventuel watcher précédent (drop propre).
    let mut guard = state
        .0
        .lock()
        .map_err(|_| VVizError::Io("WatcherState mutex empoisonné".into()))?;
    *guard = Some(debouncer);
    Ok(())
}

/// Arrête le watcher FS en cours (si actif).
///
/// Drop le `VVizDebouncer` → notify arrête le thread interne proprement.
#[tauri::command]
pub fn stop_watch(state: tauri::State<WatcherState>) -> Result<(), VVizError> {
    let mut guard = state
        .0
        .lock()
        .map_err(|_| VVizError::Io("WatcherState mutex empoisonné".into()))?;
    *guard = None; // drop du Debouncer → arrêt propre
    Ok(())
}
