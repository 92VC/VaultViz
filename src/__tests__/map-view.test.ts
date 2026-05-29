// Tests B-032 — carte choroplèthe SVG.
//
// On vérifie que :
// - le GeoJSON embarqué contient au moins 95 départements (96 attendus
//   pour la métropole)
// - `renderChoropleth` produit un <svg> avec autant de <path> que de
//   features, et un bloc légende .vv-legend
// - les valeurs sont remontées dans data-value / <title>

import { describe, expect, it, vi } from "vitest";
import {
  _geoFeatureCount,
  renderChoropleth,
  renderMetricSwitcher,
} from "../components/map-view";

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

describe("renderMetricSwitcher (SP3)", () => {
  const metrics = [
    { key: "ca", label: "CA" },
    { key: "marge", label: "Marge" },
    { key: "ecart", label: "Écart" },
  ];

  it("rend un .seg-ctrl avec un bouton par métrique", () => {
    const container = document.createElement("div");
    renderMetricSwitcher(container, metrics, "ca", () => {});
    const seg = container.querySelector(".seg-ctrl");
    expect(seg).not.toBeNull();
    const buttons = container.querySelectorAll(".seg-ctrl button");
    expect(buttons.length).toBe(3);
    expect(Array.from(buttons).map((b) => b.textContent)).toEqual([
      "CA",
      "Marge",
      "Écart",
    ]);
  });

  it("marque le bouton actif via .on et aria-pressed", () => {
    const container = document.createElement("div");
    renderMetricSwitcher(container, metrics, "marge", () => {});
    const on = container.querySelectorAll(".seg-ctrl button.on");
    expect(on.length).toBe(1);
    expect(on[0].textContent).toBe("Marge");
    expect(on[0].getAttribute("aria-pressed")).toBe("true");
    expect((on[0] as HTMLButtonElement).dataset.m).toBe("marge");
  });

  it("appelle onChange avec la bonne clé au clic et déplace l'actif", () => {
    const container = document.createElement("div");
    const onChange = vi.fn();
    renderMetricSwitcher(container, metrics, "ca", onChange);
    const buttons = Array.from(
      container.querySelectorAll<HTMLButtonElement>(".seg-ctrl button"),
    );
    const ecart = buttons.find((b) => b.dataset.m === "ecart")!;
    ecart.click();
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("ecart");
    expect(ecart.classList.contains("on")).toBe(true);
    expect(ecart.getAttribute("aria-pressed")).toBe("true");
    expect(
      container.querySelectorAll(".seg-ctrl button.on").length,
    ).toBe(1);
  });
});
