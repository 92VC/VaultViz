// Tests B-041 — bar chart vgplot avec filterBy.
//
// Tests fumants — on n'exécute pas réellement la query DuckDB (pas de
// Tauri en happy-dom), mais on vérifie :
// - le render ne throw pas et attache un nœud au container
// - la fonction tolère l'absence de filterSelectionName

import { beforeAll, describe, expect, it } from "vitest";

import { renderBarChart } from "../components/bar-chart";
import {
  createRuntime,
  ensureSelection,
} from "../viz-engine/mosaic-runtime";
import { installVgplotStubConnector } from "./_vgplot-stub";

describe("bar-chart (B-041)", () => {
  // Enregistre un connector stub sur le coordinator vgplot AVANT tout
  // rendu : empêche les rejets « Socket closed » des requêtes async
  // fire-and-forget de Mosaic en l'absence de Tauri. Cf. _vgplot-stub.ts.
  beforeAll(() => {
    installVgplotStubConnector();
  });

  it("rend un nœud dans le container sans filterBy", () => {
    const c = document.createElement("div");
    const ctx = createRuntime();
    expect(() =>
      renderBarChart(c, {
        source: "effectifs",
        xField: "code_dept",
        ctx,
      }),
    ).not.toThrow();
    expect(c.children.length).toBeGreaterThanOrEqual(1);
  });

  it("rend un nœud avec filterSelectionName lié à une Selection existante", () => {
    const c = document.createElement("div");
    const ctx = createRuntime();
    ensureSelection(ctx, "dept_select", "single");
    expect(() =>
      renderBarChart(c, {
        source: "effectifs",
        xField: "code_dept",
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
      renderBarChart(c, {
        source: "effectifs",
        xField: "code_dept",
        yField: "value",
        yAggregate: "sum",
        ctx,
      }),
    ).not.toThrow();
    expect(c.children.length).toBeGreaterThanOrEqual(1);
  });

  it("throw si yAggregate=sum sans yField", () => {
    const c = document.createElement("div");
    const ctx = createRuntime();
    expect(() =>
      renderBarChart(c, {
        source: "effectifs",
        xField: "code_dept",
        yAggregate: "sum",
        ctx,
      }),
    ).toThrow(/yField/i);
  });

  it("throw sur agrégat non supporté", () => {
    const c = document.createElement("div");
    const ctx = createRuntime();
    expect(() =>
      renderBarChart(c, {
        source: "x",
        xField: "k",
        yField: "v",
        yAggregate: "median",
        ctx,
      }),
    ).toThrow(/non supporté/i);
  });
});
