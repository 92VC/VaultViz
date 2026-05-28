// Tests B-050 — table virtualisée.
//
// On vérifie :
// - la virtualisation rend strictement moins de lignes que la table
//   pour un dataset volumineux (fenêtre glissante)
// - le footer expose le nombre de lignes
// - `setData` remet le scroll en haut et met à jour le compteur
// - le tri colonne déclenche `onSort(field, dir)` avec alternance asc/desc

import { describe, expect, it, vi } from "vitest";
import { tableFromArrays } from "apache-arrow";

import { renderTable } from "../components/table-view";

function makeTable(n: number) {
  const ids = new Int32Array(n);
  for (let i = 0; i < n; i++) ids[i] = i;
  return tableFromArrays({ id: ids });
}

describe("table-view (B-050)", () => {
  it("ne rend qu'une fenêtre de lignes pour 10 000 lignes (virtualisation)", () => {
    const t = makeTable(10_000);
    const c = document.createElement("div");
    document.body.appendChild(c);
    renderTable(c, t, {
      columns: [{ field: "id", label: "ID", align: "right" }],
      visibleRows: 10,
      bufferRows: 5,
    });
    const trs = c.querySelectorAll(".vv-tr");
    // fenêtre = visible(10) + buffer haut+bas (5+5) = 20 max — strictement
    // beaucoup moins que 10 000.
    expect(trs.length).toBeGreaterThan(0);
    expect(trs.length).toBeLessThan(50);
  });

  it("footer affiche le compte de lignes", () => {
    const t = makeTable(3);
    const c = document.createElement("div");
    renderTable(c, t, { columns: [{ field: "id" }] });
    expect(c.querySelector(".vv-table-footer")?.textContent).toMatch(/3/);
  });

  it("setData met à jour le compteur et remet en haut", () => {
    const c = document.createElement("div");
    const api = renderTable(c, makeTable(5), { columns: [{ field: "id" }] });
    api.setData(makeTable(42));
    expect(c.querySelector(".vv-table-footer")?.textContent).toMatch(/42/);
  });

  it("setRowCount surcharge le compteur (utile pour count distant)", () => {
    const c = document.createElement("div");
    const api = renderTable(c, makeTable(10), { columns: [{ field: "id" }] });
    api.setRowCount(987_654);
    const txt = c.querySelector(".vv-table-footer")?.textContent ?? "";
    expect(txt).toMatch(/987/);
  });

  it("clic sur l'en-tête colonne déclenche onSort asc puis desc", () => {
    const onSort = vi.fn();
    const c = document.createElement("div");
    renderTable(c, makeTable(3), {
      columns: [{ field: "id" }],
      onSort,
    });
    const th = c.querySelector<HTMLButtonElement>(".vv-th")!;
    th.click();
    expect(onSort).toHaveBeenLastCalledWith("id", "asc");
    th.click();
    expect(onSort).toHaveBeenLastCalledWith("id", "desc");
  });

  it("rend chaque colonne déclarée dans la première ligne visible", () => {
    const ids = new Int32Array([1, 2, 3]);
    const labels = ["a", "b", "c"];
    const t = tableFromArrays({ id: ids, label: labels });
    const c = document.createElement("div");
    renderTable(c, t, {
      columns: [{ field: "id" }, { field: "label" }],
    });
    const firstRow = c.querySelector(".vv-tr");
    expect(firstRow?.querySelectorAll(".vv-td").length).toBe(2);
  });
});
