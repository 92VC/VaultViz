// SP3 / T3.final — Layout dashboard par zones.
//
// Place chaque vue compilée dans la zone déclarée par
// `view.options.region` ∈ {kpi, main, side, full} :
//
//   .dash-grid
//     .kpis        — bandeau de cartes KPI en haut (grille 4 colonnes)
//     .grid-2      — rangée graphiques : .col main | .col side
//     .table-card  — table pleine largeur en bas
//
// Fidèle au markup de `mockups/VaultViz/VaultViz.html` (.kpis / .grid-2 /
// .col / .table-card / .card / .card-head / .card-title / .card-sub).
//
// Le chip de filtre actif (mountFilterChip) est lié à la Selection
// émettrice (s'il existe une vue carte avec `emitsTo`) : son bouton de
// réinitialisation vide la sélection via le même chemin clause que
// bindMapSelection (clausePoint value=undefined → predicate null).
//
// Si `layout !== "dashboard"` ou qu'aucune vue ne porte de region, on
// retombe sur un flux vertical (mêmes frames `.vv-view-frame` que le
// montage historique de main.ts).

import { clausePoint } from "@uwdata/mosaic-core";

import type { CompiledView } from "../viz-engine/view-compiler";
import type { DuckConnector } from "../viz-engine/duck-connector";
import type { RuntimeContext } from "../viz-engine/mosaic-runtime";
import { ensureClauseSource } from "../viz-engine/mosaic-runtime";
import { mountCompiledView } from "../viz-engine/view-mounter";
import { onSelectionValue } from "../viz-engine/drill-query";
import { mountFilterChip } from "../components/filter-chip";
import { renderTabBar, type TabDef } from "../components/tab-bar";

type Region = "kpi" | "main" | "side" | "full";

function regionOf(view: CompiledView): Region | undefined {
  const r = (view.options as Record<string, unknown> | undefined)?.["region"];
  return r === "kpi" || r === "main" || r === "side" || r === "full"
    ? r
    : undefined;
}

function subtitleOf(view: CompiledView): string | undefined {
  const s = (view.options as Record<string, unknown> | undefined)?.["subtitle"];
  return typeof s === "string" ? s : undefined;
}

/**
 * Carte standard (`.card`) avec en-tête titre/sous-titre, retournant le
 * conteneur `.card-body` où monter la vue. Les KPI n'ont pas de wrapper
 * (la carte est rendue par renderKpiCard lui-même).
 */
function makeCard(view: CompiledView): { card: HTMLElement; body: HTMLElement } {
  const card = document.createElement("div");
  // `options.bare` (DSL) : carte sans fond/bordure (se fond avec le fond
  // de l'app) — ex. carte choroplèthe centrée sur fond transparent.
  const bare =
    (view.options as Record<string, unknown> | undefined)?.["bare"] === true;
  card.className = bare ? "card bare" : "card";
  card.dataset.viewId = view.id;

  const title = view.title;
  const sub = subtitleOf(view);
  if (title || sub) {
    const head = document.createElement("div");
    head.className = "card-head";
    const l = document.createElement("div");
    l.className = "ch-l";
    if (title) {
      const t = document.createElement("div");
      t.className = "card-title";
      t.textContent = title;
      l.appendChild(t);
    }
    if (sub) {
      const s = document.createElement("div");
      s.className = "card-sub";
      s.textContent = sub;
      l.appendChild(s);
    }
    head.appendChild(l);
    card.appendChild(head);
  }

  const body = document.createElement("div");
  body.className = "card-body";
  card.appendChild(body);
  return { card, body };
}

async function mountInto(
  view: CompiledView,
  mount: HTMLElement,
  ctx: RuntimeContext,
  conn: DuckConnector,
): Promise<void> {
  try {
    await mountCompiledView(view, mount, ctx, conn);
  } catch (err) {
    const msg = (err as Error).message ?? String(err);
    const note = document.createElement("p");
    note.className = "vv-note vv-note-error";
    note.textContent = `Vue "${view.id}" : ${msg}`;
    mount.appendChild(note);
  }
}

/**
 * Réinitialise une Selection émettrice (vide la clause) — même chemin
 * que le clic « désélection » de bindMapSelection.
 */
function clearSelection(
  ctx: RuntimeContext,
  selectionName: string,
  field: string,
  sourceName = `map:${selectionName}`,
): void {
  const sel = ctx.selections.get(selectionName);
  if (!sel) return;
  // Même ClauseSource que l'émetteur (carte = `map:…`, barres = `emit:…`)
  // → le resolver `single` retire la clause (désélection).
  const source = ensureClauseSource(ctx, sourceName);
  sel.update(clausePoint(field, undefined, { source }));
}

/**
 * Monte le tableau de bord par zones. Retombe sur un flux vertical si
 * aucune vue ne porte de `region` (layout non-dashboard).
 */
