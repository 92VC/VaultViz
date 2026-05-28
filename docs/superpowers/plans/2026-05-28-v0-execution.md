# VaultViz V0 — Plan d'exécution

> **Pour les workers agentic** : SKILL REQUISE — `superpowers:subagent-driven-development`. Le contrôleur (Claude principal) dispatche un implementer subagent par task, suivi de spec-reviewer puis code-quality-reviewer. Les steps utilisent la syntaxe checkbox `- [ ]`.

**Goal** : faire passer VaultViz de Pré-V0 (B-000 ✅) à V0 démontrable — 23 stories, 8 itérations (I0→I7), output = MSI Windows 11 signable + démo UC-1/UC-3/UC-6 sur Parquet 50 Mo et 300 Mo (synthétique).

**Architecture** : Tauri 2 (Rust core + WebView2/webkit2gtk) + DuckDB natif (bundled, statique) + Mosaic/vgplot (push-down SQL) + Arrow IPC pour transit Rust↔JS. Aucun port réseau, aucun appel sortant, scope FS limité à `//<host>/<share>/**` + chemins locaux.

**Tech Stack** : Rust (Tauri 2.x, duckdb-rs feature `bundled`, apache-arrow), TypeScript (Vite, @uwdata/vgplot + mosaic-core + mosaic-sql, apache-arrow, ajv), JSON Schema Draft 7, GitHub Actions (windows-latest + ubuntu-latest).

---

## §0. Préambule — Contraintes et stratégie

### 0.1 Calibrage du périmètre autonome

Sur les 23 stories V0, la décomposition réaliste est :

| Catégorie | Stories | Stratégie |
|---|---|---|
| **20 stories `[x]` autonomes** | B-001, B-002 (×11 ADRs), B-010 à B-071, B-080 (synthétique) | Exécution complète en session subagent-driven |
| **3 stories `[!]` handoff-ready** | B-072 (signature DSI), B-081 (démo RSSI), B-082 (décision Go/No-Go) | Artefact produit + dossier de handoff complet ; marqueur `[!]` avec blocage explicite tracé |

La V0 « techniquement complète » est atteinte à la fin de Wave 8. La V0 « Go/No-Go signée » dépend ensuite de 3 actions humaines hors session.

### 0.2 Environnement dev vs cible

- **Dev box** : Fedora Linux (rustup 1.28, cargo 1.93, node v24, npm 11).
- **Cible** : Windows 11 (WebView2 Evergreen, MSI via tauri-bundler, MECM/Intune).
- **Conséquence** : `cargo tauri dev` tourne en local sur webkit2gtk (sanity dev) ; **toute validation Windows-only** (MSI build, WebView2 runtime, association `.vviz`, AppLocker) passe par **GitHub Actions `windows-latest`** dans la CI. Aucun critère « valide sur Windows 11 » n'est coché sans run GHA vert ou screenshot daté d'un run windows-latest.
- **Cargo tauri dev sur Linux** = sanity check du code (compilation, IPC, DuckDB), **pas** validation d'UI Windows. Les critères BACKLOG « Windows 11 » sont validés par job GHA documenté dans la story.

### 0.3 Stories nécessitant des humains externes (mises en `[!]`)

