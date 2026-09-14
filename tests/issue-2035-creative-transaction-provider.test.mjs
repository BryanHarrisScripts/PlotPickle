import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import * as ts from "typescript";

const root = new URL("../", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function contractModule() {
  const typescript = await source("lib/creative-transactions/creative-transaction-contract.ts");
  const compiled = ts.transpileModule(typescript, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  return import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}#contract-${Date.now()}-${Math.random()}`);
}

async function providerModules() {
  const contract = await contractModule();
  const typescript = await source("lib/creative-transactions/local-creative-transaction-provider.ts");
  const compiled = ts.transpileModule(typescript, {
    compilerOptions: { module: ts.ModuleKind.ES2022, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const runnable = compiled.replace(
    /import \{ CREATIVE_TRANSACTION_CONTRACT_VERSION, LOCAL_CREATIVE_TRANSACTION_PROVIDER, creativeChangeSetFingerprint, creativeTransactionVerificationComplete, providerSupportsCapabilities, \} from "\.\/creative-transaction-contract";/,
    "const { CREATIVE_TRANSACTION_CONTRACT_VERSION, LOCAL_CREATIVE_TRANSACTION_PROVIDER, creativeChangeSetFingerprint, creativeTransactionVerificationComplete, providerSupportsCapabilities } = globalThis.__plotpickleCreativeTransactionContract;",
  );
  assert.notEqual(runnable, compiled, "Expected local provider contract import to be isolated for runtime tests");
  globalThis.__plotpickleCreativeTransactionContract = contract;
  const provider = await import(`data:text/javascript;base64,${Buffer.from(runnable).toString("base64")}#provider-${Date.now()}-${Math.random()}`);
  return { contract, provider };
}

function changeInput(overrides = {}) {
  return {
    changeSetId: "change-2035",
    projectId: "project-2035",
    baseCanonicalRevision: 7,
    affectedIds: ["block-07", "mini-07-02"],
    changes: [{
      area: "storyboard",
      targetIds: ["mini-07-02"],
      summary: "Replace one visual beat while preserving continuity locks.",
      beforeFingerprint: "before-12345678",
      afterFingerprint: "after-12345678",
    }],
    responsibilityRunIds: ["run-2035"],
    requiredCapabilities: ["durable-revision", "verification", "human-review", "recovery"],
    verificationRequirements: [{ id: "ppf-fresh", label: "PPF revision is current", authority: "plotpickle", blocking: true }],
    createdAt: "2026-09-14T12:00:00.000Z",
    ...overrides,
  };
}

test("#2035 keeps Creative Transaction semantics provider-neutral and transport-last", async () => {
  const contract = await source("lib/creative-transactions/creative-transaction-contract.ts");
  for (const operation of ["create", "stage", "diff", "verify", "requestReview", "accept", "reject", "revise", "commit", "status", "recover", "reconcile", "rollback"]) {
    assert.match(contract, new RegExp(`\\b${operation}\\b`), `Missing provider-neutral operation ${operation}`);
  }
  for (const capability of ["durable-revision", "atomic-commit", "verification", "human-review", "recovery", "reconcile", "offline"]) {
    assert.match(contract, new RegExp(capability));
  }
  assert.doesNotMatch(contract, /GitHub|pull request|GitHub Actions|branch protection/i);
  assert.match(contract, /transport: "local" \| "filesystem" \| "git" \| "rest" \| "graphql" \| "mcp" \| "cli" \| "sdk" \| "other"/);
});

test("#2035 resolves Local offline by capability and refuses silent fallback from an explicit provider", async () => {
  const contract = await contractModule();
  const external = {
    id: "remote-example",
    kind: "external",
    label: "Remote Example",
    transport: "rest",
    capabilities: ["durable-revision", "diff", "remote"],
    priority: 1,
  };
  const resolved = contract.resolveCreativeTransactionProvider(
    [external, contract.LOCAL_CREATIVE_TRANSACTION_PROVIDER],
    contract.CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES,
  );
  assert.equal(resolved.id, "plotpickle-local");
  assert.ok(resolved.capabilities.includes("offline"));
  assert.throws(
    () => contract.resolveCreativeTransactionProvider(
      [external, contract.LOCAL_CREATIVE_TRANSACTION_PROVIDER],
      contract.CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES,
      { preferredProviderId: "remote-example" },
    ),
    /No silent fallback was used/,
  );
});

test("#2035 creates deterministic Change Set fingerprints and provider-neutral creative diffs", async () => {
  const contract = await contractModule();
  const first = contract.createCreativeChangeSet(changeInput());
  const second = contract.createCreativeChangeSet(changeInput());
  assert.equal(first.proposedCanonicalRevision, 8);
  assert.equal(contract.creativeChangeSetFingerprint(first), contract.creativeChangeSetFingerprint(second));
  assert.match(contract.creativeChangeSetFingerprint(first), /^ctx:[a-f0-9]{16}$/);
  assert.deepEqual(contract.summarizeCreativeDiff(first), [{
    area: "storyboard",
    changeCount: 1,
    targetCount: 1,
    summaries: ["Replace one visual beat while preserving continuity locks."],
  }]);
});

test("#2035 Local provider performs the full offline stage → verify → review → commit → reconcile lifecycle", async () => {
  const { contract, provider } = await providerModules();
  const store = new provider.MemoryCreativeTransactionStore();
  const local = provider.createLocalCreativeTransactionProvider(store);
  const changeSet = contract.createCreativeChangeSet(changeInput());

  const created = await local.create(changeSet);
  assert.equal(created.state, "created");
  assert.equal(created.providerId, "plotpickle-local");

  const staged = await local.stage(created.transactionId, ["storyboard/mini-07-02.json", "previs/mini-07-02.json"]);
  assert.equal(staged.state, "staged");
  assert.equal(staged.stagedArtifactRefs.length, 2);

  const verified = await local.verify(created.transactionId, [{
    requirementId: "ppf-fresh",
    authority: "plotpickle",
    result: "PASS",
    evidenceRef: "verification/ppf-fresh.json",
    summary: "Revision 7 remains current.",
    recordedAt: "2026-09-14T12:01:00.000Z",
  }]);
  assert.equal(verified.state, "verified");

  const review = await local.requestReview(created.transactionId);
  assert.equal(review.state, "awaiting-review");

  const approved = await local.accept(created.transactionId, {
    writerId: "writer-local",
    note: "Accept visual change.",
    decidedAt: "2026-09-14T12:02:00.000Z",
  });
  assert.equal(approved.state, "approved");

  const committed = await local.commit(created.transactionId);
  assert.equal(committed.state, "committed");
  assert.match(committed.durableRevisionId, /^local:[a-f0-9]{16}:/);
  assert.equal(committed.changeSet.review.status, "accepted");
  assert.equal(committed.changeSet.transaction.providerId, "plotpickle-local");

  const reconciled = await local.reconcile(created.transactionId);
  assert.equal(reconciled.state, "committed");
  assert.equal(reconciled.authoritative, true);
  assert.equal(reconciled.evidenceComplete, true);

  const rolledBack = await local.rollback(created.transactionId);
  assert.equal(rolledBack.state, "rolled-back");
  assert.equal(rolledBack.rollbackOfRevisionId, committed.durableRevisionId);
});

test("#2035 Local provider never guesses success and blocks incomplete verification or review", async () => {
  const { contract, provider } = await providerModules();
  const local = provider.createLocalCreativeTransactionProvider(new provider.MemoryCreativeTransactionStore());
  const changeSet = contract.createCreativeChangeSet(changeInput({ changeSetId: "change-fail-2035" }));
  const created = await local.create(changeSet);

  await assert.rejects(() => local.commit(created.transactionId), /not allowed while created/);
  await local.stage(created.transactionId, ["storyboard/mini.json"]);
  const incomplete = await local.verify(created.transactionId, [{
    requirementId: "ppf-fresh",
    authority: "provider",
    result: "PASS",
    evidenceRef: "remote/check",
    summary: "Wrong authority must not satisfy PlotPickle verification.",
    recordedAt: "2026-09-14T12:03:00.000Z",
  }]);
  assert.equal(incomplete.state, "revising");
  await assert.rejects(() => local.requestReview(created.transactionId), /not allowed while revising/);

  const unknown = await local.reconcile("local-does-not-exist");
  assert.equal(unknown.state, "unknown");
  assert.equal(unknown.authoritative, false);
  assert.match(unknown.summary, /will not infer success/);
});

test("#2035 Local durable store remains offline and uses atomic replacement under PlotPickle home", async () => {
  const store = await source("build/creative-transaction-local-store.ts");
  assert.match(store, /PLOTPICKLE_HOME/);
  assert.match(store, /"creative-transactions"/);
  assert.match(store, /handle\.sync\(\)/);
  assert.match(store, /rename\(temporary, file\)/);
  assert.match(store, /networkRequired: false/);
  assert.match(store, /canonicalAuthority: false/);
  assert.doesNotMatch(store, /fetch\(|https?:\/\//);
});

test("#2035 bridge preserves Responsibility Run and PPF authority separation", async () => {
  const [bridge, runs, revisions] = await Promise.all([
    source("lib/creative-transactions/creative-transaction-project-bridge.ts"),
    source("lib/agents/responsibility/responsibility-runs.ts"),
    source("lib/projects/persistence/project-revisions.ts"),
  ]);
  assert.match(bridge, /Only a creative-proposal Responsibility Run can seed a Creative Change Set/);
  assert.match(bridge, /artifact\.canonical !== false/);
  assert.match(bridge, /Only a durable committed Creative Transaction can propose PPF canon admission/);
  assert.match(bridge, /Creative Transaction is stale relative to the current PPF revision/);
  assert.match(bridge, /applyWriterApprovedCanonicalProposal/);
  assert.match(bridge, /Canonical proposal fingerprint does not match the committed Creative Change Set/);
  assert.match(runs, /canonical: false/);
  assert.match(revisions, /Explicit writer approval is required for canonical mutation/);
});
