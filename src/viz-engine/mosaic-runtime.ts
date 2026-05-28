// B-040 — Runtime Mosaic : registre Selection / Param + binding interaction.
//
// Ce module concentre toute la logique d'**émission de clauses**
// (`SelectionClause`) vers une `vg.Selection`. C'est l'unique endroit du
// codebase où des handlers DOM produisent des clauses Mosaic. Ce
// confinement est nécessaire au critère No-Go H4 (« aucune ligne de JS
// impératif de filtrage métier hors `viz-engine/` ») — cf. PRD §12.1.
//
// Architecturalement, on respecte l'API publique de mosaic-core 0.26 :
// - `Selection.single({ empty: true })` : sélection « point » à clause
//   unique, vide par défaut (aucun filtre tant qu'aucun clic).
// - `Param.value(v)` : paramètre scalaire dynamique.
// - `clausePoint(field, value, { source })` : helper qui construit le
//   `SelectionClause` au bon format (predicate `ExprNode`, pas string).
//   Passer `value === undefined` produit `predicate: null` → la clause
//   est filtrée par le resolver et la sélection redevient vide.
//
// Cf. `node_modules/@uwdata/mosaic-core/src/Selection.ts` et
// `SelectionClause.ts` pour la spec exacte.

import { Param, Selection, clausePoint } from "@uwdata/mosaic-core";

export type SelectionKind = "single" | "interval" | "crossfilter";

export interface RuntimeContext {
  /** Selections nommées (clé = id DSL). */
  selections: Map<string, Selection>;
  /** Params scalaires nommés. */
  params: Map<string, Param<unknown>>;
  /** Identifiants de source synthétiques (ClauseSource = identité objet). */
  sources: Map<string, object>;
}

/** Crée un contexte d'exécution Mosaic vierge. */
export function createRuntime(): RuntimeContext {
  return {
    selections: new Map(),
    params: new Map(),
    sources: new Map(),
  };
}

/**
 * Récupère (ou crée) une `vg.Selection` par nom.
 *
 * Idempotent : un nom donné retourne toujours la même instance — ce qui
 * permet aux clients (carte, barres, table) de partager la même
 * sélection sans avoir à se passer la référence.
 */
export function ensureSelection(
  ctx: RuntimeContext,
  name: string,
  kind: SelectionKind = "single",
): Selection {
  let sel = ctx.selections.get(name);
  if (!sel) {
    switch (kind) {
      case "interval":
        sel = Selection.intersect({ empty: true });
        break;
      case "crossfilter":
        sel = Selection.crossfilter({ empty: true });
        break;
      case "single":
      default:
        sel = Selection.single({ empty: true });
        break;
    }
    ctx.selections.set(name, sel);
  }
  return sel;
}

/**
 * Récupère (ou crée) un `vg.Param` scalaire par nom.
 *
 * `init` n'est utilisé que lors de la première création — les appels
 * suivants ignorent leur valeur initiale (l'instance existante porte
 * déjà son état).
 */
export function ensureParam(
  ctx: RuntimeContext,
  name: string,
  init: unknown = null,
): Param<unknown> {
  let p = ctx.params.get(name);
  if (!p) {
    p = Param.value(init);
    ctx.params.set(name, p);
  }
  return p;
}

/**
 * Récupère (ou crée) un identifiant de source synthétique. Chaque
 * composant qui émet des clauses doit fournir une `source` (identité
 * objet, cf. `SelectionClause.source: ClauseSource`). On stocke ces
 * sentinelles dans le runtime pour éviter de créer des objets neufs à
 * chaque clic (ce qui casserait la déduplication des clauses dans le
 * resolver, qui filtre par `c.source === source`).
 */
export function ensureClauseSource(ctx: RuntimeContext, name: string): object {
  let s = ctx.sources.get(name);
  if (!s) {
    s = { __vvSource: name };
    ctx.sources.set(name, s);
  }
  return s;
}

// ---------------------------------------------------------------------------
// Binding carte ↔ Selection (B-040)
// ---------------------------------------------------------------------------

export interface BindMapSelectionOptions {
  /** Champ SQL sur lequel filtrer (ex: "code_dept"). */
  field: string;
  /** Nom de la Selection partagée dans le runtime (clé `selections`). */
  selectionName: string;
  /** Nom d'identité de la source des clauses (clé `sources`). */
  sourceName?: string;
}

/**
 * Lie les `<path data-dept="...">` d'une carte choroplèthe à une
 * `vg.Selection`. Au clic :
 *
 * 1. si le département cliqué est déjà sélectionné → émission d'une
 *    clause avec `value === undefined` (predicate null) → la sélection
 *    redevient vide.
 * 2. sinon → émission d'une `clausePoint(field, code)`. Le resolver
 *    `single` remplace la clause précédente issue de la même source.
 *
 * Visuel : `stroke-width` épaissi sur le département actif, restauré au
 * clic suivant.
 *
 * Logging : la valeur du clause-point (qui produira un predicate
 * `field IN (literal)`) est tracée via `console.debug` — preuve de
 * push-down dans les logs SQL DuckDB pour le critère B-040.
 */
