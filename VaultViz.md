# Note d'opportunité — Outil de data-visualization local-first « fichier-comme-source » (nom de code provisoire : _VaultViz_)

## 1. Résumé exécutif

**Verdict : Go conditionnel.** Le paradigme « Obsidian appliqué à la dataviz » est techniquement faisable — la pile _Tauri 2 + DuckDB-WASM + Vega-Lite + Apache Arrow/Parquet_ permet aujourd'hui de produire, sans serveur applicatif, des visualisations interactives (filtres, drill-down cartographique) à partir de fichiers déposés sur un partage réseau. Cependant, l'objectif simultané de **(a)** déploiement large au collège cadres (utilisateurs non techniques, contraintes PSSI, MECM/Intune), **(b)** volumes très lourds (centaines de Mo, rafraîchissement fréquent) et **(c)** JSON comme source de vérité **n'est pas tenable tel quel** : JSON est inadapté au-delà de quelques dizaines de Mo, et un POC dirigé sur le cas d'usage cible (carte départementale cliquable) est un préalable indispensable avant tout engagement de roadmap.

La valeur clé est l'élimination du coût d'hébergement applicatif (pas de serveur Superset/Metabase/Grafana à exploiter, pas de licence Tableau Server/Power BI Premium) tout en conservant une logique BI-as-code versionable. Le risque clé est l'illusion d'un « zéro coût » : le coût se déplace du serveur vers le poste utilisateur (déploiement, signature, support) et vers la gouvernance du partage réseau.

## 2. Contexte et besoin

Le commanditaire utilise Obsidian dans un mode atypique mais éprouvé : un dossier sur serveur de fichiers partagé (CPAM92) sert de _vault_, et chaque collaborateur installe localement Obsidian, déclare ce dossier comme vault, et obtient une lecture interprétée (rendu Markdown, diagrammes Mermaid) de la documentation. Ce modèle évacue toute dépendance à un serveur applicatif : la « source de vérité » est constituée des fichiers, le rendu est local, les mises à jour sont synchrones via le système de fichiers.

Le besoin formulé est de transposer cette mécanique au domaine de la data-visualization :

- **Source de vérité** : fichiers structurés (JSON priorité, XML envisageable) sur un partage réseau.
- **Rendu** : un exécutable .exe installé sur chaque poste qui produit une visualisation **dynamique et interactive** (drill-down, filtres, navigation). Cas d'usage canonique : cartographie de la France où le clic sur un département ouvre les données détaillées du département.
- **Public** : large, incluant au minimum tout le collège cadres — donc non-techniciens, postes gérés en parc, contraintes PSSI standard du secteur public.
- **Volumétrie** : viser les jeux les plus lourds raisonnablement envisageables (plusieurs centaines de Mo), rafraîchis fréquemment.
- **Contraintes** : aucun serveur applicatif central, aucun hébergement à provisionner ; déploiement décentralisé par exécutable.
- **Exclusion explicite** : un plugin Obsidian n'est _pas_ une réponse acceptable (l'outil doit être autonome).

À noter : Obsidian lui-même ne tient pas réellement la promesse multi-utilisateur sur partage réseau (cf. fil officiel _« Multiuser cooperation over network shared vault »_ sur forum.obsidian.md : conflits de tabs/settings, absence de file locking) — c'est la _philosophie_ (local-first, file-as-source, déploiement décentralisé, interprétation locale) qui est à transposer, pas l'implémentation.

## 3. Concept proposé

**VaultViz** est un exécutable de bureau autonome, installé en dur sur les postes des collaborateurs (via le canal MECM/Intune existant), qui :

1. lit, en lecture seule, des fichiers de données et de configuration déposés sur un répertoire UNC (`\\CPAM92\share\...`) ou un lecteur réseau monté ;
2. interprète localement une **spécification déclarative de visualisation** (grammaire graphique type Vega-Lite) couplée à une référence vers le ou les fichiers de données ;
3. produit dans une fenêtre native une visualisation interactive (carte, barres, séries temporelles, réseau) avec drill-down, filtres et liens entre vues ;
4. n'expose aucun port réseau, n'écrit pas sur le partage, ne nécessite aucun service applicatif côté serveur.

