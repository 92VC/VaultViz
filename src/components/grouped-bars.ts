// SP3 / T3.4 — Composant barres appariées (deux séries par catégorie).
//
// Porté visuellement depuis `renderQuarters` et le markup `.qbars`/`.qgroup`/
// `.qpair`/`.qbar.budget`/`.qbar.realise`/`.qlab` de la maquette
// (`mockups/VaultViz/assets/app.js`), plus la légende Budget/Réalisé de
// `VaultViz.html`. Le CSS associé (`.qbars`, `.qgroup`, etc.) fournit la
// mise en page ; ce composant se contente d'émettre le DOM correspondant.
//
// Pure DOM, idempotent : un nouvel appel sur le même container remplace
// intégralement son contenu.

import { fmt } from "../ui/format";

export interface GroupedRow {
  /** Libellé de la catégorie (axe X). */
  k: string;
  /** Première série (ex. budget) — surface neutre. */
  v1: number;
  /** Seconde série (ex. réalisé) — accent. */
  v2: number;
}

export interface GroupedBarsOpts {
  /** Libellés des deux séries pour la légende. Défaut ["Série 1","Série 2"]. */
  seriesLabels?: [string, string];
  /** Format des valeurs dans les tooltips (cf. `fmt`). */
  format?: string;
  /** Titre optionnel (tooltip de la légende / non rendu structurellement). */
  title?: string;
}

const DEFAULT_LABELS: [string, string] = ["Série 1", "Série 2"];

/**
 * Rend des barres appariées (deux séries par catégorie) dans `container`.
 *
 * Pour chaque row : un `.qgroup` contenant une `.qpair` de deux `.qbar`
 * verticales dont la hauteur vaut `valeur / max * 100 %` (max calculé sur
 * l'ensemble des v1 et v2), v1 en `.budget` (surface neutre), v2 en
 * `.realise` (accent), suivies d'un label `.qlab` égal à `k`. Chaque barre
 * porte un `title` avec sa valeur formatée. Une légende optionnelle reprend
 * `seriesLabels`.
 */
export function renderGroupedBars(
  container: HTMLElement,
  rows: GroupedRow[],
  opts: GroupedBarsOpts = {},
): void {
  const labels = opts.seriesLabels ?? DEFAULT_LABELS;
  const format = opts.format;

  // Idempotence : on repart d'un container vide.
  container.replaceChildren();

  // max sur toutes les valeurs des deux séries ; garde-fou contre /0.
  const max = rows.reduce(
    (m, r) => Math.max(m, r.v1, r.v2),
    0,
  );
  const safeMax = max > 0 ? max : 1;

  // Légende (optionnelle, mais toujours rendue avec libellés par défaut).
  const legend = document.createElement("div");
  legend.className = "legend";
  if (opts.title) legend.title = opts.title;
  legend.appendChild(makeLegendItem(labels[0], "budget"));
  legend.appendChild(makeLegendItem(labels[1], "realise"));
  container.appendChild(legend);

  // Tooltip custom au survol (le `title` natif est peu fiable / invisible
  // dans la WebView). Un seul élément, positionné en `fixed` au curseur.
  const tip = document.createElement("div");
  tip.className = "vv-tooltip";
  tip.hidden = true;
  container.appendChild(tip);
  const showTip = (text: string, e: MouseEvent): void => {
    tip.textContent = text;
    tip.hidden = false;
    tip.style.left = `${e.clientX + 12}px`;
    tip.style.top = `${e.clientY + 12}px`;
  };
  const moveTip = (e: MouseEvent): void => {
    tip.style.left = `${e.clientX + 12}px`;
    tip.style.top = `${e.clientY + 12}px`;
  };
  const hideTip = (): void => {
    tip.hidden = true;
  };
  const bindTip = (bar: HTMLElement, text: string): void => {
    bar.addEventListener("mouseenter", (e) => showTip(text, e as MouseEvent));
    bar.addEventListener("mousemove", (e) => moveTip(e as MouseEvent));
    bar.addEventListener("mouseleave", hideTip);
  };

  const bars = document.createElement("div");
  bars.className = "qbars";

  for (const r of rows) {
    const group = document.createElement("div");
    group.className = "qgroup";

    const pair = document.createElement("div");
    pair.className = "qpair";
    const b1 = makeBar(r.v1, safeMax, "budget", `${labels[0]} ${fmt(r.v1, format)}`);
    const b2 = makeBar(r.v2, safeMax, "realise", `${labels[1]} ${fmt(r.v2, format)}`);
    bindTip(b1, `${labels[0]} · ${fmt(r.v1, format)}`);
    bindTip(b2, `${labels[1]} · ${fmt(r.v2, format)}`);
    pair.appendChild(b1);
    pair.appendChild(b2);
    group.appendChild(pair);

    const lab = document.createElement("div");
    lab.className = "qlab";
    lab.textContent = r.k;
    group.appendChild(lab);

    bars.appendChild(group);
  }

  container.appendChild(bars);
}

function makeBar(
  value: number,
  max: number,
  variant: "budget" | "realise",
  title: string,
): HTMLDivElement {
  const bar = document.createElement("div");
  bar.className = `qbar ${variant}`;
  const h = Math.max(0, (value / max) * 100);
  bar.style.height = `${h.toFixed(1)}%`;
  bar.title = title;
  return bar;
}

function makeLegendItem(
  label: string,
  variant: "budget" | "realise",
): HTMLSpanElement {
  const item = document.createElement("span");
  item.className = "legend-item";

  const swatch = document.createElement("span");
  swatch.className = `legend-swatch ${variant}`;
  item.appendChild(swatch);

  item.appendChild(document.createTextNode(label));
  return item;
}
