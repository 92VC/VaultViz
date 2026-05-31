# Exécution complète V1 — Plan d'implémentation (waves, subagent-driven)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommandé) ou superpowers:executing-plans pour implémenter ce plan tâche par tâche. Les étapes utilisent la syntaxe checkbox (`- [ ]`) pour le suivi.

**Goal:** Exécuter les 20 stories `[ ]` restantes du backlog VaultViz (carto MapLibre, exports dont PDF A4, watcher, slicers moteur, consommation DLI, docs) en vagues parallélisées pilotées par sous-agents, avec frontière d'autonomie explicite pour les 4 stories à dépendance externe (DSI/MECM/terrain).

**Architecture:** VaultViz = Tauri 2 (Rust core) + WebView2 (TS/Vite). Moteur de rendu **hybride** (ADR-002 amendé) : invariant push-down DuckDB ; rendu vgplot + maison (`src/components/*.ts`), coordination cross-vues dans `src/viz-engine/view-mounter.ts`. Données via `.vviz` autoporteur (Parquet `inline` base64) ou `path` externe. Le plan étend le moteur (slicers), ajoute la carto MapLibre/PMTiles, les exports, le watcher, puis branche le cas DLI.

**Tech Stack:** Rust (`duckdb` bundled, `tauri`, `tauri-plugin-fs`/`-dialog`, +`-fs-watch`), TS (`@uwdata/vgplot`, `apache-arrow`, `d3-geo`, +`maplibre-gl`, +`pmtiles`, +`pdf-lib`), tests `vitest` (front) + `cargo test` (Rust), schéma `ajv`.

---

## 0. Frontière d'autonomie (À LIRE EN PREMIER)

| Catégorie | Stories | Autonome ? |
|---|---|---|
| **Dev/doc pur** | B-251, B-243, B-244, B-245, B-100, B-101, B-110, B-111, B-120, B-121, B-130, B-131, B-132, B-170, B-171, B-172 (16) | ✅ Oui — exécution intégrale sans interruption |
| **Porte unique (1×)** | Lockfile des deps nouvelles (Wave 0) | ⚠️ 1 approbation humaine, puis autonome |
| **Acte externe** | B-150 (signature DSI), B-180 (push MECM), B-181 (retours terrain), B-190 (décision Go) | ❌ Non — l'agent produit les **artefacts** ; l'acte humain est la frontière |

**Conséquence** : « exécution totale et sans interruption » est garantie pour les 16 stories dev/doc, après l'unique porte lockfile de Wave 0. Les 4 stories externes sont traitées en **Wave 5** : l'agent y génère tout ce qui est produisible (docs de procédure, package de handoff, instrument de collecte, template de décision pré-rempli avec les métriques mesurées) et **s'arrête** au point où une action DSI/sponsor/cadre est requise. Ne jamais simuler un retour DSI, un déploiement parc, ou un avis terrain.

> **Porte lockfile (Wave 0) — pas un blocage réintroduit.** C'est la seule interruption, et elle est **imposée par CLAUDE.md §8** (figer toute version précise avec l'utilisateur présent). Une fois les 3 deps verrouillées, plus aucune approbation jusqu'à la PR finale. Ce n'est pas un `[!]` artificiel : c'est une décision de gouvernance des deps, expédiée en 1 fois.

### 0.1 Niveau de spécification par story (transparence)

Toutes les stories ne sont pas spécifiées au **même niveau de détail**, par choix d'ingénierie honnête :

| Niveau | Stories | Ce que le sous-agent reçoit |
|---|---|---|
| **Code-level** (TDD complet, code réel) | B-251, B-121, B-132 (CSV), B-170, B-171 + tests partout | Tests + implémentation prêts à copier |
| **Contract+research** (API librairie externe) | B-100, B-101, B-110, B-111, B-130, B-131 (PDF), B-120 (plugin Rust) | **Tâche 0 `context7` obligatoire** (API exacte de la version verrouillée) + contrat d'interface + critères + verif. Le code est écrit après grounding — pas avant, pour ne pas halluciner l'API. |
| **Contenu/consommation** (pas de moteur) | B-243, B-244, B-245 (DLI) | Édition `.vviz` + prep Python, zéro logique moteur |
| **Artefact** (handoff externe) | B-150, B-180, B-181, B-190 | Doc/template produit ; acte humain = frontière |

**Le `context7`-en-Tâche-0 n'est pas un placeholder** : écrire du code MapLibre/pdf-lib « de mémoire » dans le plan introduirait des API fausses qu'un sous-agent zéro-contexte recopierait. Le grounding au moment de l'exécution, sur la version verrouillée, est la procédure correcte. Le contrat d'interface (signatures, acceptation) est, lui, fixé ici.

---

## 1. Graphe de dépendances & vagues

