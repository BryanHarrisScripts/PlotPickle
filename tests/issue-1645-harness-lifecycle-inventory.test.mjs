import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const inventory = JSON.parse(await read("config/harness-lifecycle-inventory.json"));

const STAGES = [
  "enter-understand",
  "learn-prepare",
  "plan-decide",
  "create-execute",
  "validate-repair",
  "approve-persist",
  "package-present-continue",
];

const DOMAINS = [
  "core",
  "story",
  "intelligence",
  "community-integrations",
  "experience",
  "platform",
];

const REQUIRED_SLICE_B_FIELDS = [
  "schemaVersion",
  "runId",
  "projectId",
  "revision",
  "stage",
  "allowedTransitions",
  "actor",
  "authority",
  "intent",
  "planOrDecisionRefs",
  "capabilities",
  "contextRefs",
  "inputRefs",
  "outputRefs",
  "evidenceRefs",
  "validation",
  "repairBudget",
  "persistence",
  "approvalProvenance",
  "stopReason",
  "nextAction",
];

function nonEmptyStrings(value, label) {
  assert.ok(Array.isArray(value) && value.length > 0, `${label} must be a non-empty array`);
  assert.ok(value.every((item) => typeof item === "string" && item.trim().length > 0), `${label} must contain non-empty strings`);
}

test("#1645 freezes the seven lifecycle stages and six ownership domains for inventory evidence", () => {
  assert.equal(inventory.schemaVersion, 1);
  assert.equal(inventory.issue, 1645);
  assert.equal(inventory.parentIssue, 1644);
  assert.deepEqual(inventory.lifecycleStages, STAGES);
  assert.deepEqual(inventory.domains, DOMAINS);
});

test("#1645 maps every major route with authority inputs outputs evidence persistence stop and continuation", async () => {
  assert.ok(inventory.routes.length >= 10, "expected a major-route inventory rather than a narrow sample");
  const ids = new Set();
  for (const route of inventory.routes) {
    assert.equal(typeof route.id, "string");
    assert.ok(route.id.length > 2);
    assert.equal(ids.has(route.id), false, `duplicate route id ${route.id}`);
    ids.add(route.id);
    for (const [field, allowed] of [["stages", STAGES], ["domains", DOMAINS]]) {
      nonEmptyStrings(route[field], `${route.id}.${field}`);
      for (const value of route[field]) assert.ok(allowed.includes(value), `${route.id}.${field} contains unknown value ${value}`);
    }
    for (const field of ["actorClasses", "sourcePaths", "evidenceTests", "inputs", "outputs", "stopReasons", "nextActions"]) {
      nonEmptyStrings(route[field], `${route.id}.${field}`);
    }
    assert.equal(typeof route.persistence, "string");
    assert.ok(route.persistence.length > 20, `${route.id}.persistence must state the durability/authority boundary`);
    for (const path of [...route.sourcePaths, ...route.evidenceTests]) {
      await access(new URL(path, root));
    }
  }
});

test("#1645 covers every lifecycle stage domain and Human Guest agent authority path", () => {
  const stages = new Set(inventory.routes.flatMap((route) => route.stages));
  const domains = new Set(inventory.routes.flatMap((route) => route.domains));
  assert.deepEqual([...stages].sort(), [...STAGES].sort());
  assert.deepEqual([...domains].sort(), [...DOMAINS].sort());
  const actors = inventory.routes.flatMap((route) => route.actorClasses).join(" ").toLowerCase();
  assert.match(actors, /human/);
  assert.match(actors, /guest/);
  assert.match(actors, /agent/);
  assert.match(actors, /authoritative-system|harness/);
});

test("#1645 gaps are evidence-backed harness gaps rather than invented missing features", async () => {
  assert.ok(inventory.gaps.length >= 5);
  const ids = new Set();
  for (const gap of inventory.gaps) {
    assert.equal(ids.has(gap.id), false, `duplicate gap id ${gap.id}`);
    ids.add(gap.id);
    assert.match(gap.priority, /^P[01]$/);
    assert.equal(gap.classification, "harness-gap-not-missing-feature");
    assert.ok(gap.summary.length > 40);
    assert.ok(gap.sliceBRequirement.length > 60);
    nonEmptyStrings(gap.evidencePaths, `${gap.id}.evidencePaths`);
    nonEmptyStrings(gap.evidenceTests, `${gap.id}.evidenceTests`);
    for (const path of [...gap.evidencePaths, ...gap.evidenceTests]) await access(new URL(path, root));
  }
  for (const required of ["shared-lifecycle-envelope", "fragmented-status-vocabulary", "fragmented-authority-description", "fragmented-persistence-classification", "fragmented-continuation-contract"]) {
    assert.ok(ids.has(required), `missing required evidence-backed gap ${required}`);
  }
});

test("#1645 hands Slice B a minimum compositional contract and no replacement orchestration design", async () => {
  assert.deepEqual(inventory.sliceBMinimumFields, REQUIRED_SLICE_B_FIELDS);
  const doc = await read("docs/architecture/HARNESS-LIFECYCLE-INVENTORY.md");
  assert.match(doc, /Issue #1645/);
  assert.match(doc, /Enter \/ Understand/);
  assert.match(doc, /Package \/ Present \/ Continue/);
  assert.match(doc, /Core, Story, Intelligence, Community & Integrations, Experience and Platform/);
  assert.match(doc, /not a missing product feature/i);
  assert.match(doc, /Human, Guest and agent authority are not missing features/i);
  assert.match(doc, /small shared contract\/projection layer/i);
  assert.doesNotMatch(doc, /introduce a new orchestration framework|replace Mastra|second scheduler/i);
});
