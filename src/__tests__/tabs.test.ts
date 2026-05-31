import { describe, it, expect, vi, beforeEach } from "vitest";

import { createTabsManager, type TabsDeps } from "../shell/tabs";
import { mountAppShell, type ShellHandles } from "../shell/layout";
import { createRouter } from "../shell/router";
import { mountTitlebar } from "../components/titlebar";
import { mountToolbar } from "../components/toolbar";
import type { LoadResult } from "../viz-engine/spec-loader";
import type { VVizDocument } from "../viz-engine/types";

/** Document .vviz minimal (layout vstack, une source, une vue). */
function doc(title: string, sources: string[]): VVizDocument {
  return {
    vviz: { version: "1.0", title },
    data: { sources: sources.map((name) => ({ name, path: `./${name}.parquet` })) },
    spec: {
      engine: "mosaic",
      layout: "vstack",
      views: [{ id: "v1", type: "table", source: sources[0], encoding: { columns: ["a"] } }],
    },
  } as unknown as VVizDocument;
}

/** Document .vviz autoporteur (source inline base64, aucun fichier externe). */
function inlineDoc(title: string, name: string): VVizDocument {
  return {
    vviz: { version: "1.0", title },
    data: { sources: [{ name, inline: "UEFSMQ==" }] },
    spec: {
      engine: "mosaic",
      layout: "vstack",
      views: [{ id: "v1", type: "table", source: name, encoding: { columns: ["a"] } }],
    },
  } as unknown as VVizDocument;
}

/** Loader no-op (évite de monter le vrai loader sur l'overlay). */
const noopLoader = {
  start: () => {},
  setStep: () => {},
  setProgress: () => {},
  done: () => {},
  hide: () => {},
} as TabsDeps["loader"];

interface Harness {
  handles: ShellHandles;
  deps: TabsDeps;
  dropSpy: ReturnType<typeof vi.fn>;
  mountSpy: ReturnType<typeof vi.fn>;
  loadVVizSpy: ReturnType<typeof vi.fn>;
  startWatchSpy: ReturnType<typeof vi.fn>;
  stopWatchSpy: ReturnType<typeof vi.fn>;
}

function harness(docs: Record<string, VVizDocument>): Harness {
  const root = document.createElement("div");
  document.body.appendChild(root);
  const handles = mountAppShell(root);
  const router = createRouter(handles);
  const titlebar = mountTitlebar(handles.titlebar);
  const toolbar = mountToolbar(handles.toolbar, { onOpen: () => {} });

  const loadVVizSpy = vi.fn(
    async (path: string): Promise<LoadResult> => {
      const d = docs[path];
      if (!d) return { doc: null, error: { kind: "Io", path, message: "absent" } };
      return { doc: d, error: null };
    },
  );
  const dropSpy = vi.fn(async () => {});
  const mountSpy = vi.fn(async () => {});
  const startWatchSpy = vi.fn(async () => {});
  const stopWatchSpy = vi.fn(async () => {});

  const deps: TabsDeps = {
    handles,
    router,
    titlebar,
    toolbar,
    loader: noopLoader,
    connector: { query: vi.fn(async () => undefined) } as unknown as TabsDeps["connector"],
    loadVViz: loadVVizSpy,
    loadSources: vi.fn(async () => {}),
    dropDocViews: dropSpy,
    mountDashboard: mountSpy,
    createRuntime: () => ({
      selections: new Map(),
      params: new Map(),
      sources: new Map(),
      slicerState: new Map(),
    }),
    initRuntime: () => {},
    addRecent: vi.fn(async () => {}),
    onHome: vi.fn(),
    startWatch: startWatchSpy,
    stopWatch: stopWatchSpy,
  };

  return { handles, deps, dropSpy, mountSpy, loadVVizSpy, startWatchSpy, stopWatchSpy };
}