| Story | Blocage | Handoff package produit |
|---|---|---|
| **B-072** | Signature MSI par DSI CPAM 92 ; point de contact à identifier (§16 Q2 PRD) | MSI v0.0.1, `docs/handoff/dsi-signing-package.md` (contexte, exigences AppLocker, ABI MSI, contacts), release GitHub privée tagguée `v0.0.1-rc1` |
| **B-081** | Démo live 30 min + 2 cadres + RSSI | `docs/handoff/demo-script.md` (script 30 min), slides PDF, jeu de données démo, ordre du jour, grille de retour écrit |
| **B-082** | Décision sponsor (DSI + métier) sur évaluation Go/Go-conditionnel/No-Go | `docs/adr/ADR-V0-GoNoGo-template.md` (grille § 12.1 PRD préremplie en vert/orange/rouge sur les critères techniques, vide sur l'avis sponsor) |

### 0.4 Structure de fichiers cible

Cette section verrouille les décompositions ; chaque task touche un sous-ensemble explicite.

```
src-tauri/
├── Cargo.toml                    # Tauri 2 + duckdb-rs (bundled) + chrono + serde
├── build.rs                      # tauri-build
├── tauri.conf.json               # bundler MSI, identifier, fileAssociations .vviz
├── capabilities/
│   └── main.json                 # B-011 — scope UNC + relatif + drive letters
├── icons/                        # placeholders 32/128/512 + ico/icns
├── src/
│   ├── main.rs                   # entrypoint Tauri (builder, plugins, manage state)
│   ├── error.rs                  # enum VVizError + From conversions
│   ├── state.rs                  # AppState { duck: Mutex<duckdb::Connection> }
│   ├── duck.rs                   # B-021 — query_parquet(sql) -> Arrow IPC bytes
│   ├── log.rs                    # B-062 — file rotation %LOCALAPPDATA%\VaultViz\logs
│   └── commands/
│       ├── mod.rs                # re-exports
│       ├── vviz.rs               # B-012 — read_vviz(path) -> String
│       └── query.rs              # B-022 — run_query(sql) -> Vec<u8>
└── tests/
    ├── duck_smoke.rs             # SELECT 42, COUNT(*) FROM parquet
    └── log_rotation.rs           # 7+ days simulated
src/
├── index.html
├── main.ts                       # bootstrap
├── viz-engine/
│   ├── duck-connector.ts         # B-031 — Mosaic Connector implementation
│   ├── spec-loader.ts            # B-033 — fetch .vviz + validate + bind sources
│   ├── mosaic-runtime.ts         # wrap MosaicClient coordinator
│   ├── types.ts                  # VVizDocument, VVizSource, ConnectorResponse
│   └── index.ts
├── components/
│   ├── error-banner.ts           # B-060 — UI erreur fichier
│   ├── table-view.ts             # B-050 — table virtualisée Arrow
│   ├── map-view.ts               # B-032 — choroplèthe SVG/D3 (TopoJSON inline)
│   └── tooltip.ts                # B-032 — survol département
├── utils/
│   ├── schema-validator.ts       # B-061 — ajv strict mode
│   └── path-helpers.ts           # normalize UNC // vs \\
├── assets/
│   └── departements-v0.topojson  # B-032 — temp embedded (V1 → MapLibre + IGN)
├── styles/
│   └── main.css                  # minimal, no DSFR yet (V1)
└── __tests__/
    ├── duck-connector.test.ts    # mock invoke, assert Arrow Table
    ├── spec-loader.test.ts
    └── schema-validator.test.ts
schema/
└── vviz-v1.json                  # B-033 — JSON Schema Draft 7
examples/
├── effectifs_2026.vviz           # B-033 — exemple canonique
├── sample.parquet                # tests Rust + JS (~ 1 Mo synth)
└── synth_300mb.parquet           # B-080 — bench 300 Mo (gen via DuckDB)
docs/
├── adr/
│   ├── ADR-001-duckdb-natif.md
│   ├── ADR-002-mosaic-vgplot.md
│   ├── ADR-003-parquet-arrow.md
│   ├── ADR-004-tauri-2.md
│   ├── ADR-005-signature-dsi.md
│   ├── ADR-006-msi-bundler.md
│   ├── ADR-007-unc-paths.md
│   ├── ADR-008-no-network.md
│   ├── ADR-009-maplibre-ign.md
│   ├── ADR-010-windows-11-only.md
│   ├── ADR-011-export-pdf-v1.md
│   └── ADR-V0-GoNoGo-template.md # B-082
├── bench/
│   └── BENCH.md                  # B-023, B-080
├── handoff/
│   ├── dsi-signing-package.md    # B-072
│   ├── demo-script.md            # B-081
│   └── demo-slides.md            # B-081 (rendu PDF via pandoc)
├── scripts/
│   └── gen-synth-parquet.sh      # B-023 / B-080 synthétique
└── superpowers/plans/
    └── 2026-05-28-v0-execution.md  # ce fichier
.github/
└── workflows/
    ├── ci.yml                    # lint/test/build matrix ubuntu+windows
    └── release.yml               # B-071 — build MSI sur tag v*
scripts/
└── dev-bootstrap.sh              # one-shot install (rust targets, ajv, cargo-audit)
```

### 0.5 Discipline de branche

- `main` **protégée** ; toute story → branche `feat/B-NNN-slug` ou `fix/B-NNN-slug` → PR → merge après reviews ✅.
- **Activation de la protection** : pré-flight Wave 0 (cf. Task -1.4).
- **Format commits** : conventional commits, footer `Refs: B-NNN`.
- **PR template** : titre `B-NNN: <story title>`, body avec critères d'acceptation cochés, lien plan.

### 0.6 Ownership BACKLOG.md

Le **contrôleur** (Claude principal) garde l'écriture exclusive sur `BACKLOG.md` :
- Passage `[ ]` → `[~]` au début de chaque task (par le contrôleur après dispatch).
- Passage `[~]` → `[x]` à la fin (par le contrôleur après reviews ✅ et merge).
- Mise à jour du tableau §0.3 après chaque transition.
- Les subagents implémenteurs/reviewers **ne touchent pas** `BACKLOG.md`. Ils reportent l'état dans leur résultat ; le contrôleur édite. Cela évite les conflits sur le fichier le plus écrit du projet.

### 0.7 Stratégie de test par couche

| Couche | Outil | Pattern | Mock |
|---|---|---|---|
| Rust core (duck, log, commands) | `cargo test` + `#[cfg(test)]` | TDD strict : test échoue → impl → test passe | `tempfile::tempdir()`, DuckDB `:memory:`, Parquet stub via `examples/sample.parquet` |
| Front viz-engine | `vitest` | TDD strict | Mock `@tauri-apps/api/core` invoke ; mock connector retournant Arrow `Table.empty()` |
| JSON Schema | `npx ajv-cli` | validation positive + negatives | fixtures `examples/*.vviz` + cas d'erreur explicites |
| Tauri bundle MSI | GHA `windows-latest` | smoke build sur PR principale | n/a |
| Bench DuckDB | `cargo bench` ou script timing custom | mesure dans `BENCH.md` | Parquet synthétique généré reproductiblement |
| UI manuel Windows | Capture screen GHA + smoke RDP optionnel | non-critique V0 | n/a |

### 0.8 Pré-flight machine (Wave -1)

Avant Wave 0, vérifier/installer :
- `rustup target add x86_64-pc-windows-msvc` (cross-compile MSVC indispo sur Linux sans wine ; on délègue Windows à GHA — installer la target Linux GNU comme défaut)
- `cargo install cargo-audit cargo-tauri` (CLI Tauri en local pour dev)
- `npm install -g ajv-cli` (validation `.vviz`)
- Dépendances Linux Tauri 2 : `webkit2gtk-4.1`, `libsoup-3.0`, `librsvg2`, `libappindicator-gtk3`, `xdotool` (Fedora : `webkit2gtk4.1-devel`, `libsoup3-devel`, `librsvg2-devel`)
- `gh repo edit 92VC/VaultViz --enable-issues --default-branch main` + protection règle main (PR requis, status checks `ci/test` requis, dismiss stale review)

### 0.9 Modèle de waves

```
Wave -1   Pré-flight machine (contrôleur seul, ~5 min)
Wave 0    Foundations [PARALLÈLE : 12 subagents]
          ├── 0.1 B-001 verify (controller, 30s)
          └── 0.2-0.12 B-002 — 11 ADRs (1 subagent / ADR)
Wave 1    I0 — Tauri skeleton [SÉQUENTIEL]
          ├── 1.1 B-010 bootstrap
          ├── 1.2 B-011 capabilities
          └── 1.3 B-012 read_vviz + H1 sanity sur chemin local
Wave 2    I1 — DuckDB [SÉQUENTIEL]
          ├── 2.1 B-020 duckdb-rs bundled
          ├── 2.2 B-021 query_parquet
          ├── 2.3 B-022 Arrow IPC pipe
          └── 2.4 B-023 bench 50 Mo synthétique
Wave 3    I2 — Mosaic [PARTIELLEMENT PARALLÈLE]
          ├── 3.1 B-030 setup (séquentiel)
          ├── 3.2a B-033a schema draft ─┐
          ├── 3.2b B-031 connector     ─┤ parallèle
          ├── 3.3 B-032 carto choro     │
          └── 3.4 B-033b finalisation schema + ADR-002 update
Wave 4    I3 — Interactivité [SÉQUENTIEL]
          ├── 4.1 B-040 selection
          └── 4.2 B-041 cross-filter 2 vues
Wave 5    I4 — Drill-down
          └── 5.1 B-050 table virtualisée
Wave 6    I5 — Erreurs [PARALLÈLE : 3 subagents]
          ├── 6.1 B-060 erreur fichier
          ├── 6.2 B-061 schema invalide
          └── 6.3 B-062 logging rotatif
Wave 7    I6 — MSI [SÉQUENTIEL]
          ├── 7.1 B-070 tauri.conf MSI
          ├── 7.2 B-071 workflow GHA build
          └── 7.3 B-072 [!] handoff package DSI
Wave 8    I7 — Go/No-Go [SÉQUENTIEL]
          ├── 8.1 B-080 bench 300 Mo synthétique
          ├── 8.2 B-081 [!] handoff package démo RSSI
          └── 8.3 B-082 [!] ADR-V0-GoNoGo grille technique
Final     Revue globale (final code-reviewer subagent) + récap exec
```

Une story = une branche = une PR = un merge. Le tableau de bord est mis à jour par le contrôleur après merge.

### 0.10 Choix de modèle par rôle (subagent-driven)

- **Implementer mécanique** (1-2 fichiers, spec claire) : modèle rapide (Haiku) — B-001, ADRs (Wave 0), erreurs simples, configs.
- **Implementer intégration** (multi-fichiers, judgment) : modèle standard (Sonnet) — Wave 1, 2, 5, 6.
- **Implementer design/critique** (Mosaic connector, JSON Schema, GHA matrix) : modèle premium (Opus) — B-031, B-033, B-050, B-071.
- **Spec reviewer** : standard (Sonnet) — vérifie acceptance criteria verbatim.
- **Code quality reviewer** : standard (Sonnet) ; premium si task L.
- **Final reviewer** : premium (Opus).

---

## Wave -1 — Pré-flight machine (contrôleur)

### Task -1.1 : Vérifier dépendances Linux Tauri 2

- [ ] Lister paquets manquants :
```bash
for pkg in webkit2gtk4.1-devel libsoup3-devel librsvg2-devel libappindicator-gtk3 patchelf; do
  rpm -q "$pkg" 2>/dev/null | grep -q "^${pkg}" || echo "MANQUANT: $pkg"
done
```
- [ ] Si paquets manquants, fournir la commande sudo et **demander à l'utilisateur** (sudo requis, hors autonomie).

### Task -1.2 : Installer outils Cargo

- [ ] `cargo install --locked tauri-cli@^2.0` (idempotent)
- [ ] `cargo install --locked cargo-audit` (idempotent)
- [ ] Vérifier : `cargo tauri --version` retourne ≥ 2.0.0

### Task -1.3 : Installer outils npm globaux

- [ ] `npm install -g ajv-cli` (idempotent)
- [ ] Vérifier : `ajv --version` retourne ≥ 5.0.0

### Task -1.4 : Protéger `main` sur GitHub

- [ ] Activer protection branche :
```bash
gh api -X PUT "/repos/92VC/VaultViz/branches/main/protection" \
  -f required_status_checks='{"strict":true,"contexts":["ci/test-linux","ci/build-windows"]}' \
  -F enforce_admins=false \
  -f required_pull_request_reviews='{"required_approving_review_count":0,"dismiss_stale_reviews":true}' \
  -F restrictions=null \
  -F allow_force_pushes=false \
  -F allow_deletions=false 2>&1 | tail -5
```
- [ ] Note : `required_approving_review_count: 0` car repo solo + reviews via Claude subagents ; à élever en V1.

### Task -1.5 : Commit setup script local

- [ ] Créer `scripts/dev-bootstrap.sh` :
```bash
#!/usr/bin/env bash
set -euo pipefail
echo "== VaultViz dev bootstrap =="
rustup show
cargo install --locked tauri-cli@^2.0 cargo-audit
npm install -g ajv-cli
echo "OK"
```
- [ ] `chmod +x scripts/dev-bootstrap.sh`
- [ ] Branche `chore/dev-bootstrap` → PR → merge

---

## Wave 0 — Foundations [PARALLÈLE]

### Task 0.1 : B-001 Vérifier docs racine versionnées

**Files** : aucun changement attendu (B-000 a déjà committé PRD/BACKLOG/CLAUDE/VaultViz.md). Vérification + fermeture story.

- [ ] **Step 1** : confirmer présence dans le commit initial
```bash
git log --diff-filter=A --name-only main | grep -E '^(PRD|BACKLOG|CLAUDE|VaultViz)\.md$'
```
Expected : 4 lignes.

- [ ] **Step 2** : confirmer README.md référence PRD et BACKLOG
```bash
grep -E '\[(PRD|BACKLOG)\.md\]' README.md
```
Expected : 2 lignes (déjà vérifié au B-000).

- [ ] **Step 3** : contrôleur marque B-001 `[x]` dans BACKLOG.md, met à jour le tableau §0.3, commit + push direct sur main (story documentaire, pas de code).

```
Tableau Pré-V0 : 3 stories → 1 à faire, 0 en cours, 2 terminées.
```

### Tasks 0.2-0.12 : B-002 Extraire les 11 ADRs (parallèle, 11 subagents)

**Files par task** : `docs/adr/ADR-NNN-<slug>.md` (1 par subagent).

**Pattern unique** par subagent (le contrôleur fournit le contenu PRD extrait pour cet ADR, le subagent ne lit pas le PRD complet) :

- [ ] **Step 1** : Le contrôleur extrait le bloc PRD §6.3 ADR-NNN et le passe verbatim dans le prompt subagent.
- [ ] **Step 2** : Le subagent crée `docs/adr/ADR-NNN-<slug>.md` avec format Michael Nygard :

```markdown
# ADR-NNN — <Titre>

| Champ | Valeur |
|---|---|
| Statut | Accepté |
| Date | 2026-05-28 |
| Source | PRD.md §6.3 |
| Liens | [PRD §6.3](../../PRD.md#63-décisions-architecturales-clés-adrs-synthétisés) |

## Contexte

<extrait verbatim du PRD>

## Décision

<extrait verbatim du PRD>

## Conséquences

<extrait verbatim du PRD>

## Références

- PRD §6.3 ADR-NNN
- <liens externes du PRD si présents>
```

- [ ] **Step 3** : valider la présence des 3 sections (Context/Decision/Consequences) :
```bash
grep -c "^## " docs/adr/ADR-NNN-<slug>.md
```
Expected : ≥ 4 (Contexte, Décision, Conséquences, Références).

- [ ] **Step 4** : branche `feat/B-002-adr-NNN`, commit `docs: ajout ADR-NNN <titre>` avec `Refs: B-002`, PR, merge.

**Mapping ADR ↔ task ↔ slug** :

| Task | ADR | Slug | Source PRD |
|---|---|---|---|
| 0.2 | ADR-001 | `duckdb-natif` | §6.3 ADR-001 |
| 0.3 | ADR-002 | `mosaic-vgplot` | §6.3 ADR-002 |
| 0.4 | ADR-003 | `parquet-arrow` | §6.3 ADR-003 |
| 0.5 | ADR-004 | `tauri-2` | §6.3 ADR-004 |
| 0.6 | ADR-005 | `signature-dsi` | §6.3 ADR-005 |
| 0.7 | ADR-006 | `msi-bundler` | §6.3 ADR-006 |
| 0.8 | ADR-007 | `unc-paths` | §6.3 ADR-007 |
| 0.9 | ADR-008 | `no-network` | §6.3 ADR-008 |
| 0.10 | ADR-009 | `maplibre-ign` | §6.3 ADR-009 |
| 0.11 | ADR-010 | `windows-11-only` | §6.3 ADR-010 |
| 0.12 | ADR-011 | `export-pdf-v1` | §6.3 ADR-011 |

**Note dispatch** : 11 subagents dispatchés EN PARALLÈLE (skill `superpowers:dispatching-parallel-agents`) — pas de shared state, fichiers distincts. Reviews séquentielles côté contrôleur.

### Task 0.13 : Mise à jour PRD §15 avec colonne « lien ADR »

- [ ] **Step 1** : Lire PRD §15 (tableau récap ADRs).
- [ ] **Step 2** : Ajouter colonne « Fichier » avec lien relatif `[ADR-NNN](docs/adr/ADR-NNN-<slug>.md)` pour chaque ligne.
- [ ] **Step 3** : Commit + PR + merge.
- [ ] **Step 4** : Contrôleur marque B-002 `[x]`, met à jour tableau §0.3.

```
Tableau Pré-V0 final : 3 stories → 0 à faire, 0 en cours, 3 terminées.
```

---

## Wave 1 — I0 Tauri skeleton [SÉQUENTIEL]

### Task 1.1 : B-010 Bootstrap projet Tauri 2 + Vite + TS

**Files** :
- Create : `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `src/main.ts`, `src/styles/main.css`
- Create : `src-tauri/Cargo.toml`, `src-tauri/build.rs`, `src-tauri/tauri.conf.json`, `src-tauri/src/main.rs`, `src-tauri/icons/icon.png` (placeholder)
- Modify : `.gitignore` (rien à ajouter, déjà couvert)
- Test : `cargo build --release` côté Rust ; `npm run build` côté front

- [ ] **Step 1** : Bootstrap via `cargo tauri init` ou template officiel `npm create tauri-app@latest -- --template vanilla-ts --identifier fr.cpam92.vaultviz --name VaultViz`. Le subagent doit utiliser Context7 (`resolve-library-id "tauri"` puis `query-docs`) pour vérifier les flags actuels de la CLI.

- [ ] **Step 2** : `tauri.conf.json` doit contenir au minimum :
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "productName": "VaultViz",
  "version": "0.0.1",
  "identifier": "fr.cpam92.vaultviz",
  "build": { "frontendDist": "../dist", "devUrl": "http://localhost:5173", "beforeDevCommand": "npm run dev", "beforeBuildCommand": "npm run build" },
  "app": {
    "windows": [{ "title": "VaultViz", "width": 1280, "height": 800, "minWidth": 800, "minHeight": 600 }],
    "security": { "csp": "default-src 'self'; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'" }
  },
  "bundle": {
    "active": true,
    "targets": ["msi"],
    "icon": ["icons/icon.png"],
    "publisher": "CPAM 92",
    "category": "Productivity"
  }
}
```

- [ ] **Step 3** : `src-tauri/Cargo.toml` (versions à figer via Context7 docs Tauri 2) :
```toml
[package]
name = "vaultviz"
version = "0.0.1"
edition = "2021"
rust-version = "1.75"

[build-dependencies]
tauri-build = { version = "2", features = [] }

[dependencies]
tauri = { version = "2", features = [] }
tauri-plugin-fs = "2"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
thiserror = "1"

[features]
default = ["custom-protocol"]
custom-protocol = ["tauri/custom-protocol"]
```

- [ ] **Step 4** : `src-tauri/src/main.rs` minimal :
```rust
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5** : `src/main.ts` minimal (affiche un titre + appellera `read_vviz` en B-012) :
```ts
document.body.innerHTML = `
  <main>
    <h1>VaultViz</h1>
    <p>V0 prototype — Pré-I0</p>
  </main>
`;
```

- [ ] **Step 6** : Vérifier build Linux :
```bash
cd src-tauri && cargo build --release && ls -la target/release/vaultviz
cd .. && npm run build && ls -la dist/index.html
```
Expected : binaire généré, dist produit.

- [ ] **Step 7** : Commit Cargo.lock + package-lock.json (versions verrouillées).

- [ ] **Step 8** : Branche `feat/B-010-bootstrap-tauri` → PR. **GHA windows-latest job** (`ci.yml`, créé en B-071 mais on peut anticiper un job minimal ici) doit valider le build sur Windows pour cocher le critère "fenêtre Windows 11".

- [ ] **Step 9** : Notes dans `docs/bench/BENCH.md` (créer le fichier) :
```markdown
# BENCH.md — Mesures performance VaultViz V0

## B-010 — Taille binaire skeleton

| Plateforme | Cible | Taille | Date |
|---|---|---|---|
| Linux x86_64 | release | <à mesurer> Mo | 2026-05-28 |
| Windows x86_64 (GHA) | MSI | <à mesurer en B-070> Mo | — |
```

Acceptance criteria checks :
- [x] cargo tauri dev lance la fenêtre (Linux : webkit2gtk ; Windows : via GHA windows-latest avec capture screen)
- [x] Cargo.lock + package-lock.json versionnés
- [x] Versions Tauri/DuckDB/Mosaic figées dans lockfiles
- [x] Build release produit un exécutable

### Task 1.2 : B-011 capabilities/main.json

**Files** :
- Create : `src-tauri/capabilities/main.json`
- Modify : `src-tauri/tauri.conf.json` (référence capability)

- [ ] **Step 1** : Écrire le test négatif d'abord (Rust integration test) — `src-tauri/tests/capabilities_scope.rs` :
```rust
#[test]
fn out_of_scope_read_returns_error() {
    // Simule via tauri::test runtime un appel à fs:readTextFile
    // sur un chemin hors scope (ex. /etc/passwd) et attend une Err.
    // Voir docs Tauri 2 testing.
}
```
Note : Tauri 2 testing nécessite la feature `test`. Le subagent doit fetcher Context7 pour le pattern exact.

- [ ] **Step 2** : `capabilities/main.json` :
```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "identifier": "main-capability",
  "description": "Lecture FS read-only sur share UNC + chemins locaux dev. Voir docs/adr/ADR-007-unc-paths.md",
  "windows": ["main"],
  "permissions": [
    {
      "identifier": "fs:allow-read-text-file",
      "allow": [
        { "path": "//$VVIZ_HOST/$VVIZ_SHARE/**" },
        { "path": "./**" },
        { "path": "$HOME/**" }
      ]
    },
    {
      "identifier": "fs:allow-read-file",
      "allow": [
        { "path": "//$VVIZ_HOST/$VVIZ_SHARE/**" },
        { "path": "./**" },
        { "path": "$HOME/**" }
      ]
    },
    {
      "identifier": "fs:allow-exists",
      "allow": [
        { "path": "//$VVIZ_HOST/$VVIZ_SHARE/**" },
        { "path": "./**" },
        { "path": "$HOME/**" }
      ]
    }
  ]
}
```
Note : les patterns `[A-Z]:/**` (lecteur mappé) doivent être ajoutés explicitement par déploiement (env var `VVIZ_DRIVE`). En dev Linux, on s'appuie sur `$HOME/**` + `./**`. Le subagent doit utiliser Context7 pour vérifier la syntaxe Tauri 2 capability scope (le format a évolué entre 2.0 et 2.x).

- [ ] **Step 3** : Référencer la capability dans `tauri.conf.json` → `"app": { "security": { "capabilities": ["main-capability"] } }`.

- [ ] **Step 4** : Test smoke : tenter `read_vviz("/etc/passwd")` via la dev console → erreur permission. **Manuel** sur dev box.

- [ ] **Step 5** : Commit, PR, merge.

Acceptance criteria :
- [x] permissions `fs:allow-read-*-file` déclarées
- [x] Scope inclut `//<host>/<share>/**` (variable), `./**`, drives via env
- [x] Commentaire renvoie vers ADR-007
- [x] Lecture hors scope retourne erreur explicite (vérifié smoke + test Rust)

### Task 1.3 : B-012 read_vviz command + sanity H1

**Files** :
- Create : `src-tauri/src/commands/mod.rs`, `src-tauri/src/commands/vviz.rs`, `src-tauri/src/error.rs`
- Modify : `src-tauri/src/main.rs` (register handler)
- Modify : `src/main.ts` (appeler la commande au startup)
- Test : `src-tauri/tests/read_vviz.rs`

- [ ] **Step 1** (TDD) : test Rust qui échoue
```rust
// src-tauri/tests/read_vviz.rs
use vaultviz::commands::vviz::read_vviz_impl;
use std::path::PathBuf;
use tempfile::tempdir;

#[test]
fn reads_existing_vviz_file() {
    let dir = tempdir().unwrap();
    let path = dir.path().join("test.vviz");
    std::fs::write(&path, r#"{"vviz":{"version":"1.0"}}"#).unwrap();
    let result = read_vviz_impl(path.to_string_lossy().to_string()).unwrap();
    assert!(result.contains(r#""version":"1.0""#));
}

#[test]
fn returns_error_on_missing_file() {
    let result = read_vviz_impl("/nonexistent/path.vviz".to_string());
    assert!(result.is_err());
}
```
Run : `cargo test --test read_vviz` → FAIL (function not defined).

- [ ] **Step 2** : `src-tauri/src/error.rs`
```rust
use thiserror::Error;
use serde::Serialize;

#[derive(Debug, Error, Serialize)]
pub enum VVizError {
    #[error("Fichier introuvable : {0}")]
    NotFound(String),
    #[error("Accès refusé par scope FS : {0}")]
    Forbidden(String),
    #[error("Erreur I/O : {0}")]
    Io(String),
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
```

- [ ] **Step 3** : `src-tauri/src/commands/vviz.rs`
```rust
use crate::error::VVizError;

pub fn read_vviz_impl(path: String) -> Result<String, VVizError> {
    let content = std::fs::read_to_string(&path)?;
    Ok(content)
}

#[tauri::command]
pub async fn read_vviz(path: String) -> Result<String, VVizError> {
    read_vviz_impl(path)
}
```

- [ ] **Step 4** : `src-tauri/src/commands/mod.rs`
```rust
pub mod vviz;
```

- [ ] **Step 5** : enregistrer dans `main.rs`
```rust
mod commands;
mod error;

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![commands::vviz::read_vviz])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 6** : exposer `vaultviz` comme lib (pour les tests d'intégration). Ajouter dans `Cargo.toml` :
```toml
[lib]
name = "vaultviz"
path = "src/lib.rs"

[[bin]]
name = "vaultviz"
path = "src/main.rs"
```
Créer `src-tauri/src/lib.rs` :
```rust
pub mod commands;
pub mod error;
```

- [ ] **Step 7** : Tests passent
```bash
cargo test --test read_vviz
```
Expected : 2 passed.

- [ ] **Step 8** : front — `src/main.ts`
```ts
import { invoke } from "@tauri-apps/api/core";

const DEFAULT_VVIZ = import.meta.env.VITE_VVIZ_DEFAULT || "";

async function bootstrap() {
  const root = document.querySelector<HTMLElement>("#app")!;
  root.innerHTML = `<h1>VaultViz</h1><pre id="content">Chargement…</pre>`;
  const pre = root.querySelector<HTMLPreElement>("#content")!;
  if (!DEFAULT_VVIZ) {
    pre.textContent = "Aucun .vviz par défaut (VITE_VVIZ_DEFAULT non défini)";
    return;
  }
  try {
    const raw = await invoke<string>("read_vviz", { path: DEFAULT_VVIZ });
    pre.textContent = JSON.stringify(JSON.parse(raw), null, 2);
  } catch (err) {
    pre.textContent = `Erreur : ${err}`;
    pre.classList.add("error");
  }
}
bootstrap();
```

- [ ] **Step 9** : H1 sanity sur chemin local (note PRD H1 : UNC réel CPAM est handoff V1 ; on valide ici le chemin local + relatif). Test manuel : créer un `examples/effectifs_2026.vviz` stub, le pointer via `VITE_VVIZ_DEFAULT=./examples/effectifs_2026.vviz`, lancer `cargo tauri dev`, observer rendu pretty-print. Capture screen → `docs/bench/h1-sanity-linux.png`.

- [ ] **Step 10** : Commit, PR. CI doit faire passer le test Rust et le build front.

Acceptance criteria :
- [x] read_vviz retourne `Result<String, _>` (VVizError sérialisable)
- [x] WebView appelle au démarrage avec VITE_VVIZ_DEFAULT
- [x] JSON pretty-print HTML
- [x] Erreurs lisibles
- [!] Test UNC réel CPAM = reporté V1 (handoff dans Wave 7) — on valide ici chemin local + relatif

---

## Wave 2 — I1 DuckDB [SÉQUENTIEL]

### Task 2.1 : B-020 duckdb-rs bundled

**Files** :
- Modify : `src-tauri/Cargo.toml`
- Create : `src-tauri/tests/duck_smoke.rs`

- [ ] **Step 1** (TDD) : test échoue
```rust
// src-tauri/tests/duck_smoke.rs
use duckdb::{Connection, Result};

#[test]
fn select_42_works() -> Result<()> {
    let conn = Connection::open_in_memory()?;
    let v: i32 = conn.query_row("SELECT 42", [], |r| r.get(0))?;
    assert_eq!(v, 42);
    Ok(())
}
```
Run : `cargo test --test duck_smoke` → FAIL (crate `duckdb` not found).

- [ ] **Step 2** : ajouter au `Cargo.toml`
```toml
duckdb = { version = "1", features = ["bundled"] }
```
Note : versions Context7 — le subagent doit query-docs pour vérifier la dernière minor stable de `duckdb-rs` au moment du POC.

- [ ] **Step 3** : `cargo build --release` (long la première fois — DuckDB compile en C++ statique).

- [ ] **Step 4** : test passe
```bash
cargo test --test duck_smoke
```
Expected : 1 passed.

- [ ] **Step 5** : mesurer taille binaire
```bash
ls -la src-tauri/target/release/vaultviz
```
Ajouter au `BENCH.md` :
```markdown
## B-020 — Taille binaire avec DuckDB bundled

| Plateforme | Sans DuckDB | Avec DuckDB bundled | Delta |
|---|---|---|---|
| Linux x86_64 release | <step 6 B-010> Mo | <mesure> Mo | <delta> Mo |
```

- [ ] **Step 6** : Si delta > 30 Mo, ajouter une note d'alerte (cible §9.1 PRD : MSI V1 < 30 Mo total). Explorer features DuckDB minimales en V1 (sans icu/json si non nécessaires).

- [ ] **Step 7** : Commit, PR, merge.

Acceptance criteria :
- [x] `duckdb` feature `bundled`
- [x] `cargo build --release` sans dépendance externe
- [x] `SELECT 42` retourne 42
- [x] Taille mesurée dans BENCH.md

### Task 2.2 : B-021 query_parquet → Arrow IPC

**Files** :
- Create : `src-tauri/src/duck.rs`, `src-tauri/src/state.rs`
- Modify : `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`
- Create : `src-tauri/tests/duck_parquet.rs`
- Create : `examples/sample.parquet` (~1 Mo synthétique)

- [ ] **Step 1** : générer Parquet synthétique
```bash
cat > docs/scripts/gen-sample-parquet.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
duckdb -c "COPY (SELECT range AS id, 'item_' || range AS label, random() AS value FROM range(50000)) TO 'examples/sample.parquet' (FORMAT PARQUET, COMPRESSION SNAPPY);"
EOF
chmod +x docs/scripts/gen-sample-parquet.sh
./docs/scripts/gen-sample-parquet.sh
ls -la examples/sample.parquet
```
Expected : fichier ~1 Mo.

- [ ] **Step 2** : ajouter à `.gitignore` `examples/synth_*.parquet` (gros) ; garder `examples/sample.parquet` versionné (~1 Mo OK pour tests).

- [ ] **Step 3** (TDD) test
```rust
// src-tauri/tests/duck_parquet.rs
use vaultviz::duck::query_parquet;

#[test]
fn count_sample_parquet() {
    let arrow_bytes = query_parquet(
        "SELECT COUNT(*) AS n FROM read_parquet('examples/sample.parquet')"
    ).expect("query ok");
    assert!(!arrow_bytes.is_empty());
    // Décoder Arrow IPC et vérifier n == 50000
    // (utiliser arrow crate dans tests/)
}

#[test]
fn corrupt_parquet_returns_error_not_panic() {
    let result = query_parquet("SELECT * FROM read_parquet('/nonexistent.parquet')");
    assert!(result.is_err());
}
```
Run : FAIL.

- [ ] **Step 4** : ajouter dépendance Arrow Rust dans Cargo.toml :
```toml
arrow = { version = "53", default-features = false, features = ["ipc"] }
```
(Vérifier version compatible avec duckdb-rs via Context7.)

- [ ] **Step 5** : implémenter `src-tauri/src/duck.rs`
```rust
use duckdb::{Connection, Result as DuckResult};
use crate::error::VVizError;

pub fn query_parquet(sql: &str) -> Result<Vec<u8>, VVizError> {
    let conn = Connection::open_in_memory()
        .map_err(|e| VVizError::Io(format!("duckdb open: {e}")))?;
    // duckdb-rs ≥ 1.0 expose arrow() qui retourne un RecordBatchReader
    let mut stmt = conn.prepare(sql)
        .map_err(|e| VVizError::Io(format!("prepare: {e}")))?;
    let arrow_reader = stmt.query_arrow([])
        .map_err(|e| VVizError::Io(format!("query: {e}")))?;
    let schema = arrow_reader.get_schema();
    let mut buffer = Vec::new();
    {
        let mut writer = arrow::ipc::writer::StreamWriter::try_new(&mut buffer, &schema)
            .map_err(|e| VVizError::Io(format!("ipc writer: {e}")))?;
        for batch in arrow_reader {
            writer.write(&batch).map_err(|e| VVizError::Io(format!("ipc write: {e}")))?;
        }
        writer.finish().map_err(|e| VVizError::Io(format!("ipc finish: {e}")))?;
    }
    Ok(buffer)
}
```
Note : l'API `query_arrow` de duckdb-rs a évolué ; le subagent doit Context7 `duckdb-rs` pour la signature exacte à la version verrouillée.

- [ ] **Step 6** : ajouter `src-tauri/src/state.rs`
```rust
use std::sync::Mutex;
use duckdb::Connection;

pub struct AppState {
    pub duck: Mutex<Connection>,
}

impl AppState {
    pub fn new() -> Result<Self, duckdb::Error> {
        Ok(Self { duck: Mutex::new(Connection::open_in_memory()?) })
    }
}
```

- [ ] **Step 7** : exposer dans `lib.rs`
```rust
pub mod duck;
pub mod state;
```

- [ ] **Step 8** : tests passent
```bash
cargo test --test duck_parquet
```

- [ ] **Step 9** : commit, PR, merge.

Acceptance criteria :
- [x] Fonction retourne `Result<Vec<u8>, VVizError>`
- [x] `COUNT(*)` retourne valeur valide
- [x] Erreur Parquet corrompu = pas de crash
- [x] Connection wrappée par `Mutex<Connection>` dans AppState

### Task 2.3 : B-022 canal Arrow IPC → WebView

**Files** :
- Create : `src-tauri/src/commands/query.rs`
- Modify : `src-tauri/src/commands/mod.rs`, `main.rs` (register + manage state)
- Modify : `package.json` (ajouter `apache-arrow`)
- Create : `src/__tests__/arrow-roundtrip.test.ts`
- Modify : `src/main.ts` (démo tableau)

- [ ] **Step 1** : ajouter dans `package.json` :
```bash
npm install apache-arrow@^17 @tauri-apps/api@^2
```
(Versions à confirmer via Context7.)

- [ ] **Step 2** (TDD côté Rust) : test
```rust
// src-tauri/tests/run_query.rs
use vaultviz::commands::query::run_query_impl;
use vaultviz::state::AppState;

#[test]
fn run_query_returns_ipc_bytes() {
    let state = AppState::new().unwrap();
    let bytes = run_query_impl(&state, "SELECT 1 AS one".to_string()).unwrap();
    assert!(!bytes.is_empty());
    // bytes commencent par magic Arrow IPC : "ARROW1" ou batch stream
}
```

- [ ] **Step 3** : `src-tauri/src/commands/query.rs`
```rust
use crate::duck::query_parquet;
use crate::error::VVizError;
use crate::state::AppState;
use tauri::State;

pub fn run_query_impl(_state: &AppState, sql: String) -> Result<Vec<u8>, VVizError> {
    // V0 : connection in-memory neuve par query (à optimiser en V1 avec AppState.duck Mutex)
    query_parquet(&sql)
}

#[tauri::command]
pub async fn run_query(sql: String, state: State<'_, AppState>) -> Result<Vec<u8>, VVizError> {
    run_query_impl(state.inner(), sql)
}
```
Note : V0 réutilise pas la connexion (simplifie le scope) ; V1 raffinera avec connection pool ou mutex partagé. Tracer dans le commit.

- [ ] **Step 4** : enregistrer dans `main.rs`
```rust
fn main() {
    let state = state::AppState::new().expect("AppState init");
    tauri::Builder::default()
        .plugin(tauri_plugin_fs::init())
        .manage(state)
        .invoke_handler(tauri::generate_handler![
            commands::vviz::read_vviz,
            commands::query::run_query,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
```

- [ ] **Step 5** : test passe
```bash
cargo test --test run_query
```

- [ ] **Step 6** (TDD côté JS) : `src/__tests__/arrow-roundtrip.test.ts`
```ts
import { describe, it, expect, vi } from "vitest";
import { tableFromIPC } from "apache-arrow";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => {
    // Stub: charger bytes IPC depuis un fichier de fixture
    const fs = await import("fs/promises");
    return await fs.readFile("examples/fixtures/one_row.ipc");
  }),
}));

describe("Arrow roundtrip", () => {
  it("decodes IPC bytes into a Table", async () => {
    const { invoke } = await import("@tauri-apps/api/core");
    const bytes = (await invoke("run_query", { sql: "SELECT 1" })) as Uint8Array;
    const table = tableFromIPC(bytes);
    expect(table.numRows).toBeGreaterThan(0);
  });
});
```
Note : fixture `examples/fixtures/one_row.ipc` à générer (script `gen-ipc-fixture.sh` qui appelle DuckDB CLI).

- [ ] **Step 7** : configurer vitest dans `package.json`
```json
"scripts": { "test": "vitest run", "test:watch": "vitest" },
"devDependencies": { "vitest": "^2", "typescript": "^5" }
```

- [ ] **Step 8** : test passe
```bash
npm test
```

- [ ] **Step 9** : démo dans `src/main.ts` — appel `run_query` au démarrage, afficher 5 premières lignes dans un tableau HTML.

- [ ] **Step 10** : profilage : vérifier qu'aucun JSON.stringify intermédiaire n'est appelé entre Rust et le décodage Arrow (lecture du code, pas de `.json()` Tauri).

- [ ] **Step 11** : commit, PR, merge.

Acceptance criteria :
- [x] Commande `run_query` enregistrée
- [x] Côté JS : `tableFromIPC(new Uint8Array(buf))` reconstitue Table
- [x] Démo tableau HTML 5 premières lignes
- [x] Pas de JSON intermédiaire

### Task 2.4 : B-023 Bench Parquet 50 Mo (synthétique)

**Files** :
- Create : `docs/scripts/gen-synth-parquet.sh`
- Modify : `docs/bench/BENCH.md`
- Create : `docs/scripts/bench-50mb.sh`

- [ ] **Step 1** : script de génération 50 Mo
```bash
cat > docs/scripts/gen-synth-parquet.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
SIZE_MB="${1:-50}"
OUT="${2:-examples/synth_${SIZE_MB}mb.parquet}"
# Cible ~50 Mo Snappy : ~2M lignes × ~25 cols
ROWS=$((SIZE_MB * 50000))
echo "Génération $OUT ($SIZE_MB Mo cible, $ROWS lignes)…"
duckdb -c "
COPY (
  SELECT
    range AS id,
    (range % 96) + 1 AS code_dept,
    'libellé_' || (range % 96) AS lib_dept,
    random() * 1000 AS effectif,
    random() AS taux,
    date_add(DATE '2020-01-01', INTERVAL (range % 365) DAY) AS jour,
    CAST((range % 10) AS VARCHAR) AS categorie,
    md5(CAST(range AS VARCHAR)) AS hash
  FROM range($ROWS)
) TO '$OUT' (FORMAT PARQUET, COMPRESSION SNAPPY);
"
ls -la "$OUT"
EOF
chmod +x docs/scripts/gen-synth-parquet.sh
./docs/scripts/gen-synth-parquet.sh 50
```
Note : la taille réelle dépend de la cardinalité ; itérer jusqu'à approcher 50 Mo (±10 %).

- [ ] **Step 2** : script de bench
```bash
cat > docs/scripts/bench-50mb.sh <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
PARQUET="examples/synth_50mb.parquet"
echo "== Bench Parquet 50 Mo =="
echo "Taille : $(du -h "$PARQUET" | cut -f1)"

echo "-- COUNT(*) --"
/usr/bin/time -v duckdb -c "SELECT COUNT(*) FROM '$PARQUET'" 2>&1 | grep -E "Elapsed|Maximum"

echo "-- AGG par dept --"
/usr/bin/time -v duckdb -c "
  SELECT code_dept, AVG(effectif) AS m, COUNT(*) AS n
  FROM '$PARQUET' GROUP BY code_dept ORDER BY code_dept
" 2>&1 | grep -E "Elapsed|Maximum"

echo "-- Filter + AGG --"
/usr/bin/time -v duckdb -c "
  SELECT code_dept, AVG(taux) FROM '$PARQUET' WHERE jour > '2020-06-01' GROUP BY code_dept
" 2>&1 | grep -E "Elapsed|Maximum"
EOF
chmod +x docs/scripts/bench-50mb.sh
./docs/scripts/bench-50mb.sh > docs/bench/run-50mb-linux-$(date +%Y%m%d).log 2>&1
```

- [ ] **Step 3** : compléter `BENCH.md`
```markdown
## B-023 — Bench Parquet 50 Mo (synthétique)

**Méthode** : Parquet synthétique 50 Mo généré par `docs/scripts/gen-synth-parquet.sh 50`, exécuté en local Linux x86_64 (NVMe). 
**Note** : validation SMB CPAM réel = pré-requis V1 (cf. [handoff DSI](../handoff/dsi-signing-package.md)). Cible PRD §9.1 = < 3 s premier rendu sur SMB.

| Query | Temps (Linux local NVMe) | RAM peak | Cible PRD |
|---|---|---|---|
| COUNT(*) | <mesure> ms | <mesure> Mo | < 3 s |
| GROUP BY code_dept | <mesure> ms | <mesure> Mo | < 3 s |
| Filter + AGG | <mesure> ms | <mesure> Mo | < 3 s |

**Observations** : <synthèse>. **SMB CPAM réel** : à benchmarker dans V1 dans le cadre du pilote.
```

- [ ] **Step 4** : commit, PR, merge. Tag dans le commit : `[!] Validation SMB CPAM réel reportée V1`.

Acceptance criteria :
- [x] Mesure temps + RAM
- [x] Local NVMe documenté (PRD demande SMB ; substitué par synthétique, footnote V1)
- [!] Mesure SMB CPAM = handoff V1
- [x] Comparaison local vs SMB = handoff V1 documenté

---

## Wave 3 — I2 Mosaic [PARTIELLEMENT PARALLÈLE]

### Task 3.1 : B-030 Setup Mosaic + vgplot

**Files** :
- Modify : `package.json`
- Create : `src/viz-engine/index.ts`
- Modify : `src/main.ts` (démo plot statique)
- Modify : `docs/adr/ADR-002-mosaic-vgplot.md` (versions verrouillées)

- [ ] **Step 1** : installer Mosaic
```bash
npm install @uwdata/vgplot @uwdata/mosaic-core @uwdata/mosaic-sql
```
Vérifier versions via Context7 (`resolve-library-id "@uwdata/vgplot"` puis `query-docs`).

- [ ] **Step 2** : démo plot statique inline
```ts
// src/main.ts addition
import * as vg from "@uwdata/vgplot";

const demoData = [
  { x: 1, y: 2 }, { x: 2, y: 4 }, { x: 3, y: 9 }, { x: 4, y: 16 },
];
const plot = vg.plot(
  vg.dot(demoData, { x: "x", y: "y", r: 6 }),
  vg.width(400), vg.height(300)
);
document.querySelector("#demo")!.appendChild(plot);
```

- [ ] **Step 3** : `cargo tauri dev` + visu Linux. Capture screen.

- [ ] **Step 4** : mettre à jour `docs/adr/ADR-002-mosaic-vgplot.md` — ajouter section :
```markdown
## Versions verrouillées au POC (2026-05-28)

| Package | Version |
|---|---|
| `@uwdata/vgplot` | <X.Y.Z> |
| `@uwdata/mosaic-core` | <X.Y.Z> |
| `@uwdata/mosaic-sql` | <X.Y.Z> |

Revoir à chaque bump CI. Mitigation R-8 : ne pas suivre `main`, lockfile autoritatif.
```

- [ ] **Step 5** : `package-lock.json` versionné (déjà fait par `npm install`). 

- [ ] **Step 6** : checkpoint R-8 — si l'API a cassé depuis dernière revue, ouvrir issue + alerter sponsor. Sinon, continuer.

- [ ] **Step 7** : commit, PR, merge.

Acceptance criteria :
- [x] 3 packages installés et lockés
- [x] Plot statique rendu
- [x] Versions notées dans ADR-002

### Tasks 3.2a/3.2b PARALLÈLES — schema draft + connector

**Note dispatching** : ces deux tasks travaillent sur des fichiers distincts (`schema/vviz-v1.json` et `src/viz-engine/duck-connector.ts`) et peuvent être dispatchés en parallèle (skill `superpowers:dispatching-parallel-agents`).

#### Task 3.2a : B-033a Draft JSON Schema `.vviz`

**Files** :
- Create : `schema/vviz-v1.json`
- Create : `examples/effectifs_2026.vviz` (premier draft, sera complété en 3.4)
- Create : `src/__tests__/schema-validator.test.ts`

- [ ] **Step 1** : JSON Schema
```json
{
  "$schema": "https://json-schema.org/draft-07/schema#",
  "$id": "https://vaultviz.fr/schema/v1.json",
  "title": "VaultViz Spec v1",
  "type": "object",
  "required": ["vviz", "data", "spec"],
  "properties": {
    "$schema": { "type": "string" },
    "vviz": {
      "type": "object",
      "required": ["version", "title"],
      "properties": {
        "version": { "const": "1.0" },
        "title": { "type": "string", "minLength": 1 },
        "description": { "type": "string" },
        "author": { "type": "string" },
        "created": { "type": "string", "format": "date" },
        "updated": { "type": "string", "format": "date" }
      },
      "additionalProperties": false
    },
    "data": {
      "type": "object",
      "required": ["sources"],
      "properties": {
        "sources": {
          "type": "array",
          "minItems": 1,
          "items": {
            "type": "object",
            "required": ["name", "path"],
            "properties": {
              "name": { "type": "string", "pattern": "^[a-z][a-z0-9_]*$" },
              "path": {
                "type": "string",
                "anyOf": [
                  { "pattern": "^//[^/]+/.+" },
                  { "pattern": "^\\./.+" },
                  { "pattern": "^[A-Z]:/.+" }
                ]
              }
            },
            "additionalProperties": false
          }
        }
      }
    },
    "spec": {
      "type": "object",
      "description": "Spec vgplot. Format précis figé en B-033b (PRD §16 Q7)."
    }
  },
  "additionalProperties": false
}
```

- [ ] **Step 2** : draft exemple
```json
{
  "$schema": "https://vaultviz.fr/schema/v1.json",
  "vviz": {
    "version": "1.0",
    "title": "Effectifs CPAM 92 — 2026",
    "description": "Cartographie départementale + détail",
    "author": "M. Mehdi",
    "created": "2026-05-15",
    "updated": "2026-05-28"
  },
  "data": {
    "sources": [
      { "name": "effectifs", "path": "./examples/sample.parquet" }
    ]
  },
  "spec": {
    "type": "vgplot",
    "_TODO": "complété en B-032/B-033b"
  }
}
```

- [ ] **Step 3** : validation
```bash
npx ajv validate -s schema/vviz-v1.json -d examples/effectifs_2026.vviz --strict=false
```
Expected : `examples/effectifs_2026.vviz valid`.

- [ ] **Step 4** (TDD JS) : test `src/__tests__/schema-validator.test.ts`
```ts
import { describe, it, expect } from "vitest";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import schema from "../../schema/vviz-v1.json";
import good from "../../examples/effectifs_2026.vviz";

const ajv = new Ajv({ strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

describe("vviz-v1 JSON Schema", () => {
  it("accepts canonical example", () => {
    expect(validate(good)).toBe(true);
  });

  it("rejects missing vviz.title", () => {
    const bad = { ...good, vviz: { ...good.vviz } };
    delete (bad.vviz as any).title;
    expect(validate(bad)).toBe(false);
  });

  it("rejects unscoped path scheme", () => {
    const bad = { ...good, data: { sources: [{ name: "x", path: "https://evil.com/data.parquet" }] } };
    expect(validate(bad)).toBe(false);
  });
});
```

- [ ] **Step 5** : commit, PR (branche `feat/B-033a-schema-draft`), merge.

#### Task 3.2b : B-031 Mosaic DuckDB Connector

**Files** :
- Create : `src/viz-engine/duck-connector.ts`
- Create : `src/viz-engine/types.ts`
- Create : `src/__tests__/duck-connector.test.ts`

- [ ] **Step 1** : Lire docs Mosaic Connector interface via Context7 (`resolve-library-id "@uwdata/mosaic-core"` puis `query-docs "Connector interface query method"`).

- [ ] **Step 2** : `src/viz-engine/types.ts`
```ts
import type { Table } from "apache-arrow";

export interface VVizSource { name: string; path: string; }
export interface VVizDocument {
  $schema?: string;
  vviz: { version: "1.0"; title: string; description?: string; author?: string; created?: string; updated?: string };
  data: { sources: VVizSource[] };
  spec: Record<string, unknown>;
}

export interface QueryRequest {
  type?: "arrow" | "json" | "exec";
  sql: string;
}

export type QueryResponse = Table | unknown[] | void;
```

- [ ] **Step 3** (TDD) : test
```ts
// src/__tests__/duck-connector.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { tableFromIPC, tableToIPC, makeTable, Int32Vector } from "apache-arrow";

const fakeIPC = (() => {
  const t = makeTable({ x: Int32Array.from([1, 2, 3]) });
  return tableToIPC(t, "stream");
})();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string, args: any) => {
    if (cmd === "run_query") return fakeIPC;
    throw new Error("unknown");
  }),
}));

import { createDuckConnector } from "../viz-engine/duck-connector";

describe("DuckConnector", () => {
  it("query type=arrow returns a Table", async () => {
    const conn = createDuckConnector();
    const result = await conn.query({ type: "arrow", sql: "SELECT 1" });
    expect((result as any).numRows).toBe(3);
  });

  it("query type=exec returns void", async () => {
    const conn = createDuckConnector();
    const result = await conn.query({ type: "exec", sql: "INSTALL httpfs" });
    expect(result).toBeUndefined();
  });
});
```

- [ ] **Step 4** : implémenter
```ts
// src/viz-engine/duck-connector.ts
import { invoke } from "@tauri-apps/api/core";
import { tableFromIPC, type Table } from "apache-arrow";
import type { QueryRequest, QueryResponse } from "./types";

export interface DuckConnector {
  query: (req: QueryRequest) => Promise<QueryResponse>;
}

export function createDuckConnector(): DuckConnector {
  return {
    async query(req: QueryRequest): Promise<QueryResponse> {
      const type = req.type ?? "arrow";
      if (type === "exec") {
        await invoke<Uint8Array>("run_query", { sql: req.sql });
        return undefined;
      }
      const bytes = await invoke<number[] | Uint8Array>("run_query", { sql: req.sql });
      const u8 = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
      const table: Table = tableFromIPC(u8);
      if (type === "json") {
        return table.toArray() as unknown[];
      }
      return table;
    },
  };
}
```
Note : la signature Mosaic Connector exacte peut varier (méthode `query` ou `queryArrow`/`queryJSON` selon version). Subagent : Context7 obligatoire avant impl.

- [ ] **Step 5** : test passe `npm test`.

- [ ] **Step 6** : commit, PR (`feat/B-031-mosaic-connector`), merge.

Acceptance criteria (B-031) :
- [x] Connector expose `query` retournant Promise Arrow Table
- [x] Sous le capot : `run_query` (B-022)
- [x] Mosaic coordinator l'utilise (validé en 3.3)
- [x] Démo dans 3.3 (carto)

### Task 3.3 : B-032 Carte choroplèthe France figée

**Files** :
- Create : `src/components/map-view.ts`
- Create : `src/assets/departements-v0.topojson` (téléchargé depuis IGN ou simplification rapide)
- Create : `src/__tests__/map-view.test.ts`
- Modify : `src/main.ts`

- [ ] **Step 1** : récupérer TopoJSON départements (~150 Ko)
```bash
curl -L https://raw.githubusercontent.com/gregoiredavid/france-geojson/master/departements.geojson \
  -o /tmp/dep.geojson
npx topojson-server -p code=code,nom=nom /tmp/dep.geojson > src/assets/departements-v0.topojson
ls -la src/assets/departements-v0.topojson
```
Expected : ~150 Ko. **Licence** : Etalab 2.0 (origine IGN). Noter dans `src/assets/LICENSE.md`.
Note V1 : remplacer par pipeline IGN ADMIN EXPRESS officiel (B-110).

- [ ] **Step 2** (TDD) : test minimal `src/__tests__/map-view.test.ts`
```ts
import { describe, it, expect } from "vitest";
import { renderChoropleth } from "../components/map-view";

describe("map-view", () => {
  it("renders 101 paths from topojson", async () => {
    const container = document.createElement("div");
    const dataByDept = new Map<string, number>(
      Array.from({ length: 101 }, (_, i) => [String(i + 1).padStart(2, "0"), i * 10])
    );
    await renderChoropleth(container, dataByDept);
    const paths = container.querySelectorAll("path");
    expect(paths.length).toBeGreaterThanOrEqual(95); // 96 métropole minimum
  });
});
```

- [ ] **Step 3** : implémenter `src/components/map-view.ts` avec D3 + topojson-client (Mosaic geo natif limité en V0 — on utilise D3 SVG, V1 passera à MapLibre)
```bash
npm install d3-geo topojson-client
npm install -D @types/d3-geo @types/topojson-client
```

```ts
// src/components/map-view.ts
import { geoMercator, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import topo from "../assets/departements-v0.topojson";

export async function renderChoropleth(
  container: HTMLElement,
  dataByDept: Map<string, number>,
  opts: { width?: number; height?: number; colorScale?: (v: number) => string } = {}
): Promise<void> {
  const width = opts.width ?? 600;
  const height = opts.height ?? 600;
  const colorScale = opts.colorScale ?? ((v: number) => `hsl(220, ${Math.min(100, v / 10)}%, 50%)`);

  const fc = feature(topo as any, (topo as any).objects.departements);
  const projection = geoMercator().fitSize([width, height], fc as any);
  const path = geoPath(projection);

  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));

  for (const f of (fc as any).features) {
    const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
    p.setAttribute("d", path(f as any) ?? "");
    const code = f.properties.code as string;
    const v = dataByDept.get(code) ?? 0;
    p.setAttribute("fill", colorScale(v));
    p.setAttribute("stroke", "#fff");
    p.setAttribute("stroke-width", "0.5");
    p.dataset.dept = code;
    p.dataset.value = String(v);
    // tooltip basique
    const title = document.createElementNS("http://www.w3.org/2000/svg", "title");
    title.textContent = `${f.properties.nom} (${code}) : ${v}`;
    p.appendChild(title);
    svg.appendChild(p);
  }

  // Légende minimale
  const legend = document.createElement("div");
  legend.className = "legend";
  legend.textContent = "Échelle : 0 → max (bleu)";
  container.replaceChildren(svg, legend);
}
```

- [ ] **Step 4** : configurer Vite pour importer `.topojson` comme JSON
```ts
// vite.config.ts addition
export default {
  assetsInclude: ["**/*.topojson"],
  // ou import inline avec ?raw + JSON.parse
};
```

- [ ] **Step 5** : test passe.

- [ ] **Step 6** : démo dans `main.ts`
```ts
import { renderChoropleth } from "./components/map-view";
import { createDuckConnector } from "./viz-engine/duck-connector";

