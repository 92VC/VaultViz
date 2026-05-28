// B-032 — Carte choroplèthe France (départements), SVG / D3.
//
// Choix technique : on rend en SVG via `d3-geo` plutôt que via Mosaic
// `vg.geo` (statut beta + dépendances supplémentaires). C'est un dépôt
// volontaire de V0 — la cible V1 reste MapLibre + PMTiles (cf. B-110).
//
// Fond cartographique embarqué : `../assets/departements-v0.geojson`
// (Etalab 2.0, IGN ADMIN EXPRESS simplifié). 96 départements métropole
// uniquement.
//
// API :
//   renderChoropleth(container, dataByDept, opts?)
// où `dataByDept` est une Map<code département (2 chiffres), valeur>.

import { geoMercator, geoPath } from "d3-geo";

import geojsonRaw from "../assets/departements-v0.geojson?raw";

type DeptFeatureProps = {
  code?: string;
  CODE_DEPT?: string;
  nom?: string;
  NOM_DEPT?: string;
};

type FeatureCollection = {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: unknown;
    properties: DeptFeatureProps;
  }>;
};

const featureCollection: FeatureCollection = JSON.parse(geojsonRaw);

export interface ChoroplethOptions {
  width?: number;
  height?: number;
  colorScale?: (v: number, max: number) => string;
  emptyColor?: string;
}

function defaultColorScale(v: number, max: number): string {
  if (v <= 0 || max <= 0) return "#eee";
  const ratio = Math.min(1, v / max);
  // Échelle bleue : satur de 20→100, lum 60→35.
  const sat = 20 + ratio * 80;
  const lum = 60 - ratio * 25;
  return `hsl(220, ${sat.toFixed(1)}%, ${lum.toFixed(1)}%)`;
}

/**
 * Effectue le rendu SVG dans `container` (remplace son contenu).
 *
 * Le SVG porte un attribut `aria-label` et chaque path département
 * embarque un `<title>` (tooltip natif navigateur). Légende minimale
 * sous le SVG (gradient + bornes 0…max).
 */
export function renderChoropleth(
  container: HTMLElement,
  dataByDept: Map<string, number>,
  opts: ChoroplethOptions = {},
): void {
  const width = opts.width ?? 600;
  const height = opts.height ?? 600;
  const emptyColor = opts.emptyColor ?? "#eee";
  const values = Array.from(dataByDept.values()).filter((v) => Number.isFinite(v));
  const max = values.length ? Math.max(...values) : 0;
  const colorScale = opts.colorScale ?? defaultColorScale;

  // d3-geo types : `fitSize` accepte un FeatureCollection étendu.
  const projection = geoMercator().fitSize(
    [width, height],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    featureCollection as unknown as any,
  );
  const path = geoPath(projection);

  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("width", String(width));
  svg.setAttribute("height", String(height));
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", "Carte choroplèthe des départements français");
  svg.classList.add("vv-choropleth-svg");

  for (const f of featureCollection.features) {
    const code = String(f.properties?.code ?? f.properties?.CODE_DEPT ?? "");
    const nom = String(
      f.properties?.nom ?? f.properties?.NOM_DEPT ?? code,
    );
    const v = dataByDept.get(code) ?? 0;
    const d = path(f as unknown as GeoJSON.Feature) ?? "";
    if (!d) continue;
    const p = document.createElementNS(SVG_NS, "path");
    p.setAttribute("d", d);
    p.setAttribute(
      "fill",
      dataByDept.has(code) ? colorScale(v, max) : emptyColor,
    );
    p.setAttribute("stroke", "#fff");
    p.setAttribute("stroke-width", "0.5");
    p.dataset.dept = code;
    p.dataset.value = String(v);

    const title = document.createElementNS(SVG_NS, "title");
    title.textContent = `${nom} (${code}) : ${v.toLocaleString("fr-FR")}`;
    p.appendChild(title);
    svg.appendChild(p);
  }

  const legend = document.createElement("div");
  legend.className = "vv-legend";
  legend.innerHTML = `
    <span class="vv-legend-label">0</span>
    <span class="vv-legend-grad" aria-hidden="true"></span>
    <span class="vv-legend-label">${max.toLocaleString("fr-FR")}</span>
  `;

  container.replaceChildren(svg, legend);
}

/**
 * Test-only : nombre de features chargées depuis le GeoJSON embarqué.
 */
export function _geoFeatureCount(): number {
  return featureCollection.features.length;
}
