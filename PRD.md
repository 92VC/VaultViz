# PRD — VaultViz

**Outil de data-visualization desktop local-first, fichier-comme-source-de-vérité**

| Métadonnée | Valeur |
|---|---|
| Version PRD | 1.0 |
| Date | 2026-05-28 |
| Auteur | A. Bergé (CPAM 92) |
| Statut | Pour validation interne avant POC |
| Document source | `VaultViz.md` (note d'opportunité) |
| Horizon | V0 prototype démontrable → V1 déploiement pilote collège cadres |

---

## 0. Note de lecture

Ce PRD est rédigé dans un **contexte de développement assisté par LLM** (vibe coding). En conséquence :

- Aucune estimation en jours·hommes, ETP ou taille d'équipe traditionnelle n'est fournie.
- Les « efforts » sont exprimés en **complexité conceptuelle**, **nombre d'itérations probables** et **risques durs hors-code** (administratif, conformité, signature, terrain utilisateur).
- Les coûts qui restent pertinents — et seuls cités — sont les coûts **externes** non-produit : support utilisateur final, conformité PSSI. La signature/déploiement parc relève de la DSI (hors scope).
- Les décisions techniques sont **verrouillées** dans la section dédiée (ADRs). Toute évolution doit faire l'objet d'un amendement explicite. Versions précises non figées dans le PRD (cf. §6.2).

---

## 1. Vision & positionnement

### 1.1 Énoncé de vision

**VaultViz est à la data-visualization ce qu'Obsidian est à la note prise** : un exécutable local, posé sur chaque poste, qui interprète des fichiers déposés sur un partage réseau pour en restituer une expérience visuelle interactive — sans serveur applicatif, sans dépendance cloud, sans licence par utilisateur.

L'utilisateur final ouvre un fichier `.vviz` (texte JSON versionnable) comme il ouvrirait un `.pdf` : double-clic, fenêtre native, interaction immédiate. La donnée vit sous forme de fichiers Parquet sur un partage SMB/UNC, modifiée uniquement par un pipeline ETL contrôlé en amont. L'outil n'écrit jamais sur le partage.

### 1.2 Pourquoi maintenant (fenêtre stratégique)

Trois capacités matures convergent en 2026 :

1. **DuckDB 1.x** — moteur OLAP embarqué, lecture Parquet en streaming sur SMB, performances sub-secondes jusqu'à plusieurs Go en mémoire.
2. **Tauri 2.x** — packaging d'applications desktop avec footprint réduit, modèle de sécurité par capabilities, signature Windows industrialisée.
3. **Mosaic** (UW IDL, papier IEEE VIS 2024 Heer & Moritz) + Apache Arrow — architecture de visualisation conçue dès l'origine pour pousser les calculs dans DuckDB (push-down SQL), avec grammaire déclarative et coordination native cross-vues. Aligné par construction avec ADR-001 (DuckDB natif).

La case « Obsidian-for-data » est encore libre en mai 2026 (cf. §13). Les concurrents identifiés (Rill, Evidence) sont code-first et requièrent un serveur localhost ou une chaîne build Node. **Fenêtre estimée : 12–18 mois** avant qu'un acteur dominant ne s'installe (risque principal : Evidence.dev s'il publie un wrapper Tauri/Electron + UX no-code).

### 1.3 Positionnement explicite

| VaultViz **est** | VaultViz **n'est pas** |
|---|---|
| Un viewer interactif de specs de visualisation | Un outil de query SQL ad-hoc (Duckling, DBeaver) |
| Un consommateur de fichiers Parquet certifiés en amont | Un ETL ni un outil de transformation de données |
| Un outil de partage par fichier (Git-versionnable) | Une plateforme collaborative type Looker / Metabase |
| Local-first strict : zéro port réseau ouvert, zéro service de fond | Une application web déguisée |
| Windows 11 exclusivement (parc CPAM 92 cible) | Multi-plateforme (Linux, macOS, mobile) — hors scope |
| No-code pour le consommateur, low-code (JSON) pour l'auteur de spec | Un éditeur visuel de spec WYSIWYG en V1 (peut-être en V2) |

### 1.4 Hypothèses critiques (à invalider en priorité)

| Hypothèse | Méthode de validation |
|---|---|
| H1. Tauri 2 + plugin-fs gère correctement les chemins UNC `//host/share/...` sur Windows 10/11 d'entreprise | POC itération 0 sur un share CPAM représentatif |
| H2. DuckDB natif lit des Parquet 500 Mo via SMB en streaming sans saturer la RAM | Benchmark itération 1 avec dataset CPAM réel |
| H3. Le MSI produit par la CI est signable par les procédures DSI standard CPAM 92 (test de signature + push MECM par la DSI) | Validation par la DSI en V0 sur un artefact de test |
| H4. Le drill-down `département → détail` est exprimable en spec Mosaic/vgplot déclarative (push-down DuckDB, zéro JS métier) | POC itération 0 — démo carte France |
| H5. Les cadres CPAM acceptent l'UX « double-clic `.vviz` » sans formation autre que doc 1 page | Test terrain 5 utilisateurs représentatifs itération 2 |
| H6. La PSSI CPAM autorise un binaire signé non-Microsoft lisant un partage interne en RO | Avis RSSI préliminaire avant V1 |

---

## 2. Glossaire

| Terme | Définition |
|---|---|
| **`.vviz`** | Fichier texte JSON décrivant une visualisation Mosaic/vgplot et pointant (via chemin UNC ou relatif) vers un ou plusieurs Parquet de données. |
| **Spec** | Contenu d'un `.vviz` : grammaire visuelle, transformations, interactions. |
| **Vault** | Répertoire (souvent UNC) contenant des `.vviz`, Parquet, GeoJSON/TopoJSON, et éventuellement un manifest. |
| **Manifest** | Fichier optionnel `vault.json` décrivant la liste des `.vviz` exposés, leur catégorisation, version. |
| **Publisher** | Pipeline ETL contrôlé qui est le seul autorisé à écrire sur le partage (hors scope de VaultViz, mais condition de gouvernance). |
| **Cadre cible** | Public utilisateur principal : collège cadres CPAM 92, non-technicien, poste Windows géré MECM/Intune. |
| **DSFR** | Système de design de l'État français. Initialement visé comme référence visuelle ; abandonné au profit d'un design system custom (cf. [ADR-012](docs/adr/ADR-012-design-system.md)). |
| **PSSI** | Politique de sécurité des systèmes d'information (ici PSSI-MCAS Sécurité Sociale, PSSI-E État). |

---

## 3. Personas & cas d'usage

### 3.1 Persona 1 — Camille, contrôleuse de gestion (consommateur)

- Cadre, 38 ans, à l'aise avec Excel/Power BI Desktop, refuse d'apprendre du code.
- Reçoit par mail un lien vers `\\CPAM92\share\dashboards\effectifs_2026.vviz`.
- Attente : double-clic, fenêtre s'ouvre en < 3 s, carte de France, clic sur Hauts-de-Seine → tableau filtré, export PNG/PDF.
- Frustrations actuelles : Power BI Service plante sur réseau interne, .pbix lourds, partage par OneDrive génère des conflits, Tableau coûteux à licencier.

### 3.2 Persona 2 — Mehdi, data-analyst (auteur de spec)

- 31 ans, écrit du SQL et du Python quotidiennement, connaît Vega-Lite / ggplot / Observable Plot de réputation (utile pour aborder Mosaic/vgplot).
- Mission : produire 5 à 15 `.vviz` par mois en s'appuyant sur les Parquet du publisher.
- Attente : édition VS Code avec validation de schéma JSON, prévisualisation rapide, doc référentielle accessible.
- Frustrations actuelles : refaire le même type de graphique dans des outils différents, pas de versionnage Git de ses dashboards Power BI.

### 3.3 Persona 3 — DSI / RSSI CPAM (validateur)

- Décideur sur l'autorisation de déploiement parc.
- Attente : binaire signé, sans port réseau ouvert, sans télémétrie sortante, lisant un share en RO via ACL existante, journalisable côté MECM.
- Frustrations actuelles : les outils BI cloud sont régulièrement bloqués par le PSSI ; les solutions on-prem demandent un serveur d'application supplémentaire à exploiter.

### 3.4 Cas d'usage canoniques

| ID | Nom | Description |
|---|---|---|
| UC-1 | Carte choroplèthe France par département | Camille ouvre `effectifs_2026.vviz`, voit la France colorée par effectifs, survol affiche tooltip, clic affiche tableau détaillé du département. |
| UC-2 | Série temporelle avec filtres | Évolution mensuelle des indicateurs d'activité, slicer multi-sélection sur la catégorie d'acte, brush sur la chronologie. |
| UC-3 | Cross-filter entre vues | Dashboard à 3 vues liées (carte + barres + table) : sélection sur l'une filtre les deux autres. |
| UC-4 | **Export PDF** (exigence explicite) + PNG + CSV | Exporter la vue courante en **PDF A4** (livrable principal pour partage hors VaultViz : mail, impression, archivage), PNG (presse-papier + fichier), CSV (données filtrées affichées). |
| UC-5 | Rafraîchissement automatique | Le publisher dépose un nouveau Parquet ; VaultViz détecte la modification et propose un rechargement (pas automatique pour éviter les surprises). |
| UC-6 | Spec invalide ou data manquante | Le `.vviz` référence un Parquet absent : message d'erreur clair, chemin attendu, suggestion de contact publisher. |

---

## 4. Périmètre fonctionnel

### 4.1 Versions et incréments

Le PRD distingue **V0 (prototype démontrable), V1 (pilote cadres), V2 (extension)**. Chaque version est conditionnée par les enseignements de la précédente. Pas de date calendaire ; ordonnancement par dépendances et risques.

#### V0 — Prototype démontrable (Go/No-Go interne)

Objectif : démontrer en interne que l'architecture tient, sur le cas d'usage UC-1 + UC-3 + UC-6.

| Fonctionnel | Inclus en V0 |
|---|---|
| Ouvrir un `.vviz` par double-clic via association d'extension Windows | ✅ |
| Lire un Parquet local depuis chemin UNC `//host/share/...` | ✅ |
| Rendre une carte choroplèthe France (TopoJSON IGN ADMIN EXPRESS COG fév. 2026) | ✅ |
| Drill-down `département → tableau détail` via Mosaic selections (push-down DuckDB) | ✅ |
| Cross-filter à 2 vues | ✅ |
| Gestion d'erreur fichier manquant / spec invalide avec message lisible | ✅ |
| Logging local en fichier (debug) | ✅ |
| MSI propre généré via `tauri-bundler` (signature hors scope produit : artefact livré à la DSI pour test si nécessaire) | ✅ |
| Installation manuelle (pas de déploiement MECM en V0) | ✅ |
| **Hors V0** : MapLibre, watcher, export PDF, déploiement MECM, design system custom | ❌ |

Critères de succès V0 (Go pour V1) :
- UC-1, UC-3, UC-6 fonctionnent sur Parquet 50 Mo et 300 Mo réels CPAM.
- Temps d'ouverture spec → premier rendu : **< 3 s** (Parquet 50 Mo), **< 8 s** (Parquet 300 Mo).
- Empreinte mémoire stable : **< 800 Mo** sur Parquet 300 Mo.
- Avis RSSI préliminaire sans blocage structurel.

#### V1 — Pilote collège cadres

Ajout par rapport à V0 :

| Fonctionnel | Inclus en V1 |
|---|---|
| Cartographie MapLibre GL JS + PMTiles offline (fond de carte minimal embarqué) | ✅ |
| Watcher FS : détection modif Parquet, bannière « données mises à jour, recharger » | ✅ |
| **Export PDF A4** (vue active) — exigence explicite | ✅ |
| Exports complémentaires : PNG (presse-papier + fichier), CSV (données filtrées) | ✅ |
| MSI **signable** produit par la CI (signature opérée par la DSI, hors scope produit) | ✅ |
| Déploiement MECM/Intune testé sur 10–20 postes pilotes Windows 11 | ✅ |
| UI de chargement (loader, messages d'erreur, doc accessible F1) | ✅ |
| Design system custom appliqué (thème sombre/clair, tokens, polices Inter + JetBrains Mono embarquées) — cf. [ADR-012](docs/adr/ADR-012-design-system.md) | ✅ |
| Doc utilisateur 1 page (PDF) + doc auteur spec 5 pages | ✅ |
| Schéma JSON `.vviz` versionné dans le repo (validation VS Code via `$schema` local ou raw GitHub) | ✅ |
| **Hors V1** : éditeur visuel WYSIWYG, mobile, partage cloud, multi-utilisateur write, multi-plateforme (Linux, macOS) | ❌ |

Critères de succès V1 (Go pour déploiement large) :
- ≥ 80 % des cadres pilotes installent + ouvrent un `.vviz` sans assistance.
- Temps drill-down sur Parquet 500 Mo : **< 1 s**.
- Export PDF A4 fonctionnel sur tous les types de vues V1.
- Zéro incident PSSI bloquant.

#### V2 — Extension (sous condition de succès V1)

Pistes ouvertes, à arbitrer après V1 :

- Éditeur visuel `.vviz` (low-code drag-and-drop).
- Galerie de templates (cartes, time series, KPI cards).
- Support DuckLake pour versioning des sources de données.
- Partage de specs par URL `vviz://` (deep link).
- Mode présentation (slideshow de plusieurs `.vviz`).
- Intégration commentaires (fichier `.vviz.notes.md` adjacent, philosophie Obsidian).

---

## 5. Exigences fonctionnelles détaillées

### 5.1 Cycle de vie d'un `.vviz`

```
Auteur (Mehdi)              Publisher ETL              Consommateur (Camille)
─────────────────           ───────────────            ─────────────────────
1. Écrit spec.vviz          1. Génère .parquet         1. Reçoit lien UNC
   (VS Code + schéma)          (job batch)                par mail / portail
2. Pousse sur Git              ↓                          ↓
   (revue PR)                  Dépose sur                 Double-clic .vviz
   ↓                           \\CPAM92\share\           → VaultViz s'ouvre
3. Publisher déploie           dashboards\               → lit Parquet via UNC
   le .vviz sur le share                                  → rendu interactif
```

### 5.2 Comportement applicatif

- **Démarrage** : VaultViz se lance soit par double-clic `.vviz`, soit par lancement direct (mode galerie listant les `.vviz` accessibles via un manifest optionnel `vault.json`).
- **Mode déconnecté** : un `.vviz` peut référencer des données **locales au poste** (`./data/x.parquet` ou `C:/...`). Cas d'usage : auteur en train d'écrire une spec, démo offline, déplacement professionnel avec données extraites. La capability FS doit autoriser ce chemin local séparément du share.
- **Lecture** : strictement read-only sur le share. Aucune écriture, aucun fichier de cache stocké sur le share. Cache local autorisé dans `%LOCALAPPDATA%\VaultViz\cache\`.
- **Connectivité** : **zéro port réseau ouvert en écoute, zéro appel sortant**. Pas de télémétrie, pas d'updater applicatif (cf. §10.2). VaultViz est un binaire entièrement hors-ligne.
- **Rafraîchissement** : déclenché par F5 manuel ou par notification du watcher (bannière non intrusive). Jamais automatique sans action utilisateur, pour éviter de casser une analyse en cours.
- **Erreurs** : tout message d'erreur doit être actionnable (chemin attendu, action conseillée, contact publisher). Aucun stack trace brut à l'utilisateur final ; logs détaillés dans le fichier local.

### 5.3 Format `.vviz` — spécification

Un `.vviz` est un **document JSON** suivant ce schéma de haut niveau :

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
      { "name": "effectifs", "path": "//cpam92/share/dashboards/effectifs_2026.parquet" },
      { "name": "geo_dept", "path": "//cpam92/share/ref/departements.topojson" }
    ]
  },
  "spec": {
    "...": "spec Mosaic/vgplot référençant data.sources.effectifs et data.sources.geo_dept (format JSON exact à figer en I2 du V0)"
  }
}
```

Règles :

- L'enveloppe `vviz.*` ajoute les métadonnées, le bloc `data.sources` centralise les chemins (un seul endroit à modifier si le partage migre), et `spec` contient la spec Mosaic/vgplot.
- Les `path` peuvent être **UNC** (`//host/share/...`), **chemin relatif** au `.vviz` (`./data/effectifs.parquet`), ou **lettre de lecteur mappée** (`Z:/dashboards/...`).
- Format `path` recommandé : UNC en double slash `//host/share/...` plutôt que `\\host\share\...` (compatibilité parsers, observée sur DuckDB extensions).
- Un schéma JSON public sera publié sur `vaultviz.fr/schema/v1.json` (ou équivalent interne CPAM) pour validation IDE.

### 5.4 Manifest `vault.json` (optionnel)

Pour permettre une UX de galerie sans imposer la navigation Explorer :

```json
{
  "$schema": "https://vaultviz.fr/schema/manifest-v1.json",
  "vault": {
    "name": "Dashboards CPAM 92",
    "version": "2026.05",
    "owner": "DSI CPAM 92",
    "contact": "dsi@cpam92.fr"
  },
  "dashboards": [
    {
      "id": "effectifs-2026",
      "path": "./dashboards/effectifs_2026.vviz",
      "category": "RH",
      "audience": ["cadres", "direction"]
    }
  ]
}
```

Si `vault.json` est présent à la racine du share, VaultViz peut afficher une page d'accueil de galerie. Sinon, navigation Explorer classique.

---

## 6. Architecture technique (décisions verrouillées)

### 6.1 Stack — vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────────┐
│  Partage SMB/UNC (read-only pour utilisateurs, write pour publisher) │
│                                                                       │
│   //cpam92/share/                                                     │
│      ├── vault.json              (manifest optionnel)                 │
│      ├── dashboards/                                                  │
│      │   ├── effectifs_2026.vviz       (spec, ~10–50 Ko)             │
│      │   └── effectifs_2026.parquet    (données, 50 Mo – 1 Go)       │
│      └── ref/                                                         │
│          ├── departements.topojson     (~80–150 Ko, mutualisé)        │
│          └── communes.topojson         (~2–4 Mo, à la demande)        │
└─────────────────────────────────────────────────────────────────────┘
                              ▲
                              │ SMBv3 random read, streaming, RO ACL
                              │
┌─────────────────────────────┴───────────────────────────────────────┐
│  Poste utilisateur — VaultViz.exe (Tauri 2.x, MSI déployé via MECM)  │
│                                                                       │
│   ┌──────────────────┐    ┌──────────────────┐    ┌───────────────┐  │
│   │  Rust core       │    │  DuckDB natif    │    │  WebView2     │  │
│   │  ─────────       │    │  (bundled)       │    │  ──────────   │  │
│   │  • fs reader UNC │───▶│  • Parquet read  │───▶│  • Mosaic +   │  │
│   │  • fs watcher    │    │  • SQL push-down │    │    vgplot     │  │
│   │  • capabilities  │    │  • Arrow IPC out │    │  • MapLibre   │  │
│   │  • IPC channel   │    │                  │    │  • theme (cust)│  │
│   └──────────────────┘    └──────────────────┘    └───────────────┘  │
│                                                                       │
│   Cache local %LOCALAPPDATA%\VaultViz\  (LRU, plafond 2 Go)           │
└─────────────────────────────────────────────────────────────────────┘
```

### 6.2 Bibliothèques retenues

> ⚠️ **Note sur le versionnage** : les versions précises ne sont pas figées dans ce PRD. La règle est : **dernière minor stable au moment du démarrage du POC**, verrouillée ensuite par lockfile (`Cargo.lock`, `package-lock.json`) jusqu'à la prochaine revue d'ADR. Les URLs ci-dessous pointent vers les pages de release officielles, pas vers une version particulière.

| Couche | Choix verrouillé | Référence |
|---|---|---|
| Shell desktop | **Tauri 2.x** (ligne 2.x stable) | [tauri.app/release](https://v2.tauri.app/release/) |
| Webview Windows | WebView2 Evergreen (mise à jour parc via Windows Update) | [Tauri WebView versions](https://v2.tauri.app/reference/webview-versions/) |
| Moteur SQL | **DuckDB natif via `duckdb-rs`** (feature `bundled`) | [duckdb-rs](https://crates.io/crates/duckdb), [DuckDB releases](https://duckdb.org/release_calendar) |
| Format données | **Parquet** (Snappy ou ZSTD), **Arrow IPC** pour transit Rust↔WebView | [Apache Arrow releases](https://arrow.apache.org/release/) |
| Grammaire viz | **Mosaic + vgplot** (UW IDL) — push-down DuckDB natif, coordination cross-vues built-in | [idl.uw.edu/mosaic](https://idl.uw.edu/mosaic/), [github.com/uwdata/mosaic](https://github.com/uwdata/mosaic) |
| Cartographie | **MapLibre GL JS** + **PMTiles** (fond minimal embarqué) | [maplibre.org](https://maplibre.org/maplibre-gl-js/) |
| Référentiel géo | **IGN ADMIN EXPRESS COG simplifiée**, édition la plus récente disponible, conversion TopoJSON | [geoservices.ign.fr/adminexpress](https://geoservices.ign.fr/adminexpress) |
| Plugins Tauri | `plugin-fs` (scope UNC explicite), `plugin-fs-watch`, `plugin-deep-link`, `plugin-single-instance` (pas d'updater applicatif : cf. ADR-008 / §10.2) | [Tauri plugins](https://v2.tauri.app/plugin/) |
| Bundler | `tauri-bundler` cible **MSI (Windows 11)** uniquement | [tauri.app/distribute](https://v2.tauri.app/distribute/) |
| Signature | **Hors scope produit** — MSI signable produit par la CI, signature opérée par la DSI selon ses procédures | — |
| Export PDF | Bibliothèque PDF côté front (pdf-lib, jsPDF, ou impression via WebView2 `chrome.printing`) | — |

Toute version précise mentionnée par ailleurs dans ce document doit être lue comme **indicative au moment de la rédaction** ; le verrouillage opérationnel se fait en début de POC.

### 6.3 Décisions architecturales clés (ADRs synthétisés)

#### ADR-001 — DuckDB **natif** via `duckdb-rs`, pas WASM

**Décision** : embarquer DuckDB en natif via le crate `duckdb-rs` avec feature `bundled` (compilation statique, aucune dépendance système).

**Justification** :
- DuckDB-WASM ne peut **pas spiller sur disque** et reste mono-thread ; au-delà de quelques centaines de Mo en pratique, expérience dégradée. Source écosystème : [DuckDB-WASM discussions](https://github.com/duckdb/duckdb-wasm/discussions).
- DuckDB-WASM est **significativement plus lent** que natif sur Parquet (facteur observé ~4× sur cas courants). Référence : [discussions perf DuckDB](https://github.com/duckdb/duckdb/discussions).
- Le plafond mémoire WASM (4 Go en wasm32) est levable via memory64 dans les navigateurs récents, mais au prix d'une perte de performance et d'un support DuckDB-WASM non-default.
- Pour lire un partage SMB depuis WebView2, WASM doit passer par un bridge JS → coût IPC évitable. Natif lit le chemin UNC directement.

**Conséquence** : pas de DuckDB-WASM en V1. WASM réétudié en V2 uniquement si un cas d'usage browser-only émerge.

#### ADR-002 — **Mosaic + vgplot** comme moteur de rendu V1

**Décision** : moteur de rendu = **Mosaic** (UW IDL) + grammaire haut-niveau **vgplot**.

**Justification** :
- Architecture conçue dès l'origine pour DuckDB : les transformations (agrégations, binning, filtres) sont compilées en SQL et **poussées dans DuckDB**, pas exécutées côté JS. Aligné par construction avec ADR-001 (DuckDB natif).
- Cross-filter et coordination de vues sont des **primitives natives** (sélections partagées entre vues via un coordonnateur unique) — pas un assemblage de patterns à coder.
- Performance par ordre de grandeur supérieure à Vega-Lite sur les volumes cibles (papier IEEE VIS 2024 : *« Mosaic outperforms Vega, VegaFusion, and Observable Plot, typically by one or more orders of magnitude »*).
- Grammaire vgplot inspirée de Vega-Lite / ggplot / Observable Plot — courbe d'apprentissage modérée pour un auteur familier de ces outils.

**Caveat documenté** : les mainteneurs Mosaic signalent dans leur README que la lib n'est pas formellement « production-ready » à la date de rédaction (API encore mouvante). Mitigation :
- **Verrouiller la version** au démarrage du POC dans le lockfile et ne pas suivre `main`.
- Maintenir une **fine couche d'abstraction `viz-engine`** côté front pour isoler les appels Mosaic et permettre un repli sur Vega-Lite uniquement si Mosaic se révèle bloquant en POC (escalade I2 du V0).
- Re-tester à chaque mise à jour Mosaic en CI.

**Conséquence** : le champ `engine` du `.vviz` vaut `"mosaic"` par défaut. Format de spec = vgplot (à confirmer en POC : JSON pur ou DSL à transformer en JSON via préprocesseur côté Rust).

#### ADR-003 — Parquet comme format pivot, Arrow IPC pour transit

**Décision** : Parquet (Snappy par défaut, ZSTD pour gros volumes archivés) est le **seul** format de données de production sur le share. Arrow IPC sert au transport Rust → WebView2.

**Justification** :
- Parquet est compressé, supporte predicate pushdown / column pruning / row group skipping — gain de l'ordre de **deux ordres de grandeur** vs JSON sur scans analytiques selon les benchmarks publics (Spark, AWS Athena, etc.).
- JSON pour des données métier > 10 Mo est explicitement banni : overhead, pas de pushdown, parse mémoire prohibitive.
- Arrow IPC en transit : zéro-décode côté JS via Arrow.js, support natif côté DuckDB.

**Conséquence** : le pipeline ETL publisher **doit** sortir du Parquet. Toute exception (CSV legacy) est traitée par conversion en amont, pas dans VaultViz.

#### ADR-004 — Tauri 2.x, pas Electron ni Wails v3

**Décision** : Tauri 2.x (dernière minor stable).

**Justification** :
- Wails v3 n'est pas GA à la date de rédaction ; exclu pour déploiement large échelle tant que statut alpha/beta. À réévaluer au démarrage. Source : [v3.wails.io/whats-new](https://v3.wails.io/whats-new/).
- Electron : Chromium embarqué = bundle nettement plus lourd (ordre de grandeur 10×) que Tauri ; RAM idle supérieure ; sur Windows l'écart RAM se réduit (WebView2 vs Chromium) mais le bundle reste pénalisant.
- Tauri capability model (ACL JSON par fenêtre) cadre mieux avec une revue PSSI : permissions explicitement déclarées, scope FS limité à `//<host>/<share>/**`.

**Conséquence** : montée en compétence Rust nécessaire côté core. Vibe coding compense en grande partie ; reste les sujets durs (Tauri plugins custom, bindings DuckDB).

#### ADR-005 — MSI signable produit par la CI ; signature et déploiement = DSI

**Décision** : le build produit un **MSI signable** en sortie de CI. La signature de code et le déploiement parc relèvent de la DSI CPAM 92 selon ses procédures en vigueur (PKI interne, AppLocker, MECM/Intune).

**Conséquence** : le PRD ne tranche ni le type de certificat, ni le mode de stockage de clé, ni la procédure de signature. Ces choix sont externes au produit.

#### ADR-006 — MSI via `tauri-bundler`, pas MSIX

**Décision** : cible installeur = **MSI** (via tauri-bundler `"targets": ["msi"]`) pour Windows.

**Justification** :
- MSI = standard MECM/Intune historique, déploiement silencieux maîtrisé.
- MSIX recommandé « forward-looking » par Microsoft, mais Tauri ne génère pas nativement MSIX → friction de repackaging.
- AppLocker / WDAC s'accommodent du MSI signé.

**Conséquence** : MSIX étudié en V2 si la DSI CPAM impose modern packaging.

#### ADR-007 — UNC paths : forme `//host/share/...`, scope FS explicite

**Décision** : tous les chemins data dans les `.vviz` utilisent `//host/share/...` (double slash, séparateurs `/`). Le scope du plugin-fs Tauri est élargi en capabilities à `//cpam92/share/**` (ou équivalent par déploiement).

**Justification** :
- Certaines extensions DuckDB parsent mal `\\host\share\...` (issue duckdb-delta #183).
- Tauri `FilePath` documente la conversion UNC, mais le scope glob doit l'inclure explicitement — **à valider en POC** (hypothèse H1).

**Conséquence** : doc auteur de spec doit imposer cette convention. Validation côté schéma JSON `.vviz`.

#### ADR-008 — Aucun port réseau, aucun appel sortant, pas d'updater applicatif

**Décision** : VaultViz n'ouvre aucun port en écoute. **Aucune connexion sortante n'est effectuée** : pas d'updater intégré, pas de télémétrie, pas de phone-home. Toutes les mises à jour sont poussées par MECM/Intune (cf. §10.2).

**Justification** : alignement strict avec philosophie local-first + facilite la revue PSSI/RSSI. Un binaire 100 % hors-ligne est plus facile à valider qu'un binaire avec exceptions.

**Conséquence** : pas de Sentry, pas de Google Analytics, pas de plugin updater, pas d'endpoint à héberger. Logs en local exclusivement.

---

## 7. Pipeline data & gouvernance

VaultViz **ne traite pas** la gouvernance des sources — mais le projet ne peut réussir sans elle. Le PRD pose les exigences minimales que le **publisher ETL** (hors scope mais condition préalable) doit garantir.

### 7.1 Exigences minimales publisher

| Exigence | Justification |
|---|---|
| **Un seul writer** sur le share : un job batch identifié (compte de service AD), aucun humain | Évite les conflits, garantit la traçabilité |
| **Atomicité d'écriture** : produire dans un répertoire temporaire, puis renommer | Évite qu'un VaultViz ouvert lise un Parquet à moitié écrit |
| **Versionnage** : suffixe `_YYYYMMDD` ou symlink `latest` | Permet rollback et reproductibilité |
| **Manifest mis à jour** : `vault.json` recalculé à chaque cycle | Galerie VaultViz à jour |
| **Validation schéma** : checksum + comptage de lignes loggés | Détection des incidents amont |
| **Référentiels mutualisés** : un seul `departements.topojson` versionné en `ref/` | Évite la duplication par dashboard |

### 7.2 Cycle de vie de la donnée

```
Source SI (BDD, API)
        │
        ▼
Extraction (Airflow / scripts internes, hors scope VaultViz)
        │
        ▼
Transformation (SQL/pandas/Polars, hors scope VaultViz)
        │
        ▼
Écriture Parquet (Snappy par défaut, ZSTD si > 200 Mo après compression)
        │
        ▼
Dépôt atomique sur \\CPAM92\share\dashboards\
        │
        ▼
[Notification optionnelle vers MEP : mail aux auteurs de spec]
        │
        ▼
VaultViz (consommation) — UNIQUEMENT en lecture
```

### 7.3 Conventions de nommage

- Parquet : `<sujet>_<période>.parquet`, ex. `effectifs_2026.parquet`, `actes_mensuel_2026Q2.parquet`.
- `.vviz` : `<sujet>_<perspective>.vviz`, ex. `effectifs_2026_carto.vviz`, `effectifs_2026_serietemp.vviz`.
- Ref géo : `departements.topojson`, `communes.topojson`, `regions.topojson`.

---

## 8. Sécurité & conformité

### 8.1 Modèle de menace (v0)

| Menace | Vecteur | Mitigation |
|---|---|---|
| **`.vviz` malveillant** modifiant un autre fichier ou exfiltrant des données | Spec contenant des expressions ou du SQL hostiles | Mosaic/vgplot est déclaratif et compile vers SQL DuckDB ; auditer la surface d'injection SQL côté Mosaic (paramètres utilisateur, transforms) ; ne pas exposer côté JS d'évaluation arbitraire ; limiter le scope FS Tauri à `//<host>/<share>/**` pour qu'aucun chemin hors share ne soit lisible. |
| **Parquet forgé** déclenchant un crash DuckDB | Parquet sur un share contrôlé uniquement (publisher) | ACL share strict + signature des Parquet (option V2 via DuckLake) |
| **Exfiltration** par une dépendance JS compromise (supply chain) | npm/cargo deps avec backdoor | SBOM généré au build (cargo-audit + npm audit), vendoring sélectif, lockfiles versionnés |
| **Élévation de privilège** depuis WebView2 | Faille Chromium / Tauri | Mises à jour applicatives poussées par MECM dès qu'un CVE significatif est publié ; WebView2 Evergreen tenu à jour par Windows Update |
| **Lecture non autorisée** d'un partage | ACL share mal configuré | Hors scope VaultViz : ACL gérées côté AD/share par l'équipe SI |
| **Modification d'un `.vviz` redéployé** | Auteur non autorisé pousse un `.vviz` | ACL d'écriture sur `\dashboards\` restreinte au compte publisher |
| **Phishing par fichier `.vviz`** reçu par mail | Utilisateur ouvre un `.vviz` envoyé par tiers | Limiter par stratégie Outlook le filtre des pièces jointes ; afficher dans VaultViz le chemin source au démarrage |

### 8.2 Conformité

| Référentiel | Statut | Action |
|---|---|---|
| **PSSI-MCAS** (Sécurité Sociale) | À valider | Dossier RSSI CPAM 92 dès V0 (avis préliminaire), revue V1 |
| **PSSI-E** (État) | Indirect (CPAM = OSS) | Conformité indirecte si PSSI-MCAS validée |
| **ANSSI / qualification** | Non requis | Outil interne non-cybersécurité ; pas d'obligation de qualification |
| **RGPD** | Hors périmètre VaultViz | VaultViz n'est qu'un **interprétateur** au sens Obsidian : il ne crée pas de traitement de données nouveau, ne duplique pas, ne stocke pas, n'expose pas. La conformité RGPD est **assurée en amont** par : (1) la gouvernance du publisher (qui choisit ce qui est versé dans les Parquet), (2) les **permissions fichiers/ACL** sur l'arborescence du partage (qui peut lire quoi). Un utilisateur qui ne peut pas lire le fichier sur le share ne peut pas l'ouvrir avec VaultViz — la chaîne d'autorisation est celle du SI, pas celle de l'application. |

### 8.3 Logs & audit

- Logs locaux uniquement : `%LOCALAPPDATA%\VaultViz\logs\YYYY-MM-DD.log`, rotation 7 jours, plafond 50 Mo.
- Niveaux : ERROR, WARN, INFO ; pas de DEBUG en V1 sans toggle.
- Pas de PII journalisée. Chemin source du `.vviz` ouvert + horodatage + version VaultViz uniquement.
- MECM peut collecter ces logs si la DSI le souhaite (chemin standard, format texte).

---

## 9. Performance & SLO

### 9.1 Objectifs mesurables

| Métrique | Cible V0 | Cible V1 | Méthode mesure |
|---|---|---|---|
| Temps démarrage (clic → fenêtre) | < 3 s | < 2 s | Trace Tauri start + log app |
| Temps premier rendu (Parquet 50 Mo) | < 3 s | < 2 s | Marqueur perf JS |
| Temps premier rendu (Parquet 300 Mo) | < 8 s | < 5 s | Idem |
| Temps drill-down (clic département) | < 1 s | < 500 ms | Marqueur perf JS |
| Empreinte RAM (Parquet 300 Mo, vue active) | < 800 Mo | < 600 Mo | Task Manager / Process Explorer |
| Taille MSI | n/a | < 30 Mo | Build artifact |
| Lecture initiale Parquet 1 Go sur SMBv3 LAN | < 15 s | < 10 s | Bench dédié |

### 9.2 Stratégies si dépassement

| Cas | Stratégie |
|---|---|
| Parquet > 1 Go | Recommander partitionnement par publisher (`effectifs_2026_part1.parquet`, ...) + UNION ALL via DuckDB |
| Carto avec 35 000 communes | Charger à la demande au zoom (lazy load TopoJSON par département) via MapLibre tile sources |
| Cross-filter sur 5+ vues simultanées | Mosaic gère nativement via son coordonnateur (push-down DuckDB) ; ajuster les `params` partagés et l'agrégation côté SQL |
| RAM excessive | Activer `temp_directory` DuckDB sur SSD local (`%LOCALAPPDATA%\VaultViz\tmp\`), spilling automatique |

---

## 10. Distribution, signature & mise à jour

### 10.1 Chaîne de distribution

```
GitHub privé (organisation CPAM) ─push─▶ GitHub Actions
                                          │
                                          ├─ Build Tauri Windows
                                          ├─ Génération MSI signable
                                          ├─ Génération SBOM (cargo + npm)
                                          └─ Upload artefact (release GitHub privée)
                                                         │
                                                         ▼
                                          [Hors scope produit]
                                          Signature + déploiement
                                          par la DSI CPAM 92 selon
                                          ses procédures (MECM/Intune)
```

Aucune infrastructure serveur n'est introduite par VaultViz. Le produit s'arrête à un **MSI signable** ; la suite (signature, packaging MECM, push parc) relève de la DSI.

### 10.2 Mise à jour

**Pas d'updater applicatif intégré.** Toutes les mises à jour sont **poussées par MECM/Intune** selon les procédures standard du parc CPAM 92. Aucun endpoint HTTP n'est appelé par VaultViz au démarrage ni en fonctionnement.

Conséquences :
- Pas de plugin `tauri-plugin-updater`.
- Pas d'URL de manifest à héberger, pas de service à exploiter.
- Le cycle de mise à jour est piloté par la DSI selon ses fenêtres habituelles.
- Le numéro de version est affiché dans l'application (À propos) pour faciliter le support.

### 10.3 Désinstallation

- MSI propre, désinstallation via Apps & Features ou via MECM.
- Pas de modification registre hors clé d'association d'extension `.vviz`.
- Cache local effacé à la désinstallation.

---

## 11. Plateforme cible

**Windows 11 exclusivement.** Parc CPAM 92 cible homogène.

Hors scope V1 et V2 : Linux, macOS, mobile, web. Aucun build multi-plateforme produit, aucune dette à porter sur ce front.

---

## 12. Critères de succès / Go-No-Go

### 12.1 V0 → V1

| Critère | Seuil Go | Seuil No-Go |
|---|---|---|
| UC-1 + UC-3 + UC-6 fonctionnels Parquet 50 Mo | ✅ | ❌ |
| Temps drill-down Parquet 300 Mo | < 1 s | > 3 s |
| RAM Parquet 300 Mo | < 800 Mo | > 1,5 Go |
| Avis RSSI préliminaire | Favorable avec conditions | Défavorable structurel |
| Hypothèse H1 (UNC scope Tauri) validée | ✅ | ❌ |
| Hypothèse H4 (drill via spec Mosaic/vgplot déclarative) validée | ✅ | Repli partiel JS toléré, > 50 lignes JS métier = No-Go |

### 12.2 V1 → déploiement large

| Critère | Seuil Go | Seuil No-Go |
|---|---|---|
| ≥ 80 % cadres pilotes installent + ouvrent sans assistance | ✅ | < 50 % |
| Aucun incident PSSI bloquant | ✅ | Bloquant identifié non résolvable |
| MSI signable accepté par la DSI et déployable via MECM | ✅ | Refus DSI sur les artefacts produits |
| Export PDF A4 fonctionnel sur tous les types de vues V1 | ✅ | PDF non générable ou rendu dégradé |
| Performance V1 atteinte sur 90 % des cas testés | ✅ | < 70 % |

---

## 13. Risques résiduels & mitigations

| # | Risque | Probabilité | Impact | Mitigation |
|---|---|---|---|---|
| R-1 | Le MSI produit ne passe pas les procédures DSI (incompatibilité bundler / politique de signature interne) | Faible | Moyen | Livrer un MSI de test à la DSI dès I6 du V0 pour validation rapide |
| R-2 | UNC scope Tauri non opérationnel out-of-the-box | Moyenne | Élevé | POC itération 0 dédiée, plan B = mapper en lettre de lecteur via MECM |
| R-3 | Performance Parquet > 1 Go inacceptable | Faible | Élevé | Partitionnement publisher, spilling DuckDB local SSD |
| R-4 | Concurrent OSS publie un wrapper desktop équivalent (ex. Evidence.dev en .exe) | Moyenne | Élevé | Veille active, accélérer V1 ; différenciation : no-code, design soigné, intégration parc CPAM |
| R-5 | Rendu PDF dégradé sur certaines vues (carto MapLibre WebGL) | Moyenne | Moyen | Tester pipeline export PDF dès V0 sur la carte ; fallback : capture canvas → PDF via pdf-lib |
| R-6 | RGPD : données nominatives exposées via mauvaise ACL share | Faible | Très élevé | Hors scope VaultViz — relève de la gouvernance des ACL du partage par la DSI ; VaultViz n'est qu'un interprétateur |
| R-7 | Adoption cadres en deçà de 50 % | Moyenne | Élevé | Test terrain V1 sur 10–20 cadres pilotes avant push large, itération UX |
| R-8 | Mosaic (non production-ready à la rédaction) se révèle bloquant en POC (API mouvante, bug, feature manquante) | Moyenne | Élevé | Couche d'abstraction `viz-engine` permet repli sur Vega-Lite (ADR-002) ; verrouillage de version au lockfile ; escalade dès I2 du V0 |
| R-9 | Tauri 3 sort avec breaking changes majeurs | Faible | Moyen | Verrouillage version dans `Cargo.lock`, migration planifiée |
| R-10 | Pipeline publisher défaillant (un seul writer non garanti) | Moyenne | Moyen | Documenter exigences §7 et auditer publisher en amont |

---

## 14. Roadmap itérative

Approche **vibe coding** : itérations courtes, valeur démontrée à chaque étape, pas d'engagement calendaire ferme. Chaque itération produit un livrable testable.

### 14.1 V0 — itérations

| Itération | Livrable | Validation |
|---|---|---|
| I0 — Squelette | Tauri 2.x + plugin-fs scope UNC + lecture fichier `.vviz` brut | Ouvre un JSON, l'affiche en raw |
| I1 — DuckDB intégré | duckdb-rs bundled + requête Parquet via UNC + retour Arrow IPC | `SELECT COUNT(*) FROM '//share/test.parquet'` OK |
| I2 — Mosaic | WebView2 + Mosaic/vgplot + connexion à DuckDB natif via Arrow IPC | Carte choroplèthe France figée, format de spec vgplot figé |
| I3 — Interactivité | Selections Mosaic (push-down DuckDB) + cross-filter 2 vues | UC-3 démontré |
| I4 — Drill-down | Configuration spec drill-down département → tableau | UC-1 complet |
| I5 — Erreurs | Spec invalide, fichier manquant, message lisible | UC-6 démontré |
| I6 — MSI signable | Produire un MSI propre via tauri-bundler ; livrer à la DSI pour test de signature | DSI peut signer et installer un MSI de test |
| **I7 — Go/No-Go V0** | Démo interne RSSI + 2 cadres invités | Critères §12.1 |

### 14.2 V1 — itérations (sous condition Go V0)

| Itération | Livrable |
|---|---|
| V1-1 | MapLibre intégré + PMTiles offline |
| V1-2 | TopoJSON IGN ADMIN EXPRESS 2026 + drill carto |
| V1-3 | Watcher FS + bannière rafraîchissement |
| V1-4 | **Export PDF A4** (exigence) + PNG + CSV |
| V1-5 | Intégration du design custom (maquette) — cf. ADR-012 |
| V1-6 | Coordination DSI pour signature production du MSI (hors scope produit, point de jonction) |
| V1-8 | Doc utilisateur + doc auteur + schéma JSON dans le repo |
| V1-9 | Déploiement pilote MECM 10–20 postes Windows 11 |
| **V1-10 — Go/No-Go déploiement large** | Critères §12.2 |

### 14.3 V2 — backlog ouvert

- Éditeur visuel `.vviz` (low-code)
- DuckLake support
- Mode présentation
- Commentaires (`.vviz.notes.md`)
- Galerie templates (design custom)
- MSIX si la DSI le demande
- Repli Vega-Lite si Mosaic V1 se révèle insuffisant à l'usage (cf. R-8)

---

## 15. Décisions verrouillées (récapitulatif ADRs)

| # | Décision | Fichier | Source de référence |
|---|---|---|---|
| ADR-001 | DuckDB **natif** via `duckdb-rs` (bundled), pas WASM en V1 | [ADR-001](docs/adr/ADR-001-duckdb-natif.md) | [duckdb-rs](https://crates.io/crates/duckdb), [DuckDB](https://duckdb.org) |
| ADR-002 | **Mosaic + vgplot** en V1 (push-down DuckDB) ; fine couche d'abstraction `viz-engine` pour repli éventuel | [ADR-002](docs/adr/ADR-002-mosaic-vgplot.md) | [Mosaic](https://idl.uw.edu/mosaic/), [Mosaic IEEE VIS 2024](https://idl.cs.washington.edu/files/2024-Mosaic-TVCG.pdf) |
| ADR-003 | Parquet (pivot) + Arrow IPC (transit Rust↔JS) ; JSON banni pour data | [ADR-003](docs/adr/ADR-003-parquet-arrow.md) | [Apache Arrow](https://arrow.apache.org) |
| ADR-004 | Tauri 2.x ; Electron et Wails v3 (alpha) écartés | [ADR-004](docs/adr/ADR-004-tauri-2.md) | [Tauri 2](https://v2.tauri.app), [Wails v3](https://v3.wails.io/whats-new/) |
| ADR-005 | MSI signable produit par la CI ; signature et déploiement = DSI (hors scope produit) | [ADR-005](docs/adr/ADR-005-signature-dsi.md) | — |
| ADR-006 | MSI via `tauri-bundler` ; MSIX en V2 si demandé | [ADR-006](docs/adr/ADR-006-msi-bundler.md) | [Tauri distribute](https://v2.tauri.app/distribute/) |
| ADR-007 | UNC `//host/share/...` ; scope FS Tauri explicite | [ADR-007](docs/adr/ADR-007-unc-paths.md) | À valider en POC (H1) |
| ADR-008 | Aucun port ouvert, **aucun appel sortant**, pas de télémétrie, pas d'updater applicatif ; logs locaux ; MAJ via MECM | [ADR-008](docs/adr/ADR-008-no-network.md) | Principe local-first |
| ADR-009 | Carto = MapLibre GL JS + TopoJSON IGN ADMIN EXPRESS COG simplifiée | [ADR-009](docs/adr/ADR-009-maplibre-ign.md) | [IGN ADMIN EXPRESS](https://geoservices.ign.fr/adminexpress), [MapLibre](https://maplibre.org/) |
| ADR-010 | **Windows 11 exclusivement** — pas de build multi-plateforme | [ADR-010](docs/adr/ADR-010-windows-11-only.md) | — |
| ADR-011 | **Export PDF A4** comme exigence V1 explicite (UC-4) | [ADR-011](docs/adr/ADR-011-export-pdf-v1.md) | — |
| ADR-012 | **Design system custom** (sombre/clair, tokens, polices embarquées) supersede DSFR/Marianne | [ADR-012](docs/adr/ADR-012-design-system.md) | Maquette `mockups/VaultViz/` |

### 15.1 RACI des ADRs

| Rôle | Responsabilité |
|---|---|
| **Auteur du PRD (A. Bergé)** | Rédige, propose, maintient les ADRs |
| **Sponsor DSI CPAM 92** | Valide les ADRs ayant un impact sur le SI / déploiement (001, 004, 005, 006, 008, 010, 011) |
| **RSSI CPAM 92** | Valide les ADRs sécurité (005, 007, 008) ; avis sur l'ensemble |
| **Architecte SI** | Consulté sur ADRs techniques (001, 002, 003, 004, 007) |
| **Data analyst lead** | Consulté sur ADRs format/grammaire (002, 003, 011) |
| **Publisher ETL (équipe data)** | Consulté sur ADR-003 (Parquet pivot) |

Toute modification d'ADR fait l'objet d'une **revue formelle** (PR sur le repo PRD) signée a minima par le Sponsor DSI et le RSSI quand le sujet l'implique.

---

## 16. Questions ouvertes (à clore avant ou pendant V0)

**Décisions déjà actées** :
- ✅ Plateforme cible : **Windows 11 uniquement** (parc CPAM 92)
- ✅ Hébergement repo source : **GitHub privé** (organisation CPAM)
- ✅ Signature et déploiement parc : **hors scope produit**, géré par la DSI
- ✅ Mise à jour : **MECM/Intune** uniquement, pas d'updater applicatif
- ✅ **Export PDF A4** : exigence explicite V1
- ✅ Moteur de rendu : **Mosaic + vgplot** en V1 (ADR-002)

**Questions à clore avant V0** :

1. **Compte publisher** : qui détient le compte de service AD qui écrira sur `\\CPAM92\share\dashboards\` ? Quel processus de gouvernance ?
2. **Point de contact DSI** pour la jonction MSI signable → signature + déploiement parc. Itération I6 du V0 doit livrer un artefact testable.
3. **PMTiles fond de carte** : utilise-t-on un fond OpenStreetMap embarqué (PMTiles France ~50 Mo) ou un fond IGN ? Implication licence et taille MSI.
4. **Schéma `.vviz`** : versionné dans le repo (URL `$schema` = raw GitHub privé accessible aux auteurs uniquement) — confirmer ce mode ou prévoir une copie locale.
5. **Test terrain V1** : panel de 10–20 cadres pilotes — quelle direction sponsor ?
6. **DuckLake** : activer le versioning des Parquet dès V1 ou attendre un besoin avéré ?
7. **Format `.vviz` étendu** : confirmer le format exact d'une spec vgplot (JSON pur ou DSL JS prétraité) dès I2 du V0.
8. **Stratégie export PDF** : impression WebView2 native (chrome.printing, fidélité maximale) vs bibliothèque pdf-lib (contrôle total, dépendance JS). À trancher en V0.
9. **Périmètre fonctionnel du fond de carte** : niveau communal nécessaire en V1 ou départemental suffit ? Impact taille MSI et complexité MapLibre.

---

## 17. Références bibliographiques (sources principales)

### Papiers académiques

- **Wilkinson, L.** (2005). *The Grammar of Graphics*, 2nd ed., Springer. ISBN 978-0-387-24544-7.
- **Satyanarayan, A., Moritz, D., Wongsuphasawat, K., & Heer, J.** (2017). « Vega-Lite: A Grammar of Interactive Graphics ». *IEEE Trans. Visualization & Computer Graphics* (Proc. InfoVis). Best Paper Award.
- **Kohn, A., Moritz, D., Raasveldt, M., Mühleisen, H., & Neumann, T.** (2022). « DuckDB-Wasm: Fast Analytical Processing for the Web ». *PVLDB Vol. 15 No. 12*. [Lien direct](https://www.vldb.org/pvldb/vol15/p3574-kohn.pdf).
- **Heer, J., & Moritz, D.** (2024). « Mosaic: An Architecture for Scalable & Interoperable Data Views ». *IEEE TVCG vol. 30 n°1*. DOI [10.1109/TVCG.2023.3327189](https://idl.cs.washington.edu/files/2024-Mosaic-TVCG.pdf).
- **Kruchten, N., et al.** (2022). « VegaFusion: Automatic Server-Side Scaling for Interactive Vega Visualizations ». arXiv:2208.06631.

### Sources techniques (références d'écosystème)

> Les liens ci-dessous pointent vers les pages canoniques des projets. Aucune version ni date précise n'est attestée par ce PRD — la version stable courante est à confirmer au démarrage du POC.

- DuckDB — <https://duckdb.org/>
- DuckDB releases / calendar — <https://duckdb.org/release_calendar>
- duckdb-rs (crate Rust) — <https://crates.io/crates/duckdb>
- Tauri 2 documentation — <https://v2.tauri.app/>
- Tauri releases — <https://v2.tauri.app/release/>
- Apache Arrow — <https://arrow.apache.org/>
- Vega-Lite — <https://vega.github.io/vega-lite/>
- Vega-Lite GitHub releases — <https://github.com/vega/vega-lite/releases>
- Mosaic (UW IDL) — <https://idl.uw.edu/mosaic/>
- Mosaic GitHub — <https://github.com/uwdata/mosaic>
- MapLibre GL JS — <https://maplibre.org/maplibre-gl-js/>
- PMTiles — <https://protomaps.com/docs/pmtiles>
- IGN ADMIN EXPRESS — <https://geoservices.ign.fr/adminexpress>
- DuckLake — <https://ducklake.select/>
- Perspective FINOS — <https://perspective.finos.org/>
- ChartsGouv (Etalab) — <https://github.com/etalab-ia/chartsgouv>
- Système de design de l'État (DSFR) — <https://www.systeme-de-design.gouv.fr/>

### Outils concurrents analysés

- Rill Data — <https://docs.rilldata.com/>
- Evidence.dev — <https://docs.evidence.dev/>
- Power BI .pbip/.pbir — <https://powerbi.microsoft.com/en-us/blog/pbir-will-become-the-default-power-bi-report-format-get-ready-for-the-transition/>
- Datasette — <https://datasette.io/>
- Tableau Reader — <https://www.tableau.com/products/reader>

---

## 18. Annexes

### A. Exemple `.vviz` — UC-1 carte départementale (esquisse Mosaic/vgplot)

> Le format exact d'une spec vgplot en JSON est à figer en I2 du V0 (cf. §16 question 7). L'exemple ci-dessous est indicatif et structurel ; il sera mis en conformité avec l'API Mosaic au démarrage.

```json
{
  "$schema": "https://vaultviz.fr/schema/v1.json",
  "vviz": {
    "version": "1.0",
    "title": "Effectifs CPAM par département — 2026",
    "author": "M. Mehdi",
    "engine": "mosaic"
  },
  "data": {
    "sources": [
      {
        "name": "effectifs",
        "path": "//cpam92/share/dashboards/effectifs_2026.parquet",
        "format": "parquet"
      },
      {
        "name": "geo",
        "path": "//cpam92/share/ref/departements.topojson",
        "format": "topojson",
        "feature": "departements"
      }
    ]
  },
  "spec": {
    "plots": [
      {
        "title": "Effectifs par département",
        "marks": [
          {
            "type": "geo",
            "data": { "from": "geo" },
            "fill": {
              "lookup": { "from": "effectifs", "on": "code_dept", "field": "effectif" }
            },
            "stroke": "white",
            "tooltip": ["properties.nom", "effectif"]
          }
        ],
        "params": {
          "dept_select": { "type": "point", "field": "properties.code" }
        }
      },
      {
        "title": "Détail département sélectionné",
        "marks": [
          {
            "type": "bar",
            "data": { "from": "effectifs", "filter": "code_dept = $dept_select" },
            "x": "categorie",
            "y": "effectif"
          }
        ]
      }
    ]
  }
}
```

### B. Arborescence projet recommandée

```
vaultviz/
├── src-tauri/                  # Rust core
│   ├── Cargo.toml
│   ├── src/
│   │   ├── main.rs
│   │   ├── duck.rs             # wrapper duckdb-rs
│   │   ├── vviz.rs             # parser .vviz
│   │   ├── fs_scope.rs         # validation UNC + scope
│   │   └── ipc.rs              # canaux Arrow IPC vers JS
│   ├── capabilities/
│   │   └── main.json           # ACL Tauri
│   └── tauri.conf.json
├── src/                         # Front WebView2
│   ├── index.html
│   ├── viz-engine/             # wrapper Mosaic + repli éventuel
│   ├── map/                    # MapLibre wrappers
│   ├── theme/                  # design system custom (tokens, thèmes)
│   └── ui/
├── schema/
│   ├── vviz-v1.json            # schéma JSON publié
│   └── manifest-v1.json
├── examples/
│   └── effectifs_2026.vviz
├── docs/
│   ├── user.md                 # 1 page utilisateur
│   ├── author.md               # 5 pages auteur de spec
│   └── adr/                    # un fichier par ADR
├── .github/workflows/
│   └── build-sign-release.yml
└── PRD.md                       # ce document
```

### C. Schéma JSON simplifié `.vviz` (extrait)

```json
{
  "$id": "https://vaultviz.fr/schema/v1.json",
  "type": "object",
  "required": ["vviz", "data", "spec"],
  "properties": {
    "vviz": {
      "type": "object",
      "required": ["version", "title"],
      "properties": {
        "version": { "const": "1.0" },
        "title": { "type": "string" },
        "description": { "type": "string" },
        "author": { "type": "string" },
        "engine": { "enum": ["mosaic", "vega-lite"], "default": "mosaic" }
      }
    },
    "data": {
      "type": "object",
      "required": ["sources"],
      "properties": {
        "sources": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name", "path"],
            "properties": {
              "name": { "type": "string" },
              "path": {
                "type": "string",
                "pattern": "^(//[^/]+/.+|\\./.+|[A-Za-z]:/.+)$"
              },
              "format": { "enum": ["parquet", "arrow", "topojson", "geojson", "csv"] }
            }
          }
        }
      }
    },
    "spec": { "type": "object" }
  }
}
```

---

**Fin du PRD v1.0.**

Toute modification structurelle (ADRs, périmètre V1) fait l'objet d'un amendement explicite avec date et motif. Les itérations de mise à jour mineure (typo, précision) sont versionnées en patch (1.0.x).