L'utilisateur final, dans le scénario nominal, double-clique sur un fichier `.vviz` (la spécification) qui pointe vers les fichiers de données du partage, exactement comme on ouvre un `.pbix` ou un `.twbx` — mais sans dépendance à un service cloud ni à un serveur central.

## 4. Analyse technique et architecture recommandée

### 4.1 Question 1 — Le type de visualisation peut-il vivre dans le JSON de données ?

**Réponse : techniquement oui (JSON auto-descriptif), pratiquement non.** Mélanger données et spécification de rendu dans un même fichier est anti-pattern pour quatre raisons :

- **Couplage** : changer le type de graphique force à réécrire/régénérer le fichier de données ; impossible de proposer deux vues différentes de la même donnée.
- **Volumétrie** : sur des fichiers de plusieurs centaines de Mo, on ne va pas modifier la spécification de rendu en éditant un fichier géant.
- **Génération automatique** : les données sortent typiquement d'un ETL ou d'une extraction SI ; la spécification de rendu est conçue par l'analyste. Les deux ont des cycles de vie distincts.
- **Réutilisabilité** : la même spécification (« choroplèthe France par département ») doit pouvoir être appliquée à plusieurs jeux de données.

Ce constat est exactement celui qui a fondé la **Grammar of Graphics** de Leland Wilkinson (2ᵉ édition publiée le 15 juillet 2005 chez Springer, ISBN 978-0-387-24544-7 ; 1ʳᵉ édition 1999), puis ses implémentations (ggplot2 de Hadley Wickham — conçu en 2005 lors de son doctorat à Iowa State, première version publique sur CRAN en juin 2007 ; Vega/Vega-Lite chez UW Interactive Data Lab, papier IEEE InfoVis 2017, Best Paper Award). Le principe est universellement adopté côté outils modernes : Tableau (.twb XML + extracts .hyper), Power BI (.pbip = JSON de spécification + cache .abf), Evidence.dev (Markdown/SQL + données), Rill (YAML + Parquet/DuckDB), Datasette Dashboards (YAML + SQLite).

### 4.2 Question 2 — Faut-il découpler données et spécification de rendu ?

**Réponse : oui, et adopter une grammaire graphique déclarative existante plutôt que d'inventer un format propriétaire.**

L'architecture recommandée découple **trois** couches :

|Couche|Format|Rôle|Exemple|
|---|---|---|---|
|Données|Parquet (recommandé) ou Arrow IPC, JSON résiduel pour petits jeux|Source de vérité, posée sur le partage réseau|`effectifs_dept_2025.parquet`|
|Spécification de rendu|JSON Vega-Lite (extension `.vl.json`) ou wrapper `.vviz`|Décrit _quoi_ afficher et _comment_ interagir|`carte_effectifs.vviz`|
|Moteur|Exécutable VaultViz (Tauri) embarquant Vega/Vega-Lite + DuckDB-WASM|Interprète la spec + exécute les requêtes sur les données|`VaultViz.exe`|

Vega-Lite (Satyanarayan, Moritz, Wongsuphasawat, Heer — IEEE InfoVis 2017) est la référence : c'est précisément une grammaire JSON déclarative qui décrit, dans un même document, l'encodage visuel (marks, channels), les transformations de données (agrégations, binning, filtres) **et** l'interaction (selections). C'est très exactement ce que demande le cas d'usage.

> Citation du papier Vega-Lite (Satyanarayan et al., 2017) : _« Users specify interactive semantics by composing selections. In Vega-Lite, a selection is an abstraction that defines input event processing, points of interest, and a predicate function for inclusion testing. Selections parameterize visual encodings by serving as input data, defining scale extents, or by driving conditional logic. »_

Concrètement, le clic sur un département (mark) produit une _selection_ qui pilote, déclarativement, le filtrage d'une seconde vue détaillée — sans une ligne de JavaScript impératif.

### 4.3 Question 3 — Quelle interactivité réaliste en local-first sans backend ?

**Réponse : très élevée, à condition de choisir le bon format de données.**

Trois capacités modernes changent radicalement la donne par rapport à 2018 :

