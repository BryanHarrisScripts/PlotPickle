import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";

const manifest = JSON.parse(readFileSync("tests/fixtures/rc4/minimal-project/manifest.json", "utf8"));
const project = JSON.parse(readFileSync("tests/fixtures/rc4/minimal-project/project.json", "utf8"));
const schema = JSON.parse(readFileSync("schemas/rc4/manifest.schema.json", "utf8"));
const docs = readFileSync("docs/RC4-PROJECT-FORMAT.md", "utf8");

test("RC4 freezes project format major version 1", () => {
  assert.equal(manifest.formatVersion, "1.0.0");
  assert.equal(project.schemaVersion, "1.0.0");
  assert.equal(schema.properties.formatVersion.const, "1.0.0");
  assert.match(docs, /long-term-supported/i);
});

test("RC4 declares all frozen schema families", () => {
  for (const name of ["project", "canon", "timeline", "character", "world", "screenplay", "storyboard"]) {
    assert.equal(manifest.schemas[name], "1.0.0");
  }
});

test("unknown optional extensions and fields survive JSON round-trip", () => {
  const manifestRoundTrip = JSON.parse(JSON.stringify(manifest));
  const projectRoundTrip = JSON.parse(JSON.stringify(project));
  assert.deepEqual(manifestRoundTrip.futureManifestField, { preserve: true });
  assert.deepEqual(manifestRoundTrip.extensions[0].futureMetadata, { preserve: true });
  assert.deepEqual(projectRoundTrip.extensions["example.future-module"].unknownData, ["must", "survive", "round-trip"]);
});

test("RC4 portable fixture passes local validation", () => {
  const output = execFileSync("node", ["scripts/validate-rc4-format.mjs", "tests/fixtures/rc4/minimal-project"], { encoding: "utf8" });
  assert.match(output, /RC4 project format valid/);
});

test("freeze policy covers security, migration and breaking changes", () => {
  assert.match(docs, /credentials/i);
  assert.match(docs, /absolute machine paths/i);
  assert.match(docs, /migration/i);
  assert.match(docs, /new major format version/i);
  assert.match(docs, /open → save → export → import/i);
});
