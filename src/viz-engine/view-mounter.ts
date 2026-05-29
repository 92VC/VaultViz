// view-mounter — pour chaque vue compilée (CompiledView), exécute le
// SQL via le connector DuckDB puis pousse le résultat dans le
// composant adapté. AUCUNE constante de schéma — tout vient du
// compileView (T4). C'est ce module qui rend l'app vraiment
// data-driven : changer le `.vviz`, c'est changer ce qui est exécuté
// et affiché.
//
// SP3 / T3.final : routage complet vers les composants bespoke
// (kpi-card, ranked-bars, grouped-bars, plot-view, map metric-switcher,
// table riche). Le cross-filter des composants bespoke (kpi/ranked/
// grouped/table) réutilise le mécanisme Selection Mosaic déjà présent :
// abonnement `onSelectionValue` → re-exécution de la requête avec une
// clause WHERE injectée (push-down DuckDB). bar/plot conservent le
// cross-filter natif Mosaic (`vg.from(source, { filterBy })`).

import { tableFromIPC, type Table } from "apache-arrow";
import { invoke } from "@tauri-apps/api/core";

import type { CompiledView } from "./view-compiler";
import type { DuckConnector } from "./duck-connector";
import type { RuntimeContext } from "./mosaic-runtime";
import { bindMapSelection, ensureSelection } from "./mosaic-runtime";
import { onSelectionValue } from "./drill-query";
import { renderChoropleth, renderMetricSwitcher } from "../components/map-view";
import { renderBarChart } from "../components/bar-chart";
import { renderTable } from "../components/table-view";
import { renderKpiCard } from "../components/kpi-card";
import { renderRankedBars } from "../components/ranked-bars";
import { renderGroupedBars } from "../components/grouped-bars";
import { renderPlot } from "../components/plot-view";

