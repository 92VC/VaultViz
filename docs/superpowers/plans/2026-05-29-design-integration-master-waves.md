# Intégration du design — Plan maître d'exécution autonome (SP1→SP4, en waves)

> **For agentic workers:** REQUIRED SUB-SKILL: superpowers:subagent-driven-development pour le dispatch, MAIS la revue humaine inter-tâches est **remplacée par une gate automatique de fin de wave** (le commanditaire veut « sans interruption »). Les `- [ ]` tracent l'avancement.

**Goal:** Intégrer le design de `mockups/VaultViz/` dans le produit réel jusqu'à SP4, de façon autonome, en conservant l'interpréteur générique `.vviz` (DuckDB → Arrow → Mosaic).

**Architecture:** Approche A (spec-driven). Exécution en **waves dépendantes** ; à l'intérieur d'une wave, **fan-out de subagents sur des fichiers disjoints**. Les fichiers **partagés** (`types.ts`, `view-compiler.ts`, `view-mounter.ts`, `schema/vviz-v1.json`, `src/styles/main.css`) sont édités en **sous-étape sérielle en tête de wave puis commitées** avant tout fan-out.

**Tech Stack:** Tauri 2, Rust (duckdb bundled, arrow 58), TypeScript/Vite, Mosaic/vgplot 0.26, apache-arrow 21, ajv 8, d3-geo 3, @fontsource (Inter + JetBrains Mono), Vitest, Playwright (artefact d'acceptation).

**Spec source :** `docs/superpowers/specs/2026-05-29-integration-design-maquette-design.md`.
**Branche :** `feat/design-integration` (PR #39).

---

## 0. Principe directeur

> **« Sans interruption » s'achète en planification.** Toute décision pouvant stopper l'exécution est tranchée et écrite ICI. L'exécution n'a plus qu'à suivre les contrats et à franchir des gates **machine-vérifiables**. La fidélité « ≈ pixel » est un **artefact post-run** (captures Playwright à valider par l'humain), **pas** une gate bloquante.

---

## 1. Décisions verrouillées (pré-requis à l'autonomie)

### 1.1 Baselines (vérifiées ce jour)
- Front : `npm test` → **112 tests / 17 fichiers, vert**.
- Rust : `cargo test` → **vert (exit 0)**.
- Ces commandes sont la **gate de non-régression** de chaque wave.

### 1.2 Polices vs invariant I-2 (zéro appel sortant)
- **Décision :** ajouter `@fontsource/inter` et `@fontsource/jetbrains-mono` (v5.2.x, dispo npm) en **devDependencies**. Ils livrent des `.woff2` locaux importés via JS/CSS — **aucun appel CDN**.
- Retirer l'`@import url('https://fonts.googleapis.com/...')` de tout CSS porté.
- Gate I-2 : `grep -rEn "https?://|fonts\.googleapis|fonts\.gstatic|@import url\(" src/ index.html` → **zéro** hit hors commentaires.

### 1.3 Architecture multi-documents SP4 (déferrée par la spec → tranchée ici)
- État réel (`src-tauri/src/state.rs`, `commands/query.rs`) : **une** `Mutex<Connection>` DuckDB in-memory partagée ; `run_query(sql)` exécute du SQL brut.
- **Décision : namespacing par schéma DuckDB, géré côté front, ZÉRO churn Rust.**
  - À l'ouverture d'un document, le front génère un `docId` court (ex. `d1`, `d2`) et exécute `CREATE SCHEMA IF NOT EXISTS doc_<docId>`.
  - `source-loader` crée les vues **qualifiées** : `CREATE OR REPLACE VIEW doc_<docId>."<name>" AS SELECT * FROM read_parquet('<path>')`.
  - `view-compiler` qualifie toutes les références de table par `doc_<docId>."<source>"`.
  - À la fermeture d'un onglet : `DROP SCHEMA IF EXISTS doc_<docId> CASCADE` (libère la mémoire).
  - `state.rs` et `run_query` restent **inchangés** (ils exécutent du SQL, le namespacing est dans le SQL).
- Alternative écartée : connexion-par-onglet (`HashMap<DocId,Connection>`) — churn Rust + perte du partage de connexion rc6.

### 1.4 Contrats de schéma SP3 (interface partagée — fige le fan-out)
Le schéma `vviz-v1.json` est déjà permissif (`encoding`/`options` = `additionalProperties:true`). **Aucun nouveau type de vue requis** ; on étend l'`encoding`/`options` et le compilateur. Contrats :

- **KPI (`kpi`)** : `encoding.value` (existant) + optionnels `encoding.delta` (`{field, aggregate}`, mesure de comparaison), `options.format` ∈ `{"eur","pct","signed","number"}`, `options.deltaUnit` (string, ex. `" pt"`), `options.foot` (string), `options.icon` (string, clé d'icône).
- **Carte (`map_choropleth`)** : existant + `options.metrics` = `[{key, label, field, aggregate, format}]`. Si présent : sélecteur segmenté ; `metrics[0]` = défaut. Sans `metrics` : comportement actuel (mesure unique via `encoding.color`).
- **Barres (`barX`/`barY`/`bar`)** : existant + `encoding.series` (`{field}`, split catégoriel → barres groupées/colorées), `options.sort` ∈ `{"asc","desc","none"}` (défaut `"desc"`), `options.valueLabels` (bool), `options.format`.
- **Table (`table`)** : `encoding.columns` accepte désormais **soit** `string[]` (actuel, inchangé) **soit** un tableau de descripteurs `{field, label?, align?:"num"|"text", format?, type?:"badge", badgeMap?:{<valeur>:"ok"|"warn"|"err"}}`. + `options.search` (bool, recherche ILIKE push-down sur colonnes texte) + `options.filterField` (existant).
- **Layout dashboard** : `spec.layout` accepte la valeur `"dashboard"`. Placement par `view.options.region` ∈ `{"kpi","main","side","full"}` (zone de la maquette : bandeau KPI / colonne principale carte / colonne latérale / pleine largeur table). Sans region : flux vstack (rétro-compat).
- **Chip de filtre** : pas de champ DSL — dérivé de l'état de la Selection active (UI shell).

> **Généralité BI (correction de périmètre) :** VaultViz est un **interpréteur générique de dashboards BI**, la carte choroplèthe est **optionnelle**. Deux familles de rendu coexistent, pilotées par le même DSL + Selections :
> - **Widgets bespoke** (DOM stylé fidèle maquette) : `kpi` (delta), `barX`/`barY` classées, barres appariées (séries), `map_choropleth`, `table` (badges).
> - **Catalogue BI générique** via **vgplot thémé aux tokens** : `line`, `area`, `dot` (scatter), `bar` génériques. Le `view-compiler` ne doit plus **throw** sur `line`/`area`/`dot` — ils sont compilés et rendus.
> Un dashboard valide peut ne contenir **aucune** carte (ex. 100 % séries temporelles + table + KPIs). Le layout `dashboard` accepte tout type de vue dans chaque zone.

`CompiledView` (union dans `view-compiler.ts`) gagne les champs correspondants ; `types.ts` aligne `ViewSpec.encoding`/`options` typés. **Rétro-compatibilité totale** : tous les `.vviz` existants compilent à l'identique.

### 1.5 Dataset canonique d'acceptation
- Porter le générateur déterministe `mockups/VaultViz/assets/data.js` (PRNG **mulberry32**, seed `num*97+13`) en un **exemple Rust** `src-tauri/examples/gen_controle_gestion.rs` (même pattern que `gen_demo_dept.rs`) écrivant `examples/controle_gestion.parquet` (+ tables annexes long-format).
- Modèle relationnel (tidy) :
  - `cg_departements(code, nom, region, ca, marge_pct, budget, realise, ecart, ecart_pct, statut, yoy_ca, yoy_marge)` — 96 lignes.
  - `cg_categories(code, categorie, montant)` — 96×5 lignes (Logiciel/Services/Matériel/Formation/Support).
  - `cg_quarters(code, trimestre, realise, budget)` — 96×4 lignes (T1..T4).
- `examples/controle_gestion.vviz` déclare ces 3 sources et reproduit la maquette via le DSL étendu (KPIs, carte+métriques, barres classées sur `cg_categories`, barres appariées sur `cg_quarters`, table sur `cg_departements`). **Exemple map-centric.**
- **Second exemple SANS carte** `examples/suivi_mensuel.vviz` (+ Parquet généré) : dashboard BI générique prouvant la généralité — série temporelle (`line`/`area`), barres, KPIs, table ; **zéro `map_choropleth`**. Valide que le moteur n'est pas map-dépendant.
- **Gate d'acceptation** : le moteur rend **les deux** exemples **sans erreur**, cross-filter émet les requêtes attendues ; captures Playwright produites pour comparaison visuelle humaine.

### 1.6 Gates objectives par wave (toutes machine-vérifiables)
1. `npm test` vert + `cargo test` vert (non-régression).
2. `npx ajv validate -s schema/vviz-v1.json -d "examples/*.vviz"` vert (dès qu'un exemple est touché).
3. I-2 : grep anti-URL/CDN → zéro hit.
4. I-3 : toute persistance écrit sous `BaseDirs::data_local_dir()` / `%LOCALAPPDATA%` uniquement (grep des chemins d'écriture).
5. `npm run build` (tsc + vite) réussit (pas d'erreur de type).
6. Wave 3+ : `controle_gestion.vviz` se charge sans erreur (test d'intégration headless).

---

## 2. Structure en waves

```
Wave 0  (prép, sériel, MOI)         ──► gate ──►
Wave 1  (SP1 design system)         ──► gate ──►
Wave 2  (SP2 shell, fan-out)        ──► gate ──►
Wave 3  (SP3 core sériel → fan-out) ──► gate ──►
Wave 4  (SP4 multi-doc, sériel)     ──► gate ──►
Wave 5  (acceptance artifact)       ──► fin
```

Discipline transverse : **commit après chaque tâche** (message `feat(SP#): …\n\nRefs: design-integration`). Après chaque wave : exécuter la gate, committer l'avancement du BACKLOG (story SP `[~]`→`[x]`), passer à la wave suivante **sans attendre**. En cas d'échec de gate : le subagent concerné est relancé avec le diagnostic ; pas d'escalade humaine sauf blocage dur (réseau, dépendance manquante, décision hors-périmètre).

---

## Wave 0 — Préparation (sériel ; exécuté par l'orchestrateur)

**Files:** `package.json`, `src/styles/fonts.css` (créer), `src-tauri/examples/gen_controle_gestion.rs` (créer), `examples/controle_gestion.parquet` (généré), `examples/controle_gestion.vviz` (créer), `schema/vviz-v1.json`, `src/viz-engine/types.ts`, `src/viz-engine/view-compiler.ts`.

- [ ] **T0.1** Installer les polices : `npm i -D @fontsource/inter @fontsource/jetbrains-mono` ; vérifier les `.woff2` sous `node_modules/@fontsource/*/files/`. Commit.
- [ ] **T0.2** Écrire `src-tauri/examples/gen_controle_gestion.rs` (mulberry32 porté, écrit les 3 Parquet via duckdb COPY), l'exécuter (`cargo run --example gen_controle_gestion`), vérifier `examples/controle_gestion.parquet`. Commit.
- [ ] **T0.3** Écrire `examples/controle_gestion.vviz` (DSL étendu, 3 sources, layout `dashboard`). Valider via ajv. Commit.
- [ ] **T0.4** Étendre `schema/vviz-v1.json` : ajouter `"dashboard"` à l'enum `layout` ; documenter (sans restreindre) les options/encodings §1.4. Re-valider tous les exemples. Commit.
- [ ] **Gate Wave 0 :** `npm test`, `cargo test`, ajv sur `examples/*.vviz`, build — tous verts.

> Note : T0.2–T0.4 fixent les contrats que les subagents des waves suivantes consomment. `types.ts`/`view-compiler.ts` sont préparés (squelette des nouveaux champs) ici **uniquement si nécessaire** au chargement de l'exemple ; sinon laissés à Wave 3 (cœur sériel).

---

## Wave 1 — SP1 Design system (story B-200)

**Caractère :** fondation visuelle, peu de fan-out (un socle CSS partagé). **Sériel** pour l'essentiel (un seul fichier de tokens), puis 1–2 subagents sur des fichiers disjoints.

- [ ] **T1.1 (sériel) Tokens + thèmes** — `src/styles/tokens.css` (créer) : porter `:root`, `[data-theme="dark"]`, `[data-theme="light"]`, densité, accent, styles cartes depuis `mockups/VaultViz/assets/styles.css`. Importer les polices via `@fontsource` (pas de CDN). `src/styles/main.css` importe `tokens.css`. Test : grep I-2 zéro hit. Commit.
- [ ] **T1.2 (subagent A) Jeu d'icônes** — `src/ui/icons.ts` (créer) : fonctions SVG inline (euro, margin, target, gauge, check, open, export, theme, settings, search, close, plus, file, drop, warning…) extraites de la maquette. Test unitaire : chaque icône renvoie un `<svg>` valide. Commit.
- [ ] **T1.3 (subagent B) CSS composants de base** — `src/styles/components.css` (créer) : boutons (`.tbtn`, `.btn`, variantes), chips, badges (`ok/warn/err`), cards, scrollbars, segmented control. Pas de logique. Commit.
- [ ] **T1.4 (sériel) Toggle thème persistant** — `src/ui/theme.ts` (créer) : applique `data-theme`, persiste la préférence via `@tauri-apps/plugin-fs` ou store app-local (`%LOCALAPPDATA%`, I-3). Test unitaire (happy-dom) : toggle bascule l'attribut. Commit.
- [ ] **Gate Wave 1 :** `npm test`, `npm run build`, grep I-2/I-3 — verts. BACKLOG B-200 `[x]`. Commit.

---

## Wave 2 — SP2 App shell (story B-210)

**Caractère :** fort fan-out — chaque morceau du shell est un fichier disjoint sous `src/components/` + `src/shell/`.

**Sous-étape sérielle (tête de wave) :** `src/shell/layout.ts` (créer) — squelette DOM `#app` (titlebar / toolbar / stage) + routeur d'états (`home|dashboard|error|loading`) exposant des points de montage. Commitée AVANT le fan-out (fichier partagé par les morceaux).

Fan-out (subagents, fichiers disjoints) :
- [ ] **T2.1** `src/components/titlebar.ts` — titlebar custom + onglets (placeholder mono-doc) + contrôles fenêtre câblés API Tauri ; `decorations:false` dans `tauri.conf.json` (édition sérielle de la conf, cf. note). 
- [ ] **T2.2** `src/components/toolbar.ts` (réécriture) — breadcrumb path, statut LED (ready/loading/error), boutons Ouvrir/Exporter(placeholder)/Thème/Paramètres.
- [ ] **T2.3** `src/components/home.ts` (remplace `welcome.ts`) — hero, dropzone, liste de récents.
- [ ] **T2.4** `src/services/recents.ts` — persistance app-local des récents (`%LOCALAPPDATA%`, I-3) : add/list/clear. Test unitaire.
- [ ] **T2.5** `src/services/file-open.ts` — ouverture via dialog natif Tauri (thémé) **et** glisser-déposer (event `onDragDropEvent` Tauri 2) → renvoie un chemin `.vviz`.
- [ ] **T2.6** `src/components/loader.ts` — splash à étapes câblé sur les phases réelles de `loadVViz`.
- [ ] **T2.7** `src/components/error-banner.ts` (réécriture) — visuel maquette (titre/message/path/violations) alimenté par `ErrorPayload` + `details[]` Ajv existants. Conserver les tests existants verts.
- [ ] **Gate Wave 2 :** `npm test` (dont tests existants `welcome`/`toolbar`/`error-banner` adaptés), `npm run build`, I-2/I-3 — verts. BACKLOG B-210 `[x]`. Commit.

> Note conf Tauri : `titlebar` nécessite `decorations:false` + permission window. Édition sérielle de `tauri.conf.json` et `capabilities/main.json` en tête de T2.1, commitée avant.

---

## Wave 3 — SP3 Dashboard spec-driven (story B-220)

**Caractère :** **cœur sériel d'abord** (contrats partagés), **puis fan-out composants**.

**Sous-étape sérielle (tête de wave, un seul subagent / orchestrateur, commits successifs) :**
- [ ] **T3.0a** `src/viz-engine/types.ts` — étendre `ViewType` (aucun nouveau), typer les nouveaux `encoding`/`options` (delta, metrics, series, colonnes riches, region). Commit.
- [ ] **T3.0b** `src/viz-engine/view-compiler.ts` — compiler les nouveaux encodings (KPI delta, carte multi-métriques, barres séries/tri, table colonnes riches + search). TDD : étendre `__tests__/view-compiler.test.ts` (rétro-compat + nouveaux cas). Commit.
- [ ] **T3.0c** `src/viz-engine/view-mounter.ts` — router vers les nouveaux composants selon le `CompiledView` enrichi. Commit.

Fan-out (subagents, composants disjoints, rendu DOM fidèle maquette + données via `duck-connector`, réactivité via Selection) :
- [ ] **T3.1** `src/components/kpi-card.ts` — KPI valeur + delta/tendance + note + icône + format. TDD.
- [ ] **T3.2** `src/components/map-view.ts` (évolution) — choroplèthe D3 + **sélecteur de métrique segmenté** + légende + tooltip riche maquette. Conserver `map-view.test.ts`.
- [ ] **T3.3** `src/components/ranked-bars.ts` — barres horizontales classées, colorées, labels de valeurs (catégories).
- [ ] **T3.4** `src/components/grouped-bars.ts` — barres appariées (budget vs réalisé par trimestre).
- [ ] **T3.5** `src/components/table-view.ts` (évolution) — recherche ILIKE push-down + colonnes riches + badges statut. Conserver `table-view.test.ts`.
- [ ] **T3.6** `src/components/filter-chip.ts` + intégration dashboard layout (`src/shell/dashboard.ts`) — chip de filtre lié à la Selection ; grille `dashboard` (zones kpi/main/side/full), **sans carte obligatoire**.
- [ ] **T3.7** `src/components/plot-view.ts` — **catalogue BI générique via vgplot thémé** : `line`, `area`, `dot` (scatter) + `bar`/`barX`/`barY` génériques, axes/grille aux tokens, `filterBy` Selection. Le `view-compiler` (T3.0b) compile désormais line/area/dot (plus de `throw`). TDD : cas line/area/dot.
- [ ] **T3.8** `examples/suivi_mensuel.vviz` + `src-tauri/examples/gen_suivi_mensuel.rs` → Parquet série temporelle mensuelle ; dashboard **sans carte** (line/area + barres + KPIs + table). ajv vert.
- [ ] **Gate Wave 3 :** `npm test` (+ nouveaux tests compilateur/composants), `cargo test`, ajv, build, **chargement headless de `controle_gestion.vviz` ET `suivi_mensuel.vviz` sans erreur**, I-2/I-3 — verts. BACKLOG B-220 `[x]`. Commit.

---

## Wave 4 — SP4 Onglets multi-documents (story B-230)

**Caractère :** sériel (touche l'état global front + le pipeline de chargement). Zéro churn Rust (cf. §1.3).

- [ ] **T4.1** `src/viz-engine/source-loader.ts` — qualifier les vues par schéma `doc_<docId>` ; signature `loadSources(conn, doc, vvizDir, docId)`. TDD : `source-loader.test.ts`.
- [ ] **T4.2** `src/viz-engine/view-compiler.ts` (extension) — accepter un `docId` pour qualifier les références de table (`doc_<docId>."<source>"`). TDD rétro-compat (docId optionnel → schéma `main`).
- [ ] **T4.3** `src/shell/tabs.ts` — état multi-onglets : ouvrir (nouveau `docId` + `CREATE SCHEMA`), activer, fermer (`DROP SCHEMA … CASCADE`). RuntimeContext par onglet. TDD état.
- [ ] **T4.4** `src/components/titlebar.ts` (activation onglets) — onglets réels (add/switch/close) liés à `tabs.ts`.
- [ ] **Gate Wave 4 :** `npm test`, `cargo test`, build, ouverture simultanée de 2 `.vviz` isolés (test d'intégration), I-2/I-3 — verts. BACKLOG B-230 `[x]`. Commit.

---

## Wave 5 — Artefact d'acceptation (sériel)

- [ ] **T5.1** Script Playwright `docs/acceptance/screenshot.mjs` : lance le front (Vite preview ou mode mock), charge `controle_gestion.vviz`, capture les états (home, dashboard, dashboard+filtre, error) en dark ET light.
- [ ] **T5.2** Déposer les captures sous `docs/acceptance/2026-05-29/` et un `README.md` listant la correspondance maquette ↔ rendu.
- [ ] **Gate Wave 5 :** captures générées sans erreur. Mettre à jour le tableau de bord BACKLOG (SP1–SP4 `[x]`). Commit + push.

---

## 3. Orchestration (subagent-driven, sans interruption)

- **Dispatch :** un subagent par tâche fan-out, en parallèle au sein d'une wave (message unique multi-Agent). Brief type : objectif, fichiers (disjoints), contrat consommé (§1.4), exigence TDD, commande de gate locale, « committe à la fin ».
- **Fichiers partagés :** jamais en parallèle. Édités/commités en sous-étape sérielle de tête de wave (déjà marquées « sériel » ci-dessus).
- **Gate inter-wave :** l'orchestrateur exécute les commandes §1.6 ; si rouge, relance ciblée du subagent fautif avec le log ; si vert, avance.
- **Pas de checkpoint humain** entre tâches/waves. Surface humaine = ce plan (avant run) + l'artefact Wave 5 (après run).
- **Reprise :** chaque tâche committe ; en cas d'arrêt, reprendre à la première `- [ ]` non cochée.

---

## 4. Self-Review (effectué)

**Couverture spec §5 :** SP1→B-200/Wave1 ✓ ; SP2→B-210/Wave2 ✓ ; SP3→B-220/Wave3 ✓ ; SP4→B-230/Wave4 ✓ ; acceptation §7→Wave5 ✓.
**Décisions différées levées :** fonts (§1.2), SP4 archi (§1.3), contrats SP3 (§1.4), dataset (§1.5). ✓
**Invariants :** I-2 (fonts locales + grep), I-3 (persistance LOCALAPPDATA), I-6/I-7 (pipeline conservé). ✓
**Placeholders :** aucun contrat « TBD » ; le détail TDD par tâche est délégué aux subagents (décision assumée §0 / advisor) — chaque tâche a un objectif, des fichiers, un contrat et une gate.
**Cohérence types :** `CompiledView`/`ViewSpec` étendus en Wave 3 cœur sériel avant tout usage ; `docId` optionnel (rétro-compat) en Wave 4.
**Risque résiduel :** fidélité visuelle ≈ pixel = non bloquante (artefact Wave 5) ; `npm i` (Wave 0) requiert le réseau npm — seul point réseau, en prép, hors run.
