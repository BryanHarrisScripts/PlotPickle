import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#1411 benchmark runner preserves authoritative Windows and no-fake-budget boundaries", async () => {
  const source = await read("scripts/performance/run-real-machine-benchmark.mjs");
  assert.match(source, /process\.platform !== "win32"/);
  assert.match(source, /authoritative benchmark must run on Windows/);
  assert.match(source, /Hard thresholds are intentionally absent until repeated real-machine baseline samples establish variance/);
  assert.match(source, /does not fabricate them/);
});

test("#1411 benchmark identifies canonical modes and core workspace routes", async () => {
  const source = await read("scripts/performance/run-real-machine-benchmark.mjs");
  for (const mode of [
    "warm-persistent-runtime",
    "fresh-optimizer",
    "fresh-runtime",
    "story-workflow-local",
    "buzz-enabled-story-council",
  ]) assert.ok(source.includes(mode), `Missing benchmark mode: ${mode}`);

  for (const route of ["/library", "/learn", "/plan", "/build", "/story-decisions", "/story-workbench"]) {
    assert.ok(source.includes(route), `Missing benchmark route: ${route}`);
  }
});

test("#1411 evidence records reproducibility identity and process memory reliability", async () => {
  const source = await read("scripts/performance/run-real-machine-benchmark.mjs");
  for (const field of [
    "plotpickleVersion",
    "commit",
    "afterglowFixture",
    "ppfStartingRevision",
    "curriculumIdentity",
    "buzzMode",
    "optionalIntegrations",
    "process-only",
  ]) assert.ok(source.includes(field), `Missing evidence field: ${field}`);
});
