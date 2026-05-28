# V0 — Réparation de l'interpréteur `.vviz`

> **Pour les workers agentic** : SKILL REQUISE — `superpowers:executing-plans` ou `superpowers:subagent-driven-development`. Steps en `- [ ]`.

**Goal** : transformer VaultViz d'un POC archi avec démo hardcodée en interpréteur réel de `.vviz`. Chaque fichier `.vviz` ouvert pilote VRAIMENT le rendu (chemin parquet, noms de champs, agrégations, layout). Le double-clic et le sélecteur de fichier UI fonctionnent.

**Architecture** : Tauri 2 + DuckDB natif + Arrow IPC + Mosaic + JSON Schema (déjà en place). Refacto du loader et du dispatcher de vues côté front pour que le DSL `.vviz` soit l'unique source de vérité — plus aucune constante `code_dept` / `sample.parquet` / `cross_filter_demo.vviz` hardcodée.

**Tech Stack** : `tauri-plugin-dialog` (file picker), `path-browserify` (résolution relative), `apache-arrow` (schemas DuckDB → vues), DuckDB SQL templating maison.

---

## §0. Diagnostic — ce qui est cassé aujourd'hui

| Symptôme | Fichier | Ligne (approx) | Cause |
|---|---|---|---|
| Pas de bouton « Ouvrir un `.vviz` » | `src/main.ts` | bootstrap | UI jamais conçue |
| `DEFAULT_DASHBOARD_VVIZ` hardcodé | `src/main.ts:204` | const | démo, pas générique |
| `CREATE VIEW effectifs … LPAD(id % 96)` | `src/main.ts:275` | renderDashboardFromVviz | invente une colonne |
| `mountView` n'utilise jamais `view.encoding.*.field` | `src/main.ts:331-424` | switch | hardcode `"code_dept"` |
| `renderTable` columns par défaut hardcodées | `src/main.ts:378` | mountView | ignore le spec |
| Aucun chargement de `doc.data.sources[].path` | tout `main.ts` | n/a | parquet path ignoré |
| Pas d'agg `encoding.color.aggregate` | `mountView` | n/a | jamais lu |

**Cible PRD §4.1 V0 violée** : « drill-down départemental via Mosaic selections **push-down DuckDB** » → l'app push-down sur une table SYNTHÉTISÉE, pas sur le parquet déclaré. UC-1 / UC-3 non démontrés.

---

## §1. Architecture cible

```
┌─────────────────────────────────────────────────────────────────┐
│  Bootstrap                                                       │
│    1. Toolbar permanente avec bouton "Ouvrir un .vviz..."        │
│    2. startup_path() (argv / VVIZ_DEFAULT / bundle resource)     │
│       → si Some(path) : openVViz(path)                           │
│       → si None : welcome screen + bouton                        │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  openVViz(path)                                                  │
│    1. read_vviz + JSON.parse + Ajv (spec-loader B-061)           │
│    2. resolveSources(doc, vvizDir)                                │
│       pour chaque source : path UNC/abs/rel relatif au .vviz     │
│       → CREATE OR REPLACE VIEW <name> AS                          │
│         SELECT * FROM read_parquet('<resolved>')                  │
│    3. renderViz(doc, container)                                  │
│       pour chaque view : compileView(view, doc) → mountView      │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  compileView(view, doc) → CompiledView                           │
│    Lit view.type + view.source + view.encoding                   │
│    Produit le plan SQL + les params de rendu                     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  mountView(compiled, container, ctx, conn)                       │
│    map_choropleth → SQL agg par geo.field, renderChoropleth       │
│    bar / barX/Y   → vg.from + vg.barY avec x/y du spec           │
│    table          → SELECT colonnes du spec, renderTable          │
│    kpi            → SQL agg → texte                              │
└─────────────────────────────────────────────────────────────────┘
```

---

## §2. Structure de fichiers cible

```
src/
├── main.ts                            # REFACTORÉ : ~150 lignes au lieu de 616
│                                       # toolbar + welcome + openVViz + dispatch
├── viz-engine/
│   ├── path-resolver.ts                # NOUVEAU
│   ├── source-loader.ts                # NOUVEAU — CREATE VIEW par source
│   ├── view-compiler.ts                # NOUVEAU — DSL view → SQL + render plan
│   ├── view-mounter.ts                 # NOUVEAU — extrait du main.ts mountView
│   ├── spec-loader.ts                  # inchangé
│   ├── duck-connector.ts               # inchangé
│   ├── mosaic-runtime.ts               # ALLEGÉ : on garde createRuntime/
│   │                                   # ensureSelection ; on retire la version
│   │                                   # interne de compileToMosaic
│   ├── types.ts                        # ENRICHI : ViewSpec, EncodingChannel
│   └── index.ts                        # inchangé
├── components/
│   ├── map-view.ts                     # API : prend dataByKey générique +
│   │                                   # un mapper (code → fkey)
│   ├── bar-chart.ts                    # API : prend xField, yAgg, yField
│   ├── table-view.ts                   # inchangé (déjà data-driven)
│   ├── toolbar.ts                      # NOUVEAU — barre top permanente
│   ├── welcome.ts                      # NOUVEAU — écran d'accueil
│   ├── error-banner.ts                 # inchangé
│   └── view-frame.ts                   # NOUVEAU — cadre commun par vue
src-tauri/
└── (déjà OK : startup_path en rc2, dialog plugin à ajouter)
schema/
└── vviz-v1.json                        # AFFINÉ : préciser encoding.x/y/color/geo
examples/
├── effectifs_2026.vviz                 # RÉÉCRIT cohérent avec sample.parquet
├── sample.parquet                      # inchangé (id, label, value)
├── demo_dept.vviz                      # NOUVEAU pour démo carto
├── demo_dept.parquet                   # NOUVEAU généré au build
└── gen-demo-dept.rs                    # NOUVEAU binaire de génération
docs/
└── user/
    └── format-vviz.md                  # NOUVEAU — doc auteur minimale V0
                                        # (le full doc auteur reste V1-8)
```

---

## §3. Stratégie de test

| Couche | Pattern | Outils |
|---|---|---|
| `path-resolver.ts` | unit (mock cwd, fixtures) | vitest |
| `source-loader.ts` | unit avec DuckDB in-memory via mock connector | vitest |
| `view-compiler.ts` | unit : DSL view → SQL string ASSERTION exacte | vitest |
| `view-mounter.ts` | integration avec happy-dom + mock connector | vitest |
| Composants | inchangé : tests existants | vitest |
| Bout-en-bout | un test qui ouvre un `.vviz` minimaliste + parquet stub via `vi.mock` invoke | vitest |

**Cible** : ≥ 75 tests vitest (62 actuels + ~13 nouveaux) tous verts. Cargo tests inchangés (22 OK).

---

## §4. Pré-requis machine

Déjà OK :
- `tauri-plugin-dialog = "2"` ajouté dans `Cargo.toml` (branche actuelle `fix/file-picker-ui`)
- `@tauri-apps/plugin-dialog` ajouté dans `package.json`
- `capabilities/main.json` enrichi de `dialog:default` + `dialog:allow-open`

À ne PAS faire dans ce plan :
- Pas de migration MapLibre (V1-1)
- Pas d'export PDF (V1-4)
- Pas de DSFR (V1-5)
- Pas d'audit RGAA (V1-7)
- Pas de doc auteur complète (V1-8, sauf stub de routage erreur)

---

## Branche unique de travail

`fix/file-picker-ui` (déjà créée, contient déjà le plugin dialog ajout). Toutes les tasks ci-dessous sont des commits successifs sur cette branche. **Un seul PR final**.

---

## Task 1 : Toolbar + welcome (UI minimale)

**Files** :
- Create : `src/components/toolbar.ts`
- Create : `src/components/welcome.ts`
- Create : `src/__tests__/toolbar.test.ts`
- Modify : `src/styles/main.css` (styles toolbar + welcome)

- [ ] **Step 1.1 : Écrire le test toolbar**

