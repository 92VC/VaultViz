import { describe, it, expect } from "vitest";

import { isTauri, onFileDrop, openViaDialog } from "../services/file-open";

// Tests exécutés sous happy-dom, SANS Tauri : aucune API Tauri n'est
// présente (window.__TAURI__ absent). On vérifie le comportement de
// repli (no-op / null) et l'absence de throw.

describe("isTauri", () => {
  it("renvoie false hors Tauri (happy-dom)", () => {
    expect(isTauri()).toBe(false);
  });
});

describe("onFileDrop", () => {
  it("renvoie une fonction de désabonnement et ne throw pas", () => {
    const unsub = onFileDrop(() => {
      /* le handler ne doit jamais être appelé hors Tauri */
    });
    expect(typeof unsub).toBe("function");
    // Le désabonnement ne doit pas throw non plus.
    expect(() => unsub()).not.toThrow();
  });
});

describe("openViaDialog", () => {
  it("se résout à null hors Tauri sans throw", async () => {
    await expect(openViaDialog()).resolves.toBeNull();
  });
});
