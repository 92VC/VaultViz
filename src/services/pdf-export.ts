// B-131 — Service d'export PDF A4 paysage (exigence I-9 / UC-4).
//
// Génère un PDF A4 paysage composé des vues du dashboard actif :
//   - Vues SVG (charts, choroplèthe) : rastérisées en PNG via un rasterizer
//     injectable (défaut : XMLSerializer → <canvas> → toDataURL, après
//     résolution des var(--*) CSS).
//   - Cartes MapLibre WebGL (engine: "maplibre") : getCanvas().toDataURL()
//     après idle, avec captureMap injectable.
//   - Vues HTML DOM (KPI, table) : redraw pdf-lib primitives (b2).
//
// Invariant I-2 : ZÉRO URL réseau. Police Helvetica standard pdf-lib.
// Pas de fetch, pas d'endpoint. Polices CSS : Helvetica seulement.
//
// Pipeline :
//   PDFDocument.create() → addPage([841.89, 595.28]) // A4 paysage
//   → setTitle / setAuthor / setCreationDate
//   → Pour chaque vue SVG : embedPng → drawImage
//   → Pour chaque vue KPI  : drawRectangle + drawText
//   → save() → Uint8Array
//
// Refs: B-131, ADR-PDF

import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

/** Options passées à {@link exportToPdf}. */
export interface PdfExportOpts {
  /** Conteneur racine du dashboard actif (parcours des enfants pour les vues). */
  container: HTMLElement;
  /** Titre du dashboard (issu du `.vviz`). Metadata PDF. */
  title?: string;
  /** Auteur du document. Défaut : "VaultViz". */
  author?: string;
  /** Date de création. Défaut : now. */
  date?: Date;
  /**
   * Rasterizer SVG injectable — permet les tests sans canvas réel.
   * Signature : (svg: SVGElement) → Promise<Uint8Array | string>
   * - string : data URI "data:image/png;base64,..." OU base64 brut
   * - Uint8Array : octets PNG bruts
   * Par défaut : implémentation canvas (runtime navigateur).
   */
  rasterizeSvg?: (svg: SVGElement) => Promise<Uint8Array | string>;
  /**
   * Capture de carte MapLibre injectable.
   * Retourne null si pas de carte active, data URI PNG sinon.
   */
  captureMap?: (el: HTMLElement) => Promise<Uint8Array | string | null>;
}

// ── Dimensions A4 paysage (points PDF) ───────────────────────────────────────
const A4_LANDSCAPE: [number, number] = [841.89, 595.28];
const PAGE_W = A4_LANDSCAPE[0];
const PAGE_H = A4_LANDSCAPE[1];

// Marges et layout
const MARGIN = 30;
const HEADER_H = 28;       // espace réservé au titre en haut
const CONTENT_Y_MAX = PAGE_H - MARGIN - HEADER_H;

// ── Couleurs pdf-lib ──────────────────────────────────────────────────────────
const COLOR_TITLE   = rgb(0.15, 0.15, 0.20);
const COLOR_KPI_BG  = rgb(0.96, 0.97, 0.98);
const COLOR_KPI_VAL = rgb(0.08, 0.08, 0.12);
const COLOR_KPI_LBL = rgb(0.45, 0.47, 0.52);
const COLOR_RULE    = rgb(0.85, 0.86, 0.88);

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Inline les styles calculés dans un nœud SVG (résout les var(--*) CSS).
 * Appelé récursivement sur chaque élément SVG avant sérialisation.
 * Conforme au piège §3 de ADR-PDF.
 */
function inlineComputedStyles(el: Element): void {
  if (!(el instanceof SVGElement)) return;
  const computed = window.getComputedStyle(el);

  // Propriétés SVG présentant potentiellement des var(--*)
  const svgProps = ["fill", "stroke", "color", "stop-color", "opacity", "stroke-width"];
  for (const prop of svgProps) {
    const raw = el.getAttribute(prop);
    if (raw && raw.includes("var(")) {
      const resolved = computed.getPropertyValue(prop).trim();
      if (resolved) el.setAttribute(prop, resolved);
    }
  }

  // Récursion sur les enfants SVG
  for (const child of Array.from(el.children)) {
    inlineComputedStyles(child);
  }
}

/**
 * Rastérise un SVG en PNG via XMLSerializer → <canvas> → toDataURL.
 *
 * Trois pièges couverts (cf. ADR-PDF) :
 *  1. viewBox-only : on fixe width/height explicites sur le clone.
 *  2. var(--*) non résolues : on inline les styles calculés sur le clone
 *     (pas sur l'original — évite de muter le DOM live).
 *  3. Accents dans le SVG : data URI charset=utf-8 + encodeURIComponent.
 *
 * Fonctionne uniquement en runtime navigateur (nécessite canvas et Image).
 */