```ts
// src/__tests__/toolbar.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderToolbar } from "../components/toolbar";

describe("toolbar", () => {
  it("renders un bouton 'Ouvrir' qui appelle onOpen", () => {
    const c = document.createElement("div");
    const onOpen = vi.fn();
    renderToolbar(c, { onOpen, currentPath: null });
    const btn = c.querySelector<HTMLButtonElement>(".vv-open-btn");
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toMatch(/ouvrir/i);
    btn!.click();
    expect(onOpen).toHaveBeenCalled();
  });

  it("affiche le chemin courant s'il est fourni", () => {
    const c = document.createElement("div");
    renderToolbar(c, { onOpen: () => {}, currentPath: "/tmp/x.vviz" });
    expect(c.textContent).toContain("x.vviz");
  });

  it("affiche 'Aucun fichier' si pas de chemin", () => {
    const c = document.createElement("div");
    renderToolbar(c, { onOpen: () => {}, currentPath: null });
    expect(c.textContent).toMatch(/aucun fichier/i);
  });
});
```

Run : `npm test -- toolbar` → FAIL (module non trouvé).

- [ ] **Step 1.2 : Implémenter `toolbar.ts`**

```ts
// src/components/toolbar.ts
export interface ToolbarOptions {
  onOpen: () => void;
  currentPath: string | null;
}

function shortName(path: string): string {
  const norm = path.replace(/\\/g, "/");
  const parts = norm.split("/");
  return parts[parts.length - 1] || path;
}

export function renderToolbar(container: HTMLElement, opts: ToolbarOptions): void {
  const label = opts.currentPath ? shortName(opts.currentPath) : "Aucun fichier";
  const title = opts.currentPath ? opts.currentPath : "Aucun fichier ouvert";
  container.innerHTML = `
    <header class="vv-toolbar" role="banner">
      <div class="vv-toolbar-brand">
        <strong>VaultViz</strong>
        <span class="vv-toolbar-version">V0</span>
      </div>
      <div class="vv-toolbar-file" title="${escapeAttr(title)}">
        <span class="vv-toolbar-label">Fichier :</span>
        <code>${escapeHtml(label)}</code>
      </div>
      <div class="vv-toolbar-actions">
        <button type="button" class="vv-open-btn">Ouvrir un fichier .vviz…</button>
      </div>
    </header>
  `;
  const btn = container.querySelector<HTMLButtonElement>(".vv-open-btn")!;
  btn.addEventListener("click", () => opts.onOpen());
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
function escapeAttr(s: string): string {
  return escapeHtml(s).replace(/"/g, "&quot;");
}
```

Run : `npm test -- toolbar` → 3 PASS.

- [ ] **Step 1.3 : Implémenter `welcome.ts`**

```ts
// src/components/welcome.ts
export interface WelcomeOptions {
  onOpen: () => void;
}

export function renderWelcome(container: HTMLElement, opts: WelcomeOptions): void {
  container.innerHTML = `
    <section class="vv-welcome">
      <h1>VaultViz</h1>
      <p class="vv-welcome-sub">Visualiseur local de fichiers <code>.vviz</code></p>
      <button type="button" class="vv-welcome-open">Ouvrir un fichier .vviz…</button>
      <p class="vv-welcome-hint">
        Astuce : tu peux aussi double-cliquer un <code>.vviz</code> dans l'Explorateur.
      </p>
    </section>
  `;
  container.querySelector<HTMLButtonElement>(".vv-welcome-open")!
    .addEventListener("click", () => opts.onOpen());
}
```

- [ ] **Step 1.4 : Test welcome**

```ts
// src/__tests__/welcome.test.ts
import { describe, it, expect, vi } from "vitest";
import { renderWelcome } from "../components/welcome";

describe("welcome", () => {
  it("appelle onOpen au clic", () => {
    const c = document.createElement("div");
    const onOpen = vi.fn();
    renderWelcome(c, { onOpen });
    c.querySelector<HTMLButtonElement>(".vv-welcome-open")!.click();
    expect(onOpen).toHaveBeenCalled();
  });
});
```

- [ ] **Step 1.5 : CSS toolbar + welcome**

Ajouter dans `src/styles/main.css` :

```css
.vv-toolbar {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 0.5rem 1rem;
  border-bottom: 1px solid rgba(127, 127, 127, 0.2);
  background: rgba(127, 127, 127, 0.05);
  position: sticky;
  top: 0;
  z-index: 10;
}
.vv-toolbar-brand strong { font-size: 1.05rem; }
.vv-toolbar-version { font-size: 0.75rem; opacity: 0.7; margin-left: 0.375rem; }
.vv-toolbar-file { flex: 1; font-size: 0.85rem; opacity: 0.85; }
.vv-toolbar-file code { font-family: ui-monospace, "Cascadia Code", Menlo, monospace; }
.vv-toolbar-label { opacity: 0.7; margin-right: 0.375rem; }
.vv-open-btn {
  background: rgba(0, 110, 230, 0.18);
  color: inherit;
  border: 1px solid rgba(0, 110, 230, 0.5);
  border-radius: 4px;
  padding: 0.375rem 0.875rem;
  font: inherit;
  font-size: 0.9rem;
  cursor: pointer;
}
.vv-open-btn:hover { background: rgba(0, 110, 230, 0.3); }
.vv-welcome {
  max-width: 540px;
  margin: 8rem auto 2rem;
  text-align: center;
}
.vv-welcome h1 { margin: 0 0 0.25rem; font-size: 2.25rem; }
.vv-welcome-sub { opacity: 0.8; margin: 0 0 2rem; }
.vv-welcome-open {
  background: rgba(0, 110, 230, 0.22);
  color: inherit;
  border: 1px solid rgba(0, 110, 230, 0.6);
  border-radius: 6px;
  padding: 0.625rem 1.5rem;
  font: inherit;
  font-size: 1rem;
  cursor: pointer;
}
.vv-welcome-hint { font-size: 0.85rem; opacity: 0.65; margin-top: 1.25rem; }
```

- [ ] **Step 1.6 : Commit**

```
git add src/components/toolbar.ts src/components/welcome.ts \
        src/__tests__/toolbar.test.ts src/__tests__/welcome.test.ts \
        src/styles/main.css
git commit -m "feat(ui): composants Toolbar + Welcome (file picker UX)"
```

---

## Task 2 : Résolution de chemins relatifs au `.vviz`

**Files** :
- Create : `src/viz-engine/path-resolver.ts`
- Create : `src/__tests__/path-resolver.test.ts`

- [ ] **Step 2.1 : Test path-resolver**

```ts
// src/__tests__/path-resolver.test.ts
import { describe, it, expect } from "vitest";
import { resolvePath, vvizDir } from "../viz-engine/path-resolver";

describe("path-resolver", () => {
  describe("vvizDir", () => {
    it("extrait le dossier d'un chemin POSIX", () => {
      expect(vvizDir("/home/x/y.vviz")).toBe("/home/x");
    });
    it("extrait le dossier d'un chemin Windows", () => {
      expect(vvizDir("C:/Users/x/y.vviz")).toBe("C:/Users/x");
    });
    it("extrait le dossier d'un chemin UNC", () => {
      expect(vvizDir("//share/x/y.vviz")).toBe("//share/x");
    });
    it("retourne '.' si pas de séparateur", () => {
      expect(vvizDir("y.vviz")).toBe(".");
    });
  });

  describe("resolvePath", () => {
    it("renvoie tel quel un chemin UNC", () => {
      expect(resolvePath("//host/share/x.parquet", "/anywhere"))
        .toBe("//host/share/x.parquet");
    });
    it("renvoie tel quel un chemin avec lettre de lecteur", () => {
      expect(resolvePath("Z:/data/x.parquet", "/anywhere"))
        .toBe("Z:/data/x.parquet");
    });
    it("renvoie tel quel un chemin absolu POSIX", () => {
      expect(resolvePath("/abs/x.parquet", "/anywhere"))
        .toBe("/abs/x.parquet");
    });
    it("résout ./x.parquet par rapport au dossier du .vviz", () => {
      expect(resolvePath("./x.parquet", "/home/dash"))
        .toBe("/home/dash/x.parquet");
    });
    it("résout x.parquet (sans ./) par rapport au dossier du .vviz", () => {
      expect(resolvePath("x.parquet", "/home/dash"))
        .toBe("/home/dash/x.parquet");
    });
    it("résout ../x.parquet en remontant d'un niveau", () => {
      expect(resolvePath("../x.parquet", "/home/dash"))
        .toBe("/home/x.parquet");
    });
    it("normalise les antislashes Windows", () => {
      expect(resolvePath(".\\data\\x.parquet", "C:/Users/x"))
        .toBe("C:/Users/x/data/x.parquet");
    });
  });
});
```

