// Tests T3.6a (SP3) — composant chip de filtre actif.
//
// Environnement happy-dom : montage dans un container détaché, inspection du
// markup et du comportement (affichage conditionnel, échappement, onClear).

import { describe, expect, it, vi } from "vitest";

import { mountFilterChip } from "../components/filter-chip";

function mount(onClear = () => {}) {
  const container = document.createElement("div");
  const handle = mountFilterChip(container, { onClear });
  const chip = container.querySelector(".filter-chip") as HTMLElement;
  return { container, handle, chip };
}

describe("filter-chip (T3.6a)", () => {
  it("est caché au départ (pas de classe `on`)", () => {
    const { chip } = mount();
    expect(chip).not.toBeNull();
    expect(chip.classList.contains("on")).toBe(false);
  });

  it("`set(label)` affiche le libellé préfixé et la classe `on`", () => {
    const { handle, chip } = mount();
    handle.set("Paris 75");
    expect(chip.classList.contains("on")).toBe(true);
    expect(chip.textContent).toContain("Filtré : Paris 75");
  });

  it("rend un bouton `.x` avec une icône SVG", () => {
    const { chip } = mount();
    const x = chip.querySelector(".x");
    expect(x).not.toBeNull();
    expect(x?.querySelector("svg")).not.toBeNull();
  });

  it("clic sur `.x` appelle onClear", () => {
    const onClear = vi.fn();
    const { chip } = mount(onClear);
    const x = chip.querySelector(".x") as HTMLButtonElement;
    x.click();
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("`set(null)` masque le chip (retire `on`)", () => {
    const { handle, chip } = mount();
    handle.set("Paris 75");
    expect(chip.classList.contains("on")).toBe(true);
    handle.set(null);
    expect(chip.classList.contains("on")).toBe(false);
  });

  it("échappe le libellé (pas d'injection HTML)", () => {
    const { handle, chip } = mount();
    handle.set("<img src=x onerror=alert(1)>");
    expect(chip.querySelector("img")).toBeNull();
    expect(chip.textContent).toContain("<img src=x onerror=alert(1)>");
  });
});
