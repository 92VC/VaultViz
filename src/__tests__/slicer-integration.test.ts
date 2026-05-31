// B-251 — Tests d'intégration : slicers multi-valeurs + moteur
//
// Vérifie que mountCompiledView + updateSlicerState produisent le SQL
// attendu (push-down DuckDB). On inspecte conn.query.mock.calls pour
// s'assurer que le SQL envoyé à DuckDB porte les clauses correctes.
//
// NOTE : les vues `bar` (vgplot natif) ne passent pas par injectWhereAll
// — leur filtrage est géré par vg.from(source, {filterBy}) natif.
// La plomberie slicer→vgplot est hors scope (B-251 / CLAUDE.md §4.3).
// On teste donc kpi, ranked_bars, pie (qui ont tous view.sql + filterField).
//
// (b) scope='tab' : testé indirectement via buildSlicerClauses (isolé ci-
// dessous en test unitaire de la fonction utilitaire). La couche de test
// de dashboard.ts avec onglets actifs nécessiterait un mock DOM complet
// — documenté ici et hors scope du contrat TDD de cette story.

import { describe, it, expect, vi } from "vitest";
import { mountCompiledView, updateSlicerState } from "../viz-engine/view-mounter";
import { injectWhereAll } from "../viz-engine/where-builder";
import { createRuntime } from "../viz-engine/mosaic-runtime";
import type { DuckConnector } from "../viz-engine/duck-connector";
import type { SlicerSpec } from "../viz-engine/types";

// Mock Tauri invoke (utilisé par fetchTableRows uniquement).
vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => new ArrayBuffer(0)),
}));

function fakeConn(): DuckConnector & { query: ReturnType<typeof vi.fn> } {
  const query = vi.fn(async () => ({
    numRows: 0,
    get: () => null,
  }));
  return { query } as unknown as DuckConnector & { query: ReturnType<typeof vi.fn> };
}