- [ ] **Step 2.2 : Implémenter `path-resolver.ts`**

```ts
// src/viz-engine/path-resolver.ts
//
// Résolution des chemins déclarés dans data.sources[].path d'un .vviz.
// Conformément à ADR-007 :
//   - UNC POSIX `//host/share/...` : tel quel
//   - Lettre de lecteur Windows `[A-Z]:/...` : tel quel
//   - Chemin absolu POSIX `/...` : tel quel
//   - Chemin relatif `./...`, `../...`, `name.parquet` : résolu par
//     rapport au DOSSIER DU FICHIER .vviz (pas au CWD du processus).

/** Extrait le dossier parent d'un chemin de fichier .vviz. */
export function vvizDir(vvizPath: string): string {
  const norm = vvizPath.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  if (idx < 0) return ".";
  if (idx === 0) return "/";
  return norm.slice(0, idx);
}

/**
 * Résout un chemin déclaré dans data.sources[].path par rapport au
 * dossier du .vviz qui le déclare.
 *
 * `vvizDirPath` est le dossier du .vviz (cf. {@link vvizDir}).
 */
export function resolvePath(declared: string, vvizDirPath: string): string {
  const p = declared.replace(/\\/g, "/");
  // UNC : //host/share/...
  if (p.startsWith("//")) return p;
  // Drive Windows : C:/...
  if (/^[A-Za-z]:\//.test(p)) return p;
  // Absolu POSIX : /...
  if (p.startsWith("/")) return p;
  // Relatif : strip ./
  const rel = p.replace(/^\.\//, "");
  // Joindre + simplifier ../ et ./
  const segments = `${vvizDirPath.replace(/\\/g, "/")}/${rel}`.split("/");
  const stack: string[] = [];
  for (const seg of segments) {
    if (seg === "" || seg === ".") {
      if (stack.length === 0) stack.push("");
      continue;
    }
    if (seg === "..") {
      if (stack.length > 1) stack.pop();
      continue;
    }
    stack.push(seg);
  }
  const joined = stack.join("/");
  return joined.replace(/\/+/g, "/");
}
```

Run : `npm test -- path-resolver` → 12 PASS.

- [ ] **Step 2.3 : Commit**

```
git add src/viz-engine/path-resolver.ts src/__tests__/path-resolver.test.ts
git commit -m "feat(viz-engine): path-resolver pour chemins .vviz (ADR-007)"
```

---

## Task 3 : Source loader (DuckDB `CREATE VIEW` par source)

**Files** :
- Create : `src/viz-engine/source-loader.ts`
- Create : `src/__tests__/source-loader.test.ts`

- [ ] **Step 3.1 : Test source-loader**

```ts
// src/__tests__/source-loader.test.ts
import { describe, it, expect, vi } from "vitest";
import { loadSources } from "../viz-engine/source-loader";
import type { DuckConnector } from "../viz-engine/duck-connector";
import type { VVizDocument } from "../viz-engine/types";

function fakeConn(): { conn: DuckConnector; sqls: string[] } {
  const sqls: string[] = [];
  return {
    sqls,
    conn: {
      query: vi.fn(async (q) => {
        sqls.push(q.sql);
        return undefined;
      }),
    } as unknown as DuckConnector,
  };
}

const baseDoc: VVizDocument = {
  vviz: { version: "1.0", title: "T" },
  data: {
    sources: [
      { name: "effectifs", path: "./sample.parquet" },
      { name: "geo", path: "/abs/geo.parquet" },
    ],
  },
  spec: { engine: "mosaic", views: [] } as any,
};

describe("loadSources", () => {
  it("CREATE VIEW pour chaque source avec chemin résolu", async () => {
    const { conn, sqls } = fakeConn();
    await loadSources(conn, baseDoc, "/home/x");
    expect(sqls).toHaveLength(2);
    expect(sqls[0]).toMatch(
      /CREATE OR REPLACE VIEW "effectifs" AS SELECT \* FROM read_parquet\('\/home\/x\/sample\.parquet'\)/,
    );
    expect(sqls[1]).toMatch(
      /CREATE OR REPLACE VIEW "geo" AS SELECT \* FROM read_parquet\('\/abs\/geo\.parquet'\)/,
    );
  });

  it("échappe correctement les apostrophes dans le path", async () => {
    const doc = {
      ...baseDoc,
      data: { sources: [{ name: "x", path: "/it's/weird.parquet" }] },
    };
    const { conn, sqls } = fakeConn();
    await loadSources(conn, doc as any, "/home/x");
    expect(sqls[0]).toContain("/it''s/weird.parquet");
  });

  it("refuse un nom de source qui ne match pas le pattern SQL", async () => {
    const doc = {
      ...baseDoc,
      data: { sources: [{ name: "1bad", path: "/x.parquet" }] },
    };
    const { conn } = fakeConn();
    await expect(loadSources(conn, doc as any, "/home/x"))
      .rejects.toThrow(/nom de source/i);
  });
});
```

- [ ] **Step 3.2 : Implémenter `source-loader.ts`**

```ts
// src/viz-engine/source-loader.ts
//
// Pour chaque source déclarée dans le .vviz, on crée une vue DuckDB :
//   CREATE OR REPLACE VIEW "<name>" AS SELECT * FROM read_parquet('<path>')
// Le `name` doit matcher le pattern SQL (déjà contraint par le schema
// JSON : `^[a-zA-Z_][a-zA-Z0-9_]{0,63}$`). On revalide ici par
// sécurité (defense in depth).

import { resolvePath } from "./path-resolver";
import type { DuckConnector } from "./duck-connector";
import type { VVizDocument } from "./types";

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

export async function loadSources(
  conn: DuckConnector,
  doc: VVizDocument,
  vvizDirPath: string,
): Promise<void> {
  for (const src of doc.data.sources) {
    if (!SAFE_IDENT.test(src.name)) {
      throw new Error(
        `nom de source invalide (attendu identifiant SQL) : "${src.name}"`,
      );
    }
    const resolved = resolvePath(src.path, vvizDirPath);
    const sql =
      `CREATE OR REPLACE VIEW "${src.name}" AS ` +
      `SELECT * FROM read_parquet(${sqlString(resolved)})`;
    await conn.query({ type: "exec", sql });
  }
}
```

Run : `npm test -- source-loader` → 3 PASS.

- [ ] **Step 3.3 : Commit**

```
git add src/viz-engine/source-loader.ts src/__tests__/source-loader.test.ts
git commit -m "feat(viz-engine): source-loader CREATE VIEW par source du .vviz"
```

---

## Task 4 : Compileur de vues (DSL `encoding` → SQL)

**Files** :
- Modify : `src/viz-engine/types.ts` (ajout types)
- Create : `src/viz-engine/view-compiler.ts`
- Create : `src/__tests__/view-compiler.test.ts`

- [ ] **Step 4.1 : Enrichir types**

Ajouter dans `src/viz-engine/types.ts` :

```ts
// Types DSL .vviz — alignés sur schema/vviz-v1.json.

export type EncodingChannel = {
  field?: string;
  aggregate?: "sum" | "avg" | "count" | "min" | "max" | "none";
  topology?: string;   // pour geo
};

export interface ViewSpec {
  id: string;
  type:
    | "map_choropleth"
    | "bar"
    | "barX"
    | "barY"
    | "line"
    | "area"
    | "dot"
    | "table"
    | "kpi";
  source: string;
  title?: string;
  filterBy?: string;
  encoding?: Record<string, EncodingChannel | string[] | undefined>;
  options?: Record<string, unknown>;
}

export interface SelectionSpec {
  id: string;
  kind: "single" | "interval" | "crossfilter";
}

// Resserrer VVizDocument.spec (déjà en types.ts mais en Record<string,unknown>)
export interface VVizSpec {
  engine: "mosaic";
  layout?: "vstack" | "hstack" | "grid";
  selections?: SelectionSpec[];
  views: ViewSpec[];
}
```

Mettre à jour `VVizDocument.spec: VVizSpec` (au lieu de Record).

- [ ] **Step 4.2 : Test view-compiler — choropleth**

```ts
// src/__tests__/view-compiler.test.ts
import { describe, it, expect } from "vitest";
import { compileView } from "../viz-engine/view-compiler";
import type { ViewSpec } from "../viz-engine/types";

describe("compileView — map_choropleth", () => {
  it("génère SQL SUM par geo.field", () => {
    const v: ViewSpec = {
      id: "m1",
      type: "map_choropleth",
      source: "effectifs",
      encoding: {
        geo: { field: "dept_code" },
        color: { field: "n", aggregate: "sum" },
      },
    };
    const c = compileView(v);
    expect(c.kind).toBe("choropleth");
    expect(c.sql).toMatch(
      /SELECT\s+"dept_code"\s+AS\s+key,\s+SUM\("n"\)\s+AS\s+v\s+FROM\s+"effectifs"\s+GROUP BY\s+"dept_code"/,
    );
    expect(c.geoField).toBe("dept_code");
  });

  it("défaut aggregate=count si non précisé", () => {
    const v: ViewSpec = {
      id: "m1",
      type: "map_choropleth",
      source: "effectifs",
      encoding: { geo: { field: "dc" } },
    };
    const c = compileView(v);
    expect(c.sql).toMatch(/COUNT\(\*\)\s+AS\s+v/);
  });

  it("rejette un encoding sans geo.field", () => {
    const v: ViewSpec = {
      id: "m1",
      type: "map_choropleth",
      source: "effectifs",
      encoding: {},
    };
    expect(() => compileView(v)).toThrow(/geo\.field/);
  });
});

describe("compileView — bar", () => {
  it("génère SQL group by xField, count par défaut", () => {
    const v: ViewSpec = {
      id: "b1",
      type: "barY",
      source: "effectifs",
      encoding: { x: { field: "cat" } },
    };
    const c = compileView(v);
    expect(c.kind).toBe("bar");
    expect(c.xField).toBe("cat");
    expect(c.yField).toBeUndefined();
    expect(c.yAggregate).toBe("count");
  });

  it("respecte y.aggregate + y.field si précisés", () => {
    const v: ViewSpec = {
      id: "b1",
      type: "bar",
      source: "effectifs",
      encoding: { x: { field: "cat" }, y: { field: "val", aggregate: "sum" } },
    };
    const c = compileView(v);
    expect(c.yField).toBe("val");
    expect(c.yAggregate).toBe("sum");
  });
});

describe("compileView — table", () => {
  it("utilise encoding.columns (array de strings)", () => {
    const v: ViewSpec = {
      id: "t1",
      type: "table",
      source: "effectifs",
      encoding: { columns: ["a", "b", "c"] },
    };
    const c = compileView(v);
    expect(c.kind).toBe("table");
    expect(c.columns).toEqual(["a", "b", "c"]);
  });

  it("rejette une table sans colonnes", () => {
    const v: ViewSpec = {
      id: "t1",
      type: "table",
      source: "effectifs",
      encoding: {},
    };
    expect(() => compileView(v)).toThrow(/columns/i);
  });
});

describe("compileView — kpi", () => {
  it("génère SELECT agg comme nombre unique", () => {
    const v: ViewSpec = {
      id: "k1",
      type: "kpi",
      source: "effectifs",
      encoding: { value: { field: "n", aggregate: "sum" } },
    };
    const c = compileView(v);
    expect(c.kind).toBe("kpi");
    expect(c.sql).toMatch(/SELECT\s+SUM\("n"\)\s+AS\s+v\s+FROM\s+"effectifs"/);
  });
});
```

- [ ] **Step 4.3 : Implémenter `view-compiler.ts`**

```ts
// src/viz-engine/view-compiler.ts
//
// Transforme une vue DSL en plan de rendu :
//   - SQL à exécuter pour récupérer les données
//   - métadonnées : nom des champs, agrégats utilisés, etc.
//
// Le composant de rendu (map/bar/table/kpi) consomme ces métadonnées —
// il ne se permet AUCUNE constante hardcodée.

import type { EncodingChannel, ViewSpec } from "./types";

const AGG = new Set(["sum", "avg", "count", "min", "max"]);

function ident(s: string): string {
  // Échapper double-quote dans un identifiant SQL
  return `"${s.replace(/"/g, '""')}"`;
}

function aggExpr(field: string | undefined, agg: string | undefined): string {
  const a = (agg ?? "count").toLowerCase();
  if (a === "count" && !field) return "COUNT(*)";
  if (!AGG.has(a)) throw new Error(`agrégat non supporté : ${agg}`);
  if (!field) throw new Error(`agrégat ${a} requiert un field`);
  return `${a.toUpperCase()}(${ident(field)})`;
}

function getChannel(
  view: ViewSpec,
  key: string,
): EncodingChannel | undefined {
  const e = view.encoding ?? {};
  const v = e[key];
  if (!v || Array.isArray(v) || typeof v === "string") return undefined;
  return v;
}

export type CompiledView =
  | {
      kind: "choropleth";
      id: string;
      title?: string;
      source: string;
      sql: string;
      geoField: string;
      filterBy?: string;
      emitsSelection?: string;
      options?: Record<string, unknown>;
    }
  | {
      kind: "bar";
      id: string;
      title?: string;
      source: string;
      xField: string;
      yField?: string;
      yAggregate: string;
      filterBy?: string;
      options?: Record<string, unknown>;
    }
  | {
      kind: "table";
      id: string;
      title?: string;
      source: string;
      columns: string[];
      filterBy?: string;
      filterField?: string;
      options?: Record<string, unknown>;
    }
  | {
      kind: "kpi";
      id: string;
      title?: string;
      source: string;
      sql: string;
      filterBy?: string;
      options?: Record<string, unknown>;
    };

export function compileView(view: ViewSpec): CompiledView {
  switch (view.type) {
    case "map_choropleth": {
      const geo = getChannel(view, "geo");
      if (!geo?.field) {
        throw new Error(
          `view "${view.id}" : encoding.geo.field requis pour map_choropleth`,
        );
      }
      const color = getChannel(view, "color");
      const agg = aggExpr(color?.field, color?.aggregate ?? (color?.field ? "sum" : "count"));
      const sql =
        `SELECT ${ident(geo.field)} AS key, ${agg} AS v ` +
        `FROM ${ident(view.source)} GROUP BY ${ident(geo.field)}`;
      return {
        kind: "choropleth",
        id: view.id,
        title: view.title,
        source: view.source,
        sql,
        geoField: geo.field,
        filterBy: view.filterBy,
        // Une carte EMET dans sa propre selection si filterBy est posé sur elle ?
        // Convention V0 : pas d'émission auto, on lie via une option dédiée.
        emitsSelection: typeof view.options?.emitsTo === "string"
          ? (view.options.emitsTo as string) : undefined,
        options: view.options,
      };
    }

    case "bar":
    case "barX":
    case "barY": {
      const x = getChannel(view, "x");
      if (!x?.field) {
        throw new Error(`view "${view.id}" : encoding.x.field requis pour ${view.type}`);
      }
      const y = getChannel(view, "y");
      return {
        kind: "bar",
        id: view.id,
        title: view.title,
        source: view.source,
        xField: x.field,
        yField: y?.field,
        yAggregate: (y?.aggregate ?? "count").toLowerCase(),
        filterBy: view.filterBy,
        options: view.options,
      };
    }

    case "table": {
      const e = view.encoding ?? {};
      const cols = e.columns;
      if (!Array.isArray(cols) || cols.length === 0) {
        throw new Error(
          `view "${view.id}" : encoding.columns (array) requis pour table`,
        );
      }
      const filterField =
        typeof view.options?.filterField === "string"
          ? (view.options.filterField as string)
          : undefined;
      return {
        kind: "table",
        id: view.id,
        title: view.title,
        source: view.source,
        columns: cols.filter((c) => typeof c === "string") as string[],
        filterBy: view.filterBy,
        filterField,
        options: view.options,
      };
    }

    case "kpi": {
      const value = getChannel(view, "value");
      if (!value?.field) {
        throw new Error(`view "${view.id}" : encoding.value.field requis pour kpi`);
      }
      const sql =
        `SELECT ${aggExpr(value.field, value.aggregate ?? "sum")} AS v ` +
        `FROM ${ident(view.source)}`;
      return {
        kind: "kpi",
        id: view.id,
        title: view.title,
        source: view.source,
        sql,
        filterBy: view.filterBy,
        options: view.options,
      };
    }

    default:
      throw new Error(`type de vue non supporté en V0 : ${view.type}`);
  }
}
```

Run : `npm test -- view-compiler` → 9 PASS.

- [ ] **Step 4.4 : Commit**

```
git add src/viz-engine/view-compiler.ts src/viz-engine/types.ts \
        src/__tests__/view-compiler.test.ts
git commit -m "feat(viz-engine): view-compiler DSL → SQL spec-driven"
```

---

## Task 5 : Refactor des composants (data-driven via fields du spec)

**Files** :
- Modify : `src/components/map-view.ts` (déjà data-driven via Map — OK, vérifier API)
- Modify : `src/components/bar-chart.ts` (ajout `yField`, `yAggregate`)
- Modify : `src/components/table-view.ts` (déjà data-driven — OK)

- [ ] **Step 5.1 : Étendre `bar-chart.ts`**

Remplacer le contenu actuel par :

```ts
// B-041 — Bar chart vgplot avec filterBy Selection (cross-filter).
// Refacto : prend yField + yAggregate du spec. Le caller passe les
// noms exacts du DSL .vviz — plus aucune constante côté composant.

import * as vg from "@uwdata/vgplot";

import type { RuntimeContext } from "../viz-engine/mosaic-runtime";

export interface BarChartOptions {
  source: string;
  xField: string;
  /** Champ Y (omis pour count(*)) */
  yField?: string;
  /** Agrégat Y : "count" | "sum" | "avg" | "min" | "max" — défaut "count". */
  yAggregate?: string;
  filterSelectionName?: string;
  ctx: RuntimeContext;
  width?: number;
  height?: number;
  fill?: string;
}

function yChannel(opts: BarChartOptions): unknown {
  const agg = (opts.yAggregate ?? "count").toLowerCase();
  if (agg === "count") return vg.count();
  // vgplot expose sum/avg/min/max comme fonctions agrégatives
  if (!opts.yField) {
    throw new Error(`yField requis pour agrégat ${agg}`);
  }
  const f = opts.yField;
  switch (agg) {
    case "sum": return (vg as any).sum(f);
    case "avg": return (vg as any).avg(f);
    case "min": return (vg as any).min(f);
    case "max": return (vg as any).max(f);
    default:
      throw new Error(`agrégat non supporté : ${agg}`);
  }
}

export function renderBarChart(
  container: HTMLElement,
  opts: BarChartOptions,
): HTMLElement {
  const w = opts.width ?? 480;
  const h = opts.height ?? 280;
  const fill = opts.fill ?? "steelblue";
  const sel = opts.filterSelectionName
    ? opts.ctx.selections.get(opts.filterSelectionName)
    : undefined;

  const source = sel
    ? vg.from(opts.source, { filterBy: sel })
    : vg.from(opts.source);

  const plot = vg.plot(
    vg.barY(source, {
      x: opts.xField,
      y: yChannel(opts),
      fill,
    }),
    vg.width(w),
    vg.height(h),
  ) as unknown as HTMLElement;

  container.appendChild(plot);
  return plot;
}
```

- [ ] **Step 5.2 : Test bar-chart étendu**

Ajouter dans `src/__tests__/bar-chart.test.ts` (créer si absent) :

```ts
import { describe, it, expect } from "vitest";
import { renderBarChart } from "../components/bar-chart";
import { createRuntime } from "../viz-engine/mosaic-runtime";

describe("renderBarChart", () => {
  it("ne plante pas avec yAggregate=count par défaut", () => {
    const c = document.createElement("div");
    const ctx = createRuntime();
    expect(() => renderBarChart(c, {
      source: "t", xField: "x", ctx,
    })).not.toThrow();
  });

  it("throw si sum sans yField", () => {
    const c = document.createElement("div");
    const ctx = createRuntime();
    expect(() => renderBarChart(c, {
      source: "t", xField: "x", yAggregate: "sum", ctx,
    })).toThrow(/yField/i);
  });
});
```

- [ ] **Step 5.3 : Commit**

```
git add src/components/bar-chart.ts src/__tests__/bar-chart.test.ts
git commit -m "refactor(bar-chart): consomme yField + yAggregate du spec"
```

---

## Task 6 : View mounter (orchestration SQL + composant)

**Files** :
- Create : `src/viz-engine/view-mounter.ts`
- Create : `src/__tests__/view-mounter.test.ts`

- [ ] **Step 6.1 : Implémenter `view-mounter.ts`**

```ts
// src/viz-engine/view-mounter.ts
//
// Pour chaque vue compilée, exécute son SQL via le connector DuckDB
// puis pousse le résultat dans le composant adéquat. AUCUNE constante
// — tout vient du compileView.

import { tableFromIPC, type Table } from "apache-arrow";
import { invoke } from "@tauri-apps/api/core";

import type { CompiledView } from "./view-compiler";
import type { DuckConnector } from "./duck-connector";
import type { RuntimeContext } from "./mosaic-runtime";
import { ensureSelection } from "./mosaic-runtime";
import { renderChoropleth } from "../components/map-view";
import { renderBarChart } from "../components/bar-chart";
import { renderTable } from "../components/table-view";

/** Exécute un SELECT et renvoie une Map<string, number> sur (key, v). */
async function fetchKeyValueMap(
  conn: DuckConnector,
  sql: string,
): Promise<Map<string, number>> {
  const t = (await conn.query({ type: "arrow", sql })) as Table;
  const out = new Map<string, number>();
  for (let i = 0; i < t.numRows; i++) {
    const row = t.get(i);
    if (!row) continue;
    const k = String((row as any).key);
    const v = Number((row as any).v);
    if (Number.isFinite(v)) out.set(k, v);
  }
  return out;
}

async function fetchSingleNumber(
  conn: DuckConnector,
  sql: string,
): Promise<number | null> {
  const t = (await conn.query({ type: "arrow", sql })) as Table;
  if (t.numRows === 0) return null;
  const row = t.get(0);
  const v = (row as any)?.v;
  return Number.isFinite(Number(v)) ? Number(v) : null;
}

function ident(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}
function sqlLit(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

async function fetchTableRows(
  source: string,
  columns: string[],
  filterField: string | undefined,
  filterValue: string | null,
  limit: number,
): Promise<Table> {
  const cols = columns.map(ident).join(", ");
  const where = filterField && filterValue !== null
    ? ` WHERE ${ident(filterField)} = ${sqlLit(filterValue)}`
    : "";
  const sql = `SELECT ${cols} FROM ${ident(source)}${where} LIMIT ${limit}`;
  const buf = await invoke<ArrayBuffer>("run_query", { sql });
  return tableFromIPC(new Uint8Array(buf));
}

export async function mountCompiledView(
  view: CompiledView,
  container: HTMLElement,
  ctx: RuntimeContext,
  conn: DuckConnector,
): Promise<void> {
  switch (view.kind) {
    case "choropleth": {
      const map = await fetchKeyValueMap(conn, view.sql);
      const svg = renderChoropleth(container, map, {
        width: (view.options?.width as number) ?? 480,
        height: (view.options?.height as number) ?? 480,
      });
      if (view.emitsSelection) {
        ensureSelection(ctx, view.emitsSelection);
        const { bindMapSelection } = await import("../components/map-view");
        bindMapSelection(svg, ctx, {
          field: view.geoField,
          selectionName: view.emitsSelection,
        });
      }
      return;
    }
    case "bar": {
      if (view.filterBy) ensureSelection(ctx, view.filterBy);
      renderBarChart(container, {
        source: view.source,
        xField: view.xField,
        yField: view.yField,
        yAggregate: view.yAggregate,
        filterSelectionName: view.filterBy,
        ctx,
        width: view.options?.width as number | undefined,
        height: view.options?.height as number | undefined,
      });
      return;
    }
    case "table": {
      const limit = (view.options?.limit as number) ?? 5000;
      const initial = await fetchTableRows(
        view.source,
        view.columns,
        undefined,
        null,
        limit,
      );
      const api = renderTable(container, initial, {
        columns: view.columns.map((field) => ({ field })),
        visibleRows: (view.options?.visibleRows as number) ?? 15,
      });
      if (view.filterBy && view.filterField) {
        const filterField = view.filterField;
        const { onSelectionValue } = await import("./drill-query");
        onSelectionValue(ctx, view.filterBy, async (val) => {
          const t = await fetchTableRows(
            view.source,
            view.columns,
            filterField,
            val,
            limit,
          );
          api.setData(t);
        });
      }
      return;
    }
    case "kpi": {
      const n = await fetchSingleNumber(conn, view.sql);
      container.innerHTML = `
        <div class="vv-kpi">
          ${view.title ? `<div class="vv-kpi-label">${escapeHtml(view.title)}</div>` : ""}
          <div class="vv-kpi-value">${
            n === null ? "—" : Number(n).toLocaleString("fr-FR")
          }</div>
        </div>
      `;
      return;
    }
  }
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
```

- [ ] **Step 6.2 : Test view-mounter (smoke)**

```ts
// src/__tests__/view-mounter.test.ts
import { describe, it, expect, vi } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => new ArrayBuffer(0)),
}));

