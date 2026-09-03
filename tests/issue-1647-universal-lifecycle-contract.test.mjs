import assert from "node:assert/strict";
import test from "node:test";

import {
  PLOTPICKLE_LIFECYCLE_FIELD_OWNERS,
  PLOTPICKLE_LIFECYCLE_SCHEMA_VERSION,
  PLOTPICKLE_LIFECYCLE_STAGES,
  PLOTPICKLE_LIFECYCLE_TRANSITIONS,
  PLOTPICKLE_LIFECYCLE_VERSION_POLICY,
  allowedLifecycleTransitions,
  normalizeLifecycleEnvelope,
  transitionLifecycleEnvelope,
  validateLifecycleTransition,
} from "../core/lifecycle/lifecycle-contract.mjs";

const STAGES = [
  "enter-understand",
  "learn-prepare",
  "plan-decide",
  "create-execute",
  "validate-repair",
  "approve-persist",
  "package-present-continue",
];

function base(overrides = {}) {
  return {
    schemaVersion: 1,
    runId: "run-afterglow-001",
    projectId: "project-afterglow",
    revision: "12",
    stage: "enter-understand",
    priorTransition: null,
    actor: {
      actorId: "guest-reference",
      kind: "guest",
      authorityClass: "delegated-guest-autonomous-operator",
      delegated: true,
      humanProfileId: "",
      operatorId: "plotpickle-autonomous-reference",
      authorityRef: "authority:autonomous-guest/run-afterglow-001",
    },
    intent: { kind: "story-run", ref: "intent:afterglow-reference" },
    planOrDecisionRefs: ["decision:afterglow-reference"],
    capabilities: ["route:library", "route:learn"],
    contextRefs: ["ppf:project-afterglow@12"],
    inputRefs: ["working-copy:afterglow"],
    outputRefs: [],
    evidenceRefs: ["evidence:bootstrap"],
    integrationRefs: [],
    contractRefs: [
      "guest-authority:core/auth/autonomous-guest/guest-authority.ts",
      "guest-task:build/autonomous-guest/task-lifecycle.ts",
      "responsibility-run:lib/agents/responsibility/responsibility-runs.ts",
      "ppf-revision:lib/projects/persistence/project-revisions.ts",
      "verification:scripts/full-verification-graph.mjs",
    ],
    validation: { result: "not-run", authorityRef: "", evidenceRefs: [] },
    repairBudget: { attempts: 0, maxAttempts: 2 },
    persistence: { classification: "durable-non-canon", ownerRef: "guest-task:ledger", decision: "approved", approvalRef: "policy:guest-run" },
    stopReason: { code: "", detailRef: "" },
    nextAction: { action: "prepare", ref: "lifecycle:learn-prepare", continuationRef: "guest-task:library" },
    ...overrides,
  };
}

test("#1647 defines one versioned seven-stage contract with deterministic transition vocabulary", () => {
  assert.equal(PLOTPICKLE_LIFECYCLE_SCHEMA_VERSION, 1);
  assert.deepEqual(PLOTPICKLE_LIFECYCLE_STAGES, STAGES);
  assert.equal(PLOTPICKLE_LIFECYCLE_VERSION_POLICY.currentVersion, 1);
  assert.deepEqual(PLOTPICKLE_LIFECYCLE_VERSION_POLICY.supportedVersions, [1]);
  assert.deepEqual(PLOTPICKLE_LIFECYCLE_TRANSITIONS["validate-repair"], ["create-execute", "approve-persist"]);
  assert.deepEqual(PLOTPICKLE_LIFECYCLE_TRANSITIONS["package-present-continue"], []);
});

