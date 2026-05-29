import { describe, it, expect, vi, beforeEach } from "vitest";

import { mountToolbar } from "../components/toolbar";

beforeEach(() => {
  // Repart d'un thème connu pour stabiliser l'icône du bouton thème.
  document.documentElement.setAttribute("data-theme", "dark");
});

describe("mountToolbar", () => {
  it("rend les boutons d'action (ouvrir, exporter, thème, paramètres)", () => {
    const el = document.createElement("div");
    mountToolbar(el, { onOpen: () => {} });
    expect(el.querySelector('[data-action="open"]')).not.toBeNull();
    expect(el.querySelector('[data-action="export"]')).not.toBeNull();
    expect(el.querySelector('[data-action="theme"]')).not.toBeNull();
    expect(el.querySelector('[data-action="settings"]')).not.toBeNull();
    expect(el.querySelector('[data-action="open"]')?.textContent).toMatch(
      /ouvrir/i,
    );
  });

  it("appelle onOpen au clic sur Ouvrir", () => {
    const el = document.createElement("div");
    const onOpen = vi.fn();
    mountToolbar(el, { onOpen });
    el.querySelector<HTMLButtonElement>('[data-action="open"]')!.click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("appelle onExport au clic sur Exporter", () => {
    const el = document.createElement("div");
    const onExport = vi.fn();
    mountToolbar(el, { onOpen: () => {}, onExport });
    el.querySelector<HTMLButtonElement>('[data-action="export"]')!.click();
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it("ne plante pas au clic Exporter sans callback", () => {
    const el = document.createElement("div");
    mountToolbar(el, { onOpen: () => {} });
    expect(() =>
      el.querySelector<HTMLButtonElement>('[data-action="export"]')!.click(),
    ).not.toThrow();
  });

  it("setStatus('loading') pose data-s='loading' et le libellé", () => {
    const el = document.createElement("div");
    const h = mountToolbar(el, { onOpen: () => {} });
    h.setStatus("loading");
    const status = el.querySelector<HTMLElement>(".status")!;
    expect(status.dataset.s).toBe("loading");
    expect(status.querySelector(".s-txt")?.textContent).toBe("Chargement");
  });

  it("setStatus('error') pose data-s='error'", () => {
    const el = document.createElement("div");
    const h = mountToolbar(el, { onOpen: () => {} });
    h.setStatus("error");
    expect(el.querySelector<HTMLElement>(".status")!.dataset.s).toBe("error");
  });

  it("setStatusVisible(false) masque le badge de statut", () => {
    const el = document.createElement("div");
    const h = mountToolbar(el, { onOpen: () => {} });
    h.setStatusVisible(false);
    expect(el.querySelector<HTMLElement>(".status")!.style.visibility).toBe(
      "hidden",
    );
    h.setStatusVisible(true);
    expect(el.querySelector<HTMLElement>(".status")!.style.visibility).toBe(
      "visible",
    );
  });

  it("setPath rend les segments, dernier = fichier", () => {
    const el = document.createElement("div");
    const h = mountToolbar(el, { onOpen: () => {} });
    h.setPath(["share", "dashboards", "ventes.vviz"]);
    const segs = el.querySelectorAll(".path .seg");
    expect(segs.length).toBe(3);
    expect(segs[0].textContent).toBe("share");
    expect(segs[2].textContent).toBe("ventes.vviz");
    expect(segs[2].classList.contains("file")).toBe(true);
    expect(el.querySelectorAll(".path .sep").length).toBe(2);
  });

  it("setPath([]) masque le breadcrumb", () => {
    const el = document.createElement("div");
    const h = mountToolbar(el, { onOpen: () => {} });
    h.setPath(["a", "b"]);
    h.setPath([]);
    expect(el.querySelector<HTMLElement>(".path-wrap")!.style.display).toBe(
      "none",
    );
  });

  it("le bouton thème bascule le thème au clic", () => {
    const el = document.createElement("div");
    mountToolbar(el, { onOpen: () => {} });
    expect(document.documentElement.getAttribute("data-theme")).toBe("dark");
    el.querySelector<HTMLButtonElement>('[data-action="theme"]')!.click();
    expect(document.documentElement.getAttribute("data-theme")).toBe("light");
  });
});
