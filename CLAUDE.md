# CLAUDE.md — Guide d'orientation pour les sessions Claude Code

Ce fichier est chargé automatiquement au démarrage de chaque session Claude Code sur ce repo. Il définit le contrat de collaboration, les sources de vérité, et les invariants à respecter strictement.

---

## 1. Protocole de démarrage de session

À l'ouverture d'une session sur ce repo, **avant toute action** :

1. **Lire `PRD.md`** — source de vérité produit. Ne jamais s'écarter de ses ADRs sans amendement explicite.
2. **Lire `BACKLOG.md`** — état d'exécution. Identifier la prochaine story `[ ]` dont toutes les dépendances sont `[x]`.
3. **Lire `VaultViz.md`** uniquement si une décision de fond doit être révisée — c'est la note d'opportunité d'origine, conservée pour traçabilité historique.
4. **Annoncer la story** que tu vas exécuter, puis passer son marqueur `[ ]` → `[~]`. Mettre à jour le tableau de bord §0.3 du BACKLOG.
5. **À la fin de la story**, passer `[~]` → `[x]` et mettre à jour le tableau de bord.

Si la session déborde, laisser la story en `[~]` et créer une sous-story dans le backlog avec un sous-ID (ex. B-031.1, B-031.2).

---

## 2. Identité du projet — résumé exécutif

**VaultViz** : outil de data-visualization desktop local-first pour CPAM 92. Inspiré d'Obsidian (fichier = source de vérité), il interprète des fichiers `.vviz` (JSON, spec Mosaic/vgplot) référençant des Parquet posés sur un partage SMB/UNC.

**Stack verrouillée** (cf. PRD §6.3) :
- Tauri 2.x + Rust core
- DuckDB **natif** via `duckdb-rs` (feature `bundled`) — **pas WASM**
- **Mosaic + vgplot** comme moteur de rendu V1 (push-down SQL DuckDB)
- Apache Arrow IPC pour transit Rust ↔ WebView2
- MapLibre GL JS + PMTiles + TopoJSON IGN ADMIN EXPRESS pour la cartographie
- Cible : **Windows 11 exclusivement**, déploiement MECM/Intune

---

## 3. Invariants intangibles (ne JAMAIS dévier)

| # | Invariant | Origine |
|---|---|---|
| I-1 | **Windows 11 uniquement.** Pas de Linux, macOS, mobile, web. | ADR-010 |
| I-2 | **Local-first strict.** Zéro port en écoute, zéro appel sortant, pas de télémétrie, pas d'updater applicatif. | ADR-008 |
| I-3 | **Lecture seule** sur le share. VaultViz n'écrit jamais sur le partage réseau. | §5.2 PRD |
| I-4 | **Pas de serveur applicatif** (Apache, Nginx, Node…). Aucune infra à exploiter. | §1.1, §10 |
| I-5 | **Signature et déploiement parc = DSI**, hors scope produit. Le PRD ne tranche ni le type de cert, ni le HSM, ni la procédure. | ADR-005 |
| I-6 | **Parquet pivot**, Arrow IPC transit, JSON banni pour les données métier. | ADR-003 |
| I-7 | **Mosaic + vgplot en V1**, pas Vega-Lite (sauf repli si Mosaic se révèle bloquant — R-8). | ADR-002 |
| I-8 | **GitHub privé** organisation CPAM pour le repo source. | §16 PRD |
| I-9 | **Export PDF A4** est une exigence explicite V1 (pas une option). | ADR-011, UC-4 |
| I-10 | **RGPD hors périmètre VaultViz** — la conformité passe par les ACL du share. L'outil n'est qu'un interprétateur. | §8.2 |

---

## 4. Règles de collaboration

### 4.1 Pas d'estimations en jours·hommes

Le mode d'exécution est **vibe coding**. Ne jamais estimer en j·h, ETP, taille d'équipe. Raisonner en complexité conceptuelle (S/M/L), nombre d'itérations probables, risques durs hors-code.

### 4.2 Ne pas s'arroger les décisions hors scope produit

La signature de code, le choix du certificat, le stockage de la clé privée, la procédure CI/déploiement parc, la PKI : **ce sont des décisions DSI**, pas produit. Le backlog s'arrête au MSI signable livré à la DSI.

De même : pas de propositions d'infrastructure (serveur d'update, endpoint manifest, télémétrie cloud). Le projet est **strictement** local-first.

### 4.3 Discipline de scope

- **Pas d'over-engineering** anticipant des besoins futurs hypothétiques.
- **Pas de features cachées** : si une exigence n'est pas dans le PRD, elle n'est pas faite. Si elle doit l'être, **amender le PRD avant**.
- **Pas d'estimation calendaire** : roadmap par dépendances et risques, pas par dates.

### 4.4 Sources et versions

