// B-041 — Bar chart vgplot avec filterBy Selection (cross-filter).
//
// Refacto T5 : prend yField + yAggregate du spec. Le caller passe les
// noms exacts du DSL .vviz — plus aucune constante côté composant.
//
// Le filterBy Selection est délégué à Mosaic : `vg.from(table, { filterBy })`
// pousse les clauses actives dans le SQL généré par mosaic-sql. Quand
// la Selection émet une nouvelle clause (clic carte), le coordinator
// re-query DuckDB et le Plot se ré-affiche.

import * as vg from "@uwdata/vgplot";

import type { RuntimeContext } from "../viz-engine/mosaic-runtime";

export interface BarChartOptions {
  /** Nom de table/vue DuckDB (préalablement créée via CREATE VIEW). */
  source: string;
  /** Champ catégoriel (axe X). */
  xField: string;
  /** Champ Y (omis pour count(*)). */
  yField?: string;
  /** Agrégat Y : count | sum | avg | min | max. Défaut : count. */
  yAggregate?: string;
  /** Nom d'une Selection à utiliser pour filterBy. */
  filterSelectionName?: string;
  ctx: RuntimeContext;
  width?: number;
  height?: number;
  fill?: string;
}

function yChannel(opts: BarChartOptions): unknown {
  const agg = (opts.yAggregate ?? "count").toLowerCase();
  if (agg === "count") return vg.count();
  if (!opts.yField) {
    throw new Error(`yField requis pour agrégat ${agg}`);
  }
  const f = opts.yField;
  // vgplot expose sum/avg/min/max comme fonctions agrégatives nommées.
  // Cf. node_modules/@uwdata/vgplot/src/api.js (re-exports mosaic-sql).
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
 * Rend un bar chart vgplot dans `container`. Le plot est attaché à la
 * Selection nommée (si fournie) via `filterBy` — toute mise à jour de
 * la selection déclenche un re-query DuckDB sub-seconde sur Parquet
 * local (cf. bench B-023 : COUNT 50 Mo < 50 ms).
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

  const source = sel
    ? vg.from(opts.source, { filterBy: sel })
    : vg.from(opts.source);

  const plot = vg.plot(
    vg.barY(source, {
      x: opts.xField,
      y: yChannel(opts),
      fill,
    }),
    vg.width(w),
    vg.height(h),
  ) as unknown as HTMLElement;

  container.appendChild(plot);
  return plot;
}