import { mountCompiledView } from "../viz-engine/view-mounter";
import { createRuntime } from "../viz-engine/mosaic-runtime";

const fakeConn = {
  query: vi.fn(async () => ({
    numRows: 0,
    get: () => null,
  })),
};

describe("mountCompiledView", () => {
  it("KPI render '—' si pas de données", async () => {
    const c = document.createElement("div");
    await mountCompiledView(
      { kind: "kpi", id: "k", source: "s", sql: "SELECT 1 AS v FROM s", title: "Total" },
      c, createRuntime(), fakeConn as any,
    );
    expect(c.querySelector(".vv-kpi-value")?.textContent).toBe("—");
    expect(c.textContent).toContain("Total");
  });
});
```

- [ ] **Step 6.3 : CSS KPI**

Ajouter dans `src/styles/main.css` :

```css
.vv-kpi {
  background: rgba(0, 110, 230, 0.08);
  border: 1px solid rgba(0, 110, 230, 0.25);
  border-radius: 6px;
  padding: 1rem 1.25rem;
  display: inline-block;
}
.vv-kpi-label { font-size: 0.85rem; opacity: 0.7; margin-bottom: 0.25rem; }
.vv-kpi-value { font-size: 1.75rem; font-weight: 600; }
```

- [ ] **Step 6.4 : Commit**

```
git add src/viz-engine/view-mounter.ts src/__tests__/view-mounter.test.ts \
        src/styles/main.css
