# Spec — Intégration du design (maquette `mockups/`) dans VaultViz

| Métadonnée | Valeur |
|---|---|
| Date | 2026-05-29 |
| Statut | Validé (design) — prêt pour plans d'implémentation |
| Source produit | `PRD.md` v1.0, `BACKLOG.md` v1.0 |
| Maquette source | `mockups/VaultViz/` (HTML/CSS/JS haute-fidélité, non suivie à l'origine) |
| Décision structurante | Abandon du DSFR ; design custom de la maquette = référence officielle |

---

## 1. Contexte et objectif

La V0 a livré l'**architecture technique de bout en bout** (Tauri 2 + DuckDB natif + Arrow IPC + Mosaic/vgplot) et une **ébauche fonctionnelle de visualisation** (carte D3, barres vgplot, table virtualisée, bandeau d'erreur, logging local). 23 stories V0 sont `[x]`.

En parallèle, une **maquette haute-fidélité** a été produite dans `mockups/VaultViz/`. Elle définit un design system complet (thème sombre/clair, tokens CSS, polices Inter + JetBrains Mono, accent `#0066FF`) et un parcours UI riche : écran d'accueil, dialog d'ouverture, loader à étapes, dashboard (KPIs, carte choroplèthe, barres, table) avec cross-filter, bandeau d'erreur détaillé, onglets.

**Objectif** : intégrer **parfaitement** ce design dans le produit réel, **quitte à revoir le backlog en profondeur**, en **conservant la façon dont l'app fonctionne** (interpréteur générique de `.vviz` piloté par fichier + Parquet, pipeline DuckDB → Arrow → Mosaic) et **les besoins couverts** (UC-1…UC-6 du PRD).

### Tension centrale à résoudre

- La **maquette** est un **dashboard figé** câblé sur un dataset précis (« contrôle de gestion » : CA / marge / budget / réalisé / écart par département), avec agrégations en JavaScript (`agg()`, `renderKPIs`, `renderQuarters`).
- L'**app réelle** est un **interpréteur générique** : le rendu est piloté par la spec `.vviz` + des Parquet, avec push-down SQL DuckDB.

L'intégration doit faire **converger le visuel de la maquette vers l'architecture générique**, et non l'inverse.

---

## 2. Décision : approche retenue (Approche A — reproduction *spec-driven*)

On conserve de la maquette **les tokens, le CSS et le markup des composants comme gabarits visuels**. On **jette toute la logique applicative de `app.js`** (machine à états, agrégations JS). On **recâble chaque composant sur le viz-engine existant** (DuckDB → Arrow → Mosaic Selections). On **étend le DSL** (`schema/vviz-v1.json`) et le **compilateur de vues** (`src/viz-engine/view-compiler.ts`) pour exprimer les nouveaux types de vue.

**Test d'acceptation global** : le dataset « contrôle de gestion » de la maquette est reconstruit en un `examples/*.vviz` + Parquet canonique, et **le moteur générique le rend ≈ au pixel près** de `mockups/VaultViz/VaultViz.html`. Cela garantit que le design est intégré **sans** créer de second codebase figé, et **sans** dévier de l'architecture générique.

### Approches écartées

- **B — Restylage thématique seul** (porter les tokens/CSS sur les composants actuels, sans le nouveau shell). Écartée : le périmètre validé inclut tout le shell et les nouvelles capacités.
- **C — Maquette-as-shell hardcodée** (adopter le HTML/JS de la maquette tel quel, rendu figé). Écartée : viole la contrainte dure « conserver le fonctionnement de l'app » — transformerait le produit en dashboard figé et jetterait l'interpréteur générique.

---

## 3. Décisions structurantes (niveau ADR / PRD)

1. **Abandon du DSFR + typo Marianne.** Le design custom de la maquette (sombre/clair, tokens, `#0066FF`, Inter + JetBrains Mono) devient la **référence visuelle officielle**. Décision prise explicitement par l'utilisateur (niveau ADR, cf. CLAUDE.md §8). Le DSFR n'est **pas** une obligation externe pour cet outil interne CPAM 92.
   - Conséquence : **B-140** et **B-141** sont retirés. **PRD §4.1 (V1)** doit être amendé. Un **ADR-012** est créé pour tracer la décision et son superseding.
   - **RGAA AA reste dû** (B-160/B-161 inchangés) mais s'applique désormais au design custom.

