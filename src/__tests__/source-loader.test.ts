import { describe, it, expect, vi } from "vitest";

import {
  loadSources,
  dropDocViews,
  viewName,
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
// SP4 — namespacing par vues plates préfixées (doc_<id>__src)
// ---------------------------------------------------------------------------

describe("viewName", () => {
  it("retourne doc_<id>__<src> pour un docId valide", () => {
    expect(viewName("d1", "effectifs")).toBe("doc_d1__effectifs");
  });
  it("retourne <src> sans docId (rétro-compat)", () => {
    expect(viewName(undefined, "effectifs")).toBe("effectifs");
  });
  it("throw pour un docId invalide", () => {
    expect(() => viewName("bad-id", "s")).toThrow(/docId/i);
    expect(() => viewName("x".repeat(33), "s")).toThrow(/docId/i);
  });
});

describe("loadSources — SP4 docId", () => {
  it("crée des vues plates préfixées (pas de CREATE SCHEMA)", async () => {
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
    expect(sqls).toHaveLength(2);
    expect(sqls[0]).toBe(
      `CREATE OR REPLACE VIEW "doc_d1__effectifs" AS SELECT * FROM read_parquet('/home/x/sample.parquet')`,
    );
    expect(sqls[1]).toBe(
      `CREATE OR REPLACE VIEW "doc_d1__geo" AS SELECT * FROM read_parquet('/abs/geo.parquet')`,
    );
  });

  it("sans docId : vues non préfixées (rétro-compat)", async () => {
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

describe("dropDocViews", () => {
  it("exécute DROP VIEW IF EXISTS par source préfixée", async () => {
    const { conn, sqls } = fakeConn();
    await dropDocViews(conn, "d1", ["effectifs", "geo"]);
    expect(sqls).toEqual([
      `DROP VIEW IF EXISTS "doc_d1__effectifs"`,
      `DROP VIEW IF EXISTS "doc_d1__geo"`,
    ]);
  });

  it("throw pour un docId invalide", async () => {
    const { conn, sqls } = fakeConn();
    await expect(dropDocViews(conn, "bad-id", ["s"])).rejects.toThrow(/docId/i);
    expect(sqls).toHaveLength(0);
  });
});

describe("loadSources — timeout (anti-hang, UC-6)", () => {
  // Si une source ne répond pas (read_parquet bloqué, chemin inaccessible…),
  // l'indexation ne doit JAMAIS rester figée : timeout → erreur actionnable
  // mentionnant la source ET son chemin résolu.
  const hangConn = () =>
    ({ query: () => new Promise<never>(() => {}) }) as unknown as DuckConnector;

  it("rejette en mentionnant la source qui bloque", async () => {
    await expect(
      loadSources(
        hangConn(),
        doc([{ name: "assets", path: "./dli_assets.parquet" }]),
        "/data/DLI",
        undefined,
        40,
      ),
    ).rejects.toThrow(/assets/);
  });

  it("le message d'erreur contient le chemin résolu (diagnostic)", async () => {
    await expect(
      loadSources(
        hangConn(),
        doc([{ name: "assets", path: "./dli_assets.parquet" }]),
        "/data/DLI",
        undefined,
        40,
      ),
    ).rejects.toThrow(/\/data\/DLI\/dli_assets\.parquet/);
  });
});
