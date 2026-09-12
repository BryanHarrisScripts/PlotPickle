import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const workflowRoot = new URL(".github/workflows/", root);
const source = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await source(path));

test("issue #538 keeps one promoted architecture workflow plus two legacy comparison workflows", async () => {
  const files = (await readdir(workflowRoot)).filter((file) => /\.ya?ml$/.test(file)).sort();
  const workflows = new Map(await Promise.all(files.map(async (file) => [file, await source(`.github/workflows/${file}`)])));
  const pullRequestWorkflows = [...workflows]
    .filter(([, workflow]) => /^  pull_request:/m.test(workflow))
    .map(([file]) => file)
    .sort();

  assert.deepEqual(pullRequestWorkflows, ["architecture-shadow.yml", "pr-gate.yml", "product-gate.yml"]);
  assert.match(workflows.get("pr-gate.yml"), /^    name: PR Gate$/m);
  assert.match(workflows.get("product-gate.yml"), /^    name: Product Gate$/m);
  assert.match(workflows.get("architecture-shadow.yml"), /^name: Architecture Verification$/m);

  const authority = await readJson("config/verification/merge-authority.json");
  assert.deepEqual(authority.legacyAdvisoryWorkflows.map((entry) => entry.workflowName), ["PR Gate", "Product Gate"]);
  assert.deepEqual(authority.legacyAdvisoryWorkflows.map((entry) => entry.role), ["advisory-comparison", "advisory-comparison"]);
});

test("issue #538 keeps deep validation available outside the ordinary PR verification path", async () => {
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

test("issue #538 legacy comparison coverage still protects current boundaries during Phase 6", async () => {
  const [prGate, productGate] = await Promise.all([
    source(".github/workflows/pr-gate.yml"),
    source(".github/workflows/product-gate.yml"),
  ]);

  assert.match(prGate, /current Experience architecture boundary/i);
  assert.match(prGate, /core auth and storage/i);
  assert.match(prGate, /Production web build/);
  assert.match(productGate, /current Skin V1 startup boundary/i);
  assert.match(productGate, /Production web build on Windows/i);
  assert.match(productGate, /Windows installer source contract/i);

  assert.doesNotMatch(prGate, /Validate retained demo onboarding contracts/i);
  assert.doesNotMatch(productGate, /Run autonomous Afterglow story reference/i);
  assert.doesNotMatch(productGate, /Build PlotPickleSetup\.exe/i);
  assert.doesNotMatch(productGate, /Run packaged Windows interaction smoke/i);
});
