import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const read = (file) => fs.readFile(path.join(ROOT, file), "utf8");

test("cinematography docs preserve the intended architecture boundary", async () => {
  const [overview, acceptance] = await Promise.all([
    read("docs/CINEMATOGRAPHY-GRAMMAR.md"),
    read("docs/issues/1868-acceptance.md"),
  ]);
  assert.match(overview, /story intent -> grammar primitives -> Sequence Director -> provider adapter/u);
  assert.match(overview, /does not copy third-party prompt prose/u);
  assert.match(overview, /cannot select or change providers, models, runtimes, API keys/u);
  assert.match(acceptance, /Still\/video applicability/u);
  assert.match(acceptance, /Conflicting primitives are suppressed/u);
});
