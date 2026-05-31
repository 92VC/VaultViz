// B-111 — Choroplèthe MapLibre data-driven + drill clic→sélection.
//
// Moteur alternatif au SVG (`renderChoropleth` dans `map-view.ts`) :
// même contrat de données (Map<code département 2 chiffres, valeur>),
// rendu WebGL via MapLibre GL JS + source GeoJSON inline.
//
// Source géo : `ref/departements.topojson` (copié dans src/assets/).
// La conversion TopoJSON→GeoJSON est faite à la demande (une seule fois)
// via `topoToGeoJSON()` — aucune dépendance externe (topojson-client absent).
//
// Invariants :
//   I-2 : ZÉRO appel réseau. Le topojson est importé ?raw (build-time).
//         La FeatureCollection est passée en objet inline à addSource.
//   H4  : l'émission de clause Mosaic est déléguée via `opts.onSelect`
//         (câblée dans view-mounter), jamais ici.
//
// API publique :
//   renderChoroplethGL(container, dataByDept, opts?)
//   topoToGeoJSON()  — exposé pour les tests
//
// Couleur data-driven : expression `["match", ["get","code"], code1, col1, …, fallback]`
// Réutilise la logique HSL de `defaultColorScale` (map-view.ts).
//
// Feature-state :
//   "selected": true/false → line-width épaissi sur le département actif.
//   `promoteId: "code"` sur la source → MapLibre utilise `code` comme id.
//
// Tooltip survol : `Popup` MapLibre standard (nom + valeur formatée).

import * as maplibregl from "maplibre-gl";

import topoRaw from "../assets/departements.topojson?raw";
import type { StyleSpecification } from "maplibre-gl";
import { fmt, type FormatKind } from "../ui/format";

// ─── Types TopoJSON minimal ────────────────────────────────────────────────

type TopoArc = number[][];

interface TopoTransform {
  scale: [number, number];
  translate: [number, number];
}

interface TopoGeometry {
  type: string;
  arcs: number[] | number[][] | number[][][];
  properties: Record<string, string>;
}

interface TopoObject {
  type: string;
  geometries: TopoGeometry[];
}

interface Topology {
  type: "Topology";
  arcs: TopoArc[];
  transform?: TopoTransform;
  objects: Record<string, TopoObject>;
}

// ─── Type GeoJSON minimal ──────────────────────────────────────────────────

interface GeoPolygon {
  type: "Polygon";
  coordinates: number[][][];
}

interface GeoMultiPolygon {
  type: "MultiPolygon";
  coordinates: number[][][][];
}

interface GeoFeature {
  type: "Feature";
  geometry: GeoPolygon | GeoMultiPolygon;
  properties: { code: string; nom: string };
}

export interface GeoFeatureCollection {
  type: "FeatureCollection";
  features: GeoFeature[];
}

// ─── Conversion TopoJSON → GeoJSON ────────────────────────────────────────

let cachedGeoJSON: GeoFeatureCollection | null = null;

/**
 * Décode le TopoJSON embarqué (`src/assets/departements.topojson`) en
 * FeatureCollection GeoJSON, en gérant :
 *   1. Dé-quantification delta (transform scale + translate)
 *   2. Indices d'arc négatifs (= ~i → arc inversé)
 *   3. Suppression du dernier point dupliqué entre arcs contigus
 *
 * Résultat mis en cache (calcul unique, ~21 Ko en entrée → ~30 Ko GeoJSON).
 * Exposé pour les tests (`topoToGeoJSON`).
 */
