// Pour chaque source déclarée dans le .vviz, on crée une vue DuckDB :
//   CREATE OR REPLACE VIEW "<name>" AS SELECT * FROM read_parquet('<path>')
// Le `name` doit matcher le pattern SQL (déjà contraint par le schema
// JSON : `^[a-zA-Z_][a-zA-Z0-9_]{0,63}$`). On revalide ici par
// défense en profondeur.

import { resolvePath } from "./path-resolver";
import type { DuckConnector } from "./duck-connector";
import type { VVizDocument } from "./types";

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;
const DOC_ID = /^[a-zA-Z0-9_]{1,32}$/;

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/**
 * Nom du schéma DuckDB d'un document (SP4 — multi-documents).
 *
 * - Avec `docId` valide : `doc_<docId>`.
 * - Sans `docId` : chaîne vide → schéma `main` implicite (rétro-compat).
 */
export function schemaName(docId?: string): string {
  if (docId === undefined) return "";
  if (!DOC_ID.test(docId)) {
    throw new Error(`docId invalide : "${docId}"`);
  }
  return `doc_${docId}`;
}

/**
 * Crée une vue DuckDB par source déclarée dans le `.vviz`.
 *
 * - Sans `docId` : `CREATE OR REPLACE VIEW "<name>" AS ...` dans le
 *   schéma `main` implicite (comportement historique, inchangé).
 * - Avec `docId` : crée d'abord `doc_<docId>` puis chaque vue qualifiée
 *   `doc_<docId>."<name>"` → isolation multi-documents (SP4).
 */
export async function loadSources(
  conn: DuckConnector,
  doc: VVizDocument,
  vvizDirPath: string,
  docId?: string,
): Promise<void> {
  const schema = schemaName(docId); // valide docId, "" si absent
  if (schema) {
    await conn.query({
      type: "exec",
      sql: `CREATE SCHEMA IF NOT EXISTS ${schema}`,
    });
  }
  const prefix = schema ? `${schema}.` : "";
  for (const src of doc.data.sources) {
    if (!SAFE_IDENT.test(src.name)) {
      throw new Error(
        `nom de source invalide (identifiant SQL attendu) : "${src.name}"`,
      );
    }
    const resolved = resolvePath(src.path, vvizDirPath);
    const sql =
      `CREATE OR REPLACE VIEW ${prefix}"${src.name}" AS ` +
      `SELECT * FROM read_parquet(${sqlString(resolved)})`;
    await conn.query({ type: "exec", sql });
  }
}

/**
 * Supprime le schéma d'un document et toutes ses vues (SP4).
 *
 * `DROP SCHEMA IF EXISTS doc_<docId> CASCADE`. À appeler à la fermeture
 * d'un document pour libérer les vues isolées.
 */
export async function dropDocSchema(
  conn: DuckConnector,
  docId: string,
): Promise<void> {
  const schema = schemaName(docId); // valide docId (throw si invalide)
  if (!schema) {
    throw new Error("dropDocSchema requiert un docId");
  }
  await conn.query({
    type: "exec",
    sql: `DROP SCHEMA IF EXISTS ${schema} CASCADE`,
  });
}
