// B-050 — Table virtualisée pour drill-down UC-1.
//
// Pourquoi un wrapper maison plutôt que `vg.table()` ? L'input vgplot
// `table` est un composant DOM-table de Mosaic (cf.
// node_modules/@uwdata/vgplot/src/inputs.js → table) ; il est pratique
// pour des inputs interactifs en V0, mais ne nous donne pas la main
// sur la virtualisation et le tri client. Pour respecter les critères
// B-050 (« virtualisée ≥ 1000 lignes sans lag, tri colonnes, affichage
// du nombre de lignes »), on écrit un composant léger autour d'Arrow
// `Table`.
//
// Virtualisation : on calcule la fenêtre visible à partir de
// `root.scrollTop` et on ne rend que les ~30 lignes nécessaires
// (`visibleRows` + buffer). Le `height` du body est réservé via une
// div fantôme pour garder la scrollbar fidèle à `numRows`.
//
// Tri : la colonne cliquée appelle `onSort(field, dir)`. Côté caller,
// on délègue à DuckDB (`ORDER BY`) plutôt que de trier l'Arrow Table
// côté JS — c'est ce que fait `main.ts` via re-query.

import type { Table, StructRowProxy } from "apache-arrow";

export interface TableColumn {
  field: string;
  label?: string;
  align?: "left" | "right";
  width?: string;
}

export type SortDirection = "asc" | "desc";

export interface TableViewOptions {
  columns: TableColumn[];
  /** Hauteur ligne en px (défaut 28). */
  rowHeight?: number;
  /** Nombre de lignes visibles dans le viewport (défaut 20). */
  visibleRows?: number;
  /** Buffer de lignes en haut/bas de la fenêtre (défaut 5). */
  bufferRows?: number;
  /** Callback de tri colonne — généralement re-query DuckDB. */
  onSort?: (field: string, dir: SortDirection) => void;
}

export interface TableViewHandle {
  /** Remplace les données ; remet le scroll en haut. */
  setData(t: Table): void;
  /** Élément racine pour mount/unmount. */
  root: HTMLElement;
  /** Met à jour le compteur (utile si filtre côté caller). */
  setRowCount(n: number): void;
}

export function renderTable(
  container: HTMLElement,
  data: Table,
  opts: TableViewOptions,
): TableViewHandle {
  const rowHeight = opts.rowHeight ?? 28;
  const visible = opts.visibleRows ?? 20;
  const buffer = opts.bufferRows ?? 5;

  const root = document.createElement("div");
  root.className = "vv-table";
  root.style.maxHeight = `${rowHeight * (visible + 1)}px`;
  root.style.overflowY = "auto";
  root.style.position = "relative";
  root.setAttribute("role", "grid");

  // Header (sticky)
  const header = document.createElement("div");
  header.className = "vv-table-header";
  header.setAttribute("role", "row");
  const sortState = new Map<string, SortDirection>();
  for (const c of opts.columns) {
    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "vv-th";
    cell.textContent = c.label ?? c.field;
    cell.dataset.field = c.field;
    if (c.align === "right") cell.style.textAlign = "right";
    if (c.width) cell.style.flexBasis = c.width;
    cell.addEventListener("click", () => {
      const prev = sortState.get(c.field);
      const dir: SortDirection = prev === "asc" ? "desc" : "asc";
      sortState.clear();
      sortState.set(c.field, dir);
      updateSortIndicators();
      opts.onSort?.(c.field, dir);
    });
    header.appendChild(cell);
  }
  root.appendChild(header);

  // Body (virtualisé)
  const body = document.createElement("div");
  body.className = "vv-table-body";
  body.setAttribute("role", "rowgroup");
  root.appendChild(body);

  // Footer (compteur)
  const footer = document.createElement("div");
  footer.className = "vv-table-footer";
  root.appendChild(footer);

  container.replaceChildren(root);

  let current: Table = data;
  let overrideCount: number | null = null;

  function updateSortIndicators(): void {
    for (const th of Array.from(
      header.querySelectorAll<HTMLButtonElement>(".vv-th"),
    )) {
      const f = th.dataset.field ?? "";
      const dir = sortState.get(f);
      th.dataset.sort = dir ?? "";
    }
  }

  function rowToText(row: StructRowProxy, field: string): string {
    const v = (row as unknown as Record<string, unknown>)[field];
    if (v == null) return "";
    if (typeof v === "bigint") return v.toString();
    return String(v);
  }

  function paint(): void {
    const n = current.numRows;
    body.style.height = `${n * rowHeight}px`;
    body.replaceChildren();
    const scrollTop = Math.max(0, root.scrollTop - rowHeight); // header sticky
    const start = Math.max(0, Math.floor(scrollTop / rowHeight) - buffer);
    const end = Math.min(n, start + visible + buffer * 2);
    for (let i = start; i < end; i++) {
      const r = current.get(i);
      if (!r) continue;
      const row = document.createElement("div");
      row.className = "vv-tr";
      row.setAttribute("role", "row");
      row.style.position = "absolute";
      row.style.top = `${i * rowHeight}px`;
      row.style.height = `${rowHeight}px`;
      row.style.left = "0";
      row.style.right = "0";
      for (const c of opts.columns) {
        const cell = document.createElement("div");
        cell.className = "vv-td";
        cell.setAttribute("role", "gridcell");
        cell.textContent = rowToText(r, c.field);
        if (c.align === "right") cell.style.textAlign = "right";
        if (c.width) cell.style.flexBasis = c.width;
        row.appendChild(cell);
      }
      body.appendChild(row);
    }
    const displayed = overrideCount ?? n;
    footer.textContent = `${displayed.toLocaleString("fr-FR")} ligne(s)`;
  }

  root.addEventListener("scroll", () => paint());
  paint();

  return {
    setData(t: Table): void {
      current = t;
      overrideCount = null;
      root.scrollTop = 0;
      paint();
    },
    setRowCount(n: number): void {
      overrideCount = n;
      footer.textContent = `${n.toLocaleString("fr-FR")} ligne(s)`;
    },
    root,
  };
}
