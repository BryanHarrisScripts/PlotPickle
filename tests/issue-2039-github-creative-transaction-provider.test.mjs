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

async function providerModule() {
  const contract = await contractModule();
  const typescript = await source("lib/integrations/github/github-creative-transaction-provider.ts");
  const compiled = stripTypeScriptTypes(typescript, { mode: "transform" });
  const runnable = compiled.replace(
    /import \{[\s\S]*?\} from "\.\.\/\.\.\/creative-transactions\/creative-transaction-contract";/,
    "const { CREATIVE_TRANSACTION_CONTRACT_VERSION, creativeChangeSetFingerprint, creativeTransactionVerificationComplete, providerSupportsCapabilities } = globalThis.__plotpickleCreativeTransactionContract;",
  );
  assert.notEqual(runnable, compiled, "Expected GitHub adapter contract import to be isolated for runtime tests");
  globalThis.__plotpickleCreativeTransactionContract = contract;
  const provider = await import(`data:text/javascript;base64,${Buffer.from(runnable).toString("base64")}#github-provider-${Date.now()}-${Math.random()}`);
  return { contract, provider };
}

class MemoryRecordStore {
  records = new Map();
  async load(id) { return this.records.has(id) ? structuredClone(this.records.get(id)) : null; }
  async save(record) { this.records.set(record.transactionId, structuredClone(record)); }
  async list(projectId) { return [...this.records.values()].filter((record) => !projectId || record.changeSet.projectId === projectId).map(structuredClone); }
}

function changeInput(overrides = {}) {
  return {
    changeSetId: "change-2039",
    projectId: "project-2039",
    baseCanonicalRevision: 12,
    affectedIds: ["block-07"],
    changes: [{
      area: "storyboard",
      targetIds: ["block-07"],
      summary: "Revise approved visual progression.",
      beforeFingerprint: "before-2039",
      afterFingerprint: "after-2039",
    }],
    requiredCapabilities: ["durable-revision", "verification", "human-review", "recovery"],
    verificationRequirements: [{ id: "ppf-fresh", label: "PPF revision is current", authority: "plotpickle", blocking: true }],
    createdAt: "2026-09-14T13:30:00.000Z",
    ...overrides,
  };
}

function verification() {
  return [{
    requirementId: "ppf-fresh",
    authority: "plotpickle",
    result: "PASS",
    evidenceRef: "verification/ppf-fresh.json",
    summary: "Revision remains current.",
    recordedAt: "2026-09-14T13:31:00.000Z",
  }];
}

function mockBackend() {
  let state = "open";
  let approvedRevision = "";
  const calls = [];
  return {
    calls,
    setState(value) { state = value; },
    async stage(input) {
      calls.push(["stage", input]);
      return { proposalNumber: 239, proposalUrl: "https://example.invalid/proposal/239", baseRevision: input.expectedBaseRevision, headRevision: "head-2039" };
    },
    async review(number) {
      calls.push(["review", number]);
      return { proposalNumber: number, state, baseRevision: "remote-base-2039", headRevision: "head-2039", proposalUrl: "https://example.invalid/proposal/239", groupIds: ["story", "review"] };
    },
    async approve(input) {
      calls.push(["approve", input]);
      state = "approved";
      approvedRevision = "approved-commit-2039";
      return { durableRevisionId: approvedRevision };
    },
    async decline(input) {
      calls.push(["decline", input]);
      state = "declined";
    },
    async snapshot(number) {
      calls.push(["snapshot", number]);
      return { proposalNumber: number, state, baseRevision: "remote-base-2039", headRevision: "head-2039", proposalUrl: "https://example.invalid/proposal/239", approvedRevision };
    },
  };
}

