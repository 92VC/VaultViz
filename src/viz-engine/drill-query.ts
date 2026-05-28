// B-050 — Helper de re-query pour drill-down via Selection Mosaic.
//
// Centralise la génération SQL pilotée par l'`active.value` d'une
// `vg.Selection`. Reste *agnostique* du composant cible (table, KPI,
// liste, …) — on n'expose qu'une fonction `buildDrillSql()` + un
// abonnement `onSelectionValue()` qui re-query notre connector.
//
// Confiner cette logique dans `viz-engine/` garantit que `main.ts`
// reste du câblage (cf. critère No-Go H4 — B-041).

import type { Table } from "apache-arrow";

import type { DuckConnector } from "./duck-connector";
import type { RuntimeContext } from "./mosaic-runtime";

export interface DrillQueryOptions {
  /** Vue/table DuckDB de référence (CREATE VIEW préalable). */
  table: string;
  /** Champ filtré par la Selection (ex: "code_dept"). */
  field: string;
  /** Colonnes du SELECT. */
  columns: string[];
  /** Tri courant (optionnel). */
  orderBy?: { field: string; dir: "asc" | "desc" } | null;
  /** Tri par défaut si pas de orderBy explicite (ex: "id"). */
  defaultOrder?: string;
  /** LIMIT — défaut 5000. */
  limit?: number;
}

/**
 * Construit le SQL de drill : SELECT `columns` FROM `table` [WHERE
 * field = '<value>'] ORDER BY ... LIMIT N. La value est échappée
 * (single-quote doublée) pour éviter une injection triviale ; le seul
 * autre vecteur d'entrée (champ, table, colonne) provient du DSL .vviz
 * validé par JSON Schema (B-061).
 */
export function buildDrillSql(
  opts: DrillQueryOptions,
  value: string | null,
): string {
  // Valide tous les identifiants en entrée — même ceux non utilisés
  // sur ce path (ex: `field` sans WHERE) — pour prévenir une
  // injection par contournement du chemin.
  const quotedTable = quoteIdent(opts.table);
  const quotedField = quoteIdent(opts.field);
  const cols = opts.columns.map(quoteIdent).join(", ");
  const where = value !== null
    ? `WHERE ${quotedField} = '${escapeSqlLiteral(value)}'`
    : "";
  const order = opts.orderBy
    ? `ORDER BY ${quoteIdent(opts.orderBy.field)} ${opts.orderBy.dir.toUpperCase()}`
    : opts.defaultOrder
      ? `ORDER BY ${quoteIdent(opts.defaultOrder)}`
      : "";
  const limit = opts.limit ?? 5000;
  return `SELECT ${cols} FROM ${quotedTable} ${where} ${order} LIMIT ${limit}`;
}

/**
 * Exécute la query drill via le connector et retourne la `Table`
 * Arrow. En cas d'erreur, retourne null et log un `console.warn`.
 */
export async function fetchDrill(
  conn: DuckConnector,
  opts: DrillQueryOptions,
  value: string | null,
): Promise<Table | null> {
  const sql = buildDrillSql(opts, value);
  try {
    const res = await conn.query({ type: "arrow", sql });
    return (res ?? null) as Table | null;
  } catch (err) {
    console.warn("[B-050] drill query failed:", err);
    return null;
  }
}

/**
 * S'abonne à la Selection nommée et invoque `onChange(value)` à chaque
 * mise à jour. Retourne un unsubscribe.
 */
export function onSelectionValue(
  ctx: RuntimeContext,
  selectionName: string,
  onChange: (value: string | null) => void,
): () => void {
  const sel = ctx.selections.get(selectionName);
  if (!sel) return () => undefined;
  const handler = (): void => {
    const v = sel.active?.value;
    onChange(typeof v === "string" ? v : null);
  };
  // Selection hérite de Param hérite de AsyncDispatch
  // (cf. node_modules/@uwdata/mosaic-core/src/Param.ts).
  sel.addEventListener("value", handler);
  return () => sel.removeEventListener("value", handler);
}

function quoteIdent(name: string): string {
  // DuckDB : double-quote pour identifiants. On rejette tout caractère
  // hors charset ASCII identifiant SQL — protection minimale (le DSL
  // .vviz valide déjà via JSON Schema pattern `^[a-zA-Z_]\w{0,63}$`).
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Identifiant SQL invalide : ${name}`);
  }
  return `"${name}"`;
}

function escapeSqlLiteral(s: string): string {
  return s.replace(/'/g, "''");
}
