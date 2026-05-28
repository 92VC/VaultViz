// Tests B-060 — bandeau d'erreur typé.
//
// Couvre les 5 catégories d'erreur, l'action Réessayer, le rendu des
// détails (utilisé en B-061 pour les violations Ajv) et le mapper
// `fromVVizError` (Tauri `{kind, message}` → ErrorPayload).

import { describe, it, expect, vi } from "vitest";
import {
  fromVVizError,
  renderErrorBanner,
} from "../components/error-banner";

describe("error-banner (B-060)", () => {
  it("renders NotFound copy with retry button", () => {
    const c = document.createElement("div");
    const onRetry = vi.fn();
    renderErrorBanner(
      c,
      { kind: "NotFound", path: "/share/x.vviz" },
      { onRetry },
    );
    expect(c.textContent).toMatch(/introuvable/i);
    expect(c.textContent).toContain("/share/x.vviz");
    const btn = c.querySelector<HTMLButtonElement>(".vv-retry");
    expect(btn).not.toBeNull();
    btn!.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("differentiates NotFound / Forbidden / Corrupt / Invalid / Io copy", () => {
    const c = document.createElement("div");
    renderErrorBanner(c, { kind: "Forbidden", path: "/y" });
    expect(c.textContent).toMatch(/refusé/i);
    renderErrorBanner(c, { kind: "Corrupt", path: "/z" });
    expect(c.textContent).toMatch(/corrompu/i);
    renderErrorBanner(c, { kind: "Invalid", path: "/s" });
    expect(c.textContent).toMatch(/invalide/i);
    renderErrorBanner(c, { kind: "Io", path: "/io" });
    expect(c.textContent).toMatch(/entrée\/sortie/i);
  });

  it("exposes the kind via data attribute for styling", () => {
    const c = document.createElement("div");
    renderErrorBanner(c, { kind: "Forbidden", path: "/p" });
    const banner = c.querySelector(".vv-error");
    expect(banner?.getAttribute("data-kind")).toBe("Forbidden");
  });

  it("renders details list when provided (Invalid)", () => {
    const c = document.createElement("div");
    renderErrorBanner(c, {
      kind: "Invalid",
      path: "/spec.vviz",
      message: "Voir détails",
      details: [
        "/vviz/title: must be string",
        "/data/sources: minItems 1",
      ],
    });
    const items = c.querySelectorAll(".vv-error-details li");
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain("must be string");
  });

  it("renders an Aide link only when helpHref provided", () => {
    const c = document.createElement("div");
    renderErrorBanner(c, { kind: "NotFound", path: "/x" });
    expect(c.querySelector(".vv-help")).toBeNull();
    renderErrorBanner(
      c,
      { kind: "NotFound", path: "/x" },
      { helpHref: "https://example.test/help" },
    );
    expect(c.querySelector<HTMLAnchorElement>(".vv-help")?.href).toContain(
      "example.test/help",
    );
  });

  it("escapes HTML in path and message to avoid XSS in error rendering", () => {
    const c = document.createElement("div");
    renderErrorBanner(c, {
      kind: "NotFound",
      path: "<img src=x onerror=alert(1)>",
    });
    expect(c.innerHTML).not.toContain("<img src=x");
    expect(c.textContent).toContain("<img src=x onerror=alert(1)>");
  });

  it("fromVVizError maps Rust {kind,message} payload to ErrorPayload", () => {
    const p = fromVVizError(
      { kind: "Forbidden", message: "EACCES" },
      "/x",
    );
    expect(p.kind).toBe("Forbidden");
    expect(p.message).toBe("EACCES");
    expect(p.path).toBe("/x");
  });

  it("fromVVizError falls back to Io for unknown payload shapes", () => {
    const p = fromVVizError("oops", "/x");
    expect(p.kind).toBe("Io");
    expect(p.message).toBe("oops");
  });

  it("fromVVizError remaps unknown kind to Io (defense in depth)", () => {
    const p = fromVVizError(
      { kind: "TotallyUnknown", message: "?" },
      "/x",
    );
    expect(p.kind).toBe("Io");
  });
});
