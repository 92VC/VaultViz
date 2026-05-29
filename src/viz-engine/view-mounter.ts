// view-mounter — pour chaque vue compilée (CompiledView), exécute le
// SQL via le connector DuckDB puis pousse le résultat dans le
// composant adapté. AUCUNE constante de schéma — tout vient du
// compileView (T4). C'est ce module qui rend l'app vraiment
// data-driven : changer le `.vviz`, c'est changer ce qui est exécuté
// et affiché.

import { tableFromIPC, type Table } from "apache-arrow";
import { invoke } from "@tauri-apps/api/core";

import type { CompiledView } from "./view-compiler";
import type { DuckConnector } from "./duck-connector";
import type { RuntimeContext } from "./mosaic-runtime";
import { bindMapSelection, ensureSelection } from "./mosaic-runtime";
import { onSelectionValue } from "./drill-query";
import { renderChoropleth } from "../components/map-view";
import { renderBarChart } from "../components/bar-chart";
import { renderTable } from "../components/table-view";

function ident(s: string): string {
  return `"${s.replace(/"/g, '""')}"`;
}

function sqlLit(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
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

async function fetchSingleNumber(
  conn: DuckConnector,
  sql: string,
): Promise<number | null> {
  const t = (await conn.query({ type: "arrow", sql })) as Table;
  if (t.numRows === 0) return null;
  const row = t.get(0);
  const raw = (row as Record<string, unknown> | null)?.v;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

async function fetchTableRows(
  source: string,
  columns: string[],
  filterField: string | undefined,
  filterValue: string | null,
  limit: number,
): Promise<Table> {
  const cols = columns.map(ident).join(", ");
  const where =
    filterField && filterValue !== null
      ? ` WHERE ${ident(filterField)} = ${sqlLit(filterValue)}`
      : "";
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
      const map = await fetchKeyValueMap(conn, view.sql);
      const svg = renderChoropleth(container, map, {
        width: numberOpt(view.options, "width") ?? 480,
        height: numberOpt(view.options, "height") ?? 480,
      });
      if (view.emitsSelection) {
        ensureSelection(ctx, view.emitsSelection, "single");
        bindMapSelection(svg, ctx, {
          field: view.geoField,
          selectionName: view.emitsSelection,
        });
      }
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

    case "table": {
      const limit = numberOpt(view.options, "limit") ?? 5000;
      // SP3 : columns est désormais ColumnDef[] ; le mounter actuel ne
      // consomme que les noms de champ (rendu riche en T3.x).
      const fields = view.columns.map((c) => c.field);
      const initial = await fetchTableRows(
        view.source,
        fields,
        undefined,
        null,
        limit,
      );
      const api = renderTable(container, initial, {
        columns: view.columns.map((c) => ({ field: c.field })),
        visibleRows: numberOpt(view.options, "visibleRows") ?? 15,
      });
      if (view.filterBy && view.filterField) {
        const filterField = view.filterField;
        ensureSelection(ctx, view.filterBy, "single");
        onSelectionValue(ctx, view.filterBy, async (code) => {
          const t = await fetchTableRows(
            view.source,
            fields,
            filterField,
            code,
            limit,
          );
          api.setData(t);
        });
      }
      return;
    }

    case "kpi": {
      const n = await fetchSingleNumber(conn, view.sql);
      container.innerHTML = `
        <div class="vv-kpi">
          ${view.title ? `<div class="vv-kpi-label">${escapeHtml(view.title)}</div>` : ""}
          <div class="vv-kpi-value">${
            n === null ? "—" : Number(n).toLocaleString("fr-FR")
          }</div>
        </div>
      `;
      return;
    }

    // SP3 : nouveaux kinds compilés mais non encore rendus — conteneurs
    // vides no-op pour garder build/tests verts. Rendu implémenté en T3.x.
    case "grouped_bars":
    case "ranked_bars":
    case "plot": {
      // TODO(T3.x) : composants de rendu dédiés (barres groupées/classées, plot vgplot).
      return;
    }
  }
}
