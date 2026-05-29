import { describe, it, expect, vi } from "vitest";
import { tableFromArrays, tableToIPC } from "apache-arrow";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => {
    // Une table à 2 colonnes (id, label) pour fetchTableRows.
    const t = tableFromArrays({
      id: new Int32Array([1, 2, 3]),
    });
    return tableToIPC(t, "stream").buffer;
  }),
}));

import { mountCompiledView } from "../viz-engine/view-mounter";
import { createRuntime } from "../viz-engine/mosaic-runtime";
import type { DuckConnector } from "../viz-engine/duck-connector";

function fakeConn(rows: Array<{ key?: string; v: number }>): DuckConnector {
  // Construit une table arrow factice par appel.
  return {
    query: vi.fn(async () => ({
      numRows: rows.length,
      get: (i: number) => rows[i] ?? null,
    })),
  } as unknown as DuckConnector;
}

describe("mountCompiledView — kpi", () => {
  it("rend une carte KPI (0 par défaut si pas de données)", async () => {
    const c = document.createElement("div");
    await mountCompiledView(
      {
        kind: "kpi",
        id: "k",
        source: "s",
        sql: "SELECT SUM(\"x\") AS v FROM \"s\"",
        title: "Total",
      },
      c,
      createRuntime(),
      fakeConn([]),
    );
    // SP3 : rendu via renderKpiCard → .card.kpi / .k-val / .k-label.
    expect(c.querySelector(".kpi")).not.toBeNull();
    expect(c.textContent).toContain("Total");
  });

  it("render la valeur formatée fr-FR si une ligne renvoyée", async () => {
    const c = document.createElement("div");
    await mountCompiledView(
      {
        kind: "kpi",
        id: "k",
        source: "s",
        sql: "SELECT SUM(\"x\") AS v FROM \"s\"",
        title: "Total",
      },
      c,
      createRuntime(),
      fakeConn([{ v: 12345 }]),
    );
    // Locale fr-FR : 12 345 (espace insécable U+202F ou U+00A0)
    const txt = c.querySelector(".k-val")?.textContent ?? "";
    expect(txt.replace(/\s/g, "")).toBe("12345");
  });
});

describe("mountCompiledView — choropleth", () => {
  it("appelle conn.query avec le SQL du compiled", async () => {
    const c = document.createElement("div");
    const conn = fakeConn([{ key: "75", v: 100 }]);
    await mountCompiledView(
      {
        kind: "choropleth",
        id: "m",
        source: "s",
        sql: "SELECT \"dept_code\" AS key, SUM(\"n\") AS v FROM \"s\" GROUP BY \"dept_code\"",
        geoField: "dept_code",
      },
      c,
      createRuntime(),
      conn,
    );
    expect(conn.query).toHaveBeenCalledTimes(1);
    expect(c.querySelector("svg")).not.toBeNull();
  });
});

describe("mountCompiledView — bar", () => {
  it("rend sans throw avec yField + sum", async () => {
    const c = document.createElement("div");
    const conn = fakeConn([]);
    await mountCompiledView(
      {
        kind: "bar",
        id: "b",
        source: "effectifs",
        xField: "cat",
        yField: "value",
        yAggregate: "sum",
      },
      c,
      createRuntime(),
      conn,
    );
    expect(c.children.length).toBeGreaterThanOrEqual(1);
  });
});
