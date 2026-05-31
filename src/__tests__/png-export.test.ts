// B-132 — Tests export PNG (presse-papier + fichier).
//
// happy-dom n'a pas de canvas réel, ni de navigator.clipboard.write.
// On utilise les paramètres injectables de captureView et writeClipboard.
//
// Tests :
//  1. captureToPng retourne un Blob image/png non vide (mock rasterizer)
//  2. writeClipboard est appelé avec le Blob (mock clipboard)
//  3. downloadPng déclenche un download (createObjectURL + <a> click)
//  4. exportToPng combine capture + clipboard + download
//  5. Sans SVG dans le conteneur : repli gracieux (blob non vide ou null)
//  6. Hors ligne : aucune URL http dans le module

import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  captureToPng,
  downloadPng,
  exportToPng,
  type PngExportOpts,
} from "../services/png-export";

// PNG 1×1 transparent minimal valide
const VALID_PNG_1x1 = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53,
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41,
  0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00,
  0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc,
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e,
  0x44, 0xae, 0x42, 0x60, 0x82,
]);

/** Rasterizer injectable : retourne un data URI PNG valide. */
const mockRasterize = async (_svg: SVGElement): Promise<string> => {
  // Construit un data URI base64 à partir du PNG 1×1
  const binary = VALID_PNG_1x1.reduce((acc, b) => acc + String.fromCharCode(b), "");
  return "data:image/png;base64," + btoa(binary);
};

/** Rasterizer retournant un Uint8Array (autre forme acceptée). */
const mockRasterizeBytes = async (_svg: SVGElement): Promise<Uint8Array> =>
  VALID_PNG_1x1;

function makeSvgContainer(): HTMLElement {
  const div = document.createElement("div");
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 100 100");
  svg.setAttribute("width", "100");
  svg.setAttribute("height", "100");
  div.appendChild(svg);
  return div;
}

describe("captureToPng (B-132)", () => {
  it("retourne un Blob image/png non vide", async () => {
    const container = makeSvgContainer();
    const blob = await captureToPng(container, { rasterizeSvg: mockRasterize });
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe("image/png");
    expect(blob!.size).toBeGreaterThan(0);
  });

  it("accepte un rasterizer retournant Uint8Array", async () => {
    const container = makeSvgContainer();
    const blob = await captureToPng(container, { rasterizeSvg: mockRasterizeBytes });
    expect(blob).not.toBeNull();
    expect(blob!.type).toBe("image/png");
    expect(blob!.size).toBeGreaterThan(0);
  });

  it("conteneur sans SVG → retourne null (pas de crash)", async () => {
    const empty = document.createElement("div");
    const blob = await captureToPng(empty, { rasterizeSvg: mockRasterize });
    expect(blob).toBeNull();
  });

  it("conteneur avec canvas maplibre → blob non nul (captureCanvas injectable)", async () => {
    const div = document.createElement("div");
    const canvas = document.createElement("canvas");
    canvas.className = "maplibregl-canvas";
    div.appendChild(canvas);

    const captureCanvas = async (): Promise<string> => {
      const binary = VALID_PNG_1x1.reduce((acc, b) => acc + String.fromCharCode(b), "");
      return "data:image/png;base64," + btoa(binary);
    };

    const blob = await captureToPng(div, {
      rasterizeSvg: mockRasterize,
      captureCanvas,
    });
    expect(blob).not.toBeNull();
    expect(blob!.size).toBeGreaterThan(0);
  });
});

describe("downloadPng (B-132)", () => {
  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  it("crée un <a> download et simule un clic", () => {
    const blob = new Blob([VALID_PNG_1x1], { type: "image/png" });
    const appendSpy = vi.spyOn(document.body, "appendChild");
    const removeSpy = vi.spyOn(document.body, "removeChild");

    downloadPng(blob, "test-export.png");

    // createElement("a") + click + removeChild
    expect(URL.createObjectURL).toHaveBeenCalledWith(blob);
    expect(appendSpy).toHaveBeenCalled();
    expect(removeSpy).toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:mock-url");
  });
});

describe("exportToPng (B-132) — clipboard + download", () => {
  beforeEach(() => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:mock-url");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => {});
  });

  it("writeClipboard est appelé avec un Blob image/png", async () => {
    const clipboardMock = vi.fn().mockResolvedValue(undefined);
    const container = makeSvgContainer();

    const opts: PngExportOpts = {
      container,
      rasterizeSvg: mockRasterize,
      writeClipboard: clipboardMock,
    };

    await exportToPng(opts);

    expect(clipboardMock).toHaveBeenCalledOnce();
    const arg = clipboardMock.mock.calls[0][0] as Blob;
    expect(arg).toBeInstanceOf(Blob);
    expect(arg.type).toBe("image/png");
  });

  it("download déclenché (createObjectURL appelé)", async () => {
    const container = makeSvgContainer();
    const opts: PngExportOpts = {
      container,
      rasterizeSvg: mockRasterize,
      writeClipboard: vi.fn().mockResolvedValue(undefined),
    };

    await exportToPng(opts);
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("sans SVG → pas de crash, writeClipboard non appelé", async () => {
    const empty = document.createElement("div");
    const clipboardMock = vi.fn().mockResolvedValue(undefined);
    const opts: PngExportOpts = {
      container: empty,
      rasterizeSvg: mockRasterize,
      writeClipboard: clipboardMock,
    };
    // Ne doit pas throw
    await expect(exportToPng(opts)).resolves.toBeUndefined();
    // Pas de blob → clipboard non appelé
    expect(clipboardMock).not.toHaveBeenCalled();
  });

  it("clipboard rejette → pas de crash (erreur swallowed, download quand même)", async () => {
    const container = makeSvgContainer();
    const clipboardFail = vi.fn().mockRejectedValue(new Error("Clipboard denied"));
    const opts: PngExportOpts = {
      container,
      rasterizeSvg: mockRasterize,
      writeClipboard: clipboardFail,
      skipDownload: false,
    };
    await expect(exportToPng(opts)).resolves.toBeUndefined();
    // Le download doit quand même être déclenché malgré le reject clipboard
    expect(URL.createObjectURL).toHaveBeenCalled();
  });

  it("hors ligne : aucune URL http dans le module", async () => {
    // On importe le texte source du module et on vérifie l'absence d'URL réseau.
    // Ce test est une validation statique (pas un test runtime).
    // Note : ce test suppose que le fichier ne contient pas de http://
    const mod = await import("../services/png-export?raw");
    const src = (mod as unknown as { default: string }).default;
    expect(src).not.toMatch(/https?:\/\//);
  });
});
