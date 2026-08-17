import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Full Verification cleanup keeps record serialization, screenshot schema defaults and accessibility matching hardened", async () => {
  const [runner, runtime, exhaustive] = await Promise.all([
    read("scripts/run-plotpickle-full-check.ps1"),
    read("scripts/creative-uat/mcp-runtime.mjs"),
    read("scripts/exhaustive-ui-control-audit.mjs"),
  ]);

  assert.match(runner, /\$StageRecords\s*=\s*\[object\[\]\]/);
  assert.match(runner, /stages\s*=\s*\$StageRecords/);
  assert.match(runtime, /tool\?\.name !== "browser_take_screenshot"/);
  assert.match(runtime, /allowed\.includes\("css"\)/);
  assert.match(exhaustive, /normalizeAccessibilityLabel/);
  assert.match(exhaustive, /relaxed\.length === 1 \? relaxed\[0\] : null/);
});
