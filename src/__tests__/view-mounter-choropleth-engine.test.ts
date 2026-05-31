// B-111 — Test du routage engine="maplibre" dans mountCompiledView case choropleth.
//
// Vérifie que :
//   1. engine="maplibre" dans options → renderChoroplethGL appelé, pas SVG
//   2. engine absent (défaut) → renderChoropleth SVG appelé, pas GL
//
// Stratégie : mock les deux composants + maplibre-gl.
// Le conn factice retourne une ligne (key: "75", v: 100).

import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mocks hoistés ─────────────────────────────────────────────────────────────
const { mockRenderChoropleth, mockRenderChoroplethGL } = vi.hoisted(() => {
  const mockRenderChoropleth = vi.fn(() => document.createElementNS("http://www.w3.org/2000/svg", "svg"));
  const mockRenderChoroplethGL = vi.fn();
  return { mockRenderChoropleth, mockRenderChoroplethGL };
});

vi.mock("../components/map-view", () => ({
  renderChoropleth: mockRenderChoropleth,
  renderMetricSwitcher: vi.fn(),
}));

vi.mock("../components/map-choropleth-gl", () => ({
  renderChoroplethGL: mockRenderChoroplethGL,
}));

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => new ArrayBuffer(0)),
}));

// MapLibre GL mock minimal (non utilisé directement ici, mais importé par view-mounter)
vi.mock("maplibre-gl", () => ({
  Map: vi.fn(function (this: Record<string, unknown>) {
    this.addControl = vi.fn();
    this.on = vi.fn();
  }),
  NavigationControl: vi.fn(function (this: Record<string, unknown>) {}),
  Popup: vi.fn(function (this: Record<string, unknown>) {
    this.setLngLat = vi.fn(() => this);
    this.setHTML = vi.fn(() => this);
    this.addTo = vi.fn(() => this);
    this.remove = vi.fn();
  }),
}));

// Imports APRÈS les mocks
import { mountCompiledView } from "../viz-engine/view-mounter";
import { createRuntime } from "../viz-engine/mosaic-runtime";
import type { DuckConnector } from "../viz-engine/duck-connector";

// ─────────────────────────────────────────────────────────────────────────────

function fakeConn(): DuckConnector {
  return {
    query: vi.fn(async () => ({
      numRows: 1,
      get: (i: number) =>
        i === 0 ? { key: "75", v: 100 } : null,
    })),
  } as unknown as DuckConnector;
}

// ─────────────────────────────────────────────────────────────────────────────

describe("mountCompiledView — choropleth engine routing (B-111)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sans engine (défaut) : délègue à renderChoropleth SVG", async () => {
    const container = document.createElement("div");
    const conn = fakeConn();

    await mountCompiledView(
      {
        kind: "choropleth",
        id: "m",
        source: "s",
        sql: 'SELECT "dept_code" AS key, SUM("n") AS v FROM "s" GROUP BY "dept_code"',
        geoField: "dept_code",
        // pas d'options.engine → défaut SVG
      },
      container,
      createRuntime(),
      conn,
    );

    expect(mockRenderChoropleth).toHaveBeenCalledOnce();
    expect(mockRenderChoroplethGL).not.toHaveBeenCalled();
    // conn.query a bien été appelé (SQL push-down vers DuckDB)
    expect(conn.query).toHaveBeenCalledOnce();
  });

  it("engine='maplibre' : délègue à renderChoroplethGL, pas au SVG", async () => {
    const container = document.createElement("div");
    const conn = fakeConn();

    await mountCompiledView(
      {
        kind: "choropleth",
        id: "m",
        source: "s",
        sql: 'SELECT "dept_code" AS key, SUM("n") AS v FROM "s" GROUP BY "dept_code"',
        geoField: "dept_code",
        options: { engine: "maplibre" },
      },
      container,
      createRuntime(),
      conn,
    );

    expect(mockRenderChoroplethGL).toHaveBeenCalledOnce();
    expect(mockRenderChoropleth).not.toHaveBeenCalled();
    // dataByDept passé à GL = Map issue du fetchKeyValueMap (dept 75 → 100)
    const [, dataByDept] = mockRenderChoroplethGL.mock.calls[0] as [
      unknown,
      Map<string, number>,
    ];
    expect(dataByDept.get("75")).toBe(100);
    // conn.query a bien été appelé (SQL push-down DuckDB préservé)
    expect(conn.query).toHaveBeenCalledOnce();
  });

  it("engine='maplibre' + emitsSelection : onSelect câblé dans opts GL", async () => {
    const container = document.createElement("div");
    const conn = fakeConn();
    const ctx = createRuntime();

    await mountCompiledView(
      {
        kind: "choropleth",
        id: "m",
        source: "s",
        sql: 'SELECT "code" AS key, SUM("n") AS v FROM "s" GROUP BY "code"',
        geoField: "code",
        emitsSelection: "dept_sel",
        options: { engine: "maplibre" },
      },
      container,
      ctx,
      conn,
    );

    expect(mockRenderChoroplethGL).toHaveBeenCalledOnce();
    const [, , glOpts] = mockRenderChoroplethGL.mock.calls[0] as [
      unknown,
      unknown,
      { onSelect?: unknown },
    ];
    // onSelect doit être une fonction (le createPointEmitter wrapper)
    expect(typeof glOpts?.onSelect).toBe("function");
  });

  it("interchangeabilité : les deux engines reçoivent le même Map<code,valeur>", async () => {
    const svgContainer = document.createElement("div");
    const glContainer = document.createElement("div");
    const connSvg = fakeConn();
    const connGl = fakeConn();

    const baseCv = {
      kind: "choropleth" as const,
      id: "m",
      source: "s",
      sql: 'SELECT "key" AS key, SUM("v") AS v FROM "s" GROUP BY "key"',
      geoField: "key",
    };

    await mountCompiledView(baseCv, svgContainer, createRuntime(), connSvg);
    await mountCompiledView(
      { ...baseCv, options: { engine: "maplibre" } },
      glContainer,
      createRuntime(),
      connGl,
    );

    // SVG : 1er argument = container, 2e = Map
    const svgMap = (mockRenderChoropleth.mock.calls[0] as unknown[])[1] as Map<string, number>;
    // GL : 2e argument = Map
    const glMap = (mockRenderChoroplethGL.mock.calls[0] as unknown[])[1] as Map<string, number>;

    expect(svgMap.get("75")).toBe(glMap.get("75"));
    expect(svgMap.size).toBe(glMap.size);
  });
});
