// B-132 — Service d'export PNG (presse-papier + fichier).
//
// Capture la vue active (premier SVG ou canvas MapLibre dans le conteneur) en
// PNG haute résolution :
//   (a) presse-papier via `navigator.clipboard.write([ClipboardItem])` ;
//   (b) fichier `.png` via `URL.createObjectURL` + `<a download>`.
//
// Rastérisation SVG : réutilise la même pipeline que `pdf-export.ts`
// (XMLSerializer → data URI → <canvas> → toBlob). Le rasterizer est injectable
// pour les tests (pas de canvas réel en happy-dom).
//
// ClipboardItem / clipboard.write : injectables (`writeClipboard`) pour
// les tests (happy-dom ne les implémente pas).
//
// Invariant I-2 : ZÉRO URL réseau.
// Refs: B-132

/** Scalefactor haute résolution (2× DevicePixelRatio standard). */
const HI_RES_SCALE = 2;

// ── Helpers partagés avec pdf-export ────────────────────────────────────────
//
// Ces helpers reproduisent la même logique que `pdf-export.ts`
// (`inlineComputedStyles`, `defaultRasterizeSvg`) mais l'objectif est de les
// réutiliser ici. On exporte la fonction rasterize pour qu'elle soit partageable
// si on veut factoriser plus tard. Elle est aussi injectable pour les tests.

/**
 * Inline les styles calculés dans un nœud SVG (résout les var(--*) CSS).
 * Appelé récursivement sur chaque élément SVG avant sérialisation.
 */
function inlineComputedStyles(el: Element): void {
  if (!(el instanceof SVGElement)) return;
  const computed = window.getComputedStyle(el);
  const svgProps = ["fill", "stroke", "color", "stop-color", "opacity", "stroke-width"];
  for (const prop of svgProps) {
    const raw = el.getAttribute(prop);
    if (raw && raw.includes("var(")) {
      const resolved = computed.getPropertyValue(prop).trim();
      if (resolved) el.setAttribute(prop, resolved);
    }
  }
  for (const child of Array.from(el.children)) {
    inlineComputedStyles(child);
  }
}

/**
 * Rastérise un SVGElement en data URI PNG haute résolution via canvas.
 * Même pipeline que pdf-export.ts, avec scaleFactor pour la haute résolution.
 *
 * @param svg SVGElement à rastériser.
 * @param scale Facteur de résolution (défaut : HI_RES_SCALE = 2).
 * @returns Data URI "data:image/png;base64,…" ou Uint8Array.
 */
export async function rasterizeSvgToPng(
  svg: SVGElement,
  scale = HI_RES_SCALE,
): Promise<Uint8Array | string> {
  const offscreen = document.createElement("div");
  offscreen.style.cssText =
    "position:absolute;visibility:hidden;pointer-events:none;width:0;height:0;overflow:hidden";

  let width = 600;
  let height = 400;
  let svgStr: string;

  document.body.appendChild(offscreen);
  try {
    const clone = svg.cloneNode(true) as SVGElement;
    offscreen.appendChild(clone);

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

    inlineComputedStyles(clone);
    svgStr = new XMLSerializer().serializeToString(clone);
  } finally {
    document.body.removeChild(offscreen);
  }

  const dataUrl = "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svgStr);

  return new Promise<string>((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx2d = canvas.getContext("2d");
      if (!ctx2d) {
        reject(new Error("Canvas 2D non disponible"));
        return;
      }
      ctx2d.scale(scale, scale);
      ctx2d.drawImage(img, 0, 0);
      resolve(canvas.toDataURL("image/png"));
    };
    img.onerror = () => reject(new Error("Impossible de charger le SVG comme image"));
    img.src = dataUrl;
  });
}

/**
 * Normalise un data URI PNG ou un Uint8Array en Uint8Array d'octets PNG bruts.
 */
