// Tests T3.3 (SP3) — barres classées horizontales (happy-dom).

import { describe, expect, it } from "vitest";

import { renderRankedBars } from "../components/ranked-bars";

const ROWS = [
  { k: "Cardiologie", v: 1_200_000 },
  { k: "Pédiatrie", v: 800_000 },
  { k: "Radiologie", v: 300_000 },
];

describe("ranked-bars (T3.3)", () => {
  it("rend une .bar-row par row", () => {
    const c = document.createElement("div");
    renderRankedBars(c, ROWS);
    expect(c.querySelectorAll(".bar-row")).toHaveLength(ROWS.length);
  });

  it("la barre de la plus grande valeur fait 100%", () => {
    const c = document.createElement("div");
    renderRankedBars(c, ROWS);
    const fills = c.querySelectorAll<HTMLElement>(".bar-fill");
    expect(fills[0].style.width).toBe("100.0%");
    // Les barres suivantes sont proportionnellement plus courtes.
    expect(fills[1].style.width).toBe("66.7%");
  });

  it("affiche la valeur formatée par défaut (.b-val)", () => {
    const c = document.createElement("div");
    renderRankedBars(c, ROWS, { format: "eur" });
    const vals = c.querySelectorAll(".b-val");
    expect(vals).toHaveLength(ROWS.length);
    expect(vals[0].textContent).toBe("1,2 M€");
  });

  it("valueLabels:false masque .b-val", () => {
    const c = document.createElement("div");
    renderRankedBars(c, ROWS, { valueLabels: false });
    expect(c.querySelectorAll(".b-val")).toHaveLength(0);
    // Les barres restent rendues.
    expect(c.querySelectorAll(".bar-row")).toHaveLength(ROWS.length);
  });

  it("chaque label porte une pastille .sw et le texte k", () => {
    const c = document.createElement("div");
    renderRankedBars(c, ROWS);
    const lab = c.querySelector<HTMLElement>(".bar-row .b-lab");
    expect(lab?.querySelector(".sw")).not.toBeNull();
    expect(lab?.textContent).toContain("Cardiologie");
  });

  it("est idempotent (re-render ne cumule pas)", () => {
    const c = document.createElement("div");
    renderRankedBars(c, ROWS);
    renderRankedBars(c, ROWS.slice(0, 2));
    expect(c.querySelectorAll(".bar-row")).toHaveLength(2);
  });

  it("rend un titre optionnel", () => {
    const c = document.createElement("div");
    renderRankedBars(c, ROWS, { title: "Top spécialités" });
    expect(c.querySelector(".rb-title")?.textContent).toBe("Top spécialités");
  });
});
