# VaultViz — Backlog d'exécution

| Métadonnée | Valeur |
|---|---|
| Version backlog | 1.0 |
| Date | 2026-05-28 |
| Document source | `PRD.md` v1.0 |
| Mode d'exécution | Vibe coding — itérations atomiques, une session par story |

---

## 0. Règles d'utilisation

### 0.1 États d'une story

| Marqueur | Signification |
|---|---|
| `[ ]` | À faire — pré-conditions OK, peut être démarrée |
| `[~]` | En cours — session active sur cette story |
| `[x]` | Terminée — critères d'acceptation tous validés |
| `[!]` | Bloquée — pré-condition externe non levée (cf. champ « Blocage ») |

### 0.2 Discipline d'exécution

1. **Une story = une session**. Si la session déborde, marquer la story `[~]` et la découper en sous-stories.
2. **Mettre à jour le marqueur dès le début et la fin** d'une story, pour qu'un lecteur tiers connaisse l'état réel.
3. **Mettre à jour le tableau de bord §0.3** après chaque transition d'état.
4. **Ne pas démarrer une story dont les dépendances ne sont pas `[x]`**, sauf si explicitement spécifié comme parallélisable.
5. **Critères d'acceptation = définition de Done**. Tant qu'un seul critère n'est pas vert, la story reste `[~]`.
6. **Si une décision PRD doit être tranchée en cours de story**, créer une note dans le champ « Notes » et escalader avant de coder du choix par défaut.

### 0.3 Tableau de bord

| Phase | Stories | À faire `[ ]` | En cours `[~]` | Terminé `[x]` | Bloqué `[!]` |
|---|---|---|---|---|---|
| Pré-V0 | 3 | 0 | 0 | 3 | 0 |
| V0 — I0 Squelette | 3 | 0 | 0 | 3 | 0 |
| V0 — I1 DuckDB | 4 | 0 | 0 | 4 | 0 |
| V0 — I2 Mosaic | 4 | 0 | 0 | 4 | 0 |
| V0 — I3 Interactivité | 2 | 0 | 0 | 2 | 0 |
| V0 — I4 Drill-down | 1 | 0 | 0 | 1 | 0 |
| V0 — I5 Erreurs | 3 | 0 | 0 | 3 | 0 |
| V0 — I6 MSI | 3 | 0 | 0 | 3 | 0 |
| V0 — I7 Go/No-Go | 3 | 0 | 0 | 3 | 0 |
| V1 — V1-1 MapLibre | 2 | 0 | 0 | 2 | 0 |
| V1 — V1-2 TopoJSON IGN | 2 | 0 | 1 | 1 | 0 |
| V1 — V1-3 Watcher | 2 | 0 | 0 | 2 | 0 |
| V1 — V1-4 Exports | 3 | 0 | 0 | 3 | 0 |
| V1 — V1-5 Design SP0 (refondation) | 1 | 0 | 0 | 1 | 0 |
| V1 — V1-5 Design SP1–SP4 (épopées) | 4 | 0 | 0 | 4 | 0 |
| V1 — V1-E Capacités moteur (viz-engine) | 2 | 0 | 0 | 2 | 0 |
| V1 — V1-7 DLI/Power BI (1er test prod) | 6 | 3 | 0 | 3 | 0 |
| V1 — V1-6 Signature DSI | 1 | 1 | 0 | 0 | 0 |
| V1 — V1-8 Doc | 3 | 0 | 0 | 3 | 0 |
| V1 — V1-9 Pilote MECM | 2 | 2 | 0 | 0 | 0 |
| V1 — V1-10 Go/No-Go | 1 | 1 | 0 | 0 | 0 |
| **Total** | **55** | **7** | **1** | **47** | **0** |

### 0.4 Conventions champs

Chaque story porte les champs :

- **ID** : `B-XXX` (stable sur toute la durée du projet)
- **Itération** : référence au cycle PRD (I0, V1-3, etc.)
- **Livrable** : artefact concret produit (fichier, fonction, doc, démo)
- **Critères d'acceptation** : checklist observable ; chaque ligne testable
- **Dépendances** : liste d'IDs requis
- **PRD** : sections concernées du PRD à relire avant de coder
- **Complexité** : S (≤ 1 h de focus humain équivalent) / M (≤ une demi-journée) / L (à éclater si possible)
- **Notes** : pièges, alternatives, décisions à confirmer
- **Blocage** : présent uniquement si état `[!]`

---

## 1. Pré-V0 — Préparation du repo

### B-000 — [x] Initialiser le repo Git + structure de dossiers

- **Itération** : Pré-V0
- **Livrable** : repo Git initial sur GitHub privé organisation CPAM avec arborescence §B du PRD
- **Critères d'acceptation** :
  - [ ] `git init` exécuté ; `main` est la branche par défaut
  - [ ] `.gitignore` couvre : `target/`, `node_modules/`, `dist/`, `*.msi`, `*.exe`, `.env*`
  - [ ] Arborescence créée : `src-tauri/`, `src/`, `schema/`, `examples/`, `docs/adr/`, `.github/workflows/`
  - [ ] `README.md` minimal : 1 paragraphe + lien vers PRD
  - [ ] Pas de fichier généré commité
- **Dépendances** : aucune
- **PRD** : §18 Annexe B
- **Complexité** : S
- **Notes** : ne pas commiter encore le code applicatif, juste la structure.

### B-001 — [x] Versionner PRD + BACKLOG dans le repo de code

- **Itération** : Pré-V0
- **Livrable** : `PRD.md` et `BACKLOG.md` accessibles dans le repo de code, pas dans un dépôt séparé
- **Critères d'acceptation** :
  - [ ] Les deux fichiers sont à la racine du repo
  - [ ] Un lien depuis `README.md` les référence
  - [ ] L'historique Git montre leur dépôt initial dans un commit dédié
- **Dépendances** : B-000
- **PRD** : §0
- **Complexité** : S
- **Notes** : le PRD vit avec le code, pas séparément (philosophie BI-as-code).

### B-002 — [x] Convertir chaque ADR du PRD en fichier `docs/adr/`

- **Itération** : Pré-V0
- **Livrable** : 11 fichiers `docs/adr/ADR-NNN-titre.md`, un par ADR
- **Critères d'acceptation** :
  - [ ] 11 fichiers présents (ADR-001 à ADR-011)
  - [ ] Chaque fichier suit le format Michael Nygard : Context / Decision / Consequences
  - [ ] Le contenu est extrait du PRD §6.3 + §15
  - [ ] Le PRD §15 est mis à jour pour ajouter une colonne « lien » vers chaque fichier ADR
- **Dépendances** : B-000, B-001
- **PRD** : §6.3, §15
- **Complexité** : M
- **Notes** : extraction parallélisable mais séquentielle si une seule session.

---

## 2. V0 — Prototype démontrable

### 2.1 I0 — Squelette Tauri

### B-010 — [x] Bootstrap projet Tauri 2.x + Vite + TypeScript

