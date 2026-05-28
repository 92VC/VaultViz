// Tests B-032 — carte choroplèthe SVG.
//
// On vérifie que :
// - le GeoJSON embarqué contient au moins 95 départements (96 attendus
//   pour la métropole)
// - `renderChoropleth` produit un <svg> avec autant de <path> que de
//   features, et un bloc légende .vv-legend
// - les valeurs sont remontées dans data-value / <title>

import { describe, expect, it } from "vitest";
import { _geoFeatureCount, renderChoropleth } from "../components/map-view";

describe("map-view (B-032)", () => {
  it("expose ≥95 départements depuis le GeoJSON embarqué", () => {
    expect(_geoFeatureCount()).toBeGreaterThanOrEqual(95);
  });

  it("rend un <svg> avec un <path> par département + une légende", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const dataByDept = new Map<string, number>(
      Array.from({ length: 96 }, (_, i) => [
        String(i + 1).padStart(2, "0"),
        i * 10,
      ]),
    );
    renderChoropleth(container, dataByDept);
    const paths = container.querySelectorAll("svg path");
    expect(paths.length).toBeGreaterThanOrEqual(95);
    const legend = container.querySelector(".vv-legend");
    expect(legend).not.toBeNull();
    const svg = container.querySelector("svg");
    expect(svg?.getAttribute("aria-label")).toMatch(/choroplèthe/i);
  });

  it("attache un <title> sur chaque path (tooltip natif)", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const dataByDept = new Map<string, number>([["75", 4242]]);
    renderChoropleth(container, dataByDept);
    const titles = Array.from(container.querySelectorAll("svg path title"));
    expect(titles.length).toBeGreaterThanOrEqual(95);
    const paris = titles.find((t) => t.textContent?.includes("(75)"));
    expect(paris?.textContent).toMatch(/4\s?242/);
  });
});