export function bindMapSelection(
  svg: SVGSVGElement,
  ctx: RuntimeContext,
  opts: BindMapSelectionOptions,
): () => void {
  const sel = ensureSelection(ctx, opts.selectionName, "single");
  const source = ensureClauseSource(
    ctx,
    opts.sourceName ?? `map:${opts.selectionName}`,
  );

  let current: string | null = null;
  const listeners: Array<{
    p: SVGPathElement;
    fn: (e: MouseEvent) => void;
  }> = [];

  const paths = svg.querySelectorAll<SVGPathElement>("path[data-dept]");
  for (const p of Array.from(paths)) {
    p.style.cursor = "pointer";
    const fn = (e: MouseEvent): void => {
      e.stopPropagation();
      const code = p.dataset.dept ?? "";
      if (current === code) {
        current = null;
        clearMapStroke(svg);
        // Clause vide → predicate null → selection redevient empty.
        sel.update(clausePoint(opts.field, undefined, { source }));
        console.debug("[B-040] selection cleared");
      } else {
        current = code;
        clearMapStroke(svg);
        p.style.strokeWidth = "2.5";
        p.style.stroke = "#213547";
        sel.update(clausePoint(opts.field, code, { source }));
        console.debug(
          "[B-040] selection push-down :",
          `${opts.field} = '${code}' (selection=${opts.selectionName})`,
        );
      }
    };
    p.addEventListener("click", fn);
    listeners.push({ p, fn });
  }

  return function unbind() {
    for (const { p, fn } of listeners) {
      p.removeEventListener("click", fn);
    }
    listeners.length = 0;
  };
}

function clearMapStroke(svg: SVGSVGElement): void {
  const paths = svg.querySelectorAll<SVGPathElement>("path[data-dept]");
  for (const p of Array.from(paths)) {
    p.style.strokeWidth = "0.5";
    p.style.stroke = "#fff";
  }
}

// ---------------------------------------------------------------------------
// Compileur DSL .vviz → plan de rendu Mosaic (B-041)
// ---------------------------------------------------------------------------

/**
 * Vue compilée — l'élément DOM est créé mais non encore monté ; chaque
 * vue référence le nom de Selection à utiliser (le runtime garantit
 * que ces Selection existent au moment du compile).
 */
export interface CompiledView {
  id: string;
  type: string;
  source: string;
  title?: string;
  encoding?: Record<string, unknown>;
  options?: Record<string, unknown>;
  filterSelectionName?: string;
  /** Vrai si la vue *émet* des clauses (cas du map_choropleth). */
  emitsTo?: string;
}

export interface CompiledDoc {
  ctx: RuntimeContext;
  layout: "vstack" | "hstack" | "grid";
  views: CompiledView[];
}

/**
 * Compile un document `.vviz` validé (cf. JSON Schema B-033b /
 * validateur B-061) en plan de rendu Mosaic. Le compileur ne fait
 * **aucun** rendu DOM — il enregistre les Selection nommées du DSL
 * dans le runtime, et retourne une liste de `CompiledView` que les
 * composants (`renderChoropleth`, `renderBarChart`, `renderTable`)
 * pourront monter eux-mêmes.
 *
 * Confiner la traduction DSL → composants dans `viz-engine/` est
 * essentiel au critère No-Go H4 (PRD §12.1) — le code applicatif ne
 * voit qu'une liste de plans déjà résolus.
 *
 * Mapping DSL :
 * - `selections[].id` + `kind` → `ensureSelection(ctx, id, kind)`.
 * - View `type: "map_choropleth"` + `options.selectionTarget` →
 *   `emitsTo: <selectionName>` (le binder sera attaché côté composant).
 * - View `filterBy: <selId>` → `filterSelectionName: <selId>`.
 */
export function compileToMosaic(doc: {
  spec: {
    layout?: string;
    selections?: Array<{ id: string; kind: SelectionKind }>;
    views: Array<{
      id: string;
      type: string;
      source: string;
      title?: string;
      encoding?: Record<string, unknown>;
      options?: Record<string, unknown>;
      filterBy?: string;
    }>;
  };
}): CompiledDoc {
  const ctx = createRuntime();
  const layout = (doc.spec.layout ?? "vstack") as
    | "vstack"
    | "hstack"
    | "grid";

  // 1. Pré-enregistrer toutes les Selection déclarées dans le DSL.
  for (const s of doc.spec.selections ?? []) {
    ensureSelection(ctx, s.id, s.kind);
  }

  // 2. Compiler chaque view.
  const views: CompiledView[] = [];
  for (const v of doc.spec.views) {
    const compiled: CompiledView = {
      id: v.id,
      type: v.type,
      source: v.source,
      title: v.title,
      encoding: v.encoding,
      options: v.options,
    };
    if (v.filterBy) {
      // S'assurer que la Selection référencée existe.
      ensureSelection(ctx, v.filterBy, "single");
      compiled.filterSelectionName = v.filterBy;
    }
    // map_choropleth : la cible d'émission se déclare via
    // options.selectionTarget (extension VaultViz).
    const selTarget = (v.options as Record<string, unknown> | undefined)?.[
      "selectionTarget"
    ];
    if (typeof selTarget === "string") {
      ensureSelection(ctx, selTarget, "single");
      compiled.emitsTo = selTarget;
    }
    views.push(compiled);
  }

  return { ctx, layout, views };
}
