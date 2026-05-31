// B-111 — Tests choroplèthe MapLibre data-driven + drill clic→sélection.
//
// WebGL absent en happy-dom → mock maplibre-gl via vi.hoisted + vi.mock.
// Le mock :
//   - capture les appels addSource / addLayer
//   - simule l'événement "load" en invoquant immédiatement les callbacks
//   - capture les callbacks "click" et "mousemove"/"mouseleave" par layerId
//     pour simuler des interactions dans les tests
//
// Invariant I-2 : on vérifie que le module n'utilise aucune URL http(s).

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Spies définis via vi.hoisted() pour survivre au hoist de vi.mock ──────────
const {
  mockAddSource,
  mockAddLayer,
  mockSetFeatureState,
  mockOn,
  MockMap,
  MockNavigationControl,
  MockPopup,
} = vi.hoisted(() => {
  const mockAddSource = vi.fn();
  const mockAddLayer = vi.fn();
  const mockSetFeatureState = vi.fn();
  const mockAddControl = vi.fn();

  // Map des callbacks par événement (event ou [event, layerId])
  const handlers: Record<string, Array<(...args: unknown[]) => void>> = {};

  const mockOn = vi.fn(
    (event: string, layerOrCb: unknown, maybeCb?: unknown) => {
      // Signature : on("load", cb) ou on("click", layerId, cb) ou on("mousemove", layerId, cb)
      const key =
        typeof layerOrCb === "function"
          ? event
          : `${event}:${String(layerOrCb)}`;
      if (!handlers[key]) handlers[key] = [];
      const cb =
        typeof layerOrCb === "function"
          ? (layerOrCb as (...args: unknown[]) => void)
          : (maybeCb as (...args: unknown[]) => void);
      handlers[key].push(cb);
      // "load" est déclenché immédiatement (simule le style chargé)
      if (event === "load" && typeof layerOrCb === "function") {
        (layerOrCb as () => void)();
      }
    },
  );

  // Expose les handlers pour piloter les interactions dans les tests
  (mockOn as unknown as Record<string, unknown>)._handlers = handlers;

  const MockPopup = vi.fn(function (this: Record<string, unknown>) {
    this.setLngLat = vi.fn(() => this);
    this.setHTML = vi.fn((_html: string) => this);
    this.addTo = vi.fn(() => this);
    this.remove = vi.fn();
  });

  const MockMap = vi.fn(function (
    this: Record<string, unknown>,
    _opts: unknown,
  ) {
    this.addSource = mockAddSource;
    this.addLayer = mockAddLayer;
    this.setFeatureState = mockSetFeatureState;
    this.addControl = mockAddControl;
    this.on = mockOn;
    // Réinitialise les handlers à chaque nouvelle instance
    for (const key of Object.keys(handlers)) delete handlers[key];
  });

  const MockNavigationControl = vi.fn(function (
    this: Record<string, unknown>,
  ) {});

  return {
    mockAddSource,
    mockAddLayer,
    mockSetFeatureState,
    mockAddControl,
    mockOn,
    MockMap,
    MockNavigationControl,
    MockPopup,
  };
});

vi.mock("maplibre-gl", () => ({
  Map: MockMap,
  NavigationControl: MockNavigationControl,
  Popup: MockPopup,
}));

// Import APRÈS le mock
import {
  renderChoroplethGL,
  topoToGeoJSON,
} from "../components/map-choropleth-gl";

// ─────────────────────────────────────────────────────────────────────────────

// Helpers pour accéder aux handlers capturés par mockOn
function getHandlers(event: string, layerId?: string) {
  const handlers = (mockOn as unknown as Record<string, Record<string, unknown>>)
    ._handlers as Record<string, Array<(...args: unknown[]) => void>>;
  const key = layerId ? `${event}:${layerId}` : event;
  return handlers[key] ?? [];
}

