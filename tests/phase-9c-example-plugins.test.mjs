import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const catalog = JSON.parse(fs.readFileSync("examples/plugins/catalog.json", "utf8"));
const source = fs.readFileSync("examples/plugins/src/index.ts", "utf8");
const readme = fs.readFileSync("examples/plugins/README.md", "utf8");

const expectedIds = [
  "plotpickle.hello",
  "plotpickle.github",
  "plotpickle.openai-compatible",
  "plotpickle.ollama",
  "plotpickle.lm-studio",
  "plotpickle.final-draft",
  "plotpickle.fountain",
  "plotpickle.pdf",
  "plotpickle.character-reports",
  "plotpickle.dialogue-analysis",
  "plotpickle.story-diagnostics",
  "plotpickle.image-provider",
  "plotpickle.music-provider",
];

test("Phase 9C ships the complete reference catalog", () => {
  assert.equal(catalog.apiVersion, "1.0.0");
  assert.deepEqual(catalog.examples.map((example) => example.id), expectedIds);
  assert.equal(new Set(expectedIds).size, expectedIds.length);
});

test("examples cover the required plugin shapes", () => {
  const kinds = new Set(catalog.examples.map((example) => example.kind));
  for (const kind of ["read-only", "write", "provider", "exporter"]) assert.ok(kinds.has(kind));
  for (const example of catalog.examples) {
    assert.ok(example.permissions.length > 0, `${example.id} declares permissions`);
    assert.ok(example.capabilities.length > 0, `${example.id} declares capabilities`);
    assert.equal(example.entryPoint, "./src/index.ts");
  }
});

test("reference source uses only the public lifecycle surface", () => {
  assert.match(source, /PluginModule/);
  assert.match(source, /registerCommand/);
  assert.match(source, /registerMenu/);
  assert.match(source, /events\.on\("ProjectSaved"/);
  assert.match(source, /status: "review-required"/);
  assert.doesNotMatch(source, /app\//);
});

test("provider safety and provenance rules are explicit", () => {
  assert.equal(catalog.security.credentials, "host-secret-store-only");
  assert.equal(catalog.security.canonicalChanges, "explicit-user-approval");
  assert.match(catalog.security.provenance, /required/);
  assert.match(readme, /never in `.ppf` project files/);
  assert.match(readme, /explicitly approves/);
});
