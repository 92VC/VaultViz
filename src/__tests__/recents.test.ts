import { describe, it, expect, beforeEach } from "vitest";

import {
  addRecent,
  listRecents,
  clearRecents,
  setRecentsStore,
  type RecentItem,
  type RecentsStore,
} from "../services/recents";

/** Store mémoire injecté pour les tests : isole de localStorage/Tauri. */
function makeMemoryStore(): RecentsStore {
  let value: string | null = null;
  return {
    load: async () => value,
    save: async (json) => {
      value = json;
    },
  };
}

const mk = (path: string, openedAt: number, title = path): RecentItem => ({
  path,
  title,
  openedAt,
});

beforeEach(() => {
  setRecentsStore(makeMemoryStore());
});

describe("addRecent", () => {
  it("dédoublonne par path (le doublon remplace l'ancien)", async () => {
    await addRecent(mk("//a/x.vviz", 1));
    await addRecent(mk("//a/y.vviz", 2));
    await addRecent(mk("//a/x.vviz", 3, "x renommé"));

    const list = await listRecents();
    const paths = list.map((r) => r.path);
    expect(paths.filter((p) => p === "//a/x.vviz")).toHaveLength(1);
    expect(list).toHaveLength(2);
    // version la plus récente conservée
    const x = list.find((r) => r.path === "//a/x.vviz")!;
    expect(x.openedAt).toBe(3);
    expect(x.title).toBe("x renommé");
  });

  it("place le plus récent en tête", async () => {
    await addRecent(mk("//a/1.vviz", 1));
    await addRecent(mk("//a/2.vviz", 2));
    await addRecent(mk("//a/3.vviz", 3));

    const list = await listRecents();
    expect(list[0].path).toBe("//a/3.vviz");
  });

  it("plafonne la liste à 12 (les plus anciens sont éjectés)", async () => {
    for (let i = 1; i <= 15; i++) {
      await addRecent(mk(`//a/${i}.vviz`, i));
    }
    const list = await listRecents();
    expect(list).toHaveLength(12);
    // les 12 derniers ajoutés (15..4) doivent rester ; 1,2,3 éjectés
    const paths = list.map((r) => r.path);
    expect(paths).toContain("//a/15.vviz");
    expect(paths).toContain("//a/4.vviz");
    expect(paths).not.toContain("//a/3.vviz");
    expect(paths).not.toContain("//a/1.vviz");
  });
});

describe("listRecents", () => {
  it("trie par openedAt décroissant", async () => {
    // Insertion dans un ordre non trié
    await addRecent(mk("//a/b.vviz", 50));
    await addRecent(mk("//a/a.vviz", 10));
    await addRecent(mk("//a/c.vviz", 99));

    const list = await listRecents();
    const times = list.map((r) => r.openedAt);
    expect(times).toEqual([99, 50, 10]);
  });

  it("renvoie [] quand rien de persisté", async () => {
    expect(await listRecents()).toEqual([]);
  });
});

describe("clearRecents", () => {
  it("vide la liste", async () => {
    await addRecent(mk("//a/x.vviz", 1));
    await addRecent(mk("//a/y.vviz", 2));
    await clearRecents();
    expect(await listRecents()).toEqual([]);
  });
});
