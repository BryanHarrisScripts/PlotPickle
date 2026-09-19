import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (relative) => readFile(new URL(relative, root), "utf8");
const readJson = async (relative) => JSON.parse(await read(relative));

test("#2264 keeps Architecture Verification as the sole ordinary pull-request workflow", async () => {
  const workflowRoot = new URL(".github/workflows/", root);
  const files = (await readdir(workflowRoot)).filter((file) => /\.ya?ml$/.test(file)).sort();
  const ordinary = [];
  for (const file of files) {
    const workflow = await read(`.github/workflows/${file}`);
    if (/^  pull_request:/m.test(workflow)) ordinary.push(file);
  }
  assert.deepEqual(ordinary, ["architecture-shadow.yml"]);
});

test("#2264 runs BEN exactly once per PR inside Layer 7", async () => {
  const workflow = await read(".github/workflows/architecture-shadow.yml");

  assert.match(workflow, /name: Layer 7 Validation & Operations/);
  assert.match(workflow, /name: Run BEN deterministic AI-slop\/code-quality delta/);
  assert.match(workflow, /if: matrix\.id == 'verification'/);
  assert.match(
    workflow,
    /node scripts\/run-ben-code-quality\.mjs\s+--base-ref "\$\{\{ github\.event\.pull_request\.base\.sha \|\| 'main' \}\}"/u,
  );
  assert.match(workflow, /\.artifacts\/ben-code-quality\//);

  const benStepCount = (workflow.match(/name: Run BEN deterministic AI-slop\/code-quality delta/g) ?? []).length;
  assert.equal(benStepCount, 1);
});

test("#2264 preserves the existing BEN policy and manual diagnostic workflow", async () => {
  const [policy, workflow] = await Promise.all([
    readJson("config/ben-code-quality.json"),
    read(".github/workflows/ben-code-quality.yml"),
  ]);

  assert.equal(policy.slopScan.package, "slop-scan");
  assert.equal(policy.slopScan.comparisonMode, "delta");
  assert.deepEqual(policy.slopScan.failOn, ["added", "worsened"]);

  assert.match(workflow, /^  workflow_dispatch:/m);
  assert.doesNotMatch(workflow, /^  pull_request:/m);
});
