import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const workflowRoot = new URL(".github/workflows/", root);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #538 consolidation is superseded by exactly two normal PR gates", async () => {
  const files = (await readdir(workflowRoot)).filter((file) => /\.ya?ml$/.test(file)).sort();
  const workflows = new Map(await Promise.all(files.map(async (file) => [file, await source(`.github/workflows/${file}`)])));
  const pullRequestWorkflows = [...workflows]
    .filter(([, workflow]) => /^  pull_request:/m.test(workflow))
    .map(([file]) => file)
    .sort();

  assert.deepEqual(pullRequestWorkflows, ["pr-gate.yml", "product-gate.yml"]);
  assert.match(workflows.get("pr-gate.yml"), /^    name: PR Gate$/m);
  assert.match(workflows.get("product-gate.yml"), /^    name: Product Gate$/m);
});

test("issue #538 keeps deep validation available outside the ordinary PR runner path", async () => {
  const [qa, story, demo, windows, visual, ben] = await Promise.all([
    source(".github/workflows/autonomous-qa-campaign.yml"),
    source(".github/workflows/autonomous-story-reference.yml"),
    source(".github/workflows/demo-onboarding.yml"),
    source(".github/workflows/windows-installer.yml"),
    source(".github/workflows/visual-readiness.yml"),
    source(".github/workflows/ben-code-quality.yml"),
  ]);

  for (const workflow of [qa, story, demo, windows, visual, ben]) assert.doesNotMatch(workflow, /^  pull_request:/m);
  assert.match(qa, /^  push:/m);
  assert.match(qa, /^  schedule:/m);
  assert.match(qa, /^  workflow_dispatch:/m);
  assert.match(story, /^  workflow_call:/m);
  assert.match(windows, /^  workflow_call:/m);
  assert.match(visual, /^  workflow_dispatch:/m);
  assert.match(ben, /^  workflow_dispatch:/m);
});

test("issue #538 normal PR coverage protects boundaries instead of legacy screens", async () => {
  const [prGate, productGate] = await Promise.all([
    source(".github/workflows/pr-gate.yml"),
    source(".github/workflows/product-gate.yml"),
  ]);

  assert.match(prGate, /two-gate CI topology/i);
  assert.match(prGate, /current Experience architecture boundary/i);
  assert.match(prGate, /core auth and storage/i);
  assert.match(prGate, /Production web build/);
  assert.match(productGate, /current Skin V1 startup boundary/i);
  assert.match(productGate, /Build PlotPickleSetup\.exe/);
  assert.match(productGate, /Run install and uninstall smoke/);

  assert.doesNotMatch(prGate, /Validate retained demo onboarding contracts/i);
  assert.doesNotMatch(productGate, /Run autonomous Afterglow story reference/i);
});
