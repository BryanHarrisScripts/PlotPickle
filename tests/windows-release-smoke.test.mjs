import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (file) => readFile(new URL(file, root), "utf8");

test("Windows release keeps browser smoke post-merge while PR package validation stays bounded", async () => {
  const [workflow, releaseSmoke, crawler] = await Promise.all([
    source(".github/workflows/release-candidate.yml"),
    source("scripts/windows-release-smoke.mjs"),
    source("scripts/windows-interaction-smoke.mjs"),
  ]);

  assert.match(workflow, /name: Run packaged Windows interaction smoke after merge/);
  assert.match(workflow, /name: Run deterministic Windows release smoke after merge/);
  assert.match(workflow, /github\.event_name != 'pull_request'/);
  assert.doesNotMatch(workflow, /continue-on-error: true/);
  assert.match(workflow, /node scripts\/windows-release-smoke-runner\.mjs/);
  assert.ok(workflow.indexOf("Run deterministic Windows release smoke after merge") > workflow.indexOf("Run packaged Windows interaction smoke after merge"));
  assert.match(workflow, /Clean-machine extraction and dependency test \(Windows\)/);
  assert.match(workflow, /Verify or repair Windows Rolldown native binding/);
  assert.match(workflow, /reports\/windows-release-smoke\//);
  assert.match(crawler, /skippedActions/);

  for (const contract of [
    "Splash enters the application",
    "Named workspace:",
    "Settings → Repository & Collab status transition",
    "Settings preference saves and survives reload",
    "Diagnostics tab and evidence expander",
    "Browser back and forward preserve named workspaces",
    "Failed to execute 'removeChild'",
    "taskkill.exe",
    "windows-release-smoke.json",
    "windows-release-smoke.md",
  ]) assert.ok(releaseSmoke.includes(contract), `Deterministic Windows release smoke is missing: ${contract}`);
});

test("diagnostic cards use collision-resistant React keys", async () => {
  const diagnostics = await source("app/craft-diagnostics.tsx");
  assert.match(diagnostics, /function findingKey/);
  assert.match(diagnostics, /`\$\{item\.id\}-\$\{item\.title\}`/);
  assert.match(diagnostics, /`\$\{item\.id\}-evidence-\$\{index\}`/);
  assert.match(diagnostics, /`\$\{item\.id\}-question-\$\{index\}`/);
  assert.doesNotMatch(diagnostics, /<FindingCard item=\{item\} key=\{item\.id\}/);
});

test("About links only to an existing in-app history explanation", async () => {
  const about = await source("app/about/page.tsx");
  assert.doesNotMatch(about, /\/docs\/history\/from-openstory-to-plotpickle\.md/);
  assert.match(about, /\/read-learn\?module=why-plotpickle-works-in-layers/);
});
