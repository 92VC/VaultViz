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
): void {
  const sel = ctx.selections.get(selectionName);
  if (!sel) return;
  const source = ensureClauseSource(ctx, `map:${selectionName}`);
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
  opts: { gridRatio?: [number, number] } = {},
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

  const row = document.createElement("div");
  row.className = "grid-2";
  // Ratio des colonnes [principale, latérale] piloté par le DSL
  // (spec.gridRatio). Sans valeur → défaut CSS (1.32 | 1). Permet de
  // réduire la zone principale (ex. carte) au profit des vues de droite,
  // côté fichier .vviz — pas de hardcodage par dashboard.
  const gr = opts.gridRatio;
  if (
    Array.isArray(gr) &&
    gr.length === 2 &&
    gr.every((n) => typeof n === "number" && Number.isFinite(n) && n > 0)
  ) {
    row.style.gridTemplateColumns = `minmax(0, ${gr[0]}fr) minmax(0, ${gr[1]}fr)`;
  }
  const colMain = document.createElement("div");
  colMain.className = "col col-main";
  const colSide = document.createElement("div");
  colSide.className = "col col-side";
  row.append(colMain, colSide);

  grid.append(kpis, row);
  container.appendChild(grid);

  // Chip de filtre : lié à la première vue carte émettrice.
  const emitter = views.find(
    (v) => v.kind === "choropleth" && v.emitsSelection,
  ) as Extract<CompiledView, { kind: "choropleth" }> | undefined;
  let chip: { set(label: string | null): void } | null = null;
  if (emitter?.emitsSelection) {
    const selName = emitter.emitsSelection;
    const field = emitter.geoField;
    const chipHost = document.createElement("div");
    chipHost.className = "dash-filter";
    grid.insertBefore(chipHost, kpis);
    chip = mountFilterChip(chipHost, {
      onClear: () => clearSelection(ctx, selName, field),
    });
    onSelectionValue(ctx, selName, (v) => chip?.set(v));
  }

  for (const v of views) {
    const region = regionOf(v) ?? "main";

    if (region === "kpi") {
      // KPI : pas de wrapper card (renderKpiCard émet sa propre .card).
      const mount = document.createElement("div");
      mount.dataset.viewId = v.id;
      kpis.appendChild(mount);
      await mountInto(v, mount, ctx, conn);
      continue;
    }

    if (region === "full") {
      const card = document.createElement("div");
      card.className = "card table-card";
      card.dataset.viewId = v.id;
      grid.appendChild(card);
      await mountInto(v, card, ctx, conn);
      continue;
    }

    const { card, body } = makeCard(v);
    (region === "side" ? colSide : colMain).appendChild(card);
    await mountInto(v, body, ctx, conn);
  }
}