git commit -m "feat(viz-engine): view-mounter spec-driven (no hardcoded fields)"
```

---

## Task 7 : Refacto `main.ts` — bootstrap + openVViz + dispatch

**Files** :
- Replace : `src/main.ts` (réduit à ~160 lignes)

- [ ] **Step 7.1 : Réécrire `main.ts`**

```ts
// VaultViz V0 — bootstrap front (refacto interpreter réel).
//
// Flux :
//   1. resolveStartupPath() (argv / VVIZ_DEFAULT / bundle resource)
//   2. Si Some(path) : openVViz(path), sinon afficher welcome
//   3. La toolbar a un bouton "Ouvrir" qui ouvre un dialog Tauri puis
//      rappelle openVViz.
//
// openVViz(path) :
//   - read_vviz + parse + Ajv (spec-loader)
//   - loadSources : CREATE VIEW par source du .vviz
//   - pour chaque view : compileView + mountCompiledView

import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";

import { loadVViz } from "./viz-engine/spec-loader";
import { loadSources } from "./viz-engine/source-loader";
import { compileView } from "./viz-engine/view-compiler";
import { mountCompiledView } from "./viz-engine/view-mounter";
import { vvizDir } from "./viz-engine/path-resolver";
import { createDuckConnector } from "./viz-engine/duck-connector";
import { createRuntime, ensureSelection } from "./viz-engine/mosaic-runtime";
import { initMosaicRuntime } from "./viz-engine";