test("#1647 assigns lifecycle field ownership across all six domains without moving subsystem authority", () => {
  const owners = new Set(Object.values(PLOTPICKLE_LIFECYCLE_FIELD_OWNERS));
  assert.deepEqual([...owners].sort(), ["community-integrations", "core", "experience", "intelligence", "platform", "story"]);
  assert.equal(PLOTPICKLE_LIFECYCLE_FIELD_OWNERS.actorAuthority, "core");
  assert.equal(PLOTPICKLE_LIFECYCLE_FIELD_OWNERS.intentPlan, "story");
  assert.equal(PLOTPICKLE_LIFECYCLE_FIELD_OWNERS.capabilities, "intelligence");
  assert.equal(PLOTPICKLE_LIFECYCLE_FIELD_OWNERS.integrationRefs, "community-integrations");
  assert.equal(PLOTPICKLE_LIFECYCLE_FIELD_OWNERS.presentationContinuation, "experience");
  assert.equal(PLOTPICKLE_LIFECYCLE_FIELD_OWNERS.evidenceValidationRepair, "platform");
});

test("#1647 normalizes one reference-only lifecycle envelope instead of copying existing subsystem state", () => {
  const envelope = normalizeLifecycleEnvelope(base());
  assert.equal(envelope.schemaVersion, 1);
  assert.equal(envelope.runId, "run-afterglow-001");
  assert.equal(envelope.projectId, "project-afterglow");
  assert.equal(envelope.revision, "12");
  assert.equal(envelope.stage, "enter-understand");
  assert.deepEqual(envelope.allowedTransitions, ["learn-prepare"]);
  assert.equal(envelope.actor.kind, "guest");
  assert.equal(envelope.actor.humanProfileId, "");
  assert.equal(envelope.persistence.classification, "durable-non-canon");
  assert.ok(envelope.contractRefs.some((ref) => ref.startsWith("guest-task:")));
  assert.ok(envelope.contractRefs.some((ref) => ref.startsWith("responsibility-run:")));
  assert.ok(envelope.contractRefs.some((ref) => ref.startsWith("ppf-revision:")));
  assert.ok(envelope.contractRefs.some((ref) => ref.startsWith("verification:")));
  assert.equal(normalizeLifecycleEnvelope(envelope), envelope === normalizeLifecycleEnvelope(envelope) ? envelope : envelope);
});

test("#1647 allows the canonical forward path plus the bounded Validate to Create repair loop", () => {
  let envelope = normalizeLifecycleEnvelope(base());
  for (const next of ["learn-prepare", "plan-decide", "create-execute", "validate-repair"]) {
    envelope = transitionLifecycleEnvelope(envelope, next, { reasonRef: `transition:${next}` });
    assert.equal(envelope.stage, next);
    assert.equal(envelope.priorTransition.to, next);
  }
  const repair = validateLifecycleTransition("validate-repair", "create-execute");
  assert.equal(repair.ok, true);
  assert.equal(repair.kind, "bounded-repair-loop");
  envelope = transitionLifecycleEnvelope(envelope, "create-execute", { reasonRef: "repair:confirmed-finding" });
  envelope = transitionLifecycleEnvelope(envelope, "validate-repair", { reasonRef: "verification:rerun" });
  envelope = transitionLifecycleEnvelope(envelope, "approve-persist", { reasonRef: "verification:pass" });
  envelope = transitionLifecycleEnvelope(envelope, "package-present-continue", { reasonRef: "persistence:decided" });
  assert.equal(envelope.stage, "package-present-continue");
  assert.deepEqual(envelope.allowedTransitions, []);
});

test("#1647 rejects invalid jumps with precise deterministic transition evidence", () => {
  const invalid = validateLifecycleTransition("plan-decide", "approve-persist");
  assert.equal(invalid.ok, false);
  assert.equal(invalid.code, "invalid-lifecycle-transition");
  assert.deepEqual(invalid.allowed, ["create-execute"]);
  assert.match(invalid.message, /plan-decide -> approve-persist/);
  assert.throws(
    () => transitionLifecycleEnvelope(base({ stage: "plan-decide", priorTransition: { from: "learn-prepare", to: "plan-decide", at: "", reasonRef: "" } }), "approve-persist"),
    (error) => error?.code === "invalid-lifecycle-transition" && error?.fromStage === "plan-decide" && error?.toStage === "approve-persist",
  );
});

