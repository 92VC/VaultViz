// T3.3 (SP3) — Barres classées horizontales.
//
// Porté depuis `renderCats` + markup `.bars`/`.bar-row` du mockup
// (`mockups/VaultViz/assets/app.js` ~156-168, CSS `styles.css` ~292-300).
//
// Pur DOM, idempotent (vide puis re-remplit le container à chaque appel).
// Les rows sont supposées déjà triées par l'appelant (SQL ORDER BY).
//
// Couleur : dégradé d'accent par rang via `var(--accent)` avec opacité
// décroissante (rampe sobre, thémée par tokens — pas de palette en dur).

import { fmt } from "../ui/format";

export interface RankedRow {
  k: string;
  v: number;
}

export interface RankedBarsOpts {
  /** Format de valeur (cf. `fmt`) : « eur » | « pct » | « signed » | « number ». */
  format?: string;
  /** Affiche la valeur formatée `.b-val` (défaut : true). */
  valueLabels?: boolean;
  /** Titre optionnel rendu au-dessus des barres. */
  title?: string;
  /**
   * Palette de couleurs (CSS) déclarée dans le `.vviz` (`options.palette`).
   * Si fournie, chaque barre prend `palette[i % palette.length]` au lieu de
   * la rampe d'accent monochrome par défaut. Apporte de la variété visuelle.
   */
  palette?: string[];
  /**
   * Émission de sélection : si fourni, chaque barre devient cliquable
   * (curseur pointer) et invoque `onSelect(clé)` au clic. Le câblage vers
   * une `vg.Selection` est fait par le `view-mounter` (cross-filter).
   */
  onSelect?: (k: string) => void;
}

/**
 * Couleur de barre par rang : `var(--accent)` avec opacité décroissante.
 * Le premier rang (i=0) est pleinement opaque ; l'opacité décroît par
 * paliers de 0,16 et plafonne à 0,3 pour rester lisible.
 */
function barColor(i: number): string {
  const opacity = Math.max(0.3, 1 - i * 0.16);
  return `color-mix(in srgb, var(--accent) ${(opacity * 100).toFixed(0)}%, transparent)`;
}

/**
 * Rend des barres classées horizontales dans `container`. Idempotent :
 * tout contenu existant est remplacé.
 */
export function renderRankedBars(
  container: HTMLElement,
  rows: RankedRow[],
  opts: RankedBarsOpts = {},
): void {
  const showValues = opts.valueLabels !== false;
  container.replaceChildren();

  if (opts.title) {
    const h = document.createElement("div");
    h.className = "rb-title";
    h.textContent = opts.title;
    container.appendChild(h);
  }

  const bars = document.createElement("div");
  bars.className = "bars";

  const max = rows.reduce((m, r) => (r.v > m ? r.v : m), 0);
  const palette = opts.palette;

  rows.forEach((r, i) => {
    const col =
      palette && palette.length > 0 ? palette[i % palette.length] : barColor(i);
    const w = max > 0 ? (r.v / max) * 100 : 0;

    const row = document.createElement("div");
    row.className = "bar-row";

    if (opts.onSelect) {
      row.style.cursor = "pointer";
      row.addEventListener("click", () => opts.onSelect!(r.k));
    }

    const lab = document.createElement("div");
    lab.className = "b-lab";
    const sw = document.createElement("span");
    sw.className = "sw";
    sw.style.background = col;
    lab.appendChild(sw);
    lab.appendChild(document.createTextNode(r.k));

    const track = document.createElement("div");
    track.className = "bar-track";
    const fill = document.createElement("div");
    fill.className = "bar-fill";
    fill.style.width = `${w.toFixed(1)}%`;
    fill.style.background = col;
    track.appendChild(fill);

    row.appendChild(lab);
    row.appendChild(track);

    if (showValues) {
      const val = document.createElement("div");
      val.className = "b-val";
      val.textContent = fmt(r.v, opts.format);
      row.appendChild(val);
    }

    bars.appendChild(row);
  });

  container.appendChild(bars);
}
