import { describe, it, expect } from "vitest";

import { mountAppShell } from "../shell/layout";
import { createRouter } from "../shell/router";

describe("mountAppShell", () => {
  it("crée les conteneurs du shell", () => {
    const root = document.createElement("div");
    const h = mountAppShell(root);

    expect(root.querySelector("#app")).toBe(h.app);
    expect(root.querySelector("#shell-titlebar")).toBe(h.titlebar);
    expect(root.querySelector("#shell-toolbar")).toBe(h.toolbar);
    expect(root.querySelector("#shell-stage")).toBe(h.stage);
    expect(root.querySelector("#shell-home")).toBe(h.home);
    expect(root.querySelector("#shell-dashboard")).toBe(h.dashboard);
    expect(root.querySelector("#shell-error")).toBe(h.error);
    expect(root.querySelector("#shell-overlay")).toBe(h.overlay);

    // classes de la maquette
    expect(h.dashboard.className).toBe("dash");
    expect(h.error.className).toBe("errbar");

    // home/dashboard/error/overlay sont dans la stage
    for (const el of [h.home, h.dashboard, h.error, h.overlay]) {
      expect(el.parentElement).toBe(h.stage);
    }

    // conteneurs cachés au montage
    for (const el of [h.home, h.dashboard, h.error, h.overlay]) {
      expect(el.style.display).toBe("none");
    }
  });
});

describe("createRouter", () => {
  it("show('dashboard') affiche #shell-dashboard et masque #shell-home", () => {
    const root = document.createElement("div");
    const h = mountAppShell(root);
    const router = createRouter(h);

    router.show("dashboard");

    expect(h.dashboard.style.display).toBe("flex");
    expect(h.home.style.display).toBe("none");
    expect(router.current()).toBe("dashboard");
  });

  it("show('home') inverse l'affichage", () => {
    const root = document.createElement("div");
    const h = mountAppShell(root);
    const router = createRouter(h);

    router.show("dashboard");
    router.show("home");

    expect(h.home.style.display).toBe("flex");
    expect(h.dashboard.style.display).toBe("none");
    expect(router.current()).toBe("home");
  });

  it("current() vaut 'home' par défaut", () => {
    const root = document.createElement("div");
    const h = mountAppShell(root);
    const router = createRouter(h);
    expect(router.current()).toBe("home");
  });

  it("show('loading') superpose l'overlay sans masquer la vue courante", () => {
    const root = document.createElement("div");
    const h = mountAppShell(root);
    const router = createRouter(h);

    router.show("dashboard");
    router.show("loading");

    expect(h.overlay.style.display).toBe("flex");
    expect(h.dashboard.style.display).toBe("flex");
    expect(router.current()).toBe("loading");
  });
});
