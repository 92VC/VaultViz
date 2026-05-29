// Tests T3.7 — graphes génériques line / area / dot via vgplot.
//
// Tests fumants — on n'exécute pas réellement la query DuckDB (pas de
// Tauri en happy-dom), mais on vérifie, comme pour bar-chart.test.ts :
// - le render ne throw pas et attache un nœud au container
// - chaque plotType (line / area / dot) est accepté
// - le filterSelectionName lié à une Selection existante est toléré
// - les agrégats / canal de série se construisent sans exception

import { beforeAll, describe, expect, it } from "vitest";

import { renderPlot, type PlotType } from "../components/plot-view";
import {
  createRuntime,
  ensureSelection,
} from "../viz-engine/mosaic-runtime";
import { installVgplotStubConnector } from "./_vgplot-stub";

const TYPES: PlotType[] = ["line", "area", "dot"];

describe("plot-view (T3.7)", () => {
  // Enregistre un connector stub sur le coordinator vgplot AVANT tout
  // rendu : empêche les rejets « Socket closed » des requêtes async
  // fire-and-forget de Mosaic en l'absence de Tauri. Cf. _vgplot-stub.ts.
  beforeAll(() => {
    installVgplotStubConnector();
  });

  for (const plotType of TYPES) {
    it(`rend un HTMLElement pour plotType=${plotType} sans filterBy`, () => {
      const c = document.createElement("div");
      const ctx = createRuntime();
      let out: HTMLElement | undefined;
      expect(() => {
        out = renderPlot(c, {
          source: "effectifs",
          plotType,
          xField: "mois",
          ctx,
        });
      }).not.toThrow();
      expect(out).toBeInstanceOf(HTMLElement);
      expect(c.children.length).toBeGreaterThanOrEqual(1);
    });
  }

  it("rend avec filterSelectionName lié à une Selection existante", () => {
    const c = document.createElement("div");
    const ctx = createRuntime();
    ensureSelection(ctx, "dept_select", "single");
    expect(() =>
      renderPlot(c, {
        source: "effectifs",
        plotType: "line",
        xField: "mois",
        filterSelectionName: "dept_select",
        ctx,
      }),
    ).not.toThrow();
    expect(c.children.length).toBeGreaterThanOrEqual(1);
  });

  it("accepte yAggregate=sum avec yField", () => {
    const c = document.createElement("div");
    const ctx = createRuntime();
    expect(() =>
      renderPlot(c, {
        source: "effectifs",
        plotType: "area",
        xField: "mois",
        yField: "value",
        yAggregate: "sum",
        ctx,
      }),
    ).not.toThrow();
  });

  it("accepte seriesField (canal de couleur) pour line et area", () => {
    const ctx = createRuntime();
    for (const plotType of ["line", "area", "dot"] as PlotType[]) {
      const c = document.createElement("div");
      expect(() =>
        renderPlot(c, {
          source: "effectifs",
          plotType,
          xField: "mois",
          seriesField: "code_dept",
          ctx,
        }),
      ).not.toThrow();
    }
  });

  it("throw si yAggregate=sum sans yField", () => {
    const c = document.createElement("div");
    const ctx = createRuntime();
    expect(() =>
      renderPlot(c, {
        source: "effectifs",
        plotType: "line",
        xField: "mois",
        yAggregate: "sum",
        ctx,
      }),
    ).toThrow(/yField/i);
  });

  it("throw sur agrégat non supporté", () => {
    const c = document.createElement("div");
    const ctx = createRuntime();
    expect(() =>
      renderPlot(c, {
        source: "x",
        plotType: "dot",
        xField: "k",
        yField: "v",
        yAggregate: "median",
        ctx,
      }),
    ).toThrow(/non supporté/i);
  });
});
