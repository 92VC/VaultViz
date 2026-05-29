import { describe, it, expect, vi } from "vitest";

import {
  loadSources,
  dropDocSchema,
  schemaName,
} from "../viz-engine/source-loader";
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

// ---------------------------------------------------------------------------
// SP4 — namespacing par schéma DuckDB
// ---------------------------------------------------------------------------

describe("schemaName", () => {
  it("retourne doc_<id> pour un docId valide", () => {
    expect(schemaName("d1")).toBe("doc_d1");
  });
  it("retourne '' sans docId (rétro-compat)", () => {
    expect(schemaName()).toBe("");
  });
  it("throw pour un docId invalide", () => {
    expect(() => schemaName("bad-id")).toThrow(/docId/i);
    expect(() => schemaName("x".repeat(33))).toThrow(/docId/i);
  });
});

describe("loadSources — SP4 docId", () => {
  it("crée le schéma puis les vues qualifiées", async () => {
    const { conn, sqls } = fakeConn();
    await loadSources(
      conn,
      doc([
        { name: "effectifs", path: "./sample.parquet" },
        { name: "geo", path: "/abs/geo.parquet" },
      ]),
      "/home/x",
      "d1",
    );
    expect(sqls).toHaveLength(3);
    expect(sqls[0]).toBe("CREATE SCHEMA IF NOT EXISTS doc_d1");
    expect(sqls[1]).toBe(
      `CREATE OR REPLACE VIEW doc_d1."effectifs" AS SELECT * FROM read_parquet('/home/x/sample.parquet')`,
    );
    expect(sqls[2]).toBe(
      `CREATE OR REPLACE VIEW doc_d1."geo" AS SELECT * FROM read_parquet('/abs/geo.parquet')`,
    );
  });

  it("sans docId : pas de CREATE SCHEMA, vues non qualifiées (rétro-compat)", async () => {
    const { conn, sqls } = fakeConn();
    await loadSources(
      conn,
      doc([{ name: "effectifs", path: "./sample.parquet" }]),
      "/home/x",
    );
    expect(sqls).toHaveLength(1);
    expect(sqls[0]).toBe(
      `CREATE OR REPLACE VIEW "effectifs" AS SELECT * FROM read_parquet('/home/x/sample.parquet')`,
    );
  });

  it("docId invalide : throw avant tout SQL", async () => {
    const { conn, sqls } = fakeConn();
    await expect(
      loadSources(
        conn,
        doc([{ name: "x", path: "/x.parquet" }]),
        "/home/x",
        "bad-id",
      ),
    ).rejects.toThrow(/docId/i);
    expect(sqls).toHaveLength(0);
  });
});

describe("dropDocSchema", () => {
  it("exécute DROP SCHEMA IF EXISTS ... CASCADE", async () => {
    const { conn, sqls } = fakeConn();
    await dropDocSchema(conn, "d1");
    expect(sqls).toEqual(["DROP SCHEMA IF EXISTS doc_d1 CASCADE"]);
  });

  it("throw pour un docId invalide", async () => {
    const { conn, sqls } = fakeConn();
    await expect(dropDocSchema(conn, "bad-id")).rejects.toThrow(/docId/i);
    expect(sqls).toHaveLength(0);
  });
});
