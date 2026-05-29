import { describe, it, expect } from "vitest";

import { mountLoader, LOAD_STEPS } from "../components/loader";

describe("mountLoader", () => {
  it("start({name}) affiche le nom du fichier", () => {
    const c = document.createElement("div");
    const h = mountLoader(c);
    h.start({ name: "perf-reseau-2025.vviz", size: "284 Ko" });
    expect(c.querySelector(".l-name")!.textContent).toBe("perf-reseau-2025.vviz");
    expect(c.querySelector(".l-sz")!.textContent).toBe("284 Ko");
    expect((c.querySelector(".loader") as HTMLElement).style.display).toBe("flex");
  });

  it("setProgress(50) met la largeur de la barre", () => {
    const c = document.createElement("div");
    const h = mountLoader(c);
    h.start({ name: "x.vviz" });
    h.setProgress(50);
    expect((c.querySelector(".lbar i") as HTMLElement).style.width).toBe("50%");
  });

  it("setProgress clampe hors bornes", () => {
    const c = document.createElement("div");
    const h = mountLoader(c);
    h.setProgress(150);
    expect((c.querySelector(".lbar i") as HTMLElement).style.width).toBe("100%");
    h.setProgress(-10);
    expect((c.querySelector(".lbar i") as HTMLElement).style.width).toBe("0%");
  });

  it("setStep('x') met le texte de l'étape", () => {
    const c = document.createElement("div");
    const h = mountLoader(c);
    h.setStep("Indexation…");
    expect(c.querySelector(".l-steps")!.textContent).toBe("Indexation…");
  });

  it("done() passe en état prêt à 100 %", () => {
    const c = document.createElement("div");
    const h = mountLoader(c);
    h.done();
    expect((c.querySelector(".lbar i") as HTMLElement).style.width).toBe("100%");
    expect(c.querySelector(".l-steps")!.textContent).toMatch(/prêt/);
  });

  it("hide() masque le loader", () => {
    const c = document.createElement("div");
    const h = mountLoader(c);
    h.start({ name: "x.vviz" });
    h.hide();
    expect((c.querySelector(".loader") as HTMLElement).style.display).toBe("none");
  });

  it("LOAD_STEPS est non vide", () => {
    expect(LOAD_STEPS.length).toBeGreaterThan(0);
  });
});