async function defaultRasterizeSvg(svg: SVGElement): Promise<Uint8Array | string> {
  // ── Étape 1 : cloner le SVG (ne pas muter l'original) ─────────────────────
  // On attache temporairement le clone dans un off-screen pour que
  // getComputedStyle() resolve les var(--*) de façon fiable.
  const offscreen = document.createElement("div");
  offscreen.style.cssText = "position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;overflow:hidden";

  let width = 600;
  let height = 400;
  let svgStr: string;

  document.body.appendChild(offscreen);
  try {
    const clone = svg.cloneNode(true) as SVGElement;
    offscreen.appendChild(clone);

    // ── Étape 2 : dimensions explicites (piège viewBox-only) ────────────────
    const existingW = clone.getAttribute("width");
    const existingH = clone.getAttribute("height");
    if (existingW && existingH && !existingW.includes("%") && !existingH.includes("%")) {
      width = parseInt(existingW, 10) || 600;
      height = parseInt(existingH, 10) || 400;
    } else {
      const vb = clone.getAttribute("viewBox");
      if (vb) {
        const parts = vb.split(/[\s,]+/).filter(Boolean);
        if (parts.length === 4) {
          width = parseFloat(parts[2]) || 600;
          height = parseFloat(parts[3]) || 400;
        }
      }
      clone.setAttribute("width", String(width));
      clone.setAttribute("height", String(height));
    }

    // ── Étape 3 : inline les styles calculés (var(--*) résolus via offscreen)
    inlineComputedStyles(clone);

    // ── Étape 4 : sérialisation + data URI ──────────────────────────────────
    svgStr = new XMLSerializer().serializeToString(clone);
  } finally {
    // Cleanup garanti même si une exception survient pendant le traitement.
    document.body.removeChild(offscreen);
  }

  // charset=utf-8 + encodeURIComponent : gère les accents et caractères >ASCII
  const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx2d = canvas.getContext("2d");
      if (!ctx2d) {
        reject(new Error("Canvas 2D non disponible"));
        return;
      }
      ctx2d.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Impossible de charger le SVG comme image"));
    img.src = dataUrl;
  });
}

/**
 * Extrait les données textuelles d'une carte KPI depuis le DOM.
 * Lit .k-label (titre) et .k-val (valeur).
 */
interface KpiData { label: string; value: string }

function extractKpiData(el: HTMLElement): KpiData | null {
  const kpiCard = el.querySelector(".card.kpi") ?? el.closest(".card.kpi");
  if (!kpiCard) return null;
  const label = (kpiCard.querySelector(".k-label") as HTMLElement | null)?.textContent?.trim() ?? "";
  const value = (kpiCard.querySelector(".k-val") as HTMLElement | null)?.textContent?.trim() ?? "";
  return { label, value };
}

/**
 * Normalise un data URI PNG ou un Uint8Array en Uint8Array exploitable par pdf-lib.
 */