test("#2039 keeps GitHub external while Local remains the provider-neutral default", async () => {
  const { contract, provider } = await providerModule();
  assert.equal(provider.GITHUB_CREATIVE_TRANSACTION_PROVIDER.kind, "external");
  assert.equal(provider.GITHUB_CREATIVE_TRANSACTION_PROVIDER.transport, "rest");
  assert.ok(provider.GITHUB_CREATIVE_TRANSACTION_PROVIDER.capabilities.includes("remote"));
  for (const capability of ["offline", "atomic-commit", "rollback"]) {
    assert.ok(!provider.GITHUB_CREATIVE_TRANSACTION_PROVIDER.capabilities.includes(capability), `GitHub must not overclaim ${capability}`);
  }
  const required = contract.CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES;
  const defaultProvider = contract.resolveCreativeTransactionProvider([
    provider.GITHUB_CREATIVE_TRANSACTION_PROVIDER,
    contract.LOCAL_CREATIVE_TRANSACTION_PROVIDER,
  ], required);
  assert.equal(defaultProvider.id, "plotpickle-local");
  const explicit = contract.resolveCreativeTransactionProvider([
    contract.LOCAL_CREATIVE_TRANSACTION_PROVIDER,
    provider.GITHUB_CREATIVE_TRANSACTION_PROVIDER,
  ], required, { preferredProviderId: "github-story-proposals" });
  assert.equal(explicit.id, "github-story-proposals");
});

test("#2039 maps one Change Set through stage → verify → Human review → existing Story Proposal approval", async () => {
  const { contract, provider } = await providerModule();
  const store = new MemoryRecordStore();
  const bindings = new provider.MemoryGitHubCreativeTransactionBindingStore();
  const backend = mockBackend();
  const project = { id: "project-2039", metadata: { title: "Fixture Story" } };
  const github = provider.createGitHubCreativeTransactionProvider({
    store,
    bindings,
    backend,
    async resolveProject() { return { project, expectedRemoteRevision: "remote-base-2039" }; },
  });
  const changeSet = contract.createCreativeChangeSet(changeInput());
  const created = await github.create(changeSet);
  assert.equal(created.state, "created");
  const staged = await github.stage(created.transactionId, ["project/storyboard/block-07.json"]);
  assert.equal(staged.state, "staged");
  const binding = await bindings.load(created.transactionId);
  assert.equal(binding.proposalNumber, 239);
  assert.equal(binding.changeSetFingerprint, contract.creativeChangeSetFingerprint(changeSet));
  const verified = await github.verify(created.transactionId, verification());
  assert.equal(verified.state, "verified");
  assert.equal((await github.requestReview(created.transactionId)).state, "awaiting-review");
  const accepted = await github.accept(created.transactionId, { writerId: "writer-2039", note: "Accept complete Change Set.", decidedAt: "2026-09-14T13:32:00.000Z" });
  assert.equal(accepted.state, "approved");
  assert.equal(backend.calls.filter(([name]) => name === "approve").length, 0, "Human acceptance must not mutate the approved GitHub branch yet");
  const committed = await github.commit(created.transactionId);
  assert.equal(committed.state, "committed");
  assert.equal(committed.durableRevisionId, "approved-commit-2039");
  assert.equal(committed.changeSet.transaction.durableRevisionId, "approved-commit-2039");
  const approval = backend.calls.find(([name]) => name === "approve")[1];
  assert.deepEqual(approval.selectedGroups, ["story", "review"]);
  assert.equal(approval.expectedBaseRevision, "remote-base-2039");
  const reconciled = await github.reconcile(created.transactionId);
  assert.equal(reconciled.state, "committed");
  assert.equal(reconciled.durableRevisionId, "approved-commit-2039");
});

test("#2039 fails closed for remote drift and provider-commit/acknowledgement gaps", async () => {
  const { contract, provider } = await providerModule();
  const store = new MemoryRecordStore();
  const bindings = new provider.MemoryGitHubCreativeTransactionBindingStore();
  const backend = mockBackend();
  const github = provider.createGitHubCreativeTransactionProvider({
    store,
    bindings,
    backend,
    async resolveProject() { return { project: { id: "project-2039", metadata: { title: "Fixture Story" } }, expectedRemoteRevision: "remote-base-2039" }; },
  });
  const created = await github.create(contract.createCreativeChangeSet(changeInput({ changeSetId: "gap-2039" })));
  await github.stage(created.transactionId, []);
  backend.review = async (number) => ({ proposalNumber: number, state: "open", baseRevision: "remote-base-2039", headRevision: "changed-outside-transaction", proposalUrl: "", groupIds: ["story"] });
  const drifted = await github.verify(created.transactionId, verification());
  assert.equal(drifted.state, "revising");
  assert.match(drifted.error, /changed outside this transaction/);

  const gapStore = new MemoryRecordStore();
  const gapBindings = new provider.MemoryGitHubCreativeTransactionBindingStore();
  const gapBackend = mockBackend();
  const gap = provider.createGitHubCreativeTransactionProvider({
    store: gapStore,
    bindings: gapBindings,
    backend: gapBackend,
    async resolveProject() { return { project: { id: "project-2039", metadata: { title: "Fixture Story" } }, expectedRemoteRevision: "remote-base-2039" }; },
  });
  const gapCreated = await gap.create(contract.createCreativeChangeSet(changeInput({ changeSetId: "ack-gap-2039" })));
  await gap.stage(gapCreated.transactionId, []);
  gapBackend.setState("approved");
  const reconciled = await gap.reconcile(gapCreated.transactionId);
  assert.equal(reconciled.state, "unknown");
  assert.equal(reconciled.authoritative, false);
  assert.match(reconciled.summary, /acknowledgement gap/);
});

