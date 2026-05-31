// Transforme une vue DSL `.vviz` (cf. schema/vviz-v1.json) en plan de
// rendu : SQL à exécuter pour récupérer les données + métadonnées
// (noms des champs, agrégats utilisés). Le composant de rendu
// (map/bar/table/kpi) consomme ces métadonnées et n'a AUCUNE constante
// hardcodée.

import type { ColumnDef, EncodingChannel, MetricDef, ViewSpec } from "./types";
import { ident } from "./sql-helpers";

const AGG = new Set(["sum", "avg", "count", "min", "max"]);

const DOC_ID = /^[a-zA-Z0-9_]{1,32}$/;

/**
 * Nom de vue PLAT préfixé d'une source (SP4 — namespacing par vues
 * plates, et non par schéma DuckDB).
 *
 * - Sans `docId` : `<source>` brut (rétro-compat).
 * - Avec `docId` valide : `doc_<docId>__<source>`.
 *
 * C'est un identifiant SQL SIMPLE (sans `.`), ce qui le rend valide à la
 * fois pour vgplot (`vg.from(source)` le quote en UN seul identifiant
 * correct) et pour l'injection de WHERE (`injectWhere` cherche
 * `FROM "<source>"` = `FROM "doc_<id>__<source>"`). Doit rester aligné
 * sur `viewName` de source-loader.ts.
 */
function flatName(docId: string | undefined, source: string): string {
  if (docId === undefined) return source;
  if (!DOC_ID.test(docId)) {
    throw new Error(`docId invalide : "${docId}"`);
  }
  return `doc_${docId}__${source}`;
}

/**
 * Référence SQL qualifiée d'une source : nom de vue plat, échappé et
 * quoté (`"<source>"` ou `"doc_<docId>__<source>"`). Interpolée dans le
 * SQL brut envoyé à DuckDB (kpi, choropleth, ranked/grouped_bars).
 *
 * - Sans `docId` : `"src"` → SQL strictement inchangé (rétro-compat).
 * - Avec `docId` : `"doc_<docId>__src"`.
 */