- **Itération** : I0
- **Livrable** : projet Tauri 2.x qui compile et ouvre une fenêtre vide
- **Critères d'acceptation** :
  - [ ] `cargo tauri dev` lance la fenêtre sur Windows 11
  - [ ] WebView2 charge un `index.html` vide stylé minimalement
  - [ ] `Cargo.lock` et `package-lock.json` versionnés
  - [ ] Versions Tauri / DuckDB / Mosaic figées dans les lockfiles
  - [ ] Build release produit un exécutable sous `src-tauri/target/release/`
- **Dépendances** : B-000, B-002
- **PRD** : §6.2 (Tauri 2.x), §14.1 I0
- **Complexité** : M
- **Notes** : choisir front Vite + TS (pas de framework lourd avant V1) ; éviter React/Vue tant que pas nécessaire.

### B-011 — [x] Définir `capabilities/main.json` avec scope FS UNC

- **Itération** : I0
- **Livrable** : ACL Tauri autorisant la lecture sur un chemin UNC paramétrable
- **Critères d'acceptation** :
  - [ ] `capabilities/main.json` déclare `fs:allow-read-text-file`, `fs:allow-read-binary-file`
  - [ ] Scope glob inclut `//<host>/<share>/**` (à paramétrer via env ou config)
  - [ ] Scope glob inclut aussi `./**` (mode déconnecté §5.2) et `[A-Z]:/**` (lecteur mappé)
  - [ ] Un commentaire dans le fichier renvoie vers ADR-007
  - [ ] Tentative de lecture d'un chemin hors scope retourne une erreur explicite
- **Dépendances** : B-010
- **PRD** : §6.3 ADR-007, §5.2
- **Complexité** : S
- **Notes** : H1 du PRD à valider — c'est le **premier** vrai test d'architecture, à ne pas reporter.

### B-012 — [x] Lecture brute d'un `.vviz` et affichage JSON

- **Itération** : I0
- **Livrable** : commande Tauri `read_vviz(path)` qui retourne le contenu, affiché en pretty-print dans la WebView
- **Critères d'acceptation** :
  - [ ] Commande Rust `#[tauri::command] read_vviz` retourne `Result<String, String>`
  - [ ] La WebView appelle la commande au démarrage avec un chemin par défaut (env `VVIZ_DEFAULT`)
  - [ ] Le JSON s'affiche en pretty-print HTML (pas de framework de viz à ce stade)
  - [ ] Erreur de lecture (fichier absent, hors scope) affichée proprement
  - [ ] Test manuel : ouverture d'un `.vviz` sur un share UNC réel CPAM (test H1)
- **Dépendances** : B-010, B-011
- **PRD** : §1.4 H1, §5.3
- **Complexité** : M
- **Notes** : c'est le test de validation de l'hypothèse H1 — si UNC ne passe pas, escalader immédiatement (R-2).

### 2.2 I1 — DuckDB natif intégré

### B-020 — [x] Intégrer `duckdb-rs` en feature `bundled`

- **Itération** : I1
- **Livrable** : DuckDB compilé statiquement dans le binaire Tauri
- **Critères d'acceptation** :
  - [ ] `duckdb` ajouté à `Cargo.toml` avec `features = ["bundled"]`
  - [ ] `cargo build --release` compile sans dépendance système externe
  - [ ] Test Rust : ouverture d'une connexion in-memory, `SELECT 42` retourne 42
  - [ ] Taille de l'exécutable mesurée et commentée dans un fichier `BENCH.md`
- **Dépendances** : B-010
- **PRD** : §6.2, §6.3 ADR-001
- **Complexité** : M
- **Notes** : le bundled est gros (~30 Mo) — surveiller la cible §9.1 « MSI < 30 Mo ». Si dépassement, étudier feature flags DuckDB.

### B-021 — [x] Wrapper Rust `duck.rs` : exécuter SQL Parquet

- **Itération** : I1
- **Livrable** : module `src-tauri/src/duck.rs` exposant `query_parquet(sql, paths) -> Arrow IPC`
- **Critères d'acceptation** :
  - [ ] Fonction `query_parquet(sql: &str) -> Result<Vec<u8>, DuckError>` retourne un buffer Arrow IPC
  - [ ] Test : `SELECT COUNT(*) FROM 'examples/sample.parquet'` retourne un résultat valide
  - [ ] Le module gère les erreurs Parquet corrompu sans crash
  - [ ] La connexion DuckDB est protégée par `Mutex<Connection>` dans un état Tauri
- **Dépendances** : B-020
- **PRD** : §6.1, ADR-001, ADR-003
- **Complexité** : M
- **Notes** : préférer Arrow IPC (zero-copy) à JSON pour le retour vers JS.

### B-022 — [x] Canal Arrow IPC Rust → WebView2 via `ipc.rs`

- **Itération** : I1
- **Livrable** : commande Tauri retournant Arrow IPC + désérialisation côté JS avec `apache-arrow`
- **Critères d'acceptation** :
  - [ ] Commande `#[tauri::command] run_query(sql: String) -> Result<Vec<u8>, String>`
  - [ ] Côté JS : `Table.from(new Uint8Array(buffer))` reconstitue la table Arrow
  - [ ] Démo : un tableau HTML simple affiche les N premières lignes d'un Parquet de test
  - [ ] Pas de conversion JSON intermédiaire (vérifier via profilage)
- **Dépendances** : B-021
- **PRD** : §6.1 stack diagram, ADR-003
- **Complexité** : M

### B-023 — [x] Benchmark Parquet 50 Mo via UNC

- **Itération** : I1
- **Livrable** : `BENCH.md` documentant temps d'ouverture, RAM, temps de query sur Parquet 50 Mo réel
- **Critères d'acceptation** :
  - [ ] Mesure : temps d'ouverture spec → premier `SELECT COUNT(*)` < 3 s
  - [ ] Mesure : RAM stable < 400 Mo sur 50 Mo Parquet
  - [ ] Mesures effectuées sur un share SMB CPAM (pas en local poste)
  - [ ] Comparaison documentée : même requête en local SSD vs UNC SMB
- **Dépendances** : B-022
- **PRD** : §9.1, §1.4 H2 (partiel)
- **Complexité** : M
- **Notes** : prendre dataset CPAM représentatif si possible. Sinon générer un Parquet synthétique 50 Mo.

### 2.3 I2 — Mosaic + vgplot

### B-030 — [x] Setup Mosaic + vgplot côté front

- **Itération** : I2
- **Livrable** : `package.json` avec dépendances Mosaic verrouillées, import démo qui rend un plot statique
- **Critères d'acceptation** :
  - [ ] `@uwdata/vgplot`, `@uwdata/mosaic-core`, `@uwdata/mosaic-sql` ajoutés
  - [ ] Versions verrouillées dans `package-lock.json` (cf. mitigation R-8)
  - [ ] Un plot statique vgplot (données inline) s'affiche dans la WebView
  - [ ] Notes dans `docs/adr/ADR-002.md` : versions Mosaic retenues + date du choix
