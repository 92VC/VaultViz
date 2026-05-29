import { describe, it, expect, beforeEach, vi } from "vitest";

import { mountHome } from "../components/home";
import {
  setRecentsStore,
  type RecentItem,
  type RecentsStore,
} from "../services/recents";

/** Store mémoire injectable, pré-rempli pour les tests. */
function makeStore(items: RecentItem[]): RecentsStore {
  let value: string | null = items.length ? JSON.stringify(items) : null;
  return {
    load: async () => value,
    save: async (json) => {
      value = json;
    },
  };
}

const mk = (path: string, title: string, openedAt: number): RecentItem => ({
  path,
  title,
  openedAt,
});

beforeEach(() => {
  // Par défaut : store vide. Surchargé dans les tests qui ont besoin de récents.
  setRecentsStore(makeStore([]));
});

describe("mountHome", () => {
  it("rend le hero (titre VaultViz + tagline) et la dropzone", () => {
    const el = document.createElement("div");
    mountHome(el, { onOpenPath: () => {} });

    expect(el.querySelector(".home-hero")).not.toBeNull();
    // Titre Vault + <span class="v">Viz</span>
    expect(el.querySelector(".home-hero h1")?.textContent).toMatch(/VaultViz/);
    expect(el.querySelector(".home-hero .v")?.textContent).toBe("Viz");
    expect(el.querySelector(".tag")).not.toBeNull();
    expect(el.querySelector(".dropzone")).not.toBeNull();
  });

  it("ajoute `.hot` à la dropzone au survol et le retire au drop", () => {
    const el = document.createElement("div");
    mountHome(el, { onOpenPath: () => {} });
    const dz = el.querySelector<HTMLElement>(".dropzone")!;

    dz.dispatchEvent(new Event("dragover", { bubbles: true, cancelable: true }));
    expect(dz.classList.contains("hot")).toBe(true);

    dz.dispatchEvent(new Event("drop", { bubbles: true, cancelable: true }));
    expect(dz.classList.contains("hot")).toBe(false);
  });

  it("affiche l'état vide quand aucun récent", async () => {
    setRecentsStore(makeStore([]));
    const el = document.createElement("div");
    const handle = mountHome(el, { onOpenPath: () => {} });
    await handle.refresh();

    const list = el.querySelector<HTMLElement>(".recent-list")!;
    const empty = el.querySelector<HTMLElement>(".empty-recents")!;
    expect(list.querySelectorAll(".recent").length).toBe(0);
    expect(list.style.display).toBe("none");
    expect(empty.style.display).toBe("block");
  });

  it("rend la liste des récents (titres + chemins)", async () => {
    setRecentsStore(
      makeStore([
        mk("//srv/share/a.vviz", "Dashboard A", 2),
        mk("//srv/share/b.vviz", "Dashboard B", 1),
      ]),
    );
    const el = document.createElement("div");
    const handle = mountHome(el, { onOpenPath: () => {} });
    await handle.refresh();

    const recents = el.querySelectorAll(".recent");
    expect(recents.length).toBe(2);
    expect(el.textContent).toMatch(/Dashboard A/);
    expect(el.textContent).toMatch(/\/\/srv\/share\/a\.vviz/);
    // État vide masqué
    expect(
      el.querySelector<HTMLElement>(".empty-recents")!.style.display,
    ).toBe("none");
  });

  it("clic sur un récent appelle onOpenPath avec le bon chemin", async () => {
    setRecentsStore(
      makeStore([
        mk("//srv/share/a.vviz", "Dashboard A", 2),
        mk("//srv/share/b.vviz", "Dashboard B", 1),
      ]),
    );
    const onOpenPath = vi.fn();
    const el = document.createElement("div");
    const handle = mountHome(el, { onOpenPath });
    await handle.refresh();

    // Tri décroissant par openedAt : a (2) avant b (1).
    const buttons = el.querySelectorAll<HTMLButtonElement>(".recent");
    buttons[1].click(); // second élément → b.vviz

    expect(onOpenPath).toHaveBeenCalledTimes(1);
    expect(onOpenPath).toHaveBeenCalledWith("//srv/share/b.vviz");
  });

  it("marque les récents cassés (.broken) avec un badge", async () => {
    setRecentsStore(
      makeStore([{ ...mk("//srv/x.vviz", "Cassé", 1), broken: true }]),
    );
    const el = document.createElement("div");
    const handle = mountHome(el, { onOpenPath: () => {} });
    await handle.refresh();

    const recent = el.querySelector(".recent")!;
    expect(recent.classList.contains("broken")).toBe(true);
    expect(recent.querySelector(".rbadge")).not.toBeNull();
  });
});
