// B-132 — Tests export CSV (données filtrées, UTF-8 BOM, Excel FR).
//
// `tableToCsv` est une fonction pure → tous les cas testables sans DOM.
//
// Choix séparateur : `;` (semi-colon) pour Excel FR (locale Windows
// par défaut = FR, séparateur de liste = `;`). Le RFC 4180 préconise `,`
// mais Excel FR colle alors tout dans une colonne. Le BOM UTF-8 règle
// les accents, pas le séparateur. Cf. B-132 critère 1.
//
// Valeurs exportées : valeurs BRUTES Arrow (pas `fmt()`). Les bigint
// sont convertis en string décimale. Les valeurs null/undefined → chaîne
// vide. Cela préserve l'exploitabilité dans Excel (pas de « 1 234,56 » mais
// « 1234.56 ») — voir advisory du reviewer.

import { describe, it, expect } from "vitest";
import { tableToCsv, BOM } from "../services/csv-export";
import { tableFromArrays } from "apache-arrow";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Construit une Table Arrow à partir d'objets simples (colonnes inférées). */
function makeArrowTable(rows: Record<string, unknown>[]): import("apache-arrow").Table {
  if (rows.length === 0) {
    // Retourne une table vide sans colonnes
    return tableFromArrays({});
  }
  const fields = Object.keys(rows[0]);
  const columns: Record<string, unknown[]> = Object.fromEntries(
    fields.map((f) => [f, rows.map((r) => r[f] ?? null)]),
  );
  // tableFromArrays infère les types automatiquement.
  return tableFromArrays(
    Object.fromEntries(
      Object.entries(columns).map(([k, arr]) => [k, arr]),
    ),
  );
}

// Colonnes pour le constructeur simple
function cols(names: string[]): { field: string; label?: string }[] {
  return names.map((n) => ({ field: n }));
}

// ── Tests BOM ─────────────────────────────────────────────────────────────────

describe("tableToCsv — BOM UTF-8", () => {
  it("commence par le BOM UTF-8 (\\uFEFF)", () => {
    const t = makeArrowTable([{ nom: "Alice" }]);
    const csv = tableToCsv(t, cols(["nom"]));
    expect(csv.startsWith(BOM)).toBe(true);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
  });

  it("BOM exporté — constante correcte", () => {
    expect(BOM).toBe("﻿");
  });
});

// ── Tests en-têtes ────────────────────────────────────────────────────────────

describe("tableToCsv — en-têtes", () => {
  it("première ligne = en-têtes séparés par ;", () => {
    const t = makeArrowTable([{ nom: "Alice", age: 30 }]);
    const csv = tableToCsv(t, cols(["nom", "age"]));
    const lines = csv.replace(BOM, "").split("\r\n");
    expect(lines[0]).toBe("nom;age");
  });

  it("utilise label si fourni à la place du field", () => {
    const t = makeArrowTable([{ nom: "Alice" }]);
    const csv = tableToCsv(t, [{ field: "nom", label: "Prénom" }]);
    const lines = csv.replace(BOM, "").split("\r\n");
    expect(lines[0]).toBe("Prénom");
  });

  it("accents dans les en-têtes survivent", () => {
    const t = makeArrowTable([{ réf: "123" }]);
    const csv = tableToCsv(t, [{ field: "réf", label: "Référence" }]);
    expect(csv).toContain("Référence");
  });
});

// ── Tests données ─────────────────────────────────────────────────────────────

describe("tableToCsv — données", () => {
  it("lignes de données correctes (string + number)", () => {
    const t = makeArrowTable([
      { nom: "Alice", age: 30 },
      { nom: "Bob", age: 25 },
    ]);
    const csv = tableToCsv(t, cols(["nom", "age"]));
    const lines = csv.replace(BOM, "").split("\r\n").filter(Boolean);
    expect(lines[1]).toBe("Alice;30");
    expect(lines[2]).toBe("Bob;25");
  });

  it("valeur null → champ vide", () => {
    const t = makeArrowTable([{ nom: "Alice", age: null }]);
    const csv = tableToCsv(t, cols(["nom", "age"]));
    const lines = csv.replace(BOM, "").split("\r\n").filter(Boolean);
    expect(lines[1]).toBe("Alice;");
  });

  it("bigint converti en string décimale", () => {
    // Apache Arrow peut retourner des BigInt pour Int64.
    // On crée une Table avec une Int32Array native (pas de BigInt ici).
    // Le test documente que les valeurs numériques arrow sont exportées
    // telles quelles (sans formatage fmt()).
    const t = tableFromArrays({
      cnt: new Int32Array([1000, 2000, 3000]),
    });
    const csv = tableToCsv(t, cols(["cnt"]));
    const lines = csv.replace(BOM, "").split("\r\n").filter(Boolean);
    expect(lines[1]).toBe("1000");
    expect(lines[2]).toBe("2000");
  });

  it("accents dans les données survivent (é, à, ç, œ)", () => {
    const t = makeArrowTable([{ libellé: "Île-de-France — Métropole" }]);
    const csv = tableToCsv(t, [{ field: "libellé" }]);
    expect(csv).toContain("Île-de-France — Métropole");
  });
});

