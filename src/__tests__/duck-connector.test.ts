// Tests B-031 — DuckConnector ↔ Mosaic.
//
// On mocke `invoke("run_query")` pour qu'il renvoie un buffer Arrow IPC
// construit 100 % côté JS (mini-table `{x: [1,2,3]}`). Le connector doit :
// - renvoyer une `Table` Arrow pour type="arrow" (défaut)
// - renvoyer un tableau d'objets pour type="json"
// - renvoyer undefined pour type="exec"

import { describe, it, expect, vi } from "vitest";
import { tableFromArrays, tableToIPC } from "apache-arrow";

const fakeIPC = (() => {
  const t = tableFromArrays({ x: new Int32Array([1, 2, 3]) });
  return tableToIPC(t, "stream");
})();

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async (cmd: string) => {
    if (cmd === "run_query") return fakeIPC;
    throw new Error(`unknown command: ${cmd}`);
  }),
}));

// Import après le mock pour que `duck-connector` capte la version
// stubée d'`invoke`.
import { createDuckConnector } from "../viz-engine/duck-connector";

describe("DuckConnector (B-031)", () => {
  it("query type=arrow renvoie une Table Arrow", async () => {
    const conn = createDuckConnector();
    const result = await conn.query({ type: "arrow", sql: "SELECT 1" });
    // duck-typing : Table expose `numRows` et `schema`
    expect((result as { numRows: number }).numRows).toBe(3);
  });

  it("query par défaut (type non précisé) renvoie une Table Arrow", async () => {
    const conn = createDuckConnector();
    const result = await conn.query({ sql: "SELECT 1" });
    expect((result as { numRows: number }).numRows).toBe(3);
  });

  it("query type=json renvoie un tableau d'objets", async () => {
    const conn = createDuckConnector();
    const result = await conn.query({ type: "json", sql: "SELECT 1" });
    expect(Array.isArray(result)).toBe(true);
    expect((result as unknown[]).length).toBe(3);
  });

  it("query type=exec renvoie undefined", async () => {
    const conn = createDuckConnector();
    const result = await conn.query({
      type: "exec",
      sql: "INSTALL httpfs",
    });
    expect(result).toBeUndefined();
  });
});
