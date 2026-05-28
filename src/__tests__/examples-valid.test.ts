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

function loadExample(name: string): unknown {
  return JSON.parse(
    fs.readFileSync(path.join(REPO_ROOT, "examples", name), "utf8"),
  );
}

describe("examples valides contre schema vviz-v1", () => {
  it("examples/effectifs_2026.vviz", () => {
    const doc = loadExample("effectifs_2026.vviz");
    const ok = validate(doc);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.error(validate.errors);
    }
    expect(ok).toBe(true);
  });

  it("examples/demo_dept.vviz", () => {
    const doc = loadExample("demo_dept.vviz");
    const ok = validate(doc);
    if (!ok) {
      // eslint-disable-next-line no-console
      console.error(validate.errors);
    }
    expect(ok).toBe(true);
  });
});
