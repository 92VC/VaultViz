// B-121 — Tests du bandeau de refresh non intrusif.
//
// Couvre les critères d'acceptation :
//   (a) bannière masquée au départ
//   (b) après show(), visible avec les 2 boutons
//   (c) clic « Recharger » → onReload appelé exactement 1×
//   (d) clic « Ignorer » → bannière masquée, onReload PAS appelé

import { describe, it, expect, vi } from "vitest";
import { mountRefreshBanner } from "../components/refresh-banner";

describe("refresh-banner", () => {
  it("(a) la bannière est masquée au départ", () => {
    const container = document.createElement("div");
    mountRefreshBanner(container, { onReload: vi.fn() });
    const banner = container.querySelector<HTMLElement>(".refresh-banner");
    expect(banner).not.toBeNull();
    expect(banner!.classList.contains("on")).toBe(false);
  });

  it("(b) après show(), la bannière est visible avec les 2 boutons", () => {
    const container = document.createElement("div");
    const handle = mountRefreshBanner(container, { onReload: vi.fn() });
    handle.show();
    const banner = container.querySelector<HTMLElement>(".refresh-banner");
    expect(banner!.classList.contains("on")).toBe(true);
    expect(container.querySelector(".vv-rb-reload")).not.toBeNull();
    expect(container.querySelector(".vv-rb-dismiss")).not.toBeNull();
  });

  it("(c) clic Recharger → onReload appelé exactement 1× et bannière masquée", () => {
    const container = document.createElement("div");
    const onReload = vi.fn();
    const handle = mountRefreshBanner(container, { onReload });
    handle.show();
    const btn = container.querySelector<HTMLButtonElement>(".vv-rb-reload");
    expect(btn).not.toBeNull();
    btn!.click();
    expect(onReload).toHaveBeenCalledTimes(1);
    // La bannière se masque aussi après le rechargement
    const banner = container.querySelector<HTMLElement>(".refresh-banner");
    expect(banner!.classList.contains("on")).toBe(false);
  });

  it("(d) clic Ignorer → bannière masquée, onReload PAS appelé", () => {
    const container = document.createElement("div");
    const onReload = vi.fn();
    const handle = mountRefreshBanner(container, { onReload });
    handle.show();
    const btn = container.querySelector<HTMLButtonElement>(".vv-rb-dismiss");
    expect(btn).not.toBeNull();
    btn!.click();
    expect(onReload).not.toHaveBeenCalled();
    const banner = container.querySelector<HTMLElement>(".refresh-banner");
    expect(banner!.classList.contains("on")).toBe(false);
  });

  it("contient le message attendu après show()", () => {
    const container = document.createElement("div");
    const handle = mountRefreshBanner(container, { onReload: vi.fn() });
    handle.show();
    const banner = container.querySelector<HTMLElement>(".refresh-banner");
    expect(banner!.textContent).toMatch(/données mises à jour/i);
  });

  it("porte role=status pour l'accessibilité", () => {
    const container = document.createElement("div");
    mountRefreshBanner(container, { onReload: vi.fn() });
    const banner = container.querySelector<HTMLElement>(".refresh-banner");
    expect(banner!.getAttribute("role")).toBe("status");
  });

  it("show() est rappelable : re-affiche la bannière après une session Ignorer", () => {
    const container = document.createElement("div");
    const handle = mountRefreshBanner(container, { onReload: vi.fn() });
    handle.show();
    // Ignorer masque
    container.querySelector<HTMLButtonElement>(".vv-rb-dismiss")!.click();
    const banner = container.querySelector<HTMLElement>(".refresh-banner");
    expect(banner!.classList.contains("on")).toBe(false);
    // Nouveau show() → re-visible
    handle.show();
    expect(banner!.classList.contains("on")).toBe(true);
  });
});
