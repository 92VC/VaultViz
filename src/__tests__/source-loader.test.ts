import { describe, it, expect, vi } from "vitest";

import { loadSources } from "../viz-engine/source-loader";
import type { DuckConnector } from "../viz-engine/duck-connector";
import type { VVizDocument } from "../viz-engine/types";

function fakeConn(): { conn: DuckConnector; sqls: string[] } {
  const sqls: string[] = [];
  return {
    sqls,
    conn: {
      query: vi.fn(async (q) => {
        sqls.push(q.sql);
        return undefined;
      }),
    } as unknown as DuckConnector,
  };
}

function doc(sources: { name: string; path: string }[]): VVizDocument {
  return {
    vviz: { version: "1.0", title: "T" },
    data: { sources },
    spec: { engine: "mosaic", views: [] },
  };
}

describe("loadSources", () => {
  it("CREATE VIEW pour chaque source avec chemin résolu", async () => {
    const { conn, sqls } = fakeConn();
    await loadSources(
      conn,
      doc([
        { name: "effectifs", path: "./sample.parquet" },
        { name: "geo", path: "/abs/geo.parquet" },
      ]),
      "/home/x",
    );
    expect(sqls).toHaveLength(2);
    expect(sqls[0]).toBe(
      `CREATE OR REPLACE VIEW "effectifs" AS SELECT * FROM read_parquet('/home/x/sample.parquet')`,
    );
    expect(sqls[1]).toBe(
      `CREATE OR REPLACE VIEW "geo" AS SELECT * FROM read_parquet('/abs/geo.parquet')`,
    );
  });

  it("préserve un chemin UNC tel quel", async () => {
    const { conn, sqls } = fakeConn();
    await loadSources(
      conn,
      doc([{ name: "x", path: "//host/share/data.parquet" }]),
      "/home/x",
    );
    expect(sqls[0]).toContain("'//host/share/data.parquet'");
  });

  it("échappe les apostrophes dans le path", async () => {
    const { conn, sqls } = fakeConn();
    await loadSources(
      conn,
      doc([{ name: "x", path: "/it's/weird.parquet" }]),
      "/home/x",
    );
    expect(sqls[0]).toContain("/it''s/weird.parquet");
  });

  it("refuse un nom de source qui ne match pas le pattern SQL", async () => {
    const { conn } = fakeConn();
    await expect(
      loadSources(conn, doc([{ name: "1bad", path: "/x.parquet" }]), "/home/x"),
    ).rejects.toThrow(/nom de source/i);
  });

  it("refuse un nom avec espaces ou caractères spéciaux", async () => {
    const { conn } = fakeConn();
    await expect(
      loadSources(conn, doc([{ name: "my source", path: "/x.parquet" }]), "/home/x"),
    ).rejects.toThrow(/nom de source/i);
  });
});