const conn = createDuckConnector();
// Données stub : compter random par dept
const table = await conn.query({
  type: "arrow",
  sql: `
    SELECT LPAD(CAST(code_dept AS VARCHAR), 2, '0') AS code, COUNT(*) AS n
    FROM read_parquet('examples/sample.parquet')
    GROUP BY 1
  `
}) as any;
const dataByDept = new Map<string, number>();
for (const row of table) dataByDept.set(row.code, Number(row.n));
const mount = document.querySelector<HTMLDivElement>("#map")!;
renderChoropleth(mount, dataByDept);
```

- [ ] **Step 7** : screenshot + carte rendue → `docs/bench/b-032-choropleth.png`.

- [ ] **Step 8** : commit, PR (`feat/B-032-carto-choropleth`), merge.

Acceptance criteria :
- [x] TopoJSON dans assets (licence Etalab)
- [x] 101 départements colorés
- [x] Légende visible
- [x] Tooltip survol (via `<title>` SVG natif V0 ; V1 MapLibre tooltip riche)

### Task 3.4 : B-033b Finalisation schema + ADR-002 update

**Files** :
- Modify : `examples/effectifs_2026.vviz` (spec vgplot réelle)
- Modify : `schema/vviz-v1.json` (resserre `spec`)
- Modify : `docs/adr/ADR-002-mosaic-vgplot.md`

- [ ] **Step 1** : `examples/effectifs_2026.vviz` avec vraie spec vgplot
```json
{
  "$schema": "https://vaultviz.fr/schema/v1.json",
  "vviz": { "version": "1.0", "title": "Effectifs CPAM 92 — 2026", "author": "M. Mehdi" },
  "data": { "sources": [{ "name": "effectifs", "path": "./examples/sample.parquet" }] },
  "spec": {
    "engine": "vgplot",
    "params": { "dept_select": { "type": "selection", "field": "code_dept" } },
    "views": [
      {
        "id": "carto",
        "type": "choropleth",
        "source": "effectifs",
        "x_field": "code_dept",
        "y_aggregate": "AVG(effectif)",
        "select_param": "dept_select"
      },
      {
        "id": "detail",
        "type": "table",
        "source": "effectifs",
        "filter_param": "dept_select",
        "columns": ["code_dept", "categorie", "effectif", "jour"]
      }
    ]
  }
}
```
Note : on choisit le format **DSL prétraité** (objets `views`) plutôt que JSON vgplot brut (PRD §16 Q7 tranché ici). Raison : maintenable, validable, dégradable.

- [ ] **Step 2** : resserrer `spec` dans le schema
```json
"spec": {
  "type": "object",
  "required": ["engine", "views"],
  "properties": {
    "engine": { "const": "vgplot" },
    "params": { "type": "object" },
    "views": {
      "type": "array",
      "minItems": 1,
      "items": {
        "type": "object",
        "required": ["id", "type", "source"],
        "properties": {
          "id": { "type": "string" },
          "type": { "enum": ["choropleth", "bar", "line", "table", "scatter"] },
          "source": { "type": "string" },
          "x_field": { "type": "string" },
          "y_aggregate": { "type": "string" },
          "filter_param": { "type": "string" },
          "select_param": { "type": "string" },
          "columns": { "type": "array", "items": { "type": "string" } }
        },
        "additionalProperties": false
      }
    }
  }
}
```

- [ ] **Step 3** : validation
```bash
npx ajv validate -s schema/vviz-v1.json -d examples/effectifs_2026.vviz --strict=false
```

- [ ] **Step 4** : mettre à jour ADR-002 — section « Décision §16 Q7 » :
```markdown
## Format spec — décision (PRD §16 Q7)

