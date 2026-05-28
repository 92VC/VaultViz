// Transforme une vue DSL `.vviz` (cf. schema/vviz-v1.json) en plan de
// rendu : SQL à exécuter pour récupérer les données + métadonnées
// (noms des champs, agrégats utilisés). Le composant de rendu
// (map/bar/table/kpi) consomme ces métadonnées et n'a AUCUNE constante
// hardcodée.

import type { EncodingChannel, ViewSpec } from "./types";

const AGG = new Set(["sum", "avg", "count", "min", "max"]);

function ident(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

function aggExpr(field: string | undefined, agg: string | undefined): string {
  const a = (agg ?? "count").toLowerCase();
  if (a === "count" && !field) return "COUNT(*)";
  if (!AGG.has(a)) {
    throw new Error(`agrégat non supporté : ${agg}`);
  }
  if (!field) {
    throw new Error(`agrégat ${a} requiert un encoding field`);
  }
  return `${a.toUpperCase()}(${ident(field)})`;
}

function getChannel(
  view: ViewSpec,
  key: string,
): EncodingChannel | undefined {
  const e = view.encoding ?? {};
  const v = e[key];
  if (!v || Array.isArray(v) || typeof v === "string") return undefined;
  return v;
}

export type CompiledView =
  | {
      kind: "choropleth";
      id: string;
      title?: string;
      source: string;
      sql: string;
      geoField: string;
      filterBy?: string;
      emitsSelection?: string;
      options?: Record<string, unknown>;
    }
  | {
      kind: "bar";
      id: string;
      title?: string;
      source: string;
      xField: string;
      yField?: string;
      yAggregate: string;
      filterBy?: string;
      options?: Record<string, unknown>;
    }
  | {
      kind: "table";
      id: string;
      title?: string;
      source: string;
      columns: string[];
      filterBy?: string;
      filterField?: string;
      options?: Record<string, unknown>;
    }
  | {
      kind: "kpi";
      id: string;
      title?: string;
      source: string;
      sql: string;
      filterBy?: string;
      options?: Record<string, unknown>;
    };

function emitsSelectionFromOpts(options: Record<string, unknown> | undefined): string | undefined {
  const v = options?.emitsTo;
  return typeof v === "string" ? v : undefined;
}

function filterFieldFromOpts(options: Record<string, unknown> | undefined): string | undefined {
  const v = options?.filterField;
  return typeof v === "string" ? v : undefined;
}

export function compileView(view: ViewSpec): CompiledView {
  switch (view.type) {
    case "map_choropleth": {
      const geo = getChannel(view, "geo");
      if (!geo?.field) {
        throw new Error(
          `view "${view.id}" : encoding.geo.field requis pour map_choropleth`,
        );
      }
      const color = getChannel(view, "color");
      const aggregate = color?.aggregate ?? (color?.field ? "sum" : "count");
      const sql =
        `SELECT ${ident(geo.field)} AS key, ${aggExpr(color?.field, aggregate)} AS v ` +
        `FROM ${ident(view.source)} GROUP BY ${ident(geo.field)}`;
      return {
        kind: "choropleth",
        id: view.id,
        title: view.title,
        source: view.source,
        sql,
        geoField: geo.field,
        filterBy: view.filterBy,
        emitsSelection: emitsSelectionFromOpts(view.options),
        options: view.options,
      };
    }

    case "bar":
    case "barX":
    case "barY": {
      const x = getChannel(view, "x");
      if (!x?.field) {
        throw new Error(
          `view "${view.id}" : encoding.x.field requis pour ${view.type}`,
        );
      }
      const y = getChannel(view, "y");
      return {
        kind: "bar",
        id: view.id,
        title: view.title,
        source: view.source,
        xField: x.field,
        yField: y?.field,
        yAggregate: (y?.aggregate ?? "count").toLowerCase(),
        filterBy: view.filterBy,
        options: view.options,
      };
    }

    case "table": {
      const e = view.encoding ?? {};
      const cols = e.columns;
      if (!Array.isArray(cols) || cols.length === 0) {
        throw new Error(
          `view "${view.id}" : encoding.columns (array non vide) requis pour table`,
        );
      }
      return {
        kind: "table",
        id: view.id,
        title: view.title,
        source: view.source,
        columns: cols.filter((c) => typeof c === "string"),
        filterBy: view.filterBy,
        filterField: filterFieldFromOpts(view.options),
        options: view.options,
      };
    }

    case "kpi": {
      const value = getChannel(view, "value");
      if (!value?.field && (value?.aggregate ?? "sum") !== "count") {
        throw new Error(
          `view "${view.id}" : encoding.value.field requis pour kpi (sauf count)`,
        );
      }
      const sql =
        `SELECT ${aggExpr(value?.field, value?.aggregate ?? "sum")} AS v ` +
        `FROM ${ident(view.source)}`;
      return {
        kind: "kpi",
        id: view.id,
        title: view.title,
        source: view.source,
        sql,
        filterBy: view.filterBy,
        options: view.options,
      };
    }

    default:
      throw new Error(`type de vue non supporté en V0 : ${view.type}`);
  }
}