import { renderToolbar } from "./components/toolbar";
import { renderWelcome } from "./components/welcome";
import { renderErrorBanner } from "./components/error-banner";

const HELP_HREF =
  "https://github.com/92VC/VaultViz/tree/main/docs/user";

let toolbarHost: HTMLElement | null = null;
let contentHost: HTMLElement | null = null;
let currentPath: string | null = null;

function refreshToolbar(): void {
  if (!toolbarHost) return;
  renderToolbar(toolbarHost, {
    onOpen: () => pickAndOpen().catch(console.error),
    currentPath,
  });
}

async function pickAndOpen(): Promise<void> {
  const picked = await openDialog({
    title: "Ouvrir un fichier .vviz",
    filters: [{ name: "VaultViz spec", extensions: ["vviz"] }],
    multiple: false,
  });
  if (typeof picked === "string") {
    await openVViz(picked);
  }
}

async function openVViz(path: string): Promise<void> {
  currentPath = path;
  refreshToolbar();
  if (!contentHost) return;

  // 1. Read + parse + validate
  const { doc, error } = await loadVViz(path);
  if (error || !doc) {
    renderErrorBanner(contentHost, error ?? {
      kind: "Io", path, message: "doc indisponible",
    }, {
      onRetry: () => openVViz(path),
      helpHref: HELP_HREF,
    });
    return;
  }

  // 2. Init runtime Mosaic (idempotent)
  try { initMosaicRuntime(); } catch (err) {
    console.warn("[VaultViz] init Mosaic indisponible :", err);
  }
  const ctx = createRuntime();
  for (const s of doc.spec.selections ?? []) {
    ensureSelection(ctx, s.id);
  }

  // 3. Charger les sources DuckDB
  const conn = createDuckConnector();
  try {
    await loadSources(conn, doc, vvizDir(path));
  } catch (err) {
    renderErrorBanner(contentHost, {
      kind: "Io", path,
      message: `Chargement des sources : ${(err as Error).message}`,
    }, { onRetry: () => openVViz(path), helpHref: HELP_HREF });
    return;
  }

  // 4. Mount les vues
  contentHost.innerHTML = "";
  const title = document.createElement("h1");
  title.className = "vv-doc-title";
  title.textContent = doc.vviz.title;
  contentHost.appendChild(title);
  if (doc.vviz.description) {
    const sub = document.createElement("p");
    sub.className = "vv-doc-sub";
    sub.textContent = doc.vviz.description;
    contentHost.appendChild(sub);
  }

  const layout = document.createElement("div");
  layout.className = `vv-layout vv-layout-${doc.spec.layout ?? "vstack"}`;
  contentHost.appendChild(layout);

  for (const v of doc.spec.views) {
    const frame = document.createElement("section");
    frame.className = `vv-view-frame vv-view-${v.type}`;
    frame.dataset.viewId = v.id;
    if (v.title) {
      const h = document.createElement("h2");
      h.className = "vv-view-title";
      h.textContent = v.title;
      frame.appendChild(h);
    }
    const mount = document.createElement("div");
    mount.className = "vv-view-mount";
    frame.appendChild(mount);
    layout.appendChild(frame);
    try {
      const compiled = compileView(v);
      await mountCompiledView(compiled, mount, ctx, conn);
    } catch (err) {
      const msg = (err as Error).message ?? String(err);
      const note = document.createElement("p");
      note.className = "vv-note vv-note-error";
      note.textContent = `Vue "${v.id}" (${v.type}) : ${msg}`;
      mount.appendChild(note);
    }
  }
}

async function resolveStartupPath(): Promise<string | null> {
  try {
    const r = await invoke<string | null>("startup_path");
    return r ?? null;
  } catch {
    return null;
  }
}

async function bootstrap(): Promise<void> {
  const root = document.getElementById("app");
  if (!root) return;
  root.innerHTML = `
    <div class="vv-toolbar-host"></div>
    <div class="vv-content-host"></div>
  `;
  toolbarHost = root.querySelector(".vv-toolbar-host");
  contentHost = root.querySelector(".vv-content-host");
  refreshToolbar();

  const startupPath = await resolveStartupPath();
  if (startupPath) {
    await openVViz(startupPath);
  } else if (contentHost) {
    renderWelcome(contentHost, {
      onOpen: () => pickAndOpen().catch(console.error),
    });
  }
}

