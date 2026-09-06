import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AXE_PLAYWRIGHT_VERSION,
  AXE_TAGS,
  PLAYWRIGHT_TEST_VERSION,
  validateLocalServer
} from "../lib/verification/ui-axe-audit.mjs";

async function source(path) {
  return readFile(new URL(`../${path}`, import.meta.url), "utf8");
}

test("#1715 Phase 1B pins official axe/playwright verification tooling", async () => {
  assert.equal(AXE_PLAYWRIGHT_VERSION, "4.13.0");
  assert.equal(PLAYWRIGHT_TEST_VERSION, "1.63.0");
  assert.deepEqual(AXE_TAGS, ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]);

  const runner = await source("lib/verification/ui-axe-audit.mjs");
  assert.match(runner, /toolRequire\("@axe-core\/playwright"\)/);
  assert.match(runner, /toolRequire\("@playwright\/test"\)/);
  assert.match(runner, /for \(const violation of result\.violations \|\| \[\]\)/);
  assert.doesNotMatch(runner, /impact\s*!==\s*["']minor["']/);
  assert.doesNotMatch(runner, /catch\s*\{\s*\}/);
  assert.match(runner, /let lastError = null/);
  assert.match(runner, /storageStatePath/);
  assert.match(runner, /storageState: storageStatePath/);
});

test("#1715 Phase 1B refuses non-local audit targets", () => {
  assert.equal(validateLocalServer("http://127.0.0.1:4173").hostname, "127.0.0.1");
  assert.equal(validateLocalServer("http://localhost:4173").hostname, "localhost");
  assert.throws(() => validateLocalServer("https://example.com"), /only a local PlotPickle server/);
});

test("#1715 axe coverage includes representative writer, game and STORY surfaces", async () => {
  const registry = JSON.parse(await source("config/ui-axe-routes.json"));
  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.standard, "WCAG 2.2 AA");
  assert.deepEqual(registry.routes.map((route) => route.id), ["dashboard", "learn", "build", "story", "wyrmwood", "settings"]);
  assert.equal(registry.routes.find((route) => route.id === "story")?.path, "/story");
  assert.equal(new Set(registry.routes.map((route) => route.path)).size, registry.routes.length);
});

test("#1715 Phase 1B Visual Readiness installs axe only in temporary CI tooling and authenticates real route renders", async () => {
  const workflow = await source(".github/workflows/visual-readiness.yml");
  const renderedRunner = await source("scripts/run-ui-rendered-verification.mjs");
  assert.match(workflow, /@axe-core\/playwright@4\.13\.0/);
  assert.match(workflow, /@playwright\/test@1\.63\.0/);
  assert.match(workflow, /\$\{\{ runner\.temp \}\}\/plotpickle-ui-a11y/);
  assert.match(workflow, /scripts\/run-ui-rendered-verification\.mjs/);
  assert.match(workflow, /--routes config\/ui-axe-routes\.json/);
  assert.match(renderedRunner, /establishVerificationSyntheticHuman/);
  assert.match(renderedRunner, /runUiAxeAudit/);
  assert.match(renderedRunner, /storageStatePath: auth\.storageStatePath/);

  const packageJson = await source("package.json");
  assert.doesNotMatch(packageJson, /@axe-core\/playwright/);
  assert.doesNotMatch(packageJson, /@playwright\/test/);
});
