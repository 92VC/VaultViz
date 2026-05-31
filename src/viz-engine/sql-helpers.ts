// sql-helpers — échappement SQL DuckDB partagé par le viz-engine.
//
// Source unique de vérité pour la quote des identifiants et des
// littéraux : éviter les définitions dupliquées (where-builder,
// view-mounter, view-compiler) qui divergeaient. Push-down DuckDB :
// ces helpers ne produisent que du SQL, aucun filtrage JS.

/** Double-quote un identifiant SQL (`"` → `""`). Ex. dept → "dept". */
export function ident(name: string): string {
  return `"${name.replace(/"/g, '""')}"`;
}

/** Single-quote un littéral SQL (`'` → `''`). Ex. O'Brien → 'O''Brien'. */
export function lit(v: string): string {
  return `'${v.replace(/'/g, "''")}'`;
}
