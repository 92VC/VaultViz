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
    expect(c.columns).toEqual(["a", "b", "c"]);
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
