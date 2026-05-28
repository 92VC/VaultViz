// Tests B-050 — helpers drill-query.
//
// On valide la génération SQL et le subscribe à la Selection (sans
// dépendance Tauri).

import { describe, expect, it, vi } from "vitest";
import { clausePoint } from "@uwdata/mosaic-core";

import {
  buildDrillSql,
  fetchDrill,
  onSelectionValue,
  type DrillQueryOptions,
} from "../viz-engine/drill-query";
import {
  createRuntime,
  ensureClauseSource,
  ensureSelection,
} from "../viz-engine/mosaic-runtime";

describe("buildDrillSql (B-050)", () => {
  const base: DrillQueryOptions = {
    table: "effectifs",
    field: "code_dept",
    columns: ["code_dept", "id", "n"],
    defaultOrder: "id",
    limit: 100,
  };

  it("sans filtre : pas de WHERE, ORDER BY défaut", () => {
    const sql = buildDrillSql(base, null);
    expect(sql).toMatch(/SELECT "code_dept", "id", "n" FROM "effectifs"/);
    expect(sql).not.toMatch(/WHERE/);
    expect(sql).toMatch(/ORDER BY "id"/);
    expect(sql).toMatch(/LIMIT 100/);
  });

  it("avec filtre : WHERE field = 'value'", () => {
    const sql = buildDrillSql(base, "75");
    expect(sql).toMatch(/WHERE "code_dept" = '75'/);
  });

  it("échappe les single-quotes dans la valeur (anti-injection minimale)", () => {
    const sql = buildDrillSql(base, "O'Brien");
    expect(sql).toMatch(/WHERE "code_dept" = 'O''Brien'/);
  });

  it("orderBy explicite remplace le défaut", () => {
    const sql = buildDrillSql(
      { ...base, orderBy: { field: "n", dir: "desc" } },
      "92",
    );
    expect(sql).toMatch(/ORDER BY "n" DESC/);
  });

  it("rejette un identifiant invalide (anti-injection sur table/field)", () => {
    expect(() =>
      buildDrillSql({ ...base, table: "DROP TABLE x;" }, null),
    ).toThrow();
    expect(() =>
      buildDrillSql({ ...base, field: "a; --" }, null),
    ).toThrow();
  });
});

describe("fetchDrill (B-050)", () => {
  it("appelle conn.query avec le SQL généré et retourne la Table", async () => {
    const fakeTable = { numRows: 3 } as unknown as import("apache-arrow").Table;
    const conn = {
      query: vi.fn().mockResolvedValue(fakeTable),
    };
    const out = await fetchDrill(conn, {
      table: "effectifs",
      field: "code_dept",
      columns: ["id"],
      limit: 10,
    }, "75");
    expect(conn.query).toHaveBeenCalledTimes(1);
    const call = conn.query.mock.calls[0][0] as { sql: string; type: string };
    expect(call.type).toBe("arrow");
    expect(call.sql).toMatch(/WHERE "code_dept" = '75'/);
    expect(out).toBe(fakeTable);
  });

  it("retourne null sur erreur (et logge)", async () => {
    const conn = {
      query: vi.fn().mockRejectedValue(new Error("boom")),
    };
    const out = await fetchDrill(conn, {
      table: "effectifs",
      field: "code_dept",
      columns: ["id"],
    }, null);
    expect(out).toBeNull();
  });
});

describe("onSelectionValue (B-050)", () => {
  it("invoque le callback avec la nouvelle valeur quand la Selection émet", async () => {
    const ctx = createRuntime();
    const sel = ensureSelection(ctx, "dept_select", "single");
    const source = ensureClauseSource(ctx, "test");
    const cb = vi.fn();
    onSelectionValue(ctx, "dept_select", cb);
    sel.update(clausePoint("code_dept", "75", { source }));
    // AsyncDispatch émet sur la microtask suivante — on attend.
    await new Promise((r) => setTimeout(r, 0));
    expect(cb).toHaveBeenCalledWith("75");
  });

  it("retourne un unsubscribe ; après unbind, plus de callback", async () => {
    const ctx = createRuntime();
    const sel = ensureSelection(ctx, "s", "single");
    const source = ensureClauseSource(ctx, "src");
    const cb = vi.fn();
    const off = onSelectionValue(ctx, "s", cb);
    off();
    sel.update(clausePoint("f", "v", { source }));
    await new Promise((r) => setTimeout(r, 0));
    expect(cb).not.toHaveBeenCalled();
  });

  it("noop si la Selection nommée n'existe pas", () => {
    const ctx = createRuntime();
    expect(() => onSelectionValue(ctx, "missing", () => undefined)).not.toThrow();
  });
});