- Versions précises **non figées** dans le PRD : la règle est « dernière minor stable au démarrage du POC », verrouillée ensuite par lockfile.
- Ne pas réintroduire de dates de release projetées sans vérification réelle (les agents de recherche peuvent halluciner — toujours hedger ou vérifier via WebFetch direct).

### 4.5 Langue

L'utilisateur travaille en **français**. Répondre en français par défaut, y compris dans la documentation produite.

---

## 5. Sources de vérité — où chercher quoi

| Question | Où chercher |
|---|---|
| Quelle est la vision / le scope produit ? | `PRD.md` §1 |
| Quelle est l'architecture verrouillée ? | `PRD.md` §6 (ADRs synthétisés) + `docs/adr/` quand existant |
| Quels sont les hypothèses critiques ? | `PRD.md` §1.4 (H1-H6) |
| Quels sont les risques ? | `PRD.md` §13 (R-1 à R-10) |
| Quelle est la prochaine tâche ? | `BACKLOG.md` §0.3 tableau de bord, puis première `[ ]` dont les dépendances sont `[x]` |
| Comment ouvrir un sujet hors-PRD ? | Amendement PRD via PR + propagation au backlog |
| Contexte historique / pourquoi VaultViz ? | `VaultViz.md` (note d'opportunité originale, immuable) |

---

## 6. Conventions de code

### 6.1 Arborescence (cf. PRD §18 Annexe B)

```
src-tauri/    Rust core (DuckDB, FS, IPC, capabilities)
src/          Front WebView2 (Vite + TS), viz-engine, map, theme, ui
schema/       JSON Schema .vviz et manifest
examples/     Exemples .vviz canoniques
docs/         Doc utilisateur, doc auteur, ADRs séparés
.github/      CI build MSI signable
```

### 6.2 Conventions de chemin

- Chemins UNC dans les `.vviz` : forme **`//host/share/...`** (double slash, séparateurs `/`), pas `\\host\share\...`. Cf. ADR-007.
- Chemins relatifs : `./` pour relatif au `.vviz`, autorisés en mode déconnecté.
- Lettres de lecteur mappées (`Z:/...`) acceptées en fallback.

### 6.3 Format `.vviz`

JSON Schema versionné dans `schema/vviz-v1.json`. Trois blocs : `vviz` (métadonnées), `data.sources` (chemins centralisés), `spec` (Mosaic/vgplot). Cf. PRD §5.3.

### 6.4 Logs

Logs locaux uniquement : `%LOCALAPPDATA%\VaultViz\logs\YYYY-MM-DD.log`. **Aucune PII**. Rotation 7 jours, plafond 50 Mo. Cf. PRD §8.3.

### 6.5 Commits

- Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `refactor:`).
- Référencer l'ID de story dans le footer : `Refs: B-031`.
- Une story = un commit ou une PR atomique idéalement.

### 6.6 Branches

- `main` protégée.
- Branches de feature : `feat/B-NNN-slug` ; `fix/B-NNN-slug`.

---

## 7. Mémoire persistante

La mémoire Claude Code de ce projet (dans `~/.claude/projects/-home-alex-Documents-REPO-VaultViz/memory/`) contient :

- **Feedback** : règles de collaboration durables (vibe coding, scope strict, pas de décisions DSI)
- **Project** : décisions structurantes du projet (Mosaic V1 avec R-8, Windows 11 only, signature DSI)
- **Reference** : pointeurs vers PRD/BACKLOG/VaultViz.md

Ces entrées sont chargées automatiquement et complètent ce CLAUDE.md. Les mettre à jour si une décision structurante change.

---

## 8. Quand demander à l'utilisateur avant d'agir

- **Toute décision hors scope produit** (infrastructure, DSI, signature, déploiement parc) : ne pas trancher seul, signaler.
- **Toute modification d'ADR** : escalader.
- **Toute story dont les dépendances ne sont pas `[x]`** : ne pas démarrer.
- **Toute version précise à fixer** (Tauri, DuckDB, Mosaic, etc.) : demander à figer le lockfile avec l'utilisateur présent.
- **Toute introduction d'infrastructure externe** (serveur, service cloud, endpoint) : refuser et expliquer pourquoi (invariants I-2, I-4, I-5).

---

## 9. Référence rapide — commandes utiles

```bash
# État du projet
cat BACKLOG.md | head -50               # tableau de bord
grep -c "\[ \]" BACKLOG.md              # stories à faire
grep -c "\[~\]" BACKLOG.md              # stories en cours
grep -c "\[x\]" BACKLOG.md              # stories terminées

# Exécution
cargo tauri dev                          # lancement dev
cargo tauri build                        # build MSI
cargo audit && (cd src && npm audit)     # SBOM dépendances

# Validation .vviz
ajv validate -s schema/vviz-v1.json -d examples/*.vviz
```

---

**Fin du CLAUDE.md.**

Toute modification de ce fichier doit respecter les invariants §3 et faire l'objet d'une discussion préalable avec l'utilisateur.
