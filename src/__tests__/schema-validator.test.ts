// Tests B-033a — JSON Schema vviz-v1 draft.
//
// On charge schema/vviz-v1.json et examples/effectifs_2026.vviz via fs
// (suggestion advisor — évite de toucher Vite assetsInclude et d.ts).
// Ajv en mode strict=false pour accepter les `format: date` non
// strictement vérifiés par défaut (on ajoute ajv-formats).

import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCHEMA_PATH = path.join(REPO_ROOT, "schema", "vviz-v1.json");
const SAMPLE_PATH = path.join(
  REPO_ROOT,
  "examples",
  "effectifs_2026.vviz",
);

const schema = JSON.parse(fs.readFileSync(SCHEMA_PATH, "utf8"));
const sample = JSON.parse(fs.readFileSync(SAMPLE_PATH, "utf8"));

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(schema);

function deepClone<T>(o: T): T {
  return JSON.parse(JSON.stringify(o));
}

describe("vviz-v1 JSON Schema (B-033a)", () => {
  it("accepte l'exemple canonique effectifs_2026.vviz", () => {
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
