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

async function providerModule(path, tag) {
  const contract = await contractModule();
  const typescript = await source(path);
  const compiled = stripTypeScriptTypes(typescript, { mode: "transform" });
  const runnable = compiled.replace(
    /import\s*\{[\s\S]*?\}\s*from\s*["']\.\/creative-transaction-contract["'];?/,
    "const { CREATIVE_TRANSACTION_CONTRACT_VERSION, LOCAL_CREATIVE_TRANSACTION_PROVIDER, creativeChangeSetFingerprint, creativeTransactionVerificationComplete, providerSupportsCapabilities } = globalThis.__plotpickleCreativeTransactionContract;",
  );
  assert.notEqual(runnable, compiled, `Expected ${tag} provider contract import to be isolated for runtime tests`);
  globalThis.__plotpickleCreativeTransactionContract = contract;
  const provider = await import(`data:text/javascript;base64,${Buffer.from(runnable).toString("base64")}#${tag}-${Date.now()}-${Math.random()}`);
  return { contract, provider };
}

const localProviderModules = () => providerModule("lib/creative-transactions/local-creative-transaction-provider.ts", "local-provider");
const githubProviderModules = () => providerModule("lib/creative-transactions/github-creative-transaction-provider.ts", "github-provider");
const objectProviderModules = () => providerModule("lib/creative-transactions/versioned-object-creative-transaction-provider.ts", "object-provider");

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

function passingEvidence() {
  return [{
    requirementId: "ppf-fresh",
    authority: "plotpickle",
    result: "PASS",
    evidenceRef: "verification/ppf-fresh.json",
    summary: "Revision 7 remains current.",
    recordedAt: "2026-09-14T12:01:00.000Z",
  }];
}

function githubBridgeFixture() {
  let remoteState = "open";
  let durableRevisionId = "";
  const calls = [];
  return {
    calls,
    setRemote(state, durable = "") {
      remoteState = state;
      durableRevisionId = durable;
    },
    bridge: {
      async createProposal(input) {
        calls.push(["create", input.changeSet.changeSetId, [...input.artifactRefs]]);
        return { providerTransactionId: "42", reviewRef: "review/42", baseRevisionId: "base-42", proposedRevisionId: "head-42" };
      },
      async inspectProposal() {
        return { state: remoteState, durableRevisionId, summary: `remote ${remoteState}` };
      },
      async commitApprovedProposal(input) {
        calls.push(["commit", input.providerTransactionId, input.writerId]);
        remoteState = "committed";
        durableRevisionId = "github-approved-42";
        return { durableRevisionId };
      },
      async declineProposal(input) {
        calls.push(["decline", input.providerTransactionId]);
        remoteState = "declined";
      },
    },
  };
}

function objectBridgeFixture({ rollback = false } = {}) {
  let remote = { state: "missing", durableRevisionId: "", changeSetFingerprint: "", summary: "missing" };
  const calls = [];
  const bridge = {
    async stageBundle(input) {
      calls.push(["stage", input.changeSet.changeSetId, input.changeSetFingerprint, [...input.artifactRefs]]);
      remote = {
        state: "staged",
        durableRevisionId: "",
        changeSetFingerprint: input.changeSetFingerprint,
        summary: "bundle staged",
      };
      return { providerTransactionId: "bundle-42", changeSetFingerprint: input.changeSetFingerprint };
    },
    async inspectBundle() {
      return { ...remote };
    },
    async commitBundle(input) {
      calls.push(["commit", input.providerTransactionId, input.writerId, input.expectedFingerprint]);
      assert.equal(input.expectedFingerprint, remote.changeSetFingerprint);
      remote = { ...remote, state: "committed", durableRevisionId: "object-version-42", summary: "bundle committed" };
      return { durableRevisionId: remote.durableRevisionId };
    },
    async discardBundle(input) {
      calls.push(["discard", input.providerTransactionId, input.writerId]);
      remote = { ...remote, state: "missing", durableRevisionId: "", summary: "bundle discarded" };
    },
  };
  if (rollback) {
    bridge.rollbackBundle = async (input) => {
      calls.push(["rollback", input.providerTransactionId, input.durableRevisionId, input.writerId]);
      remote = { ...remote, state: "rolled-back", durableRevisionId: "object-rollback-43", summary: "bundle rolled back" };
      return { durableRevisionId: remote.durableRevisionId };
    };
  }
  return {
    calls,
    bridge,
    setRemote(next) { remote = { ...remote, ...next }; },
    getRemote() { return { ...remote }; },
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
  assert.doesNotMatch(contract, /GitHub|pull request|GitHub Actions|branch protection|Versioned Object|S3|bucket|object key/i);
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

test("#2035 Local provider performs the full offline stage → verify → review → commit → reconcile → rollback lifecycle", async () => {
  const { contract, provider } = await localProviderModules();
  const local = provider.createLocalCreativeTransactionProvider(new provider.MemoryCreativeTransactionStore());
  const changeSet = contract.createCreativeChangeSet(changeInput());
  const created = await local.create(changeSet);
  assert.equal(created.state, "created");
  assert.equal(created.providerId, "plotpickle-local");
  await local.stage(created.transactionId, ["storyboard/mini-07-02.json", "previs/mini-07-02.json"]);
  assert.equal((await local.verify(created.transactionId, passingEvidence())).state, "verified");
  assert.equal((await local.requestReview(created.transactionId)).state, "awaiting-review");
  assert.equal((await local.accept(created.transactionId, {
    writerId: "writer-local",
    note: "Accept visual change.",
    decidedAt: "2026-09-14T12:02:00.000Z",
  })).state, "approved");
  const committed = await local.commit(created.transactionId);
  assert.equal(committed.state, "committed");
  assert.match(committed.durableRevisionId, /^local:[a-f0-9]{16}:/);
  assert.equal(committed.changeSet.transaction.providerId, "plotpickle-local");
  const reconciled = await local.reconcile(created.transactionId);
  assert.equal(reconciled.state, "committed");
  assert.equal(reconciled.authoritative, true);
  assert.equal((await local.rollback(created.transactionId)).state, "rolled-back");
});

test("#2035 Local provider/store fail closed and preserve Responsibility Run / PPF authority separation", async () => {
  const { contract, provider } = await localProviderModules();
  const local = provider.createLocalCreativeTransactionProvider(new provider.MemoryCreativeTransactionStore());
  const created = await local.create(contract.createCreativeChangeSet(changeInput({ changeSetId: "change-fail-2035" })));
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
  assert.equal((await local.reconcile("local-does-not-exist")).state, "unknown");

  const [store, bridge, runs, revisions] = await Promise.all([
    source("build/creative-transaction-local-store.ts"),
    source("lib/creative-transactions/creative-transaction-project-bridge.ts"),
    source("lib/agents/responsibility/responsibility-runs.ts"),
    source("lib/projects/persistence/project-revisions.ts"),
  ]);
  assert.match(store, /PLOTPICKLE_HOME/);
  assert.match(store, /handle\.sync\(\)/);
  assert.match(store, /rename\(temporary, file\)/);
  assert.match(store, /networkRequired: false/);
  assert.doesNotMatch(store, /fetch\(|https?:\/\//);
  assert.match(bridge, /Only a creative-proposal Responsibility Run can seed a Creative Change Set/);
  assert.match(bridge, /Only a durable committed Creative Transaction can propose PPF canon admission/);
  assert.match(bridge, /Creative Transaction is stale relative to the current PPF revision/);
  assert.match(bridge, /applyWriterApprovedCanonicalProposal/);
  assert.match(runs, /canonical: false/);
  assert.match(revisions, /Explicit writer approval is required for canonical mutation/);
});

test("#2039 GitHub remains an optional external provider while Local remains the default route", async () => {
  const { contract, provider } = await githubProviderModules();
  const descriptor = provider.GITHUB_CREATIVE_TRANSACTION_PROVIDER;
  assert.equal(descriptor.kind, "external");
  assert.ok(descriptor.capabilities.includes("remote"));
  assert.ok(!descriptor.capabilities.includes("offline"));
  assert.ok(!descriptor.capabilities.includes("atomic-commit"));
  assert.ok(!descriptor.capabilities.includes("rollback"));
  assert.equal(contract.resolveCreativeTransactionProvider(
    [descriptor, contract.LOCAL_CREATIVE_TRANSACTION_PROVIDER],
    contract.CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES,
  ).id, "plotpickle-local");
  assert.equal(contract.resolveCreativeTransactionProvider(
    [descriptor, contract.LOCAL_CREATIVE_TRANSACTION_PROVIDER],
    contract.CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES,
    { preferredProviderId: descriptor.id },
  ).id, descriptor.id);
});

test("#2039 GitHub adapter completes deterministic external review/commit without becoming PPF canon", async () => {
  const { contract, provider } = await githubProviderModules();
  const fixture = githubBridgeFixture();
  const github = provider.createGitHubCreativeTransactionProvider(new provider.MemoryGitHubCreativeTransactionStore(), fixture.bridge);
  const changeSet = contract.createCreativeChangeSet(changeInput({ changeSetId: "change-2039" }));
  const fingerprint = contract.creativeChangeSetFingerprint(changeSet);
  const created = await github.create(changeSet);
  await github.stage(created.transactionId, ["project/storyboard/mini-07-02.json"]);
  await github.verify(created.transactionId, passingEvidence());
  const reviewing = await github.requestReview(created.transactionId);
  assert.equal(reviewing.changeSet.transaction.providerId, "github-story-proposals");
  assert.equal(contract.creativeChangeSetFingerprint(reviewing.changeSet), fingerprint);
  await github.accept(created.transactionId, { writerId: "writer-2039", note: "Approve complete change set.", decidedAt: "2026-09-14T13:40:00.000Z" });
  const committed = await github.commit(created.transactionId);
  assert.equal(committed.durableRevisionId, "github-approved-42");
  assert.equal(contract.creativeChangeSetFingerprint(committed.changeSet), fingerprint);
  assert.equal((await github.reconcile(created.transactionId)).authoritative, true);
  assert.deepEqual(fixture.calls[0], ["create", "change-2039", ["project/storyboard/mini-07-02.json"]]);

  const ppfBridge = await source("lib/creative-transactions/creative-transaction-project-bridge.ts");
  assert.match(ppfBridge, /Only a durable committed Creative Transaction can propose PPF canon admission/);
  assert.match(ppfBridge, /explicit Human acceptance/);
});

test("#2039 GitHub reconciliation fails closed on unavailable state and provider-commit acknowledgement gaps", async () => {
  const { contract, provider } = await githubProviderModules();
  const fixture = githubBridgeFixture();
  const github = provider.createGitHubCreativeTransactionProvider(new provider.MemoryGitHubCreativeTransactionStore(), fixture.bridge);
  const created = await github.create(contract.createCreativeChangeSet(changeInput({ changeSetId: "change-reconcile-2039" })));
  await github.stage(created.transactionId, ["project/story.json"]);
  await github.verify(created.transactionId, passingEvidence());
  await github.requestReview(created.transactionId);
  fixture.setRemote("unavailable");
  const unavailable = await github.reconcile(created.transactionId);
  assert.equal(unavailable.state, "unknown");
  assert.equal(unavailable.authoritative, false);
  await github.accept(created.transactionId, { writerId: "writer-2039", note: "accept", decidedAt: "2026-09-14T13:41:00.000Z" });
  await assert.rejects(() => github.commit(created.transactionId), /cannot commit while provider state is unavailable/);
  fixture.setRemote("committed", "");
  const gap = await github.reconcile(created.transactionId);
  assert.equal(gap.state, "committed");
  assert.equal(gap.authoritative, false);
});

test("#2039 concrete GitHub bridge reuses the existing Story Proposal gateway", async () => {
  const [bridge, gateway, contract] = await Promise.all([
    source("build/github-creative-transaction-bridge.ts"),
    source("build/github-review-gateway.ts"),
    source("lib/creative-transactions/creative-transaction-contract.ts"),
  ]);
  for (const endpoint of ["submit-proposal", "proposals", "proposal-review", "approve-proposal", "decline-proposal"]) {
    assert.match(bridge, new RegExp(endpoint));
  }
  assert.doesNotMatch(bridge, /api\.github\.com|Authorization:|Bearer\s/);
  assert.match(gateway, /expectedBaseCommit/);
  assert.match(gateway, /force: false/);
  assert.match(gateway, /safeManagedDeletionPath/);
  assert.doesNotMatch(contract, /GitHub|pull request|GitHub Actions|branch protection/i);
});

test("#2035 Phase 10 versioned object store resolves through the same capability contract without replacing Local", async () => {
  const { contract, provider } = await objectProviderModules();
  const descriptor = provider.VERSIONED_OBJECT_CREATIVE_TRANSACTION_PROVIDER;
  assert.equal(descriptor.id, "versioned-object-store");
  assert.equal(descriptor.kind, "external");
  assert.equal(descriptor.transport, "sdk");
  assert.ok(descriptor.capabilities.includes("remote"));
  assert.ok(descriptor.capabilities.includes("artifact-storage"));
  assert.ok(!descriptor.capabilities.includes("offline"));
  assert.ok(!descriptor.capabilities.includes("collaboration"));
  assert.ok(!descriptor.capabilities.includes("atomic-commit"));
  assert.ok(!descriptor.capabilities.includes("rollback"));

  assert.equal(contract.resolveCreativeTransactionProvider(
    [descriptor, contract.LOCAL_CREATIVE_TRANSACTION_PROVIDER],
    contract.CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES,
  ).id, "plotpickle-local");
  assert.equal(contract.resolveCreativeTransactionProvider(
    [descriptor, contract.LOCAL_CREATIVE_TRANSACTION_PROVIDER],
    contract.CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES,
    { preferredProviderId: descriptor.id },
  ).id, descriptor.id);
  assert.throws(() => contract.resolveCreativeTransactionProvider(
    [descriptor, contract.LOCAL_CREATIVE_TRANSACTION_PROVIDER],
    ["offline"],
    { preferredProviderId: descriptor.id },
  ), /No silent fallback was used/);
});

test("#2035 Phase 10 uses the same Change Set fingerprint/diff/Human review semantics through a versioned object provider", async () => {
  const { contract, provider } = await objectProviderModules();
  const fixture = objectBridgeFixture();
  const objectStore = provider.createVersionedObjectCreativeTransactionProvider(
    new provider.MemoryVersionedObjectCreativeTransactionStore(),
    fixture.bridge,
  );
  const changeSet = contract.createCreativeChangeSet(changeInput({ changeSetId: "change-object-2035" }));
  const fingerprint = contract.creativeChangeSetFingerprint(changeSet);
  const created = await objectStore.create(changeSet);
  await objectStore.stage(created.transactionId, ["storyboard/mini-07-02.json", "previs/mini-07-02.json"]);
  assert.deepEqual(await objectStore.diff(created.transactionId), changeSet.changes);
  await objectStore.verify(created.transactionId, passingEvidence());
  const reviewing = await objectStore.requestReview(created.transactionId);
  assert.equal(reviewing.state, "awaiting-review");
  assert.equal(reviewing.changeSet.transaction.providerId, "versioned-object-store");
  assert.equal(reviewing.changeSet.transaction.transactionId, "bundle-42");
  assert.equal(reviewing.changeSet.context, null);
  assert.equal(contract.creativeChangeSetFingerprint(reviewing.changeSet), fingerprint);
  assert.deepEqual(fixture.calls[0], [
    "stage",
    "change-object-2035",
    fingerprint,
    ["storyboard/mini-07-02.json", "previs/mini-07-02.json"],
  ]);

  assert.equal((await objectStore.accept(created.transactionId, {
    writerId: "writer-object",
    note: "Accept the same creative change.",
    decidedAt: "2026-09-16T13:45:00.000Z",
  })).state, "approved");
  const committed = await objectStore.commit(created.transactionId);
  assert.equal(committed.state, "committed");
  assert.equal(committed.durableRevisionId, "object-version-42");
  assert.equal(contract.creativeChangeSetFingerprint(committed.changeSet), fingerprint);
  const reconciled = await objectStore.reconcile(created.transactionId);
  assert.equal(reconciled.state, "committed");
  assert.equal(reconciled.authoritative, true);
  assert.equal(reconciled.evidenceComplete, true);
});

test("#2035 Phase 10 object-store recovery fails closed on unavailability, divergence and acknowledgement gaps", async () => {
  const { contract, provider } = await objectProviderModules();
  const fixture = objectBridgeFixture();
  const objectStore = provider.createVersionedObjectCreativeTransactionProvider(
    new provider.MemoryVersionedObjectCreativeTransactionStore(),
    fixture.bridge,
  );
  const changeSet = contract.createCreativeChangeSet(changeInput({ changeSetId: "change-object-recovery" }));
  const created = await objectStore.create(changeSet);
  await objectStore.stage(created.transactionId, ["storyboard/object.json"]);
  await objectStore.verify(created.transactionId, passingEvidence());
  await objectStore.requestReview(created.transactionId);

  fixture.setRemote({ state: "unavailable", summary: "object service unavailable" });
  let recovery = await objectStore.reconcile(created.transactionId);
  assert.equal(recovery.state, "unknown");
  assert.equal(recovery.authoritative, false);

  fixture.setRemote({
    state: "staged",
    changeSetFingerprint: "ctx:deadbeefdeadbeef",
    summary: "bundle fingerprint diverged",
  });
  recovery = await objectStore.reconcile(created.transactionId);
  assert.equal(recovery.state, "unknown");
  assert.equal(recovery.authoritative, true);

  const expectedFingerprint = contract.creativeChangeSetFingerprint(changeSet);
  fixture.setRemote({ state: "staged", changeSetFingerprint: expectedFingerprint, summary: "bundle staged" });
  await objectStore.accept(created.transactionId, { writerId: "writer-object", note: "accept", decidedAt: "2026-09-16T13:46:00.000Z" });
  fixture.setRemote({ state: "committed", durableRevisionId: "", changeSetFingerprint: expectedFingerprint, summary: "commit receipt missing" });
  recovery = await objectStore.reconcile(created.transactionId);
  assert.equal(recovery.state, "committed");
  assert.equal(recovery.authoritative, false);
  await assert.rejects(() => objectStore.commit(created.transactionId), /already committed remotely/);
});

test("#2035 Phase 10 advertises object-store rollback only when the bridge proves it", async () => {
  const { contract, provider } = await objectProviderModules();
  const fixture = objectBridgeFixture({ rollback: true });
  const objectStore = provider.createVersionedObjectCreativeTransactionProvider(
    new provider.MemoryVersionedObjectCreativeTransactionStore(),
    fixture.bridge,
  );
  assert.ok(objectStore.descriptor.capabilities.includes("rollback"));
  const created = await objectStore.create(contract.createCreativeChangeSet(changeInput({ changeSetId: "change-object-rollback" })));
  await objectStore.stage(created.transactionId, ["storyboard/object.json"]);
  await objectStore.verify(created.transactionId, passingEvidence());
  await objectStore.requestReview(created.transactionId);
  await objectStore.accept(created.transactionId, { writerId: "writer-object", note: "accept", decidedAt: "2026-09-16T13:47:00.000Z" });
  await objectStore.commit(created.transactionId);
  const rolledBack = await objectStore.rollback(created.transactionId);
  assert.equal(rolledBack.state, "rolled-back");
  assert.equal(rolledBack.rollbackOfRevisionId, "object-version-42");
});

test("#2035 Phase 10 proves one Creative Change Set survives Local, GitHub and object-store routing unchanged", async () => {
  const localModules = await localProviderModules();
  const githubModules = await githubProviderModules();
  const objectModules = await objectProviderModules();
  const contract = localModules.contract;
  const changeSet = contract.createCreativeChangeSet(changeInput({ changeSetId: "change-universal-2035" }));
  const fingerprint = contract.creativeChangeSetFingerprint(changeSet);

  const local = localModules.provider.createLocalCreativeTransactionProvider(new localModules.provider.MemoryCreativeTransactionStore());
  const githubFixture = githubBridgeFixture();
  const github = githubModules.provider.createGitHubCreativeTransactionProvider(
    new githubModules.provider.MemoryGitHubCreativeTransactionStore(),
    githubFixture.bridge,
  );
  const objectFixture = objectBridgeFixture();
  const objectStore = objectModules.provider.createVersionedObjectCreativeTransactionProvider(
    new objectModules.provider.MemoryVersionedObjectCreativeTransactionStore(),
    objectFixture.bridge,
  );

  const [localRecord, githubRecord, objectRecord] = await Promise.all([
    local.create(changeSet),
    github.create(changeSet),
    objectStore.create(changeSet),
  ]);
  for (const record of [localRecord, githubRecord, objectRecord]) {
    assert.equal(contract.creativeChangeSetFingerprint(record.changeSet), fingerprint);
    assert.deepEqual(record.changeSet.changes, changeSet.changes);
    assert.equal(record.changeSet.baseCanonicalRevision, changeSet.baseCanonicalRevision);
    assert.equal(record.changeSet.proposedCanonicalRevision, changeSet.proposedCanonicalRevision);
  }
  assert.deepEqual(await local.diff(localRecord.transactionId), await github.diff(githubRecord.transactionId));
  assert.deepEqual(await github.diff(githubRecord.transactionId), await objectStore.diff(objectRecord.transactionId));

  const core = await source("lib/creative-transactions/creative-transaction-contract.ts");
  assert.doesNotMatch(core, /GitHub|Versioned Object|S3|bucket|object key/i);
});