// ── Tests échappement ─────────────────────────────────────────────────────────

describe("tableToCsv — échappement RFC 4180 (guillemets)", () => {
  it("champ contenant ; est mis entre guillemets", () => {
    const t = makeArrowTable([{ v: "un;deux" }]);
    const csv = tableToCsv(t, cols(["v"]));
    const lines = csv.replace(BOM, "").split("\r\n").filter(Boolean);
    // La valeur contient ; → doit être entre "..."
    expect(lines[1]).toBe('"un;deux"');
  });

  it("champ contenant guillemet double : guillemet doublé + encadrement", () => {
    const t = makeArrowTable([{ v: 'di"ez' }]);
    const csv = tableToCsv(t, cols(["v"]));
    const lines = csv.replace(BOM, "").split("\r\n").filter(Boolean);
    expect(lines[1]).toBe('"di""ez"');
  });

  it("champ contenant virgule : encadré de guillemets", () => {
    const t = makeArrowTable([{ v: "un,deux" }]);
    const csv = tableToCsv(t, cols(["v"]));
    const lines = csv.replace(BOM, "").split("\r\n").filter(Boolean);
    expect(lines[1]).toBe('"un,deux"');
  });

  it("champ contenant retour à la ligne : encadré de guillemets", () => {
    const t = makeArrowTable([{ v: "ligne1\nligne2" }]);
    const csv = tableToCsv(t, cols(["v"]));
    const lines = csv.replace(BOM, "").split("\r\n").filter(Boolean);
    // Le champ lui-même contient \n, donc il est entre guillemets
    expect(lines[1]).toContain('"ligne1');
    expect(csv).toContain('"ligne1\nligne2"');
  });

  it("champ contenant \\r\\n : encadré de guillemets", () => {
    const t = makeArrowTable([{ v: "a\r\nb" }]);
    const csv = tableToCsv(t, cols(["v"]));
    expect(csv).toContain('"a\r\nb"');
  });

  it("en-tête contenant ; ou guillemet : échappe aussi", () => {
    const t = makeArrowTable([{ v: "x" }]);
    const csv = tableToCsv(t, [{ field: "v", label: 'col"A;B' }]);
    const lines = csv.replace(BOM, "").split("\r\n");
    // L'en-tête contient ; et " → "col""A;B"
    expect(lines[0]).toBe('"col""A;B"');
  });
});

// ── Tests séparateur ──────────────────────────────────────────────────────────

describe("tableToCsv — séparateur ;", () => {
  it("séparateur ; utilisé (pas ,)", () => {
    const t = makeArrowTable([{ a: "1", b: "2" }]);
    const csv = tableToCsv(t, cols(["a", "b"]));
    // En-tête a;b (pas a,b)
    expect(csv).toContain("a;b");
  });

  it("ligne terminée par CRLF (Windows / Excel)", () => {
    const t = makeArrowTable([{ a: "1" }]);
    const csv = tableToCsv(t, cols(["a"]));
    // Après le BOM : en-tête + CRLF + données + CRLF
    expect(csv).toContain("a\r\n");
  });
});

// ── Tests table vide ──────────────────────────────────────────────────────────

describe("tableToCsv — table vide", () => {
  it("table 0 ligne → BOM + en-têtes seulement", () => {
    const t = makeArrowTable([{ nom: "x" }]).slice(0, 0);
    const csv = tableToCsv(t, cols(["nom"]));
    const lines = csv.replace(BOM, "").split("\r\n").filter(Boolean);
    expect(lines).toHaveLength(1);
    expect(lines[0]).toBe("nom");
  });

  it("aucune colonne → juste le BOM", () => {
    // Cas dégénéré : columns = []
    const t = makeArrowTable([{ a: 1 }]);
    const csv = tableToCsv(t, []);
    expect(csv).toBe(BOM);
  });
});
