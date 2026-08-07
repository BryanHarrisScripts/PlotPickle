import assert from "node:assert/strict";
import { readFile, stat } from "node:fs/promises";
import test from "node:test";

const text = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("UI UX audit always reports a required pull-request status", async () => {
  const workflow = await text(".github/workflows/ui-ux-code-audit.yml");
  assert.match(workflow, /^name: UI\/UX Code Audit/m);
  assert.match(workflow, /pull_request:\r?\n\s+branches: \[main\]/);
  assert.doesNotMatch(workflow, /pull_request:[\s\S]*?\n\s+paths:/);
  assert.match(workflow, /name: Audit UI\/UX against Design Rules/);
  assert.match(workflow, /No UI files changed; required gate passed/);
  assert.match(workflow, /Enforce UI\/UX audit gate/);
  assert.match(workflow, /process\.exit\(1\)/);
  assert.match(workflow, /secrets\.OPENAI_API_KEY/);
  assert.match(workflow, /scripts\/ui-ux-code-audit\.mjs/);
  assert.match(workflow, /decorativeHiddenSvgContradictions/);
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
  assert.match(runner, /issueCount === 0 \? "pass"/);
  assert.match(runner, /OPENAI_API_KEY is not configured for the required UI\/UX audit gate/);
  assert.match(runner, /The required audit did not complete successfully/);
  assert.match(runner, /No relevant UI files changed/);
  assert.doesNotMatch(runner, /console\.log\([^\n]*OPENAI_API_KEY/);
});

test("legacy extensionless workflow path is removed", async () => {
  await assert.rejects(stat(new URL("../.github/workflows/UI/Code Audit", import.meta.url)), { code: "ENOENT" });
});
