import { describe, it, expect, beforeEach } from "vitest";

import {
  applyTheme,
  getTheme,
  toggleTheme,
  initTheme,
  setThemeStore,
  defaultStore,
  type Theme,
  type ThemeStore,
} from "../ui/theme";

const ATTR = "data-theme";

beforeEach(() => {
  // État neutre : pas d'attribut → défaut "dark".
  document.documentElement.removeAttribute(ATTR);
  // Repart sur le store par défaut (localStorage en happy-dom).
  setThemeStore(defaultStore());
  try {
    localStorage.clear();
  } catch {
    /* ignore */
  }
});

describe("applyTheme / getTheme", () => {
  it("applyTheme('light') puis getTheme() === 'light'", () => {
    applyTheme("light");
    expect(document.documentElement.getAttribute(ATTR)).toBe("light");
    expect(getTheme()).toBe("light");
  });

  it("applyTheme('dark') puis getTheme() === 'dark'", () => {
    applyTheme("dark");
    expect(getTheme()).toBe("dark");
  });

  it("défaut 'dark' si attribut absent", () => {
    expect(getTheme()).toBe("dark");
  });

  it("traite toute valeur non 'light' comme 'dark' (sémantique mockup)", () => {
    document.documentElement.setAttribute(ATTR, "bogus");
    expect(getTheme()).toBe("dark");
  });
});

describe("toggleTheme", () => {
  it("bascule l'attribut dark -> light -> dark et renvoie le nouveau thème", () => {
    applyTheme("dark");
    const t1 = toggleTheme();
    expect(t1).toBe("light");
    expect(document.documentElement.getAttribute(ATTR)).toBe("light");

    const t2 = toggleTheme();
    expect(t2).toBe("dark");
    expect(document.documentElement.getAttribute(ATTR)).toBe("dark");
  });

  it("ne lève aucune exception sans Tauri (happy-dom)", () => {
    expect(() => toggleTheme()).not.toThrow();
  });
});

describe("persistance via ThemeStore injectable", () => {
  it("toggleTheme persiste via le store injecté", async () => {
    const calls: Theme[] = [];
    const fake: ThemeStore = {
      load: async () => null,
      save: async (t) => {
        calls.push(t);
      },
    };
    setThemeStore(fake);
    applyTheme("dark");
    toggleTheme();
    // save() est appelée de façon asynchrone (fire-and-forget).
    await Promise.resolve();
    expect(calls).toEqual(["light"]);
  });

  it("initTheme applique la préférence persistée", async () => {
    const fake: ThemeStore = {
      load: async () => "light",
      save: async () => {},
    };
    setThemeStore(fake);
    document.documentElement.removeAttribute(ATTR);
    await initTheme();
    expect(getTheme()).toBe("light");
  });

  it("initTheme conserve le thème courant si rien de persisté", async () => {
    const fake: ThemeStore = {
      load: async () => null,
      save: async () => {},
    };
    setThemeStore(fake);
    applyTheme("light");
    await initTheme();
    expect(getTheme()).toBe("light");
  });

  it("initTheme ne throw pas si le store échoue", async () => {
    const broken: ThemeStore = {
      load: async () => {
        throw new Error("store down");
      },
      save: async () => {},
    };
    setThemeStore(broken);
    await expect(initTheme()).resolves.toBeUndefined();
  });
});

describe("defaultStore", () => {
  it("ne throw pas en happy-dom (pas de Tauri)", () => {
    expect(() => defaultStore()).not.toThrow();
  });

  it("le store localStorage persiste entre load/save", async () => {
    const store = defaultStore();
    await store.save("light");
    expect(await store.load()).toBe("light");
  });
});