// ────────────────────────────────────────────────────────────────────────────
// (a) slicer global → SQL des vues porte la clause IN / =
// ────────────────────────────────────────────────────────────────────────────
describe("slicer global — SQL porte la clause IN/=", () => {
  it("slicer mono-valeur sur kpi → WHERE field = 'v' dans SQL DuckDB", async () => {
    const ctx = createRuntime();
    const conn = fakeConn();
    const container = document.createElement("div");

    const slicers: SlicerSpec[] = [
      { id: "sl_gestion", field: "gestion", source: "effectifs", scope: "global" },
    ];

    // Active le slicer AVANT le montage (ou après via updateSlicerState).
    updateSlicerState(ctx, "sl_gestion", ["92"]);

    await mountCompiledView(
      {
        kind: "kpi",
        id: "k1",
        source: "effectifs",
        sql: `SELECT SUM("n") AS v FROM "effectifs"`,
        title: "Total",
      },
      container,
      ctx,
      conn,
      { slicers },
    );

    // Le SQL passé à conn.query doit porter WHERE "gestion" = '92'.
    const calls: string[] = conn.query.mock.calls.map(
      (c: unknown[]) => (c[0] as { sql: string }).sql,
    );
    expect(calls.some((s) => s.includes(`WHERE "gestion" = '92'`))).toBe(true);
  });

  it("slicer multi-valeurs sur ranked_bars → WHERE field IN (...)", async () => {
    const ctx = createRuntime();
    const conn = fakeConn();
    const container = document.createElement("div");

    const slicers: SlicerSpec[] = [
      { id: "sl_type", field: "type_contrat", source: "effectifs", scope: "global" },
    ];

    updateSlicerState(ctx, "sl_type", ["CDI", "CDD"]);

    await mountCompiledView(
      {
        kind: "ranked_bars",
        id: "rb1",
        source: "effectifs",
        sql: `SELECT "cat" AS k, COUNT(*) AS v FROM "effectifs" GROUP BY "cat" ORDER BY v DESC`,
        kField: "cat",
        sort: "DESC",
      },
      container,
      ctx,
      conn,
      { slicers },
    );

    const calls: string[] = conn.query.mock.calls.map(
      (c: unknown[]) => (c[0] as { sql: string }).sql,
    );
    expect(
      calls.some((s) => s.includes(`WHERE "type_contrat" IN ('CDI', 'CDD')`)),
    ).toBe(true);
  });

  it("2 vues sur même source → les deux portent la clause", async () => {
    const ctx = createRuntime();
    const conn = fakeConn();

    const slicers: SlicerSpec[] = [
      { id: "sl_dept", field: "dept", source: "s", scope: "global" },
    ];
    updateSlicerState(ctx, "sl_dept", ["92"]);

    // Vue 1 : kpi
    const c1 = document.createElement("div");
    await mountCompiledView(
      {
        kind: "kpi",
        id: "k1",
        source: "s",
        sql: `SELECT COUNT(*) AS v FROM "s"`,
        title: "KPI",
      },
      c1,
      ctx,
      conn,
      { slicers },
    );

    // Vue 2 : pie
    const c2 = document.createElement("div");
    await mountCompiledView(
      {
        kind: "pie",
        id: "p1",
        source: "s",
        sql: `SELECT "cat" AS k, COUNT(*) AS v FROM "s" GROUP BY "cat" ORDER BY v DESC`,
        kField: "cat",
      },
      c2,
      ctx,
      conn,
      { slicers },
    );

    const calls: string[] = conn.query.mock.calls.map(
      (c: unknown[]) => (c[0] as { sql: string }).sql,
    );
    const filtered = calls.filter((s) => s.includes(`WHERE "dept" = '92'`));
    expect(filtered.length).toBeGreaterThanOrEqual(2);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// (c) doc sans slicers → SQL identique (rétro-compat)
// ────────────────────────────────────────────────────────────────────────────
describe("rétro-compat — doc sans slicers", () => {
  it("pas de slicers → SQL inchangé (aucun WHERE injecté)", async () => {
    const ctx = createRuntime();
    const conn = fakeConn();
    const container = document.createElement("div");
    const originalSql = `SELECT SUM("n") AS v FROM "effectifs"`;

    await mountCompiledView(
      {
        kind: "kpi",
        id: "k1",
        source: "effectifs",
        sql: originalSql,
        title: "Total",
      },
      container,
      ctx,
      conn,
      // opts absent → pas de slicers
    );

    const calls: string[] = conn.query.mock.calls.map(
      (c: unknown[]) => (c[0] as { sql: string }).sql,
    );
    expect(calls.some((s) => s === originalSql)).toBe(true);
    expect(calls.every((s) => !s.includes("WHERE"))).toBe(true);
  });

  it("slicers déclarés mais tous inactifs (values=[]) → SQL inchangé", async () => {
    const ctx = createRuntime();
    const conn = fakeConn();
    const container = document.createElement("div");
    const originalSql = `SELECT COUNT(*) AS v FROM "s"`;

    const slicers: SlicerSpec[] = [
      { id: "sl_vide", field: "dept", source: "s", scope: "global" },
    ];
    // updateSlicerState non appelé → slicerState vide → clause ignorée

    await mountCompiledView(
      { kind: "kpi", id: "k1", source: "s", sql: originalSql, title: "T" },
      container,
      ctx,
      conn,
      { slicers },
    );

    const calls: string[] = conn.query.mock.calls.map(
      (c: unknown[]) => (c[0] as { sql: string }).sql,
    );
    expect(calls.some((s) => s === originalSql)).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// (b) scope='tab' — slicer filtré par l'onglet courant
// ────────────────────────────────────────────────────────────────────────────
describe("scope='tab' — filtre par onglet courant", () => {
  it("slicer scope='tab' + currentTab correspond → clause présente", async () => {
    const ctx = createRuntime();
    const conn = fakeConn();
    const container = document.createElement("div");

    const slicers: SlicerSpec[] = [
      { id: "sl_tab", field: "dept", source: "s", scope: "tab" },
    ];
    updateSlicerState(ctx, "sl_tab", ["92"]);

    // Vue déclarée dans l'onglet "t1", currentTab = "t1"
    await mountCompiledView(
      {
        kind: "kpi",
        id: "k1",
        source: "s",
        sql: `SELECT COUNT(*) AS v FROM "s"`,
        title: "T",
        options: { tab: "t1" },
      },
      container,
      ctx,
      conn,
      { slicers, currentTab: "t1" },
    );

    const calls: string[] = conn.query.mock.calls.map(
      (c: unknown[]) => (c[0] as { sql: string }).sql,
    );
    expect(calls.some((s) => s.includes(`WHERE "dept" = '92'`))).toBe(true);
  });

  it("slicer scope='tab' + currentTab différent → clause ABSENTE", async () => {
    const ctx = createRuntime();
    const conn = fakeConn();
    const container = document.createElement("div");

    const slicers: SlicerSpec[] = [
      { id: "sl_tab2", field: "dept", source: "s", scope: "tab" },
    ];
    updateSlicerState(ctx, "sl_tab2", ["92"]);

    // Vue dans onglet "t1", currentTab = "t2" → slicer ne s'applique pas
    await mountCompiledView(
      {
        kind: "kpi",
        id: "k1",
        source: "s",
        sql: `SELECT COUNT(*) AS v FROM "s"`,
        title: "T",
        options: { tab: "t1" },
      },
      container,
      ctx,
      conn,
      { slicers, currentTab: "t2" },
    );

    const calls: string[] = conn.query.mock.calls.map(
      (c: unknown[]) => (c[0] as { sql: string }).sql,
    );
    // Pas de WHERE (slicer non applicable à cet onglet)
    expect(calls.every((s) => !s.includes("WHERE"))).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// (d) slicer + sélection single coexistent en AND
// ────────────────────────────────────────────────────────────────────────────
describe("slicer + sélection single → clauses combinées en AND", () => {
  it("ranked_bars : après montage, updateSlicerState préserve la clause single", async () => {
    // Scenario :
    //   1. On monte la vue sans slicer actif, sans sélection.
    //   2. On émets une sélection single (via createPointEmitter).
    //   3. On active le slicer → render déclenché → le SQL doit avoir LES DEUX clauses.
    const { createPointEmitter } = await import("../viz-engine/mosaic-runtime");

    const ctx = createRuntime();
    const conn = fakeConn();
    const container = document.createElement("div");

    const slicers: SlicerSpec[] = [
      { id: "sl_type", field: "type", source: "s", scope: "global" },
    ];

    await mountCompiledView(
      {
        kind: "ranked_bars",
        id: "rb1",
        source: "s",
        sql: `SELECT "cat" AS k, COUNT(*) AS v FROM "s" GROUP BY "cat" ORDER BY v DESC`,
        kField: "cat",
        sort: "DESC",
        filterField: "region",
        filterBy: "sel_region",
      },
      container,
      ctx,
      conn,
      { slicers },
    );

    // 2. Émettre la sélection single "IDF" via createPointEmitter.
    const emit = createPointEmitter(ctx, "sel_region", "region");
    emit("IDF");
    // Attendre le re-render déclenché par onSelectionValue.
    await new Promise((r) => setTimeout(r, 20));

    {
      const calls: string[] = conn.query.mock.calls.map(
        (c: unknown[]) => (c[0] as { sql: string }).sql,
      );
      // Single active → WHERE "region" = 'IDF' (slicer inactif)
      expect(calls.some((s) => s.includes(`"region" = 'IDF'`))).toBe(true);
    }

    // 3. Activer le slicer → doit combiner les deux.
    conn.query.mockClear();
    updateSlicerState(ctx, "sl_type", ["CDI", "CDD"]);
    await new Promise((r) => setTimeout(r, 20));

    {
      const calls: string[] = conn.query.mock.calls.map(
        (c: unknown[]) => (c[0] as { sql: string }).sql,
      );
      // Les deux clauses doivent être présentes dans le même SQL.
      const combined = calls.find(
        (s) =>
          s.includes(`"type" IN ('CDI', 'CDD')`) && s.includes(`"region" = 'IDF'`),
      );
      expect(combined).toBeDefined();
      // Les deux combinées en AND
      expect(combined).toContain("AND");
    }
  });

  it("injectWhereAll combine directement 2 clauses en AND (test unitaire)", () => {
    // Valide le contrat de coexistence sans mock mounter.
    const sql = `SELECT "cat" AS k, COUNT(*) AS v FROM "s" GROUP BY "cat"`;
    const result = injectWhereAll(sql, "s", [
      { field: "type", values: ["CDI", "CDD"] },    // slicer
      { field: "region", values: ["IDF"] },           // single selection
    ]);
    expect(result).toBe(
      `SELECT "cat" AS k, COUNT(*) AS v FROM "s" WHERE "type" IN ('CDI', 'CDD') AND "region" = 'IDF' GROUP BY "cat"`,
    );
  });
});

// ────────────────────────────────────────────────────────────────────────────
// updateSlicerState — mise à jour d'état et notification
// ────────────────────────────────────────────────────────────────────────────
describe("updateSlicerState", () => {
  it("notifie les listeners enregistrés pour ce slicerId", () => {
    const ctx = createRuntime();
    ctx.slicerListeners = new Map();
    const cb = vi.fn();
    ctx.slicerListeners.set("sl1", new Set([cb]));

    updateSlicerState(ctx, "sl1", ["A", "B"]);

    expect(ctx.slicerState.get("sl1")).toEqual(["A", "B"]);
    expect(cb).toHaveBeenCalledOnce();
  });

  it("sans listeners → ne throw pas", () => {
    const ctx = createRuntime();
    expect(() => updateSlicerState(ctx, "sl_absent", ["X"])).not.toThrow();
    expect(ctx.slicerState.get("sl_absent")).toEqual(["X"]);
  });
});
