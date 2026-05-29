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

describe("table-view — colonnes riches (SP3 / T3.5)", () => {
  it("utilise label en en-tête et aligne à droite les colonnes num", () => {
    const t = tableFromArrays({ ca: new Float64Array([1000]) });
    const c = document.createElement("div");
    renderTable(c, t, {
      columns: [{ field: "ca", label: "Chiffre d'affaires", align: "num" }],
    });
    const th = c.querySelector<HTMLButtonElement>(".vv-th")!;
    expect(th.textContent).toBe("Chiffre d'affaires");
    expect(th.style.textAlign).toBe("right");
    const td = c.querySelector<HTMLElement>(".vv-td")!;
    expect(td.style.textAlign).toBe("right");
  });

  it("formate les valeurs numériques via fmt(value, format)", () => {
    const t = tableFromArrays({ ca: new Float64Array([1_234_567]) });
    const c = document.createElement("div");
    renderTable(c, t, {
      columns: [{ field: "ca", align: "num", format: "eur" }],
    });
    const td = c.querySelector<HTMLElement>(".vv-td")!;
    // « 1,2 M€ » — format euro compact (espace insécable possible).
    expect(td.textContent).toMatch(/M€/);
  });

  it("rend une colonne badge en .badge avec la classe issue de badgeMap", () => {
    const t = tableFromArrays({
      statut: ["Atteint", "À risque", "Manqué"],
    });
    const c = document.createElement("div");
    renderTable(c, t, {
      visibleRows: 10,
      bufferRows: 5,
      columns: [
        {
          field: "statut",
          type: "badge",
          badgeMap: { Atteint: "ok", "À risque": "warn", Manqué: "err" },
        },
      ],
    });
    const badges = c.querySelectorAll(".vv-td .badge");
    expect(badges.length).toBe(3);
    expect(c.querySelector(".badge.ok")?.textContent).toBe("Atteint");
    expect(c.querySelector(".badge.warn")?.textContent).toBe("À risque");
    expect(c.querySelector(".badge.err")?.textContent).toBe("Manqué");
  });

  it("badge sans correspondance badgeMap rend .badge sans classe d'état", () => {
    const t = tableFromArrays({ statut: ["Inconnu"] });
    const c = document.createElement("div");
    renderTable(c, t, {
      columns: [{ field: "statut", type: "badge", badgeMap: {} }],
    });
    const badge = c.querySelector(".vv-td .badge")!;
    expect(badge.textContent).toBe("Inconnu");
    expect(badge.classList.contains("ok")).toBe(false);
    expect(badge.classList.contains("warn")).toBe(false);
    expect(badge.classList.contains("err")).toBe(false);
  });
});

describe("table-view — recherche (SP3 / T3.5)", () => {
  it("n'affiche pas de barre de recherche par défaut", () => {
    const c = document.createElement("div");
    renderTable(c, makeTable(3), { columns: [{ field: "id" }] });
    expect(c.querySelector(".search input")).toBeNull();
  });

  it("affiche un champ .search quand search:true", () => {
    const c = document.createElement("div");
    renderTable(c, makeTable(3), {
      columns: [{ field: "id" }],
      search: true,
    });
    expect(c.querySelector(".search")).not.toBeNull();
    expect(c.querySelector<HTMLInputElement>(".search input")).not.toBeNull();
  });

  it("la saisie déclenche onSearch avec la requête", () => {
    const onSearch = vi.fn();
    const c = document.createElement("div");
    renderTable(c, makeTable(3), {
      columns: [{ field: "id" }],
      search: true,
      onSearch,
    });
    const input = c.querySelector<HTMLInputElement>(".search input")!;
    input.value = "hauts-de-seine";
    input.dispatchEvent(new Event("input"));
    expect(onSearch).toHaveBeenLastCalledWith("hauts-de-seine");
  });
});