```
Wave 0  [GATE]  Lockfile deps + branche/worktree
        │
        ├──────────────┬───────────────┬──────────────┐
Wave 1  1A B-251       1B B-100        1C B-120        1D B-130
        (slicers)      (MapLibre)      (watcher)       (décision PDF)
        │              │               │               │
Wave 2  2A B-243,B-244 2B B-101,B-110  2C B-121        2D B-170,B-171
        (DLI conso)    (PMTiles,Topo)  (bannière)      (docs)
        │              │                               │
Wave 3  3A B-245       3B B-111                        3C B-172
        (DLI intég.)   (drill carto)                   (schéma publié)
                       │
Wave 4                 4A B-131 ──▶ B-132
                       (PDF A4)     (PNG+CSV)   [dépend de B-111 ET B-130]
        │
Wave 5  [HANDOFF]  B-150p → B-180p → B-181p → B-190p (artefacts only)
```

**Parallélisme** : Wave 1 lance 4 sous-agents simultanés (aucun fichier partagé : `viz-engine` vs `components/map-view` vs `src-tauri`+watcher vs `docs/adr`). Wave 2 : jusqu'à 5 sous-agents. La piste Carto (B) est la plus longue (4 étapes) → chemin critique vers B-131 (PDF, exigence I-9).

| Wave | Stories | Sous-agents // | Barrière de fin |
|---|---|---|---|
| 0 | gate lockfile | 1 (séquentiel) | `npm ci` + `cargo build` OK |
| 1 | B-251, B-100, B-120, B-130 | 4 | tous tests verts |
| 2 | B-243, B-244, B-101, B-110, B-170, B-171 | 6 | tous tests verts |
| 3 | B-245, B-111, B-172 | 3 | tous tests verts + rendu DLI |
| 4 | B-131, B-132 | 1→1 (séquentiel) | PDF généré sur les 6 UC |
| 5 | B-150p, B-180p, B-181p, B-190p | 1 (séquentiel) | artefacts écrits, frontière atteinte |

---

## 2. Protocole d'exécution (subagent-driven)

Pour CHAQUE story, le sous-agent suit le cycle TDD du plan. Entre chaque story, l'orchestrateur applique la **revue à deux étapes** (superpowers:subagent-driven-development) :

1. **Dispatch** : un sous-agent frais par story, avec le contexte = la section de tâche correspondante de ce plan + `CLAUDE.md`.
2. **Revue étape 1 (automatique)** : `npm test` (≥ 318) + `cargo test` + `npx ajv validate -s schema/vviz-v1.json -d "examples/**/*.vviz"` doivent être verts. Sinon, renvoyer au sous-agent.
3. **Revue étape 2 (qualité)** : invariants respectés (I-2 zéro réseau via grep anti-URL ; push-down DuckDB préservé : aucune agrégation JS ; rétro-compat des `.vviz` existants).
4. **Commit** : un commit conventionnel par story, footer `Refs: B-NNN`, sur la branche de la wave.
5. **Marqueur backlog** : `[ ]→[~]` au début, `[~]→[x]` à la fin + maj tableau §0.3.

**Gate de non-régression (invariant global)** : ces 3 commandes doivent rester vertes après CHAQUE story.
```bash
npm test
( cd src-tauri && cargo test )
npx ajv validate -s schema/vviz-v1.json -d "examples/**/*.vviz" --strict=false
```

**Anti-hallucination librairies** : pour les stories touchant une dep nouvelle (MapLibre, PMTiles, pdf-lib), la **Tâche 0** du sous-agent est OBLIGATOIREMENT un appel `context7` (`resolve-library-id` puis `query-docs`) pour récupérer l'API exacte de la version verrouillée avant d'écrire le code. Ce n'est pas un placeholder : c'est la procédure de grounding.

