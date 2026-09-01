import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createMaintainerKnowledgeStore } from "../build/autonomous-guest/maintainer/durable-knowledge-store.mjs";

const HEAD_A = "a".repeat(40);
const HEAD_B = "b".repeat(40);
const APPROVED_AT = "2026-09-01T14:00:00.000Z";

async function fixture() {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-maintainer-memory-"));
  return {
    root,
    store: () => createMaintainerKnowledgeStore({ root }),
    async close() { await rm(root, { recursive: true, force: true }); },
  };
}

function proposal(overrides = {}) {
  return Object.freeze({
    schemaVersion: 1,
    proposalId: "architecture-boundary-fact",
    dedupeKey: "maintainer-learning-architecture-boundary-v1",
    kind: "architecture-fact",
    summary: "Repository architecture inventory owns deterministic domain-boundary evidence for maintainer decisions.",
    exactCommitSha: HEAD_A,
    domain: "developer",
    evidence: Object.freeze([
      Object.freeze({ kind: "source", ref: "scripts/repository-architecture-inventory.mjs" }),
      Object.freeze({ kind: "test", ref: "tests/issue-1461-repository-architecture-inventory.test.mjs" }),
    ]),
    freshnessPaths: Object.freeze(["scripts/repository-architecture-inventory.mjs"]),
    applicabilityRefs: Object.freeze(["maintenance:architecture"]),
    exclusionRefs: Object.freeze(["task:story-only"]),
    skillId: "",
    createdAt: "2026-09-01T13:55:00.000Z",
    state: "observed",
    proposedBy: Object.freeze({
      authorityClass: "delegated-guest-autonomous-operator",
      autonomousRunId: "run-proposer",
      workspaceId: "guest-auto-1234567890abcdef12345678",
      operatorId: "maintainer-learner",
      humanProfileId: "",
    }),
    ...overrides,
  });
}

function approval(item, overrides = {}) {
  return Object.freeze({
    schemaVersion: 1,
    decisionId: `maintainer-approval-${item.proposalId}`,
    harnessApprovalRef: `harness-approval:maintainer-${item.proposalId}`,
    action: item.kind === "skill-proposal" ? "skill-version-promotion" : "durable-knowledge-admission",
    state: "approved",
    exactCommitSha: item.exactCommitSha,
    learningProposalId: item.proposalId,
    learningDedupeKey: item.dedupeKey,
    architectureSnapshotId: "maintainer-architecture-head-a",
    skillProposalId: item.kind === "skill-proposal" ? "skill-proposal-architecture-maintenance" : "",
    skillVersionKey: item.kind === "skill-proposal" ? "architecture-maintenance@1.1.0" : "",
    domain: item.domain,
    kind: item.kind,
    policy: Object.freeze({
      policyId: "maintainer-promotion",
      policyVersion: "1.0.0",
      policyRef: "policy:maintainer-promotion-v1",
    }),
    approvedBy: Object.freeze({
      authorityClass: "plotpickle-maintainer-harness-approver",
      serverOwned: true,
      approverId: "harness-policy-engine",
      humanProfileId: "",
    }),
    freshnessPaths: item.freshnessPaths,
    approvedAt: APPROVED_AT,
    durableAdmissionEligible: true,
    skillVersionPromotionEligible: item.kind === "skill-proposal",
    skillActivationEligible: item.kind === "skill-proposal",
    durablyAdmitted: false,
    operationalAuthorityGranted: false,
    aiSelfCertified: false,
    ...overrides,
  });
}

function skillProposal(item) {
  return Object.freeze({
    skillProposalId: "skill-proposal-architecture-maintenance",
    learningProposalId: item.proposalId,
    exactCommitSha: item.exactCommitSha,
    state: "observed",
    versionKey: "architecture-maintenance@1.1.0",
    skillActivationAllowed: false,
    operationalAuthorityGranted: false,
  });
}

test("#1592 Slice E admits only harness-approved concise knowledge and survives store restart", async () => {
  const setup = await fixture();
  try {
    let store = setup.store();
    const item = proposal();
    const admitted = await store.admit({ proposal: item, approval: approval(item) });
    assert.equal(admitted.state, "approved");
    assert.equal(admitted.version, 1);
    assert.equal(admitted.exactSourceCommitSha, HEAD_A);
    assert.equal(admitted.verifiedThroughCommitSha, HEAD_A);
    assert.equal(admitted.harnessApproverId, "harness-policy-engine");
    assert.equal(admitted.operationalAuthorityGranted, false);

    store = setup.store();
    const restarted = await store.list();
    assert.equal(restarted.length, 1);
    assert.equal(restarted[0].knowledgeId, item.proposalId);

    const source = await readFile(path.join(setup.root, "maintainer", "evidence-learning-memory.json"), "utf8");
    assert.doesNotMatch(source, /run-proposer|guest-auto-|maintainer-learner/);
    assert.doesNotMatch(source, /task-ledger|privateStoryText|hiddenReasoning/);
    assert.match(source, /harness-policy-engine/);
  } finally {
    await setup.close();
  }
});

test("#1592 Slice E deduplicates replayed learning across restart instead of creating a loop", async () => {
  const setup = await fixture();
  try {
    const item = proposal();
    await setup.store().admit({ proposal: item, approval: approval(item) });
    const duplicate = await setup.store().admit({ proposal: item, approval: approval(item) });
    assert.equal(duplicate.knowledgeId, item.proposalId);
    assert.equal(duplicate.version, 1);
    assert.equal((await setup.store().list()).length, 1);
  } finally {
    await setup.close();
  }
});

