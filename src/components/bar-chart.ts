// B-041 — Bar chart vgplot avec filterBy Selection (cross-filter).
//
// On délègue *toute* la mécanique de filtre à Mosaic : `vg.from(table,
// { filterBy: sel })` push-down les clauses actives de `sel` dans le
// SQL généré par mosaic-sql ; quand la Selection émet une nouvelle
// clause (cf. B-040 carte), le coordinator re-query DuckDB et le Plot
// se ré-affiche. Aucun listener ad-hoc côté front.
//
// Cf. node_modules/@uwdata/mosaic-plot/src/marks/Mark.js : le ctor
// transmet `source.options.filterBy` à la base `MosaicClient`, qui
// s'abonne aux events de la Selection et invalide la query.

import * as vg from "@uwdata/vgplot";

import type { RuntimeContext } from "../viz-engine/mosaic-runtime";

export interface BarChartOptions {
  /** Nom de table/vue DuckDB (préalablement créée via `CREATE VIEW`). */
  source: string;
  /** Champ catégoriel (axe X). */
  xField: string;
  /**
   * Nom d'une Selection dans le runtime à utiliser pour `filterBy`.
   * Si absent, le bar chart n'est pas filtré.
   */
  filterSelectionName?: string;
  /** Runtime contenant les Selection/Param partagées. */
  ctx: RuntimeContext;
  width?: number;
  height?: number;
  /** Couleur des barres (CSS color). */
  fill?: string;
}

/**
 * Rend un bar chart vgplot dans `container`. Le plot est attaché à la
 * Selection nommée (si fournie) via `filterBy` — toute mise à jour de
 * la selection déclenche un re-query DuckDB sub-seconde sur Parquet
 * local (cf. bench B-023 : COUNT 50 Mo < 50 ms).
 *
 * Retourne l'élément racine du plot pour permettre au caller de le
 * remplacer ou le supprimer.
 */
export function renderBarChart(
  container: HTMLElement,
  opts: BarChartOptions,
): HTMLElement {
  const w = opts.width ?? 480;
  const h = opts.height ?? 280;
  const fill = opts.fill ?? "steelblue";
  const sel = opts.filterSelectionName
    ? opts.ctx.selections.get(opts.filterSelectionName)
    : undefined;

  // vg.from(table, { filterBy }) : ref logique à une table DuckDB ;
  // le coordinator résoudra la query via notre DuckConnector (B-031).
  const source = sel
    ? vg.from(opts.source, { filterBy: sel })
    : vg.from(opts.source);

  const plot = vg.plot(
    vg.barY(source, {
      x: opts.xField,
      y: vg.count(),
      fill,
    }),
    vg.width(w),
    vg.height(h),
  ) as unknown as HTMLElement;

  container.appendChild(plot);
  return plot;
}