1. **DuckDB-WASM** (André Kohn, Dominik Moritz, Mark Raasveldt, Hannes Mühleisen, Thomas Neumann — _« DuckDB-Wasm: Fast Analytical Processing for the Web »_, PVLDB Vol. 15 No. 12, 2022) embarque un moteur OLAP colonnaire complet dans un binaire WebAssembly. Il lit directement Parquet, CSV, JSON et Arrow, exécute du SQL vectorisé en pipeline.

> Citation VLDB 2022 : _« We ran the benchmark at the scale factors 0.01, 0.1, and 0.5. A scale factor of 0.1 refers to approximately 100 MB of combined data, resulting in a range between 10 to 500 MB in the experiment. The WebAssembly memory is currently capped at 4 GB in browsers, leaving some room for higher scale factors. »_
> 
> Et : _« DuckDB-Wasm offers sub-second execution times for complex analytical queries on data sizes that may be considered large for the Web. … DuckDB-Wasm aims to complement database servers to increase the interactivity for browser-manageable data subsets. »_

Conséquences directes :

- la fenêtre de viabilité confortable se situe **entre 10 Mo et ~500 Mo de données réelles** sur poste de bureau standard (le plafond de 4 Go de mémoire WASM est dur côté navigateur, et une fenêtre Tauri 2 hérite des mêmes limites WebView2) ;
- les temps de réponse mesurés par les auteurs (moyenne géométrique sur TPC-H) sont de 0,003 s à SF 0,01, 0,013 s à SF 0,1 et 0,073 s à SF 0,5 — soit le sous-second jusqu'à ~500 Mo ;
- au-delà, il faut soit pré-agréger côté ETL, soit basculer sur un binding natif DuckDB côté Rust (Tauri permet ce contournement, hors WASM).

2. **Apache Arrow** comme format mémoire colonnaire zéro-copie partagé entre DuckDB-WASM et le moteur de rendu (Vega-Lite supporte Arrow).
    
