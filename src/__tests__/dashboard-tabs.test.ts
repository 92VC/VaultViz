// Onglets internes au dashboard + raccourcis KPI (drill-through).
//
// - tab-bar : composant barre d'onglets (rendu, actif, clic → onSelect).
// - kpi-card : onClick optionnel (carte cliquable).
// - view-mounter : un kpi avec options.navigateTo émet un événement DOM
//   `vv-navigate` au clic (découplage de la logique d'onglets).
// - dashboard : spec.tabs → barre d'onglets ; vues groupées par options.tab ;
//   bandeau KPI persistant ; clic onglet / vv-navigate → bascule de panneau.

import { describe, it, expect, vi } from "vitest";
import { tableFromArrays, tableToIPC } from "apache-arrow";

vi.mock("@tauri-apps/api/core", () => ({
  invoke: vi.fn(async () => {
    const t = tableFromArrays({ nom: ["A"], v: new Float64Array([1]) });
    return tableToIPC(t, "stream").buffer;
  }),
}));

import { renderTabBar } from "../components/tab-bar";
import { renderKpiCard } from "../components/kpi-card";
import { renderGroupedBars } from "../components/grouped-bars";
import { mountDashboard } from "../shell/dashboard";
import { mountCompiledView } from "../viz-engine/view-mounter";
import { createRuntime } from "../viz-engine/mosaic-runtime";
import type { CompiledView } from "../viz-engine/view-compiler";
import type { DuckConnector } from "../viz-engine/duck-connector";

function stubConn(): DuckConnector {
  return {
    query: vi.fn(async () => ({ numRows: 1, get: () => ({ k: "A", v: 5, v1: 5, v2: 3 }) })),
  } as unknown as DuckConnector;
}

const TABS = [
  { id: "synthese", label: "Synthèse" },
  { id: "manquants", label: "Manquants" },
];

function kpi(id: string, opts: Record<string, unknown>): CompiledView {
  return { kind: "kpi", id, source: "s", title: id, sql: 'SELECT 1 AS v', options: { region: "kpi", ...opts } } as CompiledView;
}
function ranked(id: string, opts: Record<string, unknown>): CompiledView {
  return {
    kind: "ranked_bars", id, source: "s", title: id,
    sql: 'SELECT "k" AS k, SUM("v") AS v FROM "s" GROUP BY "k" ORDER BY v DESC',
    kField: "k", sort: "DESC", options: { region: "main", ...opts },
  } as CompiledView;
}

