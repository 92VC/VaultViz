// B-032 — Carte choroplèthe France (départements), SVG / D3.
// B-100 — Ajout moteur MapLibre GL JS comme option de rendu de fond.
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
//   renderChoropleth(container, dataByDept, opts?)   — SVG / D3 (défaut)
//   mountMap(container, opts)                        — choix du moteur
// où `dataByDept` est une Map<code département (2 chiffres), valeur>.

import { geoMercator, geoPath } from "d3-geo";
import type { Map as MapLibreMap } from "maplibre-gl";

import geojsonRaw from "../assets/departements-v0.geojson?raw";
import { fmt, type FormatKind } from "../ui/format";
import { createBaseMap, type BaseMapOptions } from "./map-libre";

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
  /**
   * Format de valeur (cf. `CompiledView.format` / `metrics[].format`).
   * Appliqué au `<title>` de chaque path et aux bornes de la légende.
   * Défaut : entier groupé FR.
   */
  format?: FormatKind | string;
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
): SVGSVGElement {
  const width = opts.width ?? 600;
  const height = opts.height ?? 600;
  const emptyColor = opts.emptyColor ?? "#eee";
  const values = Array.from(dataByDept.values()).filter((v) => Number.isFinite(v));
  const max = values.length ? Math.max(...values) : 0;
  const colorScale = opts.colorScale ?? defaultColorScale;
  const format = opts.format;

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
    title.textContent = `${nom} (${code}) : ${format ? fmt(v, format) : v.toLocaleString("fr-FR")}`;
    p.appendChild(title);
    svg.appendChild(p);
  }

  const legend = document.createElement("div");
  legend.className = "vv-legend";
  const minLabel = format ? fmt(0, format) : "0";
  const maxLabel = format ? fmt(max, format) : max.toLocaleString("fr-FR");
  legend.innerHTML = `
    <span class="vv-legend-label">${minLabel}</span>
    <span class="vv-legend-grad" aria-hidden="true"></span>
    <span class="vv-legend-label">${maxLabel}</span>
  `;

  container.replaceChildren(svg, legend);
  return svg;
}

/**
 * Sélecteur de métrique segmenté (`.seg-ctrl`), porté du mockup
 * (`#metric-seg` dans `VaultViz.html`). Rend un bouton par métrique,
 * marque l'actif via `.on` + `aria-pressed`, et appelle `onChange` avec
 * la clé de la métrique cliquée.
 *
 * Le re-fetch des données par métrique est de la responsabilité du
 * mounter (pas de ce composant, qui ne fait que l'UI du switcher).
 *
 * Remplace le contenu de `container`.
 */
export function renderMetricSwitcher(
  container: HTMLElement,
  metrics: { key: string; label: string }[],
  activeKey: string,
  onChange: (key: string) => void,
): void {
  const seg = document.createElement("div");
  seg.className = "seg-ctrl";
  seg.setAttribute("role", "group");
  seg.setAttribute("aria-label", "Métrique de la carte");

  for (const m of metrics) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.dataset.m = m.key;
    btn.textContent = m.label;
    const active = m.key === activeKey;
    if (active) btn.classList.add("on");
    btn.setAttribute("aria-pressed", active ? "true" : "false");
    btn.addEventListener("click", () => {
      for (const b of seg.querySelectorAll<HTMLButtonElement>("button")) {
        b.classList.remove("on");
        b.setAttribute("aria-pressed", "false");
      }
      btn.classList.add("on");
      btn.setAttribute("aria-pressed", "true");
      onChange(m.key);
    });
    seg.appendChild(btn);
  }

  container.replaceChildren(seg);
}

// ── B-100 — Sélection du moteur de rendu cartographique ──────────────────────

/**
 * Options de `mountMap` — permet de choisir entre le rendu SVG/D3 (défaut)
 * et le fond MapLibre GL JS.
 */
export interface MountMapOptions extends BaseMapOptions {
  /**
   * Moteur de rendu de fond :
   *  - `"svg"` (défaut) : choroplèthe SVG/D3, rétro-compatible.
   *  - `"maplibre"` : fond vide MapLibre GL JS (zéro tuile réseau).
   */
  engine?: "svg" | "maplibre";
  /** Options choroplèthe (utilisées uniquement si engine = "svg"). */
  choropleth?: {
    dataByDept?: Map<string, number>;
    opts?: ChoroplethOptions;
  };
}

/**
 * Monte une vue cartographique dans `container`.
 *
 * - `engine = "svg"` (défaut) : délègue à `renderChoropleth` si `choropleth`
 *   est fourni, sinon vide le conteneur.
 * - `engine = "maplibre"` : délègue à `createBaseMap` (fond vide, zéro réseau).
 *
 * @returns L'instance `SVGSVGElement` (mode svg) ou `MapLibreMap` (mode maplibre).
 */
export function mountMap(
  container: HTMLElement,
  options: MountMapOptions = {},
): SVGSVGElement | MapLibreMap {
  const engine = options.engine ?? "svg";

  if (engine === "maplibre") {
    return createBaseMap(container, {
      center: options.center,
      zoom: options.zoom,
    });
  }

  // Mode svg : rendu choroplèthe si des données sont fournies.
  if (options.choropleth?.dataByDept) {
    return renderChoropleth(
      container,
      options.choropleth.dataByDept,
      options.choropleth.opts,
    );
  }

  // Aucune donnée : vide le conteneur et retourne un SVG vide.
  const SVG_NS = "http://www.w3.org/2000/svg";
  const svg = document.createElementNS(SVG_NS, "svg");
  container.replaceChildren(svg);
  return svg;
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Test-only : nombre de features chargées depuis le GeoJSON embarqué.
 */
export function _geoFeatureCount(): number {
  return featureCollection.features.length;
}
