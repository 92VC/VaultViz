import { describe, it, expect } from "vitest";
import { renderLineChart } from "../components/line-chart";

describe("line-chart (rendu SVG maison)", () => {
  it("une polyligne par série + un point par valeur + légende multi-séries", () => {
    const c = document.createElement("div");
    renderLineChart(
      c,
      [
        { label: "Acquisitions", points: [{ x: "2023", y: 1 }, { x: "2024", y: 3 }, { x: "2025", y: 2 }] },
        { label: "Sorties", points: [{ x: "2023", y: 2 }, { x: "2024", y: 1 }, { x: "2025", y: 4 }] },
      ],
      { format: "number" },
    );
    expect(c.querySelector("svg.vv-line-svg")).not.toBeNull();
    expect(c.querySelectorAll("polyline")).toHaveLength(2);
    expect(c.querySelectorAll("circle")).toHaveLength(6);
    expect(c.querySelectorAll(".legend-item")).toHaveLength(2);
  });

  it("série unique : 1 polyligne, pas de légende", () => {
    const c = document.createElement("div");
    renderLineChart(c, [{ label: "cumul", points: [{ x: "a", y: 1 }, { x: "b", y: 2 }] }]);
    expect(c.querySelectorAll("polyline")).toHaveLength(1);
    expect(c.querySelector(".legend")).toBeNull();
  });

  it("area : ajoute un polygone de remplissage", () => {
    const c = document.createElement("div");
    renderLineChart(c, [{ label: "x", points: [{ x: "a", y: 1 }, { x: "b", y: 2 }] }], { area: true });
    expect(c.querySelector("polygon")).not.toBeNull();
  });
});
