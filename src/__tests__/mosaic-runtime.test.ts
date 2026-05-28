// Tests B-040 — runtime Mosaic (Selection/Param registry + map binding).
//
// On vérifie le contrat structurel exposé par mosaic-runtime.ts :
// - idempotence des Selection/Param/source par nom
// - le binding map produit bien une clause point avec predicate non nul
//   au premier clic, et une clause à predicate null au second clic
//   (désélection), via les helpers publics de mosaic-core.

import { describe, expect, it } from "vitest";
import { isSelection } from "@uwdata/mosaic-core";

import {
  bindMapSelection,
  createRuntime,
  ensureClauseSource,
  ensureParam,
  ensureSelection,
} from "../viz-engine/mosaic-runtime";
import { renderChoropleth } from "../components/map-view";

describe("mosaic-runtime — registre (B-040)", () => {
  it("ensureSelection est idempotent par nom et retourne une Selection", () => {
    const ctx = createRuntime();
    const a = ensureSelection(ctx, "dept_select");
    const b = ensureSelection(ctx, "dept_select");
    expect(a).toBe(b);
    expect(isSelection(a)).toBe(true);
  });

  it("ensureSelection respecte le `kind` à la création (single vs crossfilter)", () => {
    const ctx = createRuntime();
    const a = ensureSelection(ctx, "s1", "single");
    const b = ensureSelection(ctx, "s2", "crossfilter");
    // Les deux sont des Selection ; on ne réinspecte pas le resolver
    // privé, mais on s'assure qu'on a bien créé deux instances distinctes.
    expect(a).not.toBe(b);
  });

  it("ensureParam est idempotent par nom (ignore init aux appels suivants)", () => {
    const ctx = createRuntime();
    const a = ensureParam(ctx, "p1", 0);
    const b = ensureParam(ctx, "p1", 999);
    expect(a).toBe(b);
    expect(a.value).toBe(0);
  });

  it("ensureClauseSource produit une identité stable par nom", () => {
    const ctx = createRuntime();
    const a = ensureClauseSource(ctx, "map:dept_select");
    const b = ensureClauseSource(ctx, "map:dept_select");
    expect(a).toBe(b);
  });
});

describe("mosaic-runtime — bindMapSelection (B-040)", () => {
  it("le 1er clic émet une clause active (predicate non null), stroke épaissi", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const data = new Map<string, number>([["75", 100], ["92", 200]]);
    const svg = renderChoropleth(container, data);
    const ctx = createRuntime();
    bindMapSelection(svg, ctx, {
      field: "code_dept",
      selectionName: "dept_select",
    });

    const p75 = container.querySelector<SVGPathElement>(
      'path[data-dept="75"]',
    );
    expect(p75).not.toBeNull();
    p75!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(p75!.style.strokeWidth).toBe("2.5");

    const sel = ctx.selections.get("dept_select")!;
    // Une clause active est présente, avec predicate non null (clause point).
    expect(sel.active).toBeTruthy();
    expect(sel.active.predicate).not.toBeNull();
    expect(sel.active.value).toBe("75");
  });

  it("le 2e clic sur le même département vide la sélection (predicate null)", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const data = new Map<string, number>([["75", 100]]);
    const svg = renderChoropleth(container, data);
    const ctx = createRuntime();
    bindMapSelection(svg, ctx, {
      field: "code_dept",
      selectionName: "dept_select",
    });

    const p75 = container.querySelector<SVGPathElement>(
      'path[data-dept="75"]',
    );
    p75!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    p75!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(p75!.style.strokeWidth).toBe("0.5");

    const sel = ctx.selections.get("dept_select")!;
    // active.predicate = null ; la sélection ne porte plus de clause filtrante.
    // Selon le resolver `single`, clauses est vide après désélection.
    expect(sel.clauses.length).toBe(0);
  });

  it("le clic sur un autre département remplace la clause (resolver single)", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const data = new Map<string, number>([["75", 100], ["92", 200]]);
    const svg = renderChoropleth(container, data);
    const ctx = createRuntime();
    bindMapSelection(svg, ctx, {
      field: "code_dept",
      selectionName: "dept_select",
    });

    const p75 = container.querySelector<SVGPathElement>(
      'path[data-dept="75"]',
    );
    const p92 = container.querySelector<SVGPathElement>(
      'path[data-dept="92"]',
    );
    p75!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    p92!.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(p75!.style.strokeWidth).toBe("0.5");
    expect(p92!.style.strokeWidth).toBe("2.5");

    const sel = ctx.selections.get("dept_select")!;
    expect(sel.active.value).toBe("92");
    expect(sel.clauses.length).toBe(1);
  });

  it("unbind() retire les listeners (plus aucune émission)", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const data = new Map<string, number>([["75", 100]]);
    const svg = renderChoropleth(container, data);
    const ctx = createRuntime();
    const unbind = bindMapSelection(svg, ctx, {
      field: "code_dept",
      selectionName: "dept_select",
    });
    unbind();
    const p75 = container.querySelector<SVGPathElement>(
      'path[data-dept="75"]',
    );
    p75!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const sel = ctx.selections.get("dept_select")!;
    expect(sel.clauses.length).toBe(0);
  });
});
