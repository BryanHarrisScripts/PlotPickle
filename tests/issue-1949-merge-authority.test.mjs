import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
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

test("#1949 merge-authority contract exactly matches the canonical seven display checks", async () => {
  const [authority, inventory] = await Promise.all([
    readJson("config/verification/merge-authority.json"),
    readJson("config/verification/phase-0-inventory.json"),
  ]);
  const canonical = inventory.displayChecks.map(({ id, name }) => ({ layerId: id, name }));
  assert.deepEqual(authority.requiredChecks, canonical);
  assert.deepEqual(authority.requiredChecks.map((entry) => entry.name), exactChecks);
  assert.deepEqual(authority.rulesetExpectation.requiredStatusChecks, exactChecks);
  assert.equal(authority.architectureWorkflow.name, "Architecture Verification");
});

test("#1949 promoted architecture workflow keeps all seven exact checks visible with exact-head evidence", async () => {
  const workflow = await read(".github/workflows/architecture-shadow.yml");
  assert.match(workflow, /^name: Architecture Verification$/m);
  assert.match(workflow, /^    name: \$\{\{ matrix\.name \}\}$/m);
  assert.match(workflow, /ref: \$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}/u);
  assert.match(workflow, /--commit-sha "\$\{\{ github\.event\.pull_request\.head\.sha \|\| github\.sha \}\}"/u);
  assert.match(workflow, /Upload architecture evidence/u);
  assert.match(workflow, /^permissions:\s+contents: read$/mu);
  assert.doesNotMatch(workflow, /continue-on-error:/u);
  assert.doesNotMatch(workflow, /^\s+paths(?:-ignore)?:/mu);
  for (const name of exactChecks) assert.ok(workflow.includes(`name: ${name}`), `missing promoted check ${name}`);
});

test("#1949 records the enforced Main ruleset and retired legacy PR roles", async () => {
  const authority = await readJson("config/verification/merge-authority.json");
  assert.equal(authority.rulesetExpectation.rulesetId, 20214975);
  assert.equal(authority.rulesetExpectation.rulesetName, "Main");
  assert.equal(authority.rulesetExpectation.target, "~DEFAULT_BRANCH");
  assert.equal(authority.rulesetObservation.requiredStatusChecksConfigured, true);
  assert.deepEqual(authority.rulesetObservation.observedRuleTypes, ["deletion", "non_fast_forward", "required_status_checks"]);
  assert.deepEqual(authority.rulesetObservation.requiredStatusChecks, exactChecks);
  assert.equal(authority.rulesetObservation.legacyChecksRequired, false);
  assert.equal(authority.promotionState, "seven-layer-authority-enforced");
  assert.equal(authority.retirementState, "legacy-pr-triggers-retired");
});
