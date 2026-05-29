// Extension cross-filter — émission de sélection par les barres classées.
//
// Aujourd'hui seule la carte (`bindMapSelection`) émet une `vg.Selection`.
// Ces tests spécifient l'extension : un `ranked_bars` portant `options.emitsTo`
// devient ÉMETTEUR — un clic sur une barre pousse une clause point dans la
// Selection cible (toggle single), exactement comme la carte. Les vues
// consommatrices (`filterBy`) se re-filtrent alors par push-down DuckDB.

import { describe, it, expect, vi } from "vitest";

import { renderRankedBars } from "../components/ranked-bars";
import { createRuntime, createPointEmitter } from "../viz-engine/mosaic-runtime";
import { compileView } from "../viz-engine/view-compiler";
import { mountCompiledView } from "../viz-engine/view-mounter";
import type { ViewSpec } from "../viz-engine/types";
import type { DuckConnector } from "../viz-engine/duck-connector";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => new ArrayBuffer(0)),
}));

function kvConn(rows: { k: string; v: number }[]): DuckConnector {
  return {
    query: vi.fn(async () => ({
      numRows: rows.length,
      get: (i: number) => rows[i] ?? null,
    })),
  } as unknown as DuckConnector;
}

describe("ranked-bars — émission de sélection (onSelect)", () => {
  it("un clic sur une barre invoque onSelect avec la clé de la barre", () => {
    const c = document.createElement("div");
    const picked: string[] = [];
    renderRankedBars(c, [{ k: "Bât A", v: 10 }, { k: "Bât B", v: 5 }], {
      onSelect: (k) => picked.push(k),
    });
    const rows = c.querySelectorAll<HTMLElement>(".bar-row");
    rows[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(picked).toEqual(["Bât B"]);
  });

  it("sans onSelect, une barre n'est pas cliquable (pas de curseur pointer)", () => {
    const c = document.createElement("div");
    renderRankedBars(c, [{ k: "Bât A", v: 10 }]);
    const row = c.querySelector<HTMLElement>(".bar-row")!;
    expect(row.style.cursor).not.toBe("pointer");
  });

  it("options.palette : chaque barre reçoit une couleur distincte du palette", () => {
    const c = document.createElement("div");
    renderRankedBars(c, [{ k: "A", v: 10 }, { k: "B", v: 8 }, { k: "C", v: 6 }], {
      palette: ["rgb(1, 2, 3)", "rgb(4, 5, 6)"],
    });
    const sw = Array.from(c.querySelectorAll<HTMLElement>(".b-lab .sw"));
    expect(sw[0].style.background).toBe("rgb(1, 2, 3)");
    expect(sw[1].style.background).toBe("rgb(4, 5, 6)");
    expect(sw[2].style.background).toBe("rgb(1, 2, 3)"); // cycle
  });
});

describe("mosaic-runtime — createPointEmitter", () => {
  it("le 1er emit pose une clause point active (value + predicate non null)", () => {
    const ctx = createRuntime();
    const emit = createPointEmitter(ctx, "bat_sel", "libelle");
    emit("Bât A");
    const sel = ctx.selections.get("bat_sel")!;
    expect(sel.active.value).toBe("Bât A");
    expect(sel.active.predicate).not.toBeNull();
  });

  it("re-emit de la même valeur vide la sélection (toggle off)", () => {
    const ctx = createRuntime();
    const emit = createPointEmitter(ctx, "bat_sel", "libelle");
    emit("Bât A");
    emit("Bât A");
    expect(ctx.selections.get("bat_sel")!.clauses.length).toBe(0);
  });

  it("emit d'une autre valeur remplace la clause (resolver single)", () => {
    const ctx = createRuntime();
    const emit = createPointEmitter(ctx, "bat_sel", "libelle");
    emit("Bât A");
    emit("Bât B");
    const sel = ctx.selections.get("bat_sel")!;
    expect(sel.active.value).toBe("Bât B");
    expect(sel.clauses.length).toBe(1);
  });
});

describe("compileView — ranked_bars émetteur (options.emitsTo)", () => {
  it("expose emitsSelection quand options.emitsTo est fourni", () => {
    const v: ViewSpec = {
      id: "b",
      type: "barX",
      source: "bat",
      encoding: { x: { field: "libelle" }, y: { field: "manquants", aggregate: "sum" } },
      options: { sort: "desc", valueLabels: true, filterField: "libelle", emitsTo: "bat_sel" },
    };
    const c = compileView(v);
    if (c.kind !== "ranked_bars") throw new Error("kind attendu : ranked_bars");
    expect(c.emitsSelection).toBe("bat_sel");
    expect(c.filterField).toBe("libelle");
  });
});

describe("mountCompiledView — ranked_bars émet au clic", () => {
  it("un clic sur une barre pousse une clause dans la Selection cible", async () => {
    const c = document.createElement("div");
    const ctx = createRuntime();
    await mountCompiledView(
      {
        kind: "ranked_bars",
        id: "b",
        source: "bat",
        sql: 'SELECT "libelle" AS k, sum("manquants") AS v FROM "bat" GROUP BY "libelle" ORDER BY v DESC',
        kField: "libelle",
        sort: "DESC",
        valueLabels: true,
        filterField: "libelle",
        emitsSelection: "bat_sel",
      },
      c,
      ctx,
      kvConn([{ k: "Bât A", v: 10 }, { k: "Bât B", v: 5 }]),
    );
    const rows = c.querySelectorAll<HTMLElement>(".bar-row");
    rows[0].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    const sel = ctx.selections.get("bat_sel")!;
    expect(sel.active.value).toBe("Bât A");
  });
});