function ident(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

function sqlLit(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/**
 * Injecte une clause `WHERE "<field>" = '<value>'` dans une requête déjà
 * compilée, juste APRÈS `FROM "<source>"` (et avant tout GROUP BY /
 * ORDER BY / LIMIT). Robuste pour les quatre formes bespoke :
 *   - kpi    : `SELECT … FROM "s"`                → … FROM "s" WHERE …
 *   - ranked : `… FROM "s" GROUP BY … ORDER BY v` → … FROM "s" WHERE … GROUP BY …
 *   - grouped: `… FROM "s" GROUP BY …`            → … FROM "s" WHERE … GROUP BY …
 *
 * La valeur est échappée (single-quote doublée) ; le `field` et le
 * `source` proviennent du DSL `.vviz` validé par JSON Schema (B-061).
 * Si le token `FROM "<source>"` est introuvable, la requête est
 * renvoyée inchangée (garde-fou — pas de SQL malformé).
 */
export function injectWhere(
  sql: string,
  source: string,
  field: string,
  value: string,
): string {
  const fromToken = `FROM ${ident(source)}`;
  const idx = sql.indexOf(fromToken);
  if (idx === -1) return sql;
  const insertAt = idx + fromToken.length;
  const clause = ` WHERE ${ident(field)} = ${sqlLit(value)}`;
  return sql.slice(0, insertAt) + clause + sql.slice(insertAt);
}

async function fetchKeyValueMap(
  conn: DuckConnector,
  sql: string,
): Promise<Map<string, number>> {
  const t = (await conn.query({ type: "arrow", sql })) as Table;
  const out = new Map<string, number>();
  for (let i = 0; i < t.numRows; i++) {
    const row = t.get(i);
    if (!row) continue;
    const k = String((row as Record<string, unknown>).key);
    const v = Number((row as Record<string, unknown>).v);
    if (Number.isFinite(v)) out.set(k, v);
  }
  return out;
}

/** Lit la 1re ligne (`v`, `delta?`) d'une requête KPI. */
async function fetchKpiRow(
  conn: DuckConnector,
  sql: string,
): Promise<{ value: number | null; delta: number | undefined }> {
  const t = (await conn.query({ type: "arrow", sql })) as Table;
  if (t.numRows === 0) return { value: null, delta: undefined };
  const row = (t.get(0) as Record<string, unknown> | null) ?? {};
  const v = Number(row.v);
  const d = Number(row.delta);
  return {
    value: Number.isFinite(v) ? v : null,
    delta: Number.isFinite(d) ? d : undefined,
  };
}

/** Lit des paires `{k, v}` (barres classées). */
async function fetchKV(
  conn: DuckConnector,
  sql: string,
): Promise<{ k: string; v: number }[]> {
  const t = (await conn.query({ type: "arrow", sql })) as Table;
  const out: { k: string; v: number }[] = [];
  for (let i = 0; i < t.numRows; i++) {
    const row = t.get(i) as Record<string, unknown> | null;
    if (!row) continue;
    out.push({ k: String(row.k), v: Number(row.v) });
  }
  return out;
}

/** Lit des triplets `{k, v1, v2}` (barres groupées). */
async function fetchKV2(
  conn: DuckConnector,
  sql: string,
): Promise<{ k: string; v1: number; v2: number }[]> {
  const t = (await conn.query({ type: "arrow", sql })) as Table;
  const out: { k: string; v1: number; v2: number }[] = [];
  for (let i = 0; i < t.numRows; i++) {
    const row = t.get(i) as Record<string, unknown> | null;
    if (!row) continue;
    out.push({
      k: String(row.k),
      v1: Number(row.v1),
      v2: Number(row.v2),
    });
  }
  return out;
}

async function fetchTableRows(
  source: string,
  columns: string[],
  filterField: string | undefined,
  filterValue: string | null,
  searchExpr: string | null,
  limit: number,
): Promise<Table> {
  const cols = columns.map(ident).join(", ");
  const clauses: string[] = [];
  if (filterField && filterValue !== null) {
    clauses.push(`${ident(filterField)} = ${sqlLit(filterValue)}`);
  }
  if (searchExpr) clauses.push(searchExpr);
  const where = clauses.length ? ` WHERE ${clauses.join(" AND ")}` : "";
  const sql = `SELECT ${cols} FROM ${ident(source)}${where} LIMIT ${limit}`;
  const buf = await invoke<ArrayBuffer>("run_query", { sql });
  return tableFromIPC(new Uint8Array(buf));
}

function numberOpt(o: Record<string, unknown> | undefined, key: string): number | undefined {
  const v = o?.[key];
  return typeof v === "number" ? v : undefined;
}

export async function mountCompiledView(
  view: CompiledView,
  container: HTMLElement,
  ctx: RuntimeContext,
  conn: DuckConnector,
): Promise<void> {
  switch (view.kind) {
    case "choropleth": {
      const width = numberOpt(view.options, "width") ?? 480;
      const height = numberOpt(view.options, "height") ?? 480;

      const bind = (svg: SVGSVGElement): void => {
        if (view.emitsSelection) {
          ensureSelection(ctx, view.emitsSelection, "single");
          bindMapSelection(svg, ctx, {
            field: view.geoField,
            selectionName: view.emitsSelection,
          });
        }
      };

      // Métriques alternatives (SP3) : carte + switcher segmenté.
      if (view.metrics && view.metrics.length > 0) {
        const metrics = view.metrics;
        const mapEl = document.createElement("div");
        const segEl = document.createElement("div");
        container.replaceChildren(segEl, mapEl);

        const paint = async (key: string): Promise<void> => {
          const m = metrics.find((x) => x.key === key) ?? metrics[0];
          const data = await fetchKeyValueMap(conn, m.sql);
          const svg = renderChoropleth(mapEl, data, {
            width,
            height,
            format: m.format,
          });
          bind(svg);
        };

        renderMetricSwitcher(
          segEl,
          metrics.map((m) => ({ key: m.key, label: m.label })),
          view.defaultMetricKey ?? metrics[0].key,
          (key) => {
            void paint(key);
          },
        );
        await paint(view.defaultMetricKey ?? metrics[0].key);
        return;
      }

      // Sans métriques : comportement historique.
      const data = await fetchKeyValueMap(conn, view.sql);
      const svg = renderChoropleth(container, data, { width, height });
      bind(svg);
      return;
    }

    case "bar": {
      if (view.filterBy) ensureSelection(ctx, view.filterBy, "single");
      renderBarChart(container, {
        source: view.source,
        xField: view.xField,
        yField: view.yField,
        yAggregate: view.yAggregate,
        filterSelectionName: view.filterBy,
        ctx,
        width: numberOpt(view.options, "width"),
        height: numberOpt(view.options, "height"),
      });
      return;
    }

    case "plot": {
      if (view.filterBy) ensureSelection(ctx, view.filterBy, "single");
      renderPlot(container, {
        source: view.source,
        plotType: view.plotType,
        xField: view.xField,
        yField: view.yField,
        yAggregate: view.yAggregate,
        seriesField: view.seriesField,
        filterSelectionName: view.filterBy,
        ctx,
        width: numberOpt(view.options, "width"),
        height: numberOpt(view.options, "height"),
        title: view.title,
      });
      return;
    }

    case "ranked_bars": {
      const render = async (value: string | null): Promise<void> => {
        const sql =
          value !== null && view.filterField
            ? injectWhere(view.sql, view.source, view.filterField, value)
            : view.sql;
        const rows = await fetchKV(conn, sql);
        renderRankedBars(container, rows, {
          format: view.valueFormat,
          valueLabels: view.valueLabels,
          title: view.title,
        });
      };
      await render(null);
      subscribeCrossFilter(ctx, view.filterBy, view.filterField, render);
      return;
    }

    case "grouped_bars": {
      const render = async (value: string | null): Promise<void> => {
        const sql =
          value !== null && view.filterField
            ? injectWhere(view.sql, view.source, view.filterField, value)
            : view.sql;
        const rows = await fetchKV2(conn, sql);
        renderGroupedBars(container, rows, {
          seriesLabels: view.seriesLabels,
          format: view.format,
          title: view.title,
        });
      };
      await render(null);
      subscribeCrossFilter(ctx, view.filterBy, view.filterField, render);
      return;
    }

    case "kpi": {
      const render = async (value: string | null): Promise<void> => {
        const sql =
          value !== null && view.filterField
            ? injectWhere(view.sql, view.source, view.filterField, value)
            : view.sql;
        const { value: v, delta } = await fetchKpiRow(conn, sql);
        renderKpiCard(container, {
          title: view.title ?? "",
          value: v ?? 0,
          delta: view.hasDelta ? delta : undefined,
          format: view.format,
          deltaUnit: view.deltaUnit,
          foot: view.foot,
          icon: view.icon,
        });
      };
      await render(null);
      subscribeCrossFilter(ctx, view.filterBy, view.filterField, render);
      return;
    }

    case "table": {
      const limit = numberOpt(view.options, "limit") ?? 5000;
      const fields = view.columns.map((c) => c.field);
      // Colonnes texte = candidates au filtre de recherche ILIKE.
      const textFields = view.columns
        .filter((c) => c.type !== "badge" && c.align !== "num")
        .map((c) => c.field);

      let activeFilter: string | null = null;
      let activeSearch: string | null = null;

      const searchExpr = (q: string): string | null => {
        const term = q.trim();
        if (!term || textFields.length === 0) return null;
        const lit = `'%${term.replace(/'/g, "''")}%'`;
        return (
          "(" +
          textFields.map((f) => `${ident(f)} ILIKE ${lit}`).join(" OR ") +
          ")"
        );
      };

      const refetch = async (): Promise<Table> =>
        fetchTableRows(
          view.source,
          fields,
          view.filterField,
          activeFilter,
          activeSearch,
          limit,
        );

      const initial = await refetch();
      const api = renderTable(container, initial, {
        columns: view.columns.map((c) => ({
          field: c.field,
          label: c.label,
          align: c.align,
          format: c.format,
          type: c.type,
          badgeMap: c.badgeMap,
        })),
        visibleRows: numberOpt(view.options, "visibleRows") ?? 15,
        ...(view.search
          ? {
              search: true,
              onSearch: (q: string) => {
                activeSearch = searchExpr(q);
                void refetch().then((t) => api.setData(t));
              },
            }
          : {}),
      });

      if (view.filterBy && view.filterField) {
        ensureSelection(ctx, view.filterBy, "single");
        onSelectionValue(ctx, view.filterBy, (code) => {
          activeFilter = code;
          void refetch().then((t) => api.setData(t));
        });
      }
      return;
    }
  }
}

/**
 * Abonne un composant bespoke (kpi/ranked/grouped) au cross-filter
 * Selection : à chaque mise à jour de `filterBy`, ré-exécute `render`
 * avec la valeur active (ou `null` si la sélection est vide → requête
 * non filtrée). No-op si `filterBy`/`filterField` absents.
 */
function subscribeCrossFilter(
  ctx: RuntimeContext,
  filterBy: string | undefined,
  filterField: string | undefined,
  render: (value: string | null) => Promise<void>,
): void {
  if (!filterBy || !filterField) return;
  ensureSelection(ctx, filterBy, "single");
  onSelectionValue(ctx, filterBy, (code) => {
    void render(code);
  });
}
