// T3.1 (SP3) — Composant carte KPI (valeur + delta + note + icône).
//
// Porté fidèlement de `renderKPIs` + `deltaEl` de
// `mockups/VaultViz/assets/app.js` (~66-89) et du CSS `.kpi`/`.k-top`/
// `.k-label`/`.k-ico`/`.k-val`/`.k-foot`/`.delta` de
// `mockups/VaultViz/assets/styles.css`.
//
// Fonction pure DOM, idempotente : réécrit `container.innerHTML`.
//
// Refs: design-integration

import { fmt, signed } from "../ui/format";
import { icon, type IconName } from "../ui/icons";

export interface KpiCardData {
  /** Libellé affiché en haut de la carte (`.k-label`). */
  title: string;
  /** Valeur numérique brute, formatée via {@link fmt}. */
  value: number;
  /** Variation signée affichée dans le pied (`.delta`). Optionnelle. */
  delta?: number;
  /** Format de la valeur (cf. `FormatKind` de `format.ts`). */
  format?: string;
  /** Suffixe accolé au delta (« % », « pt »…). Défaut : « % ». */
  deltaUnit?: string;
  /** Texte additionnel du pied (`.k-foot > span`). */
  foot?: string;
  /** Identifiant d'icône (cf. `IconName`). Affichée dans `.k-ico`. */
  icon?: string;
  /**
   * Si fourni, la carte devient cliquable (curseur pointer + rôle bouton) et
   * invoque `onClick` au clic. Utilisé pour les raccourcis de navigation vers
   * un onglet (drill-through KPI → page de détail).
   */
  onClick?: () => void;
}

/** Paths SVG des flèches delta (repris de `deltaEl`). */
const DELTA_ARROWS = {
  up: "M3 9l4-4 4 4",
  down: "M3 5l4 4 4-4",
  flat: "M3 7h8",
} as const;

type DeltaClass = keyof typeof DELTA_ARROWS;

/** Classe directionnelle d'un delta (seuil ±0.05, comme la maquette). */
function deltaClass(v: number): DeltaClass {
  return v > 0.05 ? "up" : v < -0.05 ? "down" : "flat";
}

/** Markup `<span class="delta …">` d'une variation signée. */
function deltaMarkup(v: number, unit: string): string {
  const cls = deltaClass(v);
  const path = DELTA_ARROWS[cls];
  return (
    `<span class="delta ${cls}">` +
    `<svg viewBox="0 0 14 12" fill="none" stroke="currentColor" ` +
    `stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">` +
    `<path d="${path}"/></svg>${signed(v)}${unit}</span>`
  );
}

/** Échappe le texte destiné à du contenu HTML. */
function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Rend une carte KPI dans `container`, fidèle à la maquette.
 *
 * @param container élément hôte ; son `innerHTML` est réécrit (idempotent).
 * @param data données de la carte.
 */
export function renderKpiCard(container: HTMLElement, data: KpiCardData): void {
  const ico = data.icon
    ? `<div class="k-ico">${icon(data.icon as IconName)}</div>`
    : "";
  const val = fmt(data.value, data.format);
  const unit = data.deltaUnit ?? "%";
  const delta =
    data.delta !== undefined ? deltaMarkup(data.delta, unit) : "";
  const foot = data.foot ? `<span>${esc(data.foot)}</span>` : "";

  container.innerHTML =
    `<div class="card kpi">` +
    `<div class="k-top"><div class="k-label">${esc(data.title)}</div>${ico}</div>` +
    `<div class="k-val">${val}</div>` +
    `<div class="k-foot">${delta}${foot}</div>` +
    `</div>`;

  if (data.onClick) {
    const card = container.querySelector<HTMLElement>(".card.kpi");
    if (card) {
      // `nav` = indicateur visuel (chevron + survol) signalant que la carte
      // est un raccourci vers un onglet (cf. CSS `.card.kpi.nav`).
      card.classList.add("nav");
      card.style.cursor = "pointer";
      card.setAttribute("role", "button");
      card.addEventListener("click", () => data.onClick!());
    }
  }
}
