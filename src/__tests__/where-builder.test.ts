import { describe, it, expect } from "vitest";
import { injectWhereAll, type Clause } from "../viz-engine/where-builder";

describe("injectWhereAll", () => {
  it("aucune clause active → SQL inchangé", () => {
    const sql = `SELECT a, b FROM "s" GROUP BY a`;
    expect(injectWhereAll(sql, "s", [])).toBe(sql);
  });
  it("une clause mono-valeur → WHERE field = 'v' après FROM", () => {
    const sql = `SELECT a FROM "s" ORDER BY v`;
    const cl: Clause[] = [{ field: "dept", values: ["92"] }];
    expect(injectWhereAll(sql, "s", cl)).toBe(`SELECT a FROM "s" WHERE "dept" = '92' ORDER BY v`);
  });
  it("clause multi-valeurs → IN (...)", () => {
    const sql = `SELECT a FROM "s"`;
    const cl: Clause[] = [{ field: "g", values: ["43", "58"] }];
    expect(injectWhereAll(sql, "s", cl)).toBe(`SELECT a FROM "s" WHERE "g" IN ('43', '58')`);
  });
  it("N clauses combinées en AND", () => {
    const sql = `SELECT a FROM "s" GROUP BY a`;
    const cl: Clause[] = [{ field: "dept", values: ["92"] }, { field: "type", values: ["x", "y"] }];
    expect(injectWhereAll(sql, "s", cl)).toBe(`SELECT a FROM "s" WHERE "dept" = '92' AND "type" IN ('x', 'y') GROUP BY a`);
  });
  it("échappe les quotes (anti-injection)", () => {
    const cl: Clause[] = [{ field: "n", values: ["O'Brien"] }];
    expect(injectWhereAll(`SELECT 1 FROM "s"`, "s", cl)).toContain(`'O''Brien'`);
  });
  it("clause vide (values=[]) ignorée", () => {
    const cl: Clause[] = [{ field: "g", values: [] }];
    expect(injectWhereAll(`SELECT 1 FROM "s"`, "s", cl)).toBe(`SELECT 1 FROM "s"`);
  });
});