function triggerClick(layerId: string, featureCode: string) {
  const cbs = getHandlers("click", layerId);
  for (const cb of cbs) {
    cb({
      features: [{ properties: { code: featureCode }, id: featureCode }],
      lngLat: { lng: 2.3, lat: 48.8 },
      point: { x: 100, y: 100 },
    });
  }
}

function triggerMousemove(layerId: string, featureCode: string) {
  const cbs = getHandlers("mousemove", layerId);
  for (const cb of cbs) {
    cb({
      features: [
        {
          properties: { code: featureCode, nom: "Paris" },
          id: featureCode,
        },
      ],
      lngLat: { lng: 2.3, lat: 48.8 },
    });
  }
}

function triggerMouseleave(layerId: string) {
  const cbs = getHandlers("mouseleave", layerId);
  for (const cb of cbs) cb({});
}

// ─────────────────────────────────────────────────────────────────────────────

describe("topoToGeoJSON (B-111)", () => {
  it("convertit le topojson embarqué en FeatureCollection avec 96 features", () => {
    const fc = topoToGeoJSON();
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features.length).toBe(96);
  });

  it("chaque feature porte les propriétés code et nom", () => {
    const fc = topoToGeoJSON();
    for (const f of fc.features) {
      expect(typeof f.properties?.code).toBe("string");
      expect(typeof f.properties?.nom).toBe("string");
      expect(f.properties.code.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("les codes couvrent les 96 départements métropole (01→95 + 2A + 2B)", () => {
    const fc = topoToGeoJSON();
    const codes = new Set(fc.features.map((f) => f.properties.code));
    // Departements connus
    expect(codes.has("75")).toBe(true); // Paris
    expect(codes.has("92")).toBe(true); // Hauts-de-Seine
    expect(codes.has("2A")).toBe(true); // Corse-du-Sud
    expect(codes.has("2B")).toBe(true); // Haute-Corse
    expect(codes.size).toBe(96);
  });

  it("Paris (75) a des coordonnées plausibles (lng ~2.3, lat ~48.8)", () => {
    const fc = topoToGeoJSON();
    const paris = fc.features.find((f) => f.properties.code === "75");
    expect(paris).toBeDefined();
    // La géométrie doit être un Polygon ou MultiPolygon
    expect(["Polygon", "MultiPolygon"]).toContain(paris?.geometry.type);
    // Vérifier que les coordonnées sont dans la plage de Paris
    const geom = paris!.geometry as { coordinates: number[][][] };
    const ring = geom.coordinates[0];
    const lngs = ring.map((c: number[]) => c[0]);
    const lats = ring.map((c: number[]) => c[1]);
    const avgLng = lngs.reduce((a: number, b: number) => a + b, 0) / lngs.length;
    const avgLat = lats.reduce((a: number, b: number) => a + b, 0) / lats.length;
    // Paris: lng ≈ 2.3, lat ≈ 48.85
    expect(avgLng).toBeGreaterThan(2.0);
    expect(avgLng).toBeLessThan(2.7);
    expect(avgLat).toBeGreaterThan(48.6);
    expect(avgLat).toBeLessThan(49.1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("renderChoroplethGL (B-111)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Réinitialise les handlers
    const handlers = (mockOn as unknown as Record<string, Record<string, unknown>>)
      ._handlers as Record<string, unknown>;
    for (const key of Object.keys(handlers)) delete handlers[key];
  });

  const makeData = () =>
    new Map<string, number>([
      ["75", 1000],
      ["92", 800],
      ["13", 600],
    ]);

  it("appelle addSource avec type geojson (données locales, pas d'URL réseau)", () => {
    const container = document.createElement("div");
    renderChoroplethGL(container, makeData());

    expect(mockAddSource).toHaveBeenCalledOnce();
    const [sourceId, sourceOpts] = mockAddSource.mock.calls[0] as [
      string,
      { type: string; data: unknown; promoteId?: string },
    ];
    expect(typeof sourceId).toBe("string");
    expect(sourceOpts.type).toBe("geojson");
    // data doit être un objet (FeatureCollection inline), pas une chaîne URL
    expect(typeof sourceOpts.data).toBe("object");
    expect((sourceOpts.data as { type: string }).type).toBe("FeatureCollection");
    // Invariant I-2 : pas d'URL réseau
    expect(JSON.stringify(sourceOpts.data)).not.toMatch(/https?:\/\//);
  });

  it("appelle addSource avec promoteId='code' pour feature-state", () => {
    const container = document.createElement("div");
    renderChoroplethGL(container, makeData());

    const [, sourceOpts] = mockAddSource.mock.calls[0] as [
      string,
      { promoteId: string },
    ];
    expect(sourceOpts.promoteId).toBe("code");
  });

  it("appelle addLayer pour un layer fill et un layer line (frontières)", () => {
    const container = document.createElement("div");
    renderChoroplethGL(container, makeData());

    expect(mockAddLayer).toHaveBeenCalledTimes(2);
    const layerTypes = mockAddLayer.mock.calls.map(
      (c) => (c[0] as { type: string }).type,
    );
    expect(layerTypes).toContain("fill");
    expect(layerTypes).toContain("line");
  });

  it("le layer fill utilise fill-color data-driven (expression match)", () => {
    const container = document.createElement("div");
    renderChoroplethGL(container, makeData());

    const fillCall = mockAddLayer.mock.calls.find(
      (c) => (c[0] as { type: string }).type === "fill",
    );
    expect(fillCall).toBeDefined();
    const paint = (fillCall![0] as { paint: { "fill-color": unknown } }).paint;
    // fill-color doit être une expression (tableau), pas une chaîne statique
    expect(Array.isArray(paint["fill-color"])).toBe(true);
  });

  it("le layer fill est lié à la bonne source", () => {
    const container = document.createElement("div");
    renderChoroplethGL(container, makeData());

    const [sourceId] = mockAddSource.mock.calls[0] as [string, unknown];
    const fillCall = mockAddLayer.mock.calls.find(
      (c) => (c[0] as { type: string }).type === "fill",
    );
    const layerSource = (fillCall![0] as { source: string }).source;
    expect(layerSource).toBe(sourceId);
  });

  it("câble les événements click, mousemove, mouseleave", () => {
    const container = document.createElement("div");
    renderChoroplethGL(container, makeData());

    const events = mockOn.mock.calls.map((c) => c[0]);
    expect(events).toContain("load");
    expect(events).toContain("click");
    expect(events).toContain("mousemove");
    expect(events).toContain("mouseleave");
  });

  it("clic département → onSelect appelé avec le code", () => {
    const container = document.createElement("div");
    const onSelect = vi.fn();
    renderChoroplethGL(container, makeData(), { onSelect });

    // Récupère l'id du layer fill pour simuler le clic
    const fillCall = mockAddLayer.mock.calls.find(
      (c) => (c[0] as { type: string }).type === "fill",
    );
    const fillLayerId = (fillCall![0] as { id: string }).id;

    triggerClick(fillLayerId, "75");
    expect(onSelect).toHaveBeenCalledWith("75");
  });

  it("re-clic même département → onSelect appelé avec null (toggle)", () => {
    const container = document.createElement("div");
    const onSelect = vi.fn();
    renderChoroplethGL(container, makeData(), { onSelect });

    const fillCall = mockAddLayer.mock.calls.find(
      (c) => (c[0] as { type: string }).type === "fill",
    );
    const fillLayerId = (fillCall![0] as { id: string }).id;

    // 1er clic : sélection
    triggerClick(fillLayerId, "75");
    expect(onSelect).toHaveBeenCalledWith("75");
    onSelect.mockClear();

    // 2e clic même code : désélection
    triggerClick(fillLayerId, "75");
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it("clic département différent → sélectionne le nouveau", () => {
    const container = document.createElement("div");
    const onSelect = vi.fn();
    renderChoroplethGL(container, makeData(), { onSelect });

    const fillCall = mockAddLayer.mock.calls.find(
      (c) => (c[0] as { type: string }).type === "fill",
    );
    const fillLayerId = (fillCall![0] as { id: string }).id;

    triggerClick(fillLayerId, "75");
    onSelect.mockClear();

    // Clic sur un autre département
    triggerClick(fillLayerId, "92");
    expect(onSelect).toHaveBeenCalledWith("92");
    // Pas de désélection (c'est un autre code)
    expect(onSelect).not.toHaveBeenCalledWith(null);
  });

  it("clic → setFeatureState appelé pour highlight (selected=true)", () => {
    const container = document.createElement("div");
    renderChoroplethGL(container, makeData());

    const fillCall = mockAddLayer.mock.calls.find(
      (c) => (c[0] as { type: string }).type === "fill",
    );
    const fillLayerId = (fillCall![0] as { id: string }).id;

    triggerClick(fillLayerId, "75");

    // setFeatureState doit avoir été appelé avec selected: true
    const selectCalls = mockSetFeatureState.mock.calls.filter(
      (c) => (c[1] as Record<string, unknown>).selected === true,
    );
    expect(selectCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("toggle → setFeatureState appelé avec selected: false pour l'ancien", () => {
    const container = document.createElement("div");
    renderChoroplethGL(container, makeData());

    const fillCall = mockAddLayer.mock.calls.find(
      (c) => (c[0] as { type: string }).type === "fill",
    );
    const fillLayerId = (fillCall![0] as { id: string }).id;

    triggerClick(fillLayerId, "75");
    mockSetFeatureState.mockClear();

    // Re-clic : doit effacer la sélection
    triggerClick(fillLayerId, "75");
    const clearCalls = mockSetFeatureState.mock.calls.filter(
      (c) => (c[1] as Record<string, unknown>).selected === false,
    );
    expect(clearCalls.length).toBeGreaterThanOrEqual(1);
  });

  it("interchangeabilité : accepte le même Map<code,valeur> que renderChoropleth SVG", () => {
    // Contrat identique : Map<string, number>
    const container = document.createElement("div");
    const dataByDept = new Map<string, number>([
      ["75", 4242],
      ["92", 1234],
    ]);
    // Ne doit pas lever
    expect(() => renderChoroplethGL(container, dataByDept)).not.toThrow();
    // addSource appelé : le rendu a bien eu lieu
    expect(mockAddSource).toHaveBeenCalledOnce();
  });

  it("mousemove → tooltip créé (Popup)", () => {
    const container = document.createElement("div");
    renderChoroplethGL(container, makeData());

    const fillCall = mockAddLayer.mock.calls.find(
      (c) => (c[0] as { type: string }).type === "fill",
    );
    const fillLayerId = (fillCall![0] as { id: string }).id;

    triggerMousemove(fillLayerId, "75");
    expect(MockPopup).toHaveBeenCalled();
  });

  it("mouseleave → popup.remove() appelé (tooltip masqué)", () => {
    const container = document.createElement("div");
    renderChoroplethGL(container, makeData());

    const fillCall = mockAddLayer.mock.calls.find(
      (c) => (c[0] as { type: string }).type === "fill",
    );
    const fillLayerId = (fillCall![0] as { id: string }).id;

    // Déclenche mousemove puis mouseleave
    triggerMousemove(fillLayerId, "75");
    const popupInstance = MockPopup.mock.instances[0] as Record<string, ReturnType<typeof vi.fn>>;
    triggerMouseleave(fillLayerId);
    expect(popupInstance.remove).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Test de zéro réseau (structural — vérification du module source).
// Note : ce test utilise une importation ?raw du module lui-même
// pour scanner le contenu compilé. On le met en commentaire intentionnel
// car le scan réseau est fait via grep dans la gate finale CI.
// ─────────────────────────────────────────────────────────────────────────────
