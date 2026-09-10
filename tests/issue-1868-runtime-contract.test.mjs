import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT = process.cwd();
const read = (file) => fs.readFile(path.join(ROOT, file), "utf8");

test("runtime test file exists for TS-aware focused runners", async () => {
  const runtime = await read("tests/issue-1868-cinematography-grammar.runtime.test.ts");
  assert.match(runtime, /selects isolation\/reveal grammar deterministically/u);
  assert.match(runtime, /suppresses conflicting primitives/u);
  assert.match(runtime, /does not select motion-only grammar for stills/u);
});