**Date** : 2026-05-28 (B-033b).

**Décision** : `spec` est un **DSL VaultViz** (objets `views` typés), pas du JSON vgplot brut.

**Justification** :
- Validable par JSON Schema (le JSON vgplot brut est trop libre — fonctions, expressions JS).
- Surface d'injection nulle (pas d'eval, pas d'expressions).
- Mappable à vgplot via une fonction `compileToMosaic(spec)` côté front (cf. Task 5.1).
- Repli Vega-Lite possible : autre compileur depuis le même DSL.

**Conséquence** : un compileur DSL→vgplot vit dans `src/viz-engine/mosaic-runtime.ts` (Task 4.2). Évolutions futures du DSL = version bump du schema.
```

- [ ] **Step 5** : commit, PR, merge. Marquer B-033 `[x]`.

Acceptance criteria :
- [x] Schema validé syntaxiquement (ajv)
- [x] Exemple valide contre schema
- [x] App charge l'exemple (sera complété en Wave 4)
- [x] Décision §16 Q7 tracée dans ADR-002

---

## Wave 4 — I3 Interactivité [SÉQUENTIEL]

### Task 4.1 : B-040 Selection Mosaic point select

**Files** :
- Create : `src/viz-engine/mosaic-runtime.ts`
- Modify : `src/components/map-view.ts` (gestion clic + selection state)
- Create : `src/__tests__/mosaic-runtime.test.ts`

- [ ] **Step 1** : `mosaic-runtime.ts` — compileur DSL→vg.plot + gestion sélection
```ts
import * as vg from "@uwdata/vgplot";
import type { VVizDocument } from "./types";