bootstrap();
```

- [ ] **Step 7.2 : Vérifier build**

```bash
npm run build
```

Expected : OK, ~160 lignes au lieu de 616. Le bundle gz devrait baisser (≈10-20% — on retire vgplot static demo).

- [ ] **Step 7.3 : Lancer tous les tests**

```bash
npm test
```

Expected : ≥ 70 OK (62 existants - quelques tests sur fonctions retirées du main + nouveaux).

Notes : certains tests ciblaient probablement le démo hardcodé via `cross_filter_demo.vviz`. À l'étape 7.3, **identifier les tests qui ne s'appliquent plus** et :
- si le test couvre une fonctionnalité qui n'existe plus dans le nouveau flux : le supprimer en commit séparé `chore(test): retirer test démo hardcodée`
- si le test est utile (ex. spec-validator) : le garder

- [ ] **Step 7.4 : Commit**

```
git add src/main.ts
git commit -m "refactor(main): bootstrap spec-driven + welcome + dialog picker"
```

---

## Task 8 : Exemples cohérents + binaire de génération

**Files** :
- Modify : `examples/effectifs_2026.vviz` (rendre cohérent avec `sample.parquet`)
- Create : `examples/demo_dept.vviz`
- Create : `src-tauri/examples/gen_demo_dept.rs`
- Modify : `.gitignore` (autoriser `examples/demo_dept.parquet`)

- [ ] **Step 8.1 : Réécrire `examples/effectifs_2026.vviz` cohérent**

Le `sample.parquet` actuel a `id INT64, label VARCHAR, value DOUBLE` (cf. `gen_fixtures.rs`). Le `.vviz` doit s'y conformer :

```json
{
  "$schema": "https://vaultviz.fr/schema/v1.json",
  "vviz": {
    "version": "1.0",
    "title": "Exemple minimaliste (sample.parquet)",
    "description": "Démo synthétique sur 50 000 lignes id/label/value.",
    "author": "VaultViz",
    "created": "2026-05-28",
    "updated": "2026-05-28"
  },
  "data": {
    "sources": [
      { "name": "items", "path": "./sample.parquet" }
    ]
  },
  "spec": {
    "engine": "mosaic",
    "layout": "vstack",
    "views": [
      {
        "id": "kpi_total",
        "type": "kpi",
        "title": "Nombre de lignes",
        "source": "items",
        "encoding": {
          "value": { "field": "value", "aggregate": "count" }
        }
      },
      {
        "id": "bar_par_label",
        "type": "barY",
        "title": "Répartition par label (10 premiers)",
        "source": "items",
        "encoding": {
          "x": { "field": "label" },
          "y": { "aggregate": "count" }
        },
        "options": { "width": 720, "height": 320, "limit": 10 }
      },
      {
        "id": "table_items",
        "type": "table",
        "title": "Détail",
        "source": "items",
        "encoding": {
          "columns": ["id", "label", "value"]
        },
        "options": { "limit": 5000, "visibleRows": 18 }
      }
    ]
  }
}
```

Note : `sample.parquet` n'a pas de `code_dept`, donc pas de carto dans cet exemple. La carto est démontrée par `demo_dept.vviz` (étape 8.2).

- [ ] **Step 8.2 : Créer `examples/demo_dept.vviz`**

Avec un schema riche : `code_dept` (varchar 2 chars), `effectif` (int), `categorie` (varchar).

```json
{
  "$schema": "https://vaultviz.fr/schema/v1.json",
  "vviz": {
    "version": "1.0",
    "title": "Démo départements (généré au build)",
    "description": "Effectifs synthétiques par département + catégorie.",
    "author": "VaultViz",
    "created": "2026-05-28",
    "updated": "2026-05-28"
  },
  "data": {
    "sources": [
      { "name": "effectifs", "path": "./demo_dept.parquet" }
    ]
  },
  "spec": {
    "engine": "mosaic",
    "layout": "vstack",
    "selections": [
      { "id": "dept_sel", "kind": "single" }
    ],
    "views": [
      {
        "id": "carte_fr",
        "type": "map_choropleth",
        "title": "Effectifs par département",
        "source": "effectifs",
        "encoding": {
          "geo": { "field": "code_dept" },
          "color": { "field": "effectif", "aggregate": "sum" }
        },
        "options": { "width": 560, "height": 560, "emitsTo": "dept_sel" }
      },
      {
        "id": "kpi_total",
        "type": "kpi",
        "title": "Effectif total (filtré)",
        "source": "effectifs",
        "encoding": {
          "value": { "field": "effectif", "aggregate": "sum" }
        },
        "filterBy": "dept_sel"
      },
      {
        "id": "bar_categorie",
        "type": "barY",
        "title": "Par catégorie (filtré)",
        "source": "effectifs",
        "encoding": {
          "x": { "field": "categorie" },
          "y": { "field": "effectif", "aggregate": "sum" }
        },
        "filterBy": "dept_sel",
        "options": { "width": 480, "height": 280 }
      },
      {
        "id": "table_detail",
        "type": "table",
        "title": "Détail (filtré)",
        "source": "effectifs",
        "encoding": {
          "columns": ["code_dept", "categorie", "effectif"]
        },
        "filterBy": "dept_sel",
        "options": {
          "limit": 5000,
          "visibleRows": 15,
          "filterField": "code_dept"
        }
      }
    ]
  }
}
```

- [ ] **Step 8.3 : Binaire de génération `gen_demo_dept.rs`**

```rust
// src-tauri/examples/gen_demo_dept.rs
//
// Génère `examples/demo_dept.parquet` (96 departements x ~30 catégories
// x lignes synthétiques). Tourné au build local + GHA si présent.
//
// Usage : cargo run --release --example gen_demo_dept

use std::env;
use std::path::PathBuf;
use duckdb::Connection;

