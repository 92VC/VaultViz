// SP3 / T3.final — Tests du câblage spec-driven complet :
//   - placement des vues par zone (kpi / main / side / full) ;
//   - routage de chaque kind vers son composant (DOM attendu) ;
//   - injection de la clause WHERE du cross-filter bespoke.
//
// Le connector est un STUB qui renvoie des rows fixes selon le SQL ; la
// commande Tauri `invoke` (utilisée par le chemin `table` →
// fetchTableRows) est mockée pour renvoyer une Table Arrow factice.

import { describe, it, expect, vi } from "vitest";
import { tableFromArrays, tableToIPC } from "apache-arrow";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => {
    const t = tableFromArrays({
      nom: ["Paris", "Lyon", "Marseille"],
      ca: new Float64Array([100, 80, 60]),
    });
    return tableToIPC(t, "stream").buffer;
  }),
}));

import { mountDashboard } from "../shell/dashboard";
import { injectWhere } from "../viz-engine/view-mounter";
import { createRuntime } from "../viz-engine/mosaic-runtime";
import type { CompiledView } from "../viz-engine/view-compiler";
import type { DuckConnector } from "../viz-engine/duck-connector";

/**
 * Connector stub : pour un SQL donné, retourne une Table-like Arrow
 * (numRows + get) en fonction des colonnes attendues (key/v, k/v,
 * k/v1/v2, v[/delta]).
 */
function stubConn(): DuckConnector {
  return {
    query: vi.fn(async (q: { sql: string }) => {
      const sql = q.sql;
      let rows: Record<string, unknown>[];
      if (/AS key/.test(sql)) {
        rows = [
          { key: "75", v: 100 },
          { key: "69", v: 80 },
        ];
      } else if (/AS v1/.test(sql)) {
        rows = [
          { k: "T1", v1: 100, v2: 80 },
          { k: "T2", v1: 120, v2: 200 },
        ];
      } else if (/AS k\b/.test(sql) || /AS k,/.test(sql)) {
        rows = [
          { k: "Soins", v: 500 },
          { k: "Prévention", v: 300 },
        ];
      } else {
        // KPI : v (+ delta éventuel).
        rows = [{ v: 12345, delta: 3.2 }];
      }
      return {
        numRows: rows.length,
        get: (i: number) => rows[i] ?? null,
      };
    }),
  } as unknown as DuckConnector;
}

const KPI: CompiledView = {
  kind: "kpi",
  id: "kpi_ca",
  source: "cg",
  title: "CA",
  sql: 'SELECT SUM("ca") AS v FROM "cg"',
  format: "eur",
  options: { region: "kpi" },
};

const MAP: CompiledView = {
  kind: "choropleth",
  id: "map_ca",
  source: "cg",
  title: "Carte",
  sql: 'SELECT "code" AS key, SUM("ca") AS v FROM "cg" GROUP BY "code"',
  geoField: "code",
  emitsSelection: "dept",
  options: { region: "main", emitsTo: "dept" },
};

const RANKED: CompiledView = {
  kind: "ranked_bars",
  id: "bars_cat",
  source: "cat",
  title: "Catégories",
  sql: 'SELECT "categorie" AS k, SUM("montant") AS v FROM "cat" GROUP BY "categorie" ORDER BY v DESC',
  kField: "categorie",
  sort: "DESC",
  valueFormat: "eur",
  valueLabels: true,
  options: { region: "side" },
};

const GROUPED: CompiledView = {
  kind: "grouped_bars",
  id: "bars_q",
  source: "q",
  title: "Budget vs réalisé",
  sql: 'SELECT "trimestre" AS k, SUM("realise") AS v1, SUM("budget") AS v2 FROM "q" GROUP BY "trimestre"',
  kField: "trimestre",
  seriesLabels: ["Réalisé", "Budget"],
  format: "eur",
  options: { region: "side" },
};

const TABLE: CompiledView = {
  kind: "table",
  id: "table_dep",
  source: "cg",
  title: "Détail",
  columns: [
    { field: "nom", label: "Département", align: "text" },
    { field: "ca", label: "CA", align: "num", format: "eur" },
  ],
  search: true,
  options: { region: "full" },
};