test("#1647 Human Guest agent and system actors share one structure with explicit authority differences", () => {
  const guest = normalizeLifecycleEnvelope(base()).actor;
  assert.equal(guest.kind, "guest");
  assert.equal(guest.delegated, true);
  assert.equal(guest.humanProfileId, "");

  const human = normalizeLifecycleEnvelope(base({
    actor: {
      actorId: "writer-1",
      kind: "human",
      authorityClass: "writer",
      delegated: false,
      humanProfileId: "profile-writer-1",
      operatorId: "",
      authorityRef: "profile:writer-1",
    },
  })).actor;
  assert.equal(human.kind, "human");
  assert.equal(human.humanProfileId, "profile-writer-1");

  for (const kind of ["agent", "system"]) {
    const actor = normalizeLifecycleEnvelope(base({
      actor: {
        actorId: `${kind}-1`,
        kind,
        authorityClass: kind === "agent" ? "bounded-agent-worker" : "authoritative-system",
        delegated: false,
        humanProfileId: "",
        operatorId: `${kind}-operator`,
        authorityRef: `authority:${kind}-1`,
      },
    })).actor;
    assert.equal(actor.kind, kind);
    assert.ok(actor.authorityRef);
  }

  assert.throws(() => normalizeLifecycleEnvelope(base({ actor: { ...base().actor, delegated: false } })), /Guest lifecycle actors must be explicitly delegated/);
  assert.throws(() => normalizeLifecycleEnvelope(base({ actor: { ...base().actor, humanProfileId: "profile-human" } })), /cannot impersonate a Human profile/);
});

test("#1647 validation repair and persistence projections preserve existing authority boundaries", () => {
  assert.throws(
    () => normalizeLifecycleEnvelope(base({ validation: { result: "pass", authorityRef: "", evidenceRefs: ["verification:pass"] } })),
    /authoritative validation reference/,
  );
  assert.throws(
    () => normalizeLifecycleEnvelope(base({ repairBudget: { attempts: 3, maxAttempts: 2 } })),
    /cannot exceed/,
  );
  assert.throws(
    () => normalizeLifecycleEnvelope(base({ persistence: { classification: "canonical-project-state", ownerRef: "ppf:revision-store", decision: "approved", approvalRef: "" } })),
    /explicit approval provenance/,
  );
  const approved = normalizeLifecycleEnvelope(base({
    persistence: { classification: "canonical-project-state", ownerRef: "ppf:revision-store", decision: "approved", approvalRef: "writer-approval:123" },
  }));
  assert.equal(approved.persistence.ownerRef, "ppf:revision-store");
  assert.equal(approved.persistence.approvalRef, "writer-approval:123");
});

test("#1647 lifecycle payloads are references not credential hidden-reasoning or raw-story containers", () => {
  for (const unsafe of [
    { apiKey: "secret" },
    { privateKey: "secret" },
    { hiddenReasoning: "internal" },
    { chainOfThought: "internal" },
    { storyText: "unnecessary raw story" },
    { prompt: "raw prompt" },
  ]) {
    assert.throws(() => normalizeLifecycleEnvelope({ ...base(), ...unsafe }), /forbidden private or credential field/);
  }
  assert.throws(() => normalizeLifecycleEnvelope({ ...base(), arbitraryPayload: "raw data" }), /unsupported field arbitraryPayload/);
});

test("#1647 rejects unsupported schema versions and caller-forged transition projections", () => {
  assert.throws(() => normalizeLifecycleEnvelope(base({ schemaVersion: 2 })), /Unsupported lifecycle schema version 2/);
  assert.throws(() => normalizeLifecycleEnvelope(base({ allowedTransitions: ["approve-persist"] })), /must be derived from the canonical lifecycle transition table/);
  assert.deepEqual(allowedLifecycleTransitions("approve-persist"), ["package-present-continue"]);
});
