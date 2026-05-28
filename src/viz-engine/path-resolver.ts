// Résolution des chemins déclarés dans `data.sources[].path` d'un .vviz.
// Conformément à ADR-007 :
//   - UNC POSIX `//host/share/...`    : tel quel
//   - Lettre de lecteur Windows `[A-Z]:/...` : tel quel
//   - Chemin absolu POSIX `/...`      : tel quel
//   - Chemin relatif `./...`, `../...`, `name.parquet` : résolu par
//     rapport au DOSSIER DU FICHIER .vviz (pas au CWD du processus).
//
// On normalise les antislashes Windows en slashes pour rester cohérent
// avec ADR-007 et avec ce qu'attend DuckDB read_parquet().

/** Extrait le dossier parent d'un chemin de fichier .vviz. */
export function vvizDir(vvizPath: string): string {
  const norm = vvizPath.replace(/\\/g, "/");
  const idx = norm.lastIndexOf("/");
  if (idx < 0) return ".";
  if (idx === 0) return "/";
  // Préserver le UNC double-slash en tête (`//host/share`).
  if (norm.startsWith("//") && idx === 1) return "/";
  return norm.slice(0, idx);
}

/**
 * Résout un chemin déclaré dans data.sources[].path par rapport au
 * dossier du .vviz qui le déclare.
 *
 * `vvizDirPath` est le dossier du .vviz (cf. {@link vvizDir}).
 */
export function resolvePath(declared: string, vvizDirPath: string): string {
  const p = declared.replace(/\\/g, "/");
  // UNC : //host/share/...
  if (p.startsWith("//")) return p;
  // Drive Windows : C:/...
  if (/^[A-Za-z]:\//.test(p)) return p;
  // Absolu POSIX : /...
  if (p.startsWith("/")) return p;
  // Relatif : strip ./
  const rel = p.replace(/^\.\//, "");
  const dir = vvizDirPath.replace(/\\/g, "/");

  // Préserver l'éventuel préfixe UNC du dir (//host/share)
  const isUnc = dir.startsWith("//");
  const dirCore = isUnc ? dir.slice(2) : dir;
  const joined = dirCore.endsWith("/") ? `${dirCore}${rel}` : `${dirCore}/${rel}`;

  const segments = joined.split("/");
  const stack: string[] = [];
  for (const seg of segments) {
    if (seg === "" || seg === ".") {
      if (stack.length === 0) stack.push("");
      continue;
    }
    if (seg === "..") {
      if (stack.length > 1) stack.pop();
      continue;
    }
    stack.push(seg);
  }
  let out = stack.join("/").replace(/\/+/g, "/");
  if (isUnc) out = `//${out.replace(/^\/+/, "")}`;
  return out;
}