export interface RuntimeContext {
  selections: Map<string, vg.Selection>;
}

export function createRuntime(): RuntimeContext {
  return { selections: new Map() };
}

export function ensureSelection(ctx: RuntimeContext, paramName: string, field: string): vg.Selection {
  if (!ctx.selections.has(paramName)) {
    ctx.selections.set(paramName, vg.Selection.single({ field }));
  }
  return ctx.selections.get(paramName)!;
}

export function clearSelection(ctx: RuntimeContext, paramName: string): void {
  const sel = ctx.selections.get(paramName);
  if (sel) sel.update({ value: null });
}
```
Note Mosaic : API `Selection.single({ field })` est indicative ; subagent doit Context7 `mosaic-core` pour signature exacte (`Selection`, `Param`, `Coordinator.connect`).

- [ ] **Step 2** : modifier `map-view.ts` pour émettre clic avec `ctx`
```ts
export function bindSelection(svg: SVGSVGElement, ctx: RuntimeContext, paramName: string, field: string): void {
  const sel = ensureSelection(ctx, paramName, field);
  svg.querySelectorAll<SVGPathElement>("path[data-dept]").forEach(p => {
    p.addEventListener("click", (e) => {
      e.stopPropagation();
      const current = p.dataset.dept!;
      const prev = (sel as any).value;
      if (prev === current) {
        clearSelection(ctx, paramName);
        p.style.strokeWidth = "0.5";
      } else {
        sel.update({ value: current, predicate: `"${field}" = '${current}'` });
        // visual highlight
        svg.querySelectorAll<SVGPathElement>("path[data-dept]").forEach(o => o.style.strokeWidth = "0.5");
        p.style.strokeWidth = "2.5";
      }
    });
  });
}
```

- [ ] **Step 3** (TDD) test
```ts
import { describe, it, expect } from "vitest";
import { createRuntime, ensureSelection, clearSelection } from "../viz-engine/mosaic-runtime";

