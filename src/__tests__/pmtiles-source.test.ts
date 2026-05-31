// B-101 — Tests plomberie PMTiles (câblage, pas rendu).
//
// pmtiles et maplibre-gl sont mockés intégralement.
// On teste uniquement le câblage :
//   - registerPmtilesProtocol : addProtocol appelé une fois avec "pmtiles"
//   - registerPmtilesProtocol : idempotent (2e appel = no-op)
//   - addPmtilesBasemap(map, path) : addSource + addLayer appelés
//   - addPmtilesBasemap(map, undefined) : no-op complet
//
// Limite connue : map.addLayer/addSource lèvent si appelés avant "load" ;
// dans le code de production, l'appel est différé via map.on("load", ...).
// Les mocks ne modélisent pas ce délai — le câblage mocké appelle directement.
//
// La garde _protocolRegistered est réinitialisée entre les tests via
// _resetProtocolRegisteredForTests() pour garantir l'isolation.

import { describe, expect, it, vi, beforeEach } from "vitest";

// ── Spies définis via vi.hoisted() pour survivre au hoist de vi.mock ────────
const {
  mockAddProtocol,
  mockAddSource,
  mockAddLayer,
  MockProtocol,
  mockProtocolTile,
} = vi.hoisted(() => {
  const mockAddProtocol = vi.fn();
  const mockAddSource = vi.fn();
  const mockAddLayer = vi.fn();
  const mockProtocolTile = vi.fn();

  const MockProtocol = vi.fn(function (
    this: Record<string, unknown>,
    _opts?: unknown,
  ) {
    this.tile = mockProtocolTile;
    this.tilev4 = vi.fn();
    this.tiles = new Map();
    this.metadata = false;
    this.errorOnMissingTile = false;
  });

  return {
    mockAddProtocol,
    mockAddSource,
    mockAddLayer,
    MockProtocol,
    mockProtocolTile,
  };
});

vi.mock("maplibre-gl", () => ({
  addProtocol: mockAddProtocol,
}));

vi.mock("pmtiles", () => ({
  Protocol: MockProtocol,
}));

// Import APRÈS les mocks
import {
  registerPmtilesProtocol,
  addPmtilesBasemap,
  _resetProtocolRegisteredForTests,
} from "../components/pmtiles-source";

// ─────────────────────────────────────────────────────────────────────────────

/** Crée un faux objet Map MapLibre avec les spies nécessaires. */
function createMockMap() {
  return {
    addSource: mockAddSource,
    addLayer: mockAddLayer,
  } as unknown as import("maplibre-gl").Map;
}

describe("registerPmtilesProtocol (B-101)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetProtocolRegisteredForTests();
  });

  it("appelle addProtocol une fois avec le nom 'pmtiles'", () => {
    registerPmtilesProtocol();

    expect(mockAddProtocol).toHaveBeenCalledOnce();
    expect(mockAddProtocol.mock.calls[0][0]).toBe("pmtiles");
  });

  it("passe protocol.tile comme handler", () => {
    registerPmtilesProtocol();

    const handlerArg = mockAddProtocol.mock.calls[0][1];
    expect(handlerArg).toBe(mockProtocolTile);
  });

  it("est idempotent : un 2e appel ne ré-enregistre pas le protocole", () => {
    registerPmtilesProtocol();
    registerPmtilesProtocol();

    // addProtocol ne doit avoir été appelé qu'une seule fois au total.
    expect(mockAddProtocol).toHaveBeenCalledOnce();
  });

  it("accepte une instance Protocol injectée (injection explicite)", () => {
    const fakeProtocol = new MockProtocol() as unknown as import("pmtiles").Protocol;
    registerPmtilesProtocol(fakeProtocol);

    expect(mockAddProtocol).toHaveBeenCalledOnce();
    expect(mockAddProtocol.mock.calls[0][1]).toBe(mockProtocolTile);
  });
});

describe("addPmtilesBasemap (B-101)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    _resetProtocolRegisteredForTests();
  });

  it("ajoute la source pmtiles:// quand un chemin est fourni", () => {
    const map = createMockMap();
    addPmtilesBasemap(map, "./resources/basemap.pmtiles");

    expect(mockAddSource).toHaveBeenCalledOnce();
    const [sourceId, sourceSpec] = mockAddSource.mock.calls[0] as [
      string,
      { type: string; url: string },
    ];
    expect(sourceId).toBe("pmtiles-basemap");
    expect(sourceSpec.type).toBe("vector");
    expect(sourceSpec.url).toBe("pmtiles://./resources/basemap.pmtiles");
  });

  it("l'URL source ne contient pas de schéma http(s):// (invariant I-2)", () => {
    const map = createMockMap();
    addPmtilesBasemap(map, "./resources/basemap.pmtiles");

    const [, sourceSpec] = mockAddSource.mock.calls[0] as [
      string,
      { url: string },
    ];
    expect(sourceSpec.url).not.toMatch(/https?:\/\//);
  });

  it("ajoute des layers de fond quand un chemin est fourni", () => {
    const map = createMockMap();
    addPmtilesBasemap(map, "./resources/basemap.pmtiles");

    // Au moins 1 layer ajouté
    expect(mockAddLayer).toHaveBeenCalled();
    // Le premier layer est le fond (background)
    const firstLayer = mockAddLayer.mock.calls[0][0] as { id: string; type: string };
    expect(firstLayer.id).toBe("pmtiles-background");
    expect(firstLayer.type).toBe("background");
  });

  it("ne fait rien si pmtilesPath est undefined (no-op)", () => {
    const map = createMockMap();
    addPmtilesBasemap(map, undefined);

    expect(mockAddSource).not.toHaveBeenCalled();
    expect(mockAddLayer).not.toHaveBeenCalled();
    // Le protocole non plus ne doit pas être enregistré
    expect(mockAddProtocol).not.toHaveBeenCalled();
  });

  it("ne fait rien si pmtilesPath est une chaîne vide (no-op)", () => {
    const map = createMockMap();
    addPmtilesBasemap(map, "");

    expect(mockAddSource).not.toHaveBeenCalled();
    expect(mockAddLayer).not.toHaveBeenCalled();
  });

  it("enregistre le protocole lors du premier appel avec chemin", () => {
    const map = createMockMap();
    addPmtilesBasemap(map, "./resources/basemap.pmtiles");

    expect(mockAddProtocol).toHaveBeenCalledOnce();
  });

  it("n'enregistre le protocole qu'une seule fois même pour deux appels", () => {
    const map = createMockMap();
    addPmtilesBasemap(map, "./resources/basemap.pmtiles");
    addPmtilesBasemap(map, "./resources/other.pmtiles");

    // addProtocol ne doit avoir été appelé qu'une seule fois
    expect(mockAddProtocol).toHaveBeenCalledOnce();
  });

  it("accepte un chemin UNC local (double slash, séparateurs /)", () => {
    const map = createMockMap();
    addPmtilesBasemap(map, "//serveur/partage/cartes/idf.pmtiles");

    const [, sourceSpec] = mockAddSource.mock.calls[0] as [
      string,
      { url: string },
    ];
    expect(sourceSpec.url).toBe("pmtiles:////serveur/partage/cartes/idf.pmtiles");
    // Toujours pas de http(s)://
    expect(sourceSpec.url).not.toMatch(/https?:\/\//);
  });
});
