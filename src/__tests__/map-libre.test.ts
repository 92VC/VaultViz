// B-100 — Tests wrapper MapLibre GL JS.
//
// WebGL n'existe pas en happy-dom → on mock maplibre-gl entièrement.
// On teste uniquement le câblage :
//   - constructeur Map appelé avec center/zoom attendus
//   - style minimal vide (version 8, sources {}, layers [])
//   - addControl appelé avec une instance NavigationControl
//
// Règle vi.mock : la factory est hoistée avant les imports ; on utilise
// vi.hoisted() pour que les spies soient définis avant le hoist.

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Spies définis via vi.hoisted() pour survivre au hoist de vi.mock ────────
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

// Import APRÈS le mock
import { createBaseMap } from "../components/map-libre";

// ─────────────────────────────────────────────────────────────────────────────

describe("createBaseMap (B-100)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("crée un Map avec center et zoom par défaut (France)", () => {
    const container = document.createElement("div");
    createBaseMap(container);

    expect(MockMap).toHaveBeenCalledOnce();
    const opts = MockMap.mock.calls[0][0] as {
      container: HTMLElement;
      center: [number, number];
      zoom: number;
    };
    expect(opts.container).toBe(container);
    expect(opts.center).toEqual([2.5, 46.5]);
    expect(opts.zoom).toBe(5);
  });

  it("crée un Map avec center et zoom personnalisés", () => {
    const container = document.createElement("div");
    createBaseMap(container, { center: [1.0, 48.0], zoom: 7 });

    const opts = MockMap.mock.calls[0][0] as {
      center: [number, number];
      zoom: number;
    };
    expect(opts.center).toEqual([1.0, 48.0]);
    expect(opts.zoom).toBe(7);
  });

  it("passe un style minimal vide version 8 (zéro réseau)", () => {
    const container = document.createElement("div");
    createBaseMap(container);

    const opts = MockMap.mock.calls[0][0] as {
      style: { version: number; sources: object; layers: unknown[] };
    };
    expect(opts.style).toMatchObject({
      version: 8,
      sources: {},
      layers: [],
    });
    // S'assurer qu'il n'y a pas d'URL réseau dans le style
    const styleStr = JSON.stringify(opts.style);
    expect(styleStr).not.toMatch(/https?:\/\//);
  });

  it("ajoute un NavigationControl via addControl", () => {
    const container = document.createElement("div");
    createBaseMap(container);

    expect(mockAddControl).toHaveBeenCalledOnce();
    const controlArg = mockAddControl.mock.calls[0][0];
    expect(controlArg).toBeInstanceOf(MockNavigationControl);
  });

  it("retourne l'instance Map créée", () => {
    const container = document.createElement("div");
    const result = createBaseMap(container);

    // MockMap est un constructeur : result doit être instanceof MockMap
    expect(result).toBeInstanceOf(MockMap);
  });
});
