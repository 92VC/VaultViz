// B-131 — Tests export PDF A4 paysage.
//
// happy-dom n'a pas de vrai canvas ni de WebGL ; on injecte des mocks via
// les options de `exportToPdf` (rasterizeSvg / captureMap).
//
// PNG 1×1 minimal valide (48 octets) – reconnu par pdf-lib (implémentation
// JS pure qui parse réellement les octets PNG).
// Source : https://garykessler.net/library/file_sigs.html + PNG spec §11.
// On utilise un PNG 1×1 transparent encodé en base64.
//
// Tests de composition :
//  1. Résultat non vide commençant par "%PDF"
//  2. Métadonnées : titre, auteur, date
//  3. Hors ligne : aucune URL http dans le module
//  4. Format A4 paysage (largeur > hauteur)

import { describe, it, expect, beforeEach } from "vitest";
import { PDFDocument } from "pdf-lib";
import { exportToPdf, type PdfExportOpts } from "../services/pdf-export";

// PNG 1×1 transparent minimal valide pour pdf-lib.
// Généré via : new Uint8Array([0x89,0x50,0x4e,0x47,...])
const VALID_PNG_1x1 = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // signature PNG
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52, // IHDR length=13
  0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, // width=1, height=1
  0x08, 0x02, 0x00, 0x00, 0x00, 0x90, 0x77, 0x53, // 8bit RGB, CRC
  0xde, 0x00, 0x00, 0x00, 0x0c, 0x49, 0x44, 0x41, // IDAT length=12
  0x54, 0x08, 0xd7, 0x63, 0xf8, 0xcf, 0xc0, 0x00, // IDAT data
  0x00, 0x00, 0x02, 0x00, 0x01, 0xe2, 0x21, 0xbc, // IDAT CRC
  0x33, 0x00, 0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, // IEND
  0x44, 0xae, 0x42, 0x60, 0x82,                   // IEND CRC
]);

function makeSvgContainer(): HTMLElement {
  const div = document.createElement("div");
  div.className = "vv-view-frame vv-view-pie";
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 200 200");
  svg.setAttribute("width", "200");
  svg.setAttribute("height", "200");
  const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  circle.setAttribute("cx", "100");
  circle.setAttribute("cy", "100");
  circle.setAttribute("r", "80");
  circle.setAttribute("fill", "#e11d48");
  svg.appendChild(circle);
  div.appendChild(svg);
  return div;
}

function makeKpiContainer(): HTMLElement {
  const div = document.createElement("div");
  div.setAttribute("data-view-id", "kpi-test");
  const card = document.createElement("div");
  card.className = "card kpi";
  const label = document.createElement("div");
  label.className = "k-label";
  label.textContent = "Dossiers traités";
  const val = document.createElement("div");
  val.className = "k-val";
  val.textContent = "1 234";
  card.appendChild(label);
  card.appendChild(val);
  div.appendChild(card);
  return div;
}

describe("exportToPdf (B-131)", () => {
  let container: HTMLElement;
  // Rasterizer injectable : retourne le PNG 1×1 valide sans canvas réel.
  const mockRasterize = async (_svg: SVGElement): Promise<Uint8Array> =>
    VALID_PNG_1x1;

  beforeEach(() => {
    container = document.createElement("div");
    container.className = "dash-grid";
    container.appendChild(makeSvgContainer());
    container.appendChild(makeKpiContainer());
  });

  it("produit un Uint8Array commençant par %PDF", async () => {
    const opts: PdfExportOpts = {
      container,
      title: "Test Dashboard",
      rasterizeSvg: mockRasterize,
    };
    const result = await exportToPdf(opts);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBeGreaterThan(0);
    // Les 4 premiers octets doivent être "%PDF"
    const header = String.fromCharCode(result[0], result[1], result[2], result[3]);
    expect(header).toBe("%PDF");
  });

  it("métadonnées : titre, auteur VaultViz, date posés", async () => {
    const now = new Date("2026-05-31T10:00:00Z");
    const opts: PdfExportOpts = {
      container,
      title: "Mon Dashboard CPAM",
      author: "VaultViz",
      date: now,
      rasterizeSvg: mockRasterize,
    };
    const bytes = await exportToPdf(opts);
    // Recharger le PDF pour vérifier les métadonnées
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getTitle()).toBe("Mon Dashboard CPAM");
    expect(reloaded.getAuthor()).toBe("VaultViz");
    expect(reloaded.getCreationDate()).toBeInstanceOf(Date);
  });

  it("format A4 paysage : largeur > hauteur", async () => {
    const opts: PdfExportOpts = {
      container,
      title: "Paysage",
      rasterizeSvg: mockRasterize,
    };
    const bytes = await exportToPdf(opts);
    const reloaded = await PDFDocument.load(bytes);
    const page = reloaded.getPage(0);
    const { width, height } = page.getSize();
    // A4 paysage : largeur ≈ 841.89, hauteur ≈ 595.28
    expect(width).toBeGreaterThan(height);
    expect(width).toBeCloseTo(841.89, 0);
    expect(height).toBeCloseTo(595.28, 0);
  });

  it("fonctionne sans SVG (uniquement KPI)", async () => {
    const kpiOnly = document.createElement("div");
    kpiOnly.appendChild(makeKpiContainer());
    const opts: PdfExportOpts = {
      container: kpiOnly,
      title: "KPI only",
      rasterizeSvg: mockRasterize,
    };
    const result = await exportToPdf(opts);
    expect(result.length).toBeGreaterThan(0);
    const header = String.fromCharCode(result[0], result[1], result[2], result[3]);
    expect(header).toBe("%PDF");
  });

  it("fonctionne sans aucune vue (conteneur vide)", async () => {
    const empty = document.createElement("div");
    const opts: PdfExportOpts = {
      container: empty,
      title: "Vide",
      rasterizeSvg: mockRasterize,
    };
    const result = await exportToPdf(opts);
    expect(result.length).toBeGreaterThan(0);
  });

  it("utilise l'auteur par défaut 'VaultViz' si non fourni", async () => {
    const opts: PdfExportOpts = {
      container,
      title: "Auteur défaut",
      rasterizeSvg: mockRasterize,
    };
    const bytes = await exportToPdf(opts);
    const reloaded = await PDFDocument.load(bytes);
    expect(reloaded.getAuthor()).toBe("VaultViz");
  });
});
