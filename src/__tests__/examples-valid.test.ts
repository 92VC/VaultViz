import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";

const REPO_ROOT = path.resolve(__dirname, "..", "..");
const SCHEMA = JSON.parse(
  fs.readFileSync(path.join(REPO_ROOT, "schema", "vviz-v1.json"), "utf8"),
);

const ajv = new Ajv({ strict: false, allErrors: true });
addFormats(ajv);
const validate = ajv.compile(SCHEMA);

// Aucun fichier .vviz n'est tracké dans le repo (exemples réels gitignorés,
// anciens modèles supprimés). On valide ici un document AUTOPORTEUR canonique
// défini inline — source `inline` (Parquet base64 embarqué), le modèle par
// défaut de VaultViz — pour couvrir la branche `anyOf: inline` du schéma.
const autoporteurDoc = {
  vviz: { version: "1.0", title: "Exemple autoporteur canonique", created: "2026-01-01" },
  data: { sources: [{ name: "items", inline: "UEFSMQ==" }] },
  spec: {
    engine: "mosaic",
    layout: "dashboard",
    views: [{ id: "v1", type: "pie", source: "items", options: { region: "main" } }],
  },
};

describe("document autoporteur valide contre schema vviz-v1", () => {
  it("accepte un document autoporteur (source inline)", () => {
    const ok = validate(autoporteurDoc);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.error(validate.errors);
    }
    expect(ok).toBe(true);
  });
});