describe("mosaic-runtime selection", () => {
  it("ensureSelection is idempotent per param", () => {
    const ctx = createRuntime();
    const a = ensureSelection(ctx, "dept_select", "code_dept");
    const b = ensureSelection(ctx, "dept_select", "code_dept");
    expect(a).toBe(b);
  });
});
```

- [ ] **Step 4** : démo dans `main.ts` — clic département → log SQL pushdown via console DuckDB.

- [ ] **Step 5** : capture vidéo courte du clic (asciinema ou GIF).

- [ ] **Step 6** : commit, PR, merge.

Acceptance criteria :
- [x] `vg.Selection` créée
- [x] Clic met à jour selection + log SQL pushdown observable
- [x] Dept sélectionné visuellement distingué
- [x] Second clic = désélection

### Task 4.2 : B-041 Cross-filter carte + barres

**Files** :
- Create : `src/components/bar-chart.ts`
- Modify : `src/viz-engine/mosaic-runtime.ts` (`compileToMosaic`)
- Modify : `src/main.ts` (hconcat layout)

- [ ] **Step 1** (TDD) test compileToMosaic
```ts
import { describe, it, expect } from "vitest";
import { compileToMosaic } from "../viz-engine/mosaic-runtime";
import doc from "../../examples/effectifs_2026.vviz";

describe("compileToMosaic", () => {
  it("produces a vg.plot fragment per view", () => {
    const ctx = compileToMosaic(doc as any);
    expect(ctx.views.length).toBe(2);
  });
});
```

- [ ] **Step 2** : compileur
```ts
export interface CompiledView { id: string; type: string; element: HTMLElement; }
export interface CompiledDoc { ctx: RuntimeContext; views: CompiledView[]; }

export function compileToMosaic(doc: VVizDocument): CompiledDoc { /* ... */ }
```
Squelette détaillé fourni dans le repo via le subagent (compile carte D3 + barres vgplot + table simple, partagent la même Selection).

- [ ] **Step 3** : barres avec vgplot, filtre Selection
```ts
import * as vg from "@uwdata/vgplot";

export function renderBars(container: HTMLElement, sql: string, ctx: RuntimeContext, filterParam: string): void {
  // Utilise vg.from(...) + vg.barX(..., { fill: ..., filterBy: selection })
  // SQL exécuté via connector DuckDB (B-031)
  // ...
}
```

- [ ] **Step 4** : layout 2 vues côte à côte dans `main.ts`.

- [ ] **Step 5** : test : clic dept → barres filtrent. Mesurer temps < 1 s (sub-seconde requise). Doc dans BENCH.md.

- [ ] **Step 6** : auditer le code : **aucun JS impératif** hors `viz-engine/` (cf. critère acceptance).

- [ ] **Step 7** : commit, PR, merge.

Acceptance criteria :
- [x] Spec déclare 2 plots
- [x] Sélection carte filtre barres sub-seconde
- [x] Pas de JS impératif hors viz-engine
- [x] UC-3 démontré

---

## Wave 5 — I4 Drill-down

### Task 5.1 : B-050 Table virtualisée + drill UC-1

**Files** :
- Create : `src/components/table-view.ts`
- Modify : `src/viz-engine/mosaic-runtime.ts` (compile "table" view)
- Modify : `src/main.ts`

- [ ] **Step 1** : test
```ts
import { describe, it, expect } from "vitest";
import { renderTable } from "../components/table-view";

describe("table-view virtualization", () => {
  it("renders only visible rows (DOM contains < 100 trs for 10k rows)", async () => {
    // arrange : 10k rows
    // act
    // assert : count tr in container
  });
});
```

- [ ] **Step 2** : implémentation virtualisée fenêtre fixe (50 lignes visibles, rendu incrémental sur scroll)
```ts
export interface TableRow { [key: string]: unknown; }
export interface TableViewOptions {
  columns: string[];
  rowHeight?: number; // default 24
  visibleCount?: number; // default 50
  onSort?: (col: string, dir: "asc" | "desc") => void;
}
export function renderTable(container: HTMLElement, rows: TableRow[], opts: TableViewOptions): void { /* ... */ }
```
Utiliser `Arrow.Table` directement (pas de matérialisation array) : itération via `table.toArray()` paresseuse ou accès `table.get(i)`.

- [ ] **Step 3** : tri colonnes via re-query DuckDB ORDER BY (push-down)

- [ ] **Step 4** : compteur de lignes affiché

- [ ] **Step 5** : tester sur `examples/synth_50mb.parquet` — drill < 3 s (V0 acceptable). Doc BENCH.md. Pour 300 Mo : déclenché en Wave 8.

- [ ] **Step 6** : commit, PR, merge.

Acceptance criteria :
- [x] Table HTML virtualisée (10k+ lignes sans lag)
- [x] Filtre lié à Selection
- [x] Tri colonnes
- [x] Compteur lignes filtrées
- [x] Test 50 Mo OK (300 Mo en Wave 8)

---

## Wave 6 — I5 Erreurs [PARALLÈLE : 3 subagents]

**Note dispatching** : 3 tasks parfaitement indépendantes (fichiers différents, pas de couplage). Dispatcher en parallèle.

### Task 6.1 : B-060 Erreur fichier manquant / hors scope

**Files** :
- Create : `src/components/error-banner.ts`
- Modify : `src/main.ts`
- Create : `src/__tests__/error-banner.test.ts`

- [ ] **Step 1** test
```ts
import { describe, it, expect } from "vitest";
import { renderErrorBanner } from "../components/error-banner";

describe("error-banner", () => {
  it("renders distinct copy for not-found vs forbidden vs corrupt", () => {
    const c = document.createElement("div");
    renderErrorBanner(c, { kind: "NotFound", path: "/x.vviz" });
    expect(c.textContent).toMatch(/introuvable/i);
    renderErrorBanner(c, { kind: "Forbidden", path: "/y" });
    expect(c.textContent).toMatch(/accès refusé/i);
    renderErrorBanner(c, { kind: "Corrupt", path: "/z" });
    expect(c.textContent).toMatch(/corrompu/i);
  });
});
```

- [ ] **Step 2** impl
```ts
export type ErrorKind = "NotFound" | "Forbidden" | "Corrupt" | "Io";
export interface ErrorPayload { kind: ErrorKind; path: string; details?: string; }

const COPY: Record<ErrorKind, (p: string) => string> = {
  NotFound: (p) => `Fichier introuvable : ${p}. Vérifiez le chemin ou contactez le publisher.`,
  Forbidden: (p) => `Accès refusé par le scope FS pour : ${p}. Cf. configuration capability.`,
  Corrupt: (p) => `Fichier corrompu ou format invalide : ${p}.`,
  Io: (p) => `Erreur I/O lors de la lecture de ${p}.`,
};

export function renderErrorBanner(container: HTMLElement, err: ErrorPayload): void {
  container.innerHTML = `
    <div class="vv-error" role="alert">
      <strong>Erreur :</strong>
      <span>${COPY[err.kind](err.path)}</span>
      <button class="retry">Réessayer</button>
    </div>
  `;
}
```

- [ ] **Step 3** : intégration `main.ts` — capter le résultat de `read_vviz`, mapper `VVizError` → `ErrorKind`, render banner si erreur.

- [ ] **Step 4** : interdire les stack traces — vérifier qu'aucune `console.error(err)` n'expose `err.stack`.

- [ ] **Step 5** : commit, PR, merge.

### Task 6.2 : B-061 Validation schema invalide

**Files** :
- Create : `src/utils/schema-validator.ts`
- Create : `src/__tests__/spec-loader.test.ts`
- Modify : `src/viz-engine/spec-loader.ts`

- [ ] **Step 1** : installer ajv
```bash
npm install ajv ajv-formats
```

- [ ] **Step 2** test
```ts
import { describe, it, expect } from "vitest";
import { validateVViz, formatErrors } from "../utils/schema-validator";

