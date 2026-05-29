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
 * Garde-fou anti-blocage (UC-6) : une requête d'indexation qui ne répond
 * pas (read_parquet sur un chemin inaccessible / DuckDB figé) ne doit JAMAIS
 * laisser l'app sur un loader infini. Au-delà de `ms`, on rejette avec un
 * message actionnable (le `label` porte la source + le chemin résolu).
 *
 * `CREATE VIEW … read_parquet(...)` ne lit que le schéma/footer du Parquet
 * (rapide même sur 1 Go) → un délai généreux (30 s par défaut) ne crée pas
 * de faux positif sur le cas share volumineux.
 */
async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(
      () => reject(new Error(`délai dépassé (${Math.round(ms / 1000)} s) — ${label}`)),
      ms,
    );
  });
  try {
    return await Promise.race([p, timeout]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/**
 * Nom de vue DuckDB d'une source (SP4 — multi-documents).
 *
 * Namespacing par NOM DE VUE PLAT préfixé (et non par schéma DuckDB, qui
 * cassait vgplot : `vg.from('doc_d1."src"')` re-quote la chaîne en UN
 * seul identifiant invalide). Un nom plat `doc_<docId>__<source>` est un
 * identifiant SQL simple, donc valide à la fois pour vgplot (`vg.from`
 * le quote en bloc correctement) et pour l'injection de WHERE.
 *
 * - Sans `docId` : identifiant simple `<source>` (rétro-compat).
 * - Avec `docId` valide : `doc_<docId>__<source>` (plat).
 */
export function viewName(docId: string | undefined, source: string): string {
  if (docId === undefined) return source;
  if (!DOC_ID.test(docId)) {
    throw new Error(`docId invalide : "${docId}"`);
  }
  return `doc_${docId}__${source}`;
}

/**
 * Crée une vue DuckDB par source déclarée dans le `.vviz`.
 *
 * - Sans `docId` : `CREATE OR REPLACE VIEW "<name>" AS ...` (comportement
 *   historique, inchangé).
 * - Avec `docId` : `CREATE OR REPLACE VIEW "doc_<docId>__<name>" AS ...`
 *   → isolation multi-documents par vues plates préfixées (SP4). PLUS de
 *   `CREATE SCHEMA`.
 */
export async function loadSources(
  conn: DuckConnector,
  doc: VVizDocument,
  vvizDirPath: string,
  docId?: string,
  timeoutMs = 30_000,
): Promise<void> {
  // Valide docId en amont (throw avant tout SQL si invalide).
  if (docId !== undefined && !DOC_ID.test(docId)) {
    throw new Error(`docId invalide : "${docId}"`);
  }
  for (const src of doc.data.sources) {
    if (!SAFE_IDENT.test(src.name)) {
      throw new Error(
        `nom de source invalide (identifiant SQL attendu) : "${src.name}"`,
      );
    }
    const resolved = resolvePath(src.path, vvizDirPath);
    const view = viewName(docId, src.name);
    const sql =
      `CREATE OR REPLACE VIEW "${view}" AS ` +
      `SELECT * FROM read_parquet(${sqlString(resolved)})`;
    await withTimeout(
      conn.query({ type: "exec", sql }),
      timeoutMs,
      `indexation de la source « ${src.name} » (${resolved})`,
    );
  }
}

/**
 * Supprime les vues plates préfixées d'un document (SP4).
 *
 * Exécute `DROP VIEW IF EXISTS "doc_<docId>__<name>"` pour chaque source.
 * À appeler à la fermeture d'un document pour libérer les vues isolées.
 */
export async function dropDocViews(
  conn: DuckConnector,
  docId: string,
  sourceNames: string[],
): Promise<void> {
  if (!DOC_ID.test(docId)) {
    throw new Error(`docId invalide : "${docId}"`);
  }
  for (const name of sourceNames) {
    const view = viewName(docId, name);
    await conn.query({
      type: "exec",
      sql: `DROP VIEW IF EXISTS "${view}"`,
    });
  }
}
