// Tests T3.1 (SP3) — composant carte KPI.
//
// Environnement happy-dom : on rend dans un container détaché et on
// inspecte le markup produit (fidélité maquette + comportement delta).

import { describe, expect, it } from "vitest";

import { renderKpiCard } from "../components/kpi-card";

function render(data: Parameters<typeof renderKpiCard>[1]): HTMLElement {
  const c = document.createElement("div");
  renderKpiCard(c, data);
  return c;
}

describe("kpi-card (T3.1)", () => {
  it("rend `.k-val` avec la valeur formatée", () => {
    const c = render({ title: "CA réalisé", value: 1234567, format: "eur" });
    const val = c.querySelector(".k-val");
    expect(val).not.toBeNull();
    // eurC(1234567) → « 1,2 M€ »
    expect(val?.textContent).toBe("1,2 M€");
  });

  it("affiche le label (title)", () => {
    const c = render({ title: "Marge brute", value: 42 });
    expect(c.querySelector(".k-label")?.textContent).toBe("Marge brute");
  });

  it("delta > 0 → classe `up`", () => {
    const c = render({ title: "X", value: 10, delta: 3.2 });
    const d = c.querySelector(".delta");
    expect(d).not.toBeNull();
    expect(d?.classList.contains("up")).toBe(true);
    expect(d?.textContent).toContain("+3,2");
  });

  it("delta < 0 → classe `down`", () => {
    const c = render({ title: "X", value: 10, delta: -1.5 });
    const d = c.querySelector(".delta");
    expect(d?.classList.contains("down")).toBe(true);
    expect(d?.textContent).toContain("-1,5");
  });

  it("affiche le foot", () => {
    const c = render({ title: "X", value: 10, foot: "vs 2024" });
    expect(c.querySelector(".k-foot")?.textContent).toContain("vs 2024");
  });

  it("pas de delta → pas de `.delta`", () => {
    const c = render({ title: "X", value: 10, foot: "à l'objectif" });
    expect(c.querySelector(".delta")).toBeNull();
  });

  it("rend l'icône dans `.k-ico` quand fournie", () => {
    const c = render({ title: "X", value: 10, icon: "euro" });
    expect(c.querySelector(".k-ico svg")).not.toBeNull();
  });

  it("idempotent : un seul `.card.kpi` après double rendu", () => {
    const c = document.createElement("div");
    renderKpiCard(c, { title: "X", value: 1 });
    renderKpiCard(c, { title: "Y", value: 2 });
    expect(c.querySelectorAll(".card.kpi").length).toBe(1);
    expect(c.querySelector(".k-label")?.textContent).toBe("Y");
  });
});
