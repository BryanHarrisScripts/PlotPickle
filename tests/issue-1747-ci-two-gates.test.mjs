import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";
import { piWindowsJobChanged, piJobBody } from "../lib/verification/pi-workflow-scope.mjs";

const root = new URL("..", import.meta.url);
const workflowRoot = new URL(".github/workflows/", root);
const source = (path) => readFile(new URL(path, root), "utf8");
const readJson = async (path) => JSON.parse(await source(path));

test("issue #1747 keeps exactly one ordinary PR workflow after Phase 7 retirement", async () => {
  const files = (await readdir(workflowRoot)).filter((file) => /\.ya?ml$/.test(file)).sort();
  const workflows = new Map(await Promise.all(files.map(async (file) => [file, await source(`.github/workflows/${file}`)])));
  const pullRequestWorkflows = [...workflows]
    .filter(([, workflow]) => /^  pull_request:/m.test(workflow))
    .map(([file]) => file)
    .sort();

  assert.deepEqual(pullRequestWorkflows, ["architecture-shadow.yml"]);

  const prGate = workflows.get("pr-gate.yml");
  const productGate = workflows.get("product-gate.yml");
  const architecture = workflows.get("architecture-shadow.yml");
  assert.match(architecture, /^name: Architecture Verification$/m);
  assert.doesNotMatch(prGate, /^  pull_request:/m);
  assert.doesNotMatch(productGate, /^  pull_request:/m);
  assert.match(prGate, /^  workflow_dispatch:/m);
  assert.match(productGate, /^  workflow_dispatch:/m);

  const authority = await readJson("config/verification/merge-authority.json");
  assert.equal(authority.promotionState, "seven-layer-authority-enforced");
  assert.deepEqual(authority.retiredLegacyWorkflows.map((entry) => entry.role), ["manual-diagnostic", "manual-diagnostic"]);
});

test("issue #1747 keeps retired legacy diagnostics available explicitly", async () => {
  const [prGate, productGate] = await Promise.all([
    source(".github/workflows/pr-gate.yml"),
    source(".github/workflows/product-gate.yml"),
  ]);

  assert.match(prGate, /current Experience architecture boundary/i);
  assert.match(prGate, /core auth and storage/i);
  assert.match(prGate, /Production web build/);
  assert.equal((prGate.match(/npm ci/g) || []).length, 1);

  assert.match(productGate, /current Skin V1 startup boundary/i);
  assert.match(productGate, /Production web build on Windows/);
  assert.match(productGate, /Windows installer source contract/);
  assert.equal((productGate.match(/npm ci/g) || []).length, 6, "Command, Pi, Pi mock-model, Story Architect, media and build lanes each install their own exact-head dependencies; voice needs no npm install.");
  assert.equal((productGate.match(/timeout-minutes: 12/g) || []).length, 7, "Every native Product Gate lane, including independent Pi mock-model writes, is capped at 12 minutes.");
  const mockStart = productGate.indexOf("  pi-cli-mock-windows:");
  const storyStart = productGate.indexOf("  story-architect-windows:", mockStart);
  assert.ok(mockStart > 0 && storyStart > mockStart, "Pi mock-model Windows proof needs its own independent job");
  const mockLane = productGate.slice(mockStart, storyStart);
  assert.match(mockLane, /if: github.event_name == 'workflow_dispatch' \|\| inputs.pi/);
  assert.match(mockLane, /issue-3291-pi-unbundled-cli.test.mjs/);
  assert.match(mockLane, /PLOTPICKLE_PI_MOCK_E2E: '1'/);
  assert.match(mockLane, /issue-3159-pi-headless-inference.test.mjs/);
  const piLane = productGate.slice(productGate.indexOf("  pi-runtime-windows:"), mockStart);
  assert.doesNotMatch(piLane, /issue-3159-pi-headless-inference.test.mjs/, "mock E2E must not run at the end of the long general Pi job");
});

test("issue #1747 leaves specialized workflows outside ordinary PR verification", async () => {
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

test("#3293 reusable Product Gate Pi job edits select bounded Pi verification only", () => {
  const original = [
    "jobs:", "  pi-runtime-windows:", "    timeout-minutes: 12",
    "    steps:", "      - run: node --test pi-runtime.test.mjs",
    "  pi-cli-mock-windows:", "    timeout-minutes: 12",
    "    steps:", "      - run: node --test pi-mock.test.mjs",
    "  story-architect-windows:", "    timeout-minutes: 12",
    "    steps:", "      - run: node --test story.test.mjs", "",
  ].join("\n");
  assert.equal(piWindowsJobChanged(original, original), false);
  assert.equal(piWindowsJobChanged(original,
    original.replace("pi-runtime.test.mjs", "pi-runtime-v2.test.mjs")), true);
  assert.equal(piWindowsJobChanged(original,
    original.replace("pi-mock.test.mjs", "pi-mock-v2.test.mjs")), true);
  assert.equal(piWindowsJobChanged(original,
    original.replace("story.test.mjs", "story-v2.test.mjs")), false);
  assert.match(piJobBody(original, "pi-cli-mock-windows"), /timeout-minutes: 12/);
  assert.throws(() => piWindowsJobChanged(original,
    original.replace("  pi-runtime-windows:", "  missing-runtime:")), /Missing Pi Product Gate job/);
});
