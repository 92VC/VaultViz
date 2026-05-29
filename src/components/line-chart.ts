// Courbe (line/area) maison en SVG — fiable, alimentée par DuckDB via le
// view-mounter (comme ranked-bars/grouped-bars), SANS passer par le
// coordinator vgplot (qui rendait vide en pratique). Axe X catégoriel
// (mois, année…) régulièrement espacé ; axe Y mis à l'échelle sur le max.
// Multi-séries : une polyligne par série, couleurs du palette/tokens.

import { fmt } from "../ui/format";

export interface LinePoint {
  x: string;
  y: number;
}
export interface LineSeries {
  label: string;
  points: LinePoint[];
}
export interface LineChartOpts {
  /** Format des valeurs (tooltip / axe) : « eur » | « pct » | « number ». */
  format?: string;
  /** Remplir sous la courbe (area) plutôt qu'un simple trait. */
  area?: boolean;
  /** Couleurs des séries (sinon rampe d'accent). */
  palette?: string[];
  title?: string;
  width?: number;
  height?: number;
}

const NS = "http://www.w3.org/2000/svg";
const DEFAULT_COLORS = [
  "var(--accent)",
  "#f59e0b",
  "#10b981",
  "#e11d48",
  "#8b5cf6",
];

function el(name: string, attrs: Record<string, string>): SVGElement {
  const n = document.createElementNS(NS, name);
  for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v);
  return n;
}

/**
 * Rend une ou plusieurs courbes dans `container` (idempotent). L'axe X est
 * l'union ordonnée des `x` de toutes les séries (catégoriel) ; chaque série
 * est une polyligne reliant ses points, plus un point par valeur (tooltip
 * natif). Légende si ≥ 2 séries.
 */
export function renderLineChart(
  container: HTMLElement,
  series: LineSeries[],
  opts: LineChartOpts = {},
): void {
  container.replaceChildren();
  const W = opts.width ?? 640;
  const H = opts.height ?? 280;
  const padL = 8;
  const padR = 12;
  const padT = 12;
  const padB = 26;
  const colors = opts.palette && opts.palette.length ? opts.palette : DEFAULT_COLORS;

  // Axe X : ordre d'apparition des x (toutes séries confondues).
  const xs: string[] = [];
  const seen = new Set<string>();
  for (const s of series) {
    for (const p of s.points) {
      if (!seen.has(p.x)) {
        seen.add(p.x);
        xs.push(p.x);
      }
    }
  }
  const maxY = Math.max(
    1,
    ...series.flatMap((s) => s.points.map((p) => p.y)),
  );
  const innerW = W - padL - padR;
  const innerH = H - padT - padB;
  const xPos = (x: string): number => {
    const i = xs.indexOf(x);
    return padL + (xs.length <= 1 ? innerW / 2 : (i / (xs.length - 1)) * innerW);
  };
  const yPos = (y: number): number => padT + innerH - (y / maxY) * innerH;

  if (opts.title) {
    const h = document.createElement("div");
    h.className = "rb-title";
    h.textContent = opts.title;
    container.appendChild(h);
  }

  // Légende multi-séries.
  if (series.length > 1) {
    const legend = document.createElement("div");
    legend.className = "legend";
    series.forEach((s, i) => {
      const item = document.createElement("span");
      item.className = "legend-item";
      const sw = document.createElement("span");
      sw.className = "legend-swatch";
      sw.style.background = colors[i % colors.length];
      item.appendChild(sw);
      item.appendChild(document.createTextNode(s.label));
      legend.appendChild(item);
    });
    container.appendChild(legend);
  }

  const svg = el("svg", {
    class: "vv-line-svg",
    viewBox: `0 0 ${W} ${H}`,
    preserveAspectRatio: "none",
    width: "100%",
  });

  // Ligne de base (axe X).
  svg.appendChild(
    el("line", {
      x1: String(padL),
      y1: String(padT + innerH),
      x2: String(padL + innerW),
      y2: String(padT + innerH),
      stroke: "var(--grid-line, #e2e8f0)",
      "stroke-width": "1",
    }),
  );

  series.forEach((s, si) => {
    const color = colors[si % colors.length];
    const pts = s.points.map((p) => `${xPos(p.x).toFixed(1)},${yPos(p.y).toFixed(1)}`);
    if (opts.area && pts.length) {
      const first = xPos(s.points[0].x);
      const last = xPos(s.points[s.points.length - 1].x);
      const base = padT + innerH;
      svg.appendChild(
        el("polygon", {
          points: `${first.toFixed(1)},${base} ${pts.join(" ")} ${last.toFixed(1)},${base}`,
          fill: color,
          "fill-opacity": "0.12",
          stroke: "none",
        }),
      );
    }
    svg.appendChild(
      el("polyline", {
        points: pts.join(" "),
        fill: "none",
        stroke: color,
        "stroke-width": "2",
        "stroke-linejoin": "round",
        "stroke-linecap": "round",
      }),
    );
    for (const p of s.points) {
      const dot = el("circle", {
        cx: xPos(p.x).toFixed(1),
        cy: yPos(p.y).toFixed(1),
        r: "2.5",
        fill: color,
      });
      const t = document.createElementNS(NS, "title");
      t.textContent = `${s.label ? s.label + " · " : ""}${p.x} : ${fmt(p.y, opts.format)}`;
      dot.appendChild(t);
      svg.appendChild(dot);
    }
  });

  // Étiquettes X (premier, milieu, dernier) pour repère temporel.
  const labelIdx = xs.length <= 1 ? [0] : [0, Math.floor((xs.length - 1) / 2), xs.length - 1];
  for (const i of [...new Set(labelIdx)]) {
    const tx = el("text", {
      x: xPos(xs[i]).toFixed(1),
      y: String(H - 8),
      "text-anchor": i === 0 ? "start" : i === xs.length - 1 ? "end" : "middle",
      "font-size": "10",
      fill: "var(--text-3, #94a3b8)",
    });
    tx.textContent = xs[i];
    svg.appendChild(tx);
  }

  container.appendChild(svg);
}
