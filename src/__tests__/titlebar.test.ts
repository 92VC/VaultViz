import { describe, it, expect, vi } from "vitest";

import { mountTitlebar } from "../components/titlebar";

describe("mountTitlebar", () => {
  it("rend une .titlebar avec le brand et 3 boutons .win-btn", () => {
    const el = document.createElement("div");
    expect(() => mountTitlebar(el)).not.toThrow();

    const bar = el.querySelector(".titlebar");
    expect(bar).not.toBeNull();
    expect(bar!.hasAttribute("data-tauri-drag-region")).toBe(true);

    expect(el.querySelector(".brand")).not.toBeNull();
    expect(el.querySelector(".brand")!.textContent).toMatch(/VaultViz/);
    expect(el.querySelector(".brand .logo")).not.toBeNull();

    const winBtns = el.querySelectorAll(".win-btn");
    expect(winBtns.length).toBe(3);
    expect(el.querySelector(".win-btn.close")).not.toBeNull();
  });

  it("affiche un onglet placeholder par défaut", () => {
    const el = document.createElement("div");
    mountTitlebar(el);
    expect(el.querySelectorAll(".tab").length).toBe(1);
  });

  it("setTabs rend les onglets fournis", () => {
    const el = document.createElement("div");
    const h = mountTitlebar(el);
    h.setTabs([
      { id: "a", title: "Dashboard A", active: true },
      { id: "b", title: "Dashboard B", active: false },
    ]);
    const tabs = el.querySelectorAll(".tab");
    expect(tabs.length).toBe(2);
    expect(el.querySelector(".tab.active")).not.toBeNull();
    expect(el.textContent).toMatch(/Dashboard A/);
    expect(el.textContent).toMatch(/Dashboard B/);
  });

  it("le clic sur la croix d'un onglet déclenche onTabClose avec son id", () => {
    const el = document.createElement("div");
    const h = mountTitlebar(el);
    const onClose = vi.fn();
    h.onTabClose(onClose);
    h.setTabs([{ id: "x42", title: "Doc", active: true }]);

    const closeEl = el.querySelector<HTMLElement>('[data-tab-close="x42"]');
    expect(closeEl).not.toBeNull();
    closeEl!.click();
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledWith("x42");
  });

  it("le clic sur un onglet (hors croix) déclenche onTabSelect", () => {
    const el = document.createElement("div");
    const h = mountTitlebar(el);
    const onSelect = vi.fn();
    h.onTabSelect(onSelect);
    h.setTabs([{ id: "sel", title: "Doc", active: false }]);

    el.querySelector<HTMLElement>('.tab[data-tab-id="sel"] .t-name')!.click();
    expect(onSelect).toHaveBeenCalledWith("sel");
  });

  it("le clic sur le bouton + déclenche onNewTab", () => {
    const el = document.createElement("div");
    const h = mountTitlebar(el);
    const onNew = vi.fn();
    h.onNewTab(onNew);
    el.querySelector<HTMLButtonElement>(".tab-add")!.click();
    expect(onNew).toHaveBeenCalledTimes(1);
  });

  it("ne lève aucune exception au clic sur les contrôles fenêtre sans Tauri", () => {
    const el = document.createElement("div");
    mountTitlebar(el);
    expect(() => {
      el.querySelectorAll<HTMLButtonElement>(".win-btn").forEach((b) => b.click());
    }).not.toThrow();
  });
});
