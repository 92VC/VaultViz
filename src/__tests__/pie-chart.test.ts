import { describe, it, expect } from "vitest";
import { renderPieChart } from "../components/pie-chart";

describe("pie-chart (rendu SVG maison)", () => {
  it("une part par tranche (>0) + légende avec %", () => {
    const c = document.createElement("div");
    renderPieChart(c, [{ label: "Rapprochés", value: 60 }, { label: "Manquants", value: 40 }], { format: "number" });
    expect(c.querySelector("svg.vv-pie-svg")).not.toBeNull();
    expect(c.querySelectorAll("path")).toHaveLength(2);
    expect(c.querySelectorAll(".pie-legend .legend-item")).toHaveLength(2);
  });
  it("donut : ajoute un cercle central", () => {
    const c = document.createElement("div");
    renderPieChart(c, [{ label: "A", value: 1 }, { label: "B", value: 1 }], { donut: 0.6 });
    expect(c.querySelector("circle")).not.toBeNull();
  });
});