describe("mountDashboard — placement par zones", () => {
  it("place chaque vue dans la bonne zone", async () => {
    const c = document.createElement("div");
    await mountDashboard(
      c,
      [KPI, MAP, RANKED, GROUPED, TABLE],
      createRuntime(),
      stubConn(),
    );

    const grid = c.querySelector(".dash-grid");
    expect(grid).not.toBeNull();

    // kpi → .kpis
    const kpis = c.querySelector(".kpis");
    expect(kpis?.querySelector('[data-view-id="kpi_ca"]')).not.toBeNull();

    // main → .grid-2 > .col-main
    const main = c.querySelector(".grid-2 .col-main");
    expect(main?.querySelector('[data-view-id="map_ca"]')).not.toBeNull();

    // side → .grid-2 > .col-side (deux vues)
    const side = c.querySelector(".grid-2 .col-side");
    expect(side?.querySelector('[data-view-id="bars_cat"]')).not.toBeNull();
    expect(side?.querySelector('[data-view-id="bars_q"]')).not.toBeNull();

    // full → .table-card pleine largeur (enfant direct de .dash-grid)
    const full = grid?.querySelector(":scope > .table-card");
    expect(full).not.toBeNull();
    expect((full as HTMLElement).dataset.viewId).toBe("table_dep");
  });

  it("produit le bon composant DOM par kind", async () => {
    const c = document.createElement("div");
    await mountDashboard(
      c,
      [KPI, MAP, RANKED, GROUPED, TABLE],
      createRuntime(),
      stubConn(),
    );

    // kpi → .kpi / .k-val
    expect(c.querySelector(".kpi .k-val")).not.toBeNull();
    // choropleth → svg + switcher .seg-ctrl (métriques absentes ici → pas de seg)
    expect(c.querySelector("svg.vv-choropleth-svg")).not.toBeNull();
    // ranked_bars → .bars
    expect(c.querySelector(".bars")).not.toBeNull();
    // grouped_bars → .qbars
    expect(c.querySelector(".qbars")).not.toBeNull();
    // table → .vv-table + barre de recherche (search:true)
    expect(c.querySelector(".vv-table")).not.toBeNull();
    expect(c.querySelector(".tbl-search")).not.toBeNull();
  });

  it("monte le chip de filtre lié à la carte émettrice", async () => {
    const c = document.createElement("div");
    await mountDashboard(c, [MAP, KPI], createRuntime(), stubConn());
    expect(c.querySelector(".filter-chip")).not.toBeNull();
  });

  it("monte le chip de filtre pour un émetteur ranked_bars (dashboard sans carte)", async () => {
    const c = document.createElement("div");
    const RANKED_EMITTER: CompiledView = {
      ...RANKED,
      emitsSelection: "bat",
      filterField: "libelle",
      options: { region: "main", emitsTo: "bat", filterField: "libelle" },
    } as CompiledView;
    await mountDashboard(c, [RANKED_EMITTER, KPI], createRuntime(), stubConn());
    expect(c.querySelector(".filter-chip")).not.toBeNull();
  });

  it("rend une carte choroplèthe avec switcher quand metrics présent", async () => {
    const c = document.createElement("div");
    const MAP_METRICS: CompiledView = {
      ...MAP,
      metrics: [
        { key: "ca", label: "CA", field: "ca", aggregate: "sum", sql: MAP.sql },
        {
          key: "marge",
          label: "Marge",
          field: "marge",
          aggregate: "avg",
          sql: 'SELECT "code" AS key, AVG("marge") AS v FROM "cg" GROUP BY "code"',
        },
      ],
      defaultMetricKey: "ca",
    } as CompiledView;
    await mountDashboard(c, [MAP_METRICS], createRuntime(), stubConn());
    expect(c.querySelector(".seg-ctrl")).not.toBeNull();
    expect(c.querySelectorAll(".seg-ctrl button")).toHaveLength(2);
  });
});

describe("mountDashboard — fallback flux vertical", () => {
  it("retombe sur .vv-layout-vstack sans region", async () => {
    const c = document.createElement("div");
    const noRegion: CompiledView = { ...KPI, options: {} };
    await mountDashboard(c, [noRegion], createRuntime(), stubConn());
    expect(c.querySelector(".vv-layout-vstack")).not.toBeNull();
    expect(c.querySelector(".vv-view-frame")).not.toBeNull();
    expect(c.querySelector(".dash-grid")).toBeNull();
  });
});

describe("injectWhere — clause de cross-filter bespoke", () => {
  it("insère WHERE juste après FROM (kpi, pas de GROUP BY)", () => {
    expect(injectWhere('SELECT SUM("ca") AS v FROM "cg"', "cg", "code", "75")).toBe(
      'SELECT SUM("ca") AS v FROM "cg" WHERE "code" = \'75\'',
    );
  });

  it("insère WHERE avant GROUP BY / ORDER BY (ranked)", () => {
    const sql =
      'SELECT "categorie" AS k, SUM("montant") AS v FROM "cat" GROUP BY "categorie" ORDER BY v DESC';
    expect(injectWhere(sql, "cat", "code", "69")).toBe(
      'SELECT "categorie" AS k, SUM("montant") AS v FROM "cat" WHERE "code" = \'69\' GROUP BY "categorie" ORDER BY v DESC',
    );
  });

  it("échappe la valeur (single-quote doublée)", () => {
    expect(injectWhere('SELECT * FROM "t"', "t", "f", "O'Brien")).toBe(
      'SELECT * FROM "t" WHERE "f" = \'O\'\'Brien\'',
    );
  });

  it("renvoie le SQL inchangé si le token FROM est introuvable", () => {
    expect(injectWhere('SELECT 1', "t", "f", "x")).toBe("SELECT 1");
  });

  // SP4 : sous docId, la source est un nom de vue PLAT préfixé
  // (`doc_d1__cg`). injectWhere doit reconnaître `FROM "doc_d1__cg"` sans
  // aucune adaptation (c'est un identifiant unique quoté) → cross-filter
  // fonctionnel sous docId.
  it("injecte WHERE sur un nom de vue préfixé (SP4 docId)", () => {
    const sql = 'SELECT SUM("ca") AS v FROM "doc_d1__cg"';
    expect(injectWhere(sql, "doc_d1__cg", "code", "75")).toBe(
      'SELECT SUM("ca") AS v FROM "doc_d1__cg" WHERE "code" = \'75\'',
    );
  });

  it("injecte WHERE avant GROUP BY sur un nom préfixé (ranked SP4)", () => {
    const sql =
      'SELECT "cat" AS k, SUM("v") AS v FROM "doc_d1__cat" GROUP BY "cat" ORDER BY v DESC';
    expect(injectWhere(sql, "doc_d1__cat", "code", "69")).toBe(
      'SELECT "cat" AS k, SUM("v") AS v FROM "doc_d1__cat" WHERE "code" = \'69\' GROUP BY "cat" ORDER BY v DESC',
    );
  });
});