function qualifiedSource(docId: string | undefined, source: string): string {
  return ident(flatName(docId, source));
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
      /** Métriques alternatives (SP3) — présent uniquement si options.metrics fourni. */
      metrics?: MetricDef[];
      /** Clé de la métrique par défaut (= metrics[0].key). */
      defaultMetricKey?: string;
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
      kind: "grouped_bars";
      id: string;
      title?: string;
      source: string;
      sql: string;
      kField: string;
      seriesLabels: [string, string];
      format?: string;
      filterBy?: string;
      filterField?: string;
      options?: Record<string, unknown>;
    }
  | {
      kind: "ranked_bars";
      id: string;
      title?: string;
      source: string;
      sql: string;
      kField: string;
      valueFormat?: string;
      sort: string;
      valueLabels?: boolean;
      filterBy?: string;
      filterField?: string;
      /** Selection émise au clic d'une barre (cross-filter) — options.emitsTo. */
      emitsSelection?: string;
      options?: Record<string, unknown>;
    }
  | {
      kind: "plot";
      id: string;
      title?: string;
      source: string;
      plotType: "line" | "area" | "dot";
      xField: string;
      yField?: string;
      yAggregate: string;
      seriesField?: string;
      filterBy?: string;
      options?: Record<string, unknown>;
    }
  | {
      kind: "pie";
      id: string;
      title?: string;
      source: string;
      sql: string;
      kField: string;
      valueFormat?: string;
      filterBy?: string;
      filterField?: string;
      options?: Record<string, unknown>;
    }
  | {
      kind: "table";
      id: string;
      title?: string;
      source: string;
      columns: ColumnDef[];
      search?: boolean;
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
      hasDelta?: boolean;
      format?: string;
      foot?: string;
      icon?: string;
      deltaUnit?: string;
      filterField?: string;
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

function stringOpt(
  options: Record<string, unknown> | undefined,
  key: string,
): string | undefined {
  const v = options?.[key];
  return typeof v === "string" ? v : undefined;
}

/** Normalise une direction de tri SQL — défaut DESC, jamais d'interpolation libre. */
function normSort(raw: unknown): string {
  const s = typeof raw === "string" ? raw.trim().toUpperCase() : "";
  return s === "ASC" ? "ASC" : "DESC";
}

export function compileView(view: ViewSpec, docId?: string): CompiledView {
  // SP4 : source = vue plate préfixée `doc_<docId>__<src>` quand docId
  // fourni. `src` (quoté) est interpolé dans le SQL brut ; `flatSource`
  // (non quoté) est le nom porté par le CompiledView, consommé par
  // vgplot (bar/plot) et par fetchTableRows / injectWhere (view-mounter).
  // Sans docId, les deux valent `view.source` → SQL et source inchangés.
  const src = qualifiedSource(docId, view.source);
  const flatSource = flatName(docId, view.source);
  switch (view.type) {
    case "map_choropleth": {
      const geo = getChannel(view, "geo");
      if (!geo?.field) {
        throw new Error(
          `view "${view.id}" : encoding.geo.field requis pour map_choropleth`,
        );
      }
      const geoField = geo.field;
      const color = getChannel(view, "color");
      const aggregate = color?.aggregate ?? (color?.field ? "sum" : "count");
      const defaultSql =
        `SELECT ${ident(geoField)} AS key, ${aggExpr(color?.field, aggregate)} AS v ` +
        `FROM ${src} GROUP BY ${ident(geoField)}`;

      // SP3 : métriques alternatives (options.metrics). Sans elles, comportement inchangé.
      let metrics: MetricDef[] | undefined;
      let defaultMetricKey: string | undefined;
      let sql = defaultSql;
      const rawMetrics = view.options?.metrics;
      if (Array.isArray(rawMetrics) && rawMetrics.length > 0) {
        metrics = rawMetrics.map((m) => {
          const def = m as {
            key: string;
            label: string;
            field: string;
            aggregate?: string;
            format?: string;
          };
          const agg = (def.aggregate ?? "sum").toLowerCase();
          const mSql =
            `SELECT ${ident(geoField)} AS key, ${aggExpr(def.field, agg)} AS v ` +
            `FROM ${src} GROUP BY ${ident(geoField)}`;
          return {
            key: def.key,
            label: def.label,
            field: def.field,
            format: def.format,
            aggregate: agg as MetricDef["aggregate"],
            sql: mSql,
          };
        });
        defaultMetricKey = metrics[0].key;
        // Rétro-compat : `sql` reste = SQL de la métrique par défaut.
        sql = metrics[0].sql;
      }

      return {
        kind: "choropleth",
        id: view.id,
        title: view.title,
        source: flatSource,
        sql,
        geoField: geo.field,
        filterBy: view.filterBy,
        emitsSelection: emitsSelectionFromOpts(view.options),
        ...(metrics ? { metrics, defaultMetricKey } : {}),
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
      const yAgg = (y?.aggregate ?? "count").toLowerCase();
      const opts = view.options;

      // SP3 routage 1 : barres groupées (deux mesures comparées).
      const compareField = stringOpt(opts, "compareField");
      if (compareField) {
        const sql =
          `SELECT ${ident(x.field)} AS k, ${aggExpr(y?.field, yAgg)} AS v1, ` +
          `${aggExpr(compareField, yAgg)} AS v2 ` +
          `FROM ${src} GROUP BY ${ident(x.field)}`;
        const rawLabels = opts?.seriesLabels;
        const seriesLabels: [string, string] =
          Array.isArray(rawLabels) &&
          typeof rawLabels[0] === "string" &&
          typeof rawLabels[1] === "string"
            ? [rawLabels[0], rawLabels[1]]
            : [y?.field ?? "v1", compareField];
        return {
          kind: "grouped_bars",
          id: view.id,
          title: view.title,
          source: flatSource,
          sql,
          kField: x.field,
          seriesLabels,
          format: stringOpt(opts, "format"),
          filterBy: view.filterBy,
          filterField: filterFieldFromOpts(opts),
          options: opts,
        };
      }

      // SP3 routage 2 : barres classées (tri + labels + format).
      const hasValueLabels = opts?.valueLabels !== undefined;
      const hasSort = opts?.sort !== undefined;
      const hasFormat = opts?.format !== undefined;
      if (hasValueLabels || hasSort || hasFormat || opts?.orderByKey === true) {
        const sort = normSort(opts?.sort);
        // `orderByKey` : tri par la clé (ex. mois/année) plutôt que par
        // valeur → garde l'ordre chronologique d'un histogramme temporel.
        const orderBy =
          opts?.orderByKey === true ? `${ident(x.field)} ASC` : `v ${sort}`;
        const sql =
          `SELECT ${ident(x.field)} AS k, ${aggExpr(y?.field, yAgg)} AS v ` +
          `FROM ${src} GROUP BY ${ident(x.field)} ORDER BY ${orderBy}`;
        return {
          kind: "ranked_bars",
          id: view.id,
          title: view.title,
          source: flatSource,
          sql,
          kField: x.field,
          valueFormat: stringOpt(opts, "format"),
          sort,
          valueLabels: opts?.valueLabels === true ? true : undefined,
          filterBy: view.filterBy,
          filterField: filterFieldFromOpts(opts),
          emitsSelection: emitsSelectionFromOpts(opts),
          options: opts,
        };
      }

      // Rétro-compat total : bar nu inchangé.
      // SP4 : source = vue plate préfixée `doc_<docId>__src` quand docId
      // fourni. C'est UN identifiant simple → `vg.from(source)` le quote
      // correctement (`"doc_d1__effectifs"`), isolation réelle du plot.
      // Sans docId → `view.source` brut (vgplot quote tel quel : "src").
      return {
        kind: "bar",
        id: view.id,
        title: view.title,
        source: flatSource,
        xField: x.field,
        yField: y?.field,
        yAggregate: yAgg,
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
      // SP3 : colonnes string[] OU objets riches → normalisation ColumnDef[].
      const columns: ColumnDef[] = (cols as unknown[]).map((c) => {
        if (typeof c === "string") return { field: c };
        const o = c as Partial<ColumnDef> & { field: string };
        return {
          field: o.field,
          label: o.label,
          align: o.align,
          format: o.format,
          type: o.type,
          badgeMap: o.badgeMap,
        };
      });
      return {
        kind: "table",
        id: view.id,
        title: view.title,
        source: flatSource,
        columns,
        search: view.options?.search === true ? true : undefined,
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
      const valueAgg = aggExpr(value?.field, value?.aggregate ?? "sum");

      // SP3 : delta optionnel (encoding.delta {field, aggregate}).
      const delta = getChannel(view, "delta");
      const opts = view.options;
      let sql: string;
      let hasDelta: boolean | undefined;
      if (delta?.field || delta?.aggregate) {
        const deltaAgg = aggExpr(delta?.field, delta?.aggregate ?? "sum");
        sql =
          `SELECT ${valueAgg} AS v, ${deltaAgg} AS delta ` +
          `FROM ${src}`;
        hasDelta = true;
      } else {
        sql = `SELECT ${valueAgg} AS v FROM ${src}`;
      }

      return {
        kind: "kpi",
        id: view.id,
        title: view.title,
        source: flatSource,
        sql,
        ...(hasDelta ? { hasDelta } : {}),
        format: stringOpt(opts, "format"),
        foot: stringOpt(opts, "foot"),
        icon: stringOpt(opts, "icon"),
        deltaUnit: stringOpt(opts, "deltaUnit"),
        filterField: filterFieldFromOpts(opts),
        filterBy: view.filterBy,
        options: view.options,
      };
    }

    case "pie": {
      const x = getChannel(view, "x");
      if (!x?.field) {
        throw new Error(`view "${view.id}" : encoding.x.field requis pour pie`);
      }
      const y = getChannel(view, "y");
      const yAgg = (y?.aggregate ?? "sum").toLowerCase();
      const sql =
        `SELECT ${ident(x.field)} AS k, ${aggExpr(y?.field, yAgg)} AS v ` +
        `FROM ${src} GROUP BY ${ident(x.field)} ORDER BY v DESC`;
      return {
        kind: "pie",
        id: view.id,
        title: view.title,
        source: flatSource,
        sql,
        kField: x.field,
        valueFormat: stringOpt(view.options, "format"),
        filterBy: view.filterBy,
        filterField: filterFieldFromOpts(view.options),
        options: view.options,
      };
    }

    case "line":
    case "area":
    case "dot": {
      const x = getChannel(view, "x");
      if (!x?.field) {
        throw new Error(
          `view "${view.id}" : encoding.x.field requis pour ${view.type}`,
        );
      }
      const y = getChannel(view, "y");
      const series = getChannel(view, "series");
      // SP4 : même logique que bar — source = vue plate préfixée.
      return {
        kind: "plot",
        id: view.id,
        title: view.title,
        source: flatSource,
        plotType: view.type,
        xField: x.field,
        yField: y?.field,
        yAggregate: (y?.aggregate ?? "sum").toLowerCase(),
        seriesField: series?.field,
        filterBy: view.filterBy,
        options: view.options,
      };
    }

    default:
      throw new Error(`type de vue non supporté en V0 : ${view.type}`);
  }
}