describe("createTabsManager", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
  });

  it("open crée un docId et un conteneur DOM dédié", async () => {
    const { handles, deps } = harness({ "/a.vviz": doc("Doc A", ["src"]) });
    const tabs = createTabsManager(deps);

    await tabs.open("/a.vviz");

    expect(tabs.activeId()).toBe("d1");
    expect(tabs.list()).toEqual([{ docId: "d1", path: "/a.vviz", title: "Doc A" }]);
    const containers = handles.dashboard.querySelectorAll(".vv-doc");
    expect(containers.length).toBe(1);
    expect(containers[0].getAttribute("data-doc-id")).toBe("d1");
  });

  it("ouvrir 2 docs → 2 onglets, docIds distincts, seul l'actif visible", async () => {
    const { handles, deps } = harness({
      "/a.vviz": doc("Doc A", ["sa"]),
      "/b.vviz": doc("Doc B", ["sb"]),
    });
    const tabs = createTabsManager(deps);

    await tabs.open("/a.vviz");
    await tabs.open("/b.vviz");

    expect(tabs.list().map((t) => t.docId)).toEqual(["d1", "d2"]);
    expect(tabs.activeId()).toBe("d2");

    const cA = handles.dashboard.querySelector<HTMLElement>('[data-doc-id="d1"]')!;
    const cB = handles.dashboard.querySelector<HTMLElement>('[data-doc-id="d2"]')!;
    expect(cA.style.display).toBe("none");
    expect(cB.style.display).toBe("block");

    // La titlebar reflète 2 onglets dont d2 actif.
    expect(handles.titlebar.querySelectorAll(".tab").length).toBe(2);
    expect(
      handles.titlebar.querySelector('.tab.active')!.getAttribute("data-tab-id"),
    ).toBe("d2");
  });

  it("activate bascule la visibilité et l'onglet actif", async () => {
    const { handles, deps } = harness({
      "/a.vviz": doc("Doc A", ["sa"]),
      "/b.vviz": doc("Doc B", ["sb"]),
    });
    const tabs = createTabsManager(deps);
    await tabs.open("/a.vviz");
    await tabs.open("/b.vviz");

    tabs.activate("d1");
    expect(tabs.activeId()).toBe("d1");
    expect(
      handles.dashboard.querySelector<HTMLElement>('[data-doc-id="d1"]')!.style.display,
    ).toBe("block");
    expect(
      handles.dashboard.querySelector<HTMLElement>('[data-doc-id="d2"]')!.style.display,
    ).toBe("none");
  });

  it("close appelle dropDocViews avec les bons sourceNames et retire le conteneur", async () => {
    const { handles, deps, dropSpy } = harness({
      "/a.vviz": doc("Doc A", ["effectifs", "geo"]),
    });
    const tabs = createTabsManager(deps);
    await tabs.open("/a.vviz");

    await tabs.close("d1");

    expect(dropSpy).toHaveBeenCalledTimes(1);
    expect(dropSpy).toHaveBeenCalledWith(deps.connector, "d1", ["effectifs", "geo"]);
    expect(handles.dashboard.querySelector('[data-doc-id="d1"]')).toBeNull();
    expect(tabs.list()).toEqual([]);
  });

  it("fermer le dernier onglet → router.show('home') + onHome", async () => {
    const { handles, deps } = harness({ "/a.vviz": doc("Doc A", ["src"]) });
    const onHome = deps.onHome as ReturnType<typeof vi.fn>;
    const tabs = createTabsManager(deps);
    await tabs.open("/a.vviz");

    await tabs.close("d1");

    expect(tabs.activeId()).toBeNull();
    expect(onHome).toHaveBeenCalled();
    expect(handles.home.style.display).toBe("flex");
    expect(handles.dashboard.style.display).toBe("none");
  });

  it("fermer un onglet non-actif garde l'actif et bascule sinon", async () => {
    const { deps } = harness({
      "/a.vviz": doc("Doc A", ["sa"]),
      "/b.vviz": doc("Doc B", ["sb"]),
    });
    const tabs = createTabsManager(deps);
    await tabs.open("/a.vviz");
    await tabs.open("/b.vviz");

    // Ferme l'actif (d2) → bascule sur d1.
    await tabs.close("d2");
    expect(tabs.activeId()).toBe("d1");
    expect(tabs.list().map((t) => t.docId)).toEqual(["d1"]);
  });

  it("isolation : chaque onglet a son propre RuntimeContext", async () => {
    const ctxs: object[] = [];
    const base = harness({
      "/a.vviz": doc("Doc A", ["sa"]),
      "/b.vviz": doc("Doc B", ["sb"]),
    });
    base.deps.createRuntime = () => {
      const c = {
        selections: new Map(),
        params: new Map(),
        sources: new Map(),
        slicerState: new Map(),
      };
      ctxs.push(c);
      return c;
    };
    const tabs = createTabsManager(base.deps);
    await tabs.open("/a.vviz");
    await tabs.open("/b.vviz");

    expect(ctxs.length).toBe(2);
    expect(ctxs[0]).not.toBe(ctxs[1]);
  });

  it("erreur de chargement → écran d'erreur, aucun onglet créé", async () => {
    const { handles, deps } = harness({});
    const tabs = createTabsManager(deps);

    await tabs.open("/missing.vviz");

    expect(tabs.list()).toEqual([]);
    expect(tabs.activeId()).toBeNull();
    expect(handles.error.style.display).toBe("flex");
  });

  it("ouvrir un doc à source externe → startWatch avec le path résolu (B-120)", async () => {
    const { deps, startWatchSpy } = harness({
      "/share/dash.vviz": doc("Doc A", ["effectifs"]),
    });
    const tabs = createTabsManager(deps);

    await tabs.open("/share/dash.vviz");

    // `./effectifs.parquet` résolu relativement au dossier `/share`.
    expect(startWatchSpy).toHaveBeenCalledWith(["/share/effectifs.parquet"]);
  });

  it("ouvrir un doc AUTOPORTEUR (inline pur) → startWatch PAS appelé, stopWatch appelé", async () => {
    const { deps, startWatchSpy, stopWatchSpy } = harness({
      "/dli.vviz": inlineDoc("DLI autoporteur", "inv"),
    });
    const tabs = createTabsManager(deps);

    await tabs.open("/dli.vviz");

    expect(startWatchSpy).not.toHaveBeenCalled();
    // Aucune source externe → on purge toute surveillance résiduelle.
    expect(stopWatchSpy).toHaveBeenCalled();
  });

  it("changer d'onglet → le watcher suit l'onglet actif (B-120)", async () => {
    const { deps, startWatchSpy } = harness({
      "/share/a.vviz": doc("Doc A", ["sa"]),
      "/share/b.vviz": doc("Doc B", ["sb"]),
    });
    const tabs = createTabsManager(deps);
    await tabs.open("/share/a.vviz");
    await tabs.open("/share/b.vviz");
    startWatchSpy.mockClear();

    tabs.activate("d1");
    expect(startWatchSpy).toHaveBeenLastCalledWith(["/share/sa.parquet"]);
  });

  it("fermer le dernier onglet → stopWatch appelé (B-120)", async () => {
    const { deps, stopWatchSpy } = harness({ "/share/a.vviz": doc("Doc A", ["src"]) });
    const tabs = createTabsManager(deps);
    await tabs.open("/share/a.vviz");
    stopWatchSpy.mockClear();

    await tabs.close("d1");

    expect(stopWatchSpy).toHaveBeenCalled();
  });
});