function normalizeImageData(data: Uint8Array | string): Uint8Array {
  if (data instanceof Uint8Array) return data;
  const marker = ";base64,";
  const idx = data.indexOf(marker);
  if (idx === -1) {
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

// ── Options ──────────────────────────────────────────────────────────────────

/** Options passées à {@link captureToPng} et {@link exportToPng}. */
export interface PngExportOpts {
  /** Conteneur racine de la vue active (on prend le premier SVG ou canvas MapLibre). */
  container: HTMLElement;
  /**
   * Rasterizer SVG injectable (test / runtime).
   * Défaut : `rasterizeSvgToPng` (canvas réel, haute résolution).
   */
  rasterizeSvg?: (svg: SVGElement) => Promise<Uint8Array | string>;
  /**
   * Capture de canvas MapLibre injectable.
   * Défaut : `canvas.toDataURL("image/png")`.
   */
  captureCanvas?: (canvas: HTMLCanvasElement) => Promise<Uint8Array | string>;
  /**
   * Fonction d'écriture clipboard injectable.
   * Signature : `(blob: Blob) => Promise<void>`.
   * Défaut : `navigator.clipboard.write([new ClipboardItem({"image/png": blob})])`.
   */
  writeClipboard?: (blob: Blob) => Promise<void>;
  /** Si `true`, ne déclenche PAS le download fichier (utile pour les tests). */
  skipDownload?: boolean;
  /** Nom du fichier `.png` téléchargé. Défaut : "vaultviz-export.png". */
  filename?: string;
}

// ── Implémentations par défaut ────────────────────────────────────────────────

/** Écriture clipboard par défaut (runtime navigateur). */
async function defaultWriteClipboard(blob: Blob): Promise<void> {
  await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
}

/** Capture de canvas MapLibre par défaut. */
async function defaultCaptureCanvas(
  canvas: HTMLCanvasElement,
): Promise<string> {
  return canvas.toDataURL("image/png");
}

// ── API publique ──────────────────────────────────────────────────────────────

/**
 * Capture le contenu de la vue active en Blob PNG.
 *
 * Stratégie :
 *   1. Premier `<svg>` dans le conteneur → rastérisation haute résolution.
 *   2. Sinon, premier `canvas.maplibregl-canvas` → capture WebGL.
 *   3. Aucune vue capturable → retourne `null`.
 *
 * @returns Blob image/png ou null si aucune vue capturable.
 */
export async function captureToPng(
  container: HTMLElement,
  opts: Pick<PngExportOpts, "rasterizeSvg" | "captureCanvas"> = {},
): Promise<Blob | null> {
  const rasterize = opts.rasterizeSvg ?? rasterizeSvgToPng;
  const capture = opts.captureCanvas ?? defaultCaptureCanvas;

  // 1. SVG (charts, choroplèthe SVG)
  const svg = container.querySelector<SVGElement>("svg");
  if (svg) {
    const data = await rasterize(svg);
    // Copie vers ArrayBuffer garanti (SharedArrayBuffer non accepté par Blob).
    const safe = new Uint8Array(normalizeImageData(data)) as Uint8Array<ArrayBuffer>;
    return new Blob([safe], { type: "image/png" });
  }

  // 2. Canvas MapLibre WebGL
  const mapCanvas = container.querySelector<HTMLCanvasElement>(
    "canvas.maplibregl-canvas",
  );
  if (mapCanvas) {
    const data = await capture(mapCanvas);
    const safe = new Uint8Array(normalizeImageData(data)) as Uint8Array<ArrayBuffer>;
    return new Blob([safe], { type: "image/png" });
  }

  return null;
}

/**
 * Déclenche le téléchargement d'un Blob PNG comme fichier.
 *
 * @param blob Blob image/png à télécharger.
 * @param filename Nom du fichier. Défaut : "vaultviz-export.png".
 */
export function downloadPng(blob: Blob, filename = "vaultviz-export.png"): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Export PNG complet : capture la vue active, l'écrit dans le presse-papier
 * ET la télécharge comme fichier.
 *
 * - Presse-papier : `navigator.clipboard.write` (injectable via `writeClipboard`).
 * - Fichier : `URL.createObjectURL` + `<a download>` (injectable via `skipDownload`).
 * - Si clipboard rejette (permissions) : swallow + download quand même.
 * - Si aucune vue capturable : no-op silencieux.
 *
 * @param opts Options avec injectables pour les tests.
 */
export async function exportToPng(opts: PngExportOpts): Promise<void> {
  const {
    container,
    rasterizeSvg,
    captureCanvas,
    writeClipboard = defaultWriteClipboard,
    skipDownload = false,
    filename = "vaultviz-export.png",
  } = opts;

  const blob = await captureToPng(container, { rasterizeSvg, captureCanvas });
  if (!blob) return; // aucune vue capturable

  // Clipboard (best-effort : une erreur de permission ne doit pas bloquer le dl)
  try {
    await writeClipboard(blob);
  } catch (err) {
    console.warn("[VaultViz] Clipboard write échoué :", err);
  }

  // Download fichier
  if (!skipDownload) {
    downloadPng(blob, filename);
  }
}
