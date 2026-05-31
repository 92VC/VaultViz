/**
 * B-120 — Tests du service watcher front (src/services/watcher.ts).
 *
 * On tourne sous happy-dom (sans Tauri). On mocke :
 *   - `@tauri-apps/api/core`  pour intercepter `invoke`
 *   - `@tauri-apps/api/event` pour intercepter `listen`
 *
 * Ces modules sont importés dynamiquement dans watcher.ts via
 * `/* @vite-ignore * /`, donc on doit les mocker via `vi.mock` avec
 * le même nom de module.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// ─── Mocks des modules Tauri ─────────────────────────────────────────────────

// Mock de `@tauri-apps/api/core` (invoke)
const mockInvoke = vi.fn().mockResolvedValue(undefined);
vi.mock("@tauri-apps/api/core", () => ({
  invoke: mockInvoke,
}));

// Mock de `@tauri-apps/api/event` (listen)
const mockUnlisten = vi.fn();
const mockListen = vi.fn().mockResolvedValue(mockUnlisten);
vi.mock("@tauri-apps/api/event", () => ({
  listen: mockListen,
}));

// ─── Import du service (après les mocks) ─────────────────────────────────────
import { startWatch, stopWatch, onDataChanged } from "../services/watcher";

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockInvoke.mockResolvedValue(undefined);
  mockListen.mockResolvedValue(mockUnlisten);
});

describe("startWatch", () => {
  it("invoque start_watch avec les paths fournis", async () => {
    const paths = ["//srv/share/data.parquet", "//srv/share/other.parquet"];
    await startWatch(paths);

    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith("start_watch", { paths });
  });

  it("ne throw pas si invoke rejette", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("tauri error"));
    await expect(startWatch(["//srv/a.parquet"])).resolves.toBeUndefined();
  });

  it("passe un tableau vide sans erreur", async () => {
    await startWatch([]);
    expect(mockInvoke).toHaveBeenCalledWith("start_watch", { paths: [] });
  });
});

describe("stopWatch", () => {
  it("invoque stop_watch sans argument", async () => {
    await stopWatch();
    expect(mockInvoke).toHaveBeenCalledOnce();
    expect(mockInvoke).toHaveBeenCalledWith("stop_watch");
  });

  it("ne throw pas si invoke rejette", async () => {
    mockInvoke.mockRejectedValueOnce(new Error("tauri error"));
    await expect(stopWatch()).resolves.toBeUndefined();
  });
});

describe("onDataChanged", () => {
  it("enregistre un listener sur vv://data-changed via listen", async () => {
    const cb = vi.fn();
    await onDataChanged(cb);

    expect(mockListen).toHaveBeenCalledOnce();
    expect(mockListen).toHaveBeenCalledWith("vv://data-changed", expect.any(Function));
  });

  it("retourne la fonction d'unlisten", async () => {
    const cb = vi.fn();
    const unlisten = await onDataChanged(cb);

    expect(typeof unlisten).toBe("function");
  });

  it("appelle le callback avec le payload de l'événement", async () => {
    const cb = vi.fn();

    // Capture la fonction passée à listen pour l'appeler manuellement.
    let capturedHandler: ((event: { payload: string }) => void) | null = null;
    mockListen.mockImplementationOnce(
      (_channel: string, handler: (event: { payload: string }) => void) => {
        capturedHandler = handler;
        return Promise.resolve(mockUnlisten);
      }
    );

    await onDataChanged(cb);

    // Simule l'arrivée d'un événement Tauri.
    expect(capturedHandler).not.toBeNull();
    capturedHandler!({ payload: "//srv/share/data.parquet" });

    expect(cb).toHaveBeenCalledOnce();
    expect(cb).toHaveBeenCalledWith("//srv/share/data.parquet");
  });

  it("ne throw pas si listen rejette", async () => {
    mockListen.mockRejectedValueOnce(new Error("listen error"));
    const cb = vi.fn();
    const unlisten = await onDataChanged(cb);
    // Doit renvoyer un no-op plutôt que de throw.
    expect(typeof unlisten).toBe("function");
    expect(() => unlisten()).not.toThrow();
  });
});
