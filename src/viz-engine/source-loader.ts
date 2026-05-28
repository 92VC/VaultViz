// Pour chaque source déclarée dans le .vviz, on crée une vue DuckDB :
//   CREATE OR REPLACE VIEW "<name>" AS SELECT * FROM read_parquet('<path>')
// Le `name` doit matcher le pattern SQL (déjà contraint par le schema
// JSON : `^[a-zA-Z_][a-zA-Z0-9_]{0,63}$`). On revalide ici par
// défense en profondeur.

import { resolvePath } from "./path-resolver";
import type { DuckConnector } from "./duck-connector";
import type { VVizDocument } from "./types";

const SAFE_IDENT = /^[a-zA-Z_][a-zA-Z0-9_]{0,63}$/;

function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

export async function loadSources(
  conn: DuckConnector,
  doc: VVizDocument,
  vvizDirPath: string,
): Promise<void> {
  for (const src of doc.data.sources) {
    if (!SAFE_IDENT.test(src.name)) {
      throw new Error(
        `nom de source invalide (identifiant SQL attendu) : "${src.name}"`,
      );
    }
    const resolved = resolvePath(src.path, vvizDirPath);
    const sql =
      `CREATE OR REPLACE VIEW "${src.name}" AS ` +
      `SELECT * FROM read_parquet(${sqlString(resolved)})`;
    await conn.query({ type: "exec", sql });
  }
}