test("#2039 reuses the existing local Story Proposal gateway rather than creating a second GitHub client", async () => {
  const { provider } = await providerModule();
  const calls = [];
  const responses = [
    { ok: true, pullRequestNumber: 239, pullRequestUrl: "https://example.invalid/239", baseRevision: "base-sha", commitSha: "head-sha" },
    { ok: true, proposal: { number: 239, state: "open", url: "https://example.invalid/239" }, baseCommit: "base-sha", headCommit: "head-sha", groups: [{ id: "story" }] },
    { ok: true, proposalNumber: 239, remoteCommit: "approved-sha" },
  ];
  const fetcher = async (url, init = {}) => {
    calls.push({ url, init, body: init.body ? JSON.parse(init.body) : null });
    const payload = responses.shift();
    return { ok: true, status: 200, async json() { return payload; } };
  };
  const backend = provider.createGitHubReviewGatewayBackend(fetcher);
  const staged = await backend.stage({ project: { id: "project-2039" }, title: "Creative Change", note: "Bounded note", expectedBaseRevision: "base-sha", requestedAssets: [] });
  assert.equal(staged.proposalNumber, 239);
  const review = await backend.review(239);
  assert.deepEqual(review.groupIds, ["story"]);
  const approved = await backend.approve({ proposalNumber: 239, selectedGroups: ["story"], expectedBaseRevision: "base-sha" });
  assert.equal(approved.durableRevisionId, "approved-sha");
  assert.deepEqual(calls.map((call) => call.url), [
    "/api/local-github/submit-proposal",
    "/api/local-github/proposal-review?number=239",
    "/api/local-github/approve-proposal",
  ]);
  assert.equal(calls[0].body.baseRevision, "base-sha", "Adapter must use the existing #152 gateway request contract");
  assert.deepEqual(calls[0].body.assetFiles, []);
  assert.equal(calls[2].body.expectedBaseCommit, "base-sha");
});

test("#2039 source boundaries preserve provider neutrality, local security and existing GitHub ownership", async () => {
  const [contract, adapter, gateway, bindingStore] = await Promise.all([
    source("lib/creative-transactions/creative-transaction-contract.ts"),
    source("lib/integrations/github/github-creative-transaction-provider.ts"),
    source("build/github-review-gateway.ts"),
    source("build/github-creative-transaction-binding-store.ts"),
  ]);
  assert.doesNotMatch(contract, /GitHub|pull request|Story Proposal|api\.github\.com/i);
  assert.doesNotMatch(adapter, /https:\/\/api\.github\.com/);
  assert.match(adapter, /\/api\/local-github/);
  assert.match(adapter, /#150\/#152 remain the Git\/GitHub wheelhouse/);
  for (const path of ["submit-proposal", "proposal-review", "approve-proposal", "decline-proposal", "proposals"]) assert.match(gateway, new RegExp(path));
  assert.match(gateway, /isLocalRequest/);
  assert.match(gateway, /expectedBaseCommit/);
  assert.match(bindingStore, /persistentHome\(\)/);
  assert.match(bindingStore, /containsCredentials: false/);
  assert.match(bindingStore, /canonicalAuthority: false/);
  assert.doesNotMatch(bindingStore, /fetch\(|https?:\/\//);
});