describe("tab-bar", () => {
  it("rend un bouton par onglet et marque l'actif", () => {
    const c = document.createElement("div");
    renderTabBar(c, TABS, { active: "manquants", onSelect: () => {} });
    const btns = c.querySelectorAll<HTMLElement>(".tab");
    expect(btns).toHaveLength(2);
    expect(btns[1].dataset.active).toBe("true");
  });

  it("clic onglet → onSelect(id)", () => {
    const c = document.createElement("div");
    const picked: string[] = [];
    renderTabBar(c, TABS, { active: "synthese", onSelect: (id) => picked.push(id) });
    c.querySelectorAll<HTMLElement>(".tab")[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(picked).toEqual(["manquants"]);
  });
});

describe("kpi-card — onClick", () => {
  it("avec onClick : carte cliquable (curseur pointer) et clic déclenche", () => {
    const c = document.createElement("div");
    let n = 0;
    renderKpiCard(c, { title: "T", value: 1, onClick: () => { n++; } });
    const card = c.querySelector<HTMLElement>(".card.kpi")!;
    expect(card.style.cursor).toBe("pointer");
    card.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(n).toBe(1);
  });

  it("avec onClick : la carte porte la classe `nav` (indicateur visuel CTA)", () => {
    const c = document.createElement("div");
    renderKpiCard(c, { title: "T", value: 1, onClick: () => {} });
    expect(c.querySelector(".card.kpi")!.classList.contains("nav")).toBe(true);
  });

  it("sans onClick : pas de classe `nav`", () => {
    const c = document.createElement("div");
    renderKpiCard(c, { title: "T", value: 1 });
    expect(c.querySelector(".card.kpi")!.classList.contains("nav")).toBe(false);
  });
});

describe("grouped-bars — tooltip custom au survol", () => {
  it("survol d'une barre affiche un tooltip avec la valeur formatée", () => {
    const c = document.createElement("div");
    renderGroupedBars(c, [{ k: "2025", v1: 1597, v2: 3933 }], {
      seriesLabels: ["Acquisitions", "Sorties"],
      format: "number",
    });
    const bar = c.querySelector<HTMLElement>(".qbar.budget")!;
    bar.dispatchEvent(new MouseEvent("mouseenter", { bubbles: true }));
    const tip = c.querySelector<HTMLElement>(".vv-tooltip")!;
    expect(tip).not.toBeNull();
    expect(tip.hidden).toBe(false);
    expect(tip.textContent).toContain("Acquisitions");
    expect(tip.textContent!.replace(/\s/g, "")).toContain("1597");
    bar.dispatchEvent(new MouseEvent("mouseleave", { bubbles: true }));
    expect(tip.hidden).toBe(true);
  });
});

describe("view-mounter — kpi navigateTo émet vv-navigate", () => {
  it("clic sur une carte KPI avec navigateTo émet l'événement vv-navigate", async () => {
    const c = document.createElement("div");
    let target: string | null = null;
    c.addEventListener("vv-navigate", (e) => { target = (e as CustomEvent).detail.tab; });
    await mountCompiledView(kpi("kpi_m", { navigateTo: "manquants" }), c, createRuntime(), stubConn());
    c.querySelector<HTMLElement>(".card.kpi")!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(target).toBe("manquants");
  });
});

describe("mountDashboard — onglets internes", () => {
  it("rend la barre d'onglets quand spec.tabs fourni", async () => {
    const c = document.createElement("div");
    await mountDashboard(
      c,
      [kpi("k", {}), ranked("r1", { tab: "synthese" }), ranked("r2", { tab: "manquants" })],
      createRuntime(), stubConn(), { tabs: TABS },
    );
    expect(c.querySelector(".tab-bar")).not.toBeNull();
    expect(c.querySelectorAll(".tab")).toHaveLength(2);
  });

  it("le bandeau KPI est visible quel que soit l'onglet (persistant)", async () => {
    const c = document.createElement("div");
    await mountDashboard(
      c, [kpi("k", {}), ranked("r1", { tab: "synthese" })],
      createRuntime(), stubConn(), { tabs: TABS },
    );
    expect(c.querySelector('.kpis [data-view-id="k"]')).not.toBeNull();
  });

  it("seules les vues de l'onglet actif (1er) sont visibles", async () => {
    const c = document.createElement("div");
    await mountDashboard(
      c, [ranked("r1", { tab: "synthese" }), ranked("r2", { tab: "manquants" })],
      createRuntime(), stubConn(), { tabs: TABS },
    );
    const panelSyn = c.querySelector<HTMLElement>('.tab-panel[data-tab="synthese"]')!;
    const panelManq = c.querySelector<HTMLElement>('.tab-panel[data-tab="manquants"]')!;
    expect(panelSyn.hidden).toBe(false);
    expect(panelManq.hidden).toBe(true);
  });

  it("clic onglet bascule le panneau visible", async () => {
    const c = document.createElement("div");
    await mountDashboard(
      c, [ranked("r1", { tab: "synthese" }), ranked("r2", { tab: "manquants" })],
      createRuntime(), stubConn(), { tabs: TABS },
    );
    c.querySelectorAll<HTMLElement>(".tab")[1].dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(c.querySelector<HTMLElement>('.tab-panel[data-tab="manquants"]')!.hidden).toBe(false);
    expect(c.querySelector<HTMLElement>('.tab-panel[data-tab="synthese"]')!.hidden).toBe(true);
  });

  it("événement vv-navigate (raccourci KPI) bascule sur l'onglet ciblé", async () => {
    const c = document.createElement("div");
    await mountDashboard(
      c, [kpi("k", { navigateTo: "manquants" }), ranked("r1", { tab: "synthese" }), ranked("r2", { tab: "manquants" })],
      createRuntime(), stubConn(), { tabs: TABS },
    );
    c.querySelector<HTMLElement>('.kpis [data-view-id="k"] .card.kpi')!
      .dispatchEvent(new MouseEvent("click", { bubbles: true }));
    expect(c.querySelector<HTMLElement>('.tab-panel[data-tab="manquants"]')!.hidden).toBe(false);
  });

  it("sans spec.tabs : comportement inchangé (pas de barre d'onglets)", async () => {
    const c = document.createElement("div");
    await mountDashboard(c, [kpi("k", {}), ranked("r1", {})], createRuntime(), stubConn());
    expect(c.querySelector(".tab-bar")).toBeNull();
    expect(c.querySelector(".dash-grid")).not.toBeNull();
  });
});
