// B-100 — Tests de mountMap (sélection du moteur de rendu cartographique).
//
// mountMap() doit aiguiller vers createBaseMap (maplibre) ou renderChoropleth (svg).
// WebGL absent en happy-dom → mock maplibre-gl via vi.hoisted + vi.mock.

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Spies définis via vi.hoisted() ────────────────────────────────────────────
const { mockAddControl, MockMap, MockNavigationControl } = vi.hoisted(() => {
  const mockAddControl = vi.fn();
  const MockMap = vi.fn(function (
    this: Record<string, unknown>,
    _opts: unknown,
  ) {
    this.addControl = mockAddControl;
  });
  const MockNavigationControl = vi.fn(function (
    this: Record<string, unknown>,
  ) {});
  return { mockAddControl, MockMap, MockNavigationControl };
});

vi.mock("maplibre-gl", () => ({
  Map: MockMap,
  NavigationControl: MockNavigationControl,
}));

// Imports après mock
import { mountMap } from "../components/map-view";

// ─────────────────────────────────────────────────────────────────────────────

describe("mountMap — engine switcher (B-100)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("mode svg (défaut) : retourne un SVGSVGElement, pas de Map MapLibre", () => {
    const container = document.createElement("div");
    const result = mountMap(container);

    // Retourne un SVG
    expect(result).toBeInstanceOf(SVGSVGElement);
    // Aucune instance MapLibre créée
    expect(MockMap).not.toHaveBeenCalled();
  });

  it("mode svg avec données : délègue à renderChoropleth (svg avec paths)", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const dataByDept = new Map<string, number>([
      ["75", 100],
      ["92", 200],
    ]);
    const result = mountMap(container, {
      engine: "svg",
      choropleth: { dataByDept },
    });

    expect(result).toBeInstanceOf(SVGSVGElement);
    // renderChoropleth produit des paths
    const paths = container.querySelectorAll("svg path");
    expect(paths.length).toBeGreaterThanOrEqual(1);
    expect(MockMap).not.toHaveBeenCalled();
  });

  it("mode maplibre : crée une Map MapLibre et retourne son instance", () => {
    const container = document.createElement("div");
    const result = mountMap(container, { engine: "maplibre" });

    expect(result).toBeInstanceOf(MockMap);
    expect(MockMap).toHaveBeenCalledOnce();
    expect(mockAddControl).toHaveBeenCalledOnce();
  });

  it("mode maplibre : transmet center et zoom personnalisés", () => {
    const container = document.createElement("div");
    mountMap(container, {
      engine: "maplibre",
      center: [3.0, 47.0],
      zoom: 8,
    });

    const opts = MockMap.mock.calls[0][0] as {
      center: [number, number];
      zoom: number;
    };
    expect(opts.center).toEqual([3.0, 47.0]);
    expect(opts.zoom).toBe(8);
  });
});
