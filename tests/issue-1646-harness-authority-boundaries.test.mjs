import assert from "node:assert/strict";
import test from "node:test";

import {
  PLOTPICKLE_HARNESS_APPROVER_AUTHORITY_CLASS,
  PLOTPICKLE_LIFECYCLE_AUTHORITY_ACTIONS,
  decideLifecycleAuthority,
  lifecycleActorAuthorityProjection,
} from "../core/lifecycle/lifecycle-authority.mjs";

function base(overrides = {}) {
  return {
    schemaVersion: 1,
    runId: "run-authority-001",
    projectId: "project-afterglow",
    revision: "12",
    stage: "approve-persist",
    priorTransition: { from: "validate-repair", to: "approve-persist", at: "2026-09-03T12:00:00.000Z", reasonRef: "verification:pass" },
    actor: {
      actorId: "guest-reference",
      kind: "guest",
      authorityClass: "delegated-guest-autonomous-operator",
      delegated: true,
      humanProfileId: "",
      operatorId: "plotpickle-autonomous-reference",
      authorityRef: "authority:autonomous-guest/run-authority-001",
    },
    intent: { kind: "story-run", ref: "intent:afterglow-reference" },
    planOrDecisionRefs: ["decision:afterglow-reference"],
    capabilities: ["route:story-workflow", "route:visual-production"],
    contextRefs: ["ppf:project-afterglow@12"],
    inputRefs: ["working-copy:afterglow"],
    outputRefs: ["candidate:afterglow"],
    evidenceRefs: ["evidence:verification", "evidence:story-workflow"],
    integrationRefs: [],
    contractRefs: [
      "guest-authority:core/auth/autonomous-guest/guest-authority.ts",
      "ppf-revision:lib/projects/persistence/project-revisions.ts",
      "durable-learning:build/autonomous-guest/maintainer/durable-knowledge-store.mjs",
    ],
    validation: { result: "pass", authorityRef: "verification:exact-head", evidenceRefs: ["evidence:verification"] },
    repairBudget: { attempts: 0, maxAttempts: 2 },
    persistence: {
      classification: "durable-non-canon",
      ownerRef: "guest-task:ledger",
      decision: "approved",
      approvalRef: "policy:guest-run",
    },
    stopReason: { code: "", detailRef: "" },
    nextAction: { action: "package", ref: "lifecycle:package-present-continue", continuationRef: "guest-task:afterglow" },
    ...overrides,
  };
}

function humanEnvelope(persistence) {
  return base({
    actor: {
      actorId: "writer-1",
      kind: "human",
      authorityClass: "writer",
      delegated: false,
      humanProfileId: "profile-writer-1",
      operatorId: "",
      authorityRef: "profile:writer-1",
    },
    persistence,
  });
}

test("#1646 exposes one bounded authority action vocabulary without granting actors self-promotion", () => {
  assert.deepEqual(PLOTPICKLE_LIFECYCLE_AUTHORITY_ACTIONS, [
    "observe", "propose", "execute", "use-evidence", "transition", "persist", "continue", "change-authority",
  ]);
  const projection = lifecycleActorAuthorityProjection(base());
  assert.equal(projection.actorKind, "guest");
  assert.equal(projection.mayObserve, true);
  assert.equal(projection.mayPropose, true);
  assert.equal(projection.mayExecuteBoundedCapabilities, true);
  assert.equal(projection.mayApproveOwnDurableLearning, false);
  assert.equal(projection.mayChangeOwnAuthority, false);
  assert.equal(projection.mayClaimHumanApproval, false);
  assert.equal(projection.canonicalMutationRequiresExistingApprovalRoute, true);
  assert.equal(projection.canonicalMutationRequiresHumanWriterApproval, false);
  assert.equal(projection.canonicalMutationMayUseDelegatedWorkbenchPolicy, true);
  assert.equal(projection.durableKnowledgeRequiresHarnessPolicyApproval, true);
});

test("#1646 lets Human Guest agent and system actors observe/propose while execution remains capability-bounded", () => {
  for (const actor of [
    base().actor,
    humanEnvelope(base().persistence).actor,
    { actorId: "sage", kind: "agent", authorityClass: "bounded-agent-worker", delegated: false, humanProfileId: "", operatorId: "sage", authorityRef: "authority:sage" },
    { actorId: "verification", kind: "system", authorityClass: "authoritative-system", delegated: false, humanProfileId: "", operatorId: "verification", authorityRef: "authority:verification" },
  ]) {
    const envelope = base({ actor });
    assert.equal(decideLifecycleAuthority({ envelope, action: "observe" }).allowed, true);
    assert.equal(decideLifecycleAuthority({ envelope, action: "propose" }).allowed, true);
    assert.equal(decideLifecycleAuthority({ envelope, action: "execute", capabilityRef: "route:story-workflow" }).allowed, true);
    const denied = decideLifecycleAuthority({ envelope, action: "execute", capabilityRef: "route:not-delegated" });
    assert.equal(denied.allowed, false);
    assert.equal(denied.code, "capability-not-delegated");
  }
});