export async function mountDashboard(
  container: HTMLElement,
  views: CompiledView[],
  ctx: RuntimeContext,
  conn: DuckConnector,
  opts: { gridRatio?: [number, number]; tabs?: TabDef[] } = {},
): Promise<void> {
  const hasRegions = views.some((v) => regionOf(v) !== undefined);

  if (!hasRegions) {
    // Fallback : flux vertical (parité avec le montage historique).
    const stack = document.createElement("div");
    stack.className = "vv-layout vv-layout-vstack";
    container.appendChild(stack);
    for (const v of views) {
      const frame = document.createElement("section");
      frame.className = `vv-view-frame vv-view-${v.kind}`;
      frame.dataset.viewId = v.id;
      const mount = document.createElement("div");
      mount.className = "vv-view-mount";
      frame.appendChild(mount);
      stack.appendChild(frame);
      await mountInto(v, mount, ctx, conn);
    }
    return;
  }

  // Grille par zones.
  const grid = document.createElement("div");
  grid.className = "dash-grid";

  const kpis = document.createElement("div");
  kpis.className = "kpis";
  grid.appendChild(kpis);
  container.appendChild(grid);

  // Ratio des colonnes [principale, latérale] piloté par le DSL (spec.gridRatio).
  const gr = opts.gridRatio;
  const validGr =
    Array.isArray(gr) &&
    gr.length === 2 &&
    gr.every((n) => typeof n === "number" && Number.isFinite(n) && n > 0);
  /** Construit une rangée `.grid-2` (colonnes principale | latérale). */
  function makeRow(): { row: HTMLElement; colMain: HTMLElement; colSide: HTMLElement } {
    const row = document.createElement("div");
    row.className = "grid-2";
    if (validGr) {
      row.style.gridTemplateColumns = `minmax(0, ${gr![0]}fr) minmax(0, ${gr![1]}fr)`;
    }
    const colMain = document.createElement("div");
    colMain.className = "col col-main";
    const colSide = document.createElement("div");
    colSide.className = "col col-side";
    row.append(colMain, colSide);
    return { row, colMain, colSide };
  }

  /** Place une vue graphe (non-KPI) dans les colonnes / le host pleine largeur. */
  async function placeChart(
    v: CompiledView,
    colMain: HTMLElement,
    colSide: HTMLElement,
    fullHost: HTMLElement,
  ): Promise<void> {
    const region = regionOf(v) ?? "main";
    if (region === "full") {
      const card = document.createElement("div");
      card.className = "card table-card";
      card.dataset.viewId = v.id;
      fullHost.appendChild(card);
      await mountInto(v, card, ctx, conn);
      return;
    }
    const { card, body } = makeCard(v);
    (region === "side" ? colSide : colMain).appendChild(card);
    await mountInto(v, body, ctx, conn);
  }

  // Chip de filtre actif (« Filtre : X ✕ ») : lié à la première vue
  // ÉMETTRICE — carte choroplèthe OU barres classées (extension cross-filter).
  const emitter = views.find(
    (v) =>
      (v.kind === "choropleth" || v.kind === "ranked_bars") &&
      (v as { emitsSelection?: string }).emitsSelection,
  );
  let chip: { set(label: string | null): void } | null = null;
  if (emitter) {
    const selName = (emitter as { emitsSelection: string }).emitsSelection;
    const field =
      emitter.kind === "choropleth"
        ? emitter.geoField
        : (emitter as { filterField?: string }).filterField;
    const sourceName =
      emitter.kind === "choropleth" ? `map:${selName}` : `emit:${selName}`;
    if (field) {
      const chipHost = document.createElement("div");
      chipHost.className = "dash-filter";
      grid.insertBefore(chipHost, kpis);
      chip = mountFilterChip(chipHost, {
        onClear: () => clearSelection(ctx, selName, field, sourceName),
      });
      onSelectionValue(ctx, selName, (v) => chip?.set(v));
    }
  }

  // Bandeau KPI : TOUJOURS visible (synthèse permanente, au-dessus des onglets).
  const kpiViews = views.filter((v) => regionOf(v) === "kpi");
  const chartViews = views.filter((v) => regionOf(v) !== "kpi");
  for (const v of kpiViews) {
    const mount = document.createElement("div");
    mount.dataset.viewId = v.id;
    kpis.appendChild(mount);
    await mountInto(v, mount, ctx, conn);
  }

  const tabs = opts.tabs?.filter((t) => t && typeof t.id === "string");

  if (tabs && tabs.length > 0) {
    // Onglets internes : un panneau par onglet, seul l'actif est visible.
    const panels = new Map<
      string,
      { panel: HTMLElement; colMain: HTMLElement; colSide: HTMLElement }
    >();
    function switchTab(id: string): void {
      for (const [tid, p] of panels) p.panel.hidden = tid !== id;
      tabBar.setActive(id);
    }
    const tabBar = renderTabBar(grid, tabs, {
      active: tabs[0].id,
      onSelect: switchTab,
    });

    for (const t of tabs) {
      const panel = document.createElement("div");
      panel.className = "tab-panel";
      panel.dataset.tab = t.id;
      const { row, colMain, colSide } = makeRow();
      panel.appendChild(row);
      grid.appendChild(panel);
      panels.set(t.id, { panel, colMain, colSide });
    }

    const tabIds = new Set(tabs.map((t) => t.id));
    for (const v of chartViews) {
      const declared = (v.options as Record<string, unknown> | undefined)?.["tab"];
      const tabId =
        typeof declared === "string" && tabIds.has(declared)
          ? declared
          : tabs[0].id;
      const target = panels.get(tabId)!;
      await placeChart(v, target.colMain, target.colSide, target.panel);
    }

    // État initial : 1er onglet actif.
    for (const [tid, p] of panels) p.panel.hidden = tid !== tabs[0].id;
    // Raccourcis KPI : un clic sur une carte émet `vv-navigate`.
    grid.addEventListener("vv-navigate", (e) =>
      switchTab((e as CustomEvent).detail.tab),
    );
    return;
  }

  // Sans onglets : rangée unique (comportement historique).
  const { row, colMain, colSide } = makeRow();
  grid.appendChild(row);
  for (const v of chartViews) {
    await placeChart(v, colMain, colSide, grid);
  }
}