function normalizeImageData(data: Uint8Array | string): Uint8Array {
  if (data instanceof Uint8Array) return data;
  // data URI : "data:image/png;base64,<base64>"
  const marker = ";base64,";
  const idx = data.indexOf(marker);
  if (idx === -1) {
    // Essayer d'interpréter comme base64 brut
    const binary = atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }
  const b64 = data.slice(idx + marker.length);
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

// ── Export principal ──────────────────────────────────────────────────────────

/**
 * Compose un PDF A4 paysage à partir des vues du dashboard actif.
 *
 * @param opts Options d'export (conteneur, titre, rasterizer injectable…)
 * @returns Octets du PDF généré (commence par "%PDF").
 */
export async function exportToPdf(opts: PdfExportOpts): Promise<Uint8Array> {
  const {
    container,
    title = "VaultViz Dashboard",
    author = "VaultViz",
    date = new Date(),
    rasterizeSvg = defaultRasterizeSvg,
    captureMap,
  } = opts;

  const pdfDoc = await PDFDocument.create();

  // Métadonnées
  pdfDoc.setTitle(title);
  pdfDoc.setAuthor(author);
  pdfDoc.setCreationDate(date);

  // Police standard (hors ligne — zéro URL)
  const helvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const helveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  // ── Collecte des vues du dashboard ────────────────────────────────────────
  // On cherche les SVG de charts et les cartes KPI dans le conteneur.
  const svgEls = Array.from(container.querySelectorAll<SVGElement>("svg"));
  const kpiEls = Array.from(container.querySelectorAll<HTMLElement>(".card.kpi"));
  // Canvas MapLibre (engine: "maplibre") — rendu WebGL, pas de SVG.
  const mapCanvases = Array.from(
    container.querySelectorAll<HTMLCanvasElement>("canvas.maplibregl-canvas"),
  );
  // Vues DOM sans SVG NI .card.kpi → non rastérisables ici : on pose un
  // placeholder VISIBLE pour signaler qu'elles ne sont pas exportées.
  // (.bars = ranked_bars, .qbars = grouped_bars, .vv-table = table)
  const placeholderViews: Array<{ el: HTMLElement; label: string }> = [];
  for (const sel of [
    { selector: ".bars", type: "barres classées" },
    { selector: ".qbars", type: "barres groupées" },
    { selector: ".vv-table", type: "tableau" },
  ]) {
    for (const el of Array.from(
      container.querySelectorAll<HTMLElement>(sel.selector),
    )) {
      // Éviter les doublons si une vue contient un SVG capturé par ailleurs.
      if (el.querySelector("svg")) continue;
      placeholderViews.push({ el, label: sel.type });
    }
  }

  // ── Page 1 : A4 paysage ───────────────────────────────────────────────────
  const page = pdfDoc.addPage(A4_LANDSCAPE);

  // En-tête : titre du dashboard
  page.drawText(title, {
    x: MARGIN,
    y: PAGE_H - MARGIN - 14,
    size: 14,
    font: helveticaBold,
    color: COLOR_TITLE,
    maxWidth: PAGE_W - 2 * MARGIN,
  });

  // Ligne de séparation sous le titre
  page.drawLine({
    start: { x: MARGIN, y: PAGE_H - MARGIN - HEADER_H },
    end:   { x: PAGE_W - MARGIN, y: PAGE_H - MARGIN - HEADER_H },
    thickness: 0.5,
    color: COLOR_RULE,
  });

  // ── Placement des vues ────────────────────────────────────────────────────
  // Stratégie simple : grille adaptative.
  // - KPI : bandeau horizontal en haut de la zone contenu
  // - SVG charts : zone principale sous les KPI

  let cursorY = CONTENT_Y_MAX - 2; // début zone contenu (depuis le haut)

  // Bandeau KPI (si présents)
  if (kpiEls.length > 0) {
    const KPI_CARD_W = Math.min(160, (PAGE_W - 2 * MARGIN) / kpiEls.length - 8);
    const KPI_CARD_H = 60;
    const kpiZoneW = PAGE_W - 2 * MARGIN;
    const spacing = kpiEls.length > 1
      ? (kpiZoneW - KPI_CARD_W * kpiEls.length) / (kpiEls.length - 1)
      : 0;

    for (let i = 0; i < kpiEls.length; i++) {
      const kpiData = extractKpiData(kpiEls[i]);
      if (!kpiData) continue;

      const x = MARGIN + i * (KPI_CARD_W + spacing);
      const y = cursorY - KPI_CARD_H;

      // Fond de la carte KPI
      page.drawRectangle({
        x,
        y,
        width: KPI_CARD_W,
        height: KPI_CARD_H,
        color: COLOR_KPI_BG,
        borderColor: COLOR_RULE,
        borderWidth: 0.5,
      });

      // Libellé (en haut de la carte)
      page.drawText(kpiData.label.slice(0, 22), {
        x: x + 8,
        y: y + KPI_CARD_H - 16,
        size: 7,
        font: helvetica,
        color: COLOR_KPI_LBL,
        maxWidth: KPI_CARD_W - 10,
      });

      // Valeur (au centre)
      page.drawText(kpiData.value.slice(0, 18), {
        x: x + 8,
        y: y + KPI_CARD_H / 2 - 6,
        size: 13,
        font: helveticaBold,
        color: COLOR_KPI_VAL,
        maxWidth: KPI_CARD_W - 10,
      });
    }

    cursorY -= KPI_CARD_H + 10;
  }

  // ── Tuiles de contenu : SVG + cartes MapLibre + placeholders ──────────────
  // Chaque tuile porte une fonction de rendu prenant son rectangle cible.
  // Une tuile « image » embed une image PNG (SVG rastérisé ou canvas WebGL) ;
  // une tuile « placeholder » dessine un rectangle grisé + texte explicatif.
  type Tile = (x: number, y: number, w: number, h: number) => Promise<void>;

  /** Dessine un placeholder grisé visible pour une vue non exportable. */
  function drawPlaceholder(
    x: number,
    y: number,
    w: number,
    h: number,
    text: string,
  ): void {
    page.drawRectangle({
      x,
      y,
      width: w,
      height: h,
      color: rgb(0.95, 0.95, 0.95),
      borderColor: COLOR_RULE,
      borderWidth: 0.5,
    });
    page.drawText(text, {
      x: x + 8,
      y: y + h / 2 - 4,
      size: 8,
      font: helvetica,
      color: COLOR_KPI_LBL,
      maxWidth: w - 16,
    });
  }

  /** Tuile image : embed des octets PNG dans le rectangle (scaleToFit). */
  async function drawImageBytes(
    bytes: Uint8Array,
    x: number,
    y: number,
    w: number,
    h: number,
  ): Promise<void> {
    const pdfImage = await pdfDoc.embedPng(bytes);
    const scaled = pdfImage.scaleToFit(w, h);
    page.drawImage(pdfImage, { x, y, width: scaled.width, height: scaled.height });
  }

  const tiles: Tile[] = [];

  // Tuiles SVG (charts maison, choroplèthe SVG).
  for (const svg of svgEls) {
    tiles.push(async (x, y, w, h) => {
      try {
        const imageData = await rasterizeSvg(svg);
        await drawImageBytes(normalizeImageData(imageData), x, y, w, h);
      } catch {
        drawPlaceholder(x, y, w, h, "[vue non disponible]");
      }
    });
  }

  // Tuiles MapLibre WebGL : captureMap injectable, défaut = canvas.toDataURL()
  // (le canvas a preserveDrawingBuffer:true, cf. map-libre.ts).
  for (const canvas of mapCanvases) {
    tiles.push(async (x, y, w, h) => {
      try {
        const captured = captureMap
          ? await captureMap(canvas)
          : canvas.toDataURL("image/png");
        if (captured == null) {
          drawPlaceholder(x, y, w, h, "[carte non disponible]");
          return;
        }
        await drawImageBytes(normalizeImageData(captured), x, y, w, h);
      } catch {
        drawPlaceholder(x, y, w, h, "[carte non disponible]");
      }
    });
  }

  // Tuiles placeholder : vues DOM non rastérisables (ranked/grouped/table).
  for (const pv of placeholderViews) {
    tiles.push(async (x, y, w, h) => {
      drawPlaceholder(
        x,
        y,
        w,
        h,
        `[vue ${pv.label} — export PDF non disponible dans cette version]`,
      );
    });
  }

  // ── Placement en grille des tuiles ────────────────────────────────────────
  if (tiles.length > 0) {
    const zoneW = PAGE_W - 2 * MARGIN;
    const zoneH = cursorY - MARGIN;

    if (zoneH > 20 && zoneW > 20) {
      const cols = tiles.length > 1 ? 2 : 1;
      const rows = Math.ceil(tiles.length / cols);
      const cellW = (zoneW - (cols - 1) * 10) / cols;
      const cellH = Math.min((zoneH - (rows - 1) * 10) / rows, 200);

      for (let i = 0; i < tiles.length; i++) {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = MARGIN + col * (cellW + 10);
        const y = cursorY - (row + 1) * (cellH + 10) + 10;

        if (y < MARGIN) break; // débordement — on s'arrête proprement
        await tiles[i](x, y, cellW, cellH);
      }
    }
  }

  // ── Pied de page : date de génération ────────────────────────────────────
  const dateStr = date.toLocaleDateString("fr-FR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  page.drawText(`Généré le ${dateStr} — VaultViz`, {
    x: MARGIN,
    y: MARGIN / 2,
    size: 7,
    font: helvetica,
    color: COLOR_KPI_LBL,
  });

  return pdfDoc.save();
}

// ── Helpers de déclenchement (front) ─────────────────────────────────────────

/**
 * Déclenche le téléchargement d'un PDF depuis un Uint8Array.
 * Fonctionne en environnement navigateur (WebView2).
 * Pour Tauri : utiliser writeFile via IPC à la place.
 */
export function downloadPdf(bytes: Uint8Array, filename = "vaultviz-export.pdf"): void {
  // Copie systématique vers un ArrayBuffer garanti (SharedArrayBuffer non
  // accepté par Blob) — pdf-lib.save() peut retourner Uint8Array<ArrayBufferLike>.
  const safe = new Uint8Array(bytes) as Uint8Array<ArrayBuffer>;
  const blob = new Blob([safe], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