fn main() -> Result<(), Box<dyn std::error::Error>> {
    let manifest = env::var("CARGO_MANIFEST_DIR")?;
    let out = PathBuf::from(&manifest)
        .parent()
        .unwrap()
        .join("examples")
        .join("demo_dept.parquet");
    let conn = Connection::open_in_memory()?;
    let sql = format!(r#"
        COPY (
          WITH cats AS (
            SELECT 'A' AS categorie UNION ALL SELECT 'B' UNION ALL SELECT 'C'
            UNION ALL SELECT 'D' UNION ALL SELECT 'E' UNION ALL SELECT 'F'
            UNION ALL SELECT 'G' UNION ALL SELECT 'H'
          ),
          deps AS (
            SELECT LPAD(CAST(n AS VARCHAR), 2, '0') AS code_dept
            FROM range(1, 97) AS t(n)
          )
          SELECT d.code_dept,
                 c.categorie,
                 CAST(50 + (random() * 950) AS INTEGER) AS effectif
          FROM deps d CROSS JOIN cats c
        )
        TO '{}' (FORMAT PARQUET, COMPRESSION SNAPPY)
    "#, out.to_string_lossy().replace('\'', "''"));
    conn.execute_batch(&sql)?;
    println!("OK : {}", out.display());
    Ok(())
}
```

- [ ] **Step 8.4 : Lancer le générateur localement**

```bash
cd src-tauri
cargo run --release --example gen_demo_dept
ls -la ../examples/demo_dept.parquet
```

Expected : fichier ~20-40 ko.

- [ ] **Step 8.5 : Versionner le parquet de démo**

```
echo '!examples/demo_dept.parquet' >> .gitignore
```

(En vérifiant que la règle `!examples/sample.parquet` est déjà là — si oui, on ajoute juste celle-ci.)

- [ ] **Step 8.6 : Embarquer `demo_dept.{vviz,parquet}` dans le bundle MSI**

Modifier `src-tauri/tauri.conf.json` :

```json
"resources": [
  "../examples/effectifs_2026.vviz",
  "../examples/sample.parquet",
  "../examples/demo_dept.vviz",
  "../examples/demo_dept.parquet"
],
```

- [ ] **Step 8.7 : Choisir l'exemple par défaut au startup**

Modifier `src-tauri/src/commands/startup.rs` pour pointer vers `demo_dept.vviz` plutôt que `effectifs_2026.vviz` (la démo carte est plus parlante) :

```rust
let example = resource_dir.join("examples").join("demo_dept.vviz");
```

- [ ] **Step 8.8 : Commit**

```
git add examples/effectifs_2026.vviz examples/demo_dept.vviz \
        src-tauri/examples/gen_demo_dept.rs \
        src-tauri/tauri.conf.json src-tauri/src/commands/startup.rs \
        .gitignore examples/demo_dept.parquet
git commit -m "feat(examples): demo_dept cohérent (vviz + parquet généré)"
```

---

## Task 9 : Doc utilisateur minimale (stub)

**Files** :
- Create : `docs/user/format-vviz.md` (stub, full V1-8)

- [ ] **Step 9.1 : Rédiger stub**

```markdown
# Format `.vviz` — référence minimale V0

Un fichier `.vviz` est un document JSON décrivant une visualisation
ouvrable dans VaultViz. La spec complète V1 sera publiée en V1-8.

## Structure

```json
{
  "$schema": "https://vaultviz.fr/schema/v1.json",
  "vviz": { "version": "1.0", "title": "…", "description": "…", "author": "…" },
  "data": {
    "sources": [
      { "name": "ma_source", "path": "./donnees.parquet" }
    ]
  },
  "spec": {
    "engine": "mosaic",
    "layout": "vstack",
    "selections": [ { "id": "s1", "kind": "single" } ],
    "views": [
      {
        "id": "v1",
        "type": "map_choropleth | bar | barY | barX | table | kpi",
        "source": "ma_source",
        "encoding": { ... },
        "filterBy": "s1",
        "options": { ... }
      }
    ]
  }
}
```

## Chemins (`data.sources[].path`)

- UNC : `//host/share/dossier/fichier.parquet`
- Lecteur mappé : `Z:/dossier/fichier.parquet`
- Absolu POSIX (dev/test) : `/tmp/fichier.parquet`
- Relatif au `.vviz` : `./fichier.parquet` ou `../data/fichier.parquet`

## Encoding par type de vue

### `map_choropleth`

```json
"encoding": {
  "geo":   { "field": "<code_dept en 2 chars>" },
  "color": { "field": "<champ numérique>", "aggregate": "sum|avg|count|min|max" }
},
"options": { "width": 560, "height": 560, "emitsTo": "<selection_id>" }
```

### `bar` / `barY` / `barX`

```json
"encoding": {
  "x": { "field": "<champ catégoriel>" },
  "y": { "field": "<champ numérique>", "aggregate": "sum|avg|count|min|max" }
}
```

### `table`

```json
"encoding": { "columns": ["col1", "col2", "..."] },
"options": { "limit": 5000, "visibleRows": 15, "filterField": "<champ>" }
```

### `kpi`

```json
"encoding": { "value": { "field": "<champ>", "aggregate": "sum|count|..." } }
```

## Cross-filter

1. Déclarer une selection : `spec.selections[]`.
2. Une vue émet : `options.emitsTo: "<selection_id>"` (carte choro).
3. D'autres vues filtrent : `view.filterBy: "<selection_id>"`.

Un clic sur la vue émettrice met à jour la selection ; les vues `filterBy`
re-query DuckDB automatiquement (push-down SQL).
```

- [ ] **Step 9.2 : Commit**

```
git add docs/user/format-vviz.md
git commit -m "docs(user): stub référence format .vviz (full V1-8)"
```

---

## Task 10 : PR + tag rc3

- [ ] **Step 10.1 : Vérification finale**

```bash
npm test           # doit être vert intégralement
cd src-tauri && cargo test  # 22 OK inchangé
cd .. && npm run build  # OK
```

- [ ] **Step 10.2 : Mettre à jour BACKLOG**

Notes : pas besoin de nouvelle story B-* — c'est une dette de B-041/B-050 (mal livrés par les subagents). On ajoute une note dans le BACKLOG §0.3 :

> Note 2026-05-28 : B-041/B-050 livrés en démo hardcodée par subagents
> Wave 4-5 ; refacto spec-driven en `docs/superpowers/plans/2026-05-28-v0-real-interpreter.md`.

- [ ] **Step 10.3 : Push + PR**

```bash
git push -u origin fix/file-picker-ui
gh pr create --title "fix(V0): interpréteur .vviz réel (file picker + spec-driven render)" \
  --body "Réparation V0 — l'app interprète VRAIMENT le .vviz ouvert (dialog, drag, double-clic), lit les paths du spec, exécute les agrégats déclarés, rend selon les fields du DSL. Plus aucune constante 'code_dept' / 'sample.parquet' / 'cross_filter_demo.vviz' hardcodée. ~13 tests vitest ajoutés. Plan : docs/superpowers/plans/2026-05-28-v0-real-interpreter.md."
```

- [ ] **Step 10.4 : Merge + tag rc3**

```bash
gh pr merge <num> --squash --delete-branch
git checkout main && git pull --rebase
git tag -a v0.0.1-rc3 -m "VaultViz V0 rc3 — interpréteur .vviz réel"
git push origin v0.0.1-rc3
```

- [ ] **Step 10.5 : Surveiller le build GHA + tester le MSI**

Quand la release est en ligne, tester sur Windows :
1. Lancer l'app sans argument → écran welcome, bouton « Ouvrir »
2. Ouvrir `examples/demo_dept.vviz` (depuis `Program Files\VaultViz\resources\examples\`) → carte choro + KPI + bar + table
3. Cliquer un département sur la carte → KPI/bar/table re-query avec le filtre
4. Double-cliquer un `.vviz` quelconque dans Explorer → l'app l'ouvre

---

## §A. Self-review du plan

**Couverture du gap V0** :
- [x] File picker UI (Task 1)
- [x] Path resolution (Task 2)
- [x] Source loading depuis `data.sources` (Task 3)
- [x] Spec-driven SQL (Task 4)
- [x] Composants data-driven (Task 5)
- [x] Mounter générique (Task 6)
- [x] Bootstrap refactoré (Task 7)
- [x] Exemples cohérents (Task 8)
- [x] Doc utilisateur stub (Task 9)
- [x] Release rc3 (Task 10)

**Pas de placeholder** : chaque step a du code complet ou une commande exacte.

**Type consistency** : `CompiledView` (Task 4) consommé par `mountCompiledView` (Task 6) avec les mêmes shapes. `RuntimeContext` partagé entre composants. `DuckConnector` import depuis duck-connector.ts dans tous les nouveaux fichiers.

**Tests par couche** : 13+ nouveaux tests couvrent les chemins critiques (path resolution, SQL generation, mount idempotent, KPI fallback).

---

## §B. Risques identifiés

| Risque | Mitigation |
|---|---|
| `vg.from(source)` ne déclenche pas le connector si la table SQL n'existe pas encore | `loadSources` exécuté AVANT `mountCompiledView` ; ordre garanti dans `openVViz` |
| `tableFromIPC` reçoit un buffer Arrow IPC issu de `query_arrow` ; en réalité notre connector renvoie un Table déjà décodée | Tests `mountCompiledView` simulent via mock connector ; intégration testée en runtime Tauri |
| Plugin dialog versions Tauri 2 désync | `tauri-plugin-dialog` 2.x compatible Tauri 2.11 ; lockfile garantit |
| Le path relatif `./sample.parquet` du `demo_dept.vviz` embarqué doit se résoudre relativement à `resource_dir/examples/` | Garanti par `vvizDir(startupPath)` côté front |
| Bundle MSI gonflé par `demo_dept.parquet` versionné | Taille ~20-40 ko, négligeable vs DuckDB 34 Mo |

---

## §C. Hors scope explicite (rappel)

- ❌ MapLibre + PMTiles (V1-1)
- ❌ TopoJSON IGN officiel (V1-2)
- ❌ Watcher FS (V1-3)
- ❌ Export PDF (V1-4)
- ❌ Thème DSFR (V1-5)
- ❌ Signature MSI (V1-6 / hors scope produit)
- ❌ RGAA AA (V1-7)
- ❌ Doc auteur complète (V1-8 — seul un stub ici)
- ❌ Pilote MECM (V1-9)

Ce plan répare V0. Pas V1.
