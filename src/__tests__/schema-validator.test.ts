// Tests B-033a — JSON Schema vviz-v1 draft.
//
// On charge schema/vviz-v1.json via fs (le schéma est versionné). Le
// document canonique est défini INLINE ici : il n'existe plus d'exemple
// .vviz tracké dans le repo (les exemples réels sont gitignorés, les
// anciens modèles supprimés). Ajv en mode strict=false pour accepter les
// `format: date` (on ajoute ajv-formats).

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCHEMA_PATH = path.join(REPO_ROOT, "schema", "vviz-v1.json");

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));

// Document canonique valide minimal (source `path` pour permettre la
// mutation https:// du test de rejet). Typé `any` : les tests de mutation
// suppriment/écrasent des champs requis (cf. `delete bad.vviz.title`).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const sample: any = {
  vviz: { version: "1.0", title: "Doc canonique de test", created: "2026-01-01" },
  data: { sources: [{ name: "items", path: "./sample.parquet" }] },
  spec: {
    engine: "mosaic",
    views: [{ id: "v1", type: "table", source: "items" }],
  },
};

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

function deepClone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

describe("vviz-v1 JSON Schema (B-033a)", () => {
  it("accepte l'exemple canonique dli_inventaire_autoporteur.vviz", () => {
    const ok = validate(sample);
    if (!ok) {
      // Améliore le diagnostic en cas de régression
      console.error(validate.errors);
    }
    expect(ok).toBe(true);
  });

  it("refuse un document sans vviz.title", () => {
    const bad = deepClone(sample);
    delete bad.vviz.title;
    expect(validate(bad)).toBe(false);
  });

  it("refuse une source avec un schéma URL (https://)", () => {
    const bad = deepClone(sample);
    bad.data.sources[0].path = "https://evil.com/x.parquet";
    expect(validate(bad)).toBe(false);
  });

  it("refuse un name de source non identifiant SQL", () => {
    const bad = deepClone(sample);
    bad.data.sources[0].name = "bad name with spaces";
    expect(validate(bad)).toBe(false);
  });

  it("refuse data.sources vide", () => {
    const bad = deepClone(sample);
    bad.data.sources = [];
    expect(validate(bad)).toBe(false);
  });

  it("refuse vviz.version != '1.0'", () => {
    const bad = deepClone(sample);
    bad.vviz.version = "2.0";
    expect(validate(bad)).toBe(false);
  });
});
