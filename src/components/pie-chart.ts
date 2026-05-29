// Camembert (pie/donut) maison en SVG — type de vue générique `pie`,
// alimenté par DuckDB (label, valeur) via le view-mounter. Part-of-whole :
// répartition d'un total en parts. Légende avec valeur + pourcentage.

import { fmt } from "../ui/format";

export interface PieSlice {
  label: string;
  value: number;
}
export interface PieChartOpts {
  format?: string;
  palette?: string[];
  title?: string;
  size?: number;
  /** Trou central (donut) en fraction du rayon (0 = camembert plein). */
  donut?: number;
}

const NS = "http://www.w3.org/2000/svg";
const DEFAULT_COLORS = [
  "var(--accent)",
  "#f59e0b",
  "#10b981",
  "#e11d48",
  "#8b5cf6",
  "#0ea5e9",
  "#ec4899",
  "#84cc16",
];

function arcPath(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const x0 = cx + r * Math.cos(a0);
  const y0 = cy + r * Math.sin(a0);
  const x1 = cx + r * Math.cos(a1);
  const y1 = cy + r * Math.sin(a1);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${large} 1 ${x1.toFixed(2)} ${y1.toFixed(2)} Z`;
}

/**
 * Rend un camembert dans `container` (idempotent). Une part par tranche,
 * angle proportionnel à la valeur ; légende `label — valeur (xx %)`.
 */
export function renderPieChart(
  container: HTMLElement,
  slices: PieSlice[],
  opts: PieChartOpts = {},
): void {
  container.replaceChildren();
  const colors = opts.palette && opts.palette.length ? opts.palette : DEFAULT_COLORS;
  const total = slices.reduce((s, x) => s + (x.value > 0 ? x.value : 0), 0);
  const size = opts.size ?? 200;
  const r = size / 2 - 2;
  const cx = size / 2;
  const cy = size / 2;

  if (opts.title) {
    const h = document.createElement("div");
    h.className = "rb-title";
    h.textContent = opts.title;
    container.appendChild(h);
  }

  const wrap = document.createElement("div");
  wrap.className = "pie-wrap";

  const svg = document.createElementNS(NS, "svg");
  svg.setAttribute("class", "vv-pie-svg");
  svg.setAttribute("viewBox", `0 0 ${size} ${size}`);
  svg.setAttribute("width", String(size));
  svg.setAttribute("height", String(size));

  let angle = -Math.PI / 2; // démarre en haut
  slices.forEach((s, i) => {
    if (s.value <= 0 || total <= 0) return;
    const frac = s.value / total;
    const a1 = angle + frac * 2 * Math.PI;
    const path = document.createElementNS(NS, "path");
    path.setAttribute("d", arcPath(cx, cy, r, angle, a1));
    path.setAttribute("fill", colors[i % colors.length]);
    path.setAttribute("stroke", "var(--surface-1, #fff)");
    path.setAttribute("stroke-width", "1.5");
    const t = document.createElementNS(NS, "title");
    t.textContent = `${s.label} : ${fmt(s.value, opts.format)} (${(frac * 100).toFixed(1)} %)`;
    path.appendChild(t);
    svg.appendChild(path);
    angle = a1;
  });

  if (opts.donut && opts.donut > 0 && opts.donut < 1) {
    const hole = document.createElementNS(NS, "circle");
    hole.setAttribute("cx", String(cx));
    hole.setAttribute("cy", String(cy));
    hole.setAttribute("r", String(r * opts.donut));
    hole.setAttribute("fill", "var(--surface-1, #fff)");
    svg.appendChild(hole);
  }
  wrap.appendChild(svg);

  // Légende.
  const legend = document.createElement("div");
  legend.className = "legend pie-legend";
  slices.forEach((s, i) => {
    const item = document.createElement("span");
    item.className = "legend-item";
    const sw = document.createElement("span");
    sw.className = "legend-swatch";
    sw.style.background = colors[i % colors.length];
    item.appendChild(sw);
    const pct = total > 0 ? ((s.value / total) * 100).toFixed(1) : "0";
    item.appendChild(
      document.createTextNode(`${s.label} — ${fmt(s.value, opts.format)} (${pct} %)`),
    );
    legend.appendChild(item);
  });
  wrap.appendChild(legend);

  container.appendChild(wrap);
}
