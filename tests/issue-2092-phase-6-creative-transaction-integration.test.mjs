import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function contractModule() {
  const typescript = await source("lib/creative-transactions/creative-transaction-contract.ts");
  const compiled = stripTypeScriptTypes(typescript, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#contract-${Date.now()}-${Math.random()}`);
}

async function dependencyModule() {
  const typescript = await source("lib/preproduction/dependency-projection.ts");
  const compiled = stripTypeScriptTypes(typescript, { mode: "transform" });
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#dependency-${Date.now()}-${Math.random()}`);
}

async function bridgeModules() {
  const contract = await contractModule();
  const dependency = await dependencyModule();
  const typescript = await source("lib/creative-transactions/preproduction-creative-transaction-bridge.ts");
  const compiled = stripTypeScriptTypes(typescript, { mode: "transform" });
  let runnable = compiled.replace(
    /import\s*\{\s*downstreamImpactIds\s*\}\s*from\s*["']\.\.\/preproduction\/dependency-projection["'];?/,
    "const { downstreamImpactIds } = globalThis.__plotpicklePreproductionDependency;",
  );
  runnable = runnable.replace(
    /import\s*\{[\s\S]*?CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES,[\s\S]*?createCreativeChangeSet[\s\S]*?\}\s*from\s*["']\.\/creative-transaction-contract["'];?/,
    "const { CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES, createCreativeChangeSet } = globalThis.__plotpickleCreativeTransactionContract;",
  );
  assert.notEqual(runnable, compiled, "Expected bridge runtime imports to be isolated for focused tests");
  globalThis.__plotpicklePreproductionDependency = dependency;
  globalThis.__plotpickleCreativeTransactionContract = contract;
  const bridge = await import(`data:text/javascript;base64,${Buffer.from(runnable).toString("base64")}#bridge-${Date.now()}-${Math.random()}`);
  return { bridge, contract, dependency };
}

async function localProviderModule(contract) {
  const typescript = await source("lib/creative-transactions/local-creative-transaction-provider.ts");
  const compiled = stripTypeScriptTypes(typescript, { mode: "transform" });
  const runnable = compiled.replace(
    /import\s*\{[\s\S]*?\}\s*from\s*["']\.\/creative-transaction-contract["'];?/,
    "const { CREATIVE_TRANSACTION_CONTRACT_VERSION, LOCAL_CREATIVE_TRANSACTION_PROVIDER, creativeChangeSetFingerprint, creativeTransactionVerificationComplete, providerSupportsCapabilities } = globalThis.__plotpickleCreativeTransactionContract;",
  );
  assert.notEqual(runnable, compiled, "Expected Local provider contract import to be isolated for focused tests");
  globalThis.__plotpickleCreativeTransactionContract = contract;
  return import(`data:text/javascript;base64,${Buffer.from(runnable).toString("base64")}#local-${Date.now()}-${Math.random()}`);
}

function dependencySnapshot() {
  const ids = [
    "story-1",
    "story-1:story",
    "block-01",
    "mini-01",
    "scene-1",
    "beat-1",
    "editorial-shot-1",
    "frame-1",
    "previs-1",
    "mini-02",
    "scene-2",
    "beat-2",
    "editorial-shot-2",
    "frame-2",
    "previs-2",
    "production-instruction:story-1:revision-8",
  ];
  const nodes = ids.map((id) => ({
    id,
    kind: id.startsWith("mini-") ? "mini-block" : id.startsWith("scene-") ? "scene" : "production-cue",
    label: id,
    module: "preproduction",
    path: id,
  }));
  const references = {
    "mini-01": ["scene-1", "beat-1", "editorial-shot-1", "frame-1"],
    "frame-1": ["previs-1", "production-instruction:story-1:revision-8"],
    "previs-1": ["production-instruction:story-1:revision-8"],
    "mini-02": ["scene-2", "beat-2", "editorial-shot-2", "frame-2"],
    "frame-2": ["previs-2", "production-instruction:story-1:revision-8"],
    "previs-2": ["production-instruction:story-1:revision-8"],
  };
  const reverseIndex = {};
  for (const [from, targets] of Object.entries(references)) {
    for (const target of targets) (reverseIndex[target] ??= []).push(from);
  }
  return {
    version: "2.0.0",
    generatedAt: "2026-09-16T14:00:00.000Z",
    projectId: "story-1",
    graph: { nodes, edges: [] },
    references,
    reverseIndex,
    conflicts: [],
    health: { score: 100, warnings: 0, critical: 0, checks: [] },
  };
}

function project(revision = 8) {
  return { id: "story-1", revision };
}

function change() {
  return {
    area: "storyboard",
    targetIds: ["mini-01"],
    summary: "Revise the first Mini-Block visual intent.",
    beforeFingerprint: "mini-01-before",
    afterFingerprint: "mini-01-after",
  };
}

function creativeProposalRun(overrides = {}) {
  return {
    version: 1,
    runId: "run-phase-6",
    kind: "creative-proposal",
    goal: "Review Mini-Block 1",
    objectiveRevision: 1,
    profileId: "quillan-reedcloak",
    skillUris: [],
    allowedScopes: [],
    allowedConnectorIds: [],
    context: {
      taskId: "task-phase-6",
      sourceIds: ["mini-01", "editorial-shot-1"],
      receiptGeneratedAt: "2026-09-16T14:00:00.000Z",
    },
    verificationMode: "writer-approval",
    limits: {},
    usage: {},
    state: "waiting-for-writer",
    resumeState: null,
    attemptId: "",
    contextRound: 1,
    parentRunId: "",
    childRunIds: [],
    artifacts: [{ id: "artifact-1", kind: "proposal", ref: "proposal/1", producedAt: "2026-09-16T14:01:00.000Z", canonical: false }],
    verificationEvidence: [],
    writerDecisions: [],
    repetition: [],
    handoff: null,
    startedAt: "2026-09-16T14:00:00.000Z",
    updatedAt: "2026-09-16T14:01:00.000Z",
    completedAt: "",
    stopReason: "",
    events: [],
    ...overrides,
  };
}

test("#2092 Phase 6 maps one direct production-object change into bounded #2035 affectedIds", async () => {
  const { bridge, contract } = await bridgeModules();
  const changeSet = bridge.createPreproductionCreativeChangeSet({
    project: project(),
    dependencySnapshot: dependencySnapshot(),
    changeSetId: "change-phase-6",
    changes: [change()],
    createdAt: "2026-09-16T14:02:00.000Z",
  });

  assert.deepEqual(changeSet.changes[0].targetIds, ["mini-01"], "Direct creative change identity must remain narrow");
  const affected = new Set(changeSet.affectedIds);
  for (const expected of ["mini-01", "scene-1", "beat-1", "editorial-shot-1", "frame-1", "previs-1", "production-instruction:story-1:revision-8"]) {
    assert.ok(affected.has(expected), `Expected ${expected} in affected scope`);
  }
  for (const unrelated of ["mini-02", "scene-2", "beat-2", "editorial-shot-2", "frame-2", "previs-2"]) {
    assert.equal(affected.has(unrelated), false, `Did not expect unrelated ${unrelated} in affected scope`);
  }
  assert.equal(changeSet.baseCanonicalRevision, 8);
  assert.deepEqual(changeSet.requiredCapabilities, contract.CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES);
  assert.deepEqual(changeSet.verificationRequirements.map((item) => item.id), [
    bridge.PREPRODUCTION_CREATIVE_TRANSACTION_REQUIREMENTS.revisionCurrent,
    bridge.PREPRODUCTION_CREATIVE_TRANSACTION_REQUIREMENTS.impactCurrent,
    bridge.PREPRODUCTION_CREATIVE_TRANSACTION_REQUIREMENTS.stalenessCleared,
  ]);
});

test("#2092 Phase 6 optionally preserves bounded Responsibility Run provenance without making it canon", async () => {
  const { bridge } = await bridgeModules();
  const run = creativeProposalRun();
  const changeSet = bridge.createPreproductionCreativeChangeSet({
    project: project(),
    dependencySnapshot: dependencySnapshot(),
    changeSetId: "change-with-run",
    changes: [change()],
    responsibilityRun: run,
    createdAt: "2026-09-16T14:02:00.000Z",
  });

  assert.deepEqual(changeSet.responsibilityRunIds, ["run-phase-6"]);
  assert.equal(changeSet.context.taskId, "task-phase-6");
  assert.equal(changeSet.context.profileId, "quillan-reedcloak");
  assert.ok(changeSet.context.sourceIds.includes("mini-01"));
  assert.deepEqual(changeSet.context.sourceRevisions, [{ sourceId: "story-1", revision: "8" }]);

  assert.throws(
    () => bridge.createPreproductionCreativeChangeSet({
      project: project(),
      dependencySnapshot: dependencySnapshot(),
      changeSetId: "change-bad-run",
      changes: [change()],
      responsibilityRun: creativeProposalRun({ state: "failed" }),
    }),
    /cannot be seeded from a failed Responsibility Run/,
  );
});

test("#2092 Phase 6 fails verification when revision, impact scope, or affected staleness changes", async () => {
  const { bridge } = await bridgeModules();
  const snapshot = dependencySnapshot();
  const changeSet = bridge.createPreproductionCreativeChangeSet({
    project: project(),
    dependencySnapshot: snapshot,
    changeSetId: "change-verification",
    changes: [change()],
    createdAt: "2026-09-16T14:02:00.000Z",
  });

  const clean = bridge.verifyPreproductionCreativeChangeSet({
    project: project(),
    dependencySnapshot: snapshot,
    changeSet,
    currentStaleIds: ["frame-2"],
    recordedAt: "2026-09-16T14:03:00.000Z",
  });
  assert.deepEqual(clean.map((item) => item.result), ["PASS", "PASS", "PASS"]);

  const stale = bridge.verifyPreproductionCreativeChangeSet({
    project: project(),
    dependencySnapshot: snapshot,
    changeSet,
    currentStaleIds: ["frame-1", "frame-2"],
    recordedAt: "2026-09-16T14:03:00.000Z",
  });
  assert.equal(stale.find((item) => item.requirementId === bridge.PREPRODUCTION_CREATIVE_TRANSACTION_REQUIREMENTS.stalenessCleared).result, "FAIL");

  const newerRevision = bridge.verifyPreproductionCreativeChangeSet({
    project: project(9),
    dependencySnapshot: snapshot,
    changeSet,
    currentStaleIds: [],
    recordedAt: "2026-09-16T14:03:00.000Z",
  });
  assert.equal(newerRevision.find((item) => item.requirementId === bridge.PREPRODUCTION_CREATIVE_TRANSACTION_REQUIREMENTS.revisionCurrent).result, "FAIL");

  const changedSnapshot = structuredClone(snapshot);
  changedSnapshot.graph.nodes.push({ id: "new-dependent", kind: "production-cue", label: "new", module: "preproduction", path: "new" });
  changedSnapshot.references["mini-01"] = [...changedSnapshot.references["mini-01"], "new-dependent"];
  const changedImpact = bridge.verifyPreproductionCreativeChangeSet({
    project: project(),
    dependencySnapshot: changedSnapshot,
    changeSet,
    currentStaleIds: [],
    recordedAt: "2026-09-16T14:03:00.000Z",
  });
  assert.equal(changedImpact.find((item) => item.requirementId === bridge.PREPRODUCTION_CREATIVE_TRANSACTION_REQUIREMENTS.impactCurrent).result, "FAIL");
});

test("#2092 Phase 6 Change Set passes unchanged through the existing Local Creative Transaction provider", async () => {
  const { bridge, contract } = await bridgeModules();
  const provider = await localProviderModule(contract);
  const local = provider.createLocalCreativeTransactionProvider(new provider.MemoryCreativeTransactionStore());
  const snapshot = dependencySnapshot();
  const changeSet = bridge.createPreproductionCreativeChangeSet({
    project: project(),
    dependencySnapshot: snapshot,
    changeSetId: "change-local-provider",
    changes: [change()],
    createdAt: "2026-09-16T14:02:00.000Z",
  });
  const verificationEvidence = bridge.verifyPreproductionCreativeChangeSet({
    project: project(),
    dependencySnapshot: snapshot,
    changeSet,
    currentStaleIds: [],
    recordedAt: "2026-09-16T14:03:00.000Z",
  });

  const created = await local.create(changeSet);
  await local.stage(created.transactionId, changeSet.affectedIds.map((id) => `preproduction/${id}.json`));
  const verified = await local.verify(created.transactionId, verificationEvidence);
  assert.equal(verified.state, "verified");
  await local.requestReview(created.transactionId);
  await local.accept(created.transactionId, {
    writerId: "writer-phase-6",
    note: "Accept bounded PRE-PRODUCTION change.",
    decidedAt: "2026-09-16T14:04:00.000Z",
  });
  const committed = await local.commit(created.transactionId);
  assert.equal(committed.state, "committed");
  assert.deepEqual(committed.changeSet.changes, changeSet.changes);
  assert.deepEqual(committed.changeSet.affectedIds, changeSet.affectedIds);
});

test("#2092 Phase 6 remains an integration seam and does not create transaction, graph, staleness, or canon authority", async () => {
  const bridge = await source("lib/creative-transactions/preproduction-creative-transaction-bridge.ts");
  const contract = await source("lib/creative-transactions/creative-transaction-contract.ts");
  assert.match(bridge, /downstreamImpactIds/);
  assert.match(bridge, /createCreativeChangeSet/);
  assert.match(bridge, /currentStaleIds/);
  assert.doesNotMatch(bridge, /createLocalCreativeTransactionProvider|createGitHubCreativeTransactionProvider|createVersionedObjectCreativeTransactionProvider|applyWriterApprovedCanonicalProposal|saveFoundationProject|LangGraph|localStorage|sessionStorage/);
  assert.doesNotMatch(contract, /PreproductionCreative|PRE-PRODUCTION|StoryDependencySnapshot/);
});
