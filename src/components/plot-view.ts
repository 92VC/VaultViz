// T3.7 (SP3) — Graphes BI génériques line / area / dot via vgplot thémé.
//
// VaultViz est un outil BI générique : la carte est optionnelle. Ce
// composant rend les types de série temporelle / distribution les plus
// courants — courbe (`line`), aire (`area`), nuage de points (`dot`) —
// par-dessus le même socle Mosaic vgplot que `bar-chart.ts`.
//
// Comme pour le bar chart, le `filterBy` Selection est délégué à Mosaic :
// `vg.from(table, { filterBy })` pousse les clauses actives dans le SQL
// généré par mosaic-sql. Toute mise à jour de la selection (clic carte /
// autre vue) déclenche un re-query DuckDB et le Plot se ré-affiche.
//
// Marques vgplot utilisées (cf. node_modules/@uwdata/vgplot/src/plot/marks.js) :
// - line → vg.lineY
// - area → vg.areaY
// - dot  → vg.dot
// Toutes partagent la signature mark(data, options), identique à vg.barY.

import * as vg from "@uwdata/vgplot";

import type { RuntimeContext } from "../viz-engine/mosaic-runtime";

export type PlotType = "line" | "area" | "dot";

export interface PlotOpts {
  /** Nom de table/vue DuckDB (préalablement créée via CREATE VIEW). */
  source: string;
  /** Type de marque : line | area | dot. */
  plotType: PlotType;
  /** Champ X (souvent temporel pour line/area). */
  xField: string;
  /** Champ Y (omis pour count(*)). */
  yField?: string;
  /** Agrégat Y : count | sum | avg | min | max. Défaut : count. */
  yAggregate?: string;
  /** Champ de série → canal de couleur (stroke pour line/dot, fill pour area). */
  seriesField?: string;
  /** Nom d'une Selection à utiliser pour filterBy. */
  filterSelectionName?: string;
  ctx: RuntimeContext;
  width?: number;
  height?: number;
  title?: string;
}

/**
 * Construit le canal Y (agrégat). Aligné sur `bar-chart.ts` :
 * count(*) par défaut, sinon sum/avg/min/max sur `yField`.
 */
function yChannel(opts: PlotOpts): unknown {
  const agg = (opts.yAggregate ?? "count").toLowerCase();
  if (agg === "count") return vg.count();
  if (!opts.yField) {
    throw new Error(`yField requis pour agrégat ${agg}`);
  }
  const f = opts.yField;
  const v = vg as unknown as Record<string, (field: string) => unknown>;
  switch (agg) {
    case "sum":
      return v.sum(f);
    case "avg":
      return v.avg(f);
    case "min":
      return v.min(f);
    case "max":
      return v.max(f);
    default:
      throw new Error(`agrégat non supporté : ${agg}`);
  }
}

/**
 * Sélectionne la fabrique de marque vgplot selon `plotType`.
 *
 * `dot` ne porte pas naturellement un Y agrégé sur une dimension X
 * continue, mais l'expose tout de même via `y` pour rester homogène avec
 * le DSL .vviz (yField/yAggregate communs à toutes les vues "plot").
 */
function markFor(plotType: PlotType): (data: unknown, options: unknown) => unknown {
  const v = vg as unknown as Record<
    string,
    (data: unknown, options: unknown) => unknown
  >;
  switch (plotType) {
    case "line":
      return v.lineY;
    case "area":
      return v.areaY;
    case "dot":
      return v.dot;
    default:
      throw new Error(`plotType non supporté : ${String(plotType)}`);
  }
}

/**
 * Le canal couleur diffère selon la marque : line/dot se colorent par
 * `stroke`, area par `fill`. Renvoie un fragment d'options à fusionner
 * dans la marque quand `seriesField` est fourni.
 */
function colorChannel(
  plotType: PlotType,
  seriesField: string,
): Record<string, string> {
  return plotType === "area"
    ? { fill: seriesField }
    : { stroke: seriesField };
}

/**
 * Rend un graphe line / area / dot vgplot dans `container`. Le plot est
 * attaché à la Selection nommée (si fournie) via `filterBy` — toute mise
 * à jour de la selection déclenche un re-query DuckDB sub-seconde sur
 * Parquet local. Mêmes conventions de montage que `renderBarChart`.
 *
 * Thème : les axes/grille héritent des tokens CSS de l'app (le SVG
 * vgplot est mis en forme via les variables --text-2 / --grid-line par la
 * feuille de style globale ; aucune couleur n'est codée en dur ici hormis
 * le repli de marque, laissé au défaut vgplot, lui-même cascadable).
 */
export function renderPlot(container: HTMLElement, opts: PlotOpts): HTMLElement {
  const w = opts.width ?? 480;
  const h = opts.height ?? 280;
  const sel = opts.filterSelectionName
    ? opts.ctx.selections.get(opts.filterSelectionName)
    : undefined;

  const source = sel
    ? vg.from(opts.source, { filterBy: sel })
    : vg.from(opts.source);

  const markOptions: Record<string, unknown> = {
    x: opts.xField,
    y: yChannel(opts),
  };
  if (opts.seriesField) {
    Object.assign(markOptions, colorChannel(opts.plotType, opts.seriesField));
  }

  const mark = markFor(opts.plotType)(source, markOptions);

  const plot = vg.plot(
    mark,
    vg.width(w),
    vg.height(h),
  ) as unknown as HTMLElement;

  container.appendChild(plot);
  return plot;
}
