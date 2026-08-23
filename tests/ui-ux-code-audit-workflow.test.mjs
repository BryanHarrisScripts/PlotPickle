import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const text = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("the consolidated Visual gate keeps deterministic review blocking and AI review advisory", async () => {
  const workflow = await text(".github/workflows/visual.yml");
  assert.match(workflow, /^name: PlotPickle Visual Gate/m);
  assert.match(workflow, /pull_request:\r?\n\s+branches: \[main\]/);
  assert.match(workflow, /name: Visual/);
  assert.match(workflow, /Run deterministic visual contracts/);
  assert.match(workflow, /No visual files changed; the Visual gate passed/);
  assert.match(workflow, /Run advisory AI design review/);
  assert.match(workflow, /continue-on-error: true/);
  assert.match(workflow, /secrets\.OPENAI_API_KEY/);
  assert.match(workflow, /scripts\/ui-ux-code-audit\.mjs/);
  assert.match(workflow, /actions\/checkout@3d3c42e5aac5ba805825da76410c181273ba90b1/);
  assert.match(workflow, /actions\/setup-node@820762786026740c76f36085b0efc47a31fe5020/);
});

test("UI UX audit runner fails closed on evidence-backed findings or infrastructure errors", async () => {
  const runner = await text("scripts/ui-ux-code-audit.mjs");
  assert.match(runner, /const criteria = \[/);
  assert.equal((runner.match(/^  ".+",$/gm) || []).length >= 25, true);
  assert.match(runner, /verdict must be fail when any actual issue is found/);
  assert.match(runner, /validateFindings/);
  assert.match(runner, /exact contiguous source excerpt/);
  assert.match(runner, /source\.includes\(finding\.evidence\)/);
  assert.match(runner, /loading attribute is not a standard HTML video attribute/);
  assert.match(runner, /CSS Modules are extracted and code-split/);
  assert.match(runner, /opens in a new tab/);
  assert.match(runner, /remove\\s\+aria-label/);
  assert.match(runner, /issueCount === 0 \? "pass"/);
  assert.match(runner, /OPENAI_API_KEY is not configured for the required UI\/UX audit gate/);
  assert.match(runner, /The required audit did not complete successfully/);
  assert.match(runner, /No relevant UI files changed/);
  assert.doesNotMatch(runner, /console\.log\([^\n]*OPENAI_API_KEY/);
});

test("legacy extensionless workflow path is removed", async () => {
  await assert.rejects(stat(new URL("../.github/workflows/UI/Code Audit", import.meta.url)), { code: "ENOENT" });
});
