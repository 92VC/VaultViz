// Tests SP3 / T3.4 — composant barres appariées (deux séries).
//
// happy-dom : on vérifie la structure DOM émise (un .qgroup par row, deux
// .qbar par groupe), le calcul de hauteur (max → 100 %), et la présence
// des libellés de série dans la légende.

import { describe, expect, it } from "vitest";

import {
  renderGroupedBars,
  type GroupedRow,
} from "../components/grouped-bars";

const ROWS: GroupedRow[] = [
  { k: "T1", v1: 100, v2: 80 },
  { k: "T2", v1: 120, v2: 200 },
  { k: "T3", v1: 90, v2: 150 },
];

describe("grouped-bars (T3.4)", () => {
  it("rend un .qgroup par row", () => {
    const c = document.createElement("div");
    renderGroupedBars(c, ROWS);
    expect(c.querySelectorAll(".qgroup")).toHaveLength(ROWS.length);
  });

  it("rend deux .qbar par groupe (budget + realise)", () => {
    const c = document.createElement("div");
    renderGroupedBars(c, ROWS);
    c.querySelectorAll(".qgroup").forEach((g) => {
      expect(g.querySelectorAll(".qbar")).toHaveLength(2);
      expect(g.querySelectorAll(".qbar.budget")).toHaveLength(1);
      expect(g.querySelectorAll(".qbar.realise")).toHaveLength(1);
    });
  });

  it("attribue 100 % de hauteur à la plus grande valeur", () => {
    const c = document.createElement("div");
    renderGroupedBars(c, ROWS);
    // max global = 200 (T2.v2). La barre .realise du 2e groupe doit être à 100 %.
    const groups = c.querySelectorAll(".qgroup");
    const realiseT2 = groups[1].querySelector(
      ".qbar.realise",
    ) as HTMLElement;
    expect(realiseT2.style.height).toBe("100.0%");
    // Une valeur moitié → 50 %.
    const realiseT1 = groups[0].querySelector(
      ".qbar.realise",
    ) as HTMLElement;
    expect(realiseT1.style.height).toBe("40.0%"); // 80/200
  });

  it("affiche les labels de série fournis dans la légende", () => {
    const c = document.createElement("div");
    renderGroupedBars(c, ROWS, { seriesLabels: ["Budget", "Réalisé"] });
    expect(c.textContent).toContain("Budget");
    expect(c.textContent).toContain("Réalisé");
  });

  it("utilise les labels par défaut sinon", () => {
    const c = document.createElement("div");
    renderGroupedBars(c, ROWS);
    expect(c.textContent).toContain("Série 1");
    expect(c.textContent).toContain("Série 2");
  });

  it("met une valeur formatée dans le title des barres", () => {
    const c = document.createElement("div");
    renderGroupedBars(c, [{ k: "A", v1: 1234, v2: 5678 }], {
      format: "eur",
      seriesLabels: ["Budget", "Réalisé"],
    });
    const budget = c.querySelector(".qbar.budget") as HTMLElement;
    expect(budget.title).toContain("Budget");
    expect(budget.title).toMatch(/k€|€/);
  });

  it("est idempotent : un second appel remplace le contenu", () => {
    const c = document.createElement("div");
    renderGroupedBars(c, ROWS);
    renderGroupedBars(c, [{ k: "X", v1: 1, v2: 2 }]);
    expect(c.querySelectorAll(".qgroup")).toHaveLength(1);
  });

  it("ne divise pas par zéro si toutes les valeurs sont nulles", () => {
    const c = document.createElement("div");
    expect(() =>
      renderGroupedBars(c, [{ k: "Z", v1: 0, v2: 0 }]),
    ).not.toThrow();
    const bar = c.querySelector(".qbar") as HTMLElement;
    expect(bar.style.height).toBe("0.0%");
  });
});
