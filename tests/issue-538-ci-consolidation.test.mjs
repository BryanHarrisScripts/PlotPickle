import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const workflowRoot = new URL(".github/workflows/", root);
const source = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await source(path));

test("issue #538 keeps Architecture Verification as the sole ordinary PR workflow", async () => {
  const files = (await readdir(workflowRoot)).filter((file) => /\.ya?ml$/.test(file)).sort();
  const workflows = new Map(await Promise.all(files.map(async (file) => [file, await source(`.github/workflows/${file}`)])));
  const pullRequestWorkflows = [...workflows]
    .filter(([, workflow]) => /^  pull_request:/m.test(workflow))
    .map(([file]) => file)
    .sort();

  assert.deepEqual(pullRequestWorkflows, ["architecture-shadow.yml"]);
  assert.match(workflows.get("architecture-shadow.yml"), /^name: Architecture Verification$/m);
  assert.doesNotMatch(workflows.get("pr-gate.yml"), /^  pull_request:/m);
  assert.doesNotMatch(workflows.get("product-gate.yml"), /^  pull_request:/m);

  const authority = await readJson("config/verification/merge-authority.json");
  assert.deepEqual(authority.retiredLegacyWorkflows.map((entry) => entry.workflowName), ["PR Gate", "Product Gate"]);
  assert.deepEqual(authority.retiredLegacyWorkflows.map((entry) => entry.role), ["manual-diagnostic", "manual-diagnostic"]);
});

test("issue #538 keeps deep validation available outside the ordinary PR path", async () => {
  const [qa, story, demo, windows, visual, ben, prGate, productGate] = await Promise.all([
    source(".github/workflows/autonomous-qa-campaign.yml"),
    source(".github/workflows/autonomous-story-reference.yml"),
    source(".github/workflows/demo-onboarding.yml"),
    source(".github/workflows/windows-installer.yml"),
    source(".github/workflows/visual-readiness.yml"),
    source(".github/workflows/ben-code-quality.yml"),
    source(".github/workflows/pr-gate.yml"),
    source(".github/workflows/product-gate.yml"),
  ]);

  for (const workflow of [qa, story, demo, windows, visual, ben, prGate, productGate]) assert.doesNotMatch(workflow, /^  pull_request:/m);
  assert.match(qa, /^  push:/m);
  assert.match(qa, /^  schedule:/m);
  assert.match(qa, /^  workflow_dispatch:/m);
  assert.match(story, /^  workflow_call:/m);
  assert.match(windows, /^  workflow_call:/m);
  assert.match(visual, /^  workflow_dispatch:/m);
  assert.match(ben, /^  workflow_dispatch:/m);
  assert.match(prGate, /^  workflow_dispatch:/m);
  assert.match(productGate, /^  workflow_dispatch:/m);
});