export function topoToGeoJSON(): GeoFeatureCollection {
  if (cachedGeoJSON) return cachedGeoJSON;

  const topo = JSON.parse(topoRaw) as Topology;
  const transform = topo.transform;
  const topoArcs = topo.arcs;

  // Dé-quantifier un arc : delta cumulé + scale/translate
  function dequantizeArc(arcIdx: number): number[][] {
    const rawArc = topoArcs[arcIdx < 0 ? ~arcIdx : arcIdx];
    const points: number[][] = [];
    let x = 0;
    let y = 0;
    for (const delta of rawArc) {
      x += delta[0];
      y += delta[1];
      if (transform) {
        points.push([
          x * transform.scale[0] + transform.translate[0],
          y * transform.scale[1] + transform.translate[1],
        ]);
      } else {
        points.push([x, y]);
      }
    }
    if (arcIdx < 0) points.reverse();
    return points;
  }

  // Concatène une liste d'indices d'arcs en un anneau fermé (ring).
  // Supprime le point partagé à la jonction de deux arcs consécutifs
  // (dernier point = premier point du suivant en TopoJSON).
  function buildRing(arcIndices: number[]): number[][] {
    const ring: number[][] = [];
    for (let i = 0; i < arcIndices.length; i++) {
      const pts = dequantizeArc(arcIndices[i]);
      // Sauf pour le premier arc, le 1er point est identique au dernier
      // point de l'arc précédent → on le supprime.
      const start = i === 0 ? 0 : 1;
      for (let j = start; j < pts.length; j++) {
        ring.push(pts[j]);
      }
    }
    return ring;
  }

  const objName = Object.keys(topo.objects)[0];
  const obj = topo.objects[objName];

  const features: GeoFeature[] = obj.geometries.map((geom) => {
    let geometry: GeoPolygon | GeoMultiPolygon;

    if (geom.type === "Polygon") {
      // arcs = number[][] (liste de rings)
      const rings = (geom.arcs as number[][]).map((ring) => buildRing(ring));
      geometry = { type: "Polygon", coordinates: rings };
    } else if (geom.type === "MultiPolygon") {
      // arcs = number[][][] (liste de polygones, chacun = liste de rings)
      const polys = (geom.arcs as number[][][]).map((poly) =>
        poly.map((ring) => buildRing(ring)),
      );
      geometry = { type: "MultiPolygon", coordinates: polys };
    } else {
      // Fallback : Polygon vide
      geometry = { type: "Polygon", coordinates: [[]] };
    }

    return {
      type: "Feature",
      geometry,
      properties: {
        code: geom.properties.code ?? "",
        nom: geom.properties.nom ?? "",
      },
    };
  });

  cachedGeoJSON = { type: "FeatureCollection", features };
  return cachedGeoJSON;
}

// ─── Palette choroplèthe (parité avec map-view.ts SVG) ────────────────────

/**
 * Échelle de couleur HSL (identique à `defaultColorScale` dans map-view.ts).
 * Bleu : saturation 20→100, luminosité 60→35.
 */
function colorFromRatio(ratio: number): string {
  const r = Math.min(1, Math.max(0, ratio));
  const sat = 20 + r * 80;
  const lum = 60 - r * 25;
  return `hsl(220, ${sat.toFixed(1)}%, ${lum.toFixed(1)}%)`;
}

/**
 * Construit une expression MapLibre `["match", ["get","code"], code1, col1, …, fallback]`
 * data-driven, en calculant la couleur de chaque département depuis
 * `dataByDept` et la valeur max.
 *
 * Guard : si dataByDept est vide ou ne contient pas de valeurs finies,
 * retourne la couleur vide statique (string) — MapLibre accepte une string
 * comme expression constante, et une expression `["match", …]` sans paires
 * label/output serait invalide.
 */
function buildColorExpression(
  dataByDept: Map<string, number>,
  emptyColor: string,
): unknown {
  const values = Array.from(dataByDept.values()).filter((v) =>
    Number.isFinite(v),
  );
  const max = values.length ? Math.max(...values) : 0;

  // Guard : aucune donnée → couleur statique (expression constante valide).
  if (dataByDept.size === 0 || max <= 0) return emptyColor;

  const expr: unknown[] = ["match", ["get", "code"]];
  for (const [code, v] of dataByDept) {
    if (Number.isFinite(v) && max > 0) {
      expr.push(code, colorFromRatio(v / max));
    } else {
      expr.push(code, emptyColor);
    }
  }
  // Fallback pour les codes sans données
  expr.push(emptyColor);
  return expr;
}

// ─── Options publiques ────────────────────────────────────────────────────

export interface ChoroplethGLOptions {
  /** Couleur vide (département sans donnée). Défaut : "#eee". */
  emptyColor?: string;
  /** Format de valeur pour le tooltip. Délégué à `fmt()`. */
  format?: FormatKind | string;
  /** Centre de la carte. Défaut : [2.5, 46.5] (France). */
  center?: [number, number];
  /** Zoom initial. Défaut : 5. */
  zoom?: number;
  /**
   * Callback de sélection : appelé avec le code département au clic
   * (ou `null` si toggle/désélection). Câblé depuis `view-mounter`
   * via `createPointEmitter` — **ne pas importer mosaic-runtime ici**
   * (invariant H4 : émission confinée à viz-engine/).
   */
  onSelect?: (code: string | null) => void;
}

// ─── Rendu principal ──────────────────────────────────────────────────────