test("#1646 allows evidence to influence reasoning without silently becoming durable knowledge or authority", () => {
  const allowed = decideLifecycleAuthority({ envelope: base(), action: "use-evidence", evidenceRef: "evidence:story-workflow" });
  assert.equal(allowed.allowed, true);
  assert.equal(allowed.code, "evidence-reasoning-only");
  assert.equal(allowed.durableKnowledgeGranted, false);
  assert.equal(allowed.operationalAuthorityGranted, false);

  const denied = decideLifecycleAuthority({ envelope: base(), action: "use-evidence", evidenceRef: "evidence:not-in-run" });
  assert.equal(denied.allowed, false);
  assert.equal(denied.code, "evidence-not-in-run-context");
});

test("#1646 requires server-owned harness policy approval before evidence becomes durable knowledge", () => {
  const envelope = base({
    persistence: {
      classification: "durable-knowledge",
      ownerRef: "maintainer:evidence-learning-memory",
      decision: "approved",
      approvalRef: "approval:maintainer-policy-001",
    },
  });

  const selfApproved = decideLifecycleAuthority({
    envelope,
    action: "persist",
    approval: {
      kind: "harness-policy",
      authorityClass: "delegated-guest-autonomous-operator",
      serverOwned: false,
      humanProfileId: "",
      approvalRef: "approval:maintainer-policy-001",
    },
  });
  assert.equal(selfApproved.allowed, false);
  assert.equal(selfApproved.code, "harness-policy-approval-required");

  const approved = decideLifecycleAuthority({
    envelope,
    action: "persist",
    approval: {
      kind: "harness-policy",
      authorityClass: PLOTPICKLE_HARNESS_APPROVER_AUTHORITY_CLASS,
      serverOwned: true,
      humanProfileId: "",
      approvalRef: "approval:maintainer-policy-001",
    },
  });
  assert.equal(approved.allowed, true);
  assert.equal(approved.autonomousPolicyApproved, true);
  assert.equal(approved.humanApproved, false);
  assert.equal(approved.operationalAuthorityGranted, false);
});

test("#1646 keeps the explicit Human writer route distinct and prevents Guest impersonation", () => {
  const persistence = {
    classification: "canonical-project-state",
    ownerRef: "ppf:revision-store",
    decision: "approved",
    approvalRef: "writer-approval:123",
  };

  const guestDenied = decideLifecycleAuthority({
    envelope: base({ persistence }),
    action: "persist",
    approval: { kind: "human-writer", humanProfileId: "profile-writer-1", approvalRef: "writer-approval:123" },
  });
  assert.equal(guestDenied.allowed, false);
  assert.equal(guestDenied.code, "canonical-persistence-approval-required");

  const wrongHuman = decideLifecycleAuthority({
    envelope: humanEnvelope(persistence),
    action: "persist",
    approval: { kind: "human-writer", humanProfileId: "profile-other", approvalRef: "writer-approval:123" },
  });
  assert.equal(wrongHuman.allowed, false);

  const writerApproved = decideLifecycleAuthority({
    envelope: humanEnvelope(persistence),
    action: "persist",
    approval: { kind: "human-writer", humanProfileId: "profile-writer-1", approvalRef: "writer-approval:123" },
  });
  assert.equal(writerApproved.allowed, true);
  assert.equal(writerApproved.humanApproved, true);
  assert.equal(writerApproved.autonomousPolicyApproved, false);
  assert.equal(writerApproved.persistenceOwnerRef, "ppf:revision-store");
});

test("#1646 permits policy-approved autonomous non-canon persistence without pretending it is Human approval", () => {
  const result = decideLifecycleAuthority({ envelope: base(), action: "persist" });
  assert.equal(result.allowed, true);
  assert.equal(result.code, "existing-owner-persistence");
  assert.equal(result.humanApproved, false);
  assert.equal(result.autonomousPolicyApproved, false);
  assert.equal(result.persistenceClass, "durable-non-canon");
});

test("#1646 prevents reconnect/resume from leaking or elevating authority", () => {
  const envelope = base();
  const exactResume = decideLifecycleAuthority({ envelope, action: "continue", resumeActor: envelope.actor });
  assert.equal(exactResume.allowed, true);
  assert.equal(exactResume.continuationRef, "guest-task:afterglow");

  for (const resumeActor of [
    { ...envelope.actor, authorityClass: "writer" },
    { ...envelope.actor, kind: "human", humanProfileId: "profile-writer-1" },
    { ...envelope.actor, operatorId: "different-operator" },
  ]) {
    const denied = decideLifecycleAuthority({ envelope, action: "continue", resumeActor });
    assert.equal(denied.allowed, false);
    assert.equal(denied.code, "resume-authority-mismatch");
  }
});

test("#1646 denies actor-controlled authority changes and stops repair-loop re-entry when its budget is exhausted", () => {
  const change = decideLifecycleAuthority({ envelope: base(), action: "change-authority" });
  assert.equal(change.allowed, false);
  assert.equal(change.code, "authority-change-not-self-service");
  assert.equal(change.operationalAuthorityGranted, false);

  const repairing = base({
    stage: "validate-repair",
    priorTransition: { from: "create-execute", to: "validate-repair", at: "", reasonRef: "verification:fail" },
    validation: { result: "fail", authorityRef: "verification:exact-head", evidenceRefs: ["evidence:verification"] },
    repairBudget: { attempts: 2, maxAttempts: 2 },
  });
  const denied = decideLifecycleAuthority({ envelope: repairing, action: "transition", toStage: "create-execute" });
  assert.equal(denied.allowed, false);
  assert.equal(denied.code, "repair-budget-exhausted");
  assert.equal(denied.repairAttempts, 2);
  assert.equal(denied.repairMaxAttempts, 2);
});