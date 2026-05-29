// Formateurs FR partagés par les composants de visualisation.
// Portés depuis `mockups/VaultViz/assets/app.js` (nf, eurC, eurFull, pct,
// signed) pour une fidélité visuelle au design. Aucune dépendance externe.

const nf = new Intl.NumberFormat("fr-FR");

/** Euro compact : « 1,2 M€ », « 340 k€ », « 980 € ». */
export function eurC(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) {
    const dd = a >= 1e7 ? 0 : 1;
    return (
      (n / 1e6).toLocaleString("fr-FR", {
        minimumFractionDigits: dd,
        maximumFractionDigits: dd,
      }) + " M€"
    );
  }
  if (a >= 1e3) return Math.round(n / 1e3).toLocaleString("fr-FR") + " k€";
  return nf.format(Math.round(n)) + " €";
}

/** Euro complet : « 1 234 567 € ». */
export function eurFull(n: number): string {
  return nf.format(Math.round(n)) + " €";
}

/** Pourcentage : « 12,3 % ». */
export function pct(n: number, d = 1): string {
  return (
    n.toLocaleString("fr-FR", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    }) + " %"
  );
}

/** Valeur signée : « +3,2 », « -1,5 ». */
export function signed(n: number, d = 1): string {
  return (
    (n >= 0 ? "+" : "") +
    n.toLocaleString("fr-FR", {
      minimumFractionDigits: d,
      maximumFractionDigits: d,
    })
  );
}

/** Entier groupé : « 1 234 ». */
export function number(n: number): string {
  return nf.format(Math.round(n));
}

export type FormatKind = "eur" | "pct" | "signed" | "number";

/**
 * Dispatcher déclaratif utilisé par les composants à partir de
 * `options.format` (`CompiledView`). `format` inconnu → entier groupé.
 */
export function fmt(value: number, format?: FormatKind | string): string {
  switch (format) {
    case "eur":
      return eurC(value);
    case "pct":
      return pct(value);
    case "signed":
      return signed(value);
    case "number":
      return number(value);
    default:
      return number(value);
  }
}
