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

async function providerModules() {
  const contract = await contractModule();
  const typescript = await source("lib/creative-transactions/local-creative-transaction-provider.ts");
  const compiled = stripTypeScriptTypes(typescript, { mode: "transform" });
  const runnable = compiled.replace(
    /import\s*\{\s*CREATIVE_TRANSACTION_CONTRACT_VERSION,\s*LOCAL_CREATIVE_TRANSACTION_PROVIDER,\s*creativeChangeSetFingerprint,\s*creativeTransactionVerificationComplete,\s*providerSupportsCapabilities\s*\}\s*from\s*["']\.\/creative-transaction-contract["'];?/,
    "const { CREATIVE_TRANSACTION_CONTRACT_VERSION, LOCAL_CREATIVE_TRANSACTION_PROVIDER, creativeChangeSetFingerprint, creativeTransactionVerificationComplete, providerSupportsCapabilities } = globalThis.__plotpickleCreativeTransactionContract;",
  );
  assert.notEqual(runnable, compiled, "Expected local provider contract import to be isolated for runtime tests");
  globalThis.__plotpickleCreativeTransactionContract = contract;
  const provider = await import(`data:text/javascript;base64,${Buffer.from(runnable).toString("base64")}#provider-${Date.now()}-${Math.random()}`);
  return { contract, provider };
}

async function githubProviderModules() {
  const contract = await contractModule();
  const typescript = await source("lib/creative-transactions/github-creative-transaction-provider.ts");
  const compiled = stripTypeScriptTypes(typescript, { mode: "transform" });
  const runnable = compiled.replace(
    /import\s*\{[\s\S]*?\}\s*from\s*["']\.\/creative-transaction-contract["'];?/,
    "const { CREATIVE_TRANSACTION_CONTRACT_VERSION, creativeTransactionVerificationComplete, providerSupportsCapabilities } = globalThis.__plotpickleCreativeTransactionContract;",
  );
  assert.notEqual(runnable, compiled, "Expected GitHub provider contract import to be isolated for runtime tests");
  globalThis.__plotpickleCreativeTransactionContract = contract;
  const provider = await import(`data:text/javascript;base64,${Buffer.from(runnable).toString("base64")}#github-provider-${Date.now()}-${Math.random()}`);
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

  const verified = await local.verify(created.transactionId, passingEvidence());
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

test("#2039 GitHub is an optional external provider while Local remains the default canonical route", async () => {
  const { contract, provider } = await githubProviderModules();
  const descriptor = provider.GITHUB_CREATIVE_TRANSACTION_PROVIDER;
  assert.equal(descriptor.kind, "external");
  assert.ok(descriptor.capabilities.includes("remote"));
  assert.ok(!descriptor.capabilities.includes("offline"));
  assert.ok(!descriptor.capabilities.includes("atomic-commit"));
  assert.ok(!descriptor.capabilities.includes("rollback"));

  const automatic = contract.resolveCreativeTransactionProvider(
    [descriptor, contract.LOCAL_CREATIVE_TRANSACTION_PROVIDER],
    contract.CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES,
  );
  assert.equal(automatic.id, "plotpickle-local");

  const explicit = contract.resolveCreativeTransactionProvider(
    [descriptor, contract.LOCAL_CREATIVE_TRANSACTION_PROVIDER],
    contract.CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES,
    { preferredProviderId: descriptor.id },
  );
  assert.equal(explicit.id, descriptor.id);

  assert.throws(
    () => contract.resolveCreativeTransactionProvider(
      [descriptor, contract.LOCAL_CREATIVE_TRANSACTION_PROVIDER],
      ["offline"],
      { preferredProviderId: descriptor.id },
    ),
    /No silent fallback was used/,
  );
});

test("#2039 GitHub adapter completes a deterministic external review and durable commit without becoming PPF canon", async () => {
  const { contract, provider } = await githubProviderModules();
  const store = new provider.MemoryGitHubCreativeTransactionStore();
  let remoteState = "open";
  let durableRevisionId = "";
  const calls = [];
  const bridge = {
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
    async declineProposal(input) { calls.push(["decline", input.providerTransactionId]); remoteState = "declined"; },
  };
  const github = provider.createGitHubCreativeTransactionProvider(store, bridge);
  const changeSet = contract.createCreativeChangeSet(changeInput({ changeSetId: "change-2039" }));
  const created = await github.create(changeSet);
  await github.stage(created.transactionId, ["project/storyboard/mini-07-02.json"]);
  await github.verify(created.transactionId, passingEvidence());
  const reviewing = await github.requestReview(created.transactionId);
  assert.equal(reviewing.state, "awaiting-review");
  assert.equal(reviewing.changeSet.transaction.providerId, "github-story-proposals");
  assert.equal(reviewing.changeSet.transaction.transactionId, "42");
  assert.equal(reviewing.changeSet.transaction.durableRevisionId, "");
  assert.equal(reviewing.changeSet.context, null, "Provider metadata must not be smuggled into Context provenance");

  await github.accept(created.transactionId, { writerId: "writer-2039", note: "Approve complete change set.", decidedAt: "2026-09-14T13:40:00.000Z" });
  const committed = await github.commit(created.transactionId);
  assert.equal(committed.state, "committed");
  assert.equal(committed.durableRevisionId, "github-approved-42");
  assert.equal(committed.changeSet.transaction.durableRevisionId, "github-approved-42");
  assert.deepEqual(calls[0], ["create", "change-2039", ["project/storyboard/mini-07-02.json"]]);
  assert.deepEqual(calls[1], ["commit", "42", "writer-2039"]);

  const reconciled = await github.reconcile(created.transactionId);
  assert.equal(reconciled.state, "committed");
  assert.equal(reconciled.authoritative, true);
  assert.equal(reconciled.durableRevisionId, "github-approved-42");

  const ppfBridge = await source("lib/creative-transactions/creative-transaction-project-bridge.ts");
  assert.match(ppfBridge, /Only a durable committed Creative Transaction can propose PPF canon admission/);
  assert.match(ppfBridge, /explicit Human acceptance/);
  assert.match(ppfBridge, /applyWriterApprovedCanonicalProposal/);
});

test("#2039 GitHub reconciliation fails closed on unavailable state and detects provider-commit acknowledgement gaps", async () => {
  const { contract, provider } = await githubProviderModules();
  const store = new provider.MemoryGitHubCreativeTransactionStore();
  let remote = { state: "open", durableRevisionId: "", summary: "open" };
  const bridge = {
    async createProposal() { return { providerTransactionId: "77", reviewRef: "review/77", baseRevisionId: "base-77", proposedRevisionId: "head-77" }; },
    async inspectProposal() { return remote; },
    async commitApprovedProposal() { return { durableRevisionId: "approved-77" }; },
    async declineProposal() {},
  };
  const github = provider.createGitHubCreativeTransactionProvider(store, bridge);
  const changeSet = contract.createCreativeChangeSet(changeInput({ changeSetId: "change-reconcile-2039" }));
  const created = await github.create(changeSet);
  await github.stage(created.transactionId, ["project/story.json"]);
  await github.verify(created.transactionId, passingEvidence());
  await github.requestReview(created.transactionId);

  remote = { state: "unavailable", durableRevisionId: "", summary: "network unavailable" };
  const unavailable = await github.reconcile(created.transactionId);
  assert.equal(unavailable.state, "unknown");
  assert.equal(unavailable.authoritative, false);
  assert.match(unavailable.summary, /network unavailable/);

  await github.accept(created.transactionId, { writerId: "writer-2039", note: "accept", decidedAt: "2026-09-14T13:41:00.000Z" });
  await assert.rejects(() => github.commit(created.transactionId), /cannot commit while provider state is unavailable/);

  remote = { state: "committed", durableRevisionId: "", summary: "provider committed but exact receipt was not acknowledged locally" };
  const gap = await github.reconcile(created.transactionId);
  assert.equal(gap.state, "committed");
  assert.equal(gap.durableRevisionId, "");
  assert.equal(gap.authoritative, false);
});

test("#2039 concrete GitHub bridge reuses the existing local Story Proposal gateway instead of duplicating GitHub transport", async () => {
  const [bridge, gateway, contract] = await Promise.all([
    source("build/github-creative-transaction-bridge.ts"),
    source("build/github-review-gateway.ts"),
    source("lib/creative-transactions/creative-transaction-contract.ts"),
  ]);
  for (const endpoint of ["submit-proposal", "proposals", "proposal-review", "approve-proposal", "decline-proposal"]) assert.match(bridge, new RegExp(endpoint));
  assert.doesNotMatch(bridge, /api\.github\.com|Authorization:|Bearer\s/);
  assert.match(gateway, /expectedBaseCommit/);
  assert.match(gateway, /force: false/);
  assert.match(gateway, /safeManagedDeletionPath/);
  assert.doesNotMatch(contract, /GitHub|pull request|GitHub Actions|branch protection/i);
});