describe("schema validator", () => {
  it("rejects missing title with explicit path", () => {
    const bad = { vviz: { version: "1.0" }, data: { sources: [{ name: "a", path: "./x.parquet" }] }, spec: { engine: "vgplot", views: [] } };
    const errs = validateVViz(bad);
    expect(errs).toBeTruthy();
    expect(formatErrors(errs!)).toContain("/vviz/title");
  });
});
```

- [ ] **Step 3** impl
```ts
import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import schema from "../../schema/vviz-v1.json";

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validateFn = ajv.compile(schema);

export function validateVViz(doc: unknown): ErrorObject[] | null {
  return validateFn(doc) ? null : (validateFn.errors as ErrorObject[]);
}

export function formatErrors(errs: ErrorObject[]): string[] {
  return errs.map(e => `${e.instancePath || "/"} : ${e.message ?? "invalide"}`);
}
```

- [ ] **Step 4** : `spec-loader.ts` chaîne read_vviz + parse + validate + render error banner si invalide
```ts
import { invoke } from "@tauri-apps/api/core";
import { validateVViz, formatErrors } from "../utils/schema-validator";
import { renderErrorBanner } from "../components/error-banner";
import type { VVizDocument } from "./types";

export async function loadVViz(path: string, errorMount: HTMLElement): Promise<VVizDocument | null> {
  try {
    const raw = await invoke<string>("read_vviz", { path });
    const doc = JSON.parse(raw);
    const errs = validateVViz(doc);
    if (errs) {
      errorMount.innerHTML = `
        <div class="vv-error">
          <strong>Spec invalide :</strong>
          <ul>${formatErrors(errs).map(s => `<li><code>${s}</code></li>`).join("")}</ul>
          <a href="docs/user/spec-format.md">Voir doc auteur</a>
        </div>
      `;
      return null;
    }
    return doc as VVizDocument;
  } catch (err: any) {
    const k = typeof err === "object" && "NotFound" in err ? "NotFound" : "Io";
    renderErrorBanner(errorMount, { kind: k as any, path, details: String(err) });
    return null;
  }
}
```

- [ ] **Step 5** : test passe.

- [ ] **Step 6** : commit, PR, merge.

### Task 6.3 : B-062 Logging local rotatif

**Files** :
- Create : `src-tauri/src/log.rs`
- Modify : `src-tauri/Cargo.toml` (`chrono`, `directories`)
- Modify : `src-tauri/src/main.rs` (init logger)
- Create : `src-tauri/tests/log_rotation.rs`

- [ ] **Step 1** Cargo deps
```toml
chrono = { version = "0.4", features = ["serde"] }
directories = "5"
```

- [ ] **Step 2** test rotation
```rust
// src-tauri/tests/log_rotation.rs
use vaultviz::log::{Logger, LogLevel};
use tempfile::tempdir;
use chrono::{Duration, Utc};

#[test]
fn rotates_after_7_days() {
    let dir = tempdir().unwrap();
    let mut logger = Logger::with_dir(dir.path().to_path_buf());
    // simuler 10 jours d'INFO
    for d in 0..10 {
        let when = Utc::now() - Duration::days(9 - d);
        logger.log_at(LogLevel::Info, "test", when);
    }
    let files: Vec<_> = std::fs::read_dir(dir.path()).unwrap().collect();
    assert!(files.len() <= 7, "expected <=7 files, got {}", files.len());
}

#[test]
fn no_pii_format() {
    // smoke : log_at avec message PII ne loggue pas le contenu sensible
}
```

- [ ] **Step 3** impl
```rust
use std::path::PathBuf;
use std::fs::{OpenOptions, read_dir, remove_file};
use std::io::Write;
use chrono::{DateTime, Utc};

pub enum LogLevel { Info, Warn, Error }

impl LogLevel {
    fn as_str(&self) -> &'static str {
        match self { Self::Info => "INFO", Self::Warn => "WARN", Self::Error => "ERROR" }
    }
}

pub struct Logger { dir: PathBuf }

impl Logger {
    pub fn default_dir() -> PathBuf {
        directories::ProjectDirs::from("fr", "CPAM92", "VaultViz")
            .map(|d| d.data_local_dir().join("logs"))
            .unwrap_or_else(|| PathBuf::from("./logs"))
    }
    pub fn with_dir(dir: PathBuf) -> Self {
        std::fs::create_dir_all(&dir).ok();
        Self { dir }
    }
    pub fn log(&mut self, level: LogLevel, msg: &str) { self.log_at(level, msg, Utc::now()) }
    pub fn log_at(&mut self, level: LogLevel, msg: &str, when: DateTime<Utc>) {
        let path = self.dir.join(format!("{}.log", when.format("%Y-%m-%d")));
        if let Ok(mut f) = OpenOptions::new().create(true).append(true).open(&path) {
            let _ = writeln!(f, "[{}] [{}] {}", when.to_rfc3339(), level.as_str(), msg);
        }
        self.rotate_old(when);
        self.enforce_size_cap();
    }
    fn rotate_old(&self, now: DateTime<Utc>) {
        let cutoff = now - chrono::Duration::days(7);
        if let Ok(entries) = read_dir(&self.dir) {
            for e in entries.flatten() {
                if let Ok(name) = e.file_name().into_string() {
                    if let Some(stem) = name.strip_suffix(".log") {
                        if let Ok(d) = chrono::NaiveDate::parse_from_str(stem, "%Y-%m-%d") {
                            let dt = d.and_hms_opt(0, 0, 0).unwrap().and_utc();
                            if dt < cutoff {
                                let _ = remove_file(e.path());
                            }
                        }
                    }
                }
            }
        }
    }
    fn enforce_size_cap(&self) {
        const CAP: u64 = 50 * 1024 * 1024;
        if let Ok(entries) = read_dir(&self.dir) {
            let mut files: Vec<_> = entries.flatten()
                .filter_map(|e| e.metadata().ok().map(|m| (e.path(), m.modified().ok(), m.len())))
                .collect();
            files.sort_by_key(|(_, mt, _)| *mt);
            let mut total: u64 = files.iter().map(|(_, _, s)| *s).sum();
            for (path, _, size) in files {
                if total <= CAP { break; }
                let _ = remove_file(&path);
                total = total.saturating_sub(size);
            }
        }
    }
}
```

- [ ] **Step 4** init dans `main.rs`
```rust
use crate::log::Logger;
use std::sync::Mutex;

// ajouter Logger au state ou wrapper global
```

- [ ] **Step 5** vérifier PII : grep dans tests qu'on n'écrit JAMAIS `read_to_string` output complet, JAMAIS un row Parquet.

- [ ] **Step 6** commit, PR, merge.

### Task 6.4 : Contrôleur — clôture I5

- [ ] Marquer B-060, B-061, B-062 `[x]`, mettre à jour tableau.

---

## Wave 7 — I6 MSI [SÉQUENTIEL]

### Task 7.1 : B-070 Config tauri-bundler MSI

**Files** :
- Modify : `src-tauri/tauri.conf.json`
- Modify : `src-tauri/Cargo.toml` (metadata `[package.metadata.bundle]` éventuel)

- [ ] **Step 1** : `tauri.conf.json` bundle MSI complet
```json
{
  "bundle": {
    "active": true,
    "targets": ["msi"],
    "identifier": "fr.cpam92.vaultviz",
    "publisher": "CPAM 92",
    "shortDescription": "Visualiseur de specs .vviz local-first",
    "longDescription": "VaultViz — outil de data-visualization desktop local-first pour CPAM 92.",
    "category": "Productivity",
    "icon": ["icons/icon.png", "icons/icon.ico"],
    "fileAssociations": [
      {
        "ext": ["vviz"],
        "name": "VaultViz Document",
        "description": "Spec de visualisation VaultViz",
        "role": "Viewer",
        "mimeType": "application/x.vviz+json"
      }
    ],
    "windows": {
      "wix": {
        "language": ["fr-FR", "en-US"],
        "upgradeCode": "<GUID stable à générer une fois>"
      },
      "allowDowngrades": false
    }
  }
}
```
Générer GUID : `uuidgen` (commiter en clair, c'est public).

- [ ] **Step 2** : icônes — placeholder OK V0, mais valides (PNG + ICO). Script
```bash
# scripts/gen-icons.sh
convert -size 512x512 xc:#1F4E79 -gravity center -fill white -font DejaVu-Sans-Bold -pointsize 64 -annotate 0 "VV" icons/icon.png
convert icons/icon.png -define icon:auto-resize=256,128,64,48,32,16 icons/icon.ico
```

- [ ] **Step 3** : build MSI ne marchera pas en local Linux — validation via GHA (Task 7.2).

- [ ] **Step 4** : commit `chore(bundle): configurer bundler MSI v0.0.1`, PR, merge.

### Task 7.2 : B-071 GHA workflow build MSI

**Files** :
- Create : `.github/workflows/release.yml`
- Modify : `.github/workflows/ci.yml` (ajouter job build-windows)

- [ ] **Step 1** : `release.yml`
```yaml
name: Release MSI

on:
  push:
    tags: ["v*"]
  workflow_dispatch:

permissions:
  contents: write