3. **Perspective (FINOS)**, alternative complémentaire pour les pivots interactifs très réactifs (pivot, filtre, agrégat en sub-seconde sur jeux jusqu'à plusieurs millions de lignes), particulièrement éprouvée en finance (J.P. Morgan, RBC Capital Markets — voir le case study FINOS _« Perspective: A financial services open source success story »_).
    

**Interactions réalistes en local-first** : drill-down par sélection (clic département → vue détaillée), brush & zoom, cross-filtering entre vues liées, slicers, tooltip riche, recherche, tri multi-colonnes, animation temporelle. Ce sont les capacités natives de Vega-Lite et Perspective ; aucune n'exige de backend.

**Interactions exclues ou risquées** : agrégation sur multi-Go, jointures complexes sur dizaines de millions de lignes en JSON, écriture/collaboration multi-utilisateur, calcul partagé (à proscrire si la cible est local-first stricte).

### 4.4 Format de fichier de données — verdict tranché

JSON est inadapté à la cible volumétrique. Les benchmarks publics convergent :

- Le benchmark Spark sur 500 millions de lignes publié par Manoj Kukreja sur _Towards Data Science_ (25 septembre 2020) constate que _« JSON has the largest footprint whereas Parquet has the lowest »_ et que les opérations de tri sont les plus lentes en JSON, les plus rapides en Parquet et ORC.
- Le benchmark Chariot Solutions (Keith Gregory, novembre 2023) sur AWS Athena avec 100 millions d'événements clickstream rapporte que les requêtes Parquet scannent _« over two orders of magnitude less data »_ (≈ 100×) que les requêtes JSON équivalentes.
- Les auteurs de DuckDB-WASM (VLDB 2022, cité supra) tirent l'essentiel de leur performance du predicate pushdown sur les métadonnées de row group Parquet — impossible sur JSON.

À 300 Mo de données métier, un JSON gonfle facilement à 1,5–2 Go au repos et à 4–6 Go en mémoire après parse — au-delà du plafond WASM.

**Recommandation forte** : faire de **Parquet le format pivot** (avec Arrow IPC en alternative pour interopérabilité in-memory), et conserver JSON uniquement pour : (1) la spécification de rendu (Vega-Lite, naturellement JSON), (2) les petits fichiers de paramètres/référentiels (< 1 Mo), (3) les exports adhoc. XML est à proscrire : aucun écosystème dataviz moderne ne le supporte nativement, et son overhead est supérieur à JSON.

### 4.5 Framework d'exécutable desktop — Tauri vs Electron

|Critère|Tauri 2|Electron|
|---|---|---|
|Taille du binaire|Très petite (souvent < 10 Mo)|Lourde (souvent > 100 Mo, embarque Chromium)|
|Mémoire au repos|~30–50 Mo|150–500 Mo|
|Moteur web|WebView2 (Windows, déjà installé sur Win10/11 à jour)|Chromium embarqué|
|Sécurité|Modèle capability-based, opt-in explicite|Node API exposé par défaut, à durcir manuellement|
|Backend|Rust (compilé, plus difficile à rétro-ingénierer)|Node.js (asar dépacké en une commande)|
|Maturité écosystème|Plus jeune mais Tauri 2.0 stable depuis le 2 octobre 2024|Très mature (VS Code, Slack, Figma)|
|Signature Windows|Documentée (OV/EV, Azure Key Vault, signtool)|Idem|

**Recommandation : Tauri 2** pour ce projet — la taille réduite et le modèle de sécurité par capacités cadrent mieux avec une diffusion large et des audits PSSI. La contrepartie : compétence Rust requise pour les fonctions natives (lecture FS, watcher, intégration DuckDB native si volumes > 500 Mo). Si l'équipe n'a aucune compétence Rust, Electron reste une option défendable au prix d'un binaire 10×–15× plus lourd. À titre d'illustration, le billet officiel _« Introducing Hoppscotch Desktop Application »_ (Kiran Johns, hoppscotch.com/blog, 8 novembre 2023) annonce, pour leur client API migré d'Electron à Tauri : _« The Hoppscotch Desktop app is 20x lighter than Insomnia and 15x lighter than Postman when it comes to file size! »_ et _« Hoppscotch is 10x faster than Postman and 6x faster than Insomnia in terms of startup time. »_

### 4.6 Architecture cible recommandée (synthèse)

```
┌─────────────────────────────────────────────────────────────────┐
│         Partage réseau CPAM92 (lecture seule pour utilisateurs)  │
│                                                                  │
│  /dashboards/                                                    │
│     ├── effectifs_2025.vviz       (spec Vega-Lite, ~10 Ko)      │
│     ├── effectifs_2025.parquet    (données, ~50 Mo)             │
│     ├── geo/departements.geojson  (référentiel, mutualisé)      │
│     └── ...                                                      │
└─────────────────────────────────────────────────────────────────┘
                              ▲
                              │  lecture SMB/UNC, lazy + range reads
                              │
┌─────────────────────────────┴───────────────────────────────────┐
│  Poste utilisateur — VaultViz.exe (Tauri 2, ~15 Mo signé EV)    │
│                                                                  │
│   ┌──────────────┐   ┌─────────────────┐   ┌─────────────────┐ │
│   │ Rust core    │   │ DuckDB (natif   │   │ Front WebView2  │ │
│   │  - FS reader │──▶│   ou WASM selon │──▶│  - Vega-Lite    │ │
│   │  - watcher   │   │   volumétrie)   │   │  - Perspective  │ │
│   │  - cache LRU │   │  - Parquet      │   │  - Leaflet/D3   │ │
│   └──────────────┘   └─────────────────┘   └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## 5. Benchmark des solutions existantes

|Outil|Modèle|Source de vérité|Local-first ?|Backend requis ?|Volumétrie|Verdict pour le cas d'usage|
|---|---|---|---|---|---|---|
|**Obsidian (référence philosophique)**|App desktop Electron + plugins|Fichiers Markdown|Oui|Non|Petits docs|Non éligible (texte, pas data) ; multi-utilisateur sur partage réseau **non supporté nativement** (forum officiel : conflits de tabs, settings, pas de file locking)|
|**Power BI Desktop (.pbix/.pbip)**|App desktop Microsoft|Cache .abf + spec|Partiel|Service Power BI pour partage interactif|Jusqu'à 10 Go par modèle|Familier mais lock-in MS, partage = service cloud|
|**Tableau Desktop + Reader (.twbx)**|App desktop + viewer gratuit|Workbook .twb + extract .hyper|Oui pour Reader|Non (Reader)|Plusieurs Go|Modèle très proche du concept ; mais coût Tableau Desktop élevé, .twbx embarque les données (pas découplé)|
|**Evidence.dev**|Site statique généré (SvelteKit + DuckDB)|Markdown + SQL + données|Non runtime (build-time)|Node + build pipeline|Très bonne (DuckDB)|Modèle BI-as-code excellent, mais nécessite build/déploiement HTML, pas un exécutable poste|
|**Rill Data (Developer)**|Binaire Go local (`rill start`)|YAML + DuckDB/Parquet|Oui (mode dev)|Non en local|Excellente (DuckDB)|**Plus proche conceptuellement** ; sert un localhost, pas une fenêtre native ; déploiement de masse non trivial|
|**Datasette + datasette-dashboards**|Serveur Python local|SQLite + YAML|Oui|Sert HTTP local|Moyenne|Local-first oui, mais serveur HTTP par poste, ergonomie technicienne|
|**Apache Superset**|App web Python|SQLAlchemy → BDD|Non|**Oui, lourd** (Celery, Redis, Postgres, K8s en prod)|Très bonne|Anti-pattern pour la cible : exige serveur|
|**Metabase**|App web Java|BDD|Non|**Oui** (JVM + BDD)|Bonne|Idem, exclu|
|**Grafana**|App web Go|Sources temps réel|Non|**Oui**|N/A|Exclu|
|**Kibana**|App web Node|Elasticsearch|Non|**Oui** (cluster ES)|Très bonne|Exclu|
|**Streamlit / Dash**|Apps Python|Code Python|Non|**Oui** (process Python serveur, doc Streamlit officielle confirme l'architecture client-serveur)|Variable|Exclu|
|**Perspective (FINOS)**|Lib JS/WASM (C++)|Arrow streaming|Oui (peut être autonome)|Non requis|Excellente (millions de lignes)|**Brique à embarquer**, pas une appli prête à déployer|
|**DuckDB-WASM**|Moteur SQL WASM|Parquet/Arrow/CSV/JSON|Oui|Non|10 Mo–500 Mo confortable, plafond 4 Go (WASM cap)|**Brique à embarquer**|
|**Vega-Lite / Vega**|Grammaire JSON déclarative|JSON spec + données|Oui|Non|Bonne (avec Arrow)|**Brique à embarquer** (grammaire de rendu et d'interaction)|
|**Observable Plot**|Lib JS impérative|Tableaux JS|Oui|Non|Bonne|Alternative à Vega-Lite, moins déclarative|
|**D3.js / Leaflet**|Libs JS bas niveau|Variable|Oui|Non|Excellente mais code à écrire|Pour cartes interactives France (cf. exemples _kerneis/france-choropleth_, dépôt _france-geojson_ de Grégoire David qui fournit régions/départements/arrondissements/cantons/communes en GeoJSON), à utiliser en complément si Vega-Lite ne suffit pas|

**Lecture du benchmark** : aucun outil pris isolément ne résout l'équation cible. La voie réaliste est l'**assemblage** : Tauri 2 (shell exécutable) + DuckDB-WASM ou DuckDB natif (moteur de requêtes) + Vega-Lite (grammaire déclarative) + Perspective optionnellement (pivots haute fréquence) + Leaflet/D3 pour la cartographie France si nécessaire.

## 6. Scénarios d'implémentation

### Scénario A — Assemblage « briques open-source », Tauri + Vega-Lite + DuckDB-WASM (recommandé)

**Architecture** : exécutable Tauri 2, WebView2 embarque Vega-Lite (compilation déclarative JSON → SVG/Canvas), DuckDB-WASM ou DuckDB natif (via binding Rust) effectue les requêtes sur les fichiers Parquet du partage. Le format `.vviz` est un sur-ensemble de Vega-Lite avec quelques extensions (référence à fichier(s) Parquet par chemin UNC, paramètres VaultViz).

|Avantages|Inconvénients|
|---|---|
|100 % open-source, pas de licence|Compétences Rust + JS requises|
|Exécutable léger (~15 Mo)|DuckDB-WASM plafonné à 4 Go (mais 500 Mo confortable)|
|Grammaire Vega-Lite normalisée et documentée|Vega-Lite a un sweet spot exploratoire ; analytique avancée demande Vega complet|
|Déploiement EXE standard MECM/Intune|Signature EV (~400 €/an) requise pour éviter SmartScreen|
|Drill-down/filtres natifs via _selections_ Vega-Lite|Pas de communauté française mature spécifique|

### Scénario B — Wrapper Rill Desktop

**Architecture** : packager Rill Developer (binaire Go + DuckDB) dans un installeur d'entreprise, ouvrir automatiquement le navigateur sur localhost, pointer le `home_dir` sur un sous-dossier du partage. Conserver YAML (Rill) comme format de spec.

|Avantages|Inconvénients|
|---|---|
|Time-to-value très court (Rill est mature)|Rill ouvre un serveur HTTP local (port 9009) → revue PSSI|
|Drill-down / time series très qualitatif|Pas un _vrai_ exécutable graphique, ouvre un navigateur|
|YAML lisible par les analystes|Roadmap Rill orientée Cloud + agentic, divergence possible|
|DuckDB embarqué, excellente perf|Dépendance à un éditeur tiers|

### Scénario C — Stack Microsoft : Power BI Desktop + .pbip sur partage

**Architecture** : aucun développement, on capitalise sur le canal Microsoft existant. Les `.pbip` (project files, JSON décompressé + cache) sont déposés sur CPAM92, chaque cadre ouvre depuis Power BI Desktop.

|Avantages|Inconvénients|
|---|---|
|Zéro développement, support éditeur|Lock-in Microsoft, modèle .pbip métadonnées + cache binaire .abf|
|UX éprouvée pour non-techniciens|Édition uniquement via Power BI Desktop (pas de stricte séparation données/rendu)|
|Conformité Microsoft 365 typique des SI|Le partage interactif réel (drill multi-utilisateur, RLS) suppose Power BI Service → coût + dépendance cloud|
|Capacité gros volumes (jusqu'à 10 Go par modèle)|Données embarquées dans le .pbix par défaut, peu en phase avec « source = fichier sur partage »|

**Verdict scénarios** : **Scénario A** est l'unique réponse pleinement alignée avec le cahier des charges (exécutable autonome, sans serveur, format pivot ouvert, philosophie Obsidian). Scénario B est un raccourci pragmatique pour un POC en quelques jours. Scénario C est la solution « non Go » à benchmarker pour ne pas réinventer la roue si la cible réelle est l'usage cadres standard.

## 7. Faisabilité, effort et risques

|Dimension|Évaluation|Détail|
|---|---|---|
|**Faisabilité technique**|Élevée|Toutes les briques existent en open-source, papier VLDB 2022 sur DuckDB-WASM et papier InfoVis 2017 sur Vega-Lite valident la stack|
|**Effort de développement (POC)**|30–50 j·h|Tauri shell + intégration Vega-Lite + DuckDB-WASM + 1–2 spec démo (carte FR, série temporelle)|
|**Effort de développement (V1 production)**|200–400 j·h|Ajout watcher FS, cache, gestion d'erreurs, packaging signé, IHM de sélection de dashboard, doc utilisateur|
|**Maintenance**|Moyenne|Mises à jour des dépendances WebView2/Tauri/DuckDB ; pas de serveur à exploiter ; mais l'éditeur de l'outil = équipe interne|
|**Sécurité / PSSI**|Moyen|(1) signature code EV obligatoire pour SmartScreen ; (2) revue ANSSI/PSSIE du périmètre (cf. PSSI-E, PSSI-MCAS, PSSI-CPAM) ; (3) aucun port réseau ouvert = bon ; (4) lecture seule sur partage = ACL classiques ; (5) si DuckDB-WASM, isolation WebAssembly = bon point|
|**Déploiement de masse**|Bon avec EV|Package MSI/MSIX signé, déployable via MECM/Intune ; sans signature EV, SmartScreen bloque les non-administrateurs|
|**Adoption non-techniciens**|Risque principal|L'ergonomie ne dépend que de VOUS : il faut une UX de type « ouvrir un .vviz comme un .pdf », pas une CLI|
|**Performance gros volumes (> 500 Mo)**|Risque élevé si JSON ; gérable si Parquet|Au-delà de ~500 Mo : basculer sur DuckDB natif (Tauri Rust binding) plutôt que WASM ; pré-agréger côté ETL ; partitionner les fichiers Parquet|
|**Rafraîchissement fréquent**|OK en lecture|Watcher sur le répertoire SMB ; éviter l'écriture concurrente (à proscrire dans le modèle)|
|**Concurrence multi-utilisateur**|Non concerné (lecture seule)|Le partage est en lecture pour les utilisateurs cibles ; les modifications passent par le pipeline ETL et un publisher dédié|
|**Risque « illusion zéro coût »**|Élevé|Le coût se déplace vers : signature EV (~400 €/an), poste de travail (RAM 8 Go mini conseillée), équipe de développement interne, support utilisateur|
|**Risque « pas de gouvernance des sources »**|Élevé|Sans serveur central, qui certifie que `effectifs_2025.parquet` est « le bon » ? Réponse : un pipeline ETL contrôlé qui _seul_ écrit sur le partage, avec versionnage et journalisation|
|**Risque lock-in**|Faible|Vega-Lite, Parquet, DuckDB, Tauri tous open-source ; portabilité Linux/macOS dès le départ avec Tauri|
|**Risque maintenance long terme**|Moyen|Dépendance à la vitalité des projets DuckDB et Tauri (très active) ; documentation interne indispensable|

## 8. Recommandation et prochaines étapes

### Verdict : Go conditionnel sur 3 critères de POC

Le concept est pertinent et techniquement à la portée d'une petite équipe. Mais s'engager sur une roadmap V1 production avant POC serait imprudent. **Conduire un POC ciblé sur 6 semaines**, dont la réussite conditionne le Go.

### POC suggéré — périmètre minimal

|Lot|Objet|Critère de succès|
|---|---|---|
|1|Shell Tauri 2 signé (cert. OV de test) lisant `\\CPAM92\poc\*.vviz`|Double-clic .vviz ouvre la fenêtre, < 2 s au démarrage|
|2|Intégration Vega-Lite + DuckDB-WASM|Choroplèthe France par département, source Parquet 50 Mo|
|3|Drill-down : clic département → tableau détaillé filtré|Implémenté via _selection_ Vega-Lite, zéro JS impératif|
|4|Test charge|Parquet 300 Mo, temps de réponse interaction < 1 s ; mesurer aussi sur 500 Mo et JSON équivalent pour documenter l'écart|
|5|Tests sur 5 postes cadres représentatifs (Win11, RAM 8 et 16 Go, accès CPAM92)|Installation MECM, ouverture fluide, retour utilisateur structuré|
|6|Note de sécurité préliminaire RSSI|Validation du périmètre PSSI, pas de blocage Antivirus / SmartScreen|

### Critères Go / No-Go à l'issue du POC

|Critère|Seuil Go|Seuil No-Go|
|---|---|---|
|Temps de réponse drill-down sur Parquet 300 Mo|< 1 s|> 3 s|
|Empreinte mémoire|< 1 Go|> 2 Go ou crash|
|Taux d'utilisateurs cadres réussissant l'installation + ouverture sans assistance|> 80 %|< 50 %|
|Revue RSSI|Avis favorable avec conditions|Avis défavorable structurel|
|Coût de développement V1 (extrapolation depuis POC)|< 400 j·h|> 600 j·h|

### Décisions structurantes à acter dès le POC

1. **Format pivot = Parquet** (JSON résiduel uniquement pour spec et petits référentiels).
2. **Spécification = Vega-Lite** (extension `.vviz` = JSON Vega-Lite enrichi de quelques métadonnées VaultViz).
3. **Découplage strict** données / spécification / moteur.
4. **Tauri 2** comme framework de packaging.
5. **Pipeline ETL séparé et contrôlé** comme _unique_ écrivain sur le partage (la gouvernance des sources est un sujet à part entière, à traiter en parallèle).
6. **Signature code EV** budgétée dès la V1.
7. **Pas de serveur** : c'est l'ADN du projet, à graver dans la doc d'architecture.

### Recommandation finale

Lancer le POC en interne ou avec un prestataire spécialisé Rust/dataviz (3 profils : 1 dev Rust/Tauri, 1 dev front data-viz, 1 data-analyst pour les spec Vega-Lite et le jeu de données pilote). Réévaluer le projet en plénière au terme du POC, avec les chiffres en main. À ce stade — et seulement à ce stade — décider de la V1 et du périmètre de déploiement (collège cadres complet ou pilote restreint).