const SOURCE_ID = "vv-depts";
const FILL_LAYER_ID = "vv-depts-fill";
const LINE_LAYER_ID = "vv-depts-line";

/**
 * Rend une choroplèthe MapLibre dans `container`.
 *
 * Même contrat de données que `renderChoropleth` SVG :
 *   `dataByDept` = Map<code département 2 chiffres, valeur numérique>.
 *
 * Construit sur `maplibregl.Map` avec style vide (zéro réseau).
 * La source GeoJSON est injectée inline au chargement du style ("load").
 *
 * @returns L'instance `maplibregl.Map` créée.
 */
export function renderChoroplethGL(
  container: HTMLElement,
  dataByDept: Map<string, number>,
  opts: ChoroplethGLOptions = {},
): maplibregl.Map {
  const emptyColor = opts.emptyColor ?? "#eee";
  const center: [number, number] = opts.center ?? [2.5, 46.5];
  const zoom: number = opts.zoom ?? 5;

  // Style vide : zéro réseau (invariant I-2).
  const emptyStyle: StyleSpecification = {
    version: 8 as const,
    sources: {},
    layers: [],
  };

  const map = new maplibregl.Map({
    container,
    style: emptyStyle,
    center,
    zoom,
    canvasContextAttributes: { preserveDrawingBuffer: true },
  });

  map.addControl(new maplibregl.NavigationControl());

  // Popup réutilisable pour le tooltip de survol.
  const popup = new maplibregl.Popup({
    closeButton: false,
    closeOnClick: false,
  });

  // Département actuellement sélectionné (null = aucun).
  let selectedCode: string | null = null;

  map.on("load", () => {
    const fc = topoToGeoJSON();
    const colorExpr = buildColorExpression(dataByDept, emptyColor);

    // Source GeoJSON inline — promoteId:"code" requis pour feature-state.
    map.addSource(SOURCE_ID, {
      type: "geojson",
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data: fc as unknown as any,
      promoteId: "code",
    });

    // Layer fill — couleur data-driven via expression match.
    map.addLayer({
      id: FILL_LAYER_ID,
      type: "fill",
      source: SOURCE_ID,
      layout: {},
      paint: {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        "fill-color": colorExpr as any,
        "fill-opacity": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          0.9,
          0.7,
        ],
      },
    });

    // Layer line — frontières ; line-width épaissi si selected.
    map.addLayer({
      id: LINE_LAYER_ID,
      type: "line",
      source: SOURCE_ID,
      layout: {},
      paint: {
        "line-color": "#ffffff",
        "line-width": [
          "case",
          ["boolean", ["feature-state", "selected"], false],
          3,
          0.5,
        ],
      },
    });

    // ── Interaction clic → sélection (toggle) ──────────────────────────────

    map.on("click", FILL_LAYER_ID, (e) => {
      const features = e.features;
      if (!features || features.length === 0) return;
      const code = String(
        (features[0].properties as Record<string, unknown>).code ?? "",
      );
      if (!code) return;

      if (selectedCode === code) {
        // Toggle : désélection
        map.setFeatureState(
          { source: SOURCE_ID, id: code },
          { selected: false },
        );
        selectedCode = null;
        opts.onSelect?.(null);
      } else {
        // Effacer l'ancienne sélection
        if (selectedCode !== null) {
          map.setFeatureState(
            { source: SOURCE_ID, id: selectedCode },
            { selected: false },
          );
        }
        selectedCode = code;
        map.setFeatureState(
          { source: SOURCE_ID, id: code },
          { selected: true },
        );
        opts.onSelect?.(code);
      }
    });

    // ── Tooltip survol ─────────────────────────────────────────────────────

    map.on("mousemove", FILL_LAYER_ID, (e) => {
      const features = e.features;
      if (!features || features.length === 0) return;
      const props = features[0].properties as Record<string, unknown>;
      const code = String(props.code ?? "");
      const nom = String(props.nom ?? code);
      const v = dataByDept.get(code) ?? 0;
      const valueStr = opts.format
        ? fmt(v, opts.format)
        : v.toLocaleString("fr-FR");

      popup
        .setLngLat(
          (e as unknown as { lngLat: maplibregl.LngLatLike }).lngLat,
        )
        .setHTML(`<strong>${nom} (${code})</strong><br/>${valueStr}`)
        .addTo(map);
    });

    map.on("mouseleave", FILL_LAYER_ID, () => {
      popup.remove();
    });
  });

  return map;
}
