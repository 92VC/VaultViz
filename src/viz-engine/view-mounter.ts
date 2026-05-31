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
import { bindMapSelection, createPointEmitter, ensureSelection } from "./mosaic-runtime";
import { onSelectionValue } from "./drill-query";
import { injectWhereAll, type Clause } from "./where-builder";
import { ident, lit } from "./sql-helpers";
import type { SlicerSpec } from "./types";
import { renderChoropleth, renderMetricSwitcher } from "../components/map-view";
import { renderChoroplethGL } from "../components/map-choropleth-gl";
import { renderBarChart } from "../components/bar-chart";
import { renderTable } from "../components/table-view";
import { renderKpiCard } from "../components/kpi-card";
import { renderRankedBars } from "../components/ranked-bars";
import { renderGroupedBars } from "../components/grouped-bars";
import { renderLineChart, type LinePoint } from "../components/line-chart";
import { renderPieChart } from "../components/pie-chart";

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
 *
 * Délègue à `injectWhereAll` (mono-clause) — signature INCHANGÉE pour
 * rétro-compat de tous les appelants existants.
 */
export function injectWhere(
  sql: string,
  source: string,
  field: string,
  value: string,
): string {
  return injectWhereAll(sql, source, [{ field, values: [value] }]);
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

/** Fetch (x, s, v) pour les courbes multi-séries (x ordonné, s = série). */
async function fetchXSV(
  conn: DuckConnector,
  sql: string,
): Promise<{ x: string; s: string; v: number }[]> {
  const t = (await conn.query({ type: "arrow", sql })) as Table;
  const out: { x: string; s: string; v: number }[] = [];
  for (let i = 0; i < t.numRows; i++) {
    const row = t.get(i) as Record<string, unknown> | null;
    if (!row) continue;
    out.push({ x: String(row.x), s: String(row.s), v: Number(row.v) });
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
    clauses.push(`${ident(filterField)} = ${lit(filterValue)}`);
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

/** Options pour le câblage des slicers (B-251). */
export interface MountViewOpts {
  /**
   * Slicers déclarés dans `spec.slicers[]`. Seuls ceux dont la source
   * correspond à `view.source` ET dont le scope est compatible
   * (global OU tab == currentTab) sont appliqués à cette vue.
   */
  slicers?: SlicerSpec[];
  /**
   * Onglet actif (id DSL). Requis pour filtrer les slicers scope='tab'.
   * Absent → seuls les slicers scope='global' s'appliquent aux vues
   * qui ne sont pas dans un onglet explicite.
   */
  currentTab?: string;
}

/**
 * Prédicat unique d'applicabilité d'un slicer à une vue (B-251).
 * Source unique de vérité partagée par `buildSlicerClauses` (construction
 * du SQL) et `subscribeSlicers` (abonnement aux re-renders).
 * - source doit correspondre (un slicer sur source A ne filtre pas B).
 * - scope='global' : toujours applicable.
 * - scope='tab' (défaut) : applicable si l'onglet courant correspond à
 *   la vue, ou si l'un des deux onglets est absent (pas d'onglet déclaré).
 */
function isSlicerApplicable(
  s: SlicerSpec,
  viewSource: string,
  viewTab: string | undefined,
  currentTab: string | undefined,
): boolean {
  if (s.source !== viewSource) return false;
  if (s.scope === "global") return true;
  if (currentTab === undefined || viewTab === undefined) return true;
  return viewTab === currentTab;
}

/**
 * Construit les Clause[] de slicers applicables à une vue donnée.
 * Chaque clause porte les valeurs cochées courantes (ctx.slicerState) ;
 * une clause à values=[] est ignorée par injectWhereAll.
 */
function buildSlicerClauses(
  ctx: RuntimeContext,
  slicers: SlicerSpec[],
  viewSource: string,
  viewTab: string | undefined,
  currentTab: string | undefined,
): Clause[] {
  return slicers
    .filter((s) => isSlicerApplicable(s, viewSource, viewTab, currentTab))
    .map((s) => ({
      field: s.field,
      values: ctx.slicerState.get(s.id) ?? [],
    }));
}

export async function mountCompiledView(
  view: CompiledView,
  container: HTMLElement,
  ctx: RuntimeContext,
  conn: DuckConnector,
  opts: MountViewOpts = {},
): Promise<void> {
  const slicers = opts.slicers ?? [];
  const currentTab = opts.currentTab;
  // Onglet auquel appartient cette vue (depuis options.tab du DSL).
  const viewTab = (view.options as Record<string, unknown> | undefined)?.["tab"] as
    | string
    | undefined;
  switch (view.kind) {
    case "choropleth": {
      const width = numberOpt(view.options, "width") ?? 480;
      const height = numberOpt(view.options, "height") ?? 480;
      const engine = (view.options as Record<string, unknown> | undefined)?.[
        "engine"
      ];

      // ── Moteur MapLibre GL (engine: "maplibre") ──────────────────────────
      // Note : les métriques alternatives (SP3) ne sont pas supportées avec
      // engine="maplibre" (hors scope B-111 / CLAUDE.md §4.3). Le switcher
      // segmenté reste disponible en mode SVG (défaut).
      //
      // LIMITATION V1 (B-111) : le cross-filter ENTRANT n'est pas câblé pour
      // le moteur GL. La carte ÉMET sa sélection (onSelect → createPointEmitter),
      // mais ne se RE-RENDER pas en réaction à une sélection externe (clic sur
      // une autre vue), contrairement aux vues bespoke (kpi/ranked/grouped/pie)
      // qui s'abonnent via subscribeCrossFilter. Le re-render maplibre sur
      // sélection entrante est laissé à une story ultérieure.
      if (engine === "maplibre") {
        const data = await fetchKeyValueMap(conn, view.sql);
        const formatOpt = (view.options as Record<string, unknown> | undefined)?.[
          "format"
        ];
        // Émission de sélection (même patron que ranked_bars) :
        // createPointEmitter gère le toggle et la clause Mosaic push-down.
        const emit =
          view.emitsSelection
            ? createPointEmitter(ctx, view.emitsSelection, view.geoField)
            : undefined;
        renderChoroplethGL(container, data, {
          format: typeof formatOpt === "string" ? formatOpt : undefined,
          onSelect: emit
            ? (code) => emit(code)
            : undefined,
        });
        return;
      }

      // ── Moteur SVG (défaut, rétro-compat) ────────────────────────────────

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
      // Rendu MAISON (SVG) alimenté par DuckDB — fiable, sans coordinator
      // vgplot. Générique : type de vue line/area, n'importe quelle source.
      const agg = (view.yAggregate ?? "sum").toLowerCase();
      const yExpr =
        !view.yField || agg === "count" ? "count(*)" : `${agg}(${ident(view.yField)})`;
      const strOpt = (k: string): string | undefined => {
        const v = (view.options as Record<string, unknown> | undefined)?.[k];
        return typeof v === "string" ? v : undefined;
      };
      const fmt = strOpt("format");
      const area = view.plotType === "area";
      const filterField = strOpt("filterField");
      const baseSql = view.seriesField
        ? `SELECT ${ident(view.xField)} AS x, ${ident(view.seriesField)} AS s, ${yExpr} AS v ` +
          `FROM ${ident(view.source)} GROUP BY ${ident(view.xField)}, ${ident(view.seriesField)} ` +
          `ORDER BY ${ident(view.xField)}`
        : `SELECT ${ident(view.xField)} AS k, ${yExpr} AS v ` +
          `FROM ${ident(view.source)} GROUP BY ${ident(view.xField)} ORDER BY ${ident(view.xField)}`;
      // activeValue : valeur courante de la sélection single (cross-filter).
      // Variable de fermeture partagée par render ET le listener slicer pour
      // que les deux sources (single selection + slicer) soient combinées en
      // AND à chaque re-render — quel que soit le déclencheur.
      let activeValue: string | null = null;
      const render = async (value: string | null): Promise<void> => {
        activeValue = value;
        const sc = buildSlicerClauses(ctx, slicers, view.source, viewTab, currentTab);
        const singleClause: Clause[] =
          value !== null && filterField ? [{ field: filterField, values: [value] }] : [];
        const sql = injectWhereAll(baseSql, view.source, [...sc, ...singleClause]);
        if (view.seriesField) {
          const rows = await fetchXSV(conn, sql);
          const map = new Map<string, LinePoint[]>();
          for (const r of rows) {
            if (!map.has(r.s)) map.set(r.s, []);
            map.get(r.s)!.push({ x: r.x, y: r.v });
          }
          const series = [...map.entries()].map(([label, points]) => ({ label, points }));
          renderLineChart(container, series, { format: fmt, area, title: view.title });
        } else {
          const rows = await fetchKV(conn, sql);
          renderLineChart(
            container,
            [{ label: view.title ?? "", points: rows.map((r) => ({ x: r.k, y: r.v })) }],
            { format: fmt, area, title: view.title },
          );
        }
      };
      await render(null);
      subscribeCrossFilter(ctx, view.filterBy, filterField, render);
      subscribeSlicers(ctx, slicers, view.source, viewTab, currentTab, () => render(activeValue));
      return;
    }

    case "pie": {
      const palette = (view.options as Record<string, unknown> | undefined)?.[
        "palette"
      ];
      let activeValue: string | null = null;
      const render = async (value: string | null): Promise<void> => {
        activeValue = value;
        const sc = buildSlicerClauses(ctx, slicers, view.source, viewTab, currentTab);
        const singleClause: Clause[] =
          value !== null && view.filterField
            ? [{ field: view.filterField, values: [value] }]
            : [];
        const sql = injectWhereAll(view.sql, view.source, [...sc, ...singleClause]);
        const rows = await fetchKV(conn, sql);
        renderPieChart(
          container,
          rows.map((r) => ({ label: r.k, value: r.v })),
          {
            format: view.valueFormat,
            title: view.title,
            donut: numberOpt(view.options, "donut"),
            size: numberOpt(view.options, "size"),
            palette: Array.isArray(palette) ? (palette as string[]) : undefined,
          },
        );
      };
      await render(null);
      subscribeCrossFilter(ctx, view.filterBy, view.filterField, render);
      subscribeSlicers(ctx, slicers, view.source, viewTab, currentTab, () => render(activeValue));
      return;
    }

    case "ranked_bars": {
      // Émission cross-filter : si la vue porte `emitsSelection` + un champ
      // filtrable, un clic sur une barre pousse une clause point (toggle).
      const emit =
        view.emitsSelection && view.filterField
          ? createPointEmitter(ctx, view.emitsSelection, view.filterField)
          : undefined;
      let activeValue: string | null = null;
      const render = async (value: string | null): Promise<void> => {
        activeValue = value;
        const sc = buildSlicerClauses(ctx, slicers, view.source, viewTab, currentTab);
        const singleClause: Clause[] =
          value !== null && view.filterField
            ? [{ field: view.filterField, values: [value] }]
            : [];
        const sql = injectWhereAll(view.sql, view.source, [...sc, ...singleClause]);
        const rows = await fetchKV(conn, sql);
        const palette = (view.options as Record<string, unknown> | undefined)?.[
          "palette"
        ];
        renderRankedBars(container, rows, {
          format: view.valueFormat,
          valueLabels: view.valueLabels,
          title: view.title,
          palette: Array.isArray(palette) ? (palette as string[]) : undefined,
          onSelect: emit ? (k) => emit(k) : undefined,
        });
      };
      await render(null);
      subscribeCrossFilter(ctx, view.filterBy, view.filterField, render);
      subscribeSlicers(ctx, slicers, view.source, viewTab, currentTab, () => render(activeValue));
      return;
    }

    case "grouped_bars": {
      let activeValue: string | null = null;
      const render = async (value: string | null): Promise<void> => {
        activeValue = value;
        const sc = buildSlicerClauses(ctx, slicers, view.source, viewTab, currentTab);
        const singleClause: Clause[] =
          value !== null && view.filterField
            ? [{ field: view.filterField, values: [value] }]
            : [];
        const sql = injectWhereAll(view.sql, view.source, [...sc, ...singleClause]);
        const rows = await fetchKV2(conn, sql);
        renderGroupedBars(container, rows, {
          seriesLabels: view.seriesLabels,
          format: view.format,
          title: view.title,
        });
      };
      await render(null);
      subscribeCrossFilter(ctx, view.filterBy, view.filterField, render);
      subscribeSlicers(ctx, slicers, view.source, viewTab, currentTab, () => render(activeValue));
      return;
    }

    case "kpi": {
      // Raccourci de navigation : si la carte porte options.navigateTo, un clic
      // émet un événement DOM `vv-navigate` (le dashboard l'écoute et bascule
      // d'onglet) — découplé de la logique d'onglets.
      const navTo = (view.options as Record<string, unknown> | undefined)?.[
        "navigateTo"
      ];
      const onClick =
        typeof navTo === "string"
          ? () =>
              container.dispatchEvent(
                new CustomEvent("vv-navigate", {
                  detail: { tab: navTo },
                  bubbles: true,
                }),
              )
          : undefined;
      let activeValue: string | null = null;
      const render = async (value: string | null): Promise<void> => {
        activeValue = value;
        const sc = buildSlicerClauses(ctx, slicers, view.source, viewTab, currentTab);
        const singleClause: Clause[] =
          value !== null && view.filterField
            ? [{ field: view.filterField, values: [value] }]
            : [];
        const sql = injectWhereAll(view.sql, view.source, [...sc, ...singleClause]);
        const { value: v, delta } = await fetchKpiRow(conn, sql);
        renderKpiCard(container, {
          title: view.title ?? "",
          value: v ?? 0,
          delta: view.hasDelta ? delta : undefined,
          format: view.format,
          deltaUnit: view.deltaUnit,
          foot: view.foot,
          icon: view.icon,
          onClick,
        });
      };
      await render(null);
      subscribeCrossFilter(ctx, view.filterBy, view.filterField, render);
      subscribeSlicers(ctx, slicers, view.source, viewTab, currentTab, () => render(activeValue));
      return;
    }

    case "table": {
      // NOTE : table non filtrée par les slicers (fetch SQL propre) — filtrage slicer = story future.
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
        const pattern = lit(`%${term}%`);
        return (
          "(" +
          textFields.map((f) => `${ident(f)} ILIKE ${pattern}`).join(" OR ") +
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

/**
 * Abonne un composant aux changements des slicers applicables (B-251).
 *
 * `rerender` est une closure sans argument qui relit elle-même activeValue
 * (variable de fermeture dans le case) → les clauses slicer ET single
 * sont combinées en AND à chaque re-render, qu'il soit déclenché par
 * un changement de slicer OU par un changement de sélection single.
 *
 * L'abonnement est réalisé via `ctx.slicerListeners` : une Map
 * slicerId → Set<callback> qui permet de notifier tous les composants
 * concernés lors d'une mise à jour.
 *
 * NOTE : les vues `bar` (vgplot natif) ne passent pas par ce mécanisme —
 * leur filtre est géré par `vg.from(source, {filterBy})` nativement.
 * La plomberie slicer→vgplot est hors scope (B-251 / CLAUDE.md §4.3).
 */
export function subscribeSlicers(
  ctx: RuntimeContext,
  slicers: SlicerSpec[],
  viewSource: string,
  viewTab: string | undefined,
  currentTab: string | undefined,
  rerender: () => Promise<void>,
): void {
  // Slicers applicables à cette vue (même prédicat que buildSlicerClauses).
  const applicable = slicers.filter((s) =>
    isSlicerApplicable(s, viewSource, viewTab, currentTab),
  );
  if (applicable.length === 0) return;

  // Initialise le registre de listeners si absent.
  if (!ctx.slicerListeners) {
    ctx.slicerListeners = new Map();
  }
  for (const s of applicable) {
    let set = ctx.slicerListeners.get(s.id);
    if (!set) {
      set = new Set();
      ctx.slicerListeners.set(s.id, set);
    }
    set.add(() => void rerender());
  }
}

/**
 * Met à jour l'état d'un slicer et notifie tous les composants abonnés.
 *
 * À appeler depuis le `renderSlicerPanel` `onChange` (via le composant
 * UI ou les tests d'intégration). Préserve push-down : aucun filtrage
 * JS ici, on stocke juste les valeurs et on re-render les vues.
 */
export function updateSlicerState(
  ctx: RuntimeContext,
  slicerId: string,
  values: string[],
): void {
  ctx.slicerState.set(slicerId, values);
  // Notifier tous les composants abonnés à ce slicer.
  const listeners = ctx.slicerListeners?.get(slicerId);
  if (listeners) {
    for (const fn of listeners) fn();
  }
}
