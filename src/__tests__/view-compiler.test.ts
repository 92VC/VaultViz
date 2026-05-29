import { describe, it, expect } from "vitest";

import { compileView } from "../viz-engine/view-compiler";
import type { ViewSpec } from "../viz-engine/types";

describe("compileView — map_choropleth", () => {
  it("génère SQL SUM par geo.field quand color.field précisé", () => {
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
    if (c.kind !== "choropleth") return;
    expect(c.sql).toBe(
      `SELECT "dept_code" AS key, SUM("n") AS v FROM "effectifs" GROUP BY "dept_code"`,
    );
    expect(c.geoField).toBe("dept_code");
  });

  it("défaut COUNT(*) si pas de color.field", () => {
    const v: ViewSpec = {
      id: "m1",
      type: "map_choropleth",
      source: "effectifs",
      encoding: { geo: { field: "dc" } },
    };
    const c = compileView(v);
    if (c.kind !== "choropleth") throw new Error("kind");
    expect(c.sql).toContain("COUNT(*) AS v");
  });

  it("expose emitsSelection depuis options.emitsTo", () => {
    const v: ViewSpec = {
      id: "m1",
      type: "map_choropleth",
      source: "effectifs",
      encoding: { geo: { field: "dc" } },
      options: { emitsTo: "dept_sel" },
    };
    const c = compileView(v);
    if (c.kind !== "choropleth") throw new Error("kind");
    expect(c.emitsSelection).toBe("dept_sel");
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

  it("échappe les double-quotes dans les identifiants", () => {
    const v: ViewSpec = {
      id: "m1",
      type: "map_choropleth",
      source: 'evil"name',
      encoding: { geo: { field: 'col"x' }, color: { field: "n", aggregate: "sum" } },
    };
    const c = compileView(v);
    if (c.kind !== "choropleth") throw new Error("kind");
    expect(c.sql).toContain('"evil""name"');
    expect(c.sql).toContain('"col""x"');
  });
});

describe("compileView — bar", () => {
  it("respecte yField + yAggregate quand précisés", () => {
    const v: ViewSpec = {
      id: "b1",
      type: "bar",
      source: "effectifs",
      encoding: { x: { field: "cat" }, y: { field: "val", aggregate: "sum" } },
    };
    const c = compileView(v);
    if (c.kind !== "bar") throw new Error("kind");
    expect(c.xField).toBe("cat");
    expect(c.yField).toBe("val");
    expect(c.yAggregate).toBe("sum");
  });

  it("défaut yAggregate=count si non précisé", () => {
    const v: ViewSpec = {
      id: "b1",
      type: "barY",
      source: "effectifs",
      encoding: { x: { field: "cat" } },
    };
    const c = compileView(v);
    if (c.kind !== "bar") throw new Error("kind");
    expect(c.yAggregate).toBe("count");
    expect(c.yField).toBeUndefined();
  });

  it("rejette une bar sans x.field", () => {
    const v: ViewSpec = {
      id: "b1",
      type: "bar",
      source: "effectifs",
      encoding: { y: { field: "v" } },
    };
    expect(() => compileView(v)).toThrow(/x\.field/);
  });
});

describe("compileView — table", () => {
  it("conserve encoding.columns", () => {
    const v: ViewSpec = {
      id: "t1",
      type: "table",
      source: "effectifs",
      encoding: { columns: ["a", "b", "c"] },
    };
    const c = compileView(v);
    if (c.kind !== "table") throw new Error("kind");
    expect(c.columns).toEqual([{ field: "a" }, { field: "b" }, { field: "c" }]);
  });

  it("expose filterField depuis options", () => {
    const v: ViewSpec = {
      id: "t1",
      type: "table",
      source: "effectifs",
      encoding: { columns: ["a"] },
      options: { filterField: "code_dept" },
      filterBy: "dept_sel",
    };
    const c = compileView(v);
    if (c.kind !== "table") throw new Error("kind");
    expect(c.filterField).toBe("code_dept");
    expect(c.filterBy).toBe("dept_sel");
  });

  it("rejette une table sans columns ou avec array vide", () => {
    const v1: ViewSpec = {
      id: "t1",
      type: "table",
      source: "s",
      encoding: {},
    };
    expect(() => compileView(v1)).toThrow(/columns/i);

    const v2: ViewSpec = {
      id: "t1",
      type: "table",
      source: "s",
      encoding: { columns: [] },
    };
    expect(() => compileView(v2)).toThrow(/columns/i);
  });
});

describe("compileView — kpi", () => {
  it("génère SELECT agg sur la source", () => {
    const v: ViewSpec = {
      id: "k1",
      type: "kpi",
      source: "effectifs",
      encoding: { value: { field: "n", aggregate: "sum" } },
    };
    const c = compileView(v);
    if (c.kind !== "kpi") throw new Error("kind");
    expect(c.sql).toBe(`SELECT SUM("n") AS v FROM "effectifs"`);
  });

  it("autorise un kpi count sans field", () => {
    const v: ViewSpec = {
      id: "k1",
      type: "kpi",
      source: "effectifs",
      encoding: { value: { aggregate: "count" } },
    };
    const c = compileView(v);
    if (c.kind !== "kpi") throw new Error("kind");
    expect(c.sql).toBe(`SELECT COUNT(*) AS v FROM "effectifs"`);
  });

  it("rejette un kpi avec sum sans field", () => {
    const v: ViewSpec = {
      id: "k1",
      type: "kpi",
      source: "effectifs",
      encoding: { value: { aggregate: "sum" } },
    };
    expect(() => compileView(v)).toThrow();
  });
});

describe("compileView — erreurs globales", () => {
  it("rejette un type de vue inconnu", () => {
    const v = {
      id: "x",
      type: "unknown_type",
      source: "s",
    } as unknown as ViewSpec;
    expect(() => compileView(v)).toThrow(/non supporté/);
  });
});

// ---------------------------------------------------------------------------
// SP3 — extensions rétro-compatibles
// ---------------------------------------------------------------------------

describe("compileView — SP3 kpi avec delta", () => {
  it("kpi sans delta : SQL et kind inchangés (rétro-compat)", () => {
    const v: ViewSpec = {
      id: "k1",
      type: "kpi",
      source: "effectifs",
      encoding: { value: { field: "n", aggregate: "sum" } },
    };
    const c = compileView(v);
    if (c.kind !== "kpi") throw new Error("kind");
    expect(c.sql).toBe(`SELECT SUM("n") AS v FROM "effectifs"`);
    expect(c.hasDelta).toBeUndefined();
  });

  it("kpi avec encoding.delta : hasDelta + SQL avec AS delta", () => {
    const v: ViewSpec = {
      id: "k2",
      type: "kpi",
      source: "effectifs",
      encoding: {
        value: { field: "n", aggregate: "sum" },
        delta: { field: "ndelta", aggregate: "sum" },
      },
      options: { format: "+0.0%", foot: "vs N-1", icon: "trend", deltaUnit: "pts" },
    };
    const c = compileView(v);
    if (c.kind !== "kpi") throw new Error("kind");
    expect(c.hasDelta).toBe(true);
    expect(c.sql).toBe(
      `SELECT SUM("n") AS v, SUM("ndelta") AS delta FROM "effectifs"`,
    );
    expect(c.format).toBe("+0.0%");
    expect(c.foot).toBe("vs N-1");
    expect(c.icon).toBe("trend");
    expect(c.deltaUnit).toBe("pts");
  });
});

describe("compileView — SP3 choropleth metrics", () => {
  it("sans metrics : inchangé (pas de champ metrics)", () => {
    const v: ViewSpec = {
      id: "m1",
      type: "map_choropleth",
      source: "effectifs",
      encoding: { geo: { field: "dc" }, color: { field: "n", aggregate: "sum" } },
    };
    const c = compileView(v);
    if (c.kind !== "choropleth") throw new Error("kind");
    expect(c.metrics).toBeUndefined();
    expect(c.defaultMetricKey).toBeUndefined();
    expect(c.sql).toBe(
      `SELECT "dc" AS key, SUM("n") AS v FROM "effectifs" GROUP BY "dc"`,
    );
  });

  it("avec options.metrics : array metrics + defaultMetricKey, sql = métrique 0", () => {
    const v: ViewSpec = {
      id: "m2",
      type: "map_choropleth",
      source: "effectifs",
      encoding: { geo: { field: "dc" } },
      options: {
        metrics: [
          { key: "tot", label: "Total", field: "n", aggregate: "sum", format: "0,0" },
          { key: "moy", label: "Moyenne", field: "n", aggregate: "avg" },
        ],
      },
    };
    const c = compileView(v);
    if (c.kind !== "choropleth") throw new Error("kind");
    expect(c.metrics).toHaveLength(2);
    expect(c.defaultMetricKey).toBe("tot");
    expect(c.metrics?.[0].sql).toBe(
      `SELECT "dc" AS key, SUM("n") AS v FROM "effectifs" GROUP BY "dc"`,
    );
    expect(c.metrics?.[1].sql).toBe(
      `SELECT "dc" AS key, AVG("n") AS v FROM "effectifs" GROUP BY "dc"`,
    );
    expect(c.sql).toBe(c.metrics?.[0].sql);
    expect(c.metrics?.[0].format).toBe("0,0");
  });
});

describe("compileView — SP3 bar routage", () => {
  it("bar nu (sans options) : kind 'bar' inchangé (rétro-compat)", () => {
    const v: ViewSpec = {
      id: "b1",
      type: "bar",
      source: "effectifs",
      encoding: { x: { field: "cat" }, y: { field: "val", aggregate: "sum" } },
    };
    const c = compileView(v);
    expect(c.kind).toBe("bar");
  });

  it("options.compareField : grouped_bars + SQL deux mesures", () => {
    const v: ViewSpec = {
      id: "b2",
      type: "bar",
      source: "effectifs",
      encoding: { x: { field: "cat" }, y: { field: "val", aggregate: "sum" } },
      options: { compareField: "val_prev" },
    };
    const c = compileView(v);
    if (c.kind !== "grouped_bars") throw new Error("kind");
    expect(c.kField).toBe("cat");
    expect(c.sql).toBe(
      `SELECT "cat" AS k, SUM("val") AS v1, SUM("val_prev") AS v2 ` +
        `FROM "effectifs" GROUP BY "cat"`,
    );
    expect(c.seriesLabels).toEqual(["val", "val_prev"]);
  });

  it("grouped_bars : seriesLabels d'options respectés", () => {
    const v: ViewSpec = {
      id: "b2b",
      type: "bar",
      source: "effectifs",
      encoding: { x: { field: "cat" }, y: { field: "val", aggregate: "sum" } },
      options: { compareField: "val_prev", seriesLabels: ["2024", "2023"] },
    };
    const c = compileView(v);
    if (c.kind !== "grouped_bars") throw new Error("kind");
    expect(c.seriesLabels).toEqual(["2024", "2023"]);
  });

  it("options.valueLabels : ranked_bars + ORDER BY DESC par défaut", () => {
    const v: ViewSpec = {
      id: "b3",
      type: "bar",
      source: "effectifs",
      encoding: { x: { field: "cat" }, y: { field: "val", aggregate: "sum" } },
      options: { valueLabels: true },
    };
    const c = compileView(v);
    if (c.kind !== "ranked_bars") throw new Error("kind");
    expect(c.sql).toBe(
      `SELECT "cat" AS k, SUM("val") AS v ` +
        `FROM "effectifs" GROUP BY "cat" ORDER BY v DESC`,
    );
    expect(c.sort).toBe("DESC");
    expect(c.valueLabels).toBe(true);
  });

  it("options.sort=asc : ranked_bars ORDER BY ASC", () => {
    const v: ViewSpec = {
      id: "b4",
      type: "bar",
      source: "effectifs",
      encoding: { x: { field: "cat" }, y: { field: "val", aggregate: "sum" } },
      options: { sort: "asc" },
    };
    const c = compileView(v);
    if (c.kind !== "ranked_bars") throw new Error("kind");
    expect(c.sql).toContain("ORDER BY v ASC");
  });

  it("ranked_bars : sort invalide → DESC (pas d'injection)", () => {
    const v: ViewSpec = {
      id: "b5",
      type: "bar",
      source: "effectifs",
      encoding: { x: { field: "cat" }, y: { field: "val", aggregate: "sum" } },
      options: { sort: "; DROP TABLE x" },
    };
    const c = compileView(v);
    if (c.kind !== "ranked_bars") throw new Error("kind");
    expect(c.sort).toBe("DESC");
    expect(c.sql).toContain("ORDER BY v DESC");
    expect(c.sql).not.toContain("DROP");
  });
});

describe("compileView — SP3 plot (line/area/dot)", () => {
  it("line : kind plot plotType line", () => {
    const v: ViewSpec = {
      id: "l1",
      type: "line",
      source: "ts",
      encoding: { x: { field: "mois" }, y: { field: "n", aggregate: "sum" } },
    };
    const c = compileView(v);
    if (c.kind !== "plot") throw new Error("kind");
    expect(c.plotType).toBe("line");
    expect(c.xField).toBe("mois");
    expect(c.yField).toBe("n");
    expect(c.yAggregate).toBe("sum");
  });

  it("area avec series : seriesField rempli", () => {
    const v: ViewSpec = {
      id: "a1",
      type: "area",
      source: "ts",
      encoding: {
        x: { field: "mois" },
        y: { field: "n" },
        series: { field: "categorie" },
      },
    };
    const c = compileView(v);
    if (c.kind !== "plot") throw new Error("kind");
    expect(c.plotType).toBe("area");
    expect(c.seriesField).toBe("categorie");
  });

  it("dot : kind plot plotType dot", () => {
    const v: ViewSpec = {
      id: "d1",
      type: "dot",
      source: "ts",
      encoding: { x: { field: "x" }, y: { field: "y" } },
    };
    const c = compileView(v);
    if (c.kind !== "plot") throw new Error("kind");
    expect(c.plotType).toBe("dot");
  });

  it("plot rejette l'absence de x.field", () => {
    const v: ViewSpec = {
      id: "l2",
      type: "line",
      source: "ts",
      encoding: { y: { field: "n" } },
    };
    expect(() => compileView(v)).toThrow(/x\.field/);
  });
});

describe("compileView — SP3 table colonnes riches", () => {
  it("string[] → ColumnDef[] simples (rétro-compat)", () => {
    const v: ViewSpec = {
      id: "t1",
      type: "table",
      source: "s",
      encoding: { columns: ["a", "b"] },
    };
    const c = compileView(v);
    if (c.kind !== "table") throw new Error("kind");
    expect(c.columns).toEqual([{ field: "a" }, { field: "b" }]);
  });

  it("colonnes objets riches : label/align/format/badge normalisés", () => {
    const v = {
      id: "t2",
      type: "table",
      source: "s",
      encoding: {
        columns: [
          { field: "nom", label: "Nom", align: "text" },
          { field: "n", align: "num", format: "0,0" },
          { field: "etat", type: "badge", badgeMap: { ok: "green", ko: "red" } },
        ],
      },
      options: { search: true },
    } as unknown as ViewSpec;
    const c = compileView(v);
    if (c.kind !== "table") throw new Error("kind");
    expect(c.columns[0]).toEqual({
      field: "nom",
      label: "Nom",
      align: "text",
      format: undefined,
      type: undefined,
      badgeMap: undefined,
    });
    expect(c.columns[2].type).toBe("badge");
    expect(c.columns[2].badgeMap).toEqual({ ok: "green", ko: "red" });
    expect(c.search).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SP4 — namespacing par schéma DuckDB (docId)
// ---------------------------------------------------------------------------

describe("compileView — SP4 docId qualification", () => {
  it("kpi avec docId : FROM doc_d1.\"source\"", () => {
    const v: ViewSpec = {
      id: "k1",
      type: "kpi",
      source: "effectifs",
      encoding: { value: { field: "n", aggregate: "sum" } },
    };
    const c = compileView(v, "d1");
    if (c.kind !== "kpi") throw new Error("kind");
    expect(c.sql).toBe(`SELECT SUM("n") AS v FROM doc_d1."effectifs"`);
  });

  it("kpi sans docId : SQL strictement inchangé (rétro-compat)", () => {
    const v: ViewSpec = {
      id: "k1",
      type: "kpi",
      source: "effectifs",
      encoding: { value: { field: "n", aggregate: "sum" } },
    };
    const c = compileView(v);
    if (c.kind !== "kpi") throw new Error("kind");
    expect(c.sql).toBe(`SELECT SUM("n") AS v FROM "effectifs"`);
  });

  it("choropleth avec docId : FROM doc_d1.\"source\" (default + metrics)", () => {
    const v: ViewSpec = {
      id: "m1",
      type: "map_choropleth",
      source: "effectifs",
      encoding: { geo: { field: "dc" } },
      options: {
        metrics: [
          { key: "tot", label: "Total", field: "n", aggregate: "sum" },
        ],
      },
    };
    const c = compileView(v, "d1");
    if (c.kind !== "choropleth") throw new Error("kind");
    expect(c.sql).toBe(
      `SELECT "dc" AS key, SUM("n") AS v FROM doc_d1."effectifs" GROUP BY "dc"`,
    );
    expect(c.metrics?.[0].sql).toContain(`FROM doc_d1."effectifs"`);
  });

  it("ranked_bars avec docId : FROM doc_d1.\"source\"", () => {
    const v: ViewSpec = {
      id: "b1",
      type: "bar",
      source: "effectifs",
      encoding: { x: { field: "cat" }, y: { field: "val", aggregate: "sum" } },
      options: { valueLabels: true },
    };
    const c = compileView(v, "d1");
    if (c.kind !== "ranked_bars") throw new Error("kind");
    expect(c.sql).toBe(
      `SELECT "cat" AS k, SUM("val") AS v ` +
        `FROM doc_d1."effectifs" GROUP BY "cat" ORDER BY v DESC`,
    );
  });

  it("grouped_bars avec docId : FROM doc_d1.\"source\"", () => {
    const v: ViewSpec = {
      id: "b2",
      type: "bar",
      source: "effectifs",
      encoding: { x: { field: "cat" }, y: { field: "val", aggregate: "sum" } },
      options: { compareField: "val_prev" },
    };
    const c = compileView(v, "d1");
    if (c.kind !== "grouped_bars") throw new Error("kind");
    expect(c.sql).toBe(
      `SELECT "cat" AS k, SUM("val") AS v1, SUM("val_prev") AS v2 ` +
        `FROM doc_d1."effectifs" GROUP BY "cat"`,
    );
  });

  it("bar nu avec docId : source field qualifié pour vgplot", () => {
    const v: ViewSpec = {
      id: "b3",
      type: "bar",
      source: "effectifs",
      encoding: { x: { field: "cat" }, y: { field: "val", aggregate: "sum" } },
    };
    const c = compileView(v, "d1");
    if (c.kind !== "bar") throw new Error("kind");
    expect(c.source).toBe(`doc_d1."effectifs"`);
  });

  it("bar nu sans docId : source field brut (rétro-compat)", () => {
    const v: ViewSpec = {
      id: "b3",
      type: "bar",
      source: "effectifs",
      encoding: { x: { field: "cat" }, y: { field: "val", aggregate: "sum" } },
    };
    const c = compileView(v);
    if (c.kind !== "bar") throw new Error("kind");
    expect(c.source).toBe("effectifs");
  });

  it("plot avec docId : source field qualifié", () => {
    const v: ViewSpec = {
      id: "l1",
      type: "line",
      source: "ts",
      encoding: { x: { field: "mois" }, y: { field: "n", aggregate: "sum" } },
    };
    const c = compileView(v, "d1");
    if (c.kind !== "plot") throw new Error("kind");
    expect(c.source).toBe(`doc_d1."ts"`);
  });

  it("docId échappe les guillemets dans la source", () => {
    const v: ViewSpec = {
      id: "k1",
      type: "kpi",
      source: 'evil"name',
      encoding: { value: { field: "n", aggregate: "sum" } },
    };
    const c = compileView(v, "d1");
    if (c.kind !== "kpi") throw new Error("kind");
    expect(c.sql).toBe(`SELECT SUM("n") AS v FROM doc_d1."evil""name"`);
  });

  it("docId invalide : throw", () => {
    const v: ViewSpec = {
      id: "k1",
      type: "kpi",
      source: "effectifs",
      encoding: { value: { field: "n", aggregate: "sum" } },
    };
    expect(() => compileView(v, "bad-id")).toThrow(/docId/i);
    expect(() => compileView(v, "x".repeat(33))).toThrow(/docId/i);
  });
});
