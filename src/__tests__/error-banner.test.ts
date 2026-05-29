// Tests — bandeau d'erreur typé (visuel maquette `.errbar`).
//
// Couvre les 5 catégories d'erreur (titre + message), l'affichage du
// chemin, l'action Réessayer, le rendu des violations (`.viol`, une par
// détail — utilisé pour les violations Ajv) et le mapper `fromVVizError`
// (Tauri `{kind, message}` → ErrorPayload).

import { describe, it, expect, vi } from "vitest";
import {
  fromVVizError,
  renderErrorBanner,
} from "../components/error-banner";

describe("error-banner", () => {
  it("renders NotFound title + path with retry button", () => {
    const c = document.createElement("div");
    const onRetry = vi.fn();
    renderErrorBanner(
      c,
      { kind: "NotFound", path: "/share/x.vviz" },
      { onRetry },
    );
    expect(c.querySelector(".e-title")?.textContent).toMatch(/introuvable/i);
    expect(c.querySelector(".e-path")?.textContent).toBe("/share/x.vviz");
    const btn = c.querySelector<HTMLButtonElement>(".vv-retry");
    expect(btn).not.toBeNull();
    btn!.click();
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("renders a kind-specific title for each category", () => {
    const c = document.createElement("div");
    const title = () => c.querySelector(".e-title")?.textContent ?? "";
    renderErrorBanner(c, { kind: "NotFound", path: "/a" });
    expect(title()).toMatch(/introuvable/i);
    renderErrorBanner(c, { kind: "Forbidden", path: "/y" });
    expect(title()).toMatch(/refusé/i);
    renderErrorBanner(c, { kind: "Corrupt", path: "/z" });
    expect(title()).toMatch(/corrompu/i);
    renderErrorBanner(c, { kind: "Invalid", path: "/s" });
    expect(title()).toMatch(/invalide/i);
    renderErrorBanner(c, { kind: "Io", path: "/io" });
    expect(title()).toMatch(/entrée\/sortie/i);
  });

  it("exposes the kind via data attribute for styling", () => {
    const c = document.createElement("div");
    renderErrorBanner(c, { kind: "Forbidden", path: "/p" });
    const banner = c.querySelector(".errbar");
    expect(banner?.getAttribute("data-kind")).toBe("Forbidden");
  });

  it("renders one .viol line per detail when provided (Invalid)", () => {
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
    const items = c.querySelectorAll(".violations .viol");
    expect(items.length).toBe(2);
    expect(items[0].textContent).toContain("must be string");
  });

  it("renders no violations block when details absent", () => {
    const c = document.createElement("div");
    renderErrorBanner(c, { kind: "NotFound", path: "/x" });
    expect(c.querySelector(".violations")).toBeNull();
  });

  it("renders a Documentation link only when docHref provided", () => {
    const c = document.createElement("div");
    renderErrorBanner(c, { kind: "NotFound", path: "/x" });
    expect(c.querySelector(".vv-doc")).toBeNull();
    renderErrorBanner(
      c,
      { kind: "NotFound", path: "/x" },
      { docHref: "https://example.test/help" },
    );
    expect(c.querySelector<HTMLAnchorElement>(".vv-doc")?.href).toContain(
      "example.test/help",
    );
  });

  it("accepts helpHref as a backward-compatible alias for docHref", () => {
    const c = document.createElement("div");
    renderErrorBanner(
      c,
      { kind: "NotFound", path: "/x" },
      { helpHref: "https://example.test/help" },
    );
    expect(c.querySelector<HTMLAnchorElement>(".vv-doc")?.href).toContain(
      "example.test/help",
    );
  });

  it("fires onHome when the Annuler button is clicked", () => {
    const c = document.createElement("div");
    const onHome = vi.fn();
    renderErrorBanner(c, { kind: "NotFound", path: "/x" }, { onHome });
    c.querySelector<HTMLButtonElement>(".vv-home")!.click();
    expect(onHome).toHaveBeenCalledTimes(1);
  });

  it("escapes HTML in path and details to avoid XSS in error rendering", () => {
    const c = document.createElement("div");
    renderErrorBanner(c, {
      kind: "NotFound",
      path: "<img src=x onerror=alert(1)>",
    });
    expect(c.innerHTML).not.toContain("<img src=x");
    expect(c.querySelector(".e-path")?.textContent).toContain(
      "<img src=x onerror=alert(1)>",
    );
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
