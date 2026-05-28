// B-061 — validation JSON Schema (Ajv) côté loader applicatif.
//
// On charge le schéma `schema/vviz-v1.json` à la compilation Vite
// (cf. `resolveJsonModule` activé en tsconfig). Le `validate` est
// compilé une seule fois au module load — Ajv est non-trivial à
// instancier, on évite donc de le refaire à chaque ouverture de .vviz.
//
// `strict: false` car le schéma utilise `format: "date"` qui requiert
// `ajv-formats` ; `allErrors: true` pour collecter toutes les violations
// d'un seul coup (UX UC-6 : on liste tout, pas seulement la première).
//
// Note : l'instance Ajv est partagée avec celle de
// `src/__tests__/schema-validator.test.ts` (même config) — toute évolution
// doit rester cohérente avec les fixtures B-033a.

import Ajv, { type ErrorObject } from "ajv";
import addFormats from "ajv-formats";
import schemaJson from "../../schema/vviz-v1.json";

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validateFn = ajv.compile(schemaJson as object);

/**
 * Renvoie `null` si le document est valide, sinon la liste des violations
 * brutes Ajv (avec `instancePath`, `message`, `params`).
 */
export function validateVViz(doc: unknown): ErrorObject[] | null {
  return validateFn(doc) ? null : (validateFn.errors as ErrorObject[]);
}

/**
 * Formate les erreurs Ajv en chaînes lisibles pour le bandeau
 * `error-banner` (B-060) :
 *   `/path/to/field: message (paramKey=paramValue, …)`
 *
 * Conforme au critère BACKLOG : « erreur signale le `$.path` exact ».
 */
export function formatSchemaErrors(errs: ErrorObject[]): string[] {
  return errs.map((e) => {
    const path = e.instancePath || "/";
    const msg = e.message ?? "invalide";
    const extra =
      e.params && Object.keys(e.params).length
        ? " (" +
          Object.entries(e.params)
            .map(([k, v]) => `${k}=${formatParam(v)}`)
            .join(", ") +
          ")"
        : "";
    return `${path}: ${msg}${extra}`;
  });
}

function formatParam(v: unknown): string {
  if (v === null || v === undefined) return String(v);
  if (typeof v === "object") {
    try {
      return JSON.stringify(v);
    } catch {
      return "[object]";
    }
  }
  return String(v);
}