- **Dépendances** : B-010
- **PRD** : ADR-002, R-8
- **Complexité** : M
- **Notes** : vérifier état Mosaic le jour J — si encore non production-ready avec API mouvante, déclencher R-8 et discuter repli Vega-Lite avant d'investir dans B-031.

### B-031 — [x] Connecter Mosaic à DuckDB natif via un connector custom

- **Itération** : I2
- **Livrable** : `src/viz-engine/duck-connector.ts` qui implémente l'interface Mosaic Connector et appelle Rust via Tauri commands
- **Critères d'acceptation** :
  - [ ] Connector expose `query(sql) -> Promise<ArrowTable>`
  - [ ] Sous le capot, appelle `run_query` (B-022) et retourne un Arrow Table
  - [ ] Mosaic coordinator utilise ce connector pour toutes ses queries
  - [ ] Démo : un `vg.plot()` simple lit un Parquet via DuckDB natif et s'affiche
- **Dépendances** : B-022, B-030
- **PRD** : ADR-002, §6.1
- **Complexité** : L
- **Notes** : Mosaic fournit un `wasmConnector` et un `socketConnector` ; on écrit notre `nativeConnector`. Si trop coûteux : option de fallback DuckDB-WASM avec données pré-extraites depuis le natif (mais c'est suboptimal).

### B-032 — [x] Carte choroplèthe France figée (TopoJSON embarqué)

- **Itération** : I2
- **Livrable** : spec vgplot rendant une carte France colorée par une métrique
- **Critères d'acceptation** :
  - [ ] TopoJSON départements embarqué dans `src/assets/` (version temporaire)
  - [ ] Spec vgplot affiche les 101 départements colorés par une valeur depuis le Parquet
  - [ ] Légende de couleur visible
  - [ ] Tooltip au survol affiche nom département + valeur
- **Dépendances** : B-031
- **PRD** : UC-1 (statique), §6.3 ADR-009
- **Complexité** : M
- **Notes** : pas encore MapLibre (V1) — rendu Mosaic geo natif si possible, sinon SVG D3 minimal.

### B-033 — [x] Figer le format `.vviz` (envelope + spec vgplot)

- **Itération** : I2
- **Livrable** : `schema/vviz-v1.json` (JSON Schema Draft 7) + un exemple `examples/effectifs_2026.vviz` qui se rend
- **Critères d'acceptation** :
  - [ ] `vviz-v1.json` validé syntaxiquement (ajv ou équivalent)
  - [ ] L'exemple `effectifs_2026.vviz` valide contre le schéma
  - [ ] L'application charge l'exemple et rend la carte (B-032)
  - [ ] Décision tracée dans `docs/adr/ADR-002.md` : format spec = JSON vgplot pur OU DSL prétraité (cf. §16 Q7)
- **Dépendances** : B-030, B-032
- **PRD** : §5.3, §18 Annexe C, §16 Q7
- **Complexité** : M
- **Notes** : c'est ici qu'on tranche §16 Q7. Documenter le choix dans l'ADR.

### 2.4 I3 — Interactivité

### B-040 — [x] Sélection Mosaic (point select) sur la carte

- **Itération** : I3
- **Livrable** : clic département → param `dept_select` mis à jour, query DuckDB push-down déclenchée
- **Critères d'acceptation** :
  - [ ] `vg.Selection` créée avec field `code_dept`
  - [ ] Au clic, la sélection est mise à jour et le filtre push-down est observable dans les logs SQL DuckDB
  - [ ] Le département sélectionné est visuellement distingué (stroke épaissi)
  - [ ] Second clic = désélection
- **Dépendances** : B-032, B-033
- **PRD** : H4, §4.1 V0
- **Complexité** : M

### B-041 — [x] Cross-filter 2 vues : carte + barres détail

- **Itération** : I3
- **Livrable** : dashboard 2 vues coordonnées via une Mosaic Selection partagée
- **Critères d'acceptation** :
  - [ ] La spec `.vviz` déclare 2 plots dans un container hconcat (ou équivalent vgplot)
  - [ ] Sélection sur carte filtre les barres en sub-seconde
  - [ ] Push-down DuckDB préservé (calcul poussé en SQL, pas en JS) ; coordination cross-vues dans `viz-engine/` (cf. ADR-002 amendé — moteur hybride)
  - [ ] UC-3 du PRD démontré
- **Dépendances** : B-040
- **PRD** : UC-3, H4
- **Complexité** : M

### 2.5 I4 — Drill-down

### B-050 — [x] Drill-down département → tableau filtré (UC-1 complet)

- **Itération** : I4
- **Livrable** : démo bout-en-bout UC-1 : ouverture `.vviz`, carte, clic Hauts-de-Seine, tableau détaillé affiché
- **Critères d'acceptation** :
  - [ ] Tableau HTML virtualisé (≥ 1000 lignes sans lag)
  - [ ] Filtre lié à la sélection carte (Mosaic Selection)
  - [ ] Tri colonnes
  - [ ] Affichage du nombre de lignes après filtre
  - [ ] Test sur Parquet 50 Mo et 300 Mo (mesurer < 1 s en V1, < 3 s acceptable V0)
- **Dépendances** : B-041, B-023
- **PRD** : UC-1, §9.1
- **Complexité** : L
- **Notes** : si Mosaic table component limité, écrire un wrapper léger basé sur Arrow.js + virtualisation manuelle.

### 2.6 I5 — Gestion d'erreurs & logging

### B-060 — [x] Gestion fichier `.vviz` manquant ou inaccessible

- **Itération** : I5
- **Livrable** : UX d'erreur claire si le `.vviz` n'existe pas ou si le scope FS refuse
- **Critères d'acceptation** :
  - [ ] Message UI : « Fichier introuvable », chemin attendu affiché, bouton « Réessayer »
  - [ ] Distinction : fichier absent / accès refusé par scope / fichier corrompu
  - [ ] Pas de stack trace exposée à l'utilisateur
- **Dépendances** : B-012
- **PRD** : UC-6, §5.2
- **Complexité** : S

### B-061 — [x] Gestion spec `.vviz` invalide (échec validation JSON Schema)

- **Itération** : I5
- **Livrable** : validation contre `vviz-v1.json` au chargement, message d'erreur exploitable
- **Critères d'acceptation** :
  - [ ] Bibliothèque `ajv` (ou équivalent) intégrée côté JS
  - [ ] Erreur signale le `$.path` exact (ex. `spec.plots[0].marks[1].type`)
  - [ ] Lien vers la doc auteur (V1-8 / B-380)
  - [ ] Test : `.vviz` avec champ manquant → message lisible
- **Dépendances** : B-033, B-060
- **PRD** : UC-6
- **Complexité** : M

### B-062 — [x] Logging local fichier rotatif

- **Itération** : I5
- **Livrable** : module Rust `log.rs` qui écrit dans `%LOCALAPPDATA%\VaultViz\logs\YYYY-MM-DD.log`
- **Critères d'acceptation** :
  - [ ] Niveaux INFO / WARN / ERROR
  - [ ] Rotation quotidienne, 7 jours, plafond 50 Mo
  - [ ] Aucune PII journalisée (vérifier explicitement : pas de contenu Parquet, pas de chemins utilisateur sensibles autres que le `.vviz` ouvert)
  - [ ] Test : 7+ jours d'activité simulée → bonne rotation
- **Dépendances** : B-010
- **PRD** : §8.3
- **Complexité** : M

### 2.7 I6 — MSI signable

### B-070 — [x] Configuration `tauri-bundler` cible MSI

- **Itération** : I6
- **Livrable** : `tauri.conf.json` produit un MSI propre via `cargo tauri build`
- **Critères d'acceptation** :
  - [ ] `"targets": ["msi"]` dans `tauri.conf.json`
  - [ ] MSI généré sans erreur sur Windows 11
  - [ ] Métadonnées MSI correctes : éditeur (CPAM 92), version, GUID stable
  - [ ] Association `.vviz` créée à l'installation
  - [ ] Désinstallation propre via Apps & Features
- **Dépendances** : B-050, B-060, B-061, B-062
- **PRD** : ADR-006, §10.3
- **Complexité** : M

### B-071 — [x] Workflow GitHub Actions build MSI signable

- **Itération** : I6
- **Livrable** : `.github/workflows/build.yml` produisant un MSI à chaque tag `v*`
- **Critères d'acceptation** :
  - [ ] Job tourne sur `windows-latest`
  - [ ] Cache Cargo + npm fonctionnel
  - [ ] Artefact MSI téléchargeable depuis la release GitHub privée
  - [ ] SBOM généré (`cargo-audit`, `npm audit`) et attaché à la release
  - [ ] Pas de step de signature (hors scope produit — ADR-005)
- **Dépendances** : B-070
- **PRD** : §10.1, ADR-005
- **Complexité** : M

### B-072 — [x] Livrer un MSI signable + dossier handoff DSI

- **Itération** : I6
- **Livrable** : MSI signable produit par la CI + dossier de handoff DSI
- **Critères d'acceptation** :
  - [x] MSI signable produit par la CI (tag GHA `v0.0.1-rc1`)
  - [x] Dossier handoff DSI prêt (`docs/handoff/dsi-signing-package.md`)
- **Dépendances** : B-071
- **PRD** : H3, R-1, ADR-005
- **Complexité** : S
- **Notes** : la signature de code et le test AppLocker relèvent de la DSI (**hors scope produit — ADR-005**). Le livrable produit s'arrête au MSI signable + handoff ; ce n'est pas un blocage (cf. `feedback_no_hedging_dsi`).

### 2.8 I7 — Go/No-Go V0

### B-080 — [x] Benchmark Parquet 300 Mo + RAM

- **Itération** : I7
- **Livrable** : `BENCH.md` complété avec Parquet 300 Mo réel CPAM
- **Critères d'acceptation** :
  - [ ] Mesures : temps premier rendu, drill-down, RAM stable
  - [ ] Comparaison avec cibles §9.1 V0 (rendu < 8 s, drill < 1 s, RAM < 800 Mo)
  - [ ] Profil mémoire annexé (capture Process Explorer)
  - [ ] Recommandation : Go ou ajustement
- **Dépendances** : B-050, B-023
- **PRD** : §9.1, §12.1
- **Complexité** : M

### B-081 — [x] Matériel de démo V0 (script + grille de retour)

- **Itération** : I7
- **Livrable** : script de démo + grille de feedback prêts à l'emploi
- **Critères d'acceptation** :
  - [x] Script de démo couvrant UC-1, UC-3, UC-6 + architecture/scope/hors-scope (`docs/handoff/demo-script.md`)
  - [x] Grille de retour prête (`docs/handoff/feedback-grid.md`)
- **Dépendances** : B-080
- **PRD** : §12.1, H6
- **Complexité** : M
- **Notes** : la tenue de la démo et la convocation RSSI/cadres relèvent de la planification du product owner, pas du livrable produit — ce n'est pas un blocage.

### B-082 — [x] Décision Go V0 → V1 (validée par le product owner)

- **Itération** : I7
- **Livrable** : décision Go tracée (critères techniques §12.1 pré-évalués 6 🟢 / 3 🟧 / 0 🔴, aucun blocage structurel)
- **Critères d'acceptation** :
  - [x] Critères §12.1 évalués — aucun rouge
  - [x] Décision : **Go** (V1 effectivement démarré : design system SP0→SP4, intégration Power BI)
- **Dépendances** : B-080
- **PRD** : §12.1
- **Complexité** : S
- **Notes** : Go validé directement par le product owner (validation de livraison). Les jalons externes DSI/RSSI (signature, avis) restent hors scope produit (ADR-005) et **ne conditionnent pas** le démarrage V1.

---

## 3. V1 — Pilote collège cadres (sous condition Go V0)

### 3.1 V1-1 — MapLibre + PMTiles

### B-100 — [x] Intégrer MapLibre GL JS

- **Itération** : V1-1
- **Livrable** : carte MapLibre interactive (zoom, pan) en remplacement du rendu carto I2
- **Critères d'acceptation** :
  - [ ] MapLibre GL JS chargé dans la WebView
  - [ ] Carte initialisée centrée sur la France (lat 46.5, lon 2.5, zoom 5)
  - [ ] Zoom / pan / rotation activés ; contrôle de zoom visible
  - [ ] Coexistence avec Mosaic : couche choroplèthe depuis Mosaic, base depuis MapLibre
- **Dépendances** : B-082 (Go V0), B-032
- **PRD** : §6.2 carto, ADR-009
- **Complexité** : L

### B-101 — [x] PMTiles fond de carte embarqué offline

- **Itération** : V1-1
- **Livrable** : fond OSM ou IGN distillé en PMTiles, embarqué dans le MSI
- **Critères d'acceptation** :
  - [ ] Décision tracée §16 Q3 : OSM (PMTiles France ~50 Mo) ou IGN (licence Etalab 2.0)
  - [ ] Fichier PMTiles intégré dans `src-tauri/resources/` ou téléchargé au démarrage si trop gros
  - [ ] MapLibre source `pmtiles://` configurée
  - [ ] Rendu fluide à zoom 5–10 sans aucun appel réseau (vérifier en mode avion)
  - [ ] Taille MSI mesurée, comparée à cible §9.1 (< 30 Mo) — si dépassement, escalader
- **Dépendances** : B-100
- **PRD** : §9.1, §16 Q3
- **Complexité** : L

### 3.2 V1-2 — TopoJSON IGN ADMIN EXPRESS COG

### B-110 — [x] Pipeline conversion IGN ADMIN EXPRESS → TopoJSON simplifié

- **Itération** : V1-2
- **Livrable** : script `scripts/build-geo.sh` qui télécharge IGN, simplifie, convertit en TopoJSON
- **Critères d'acceptation** :
  - [ ] Script récupère la dernière édition COG simplifiée IGN
  - [ ] Conversion via Mapshaper ou `topojson-server` avec quantization ~5 %
  - [ ] Sortie : `ref/departements.topojson` (≤ 200 Ko), `ref/regions.topojson`
  - [ ] Licence Etalab 2.0 notée dans `ref/LICENSE.md`
  - [ ] Script reproductible et documenté
- **Dépendances** : B-100
- **PRD** : §6.2, ADR-009, §7.3
- **Complexité** : M

### B-111 — [x] Drill carto MapLibre + TopoJSON

- **Itération** : V1-2
- **Livrable** : choroplèthe MapLibre clic département → drill complet
- **Critères d'acceptation** :
  - [ ] Couche fill-extrusion ou fill colorée par valeur métrique
  - [ ] Clic département émet une Mosaic Selection (coordination avec B-041)
  - [ ] Performance : drill < 500 ms sur Parquet 500 Mo (cible V1 §9.1)
  - [ ] Test sur Parquet 500 Mo réel CPAM
- **Dépendances** : B-110, B-101
- **PRD** : §9.1 V1, UC-1
- **Complexité** : L

### 3.3 V1-3 — Watcher FS

### B-120 — [x] Watcher FS sur le share via `plugin-fs-watch`

- **Itération** : V1-3
- **Livrable** : détection des modifications du Parquet référencé
- **Critères d'acceptation** :
  - [ ] Watcher démarré à l'ouverture d'un `.vviz`, arrêté à la fermeture
  - [ ] Événement émis vers le front uniquement si le Parquet listé dans `data.sources` change
  - [ ] Debounce 1 s pour éviter le bruit pendant écriture atomique du publisher
  - [ ] Pas de polling agressif (vérifier avec Process Explorer)
- **Dépendances** : B-082
- **PRD** : §5.2, UC-5
- **Complexité** : M

### B-121 — [x] Bannière refresh non intrusive

- **Itération** : V1-3
- **Livrable** : bandeau top de fenêtre « Données mises à jour — Recharger »
- **Critères d'acceptation** :
  - [ ] Bandeau apparaît à l'événement watcher (B-120)
  - [ ] Bouton « Recharger » re-fetch les données et redessine
  - [ ] Bouton « Ignorer » masque le bandeau pour la session
  - [ ] Aucun rechargement automatique (UC-5 explicite)
- **Dépendances** : B-120
- **PRD** : UC-5, §5.2
- **Complexité** : S

### 3.4 V1-4 — Exports

### B-130 — [x] Décider stratégie export PDF (chrome.printing vs pdf-lib)

- **Itération** : V1-4
- **Livrable** : décision tracée dans `docs/adr/ADR-PDF.md`
- **Critères d'acceptation** :
  - [ ] Prototype des deux approches sur la vue UC-1 (carte + détail)
  - [ ] Comparaison : fidélité visuelle, fluidité, dépendances, fallback
  - [ ] Décision motivée + impact dimensionnel sur le MSI
- **Dépendances** : B-082
- **PRD** : §16 Q8, R-5
- **Complexité** : M
- **Notes** : risque R-5 (rendu PDF dégradé MapLibre WebGL) à valider ici.

### B-131 — [x] Export PDF A4 (exigence explicite UC-4)

- **Itération** : V1-4
- **Livrable** : bouton « Exporter en PDF » génère un PDF A4 paysage de la vue active
- **Critères d'acceptation** :
  - [ ] PDF généré en < 5 s sur dashboard 3 vues
  - [ ] Carte MapLibre rendue correctement (pas de tile manquante)
  - [ ] Métadonnées PDF : titre `.vviz`, auteur, date génération
  - [ ] Test sur les 6 cas d'usage canoniques
- **Dépendances** : B-130, B-111
- **PRD** : UC-4 (exigence explicite), ADR-011
- **Complexité** : L

### B-132 — [x] Exports PNG (presse-papier + fichier) + CSV (données filtrées)

- **Itération** : V1-4
- **Livrable** : 3 boutons d'export : PDF (B-131), PNG, CSV
- **Critères d'acceptation** :
  - [ ] PNG : capture haute-résolution de la vue active dans le presse-papier ET en fichier `.png`
  - [ ] CSV : données filtrées affichées (après cross-filter) avec en-têtes, encodage UTF-8 BOM
  - [ ] CSV s'ouvre directement dans Excel sans déformation de colonnes
  - [ ] Boutons accessibles clavier
- **Dépendances** : B-131
- **PRD** : UC-4
- **Complexité** : M

### 3.5 V1-5 — Intégration du design (épopée maquette)

> Remplace l'ex-itération « Thème DSFR ». Le DSFR est abandonné au profit du design custom de la maquette (`mockups/VaultViz/`) — cf. [ADR-012](docs/adr/ADR-012-design-system.md) et la [spec d'intégration](docs/superpowers/specs/2026-05-29-integration-design-maquette-design.md). Chaque épopée SP1→SP4 fait l'objet de son propre cycle spec → plan → implémentation. **Stories B-140 et B-141 retirées** (tombstones ci-dessous pour traçabilité).

