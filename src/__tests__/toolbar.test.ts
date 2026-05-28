import { describe, it, expect, vi } from "vitest";

import { renderToolbar } from "../components/toolbar";

describe("renderToolbar", () => {
  it("rend un bouton 'Ouvrir' qui appelle onOpen", () => {
    const c = document.createElement("div");
    const onOpen = vi.fn();
    renderToolbar(c, { onOpen, currentPath: null });
    const btn = c.querySelector<HTMLButtonElement>(".vv-open-btn");
    expect(btn).not.toBeNull();
    expect(btn!.textContent).toMatch(/ouvrir/i);
    btn!.click();
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("affiche le nom court du chemin courant", () => {
    const c = document.createElement("div");
    renderToolbar(c, { onOpen: () => {}, currentPath: "/tmp/dashboards/x.vviz" });
    expect(c.querySelector<HTMLElement>(".vv-toolbar-file code")?.textContent)
      .toBe("x.vviz");
  });

  it("affiche 'Aucun fichier' si pas de chemin", () => {
    const c = document.createElement("div");
    renderToolbar(c, { onOpen: () => {}, currentPath: null });
    expect(c.textContent).toMatch(/aucun fichier/i);
  });

  it("normalise les antislashes Windows pour l'affichage", () => {
    const c = document.createElement("div");
    renderToolbar(c, {
      onOpen: () => {},
      currentPath: "C:\\Users\\x\\dash.vviz",
    });
    expect(c.querySelector<HTMLElement>(".vv-toolbar-file code")?.textContent)
      .toBe("dash.vviz");
  });

  it("échappe les caractères HTML dans le code affiché", () => {
    const c = document.createElement("div");
    renderToolbar(c, {
      onOpen: () => {},
      currentPath: "/dir/<weird>.vviz",
    });
    const codeEl = c.querySelector<HTMLElement>(".vv-toolbar-file code");
    // Le textContent reflète le nom court ; pas d'injection HTML possible.
    expect(codeEl?.textContent).toBe("<weird>.vviz");
    expect(c.querySelector("weird")).toBeNull();
  });
});