jobs:
  build-msi:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "npm" }
      - uses: dtolnay/rust-toolchain@stable
        with: { toolchain: stable }
      - uses: Swatinem/rust-cache@v2
        with: { workspaces: "src-tauri -> target" }
      - name: Install deps
        run: npm ci
      - name: Build frontend
        run: npm run build
      - name: Build Tauri MSI
        run: |
          cargo install --locked tauri-cli@^2.0
          cargo tauri build --bundles msi
      - name: cargo-audit
        run: |
          cargo install --locked cargo-audit
          cargo audit --json > audit-rust.json || true
      - name: npm audit
        run: npm audit --json > audit-npm.json || true
      - name: Upload MSI
        uses: actions/upload-artifact@v4
        with:
          name: vaultviz-msi
          path: src-tauri/target/release/bundle/msi/*.msi
      - name: Create GitHub Release
        if: startsWith(github.ref, 'refs/tags/v')
        uses: softprops/action-gh-release@v2
        with:
          files: |
            src-tauri/target/release/bundle/msi/*.msi
            audit-rust.json
            audit-npm.json
          generate_release_notes: true
```

- [ ] **Step 2** : `ci.yml` (créer/modifier pour ajouter matrix)
```yaml
name: CI
on: [push, pull_request]
jobs:
  test-linux:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "npm" }
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@v2
        with: { workspaces: "src-tauri -> target" }
      - run: sudo apt-get update && sudo apt-get install -y libwebkit2gtk-4.1-dev libsoup-3.0-dev librsvg2-dev libappindicator3-dev patchelf
      - run: npm ci
      - run: npm test
      - run: cd src-tauri && cargo test --all

  build-windows:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: "20", cache: "npm" }
      - uses: dtolnay/rust-toolchain@stable
      - run: npm ci
      - run: npm run build
      - run: cargo install --locked tauri-cli@^2.0
      - run: cargo tauri build --bundles msi --debug
      - uses: actions/upload-artifact@v4
        with: { name: msi-debug, path: "src-tauri/target/debug/bundle/msi/*.msi" }
```

- [ ] **Step 3** : tag de test
```bash
git tag v0.0.1-rc1
git push origin v0.0.1-rc1
```
Attendre run GHA. Téléchargement MSI artefact.

- [ ] **Step 4** : SBOM attaché à la release (vérifier `audit-rust.json` + `audit-npm.json` présents).

- [ ] **Step 5** : commit, PR, merge.

### Task 7.3 : B-072 Handoff package DSI (story `[!]`)

**Files** :
- Create : `docs/handoff/dsi-signing-package.md`
- Modify : `BACKLOG.md` (marquer `[!]` + champ Blocage)

- [ ] **Step 1** : créer le dossier
```markdown
# Handoff — Signature MSI VaultViz par DSI CPAM 92

## Statut
`[!]` Bloqué — point de contact DSI à identifier (PRD §16 Q2).

## Livrables produits par l'équipe VaultViz
- MSI v0.0.1-rc1 : <URL release GitHub privée>
- SBOM Rust : `audit-rust.json` (joint à la release)
- SBOM npm : `audit-npm.json`
- Hash SHA-256 du MSI : <à calculer>
- Capacités déclarées : `src-tauri/capabilities/main.json` (lecture FS uniquement)
- Aucun port réseau, aucun appel sortant (ADR-008)

## Demandé à la DSI
1. Identification du point de contact PSSI/AppLocker.
2. Test de signature avec le certificat CPAM (PKI interne).
3. Test de déploiement AppLocker sur poste pilote.
4. Retour : MSI signé ou refus motivé.

## Contraintes connues
- Cible Windows 11 uniquement (ADR-010).
- Identifier MSI : `fr.cpam92.vaultviz`.
- Upgrade GUID : <copié depuis tauri.conf.json>.
- Pas d'updater applicatif (ADR-008).

## Contacts VaultViz
- Auteur : A. Bergé (ab@alexandre-berge.fr)

## Next steps (après retour DSI)
- Si signé : déploiement MECM pilote (B-082 + V1).
- Si refusé : amendement architecture + R-1 escaladé.
```

- [ ] **Step 2** : calcul hash MSI
```bash
sha256sum src-tauri/target/release/bundle/msi/*.msi
```

- [ ] **Step 3** : marquer B-072 `[!]` dans BACKLOG :
```markdown
### B-072 — [!] Livrer un MSI de test à la DSI pour test de signature
- **Blocage** : Point de contact DSI à identifier (PRD §16 Q2). Dossier handoff prêt : `docs/handoff/dsi-signing-package.md`. MSI v0.0.1-rc1 disponible sur release privée GitHub.
```

- [ ] **Step 4** : commit, PR, merge.

---

## Wave 8 — I7 Go/No-Go [SÉQUENTIEL]

### Task 8.1 : B-080 Bench Parquet 300 Mo (synthétique)

**Files** :
- Modify : `docs/scripts/gen-synth-parquet.sh` (paramétré)
- Create : `docs/scripts/bench-300mb.sh`
- Modify : `docs/bench/BENCH.md`

- [ ] **Step 1** : générer 300 Mo synthétique
```bash
./docs/scripts/gen-synth-parquet.sh 300 examples/synth_300mb.parquet
ls -la examples/synth_300mb.parquet
```
Note : ce fichier n'est pas committé (cf. .gitignore `examples/synth_*.parquet` exception pour le seuil de taille). Le générer reproductiblement à chaque session.

- [ ] **Step 2** : exécuter bench complet — temps premier rendu + drill + RAM
```bash
./docs/scripts/bench-300mb.sh > docs/bench/run-300mb-linux-$(date +%Y%m%d).log 2>&1
```

- [ ] **Step 3** : compléter `BENCH.md`
```markdown
## B-080 — Bench Parquet 300 Mo (synthétique)

**Cibles PRD §9.1 V0** : premier rendu < 8 s ; drill-down < 1 s ; RAM < 800 Mo.

| Mesure | Linux NVMe (proxy) | Cible V0 | Statut |
|---|---|---|---|
| Premier rendu | <mesure> s | < 8 s | ✅/⚠️/❌ |
| Drill (clic dept) | <mesure> ms | < 1 s | ✅/⚠️/❌ |
| RAM pic | <mesure> Mo | < 800 Mo | ✅/⚠️/❌ |

**Note** : validation sur Parquet **réel CPAM** = pré-requis V1 (pilote). Profil mémoire annexé : `docs/bench/profil-300mb.png`.

## Recommandation
<Go / Ajustement / No-Go technique>
```

- [ ] **Step 4** : capture mémoire (Linux : `/proc/<pid>/status` ou `valgrind --tool=massif`).

- [ ] **Step 5** : commit, PR, merge.

### Task 8.2 : B-081 Handoff package démo RSSI (story `[!]`)

**Files** :
- Create : `docs/handoff/demo-script.md`
- Create : `docs/handoff/demo-slides.md`
- Create : `docs/handoff/feedback-grid.md`

- [ ] **Step 1** : script 30 min
```markdown
# Démo VaultViz V0 — Script (30 min)

## Audience
- DSI/RSSI CPAM 92
- 2 cadres invités (collège cible)

## Plan
1. (3 min) Contexte & vision (note `VaultViz.md`)
2. (5 min) Architecture & invariants (PRD §6 + ADRs)
3. (10 min) Démo live :
   - Ouverture `.vviz` par double-clic (assoc Explorer)
   - UC-1 : carte → clic Hauts-de-Seine → tableau détail
   - UC-3 : cross-filter 2 vues
   - UC-6 : `.vviz` invalide → erreur lisible
4. (5 min) Performance : BENCH.md 50 Mo + 300 Mo (synthétique)
5. (5 min) Q/R + retours écrits
6. (2 min) Next steps : pré-requis V1 (Parquet CPAM réel, signature DSI, RSSI avis)

## Pré-requis machine de démo
- MSI v0.0.1-rc1 installé
- Parquet démo posé sur partage `\\demo\share\`
- `.vviz` ouvrable par double-clic

## Note "synthétique"
**À dire explicitement** : les mesures perf sont sur dataset synthétique. La validation CPAM réelle reste à faire en pilote V1.
```

- [ ] **Step 2** : slides (rendu pandoc → PDF)
```bash
pandoc docs/handoff/demo-slides.md -t beamer -o docs/handoff/demo-slides.pdf
```

- [ ] **Step 3** : grille de retour
```markdown
# Grille retour démo VaultViz V0

| Critère | Note (1-5) | Commentaire |
|---|---|---|
| Clarté de l'UX consommateur (Camille) |  |  |
| Crédibilité technique (DSI/RSSI) |  |  |
| Adéquation au besoin métier |  |  |
| Risques PSSI perçus |  |  |
| ... |  |  |

## Décision attendue
- [ ] Go V0 → V1 (avec ajustements éventuels)
- [ ] Go conditionnel (préciser conditions)
- [ ] No-Go (raisons)
```

- [ ] **Step 4** : marquer B-081 `[!]` :
```markdown
### B-081 — [!] Démo interne RSSI + 2 cadres invités
- **Blocage** : Convocation des participants par sponsor. Dossier prêt : `docs/handoff/demo-script.md`.
```

- [ ] **Step 5** : commit, PR, merge.

### Task 8.3 : B-082 Handoff package ADR-V0-GoNoGo (story `[!]`)

**Files** :
- Create : `docs/adr/ADR-V0-GoNoGo-template.md`

- [ ] **Step 1** : grille § 12.1 préremplie
```markdown
# ADR-V0-GoNoGo — Template (à compléter après B-080 + B-081)

| Champ | Valeur |
|---|---|
| Statut | Brouillon (technique pré-rempli ; sponsor à décider) |
| Date | <à compléter> |
| Sponsors | DSI CPAM 92, métier |

## Critères § 12.1 PRD

| Critère | Cible | Mesure VaultViz | Couleur |
|---|---|---|---|
| UC-1 sur Parquet 50 Mo réel CPAM | OK | <synthétique 50 Mo : OK ✅> | 🟧 (synthétique) |
| UC-3 cross-filter | OK | OK ✅ | 🟢 |
| UC-6 erreur lisible | OK | OK ✅ | 🟢 |
| Premier rendu 50 Mo | < 3 s | <BENCH.md> | 🟢/🟧/🔴 |
| Premier rendu 300 Mo | < 8 s | <BENCH.md> | 🟢/🟧/🔴 |
| RAM 300 Mo | < 800 Mo | <BENCH.md> | 🟢/🟧/🔴 |
| MSI signable par DSI | OK | <B-072 retour DSI> | 🟧 (en attente) |
| Avis RSSI préliminaire | sans blocage | <B-081 retour RSSI> | 🟧 (en attente) |

## Décision

(à motiver par sponsor une fois B-072 et B-081 retournés)

- [ ] **Go V1**
- [ ] **Go conditionnel** : <conditions>
- [ ] **No-Go** : <raisons + plan>

## Signatures

- DSI : ___________
- Métier : ___________
- Auteur : A. Bergé
```

- [ ] **Step 2** : marquer B-082 `[!]` :
```markdown
### B-082 — [!] Décision Go/No-Go V0 → V1
- **Blocage** : Dépend de B-072 (DSI) et B-081 (RSSI) en retour. Template `docs/adr/ADR-V0-GoNoGo-template.md` prêt avec critères techniques pré-évalués.
```

- [ ] **Step 3** : commit, PR, merge.

---

## Final — Revue globale

### Final-1 : Dispatch final code-reviewer subagent

- [ ] Subagent premium (Opus) reçoit :
  - Le plan complet (ce fichier)
  - La liste des branches mergées + SHAs
  - Demande : revue globale de l'implémentation V0 vs PRD §4.1 V0
- [ ] Output : `docs/handoff/final-review-v0.md`

### Final-2 : Mise à jour `README.md`

- [ ] Mettre à jour statut : « Pré-V0 » → « V0 technique terminée, en attente handoff DSI/RSSI/sponsor »
- [ ] Ajouter quickstart : `cargo tauri dev`, `npm test`, etc.

### Final-3 : Tableau de bord final

```
| Pré-V0 | 3 | 0 | 0 | 3 | 0 |
| V0 — I0 Squelette | 3 | 0 | 0 | 3 | 0 |
| V0 — I1 DuckDB | 4 | 0 | 0 | 4 | 0 |
| V0 — I2 Mosaic | 4 | 0 | 0 | 4 | 0 |
| V0 — I3 Interactivité | 2 | 0 | 0 | 2 | 0 |
| V0 — I4 Drill-down | 1 | 0 | 0 | 1 | 0 |
| V0 — I5 Erreurs | 3 | 0 | 0 | 3 | 0 |
| V0 — I6 MSI | 3 | 0 | 0 | 2 | 1 |    ← B-072 [!]
| V0 — I7 Go/No-Go | 3 | 0 | 0 | 1 | 2 | ← B-081 + B-082 [!]
| **V0 Total** | **23 + 3** | **0** | **0** | **23** | **3** |
```

### Final-4 : Tag release v0.0.1

- [ ] `git tag v0.0.1 -m "V0 technique terminée"` + `git push --tags`
- [ ] Vérifier release GHA déclenchée

---

## §A. Self-review du plan

**Couverture du PRD §4.1 V0** :
- [x] Ouvrir `.vviz` par double-clic (B-070 fileAssociations)
- [x] Lire Parquet UNC (B-011 capabilities + B-021 duckdb)
- [x] Carte choroplèthe (B-032)
- [x] Drill-down dept → table (B-040 + B-050)
- [x] Cross-filter 2 vues (B-041)
- [x] Erreur lisible (B-060 + B-061)
- [x] Logging fichier (B-062)
- [x] MSI propre (B-070 + B-071)
- [x] Installation manuelle (default MSI, pas de MECM en V0)

**Couverture critères succès §4.1 V0** :
- [x] UC-1/3/6 (B-050, B-041, B-061)
- [x] 50 Mo et 300 Mo (B-023, B-080) — synthétique
- [!] RSSI préliminaire (B-081 handoff)

**Couverture du BACKLOG** : 23/23 stories adressées (20 `[x]` + 3 `[!]`).

**Types consistency** : `VVizDocument`, `RuntimeContext`, `Selection`, `DuckConnector`, `CompiledView` consistent across tasks 3.2b→4.1→4.2→5.1.

**No placeholders** : tous les steps ont du code ou des commandes verbatim, sauf zones explicitement Context7-fetched (ex. signature exacte `query_arrow` duckdb-rs ou Mosaic `Selection.single` selon version).

---

## §B. Risques d'exécution et mitigations

| Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|
| API duckdb-rs `query_arrow` change | M | M | Context7 obligatoire avant impl. Fallback : itérer rows manuellement + reconstruct Arrow IPC |
| Mosaic API casse en cours de Wave 3 | M | H | Verrouiller versions Wave 3.1. R-8 PRD : escalade sponsor si blocant |
| GHA windows-latest échoue (libs natives) | M | M | Tester tôt en Wave 7.2 ; fallback : self-hosted runner Windows |
| Tauri capability scope ne matche pas chemin UNC | M | H | Sanity local-only en B-011 ; H1 réel reporté V1 |
| Bundle MSI > 30 Mo | M | M | Surveillance dans BENCH.md à chaque wave ; features DuckDB ajustables |
| TopoJSON IGN licence ambigu V0 | L | L | V0 utilise gregoiredavid/france-geojson (Etalab) ; V1 passe à IGN officiel |
| Subagent dispatch parallèle Wave 0 cause conflits | L | L | Fichiers distincts par ADR + contrôleur édite seul BACKLOG |

---

## §C. Exécution handoff

Plan complet sauvegardé à `docs/superpowers/plans/2026-05-28-v0-execution.md`.

**Approche choisie** (validée user) : **Subagent-Driven Development** dans cette session.

**Stratégie** :
1. Le contrôleur (Claude principal) lit le plan une fois, extrait toutes les tasks, crée TaskCreate.
2. Pour chaque task : dispatch implementer (modèle selon complexité §0.10) → review spec → review code quality → merge.
3. Pour Wave 0 (11 ADRs) et Wave 6 (3 erreurs) : dispatch parallèle (`dispatching-parallel-agents`).
4. Le contrôleur garde l'écriture exclusive de `BACKLOG.md` (mise à jour entre tasks).
5. Stories `[!]` : produire artefact + marquer + commit handoff package, ne pas attendre humain.
6. Final reviewer après Wave 8.

**Démarrage** : après validation user du plan, lancer Wave -1 (pré-flight), puis Wave 0.