**Vérification runtime (B-111, B-131, B-245) — faisable localement.** L'app est Windows-only (I-1) mais ce poste de dev a `DISPLAY=:0`, `webkit2gtk-4.1` et `tauri-cli 2.11.2` : un sous-agent peut lancer `cargo tauri dev` (WebView **webkit**, pas WebView2) et capturer via le MCP Playwright. C'est un **proxy** : la fidélité finale Windows/WebView2 (notamment rendu PDF d'un canvas WebGL — R-5) est validée sur la **CI windows-latest** (`release.yml`), pas sur Linux. Donc, pour ces 3 stories, le critère d'acceptation runtime se dédouble : (a) **rend/fonctionne sous webkit local** (bloquant, vérifiable par l'agent) ; (b) **fidélité Windows** = noté « à valider sur CI/poste Windows » (non bloquant pour la clôture de la story, tracé). Ne jamais déclarer la fidélité Windows « vérifiée » depuis Linux.

---

## 3. Wave 0 — Porte lockfile & setup

**Objet** : c'est la SEULE interruption. Verrouiller les versions des deps nouvelles (CLAUDE.md §8), puis exécution autonome.

**Files:**
- Modify: `package.json`, `package-lock.json`
- Modify: `src-tauri/Cargo.toml`, `src-tauri/Cargo.lock`

- [ ] **Step 1 : Proposer les versions (dernière minor stable, règle CLAUDE.md §4.4)**

Front (`dependencies`) :
```jsonc
"maplibre-gl": "^5",     // carto WebGL (B-100/101/111)
"pmtiles": "^4",         // protocole pmtiles:// offline (B-101)
"pdf-lib": "^1.17"       // export PDF A4 (B-131) — alternative à WebView2 print, tranchée en B-130
```
Rust (`[dependencies]`) :
```toml
tauri-plugin-fs-watch = "2"   # watcher FS (B-120)
```
DevDeps front (pipeline géo B-110) : `mapshaper` (CLI, exécutée via `npx`, pas d'import runtime → pas de surface réseau dans l'app).

- [ ] **Step 2 : APPROBATION HUMAINE** — figer ces versions précises (point de jonction unique). Attendre le « go » lockfile.

- [ ] **Step 3 : Installer & verrouiller**

```bash
npm install --save maplibre-gl pmtiles pdf-lib
npm install --save-dev mapshaper
( cd src-tauri && cargo add tauri-plugin-fs-watch )
```

- [ ] **Step 4 : Vérifier que rien n'est cassé**

Run: `npm ci && npm test && ( cd src-tauri && cargo build )`
Expected: install OK, 318 tests verts, build Rust OK.

- [ ] **Step 5 : Commit**

```bash
git add package.json package-lock.json src-tauri/Cargo.toml src-tauri/Cargo.lock
git commit -m "chore(deps): verrouiller maplibre-gl, pmtiles, pdf-lib, plugin-fs-watch (Wave 0)

Refs: B-100, B-101, B-120, B-131"
```

---

## 4. WAVE 1

### Task 1A — B-251 : Slicers multi-valeurs & slicer global (moteur, app-core)

Keystone : généralise le contrat de sélection (1 clause → N clauses AND, multi-valeurs → `IN`). Débloque B-243/B-244.

**Files:**
- Modify: `schema/vviz-v1.json` (ajout `spec.slicers[]`)
- Create: `src/viz-engine/where-builder.ts` (composition de clauses)
- Modify: `src/viz-engine/view-mounter.ts` (généraliser `injectWhere`, abonnement multi-clause)
- Create: `src/components/slicer-panel.ts` (UI cases à cocher, rendu maison)
- Modify: `src/viz-engine/types.ts`, `src/viz-engine/view-compiler.ts` (porter `slicers` du DSL)
- Test: `src/__tests__/where-builder.test.ts`, `src/__tests__/slicer-panel.test.ts`

- [ ] **Step 1 : Test rouge — composition de clauses AND + IN**

```ts
// src/__tests__/where-builder.test.ts
import { describe, it, expect } from "vitest";
import { injectWhereAll, type Clause } from "../viz-engine/where-builder";

describe("injectWhereAll", () => {
  it("aucune clause active → SQL inchangé", () => {
    const sql = `SELECT a, b FROM "s" GROUP BY a`;
    expect(injectWhereAll(sql, "s", [])).toBe(sql);
  });

  it("une clause mono-valeur → WHERE field = 'v' après FROM", () => {
    const sql = `SELECT a FROM "s" ORDER BY v`;
    const cl: Clause[] = [{ field: "dept", values: ["92"] }];
    expect(injectWhereAll(sql, "s", cl)).toBe(
      `SELECT a FROM "s" WHERE "dept" = '92' ORDER BY v`,
    );
  });

  it("clause multi-valeurs → IN (...)", () => {
    const sql = `SELECT a FROM "s"`;
    const cl: Clause[] = [{ field: "g", values: ["43", "58"] }];
    expect(injectWhereAll(sql, "s", cl)).toBe(
      `SELECT a FROM "s" WHERE "g" IN ('43', '58')`,
    );
  });

  it("N clauses combinées en AND", () => {
    const sql = `SELECT a FROM "s" GROUP BY a`;
    const cl: Clause[] = [
      { field: "dept", values: ["92"] },
      { field: "type", values: ["x", "y"] },
    ];
    expect(injectWhereAll(sql, "s", cl)).toBe(
      `SELECT a FROM "s" WHERE "dept" = '92' AND "type" IN ('x', 'y') GROUP BY a`,
    );
  });

  it("échappe les quotes (anti-injection)", () => {
    const cl: Clause[] = [{ field: "n", values: ["O'Brien"] }];
    expect(injectWhereAll(`SELECT 1 FROM "s"`, "s", cl)).toContain(
      `'O''Brien'`,
    );
  });

  it("clause vide (values=[]) ignorée", () => {
    const cl: Clause[] = [{ field: "g", values: [] }];
    expect(injectWhereAll(`SELECT 1 FROM "s"`, "s", cl)).toBe(`SELECT 1 FROM "s"`);
  });
});
```

- [ ] **Step 2 : Lancer → échec**

Run: `npx vitest run src/__tests__/where-builder.test.ts`
Expected: FAIL (`where-builder` introuvable).

- [ ] **Step 3 : Implémenter `where-builder.ts`**

```ts
// src/viz-engine/where-builder.ts
// Généralise injectWhere (view-mounter) à N clauses combinées en AND.
// Multi-valeurs → IN (...). Push-down DuckDB préservé : le prédicat part
// en SQL, aucun filtrage JS. Réutilise les mêmes règles d'échappement.

export interface Clause {
  /** Colonne SQL (issue du DSL .vviz validé par schéma). */
  field: string;
  /** Valeurs sélectionnées ; [] = clause inactive (ignorée). */
  values: string[];
}

function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}
function lit(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}

function predicate(c: Clause): string | null {
  const vals = c.values.filter((v) => v.length > 0);
  if (vals.length === 0) return null;
  if (vals.length === 1) return `${ident(c.field)} = ${lit(vals[0])}`;
  return `${ident(c.field)} IN (${vals.map(lit).join(", ")})`;
}

/**
 * Injecte `WHERE p1 AND p2 …` juste après `FROM "<source>"`. Si aucune
 * clause active, renvoie le SQL inchangé. Si le token FROM est absent,
 * renvoie inchangé (garde-fou — pas de SQL malformé).
 */
export function injectWhereAll(
  sql: string,
  source: string,
  clauses: Clause[],
): string {
  const preds = clauses.map(predicate).filter((p): p is string => p !== null);
  if (preds.length === 0) return sql;
  const fromToken = `FROM ${ident(source)}`;
  const idx = sql.indexOf(fromToken);
  if (idx === -1) return sql;
  const insertAt = idx + fromToken.length;
  const clause = ` WHERE ${preds.join(" AND ")}`;
  return sql.slice(0, insertAt) + clause + sql.slice(insertAt);
}
```

- [ ] **Step 4 : Vert**

Run: `npx vitest run src/__tests__/where-builder.test.ts`
Expected: PASS (6/6).

- [ ] **Step 5 : Refactor — `injectWhere` (mono) délègue à `injectWhereAll`**

Dans `src/viz-engine/view-mounter.ts`, remplacer le corps de `injectWhere` par une délégation (préserve la signature existante, zéro régression) :
```ts
import { injectWhereAll } from "./where-builder";
export function injectWhere(sql: string, source: string, field: string, value: string): string {
  return injectWhereAll(sql, source, [{ field, values: [value] }]);
}
```

- [ ] **Step 6 : Étendre le schéma `.vviz` — `spec.slicers[]`**

Dans `schema/vviz-v1.json`, ajouter sous `spec.properties` (après `selections`) :
```jsonc
"slicers": {
  "type": "array",
  "maxItems": 16,
  "description": "Filtres multi-valeurs (cases à cocher) combinés en AND. scope:'global' = filtre tout le document ; 'tab' = onglet courant.",
  "items": {
    "type": "object",
    "required": ["id", "field", "source"],
    "additionalProperties": false,
    "properties": {
      "id": { "type": "string", "pattern": "^[a-zA-Z_][a-zA-Z0-9_]{0,63}$" },
      "field": { "type": "string" },
      "source": { "type": "string", "pattern": "^[a-zA-Z_][a-zA-Z0-9_]{0,63}$" },
      "label": { "type": "string" },
      "kind": { "type": "string", "enum": ["in", "interval"], "default": "in" },
      "scope": { "type": "string", "enum": ["tab", "global"], "default": "tab" }
    }
  }
}
```

- [ ] **Step 7 : Test rouge — `slicer-panel.ts` (UI maison)**

```ts
// src/__tests__/slicer-panel.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderSlicerPanel } from "../components/slicer-panel";

describe("slicer-panel", () => {
  it("rend une case par valeur et émet la sélection au clic", () => {
    const el = document.createElement("div");
    const onChange = vi.fn();
    renderSlicerPanel(el, {
      label: "Gestion",
      values: ["43", "58", "85"],
      selected: [],
      onChange,
    });
    const boxes = el.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
    expect(boxes.length).toBe(3);
    boxes[0].checked = true;
    boxes[0].dispatchEvent(new Event("change", { bubbles: true }));
    expect(onChange).toHaveBeenCalledWith(["43"]);
  });
});
```

- [ ] **Step 8 : Lancer → échec, puis implémenter `slicer-panel.ts`**

```ts
// src/components/slicer-panel.ts
// Composant maison (DOM) : panneau de cases à cocher pour un slicer.
// Émet la liste des valeurs cochées. Aucun calcul de données ici.
export interface SlicerPanelOptions {
  label: string;
  values: string[];
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function renderSlicerPanel(
  container: HTMLElement,
  opts: SlicerPanelOptions,
): void {
  container.innerHTML = "";
  container.classList.add("slicer-panel");
  const title = document.createElement("div");
  title.className = "slicer-panel__label";
  title.textContent = opts.label;
  container.appendChild(title);

  const current = new Set(opts.selected);
  for (const v of opts.values) {
    const row = document.createElement("label");
    row.className = "slicer-panel__row";
    const box = document.createElement("input");
    box.type = "checkbox";
    box.value = v;
    box.checked = current.has(v);
    box.addEventListener("change", () => {
      if (box.checked) current.add(v);
      else current.delete(v);
      opts.onChange([...current]);
    });
    const span = document.createElement("span");
    span.textContent = v;
    row.append(box, span);
    container.appendChild(row);
  }
}
```
Run: `npx vitest run src/__tests__/slicer-panel.test.ts` → PASS.

- [ ] **Step 9 : Câbler les slicers dans `view-mounter` (abonnement multi-clause)**

Étendre `RuntimeContext` avec un registre de slicers actifs `Map<slicerId, Clause>` et un dispatcher. Chaque vue dont la source est filtrée par un slicer `scope:"global"` (ou `"tab"` de l'onglet courant) recompose son SQL via `injectWhereAll(view.sql, view.source, activeClauses)` à chaque changement. Réutiliser le pattern `subscribeCrossFilter` mais sur la liste de clauses. (Ajouter `subscribeSlicers(ctx, view, render)` à côté de `subscribeCrossFilter`.) Garder la sélection `single` existante (clic carte/barre) intacte — les deux co-existent (AND).

- [ ] **Step 10 : Test d'intégration — fixture synthétique COMMITTÉE (preuve CI de toute la feature slicer, y compris l'usage DLI)**

⚠️ **Aucun `.vviz` n'est commité dans le repo** (tous gitignorés — données réelles ; cf. `examples-valid.test.ts` qui bâtit un doc inline). C'est donc ICI que la feature slicer est prouvée en CI, avec un doc **synthétique inline** qui exerce exactement les chemins consommés par le DLI (B-243 = slicer `tab`, B-244 = slicer `global`). Sans ce test, la wave DLI (gitignorée) ne laisserait aucune trace vérifiable.

```ts
// src/__tests__/slicer-integration.test.ts — doc synthétique (non sensible)
// Exerce : 1 slicer global (mirroir B-244 vision/gestion) + 1 slicer tab
// (miroir B-243), 2 vues filtrées. + rétro-compat : doc sans slicers inchangé.
```
Couvrir : (a) slicer global → SQL des 2 vues porte la clause `IN`/`=` ; (b) slicer tab → seules les vues de l'onglet filtrées ; (c) doc sans `slicers` → SQL identique à avant (rétro-compat) ; (d) slicer + sélection `single` coexistent en AND.

- [ ] **Step 11 : Gate non-régression + commit**

```bash
npm test && npx ajv validate -s schema/vviz-v1.json -d "examples/**/*.vviz" --strict=false
git commit -am "feat(viz-engine): slicers multi-valeurs + slicer global (DSL + moteur)

Généralise injectWhere → injectWhereAll (N clauses AND, multi-valeurs IN).
spec.slicers[] au schéma (scope tab|global). Composant maison slicer-panel.
Push-down DuckDB préservé ; rétro-compat des .vviz sans slicers.

Refs: B-251"
```

### Task 1B — B-100 : Intégrer MapLibre GL JS

**Files:**
- Create: `src/components/map-libre.ts` (wrapper carte de base)
- Modify: `src/components/map-view.ts` (option moteur : SVG d3-geo OU MapLibre)
- Create: `src/styles/map.css` (import du CSS MapLibre **local**, pas CDN — I-2)
- Test: `src/__tests__/map-libre.test.ts`

- [ ] **Step 0 (OBLIGATOIRE) : context7** — `resolve-library-id "maplibre-gl"` puis `query-docs` sur « Map constructor, addSource, addLayer, NavigationControl, offline/no-network ». Confirmer l'API de la version verrouillée (v5).

- [ ] **Step 1 : Test rouge** — `createBaseMap(container, {center:[2.5,46.5], zoom:5})` retourne un objet carte, conteneur reçoit un canvas, contrôle de zoom présent. (Mock `maplibre-gl` via `vi.mock` car WebGL absent en happy-dom.)

- [ ] **Step 2-4 : Implémenter le wrapper** — `map-libre.ts` : `new maplibregl.Map({container, style:{version:8,sources:{},layers:[]}, center, zoom})` + `addControl(new NavigationControl())`. **Aucune URL réseau** dans le style (style vide en B-100 ; fond ajouté en B-101). Import CSS depuis `node_modules/maplibre-gl/dist/maplibre-gl.css` copié en local (vérif grep anti-`http`).

- [ ] **Step 5 : Coexistence** — `map-view.ts` accepte `options.engine: "svg" | "maplibre"` (défaut `"svg"` pour rétro-compat) ; en `"maplibre"`, délègue à `map-libre.ts`. La couche choroplèthe reste pilotée par les données DuckDB (push-down) ; MapLibre ne fournit que le fond + zoom/pan.

- [ ] **Step 6 : Vérif zéro réseau** — `grep -rnE "https?://" src/components/map-libre.ts src/styles/map.css` → vide. Commit `Refs: B-100`.

### Task 1C — B-120 : Watcher FS (Rust + front)

**Files:**
- Create: `src-tauri/src/commands/watch.rs` (start/stop watcher, debounce 1 s)
- Modify: `src-tauri/src/lib.rs` (enregistrer la commande + plugin), `src-tauri/capabilities/main.json`
- Create: `src/services/watcher.ts` (abonnement événement front)
- Test: `src-tauri/tests/watch_smoke.rs`, `src/__tests__/watcher.test.ts`

- [ ] **Step 0 : context7** — `tauri-plugin-fs-watch` v2 : API `watch`/`watchImmediate`, signature d'événement.

- [ ] **Step 1 : Test rouge Rust** — `watch_smoke.rs` : démarrer un watcher sur un tmpdir, écrire un fichier, recevoir 1 événement après debounce. (S'appuyer sur `notify` ré-exporté par le plugin, ou `notify-debouncer`.)

- [ ] **Step 2-4 : Implémenter** — commande `#[tauri::command] start_watch(paths: Vec<String>, window: Window)` : watcher debouncé (1 s) qui émet `vv://data-changed` au front UNIQUEMENT pour les `path` listés dans `data.sources`. `stop_watch()` à la fermeture du `.vviz`. Pas de polling (vérif Process Explorer documentée en commentaire). Étendre `capabilities/main.json` si une permission watch est requise.

- [ ] **Step 5 : Front** — `watcher.ts` : `listen("vv://data-changed", cb)`. Démarré à l'ouverture d'un `.vviz`, arrêté à la fermeture/changement d'onglet (coordination avec `shell/tabs.ts`).

- [ ] **Step 6 : Tests + commit** `Refs: B-120`.

### Task 1D — B-130 : Décider stratégie export PDF

**Files:**
- Create: `docs/adr/ADR-PDF.md`
- Create: prototypes jetables `docs/scripts/pdf-spike-{print,pdflib}.md` (notes)

- [ ] **Step 1 : Prototyper les 2 voies** sur la vue UC-1 (carte + détail) :
  - (a) `window.print()` / WebView2 `chrome.printing` (fidélité max, dépend du moteur d'impression) ;
  - (b) capture canvas (MapLibre `getCanvas().toDataURL` + html2canvas pour le DOM) → `pdf-lib` A4 paysage.
- [ ] **Step 2 : Comparer** fidélité (carte WebGL — risque R-5), fluidité, dépendances, fallback hors-ligne. Tableau dans l'ADR.
- [ ] **Step 3 : Trancher + tracer** dans `ADR-PDF.md` (format Nygard) + impact taille MSI. **Recommandation par défaut si indécis** : pdf-lib (contrôle total, hors-ligne garanti, pas de dépendance au moteur d'impression du poste) — à confirmer par le spike WebGL.
- [ ] **Step 4 : Commit** `Refs: B-130`.

---

## 5. WAVE 2

> **⚠️ Wave DLI (2A) — fichiers gitignorés, donc PAS de commit repo ni de gate CI.** `examples/DLI/` (`.vviz`, `build_dashboard.py`, parquets) est gitignoré (données réelles CPAM). Conséquences sur le protocole §2 pour B-243/244/245 :
> - **Aucun commit repo** : `git status` doit rester propre côté repo après ces stories (les fichiers sont ignorés). Ne PAS faire `git commit Refs: B-24x` — il n'y a rien à committer.
> - **Verif locale uniquement** : `ajv validate` du `.vviz` réel + lancement app + capture (proxy webkit). Le `npm test` ne couvre PAS ces stories.
> - **Preuve CI de la feature** = le test synthétique de B-251 (Step 10), qui exerce les mêmes chemins slicer. La feature est donc couverte ; seul le *câblage DLI* est local.
> - **Marqueur** : passer `[x]` sur validation locale (rendu + ajv), en notant « vérifié localement, non committable (gitignore) ».

### Task 2A-1 — B-243 : Page Recherche DLI (consomme B-251)

**Files:** Modify `examples/DLI/build_dashboard.py` (sources `dli_recherche*`), `examples/DLI/dli_inventaire_autoporteur.vviz` (régénéré via `embed.py`).
- [ ] **Step 1** : ajouter au `.vviz` un onglet « Recherche » + `spec.slicers` `scope:"tab"` sur Compte / Type / Site / Gestion (mécanisme B-251) ; panneaux « scanné autre site » / « absent » = `table` filtrées sur la sélection croisée.
- [ ] **Step 2** : `ajv validate` du `.vviz` ; **aucune logique moteur ajoutée** (vérif : diff limité à `.vviz` + prep Python, tous gitignorés).
- [ ] **Step 3** : **pas de commit repo** (gitignore) — valider localement (rendu app + ajv) ; `git status` repo doit rester propre. Marquer `[x]` « vérifié localement ».

### Task 2A-2 — B-244 : Toggle Vision/Gestion DLI (consomme B-251)
**Files:** Modify `build_dashboard.py` (colonnes `vision`/`gestion`), `.vviz`.
- [ ] **Step 1** : prep — produire colonnes `vision` (CNAM/totalité, comptes spec §2) + `gestion` dans les sources concernées ; régénérer l'autoporteur.
- [ ] **Step 2** : déclarer un `spec.slicers` `scope:"global"` sur `vision` (toggle) + `gestion` (segment). Câblé sur toutes les vues.
- [ ] **Step 3** : vérifier qu'un changement de Vision recalcule tous les onglets ; libellés « périmètre VaultViz » maintenus. **Pas de commit repo** (gitignore) — validation locale, `[x]` « vérifié localement ».

### Task 2B-1 — B-101 : PMTiles offline
- [ ] **Step 0 : context7** `pmtiles` v4 + intégration `maplibre-gl` (protocol register).
- [ ] **Step 1** : décider fond (§16 Q3) — **défaut OSM PMTiles France** (~50 Mo) ou IGN ; tracer la décision. Si > budget MSI, fond départemental simplifié.
- [ ] **Step 2** : enregistrer `pmtiles://` (`maplibregl.addProtocol("pmtiles", protocol.tile)`), source dans le style, fichier dans `src-tauri/resources/` (ou chargé local). Rendu zoom 5-10 **en mode avion** (vérif zéro réseau). Mesurer taille MSI vs §9.1 (<30 Mo) — si dépassement, escalader (note, pas blocage).
- [ ] **Step 3** : commit `Refs: B-101`.

### Task 2B-2 — B-110 : Pipeline TopoJSON IGN
**Files:** Create `scripts/build-geo.sh`, `ref/departements.topojson`, `ref/regions.topojson`, `ref/LICENSE.md`.
- [ ] **Step 1** : script `npx mapshaper` — télécharge IGN ADMIN EXPRESS COG simplifiée, quantization ~5 %, sortie `departements.topojson` ≤ 200 Ko + `regions.topojson`. Licence Etalab 2.0 dans `ref/LICENSE.md`.
- [ ] **Step 2** : script reproductible + documenté (en-tête commande). Commit `Refs: B-110`.

### Task 2C — B-121 : Bannière refresh
**Files:** Create `src/components/refresh-banner.ts`, modify `shell/dashboard.ts`. Test `src/__tests__/refresh-banner.test.ts`.
- [ ] **Step 1 : Test rouge** — à l'événement `vv://data-changed`, bandeau apparaît ; bouton « Recharger » appelle le re-fetch ; « Ignorer » masque pour la session ; aucun rechargement automatique.
- [ ] **Step 2-4** : implémenter, câbler sur `watcher.ts` (B-120). Commit `Refs: B-121`.

### Task 2D-1 — B-170 : Doc utilisateur 1 page
**Files:** Create `docs/user.md`. (Le PDF généré relève de B-131 une fois l'export prêt ; le `.md` est produit ici.)
- [ ] **Step 1** : rédiger 1 page A4 : ouvrir un `.vviz`, exporter PDF/PNG/CSV, réagir à la bannière, que faire en cas d'erreur (réf. support DSI = placeholder organisationnel, pas technique). Commit `Refs: B-170`.

### Task 2D-2 — B-171 : Doc auteur 5 pages
**Files:** Create `docs/author.md`.
- [ ] **Step 1** : anatomie d'un `.vviz` ; référence des `type` de vues supportés (depuis `schema/vviz-v1.json`) avec exemples ; conventions UNC (ADR-007) ; ≥ 3 exemples canoniques (carte, série temporelle, table) ; lien schéma. Commit `Refs: B-171`.

---

## 6. WAVE 3

### Task 3A — B-245 : Intégration finale DLI
- [ ] **Step 1** : assembler le `.vviz` final (onglets W2 + Recherche B-243 + globaux B-244) ; vérifier couverture ~90 % PBI, écarts listés, **aucun chiffre non reproductible affiché** (spec §2).
- [ ] **Step 2** : `npm test` + `cargo test` verts ; exemples canoniques non régressés ; régénération via `build_dashboard.py`+`embed.py` (édition manuelle non durable). `examples/DLI/` reste gitignoré.
- [ ] **Step 3** : lancer l'app (`run` skill / `VVIZ_DEFAULT=…autoporteur.vviz`), capture par onglet (proxy webkit ; fidélité Windows = CI). **Pas de commit repo** (`.vviz` gitignoré) — `[x]` « vérifié localement ». Seuls le BACKLOG (§0.3) et la mémoire sont committables ici.

### Task 3B — B-111 : Drill carto MapLibre + TopoJSON
- [ ] **Step 0 : context7** MapLibre `setFeatureState`/`fill-color` data-driven, events `click`.
- [ ] **Step 1** : couche `fill` colorée par métrique (jointure TopoJSON ↔ valeur DuckDB) ; clic département émet une sélection (coordination B-040/B-041, mécanisme `createPointEmitter`) ; perf drill < 500 ms (cible V1 §9.1). Test sur Parquet réel si dispo.
- [ ] **Step 2** : commit `Refs: B-111`.

### Task 3C — B-172 : Publier le schéma `.vviz`
**Files:** copie schéma à l'install (`src-tauri/resources/schema/`) + doc.
- [ ] **Step 1** : schéma accessible via chemin local installé (`%ProgramFiles%\VaultViz\schema\`) OU raw GitHub privé (§16 Q4 — défaut : copie locale, hors-ligne). `docs/author.md` référence le chemin. Test : VS Code valide un `.vviz` contre le schéma. Commit `Refs: B-172`.

---

## 7. WAVE 4 — Exports (séquentiel)

### Task 4A — B-131 : Export PDF A4 (exigence I-9 / UC-4)
Dépend de B-111 (carte) + B-130 (décision).
- [ ] **Step 0 : context7** `pdf-lib` (PDFDocument, addPage A4 paysage, drawImage PNG/JPEG).
- [ ] **Step 1 : Test rouge** — `exportToPdf(view)` produit un Blob/bytes PDF non vide, page A4 paysage, métadonnées (titre `.vviz`, auteur, date).
- [ ] **Step 2-4** : implémenter selon ADR-PDF (B-130). Carte : `map.getCanvas().toDataURL()` ; DOM : capture canvas. Assembler en A4 paysage. < 5 s sur dashboard 3 vues.
- [ ] **Step 5** : tester sur les 6 UC canoniques (dont carte WebGL — R-5). Bouton « Exporter PDF » dans la toolbar. Commit `Refs: B-131`. **Mettre à jour le PDF de `docs/user.md` (B-170).**

### Task 4B — B-132 : Exports PNG + CSV
- [ ] **Step 1 : Test rouge** — CSV : données filtrées (post cross-filter) avec en-têtes, UTF-8 **BOM** (ouverture Excel sans déformation). PNG : capture haute-réso → presse-papier ET fichier.
- [ ] **Step 2-4** : implémenter. CSV depuis la table Arrow courante (`apache-arrow`) ; PNG via canvas + Clipboard API + download. Boutons accessibles clavier. Commit `Refs: B-132`.

---

## 8. WAVE 5 — Handoff externe (artefacts only — FRONTIÈRE D'AUTONOMIE)

> L'agent produit les artefacts ; il **ne réalise pas** l'acte externe (DSI/MECM/terrain/décision). À la fin de chaque story, marquer `[~]` (et non `[x]`) avec note « artefact prêt, acte externe en attente », SAUF si l'utilisateur fournit le retour.

### Task 5A — B-150p : Procédure signature DSI (artefact)
- [ ] Créer `docs/deploy.md` : point de jonction CI → signature DSI → MECM, cycle d'itération. Référencer le MSI signable de la dernière release (`v0.0.1-rc8`). **STOP** : signature = DSI (ADR-005). Marquer `[~]`.

### Task 5B — B-180p : Package pilote MECM (artefact)
- [ ] Créer `docs/handoff/mecm-pilot-package.md` : instructions push silencieux, communication pilotes (réutilise `docs/user.md`), canal de retour. **STOP** : push parc = DSI/sponsor. `[~]`.

### Task 5C — B-181p : Instrument de collecte terrain (artefact)
- [ ] Créer `docs/handoff/feedback-collection.md` : métriques (taux install/ouverture autonome, durée), grille verbatim, modèle de rapport. **STOP** : collecte = terrain. `[~]`.

### Task 5D — B-190p : Template décision Go/No-Go V1 (artefact pré-rempli)
- [ ] Créer `docs/adr/ADR-V1-GoNoGo-template.md` : critères §12.2 pré-évalués avec les métriques mesurées (perf carto B-111, PDF B-131, tests). **STOP** : décision signée = Sponsor DSI + RSSI. `[~]`.

---

## 9. Clôture

- [ ] Tableau de bord §0.3 du BACKLOG à jour (16 stories dev/doc `[x]`, 4 externes `[~]`).
- [ ] Mémoire : maj `project_bi_generic_scope` (slicers faits), `project_design_integration` (carto MapLibre livrée).
- [ ] PR finale de la branche d'exécution vers `main` + tag `v0.1.0` (premier jalon V1 fonctionnel — bump mineur car nouvelles features).
- [ ] Gate global vert : `npm test` + `cargo test` + `ajv validate`.

---

## 10. Self-review (couverture spec)

- **20 stories citées** : B-251✓(1A) B-243✓(2A1) B-244✓(2A2) B-245✓(3A) B-100✓(1B) B-101✓(2B1) B-110✓(2B2) B-111✓(3B) B-120✓(1C) B-121✓(2C) B-130✓(1D) B-131✓(4A) B-132✓(4B) B-170✓(2D1) B-171✓(2D2) B-172✓(3C) B-150✓(5A) B-180✓(5B) B-181✓(5C) B-190✓(5D). **Aucune lacune.**
- **Frontière d'autonomie** explicite (§0) : 16 autonomes, 1 porte lockfile, 4 handoff.
- **Cohérence types** : `Clause {field, values[]}` et `injectWhereAll(sql, source, clauses)` utilisés identiquement en 1A et consommés en 2A. `engine:"svg"|"maplibre"` cohérent 1B↔3B.
- **Anti-hallucination** : Tâche 0 context7 sur 1B, 1C, 2B1, 3B, 4A (toutes les deps nouvelles).