test("#1592 Slice E deterministically advances unaffected knowledge and persists affected knowledge as stale", async () => {
  const setup = await fixture();
  try {
    const architecture = proposal();
    const procedure = proposal({
      proposalId: "build-procedure",
      dedupeKey: "maintainer-learning-build-procedure-v1",
      kind: "operational-procedure",
      summary: "Production validation runs the repository build after focused maintainer contract tests pass.",
      freshnessPaths: Object.freeze(["package.json", "vite.config.ts"]),
      applicabilityRefs: Object.freeze(["maintenance:build"]),
    });
    const store = setup.store();
    await store.admit({ proposal: architecture, approval: approval(architecture) });
    await store.admit({ proposal: procedure, approval: approval(procedure) });

    await store.verifyFreshness({
      fromCommitSha: HEAD_A,
      toCommitSha: HEAD_B,
      changedPaths: ["scripts/repository-architecture-inventory.mjs", "docs/README.md"],
      verifiedAt: "2026-09-01T14:30:00.000Z",
    });

    const afterRestart = await setup.store().list();
    const stale = afterRestart.find((record) => record.knowledgeId === architecture.proposalId);
    const current = afterRestart.find((record) => record.knowledgeId === procedure.proposalId);
    assert.equal(stale.state, "stale");
    assert.equal(stale.staleByCommitSha, HEAD_B);
    assert.equal(current.state, "approved");
    assert.equal(current.verifiedThroughCommitSha, HEAD_B);
  } finally {
    await setup.close();
  }
});

test("#1592 Slice E retrieves only exact-head applicable approved knowledge for a bounded task", async () => {
  const setup = await fixture();
  try {
    const item = proposal();
    const store = setup.store();
    await store.admit({ proposal: item, approval: approval(item) });

    assert.deepEqual(await store.retrieveForTask({
      exactCommitSha: HEAD_A,
      domains: ["developer"],
      contextRefs: ["task:story-only", "maintenance:architecture"],
      maximumItems: 4,
    }), []);
    assert.deepEqual(await store.retrieveForTask({
      exactCommitSha: HEAD_B,
      domains: ["developer"],
      contextRefs: ["maintenance:architecture"],
      maximumItems: 4,
    }), []);
    const applicable = await store.retrieveForTask({
      exactCommitSha: HEAD_A,
      domains: ["developer"],
      contextRefs: ["maintenance:architecture"],
      maximumItems: 4,
    });
    assert.deepEqual(applicable.map((record) => record.knowledgeId), [item.proposalId]);
    assert.equal(applicable[0].operationalAuthorityGranted, false);
  } finally {
    await setup.close();
  }
});

test("#1592 Slice E keeps approved skill metadata dormant unless the bounded task explicitly permits that exact version", async () => {
  const setup = await fixture();
  try {
    const item = proposal({
      proposalId: "architecture-maintenance-skill",
      dedupeKey: "maintainer-learning-architecture-maintenance-skill-v1",
      kind: "skill-proposal",
      summary: "Architecture maintenance skill checks repository ownership evidence before suggesting bounded structural work.",
      skillId: "architecture-maintenance",
      applicabilityRefs: Object.freeze(["maintenance:architecture"]),
    });
    const governedSkill = skillProposal(item);
    const store = setup.store();
    const admitted = await store.admit({ proposal: item, approval: approval(item), skillProposal: governedSkill });
    assert.equal(admitted.skillVersionKey, "architecture-maintenance@1.1.0");
    assert.equal(admitted.skillActivated, false);

    const withoutPermission = await store.retrieveForTask({
      exactCommitSha: HEAD_A,
      domains: ["developer"],
      contextRefs: ["maintenance:architecture"],
      allowedSkillVersionKeys: [],
      maximumItems: 4,
    });
    assert.deepEqual(withoutPermission, []);

    const permitted = await store.retrieveForTask({
      exactCommitSha: HEAD_A,
      domains: ["developer"],
      contextRefs: ["maintenance:architecture"],
      allowedSkillVersionKeys: ["architecture-maintenance@1.1.0"],
      maximumItems: 4,
    });
    assert.equal(permitted.length, 1);
    assert.equal(permitted[0].skillActivated, false);
    assert.equal(permitted[0].operationalAuthorityGranted, false);
  } finally {
    await setup.close();
  }
});

test("#1592 Slice E fails closed on forged approval, unsafe durable text and unbounded retrieval", async () => {
  const setup = await fixture();
  try {
    const item = proposal();
    await assert.rejects(
      setup.store().admit({ proposal: item, approval: approval(item, { approvedBy: { authorityClass: "delegated-guest-autonomous-operator", serverOwned: false } }) }),
      /server-owned harness approval/,
    );
    const unsafe = proposal({
      proposalId: "unsafe-memory",
      dedupeKey: "unsafe-memory-v1",
      summary: "Remember password=super-secret-password-value because the model said this credential should persist.",
    });
    await assert.rejects(setup.store().admit({ proposal: unsafe, approval: approval(unsafe) }), /unsafe/);
    await assert.rejects(setup.store().retrieveForTask({
      exactCommitSha: HEAD_A,
      domains: ["developer"],
      maximumItems: 100,
    }), /between 1 and 32/);
  } finally {
    await setup.close();
  }
});