2. **Périmètre des capacités nouvelles : toutes incluses.**
   - Écran d'accueil + récents (persistance **app-locale**, jamais sur le share — respecte I-3).
   - Glisser-déposer `.vviz`.
   - Onglets multi-documents (la maquette les note « V2 » ; séquencés en **dernier**, SP4).
   - Recherche dans le tableau + sélecteur de métrique sur la carte.

---

## 4. Invariants à respecter (rappel)

- **I-2 (zéro appel sortant)** : la maquette `styles.css` (~ligne 6) importe les polices via **Google Fonts CDN**. **Interdit.** Au portage : embarquer Inter + JetBrains Mono en `.woff2` locaux + `@font-face`, zéro fallback réseau. Grep systématique de toute URL absolue dans `mockups/VaultViz/assets/`.
- **I-3 (lecture seule sur le share)** : la persistance des récents et préférences (thème, densité) se fait **uniquement** en `%LOCALAPPDATA%\VaultViz\`.
- **I-1 (Windows 11)**, **I-4 (pas de serveur)**, **I-6 (Parquet/Arrow)**, **I-7 (Mosaic V1)** : inchangés, respectés par l'Approche A.

---

## 5. Décomposition en sous-projets

Chaque sous-projet a son propre cycle **spec → plan → implémentation**. Ordre par risque croissant.

### SP0 — Refondation documentaire et backlog (risque : faible)
- Amender **PRD §4.1 V1** : retirer l'exigence DSFR, pointer vers ADR-012.
- Créer **`docs/adr/ADR-012-design-system.md`** (format Nygard) : « Design system VaultViz custom supersede DSFR/Marianne ». Context / Decision / Consequences (RGAA AA reste due sur le design custom).
- **Réécrire la section V1 du BACKLOG** : retirer B-140/B-141 ; restructurer en stories alignées SP1→SP4 ; conserver et réordonner les stories non-design (MapLibre B-110, export PDF B-131/132, watcher, RGAA B-160/161, doc B-170+, MECM, signature DSI).
- Mettre à jour le tableau de bord §0.3.

### SP1 — Design system (risque : faible ; pas de chemin de données)
- Porter les **tokens CSS** : `:root` + `[data-theme="dark"]` + `[data-theme="light"]`, échelles d'espacement/typo, variantes d'accent, densité (`data-density`), styles de cartes (`data-cards`).
- **Embarquer les polices** Inter + JetBrains Mono en `.woff2` + `@font-face` (correctif I-2). Vérifier les licences (OFL — embarquables).
- Porter le **jeu d'icônes SVG** (inline, comme la maquette).
- Porter le **CSS de base des composants** (boutons, chips, badges, cards, scrollbars).
- Toggle de thème **persistant** (app-local), avec `color-scheme`.

### SP2 — App shell (risque : moyen ; chemin de données léger)
- **Titlebar custom** : `decorations: false` (Tauri), contrôles min/max/close câblés sur l'API window Tauri 2, zone de drag (`data-tauri-drag-region`).
- **Toolbar** : breadcrumb du chemin, statut LED (ready/loading/error), boutons Ouvrir / Exporter (placeholder) / Thème / Paramètres.
- **Home** : hero, dropzone, **liste de récents persistée** (remplace `welcome.ts`). État vide géré.
- **Glisser-déposer** : ouverture d'un `.vviz` par drop (événement file-drop Tauri 2), en plus du dialog.
- **Dialog « Ouvrir »** : **garder le dialog natif Tauri** (plugin-dialog déjà câblé, seul accès FS réel) **stylé aux tokens**. On ne réimplémente **pas** le faux explorateur de fichiers de la maquette.
- **Loader à étapes** : mapper les étapes visuelles (Lecture → Parsing → Validation schéma → Rendu) sur les vraies phases de `loadVViz`.
- **Bandeau d'erreur** : porter le visuel (titre + message + chemin + liste de violations) câblé sur les **erreurs typées existantes** (`ErrorPayload` + `details[]` Ajv).

### SP3 — Dashboard spec-driven (risque : élevé ; cœur du chantier)
Le sous-projet central. Peut lui-même être re-découpé lors de son brainstorm dédié.

**Analyse des écarts maquette → DSL/compilateur existant :**

| Composant maquette | Type de vue existant | Écart à combler (schéma `vviz-v1.json` + `view-compiler`) |
|---|---|---|
| KPI avec delta + tendance + note | `kpi` | mesure de comparaison (delta YoY), direction (up/down/flat), note de bas, format (€ / % / signé) |
| Carte + segment CA/Marge/Écart | `map_choropleth` | **N mesures** déclarées + contrôle de bascule lié à `encoding.color` |
| Barres classées colorées | `bar` / `barY` | tri, couleurs, labels de valeurs |
| Budget vs réalisé (appariées) | `bar` | **séries groupées** (2 mesures côte à côte par catégorie) |
| Table + recherche + badges statut | `table` | recherche **ILIKE push-down**, colonne **badge** catégorielle, format + alignement par colonne |
| Chip de filtre actif | (Selection Mosaic) | UI liée à l'état de la Selection (affiche / réinitialise le cross-filter) |

**Décision de rendu :** pour les familles de barres simples + KPI, **rendu DOM léger fidèle au markup/CSS de la maquette**, alimenté par les résultats SQL via `duck-connector`, **re-rendu sur changement de Selection** (pattern `drill-query` / `onSelectionValue` déjà en place). Le **push-down DuckDB et le cross-filter Mosaic sont préservés** (donnée + réactivité passent par le moteur) ; seul le rendu pixel est du DOM. `vgplot` reste disponible comme type de vue pour les graphes denses. La **carte conserve le choroplèthe D3 existant** (`departements-v0.geojson`) ; on **n'importe pas** `france-map.js` (redondant).

**Acceptation SP3 :** `examples/controle-gestion.vviz` + Parquet rendus par le moteur ≈ `mockups/VaultViz/VaultViz.html`, avec cross-filter fonctionnel (clic département → refiltre KPIs + barres + table).

### SP4 — Onglets multi-documents (risque : élevé ; archi)
Aujourd'hui `AppState` Rust = **une seule** `Mutex<Connection>` DuckDB. Le multi-document impose soit une connexion par onglet, soit un **namespacing de schéma** par document. **Séquencé en dernier**, avec **son propre brainstorm dédié** (l'architecture mérite ses propres options). L'app mono-document doit être parfaitement intégrée avant d'ouvrir le multi-doc.

---

## 6. Ce qu'on NE refait PAS (réutilisation)

- **Cross-filter** : le modèle Selection Mosaic existant (B-040/B-050) correspond déjà au comportement « clic département → refiltre tout ». On **porte**, on ne réarchitecture pas.
- **Choroplèthe** : `map-view.ts` (D3 + `departements-v0.geojson`) est conservé et restylé.
- **Pipeline de chargement** : `spec-loader` → `source-loader` → `view-compiler` → `view-mounter` reste la colonne ; on l'étend, on ne le remplace pas.
- **Erreurs typées** : `error.rs` (Rust) + `ErrorPayload` (front) alimentent le nouveau bandeau.

---

## 7. Stratégie de test et d'acceptation

- **Filet de sécurité préalable (début SP1)** : exécuter `npm test` (Vitest) + `cargo test` et confirmer le vert **avant** toute modification du front. (À ce stade, la V0 n'a pas été re-validée empiriquement dans cette session.)
- **Par sous-projet** : tests unitaires sur les nouvelles fonctions de compilation (`view-compiler`) et de rendu ; tests de schéma (Ajv) sur les nouveaux exemples ; conservation des tests existants au vert.
- **Acceptation visuelle** : comparaison du rendu moteur vs maquette (via le navigateur / Playwright) sur l'exemple canonique.
- **Invariants** : grep CI anti-URL-sortante (I-2) ; vérification que la persistance écrit en `%LOCALAPPDATA%` (I-3).

---

## 8. Risques et points ouverts

- **R-A** : `vgplot` (Mosaic 0.26.x) est non production-ready (R-8 du PRD). La décision de rendu DOM pour les barres simples **réduit** la dépendance à vgplot pour le visuel critique tout en gardant Mosaic pour la coordination — atténue R-8.
- **R-B** : Fidélité de la carte D3 vs maquette (la maquette utilise ses propres paths `france-map.js`). À valider visuellement ; le fond `departements-v0.geojson` doit donner un rendu équivalent.
- **R-C** : Multi-document (SP4) — impact archi Rust non trivial ; isolé en fin de séquence avec brainstorm dédié.
- **R-D** : Polices — vérifier que Inter + JetBrains Mono sont sous licence permettant l'embarquement (OFL attendu).

---

## 9. Livrable immédiat après ce spec

Plan d'implémentation de **SP0** (refondation documentaire + réécriture backlog), via la skill `writing-plans`.
