import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const workflowRoot = new URL(".github/workflows/", root);
const source = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await source(path));

test("issue #1747 keeps exactly three ordinary PR workflows during Phase 6 promotion", async () => {
  const files = (await readdir(workflowRoot)).filter((file) => /\.ya?ml$/.test(file)).sort();
  const workflows = new Map(await Promise.all(files.map(async (file) => [file, await source(`.github/workflows/${file}`)])));
  const pullRequestWorkflows = [...workflows]
    .filter(([, workflow]) => /^  pull_request:/m.test(workflow))
    .map(([file]) => file)
    .sort();

  assert.deepEqual(pullRequestWorkflows, ["architecture-shadow.yml", "pr-gate.yml", "product-gate.yml"]);

  const prGate = workflows.get("pr-gate.yml");
  const productGate = workflows.get("product-gate.yml");
  const architecture = workflows.get("architecture-shadow.yml");
  assert.match(prGate, /^name: PR Gate$/m);
  assert.match(prGate, /^    name: PR Gate$/m);
  assert.match(productGate, /^name: Product Gate$/m);
  assert.match(productGate, /^    name: Product Gate$/m);
  assert.match(architecture, /^name: Architecture Verification$/m);
  assert.doesNotMatch(architecture, /^    name: PR Gate$/m);
  assert.doesNotMatch(architecture, /^    name: Product Gate$/m);

  const authority = await readJson("config/verification/merge-authority.json");
  assert.deepEqual(authority.legacyAdvisoryWorkflows.map((entry) => entry.role), ["advisory-comparison", "advisory-comparison"]);
});

test("issue #1747 keeps legacy PR comparison verification focused on the current architecture", async () => {
  const [prGate, productGate] = await Promise.all([
    source(".github/workflows/pr-gate.yml"),
    source(".github/workflows/product-gate.yml"),
  ]);

  assert.match(prGate, /current Experience architecture boundary/i);
  assert.match(prGate, /core auth and storage/i);
  assert.match(prGate, /Production web build/);
  assert.equal((prGate.match(/npm ci/g) || []).length, 1, "PR Gate should install the PlotPickle dependency tree once");

  assert.match(productGate, /current Skin V1 startup boundary/i);
  assert.match(productGate, /Production web build on Windows/);
  assert.match(productGate, /Windows installer source contract/);
  assert.equal((productGate.match(/npm ci/g) || []).length, 1, "Product Gate should install the PlotPickle dependency tree once");

  for (const gate of [prGate, productGate]) {
    assert.doesNotMatch(gate, /demo onboarding/i);
    assert.doesNotMatch(gate, /autonomous Afterglow story reference/i);
  }
  assert.doesNotMatch(productGate, /Build PlotPickleSetup\.exe/);
  assert.doesNotMatch(productGate, /Run packaged Windows interaction smoke/);
  assert.doesNotMatch(productGate, /Run install and uninstall smoke/);
});

test("issue #1747 leaves specialized workflows available without their own pull-request trigger", async () => {
  for (const file of [
    "autonomous-qa-campaign.yml",
    "autonomous-story-reference.yml",
    "demo-onboarding.yml",
    "windows-installer.yml",
    "visual-readiness.yml",
    "ben-code-quality.yml",
  ]) {
    const workflow = await source(`.github/workflows/${file}`);
    assert.doesNotMatch(workflow, /^  pull_request:/m, `${file} should remain specialized rather than becoming another normal PR workflow`);
  }
});
