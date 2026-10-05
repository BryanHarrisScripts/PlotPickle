import { createHash } from "node:crypto";
import {
  buildPhase3RoleCheckpointInput,
  phase3DurableRoleContract,
} from "./phase3-role-checkpoint-plan.mjs";

const ROLE_ADOPTION = Object.freeze({
  "continuity-review": Object.freeze({
    profileId: "mira-threadmere",
    roleId: "continuity",
    stepKind: "review",
  }),
  "story-review": Object.freeze({
    profileId: "critics-circle",
    roleId: "critic",
    stepKind: "review",
  }),
  "creative-coordination": Object.freeze({
    profileId: "quillan-reedcloak",
    roleId: "creative-director",
    stepKind: "proposal",
  }),
});

function token(value, label) {
  const normalized = String(value ?? "").trim();
  if (!normalized || normalized.length > 180 || /[\u0000-\u001f\u007f]/u.test(normalized)) {
    throw new Error(`Invalid durable PRE-PRODUCTION ${label}.`);
  }
  return normalized;
}

function boundedStepIds(values) {
  if (!Array.isArray(values) || !values.length || values.length > 96) {
    throw new Error("Durable PRE-PRODUCTION assistance requires 1–96 bounded work units.");
  }
  const ids = values.map((value) => token(value, "work-unit ID"));
  if (new Set(ids).size !== ids.length) throw new Error("Duplicate durable PRE-PRODUCTION work-unit ID.");
  return ids;
}

function contextReceipt(context) {
  if (!context || typeof context !== "object") throw new Error("PRE-PRODUCTION Responsibility Run context is required.");
  const taskId = token(context.taskId, "task ID");
  if (!Array.isArray(context.sourceIds) || !context.sourceIds.length || context.sourceIds.length > 256) {
    throw new Error("PRE-PRODUCTION Responsibility Run requires bounded source refs.");
  }
  const sourceIds = [...new Set(context.sourceIds.map((value) => token(value, "source ref")))].sort();
  const receiptGeneratedAt = token(context.receiptGeneratedAt, "context receipt time");
  const digest = createHash("sha256")
    .update(JSON.stringify({ taskId, sourceIds, receiptGeneratedAt }))
    .digest("hex");
  return `preproduction-context:${digest}`;
}

export function durablePreproductionRoleAdoptions() {
  return Object.freeze(Object.entries(ROLE_ADOPTION).map(([role, value]) => Object.freeze({ role, ...value })));
}

/**
 * Convert the existing PRE-PRODUCTION Responsibility Run envelope into the
 * already-adopted Phase 3 checkpoint scope. This function plans persistence
 * only: it issues no provider/model request and grants no execution authority.
 */
export function buildDurablePreproductionAssistancePlan({
  envelope,
  humanProfileId,
  projectId,
  projectRevision,
  provider,
  model,
  humanApprovalRef,
  workUnitIds,
}) {
  const adoption = ROLE_ADOPTION[envelope?.role];
  if (!adoption) throw new Error("This PRE-PRODUCTION assistance role is not adopted by the Phase 3 durable adapter.");
  if (envelope.profileId !== adoption.profileId || envelope.run?.profileId !== adoption.profileId) {
    throw new Error("PRE-PRODUCTION assistance profile does not match its durable role adoption.");
  }
  if (envelope.run?.kind !== "creative-proposal" || envelope.run?.verificationMode !== "writer-approval") {
    throw new Error("PRE-PRODUCTION durable assistance requires the existing proposal-only writer-approval Responsibility Run.");
  }
  if (envelope.run.runId !== token(envelope.run.runId, "run ID")
    || !Number.isSafeInteger(envelope.run.objectiveRevision)
    || envelope.run.objectiveRevision < 1) {
    throw new Error("PRE-PRODUCTION Responsibility Run identity is invalid.");
  }

  const contract = phase3DurableRoleContract(adoption.profileId);
  if (contract.roleId !== adoption.roleId) throw new Error("Durable PRE-PRODUCTION role registration diverged from Phase 3.");
  const ids = boundedStepIds(workUnitIds);
  const steps = ids.map((id) => Object.freeze({ id, kind: adoption.stepKind, replayPolicy: "safe" }));

  const checkpoint = buildPhase3RoleCheckpointInput({
    scope: {
      humanProfileId: token(humanProfileId, "Human profile ID"),
      projectId: token(projectId, "project ID"),
      projectRevision: token(projectRevision, "project revision"),
      agentProfileId: adoption.profileId,
      roleId: adoption.roleId,
      runId: envelope.run.runId,
      objectiveRevision: envelope.run.objectiveRevision,
      contextReceipt: contextReceipt(envelope.run.context),
      provider: token(provider, "provider"),
      model: token(model, "model"),
      humanApprovalRef: token(humanApprovalRef, "Human approval reference"),
      grantedCapabilities: contract.grantedCapabilities,
    },
    steps,
  });

  return Object.freeze({
    checkpoint,
    assistance: Object.freeze({
      role: envelope.role,
      responsibilityRunId: envelope.run.runId,
      proposalOnly: true,
      canonical: false,
      providerRequestsIssued: false,
      modelRequestsIssued: false,
      automaticResume: false,
    }),
  });
}
