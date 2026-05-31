// where-builder — Généralise injectWhere (view-mounter) à N clauses
// combinées en AND. Multi-valeurs → IN (...).
// Push-down DuckDB préservé : aucun filtrage JS, tout part en SQL.

import { ident, lit } from "./sql-helpers";

/**
 * Clause de filtre : un champ + une ou plusieurs valeurs.
 * - values=[] : clause inactive (ignorée).
 * - values=[v] : `"field" = 'v'`
 * - values=[v1,v2,...] : `"field" IN ('v1', 'v2', ...)`
 */
export interface Clause {
  /** Colonne SQL (issue du DSL .vviz validé par schéma). */
  field: string;
  /** Valeurs cochées ; [] = clause inactive (ignorée). */
  values: string[];
}

function predicate(c: Clause): string | null {
  const vals = c.values.filter((v) => v.length > 0);
  if (vals.length === 0) return null;
  if (vals.length === 1) return `${ident(c.field)} = ${lit(vals[0])}`;
  return `${ident(c.field)} IN (${vals.map(lit).join(", ")})`;
}

/**
 * Injecte une clause `WHERE … AND …` dans une requête déjà compilée,
 * juste APRÈS `FROM "<source>"` (avant GROUP BY / ORDER BY / LIMIT).
 *
 * - 0 clause active → SQL inchangé.
 * - N clauses → `WHERE pred1 AND pred2 … AND predN`.
 * - Token `FROM "<source>"` introuvable → SQL inchangé (garde-fou).
 *
 * Les identifiants sont double-quotés (ident()), les valeurs
 * single-quotées avec échappement (lit()), conforme DuckDB.
 */
export function injectWhereAll(
  sql: string,
  source: string,
  clauses: Clause[],
): string {
  const preds = clauses.map(predicate).filter((p): p is string => p !== null);
  if (preds.length === 0) return sql;
  const fromToken = `FROM ${ident(source)}`;
  const idx = sql.indexOf(fromToken);
  if (idx === -1) return sql;
  const insertAt = idx + fromToken.length;
  return sql.slice(0, insertAt) + ` WHERE ${preds.join(" AND ")}` + sql.slice(insertAt);
}
