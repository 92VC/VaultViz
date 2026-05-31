// B-132 — Service d'export CSV (données filtrées, UTF-8 BOM, Excel FR).
//
// Séparateur : `;` (point-virgule).
// Raison : Excel FR utilise le séparateur de liste du système Windows, qui est
// `;` par défaut en locale française. Avec `,`, Excel FR interprète tout comme
// une seule colonne. Le BOM UTF-8 (`﻿`) résout les accents/caractères
// non-ASCII ; il ne change pas le séparateur. Critère B-132 §1 : "s'ouvre
// directement dans Excel sans déformation de colonnes".
//
// Échappement RFC 4180 : tout champ contenant `;`, `,`, `"`, `\n` ou `\r` est
// entouré de guillemets doubles. Les guillemets internes sont doublés ("" ).
//
// Valeurs brutes : les bigint sont convertis en string décimale, les null en
// chaîne vide. `fmt()` n'est PAS utilisé : des nombres formatés FR ("1 234,56")
// brisent l'exploitabilité numérique dans Excel.
//
// Terminateur de ligne : CRLF (Windows / Excel).
//
// Invariant I-2 : ZÉRO URL réseau.
// Refs: B-132

import type { Table } from "apache-arrow";

/** BOM UTF-8 — à placer en tête du CSV pour qu'Excel détecte l'encodage. */
export const BOM = "﻿";

/** Séparateur de champ. Choix `;` pour Excel FR (locale Windows). */
export const SEPARATOR = ";";

/** Terminateur de ligne Windows / Excel. */
const CRLF = "\r\n";

/** Définition de colonne passée à tableToCsv. */
export interface CsvColumn {
  /** Nom du champ dans la Table Arrow. */
  field: string;
  /** Libellé en-tête. Si absent, utilise `field`. */
  label?: string;
}

/**
 * Échappe une valeur de champ selon RFC 4180 adapté au séparateur `;`.
 *
 * - Contient `;`, `,`, `"`, `\n` ou `\r` → encadré par `"…"`, guillemets internes doublés.
 * - Sinon → valeur brute.
 */
function escapeField(value: string): string {
  const needsQuote =
    value.includes(SEPARATOR) ||
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\n") ||
    value.includes("\r");

  if (!needsQuote) return value;
  return '"' + value.replace(/"/g, '""') + '"';
}

/**
 * Convertit une valeur Arrow quelconque en string exportable.
 * - null / undefined → ""
 * - bigint → string décimale
 * - tout autre type → String(v)
 */
function valueToString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "bigint") return v.toString();
  return String(v);
}

/**
 * Produit un CSV UTF-8 BOM à partir d'une Table Arrow et de la liste des colonnes.
 *
 * @param table Table Arrow (lignes courantes après cross-filter / setData).
 * @param columns Colonnes à exporter avec leur libellé optionnel.
 * @returns String CSV prête à télécharger (commence par `﻿`).
 */
export function tableToCsv(table: Table, columns: CsvColumn[]): string {
  if (columns.length === 0) return BOM;

  const rows: string[] = [];

  // En-tête
  const header = columns.map((c) => escapeField(c.label ?? c.field)).join(SEPARATOR);
  rows.push(header);

  // Données
  for (let i = 0; i < table.numRows; i++) {
    const row = table.get(i);
    if (!row) continue;
    const r = row as unknown as Record<string, unknown>;
    const cells = columns.map((c) => escapeField(valueToString(r[c.field])));
    rows.push(cells.join(SEPARATOR));
  }

  return BOM + rows.join(CRLF) + CRLF;
}

/**
 * Déclenche le téléchargement d'une chaîne CSV comme fichier.
 * Fonctionne en environnement navigateur (WebView2).
 *
 * @param csv Contenu CSV (avec BOM en tête).
 * @param filename Nom du fichier téléchargé (défaut : "vaultviz-export.csv").
 */
export function downloadCsv(csv: string, filename = "vaultviz-export.csv"): void {
  // TextEncoder / Blob encodent la string JS (UTF-16 interne) en UTF-8.
  // Le BOM ﻿ au début → EF BB BF en UTF-8 (marqueur BOM standard Excel).
  const bytes = new TextEncoder().encode(csv);
  const blob = new Blob([bytes], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
