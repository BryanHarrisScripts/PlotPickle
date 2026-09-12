import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (relative) => readFile(new URL(relative, root), "utf8");
const readJson = async (relative) => JSON.parse(await read(relative));

const exactChecks = [
  "Layer 1 Experience Skins",
  "Layer 2 Experience Contract",
  "Layer 3 Production Orchestration",
  "Layer 4 Agent & Skill Mesh",
  "Layer 5 Story / Canon / Evidence",
  "Layer 6 Provider Runtime",
  "Layer 7 Validation & Operations",
];

test("#1951 leaves Architecture Verification as the sole ordinary pull-request workflow", async () => {
  const workflowRoot = new URL(".github/workflows/", root);
  const files = (await readdir(workflowRoot)).filter((file) => /\.ya?ml$/.test(file)).sort();
  const ordinary = [];
  for (const file of files) {
    const workflow = await read(`.github/workflows/${file}`);
    if (/^  pull_request:/m.test(workflow)) ordinary.push(file);
  }
  assert.deepEqual(ordinary, ["architecture-shadow.yml"]);
});

test("#1951 keeps legacy gates as explicit manual diagnostics only", async () => {
  for (const file of ["pr-gate.yml", "product-gate.yml"]) {
    const workflow = await read(`.github/workflows/${file}`);
    assert.match(workflow, /^  workflow_dispatch:/m);
    assert.doesNotMatch(workflow, /^  pull_request:/m);
  }

  const authority = await readJson("config/verification/merge-authority.json");
  assert.deepEqual(authority.retiredLegacyWorkflows.map((entry) => entry.role), ["manual-diagnostic", "manual-diagnostic"]);
  assert.ok(authority.retiredLegacyWorkflows.every((entry) => entry.ordinaryPullRequestTrigger === false));
});

test("#1951 records seven enforced checks and no legacy required checks", async () => {
  const authority = await readJson("config/verification/merge-authority.json");
  assert.deepEqual(authority.requiredChecks.map((entry) => entry.name), exactChecks);
  assert.deepEqual(authority.rulesetObservation.requiredStatusChecks, exactChecks);
  assert.equal(authority.rulesetObservation.requiredStatusChecksConfigured, true);
  assert.equal(authority.rulesetObservation.legacyChecksRequired, false);
  assert.equal(authority.promotionState, "seven-layer-authority-enforced");
  assert.equal(authority.retirementState, "legacy-pr-triggers-retired");
});

test("#1951 canonical Layer 7 blueprint describes the seven-check verification mesh", async () => {
  const architecture = await readJson("architecture/plotpickle.architecture.json");
  const layer7 = architecture.layers.find((layer) => layer.id === "verification");
  assert.ok(layer7);
  assert.match(layer7.footer, /SEVEN REQUIRED ARCHITECTURE CHECKS/);
  assert.ok(layer7.components.some((component) => component.title === "Architecture Verification"));
  assert.ok(layer7.components.some((component) => component.title === "Verification core"));
  assert.ok(layer7.components.some((component) => component.title === "Live + runtime observers"));
  assert.ok(layer7.components.some((component) => component.title === "Release + diagnostics"));
  assert.ok(layer7.components.every((component) => component.title !== "PR Gate" && component.title !== "Product Gate"));
});