- **B-140 — [retiré]** ~~Setup palette + composants DSFR~~ → remplacé par B-200/B-201/B-202 (ADR-012).
- **B-141 — [retiré]** ~~Typo Marianne embarquée~~ → remplacé par B-201 (polices Inter + JetBrains Mono embarquées).

### B-199 — [x] SP0 — Refondation documentaire & backlog

- **Itération** : V1-5 / SP0
- **Livrable** : PRD amendé (DSFR retiré), ADR-012 créé, backlog V1 restructuré autour de SP1→SP4
- **Critères d'acceptation** :
  - [ ] ADR-012 présent et accepté
  - [ ] PRD §4.1 V1 et §15 amendés (plus d'exigence DSFR active ; ADR-012 référencé)
  - [ ] B-140/B-141 retirés (tombstones) ; dépendances re-pointées
  - [ ] Tableau de bord §0.3 cohérent
- **Dépendances** : aucune
- **PRD** : §4.1, §15 ; ADR-012
- **Complexité** : S

### B-200 — [x] SP1 — Design system (tokens + polices + icônes + CSS base)

- **Itération** : V1-5 / SP1
- **Livrable** : design tokens (dark/light), polices Inter + JetBrains Mono **embarquées** (.woff2 + @font-face), jeu d'icônes SVG, CSS de base des composants
- **Critères d'acceptation** :
  - [ ] Tokens CSS portés (`:root`, `[data-theme="dark"]`, `[data-theme="light"]`, densité, accent)
  - [ ] **Zéro appel réseau** pour les polices (invariant I-2) — vérifié par grep anti-URL
  - [ ] Toggle de thème persistant en `%LOCALAPPDATA%` (I-3)
  - [ ] Tests existants (`npm test`, `cargo test`) toujours au vert
- **Dépendances** : B-199
- **PRD** : §4.1 V1 ; ADR-012, ADR-008 (I-2)
- **Complexité** : L (épopée — spec dédiée)
- **Notes** : la maquette importe les polices via Google Fonts CDN — interdit ; embarquer en local.

### B-210 — [x] SP2 — App shell

- **Itération** : V1-5 / SP2
- **Livrable** : titlebar custom (contrôles fenêtre Tauri), toolbar (path/statut/actions), home (hero/dropzone/récents persistés), glisser-déposer, loader à étapes, dialog natif thémé, bandeau d'erreur câblé sur erreurs typées
- **Critères d'acceptation** :
  - [ ] Home remplace `welcome.ts` ; récents persistés app-local (I-3)
  - [ ] Ouverture par double-clic, dialog ET glisser-déposer
  - [ ] Bandeau d'erreur alimenté par `ErrorPayload` + détails Ajv existants
  - [ ] Tests existants toujours au vert
- **Dépendances** : B-200
- **PRD** : §4.1 V1, UC-2 ; ADR-012
- **Complexité** : L (épopée — spec dédiée)

### B-220 — [x] SP3 — Dashboard spec-driven

- **Itération** : V1-5 / SP3
- **Livrable** : extensions `schema/vviz-v1.json` + `view-compiler` pour KPI-avec-delta, carte+sélecteur de métrique, barres classées, barres appariées, table+recherche+badges, chip de filtre ; exemple canonique `examples/controle-gestion.vviz` + Parquet
- **Critères d'acceptation** :
  - [ ] Chaque composant de la maquette exprimable en `.vviz` (générique, pas hardcodé)
  - [ ] Push-down DuckDB + cross-filter Mosaic préservés
  - [ ] L'exemple canonique rendu par le moteur ≈ `mockups/VaultViz/VaultViz.html`
  - [ ] Tests existants + nouveaux tests de compilation au vert
- **Dépendances** : B-200, B-210
- **PRD** : §5.3, UC-1, UC-3 ; ADR-002, ADR-012
- **Complexité** : L (épopée — spec dédiée, potentiellement re-découpée)

### B-230 — [x] SP4 — Onglets multi-documents

- **Itération** : V1-5 / SP4
- **Livrable** : architecture multi-documents (namespacing connexion DuckDB Rust + état d'onglets front)
- **Critères d'acceptation** :
  - [ ] Plusieurs `.vviz` ouverts simultanément, isolés
  - [ ] Pas de fuite de vues/données entre onglets
  - [ ] Tests existants toujours au vert
- **Dépendances** : B-220
- **PRD** : §4.1 (hors V1 « multi » à réévaluer) ; ADR-012
- **Complexité** : L (épopée — brainstorm + spec dédiés)
- **Notes** : la maquette note les onglets « V2 » ; séquencés en dernier.

### 3.5bis V1-E — Capacités moteur génériques (viz-engine)

> **App-core, agnostique au cas d'usage.** Ces stories tracent des capacités **génériques** du moteur VaultViz (DSL `.vviz` + `src/viz-engine/`), réutilisables par **n'importe quel** `.vviz`. Elles ont été **révélées** par le cas DLI (V1-7) mais ne lui appartiennent pas. Distinction clé : le **mécanisme** vit ici (app) ; le **contenu métier** (comptes, périmètres, libellés) reste dans le `.vviz` + son pipeline de prep.

### B-250 — [x] Moteur de rendu hybride — composants maison génériques

- **Itération** : V1-E
- **Livrable** : composants de rendu maison (DOM/SVG) **génériques**, routés par le `view-compiler`, pour les types de vues non couverts (de façon satisfaisante) par vgplot
- **Critères d'acceptation** :
  - [x] Composants génériques : `line`/`area` (`line-chart.ts`), `pie` (`pie-chart.ts`), `kpi` (`kpi-card.ts`), barres classées (`ranked-bars.ts`) et appariées (`grouped-bars.ts`), choroplèthe (`map-view.ts`, d3-geo)
  - [x] Chaque composant tire ses données via `conn.query` (push-down DuckDB) — aucun calcul JS
  - [x] Routage par `view-compiler` selon `view.type` ; cross-filter via `subscribeCrossFilter`/`injectWhere`
  - [x] Tests unitaires par composant ; `npm test` au vert
- **Dépendances** : B-220 (view-compiler spec-driven)
- **PRD** : ADR-002 amendé (moteur hybride)
- **Complexité** : L
- **Notes** : story **rétroactive** — acte comme app-core un travail né dans les épopées design (SP3) et DLI (ex-« W1 courbe bespoke »). Le `type` de vue est générique ; aucun couplage au cas DLI.

### B-251 — [x] Slicers multi-valeurs & slicer global (DSL + moteur)

- **Itération** : V1-E
- **Livrable** : extension **générique** du mécanisme de sélection — déclarer dans n'importe quel `.vviz` des **slicers multi-valeurs** combinés en **AND**, et un **slicer global** cross-filtrant toutes les vues du document.
- **Contexte (le gap)** : le moteur ne connaît aujourd'hui qu'une sélection `single` (un émetteur, ex. clic département/barre) ; `injectWhere(sql, source, field, value)` n'injecte **qu'une** clause `WHERE field = value`. Manquent (1) la composition de N clauses, (2) des slicers d'UI (cases à cocher) émetteurs, (3) la portée globale (hors onglet).
- **Critères d'acceptation** :
  - [ ] **Schéma** : `spec.slicers[]` dans `schema/vviz-v1.json` (`{ id, field, source, label, kind:"in"|"interval", scope:"tab"|"global" }`, `additionalProperties:false`) ; `ajv validate` au vert
  - [ ] **Moteur** : `injectWhere` généralisé en composition de N prédicats `AND` (multi-valeurs → `IN (...)`), push-down DuckDB préservé
  - [ ] **UI** : composant générique `slicer-panel.ts` (cases à cocher) ; mise à jour de la sélection partagée → re-render des vues abonnées sub-seconde
  - [ ] **Portée** : `scope:"global"` filtre toutes les vues de tous les onglets ; `scope:"tab"` reste local
  - [ ] **Rétro-compat** : les sélections `single` existantes (clic carte/barre) inchangées
  - [ ] Tests unitaires moteur (composition AND, multi-valeurs, slicer vide = no-op) **hors tout contenu DLI** ; `npm test` au vert
- **Dépendances** : B-250
- **PRD** : ADR-002 amendé ; spec DLI §5.2/§5.4 (cas déclencheur, **non** propriétaire)
- **Complexité** : L

### 3.5ter V1-7 — Cas de production DLI / Power BI (premier test prod réel)

> **Premier vrai test de production.** Reprise intégrale du rapport Power BI « Inventaire » (11 pages, immobilisations CPAM 92) dans un `.vviz` **autoporteur** (`examples/DLI/dli_inventaire_autoporteur.vviz`). C'est le vecteur qui valide en conditions réelles l'**autoporteur** (ADR-003 amendé) et le **moteur hybride** (ADR-002 amendé). Spec de référence : [`docs/superpowers/specs/2026-05-29-integration-powerbi-inventaire-design.md`](docs/superpowers/specs/2026-05-29-integration-powerbi-inventaire-design.md) (Waves W0→W5).
>
> **Découpage app-core vs métier** : les capacités moteur génériques (rendu maison, slicers) sont tracées en **V1-E (B-250/B-251)**. Les stories ci-dessous ne contiennent que de la **consommation** (déclaration dans le `.vviz`) + du **contenu DLI** (données, périmètres, libellés). Aucune logique moteur n'y est ajoutée.
>
> **Périmètre données** : `examples/DLI/` reste **gitignoré** (vraies immobilisations CPAM). Réconciliation fine des chiffres avec le PBI : voir §9 questions ouvertes de la spec — les indicateurs sont **étiquetés « périmètre VaultViz »** tant que le mainteneur n'a pas confirmé les règles ; ce n'est **pas** un blocage (chiffres réellement calculables produits, réconciliation rejouée à réception).

### B-240 — [x] W0 — Socle données & définitions (pipeline de prep)

- **Itération** : V1-7 / W0
- **Livrable** : `examples/DLI/build_dashboard.py` produisant un Parquet pré-agrégé par vue selon les définitions du PBI (vision CNAM/totalité, taux nb/valeur)
- **Critères d'acceptation** :
  - [x] 17 sources pré-agrégées embarquées (`assets`, `bilan_cnam`, `parc_annee`, `sites`, `diff_*`, `activite`, …)
  - [x] Chiffres calculés sur les données disponibles, étiquetés « périmètre VaultViz » là où non réconciliés
- **Dépendances** : B-220
- **PRD** : ADR-003 (autoporteur), §7
- **Complexité** : L

### B-241 — [x] W1 — Onglet Activité DLI (consomme le line-chart générique)

- **Itération** : V1-7 / W1
- **Livrable** : onglet « Activité scan » du `.vviz` DLI (courbe cumulée + barres/mois), déclaré en `type: area`/`line`, **consommant** le composant générique B-250.
- **Critères d'acceptation** :
  - [x] L'onglet rend réellement des données (vgplot rendait vide → composant maison générique B-250)
  - [x] Cross-filter via `filterField` + `injectWhere`
- **Dépendances** : B-250 (composant générique), B-240 (table `activite`)
- **PRD** : spec DLI §5.1
- **Complexité** : S (consommation)
- **Notes** : la *construction* du composant line/area est désormais tracée en app-core (**B-250**) ; ici, seule la déclaration DLI subsiste. `dot` différé.

### B-242 — [x] W2 — Pages reproductibles (onglets)

- **Itération** : V1-7 / W2
- **Livrable** : onglets Bilan comptable, Parc/année, Sites, Différence Copernic, Activité scan, Manquants étendu
- **Critères d'acceptation** :
  - [x] 8 onglets, 29 vues (kpi/barX/bar/table/pie/area) dans le `.vviz` autoporteur
  - [x] `.vviz` valide le schéma ; cross-filter cohérent ; `npm test` au vert (318)
- **Dépendances** : B-241
- **PRD** : §3-9 mapping spec
- **Complexité** : L

### B-243 — [ ] W3 — Page Recherche DLI (consomme les slicers multi)

- **Itération** : V1-7 / W3
- **Livrable** : onglet « Recherche » du `.vviz` DLI (page 7 du PBI) — **déclaration** des slicers Compte / Type / Site / Gestion + panneaux « scanné sur autre site » / « absent ».
- **Critères d'acceptation** :
  - [ ] Les 4 slicers déclarés dans le `.vviz` via `spec.slicers` (mécanisme **B-251**), combinés en AND
  - [ ] Panneaux « autre site » / « absent » = tables filtrées sur la sélection croisée
  - [ ] **Aucune logique moteur ajoutée ici** — pure déclaration + contenu DLI
  - [ ] L'exemple `.vviz` valide le schéma ; `npm test` au vert
- **Dépendances** : B-251 (mécanisme slicers), B-242
- **PRD** : spec DLI §5.2, mapping page 7
- **Complexité** : M
- **Notes** : le **contenu** (champs Compte/Type/Site/Gestion, données) est DLI ; le **mécanisme** est app-core (B-251). Actuellement `slicers: 0` dans le `.vviz`.

### B-244 — [ ] W4 — Toggle Vision/Gestion DLI (consomme le slicer global)

- **Itération** : V1-7 / W4
- **Livrable** : bascule **Vision** `CNAM ⇆ Totalité` + filtre **Gestion** `43 / 58 / 85` du dashboard DLI, déclarés comme **slicer global** (mécanisme B-251).
- **Contexte (métier, pas moteur)** : « Vision CNAM » et « Totalité » sont des **périmètres comptables définis par le rapport PBI source** (liste de comptes, cf. spec §2), **pas** des concepts VaultViz. Le mécanisme de slicer global est générique (B-251) ; seul le **contenu** (colonnes, comptes, valeurs Gestion) est DLI.
- **Critères d'acceptation** :
  - [ ] **Prep (B-240)** : colonnes `vision` (CNAM/totalité) et `gestion` présentes dans les sources concernées ; sinon ajout dans `build_dashboard.py` + régénération de l'autoporteur.
  - [ ] **Déclaration** : un `spec.slicers` `scope:"global"` sur `vision` (toggle) et `gestion` (segment), câblé sur toutes les vues.
  - [ ] **Cohérence** : changer Vision recalcule KPI/tables/graphes de tous les onglets selon le périmètre.
  - [ ] **Honnêteté** : libellés « périmètre VaultViz » maintenus tant que la réconciliation PBI (spec §9) n'est pas confirmée.
  - [ ] `npm test` au vert ; cohérence avec les sélections locales (bâtiment, slicers Recherche).
- **Dépendances** : B-251 (slicer global), B-240 (colonnes `vision`/`gestion`)
- **PRD** : spec DLI §5.4
- **Complexité** : M

### B-245 — [ ] W5 — Intégration finale, recalage ergonomie & validation terrain

- **Itération** : V1-7 / W5
- **Livrable** : assemblage du `.vviz` autoporteur **final** (tous onglets W2 + Recherche W3 + paramètres globaux W4), recalage ergonomique pour approcher la maquette/le PBI, et validation de bout en bout.
- **Critères d'acceptation** :
  - [ ] **Couverture** : ~90 % du PBI reproduit (pages 1-5, 8-10 + Recherche 7) ; les écarts explicitement listés (page 11 « detail site » couverte par cross-filter ; « Bilan complet vide » à clarifier mainteneur) — **aucun chiffre non reproductible affiché** (pas de « 97 % » fictif, cf. spec §2).
  - [ ] **Non-régression** : `npm test` (≥ 318) + `cargo test` au vert ; les exemples canoniques (`controle-gestion.vviz`, …) non régressés.
  - [ ] **Validation visuelle** : lancement de l'app sur l'autoporteur (`VVIZ_DEFAULT=…/dli_inventaire_autoporteur.vviz`), capture de **chaque onglet**, comparaison ergonomique avec le PBI source.
  - [ ] **Reproductibilité** : `build_dashboard.py` + `embed.py` régénèrent l'autoporteur de bout en bout (l'édition manuelle d'un `.vviz` généré n'est pas durable).
  - [ ] `examples/DLI/` reste **gitignoré** (vraies immobilisations CPAM).
- **Dépendances** : B-244
- **PRD** : spec §8 (critères d'acceptation)
- **Complexité** : M
- **Notes** : les 9 questions de réconciliation au mainteneur PBI (spec §9) **ne bloquent pas** la clôture : la wave produit les chiffres réellement calculables, étiquetés « périmètre VaultViz » ; la réconciliation fine est rejouée dès réception des réponses.

### 3.6 V1-6 — Signature DSI

### B-150 — [ ] Coordonner avec la DSI la signature production du MSI

- **Itération** : V1-6
- **Livrable** : MSI signé par la DSI, validé, déployable
- **Critères d'acceptation** :
  - [ ] Procédure DSI documentée dans `docs/deploy.md` (côté projet, point de jonction)
  - [ ] MSI signé par la DSI à partir d'un artefact CI propre
  - [ ] Test installation sur poste protégé AppLocker
  - [ ] Cycle d'itération clair : nouvelle version CI → nouveau MSI signé en N jours max
- **Dépendances** : B-220 (design intégré), B-072 (test V0 réussi)
- **PRD** : ADR-005, §16 Q2
- **Complexité** : S (côté dev) ; M (côté DSI, hors scope produit)
- **Blocage potentiel** : `[!]` si refus DSI ou délais incompatibles

### 3.8 V1-8 — Documentation

### B-170 — [x] Doc utilisateur 1 page

- **Itération** : V1-8
- **Livrable** : `docs/user.md` (et PDF généré) en 1 page A4
- **Critères d'acceptation** :
  - [x] Comment ouvrir un `.vviz`
  - [x] Comment exporter en PDF/PNG/CSV
  - [x] Comment réagir à la bannière « Données mises à jour »
  - [x] Que faire en cas d'erreur (numéro support DSI)
  - [x] Tient en une page A4 imprimable
- **Dépendances** : B-150
- **PRD** : §4.1 V1
- **Complexité** : S

### B-171 — [x] Doc auteur de spec 5 pages

- **Itération** : V1-8
- **Livrable** : `docs/author.md` (et PDF) — guide pour les data analysts
- **Critères d'acceptation** :
  - [x] Anatomie d'un `.vviz`
  - [x] Référence des champs vgplot supportés (avec exemples)
  - [x] Bonnes pratiques de chemins UNC
  - [x] Galerie d'au moins 3 exemples canoniques (carte, time series, tableau)
  - [x] Lien vers le schéma JSON pour validation VS Code
- **Dépendances** : B-170
- **PRD** : §4.1 V1, persona Mehdi
- **Complexité** : M

### B-172 — [x] Publier le schéma JSON `.vviz` accessible aux auteurs

- **Itération** : V1-8
- **Livrable** : URL stable du schéma pour `$schema` dans les `.vviz`
- **Critères d'acceptation** :
  - [x] Schéma servi via raw GitHub privé OU copié à l'installation dans `%ProgramFiles%\VaultViz\schema\` (cf. §16 Q4)
  - [x] Doc auteur référence l'URL ou le chemin local
  - [x] Test : VS Code avec extension JSON valide un `.vviz` contre le schéma
- **Dépendances** : B-171, B-033
- **PRD** : §16 Q4
- **Complexité** : M

### 3.9 V1-9 — Pilote MECM

### B-180 — [ ] Déploiement MECM/Intune sur 10–20 postes pilotes

- **Itération** : V1-9
- **Livrable** : MSI signé poussé sur un panel de 10 à 20 cadres CPAM 92
- **Critères d'acceptation** :
  - [ ] Push silencieux validé par la DSI
  - [ ] Postes pilotes identifiés (cf. §16 Q5)
  - [ ] Communication aux pilotes : email + 1 page user (B-170)
  - [ ] Hotline / canal de retour identifié
- **Dépendances** : B-150, B-170
- **PRD** : §16 Q5
- **Complexité** : M
- **Blocage potentiel** : `[!]` si direction sponsor non identifiée

### B-181 — [ ] Collecte retours terrain pilotes

- **Itération** : V1-9
- **Livrable** : rapport quantitatif + qualitatif des retours pilotes
- **Critères d'acceptation** :
  - [ ] Métriques : taux d'installation autonome, taux d'ouverture autonome, durée moyenne d'usage
  - [ ] Verbatim qualitatifs : 5 retours minimum
  - [ ] Liste des frictions UX
  - [ ] Liste des bugs reproductibles
  - [ ] Critères §12.2 mesurés (≥ 80 % autonomie ?)
- **Dépendances** : B-180
- **PRD** : §12.2, H5
- **Complexité** : M

### 3.10 V1-10 — Go/No-Go déploiement large

### B-190 — [ ] Décision Go/No-Go V1 → déploiement large

- **Itération** : V1-10
- **Livrable** : décision tracée + plan de déploiement (ou plan correctif)
- **Critères d'acceptation** :
  - [ ] Tous les critères §12.2 évalués
  - [ ] Décision motivée signée Sponsor DSI + RSSI
  - [ ] Si Go : plan de push parc large
  - [ ] Si No-Go : itération V1' identifiée
- **Dépendances** : B-181
- **PRD** : §12.2
- **Complexité** : M

---

## 4. Indexes

### 4.1 Par dépendance critique (chemin critique)

```
B-000 → B-001 → B-002 → B-010 → B-011 → B-012 (H1 — UNC test)
                              ↘ B-020 → B-021 → B-022 → B-023 (H2 — perf 50 Mo)
                                                       ↘ B-030 → B-031 → B-032 → B-033 (H4 — Mosaic)
                                                                        ↘ B-040 → B-041 → B-050 → B-080 (perf 300 Mo)
                                                                                              ↘ B-070 → B-071 → B-072 (H3 — DSI signature)
                                                                                              ↘ B-081 → B-082 (Go V0)
```

### 4.2 Par hypothèse validée

| Hypothèse PRD | Story qui la valide |
|---|---|
| H1 — UNC scope Tauri | B-012 |
| H2 — DuckDB SMB 500 Mo | B-023 (50 Mo), B-080 (300 Mo), B-111 (500 Mo) |
| H3 — MSI signable DSI | B-072 (V0 test), B-150 (V1 prod) |
| H4 — Drill Mosaic déclaratif | B-040 + B-041 |
| H5 — Adoption cadres | B-181 |
| H6 — Avis RSSI | B-081 |

### 4.3 Par risque mitigé

| Risque PRD | Story qui le mitige |
|---|---|
| R-1 MSI refusé DSI | B-072 (escalade tôt) |
| R-2 UNC scope KO | B-012 |
| R-3 Perf > 1 Go | B-080, B-111 |
| R-5 PDF dégradé | B-130 (décision) |
| R-7 Adoption < 50 % | B-181 |
| R-8 Mosaic bloquant | B-030 (verrouillage), B-031 (escalade dès I2) |
| R-10 Publisher défaillant | Hors backlog applicatif — §7 PRD, audit DSI |

---

**Fin du backlog v1.0.**

Toute modification de scope (ajout/suppression/refonte d'une story) doit faire l'objet d'une mise à jour explicite avec date et motif, et propager au tableau de bord §0.3.
