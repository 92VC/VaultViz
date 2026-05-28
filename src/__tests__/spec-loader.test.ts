// Tests B-061 — pipeline `loadVViz` (read + parse + Ajv).
//
// On mock `@tauri-apps/api/core` pour simuler la sortie de `read_vviz`
// (succès ou rejet typé). Le test "doc valide" utilise une spec calquée
// sur `examples/effectifs_2026.vviz` (B-033a/b) pour rester aligné avec
// la fixture canonique.

import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(),
}));

import { invoke } from "@tauri-apps/api/core";
import { loadVViz } from "../viz-engine/spec-loader";

const CANONICAL = {
  $schema: "https://vaultviz.fr/schema/v1.json",
  vviz: {
    version: "1.0",
    title: "Test doc",
  },
  data: {
    sources: [{ name: "effectifs", path: "./examples/sample.parquet" }],
  },
  spec: {
    engine: "mosaic",
    layout: "vstack",
    views: [
      {
        id: "t1",
        type: "table",
        source: "effectifs",
        encoding: { columns: ["id", "label", "value"] },
      },
    ],
  },
};

describe("loadVViz (B-061)", () => {
  beforeEach(() => {
    vi.mocked(invoke).mockReset();
  });

  it("returns Invalid + details list with instancePath when schema fails", async () => {
    const bad: any = JSON.parse(JSON.stringify(CANONICAL));
    delete bad.vviz.title;
    vi.mocked(invoke).mockResolvedValueOnce(JSON.stringify(bad));

    const r = await loadVViz("/p.vviz");
    expect(r.doc).toBeNull();
    expect(r.error?.kind).toBe("Invalid");
    expect(r.error?.path).toBe("/p.vviz");
    expect(r.error?.details?.length).toBeGreaterThan(0);
    // Au moins une violation doit mentionner `title` (champ manquant).
    expect(r.error?.details?.some((d) => d.toLowerCase().includes("title"))).toBe(true);
  });

  it("returns Corrupt on non-JSON content", async () => {
    vi.mocked(invoke).mockResolvedValueOnce("not json {{{");
    const r = await loadVViz("/p.vviz");
    expect(r.doc).toBeNull();
    expect(r.error?.kind).toBe("Corrupt");
    expect(r.error?.message).toMatch(/JSON/);
  });

  it("returns doc on a canonical-like document", async () => {
    vi.mocked(invoke).mockResolvedValueOnce(JSON.stringify(CANONICAL));
    const r = await loadVViz("/p.vviz");
    expect(r.error).toBeNull();
    expect(r.doc).not.toBeNull();
    expect(r.doc?.vviz.title).toBe("Test doc");
  });

  it("forwards Tauri NotFound payload to ErrorPayload", async () => {
    vi.mocked(invoke).mockRejectedValueOnce({
      kind: "NotFound",
      message: "ENOENT",
    });
    const r = await loadVViz("/missing.vviz");
    expect(r.doc).toBeNull();
    expect(r.error?.kind).toBe("NotFound");
    expect(r.error?.message).toBe("ENOENT");
  });

  it("forwards Tauri Forbidden payload", async () => {
    vi.mocked(invoke).mockRejectedValueOnce({
      kind: "Forbidden",
      message: "EACCES",
    });
    const r = await loadVViz("/locked.vviz");
    expect(r.error?.kind).toBe("Forbidden");
  });

  it("falls back to Io on unknown rejection shape", async () => {
    vi.mocked(invoke).mockRejectedValueOnce("oops");
    const r = await loadVViz("/x.vviz");
    expect(r.error?.kind).toBe("Io");
  });

  it("Invalid details include the instancePath (e.g. /data/sources)", async () => {
    const bad: any = JSON.parse(JSON.stringify(CANONICAL));
    bad.data.sources = [];
    vi.mocked(invoke).mockResolvedValueOnce(JSON.stringify(bad));
    const r = await loadVViz("/p.vviz");
    expect(r.error?.kind).toBe("Invalid");
    expect(
      r.error?.details?.some((d) => d.includes("/data/sources")),
    ).toBe(true);
  });
});
