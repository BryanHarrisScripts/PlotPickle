import { createHash } from "node:crypto";

const EXECUTION_POLICIES = Object.freeze({
  "buzz-managed": Object.freeze({
    owner: "buzz",
    durableExecution: false,
    planningModelExecution: false,
    workspaceMigration: false,
    privateRoomAutoSubscribe: false,
    repositoryAuthorityGranted: false,
  }),
  "plotpickle-uat": Object.freeze({
    owner: "plotpickle-uat",
    durableExecution: false,
    planningModelExecution: false,
    workspaceMigration: false,
    privateRoomAutoSubscribe: false,
    repositoryAuthorityGranted: false,
  }),
  "deterministic-observer": Object.freeze({
    owner: "plotpickle-deterministic-observer",
    durableExecution: false,
    planningModelExecution: false,
    workspaceMigration: false,
    privateRoomAutoSubscribe: false,
    repositoryAuthorityGranted: false,
  }),
  "deterministic-gate": Object.freeze({
    owner: "plotpickle-deterministic-gate",
    durableExecution: false,
    planningModelExecution: false,
    workspaceMigration: false,
    privateRoomAutoSubscribe: false,
    repositoryAuthorityGranted: false,
  }),
  "repository-handoff": Object.freeze({
    owner: "repository-handoff",
    durableExecution: false,
    planningModelExecution: false,
    workspaceMigration: false,
    privateRoomAutoSubscribe: false,
    repositoryAuthorityGranted: false,
  }),
});

const FORBIDDEN_INPUT_FIELDS = Object.freeze([
  "payload",
  "prompt",
  "context",
  "conversation",
  "messages",
  "credentials",
  "apiKey",
  "secret",
  "privateKey",
  "hiddenReasoning",
  "workspaceState",
  "privateRoom",
  "privateRoomContent",
]);

function bounded(value, label, maximum = 240) {
  const clean = String(value ?? "").replace(/[\u0000-\u001f\u007f]/gu, " ").replace(/\s+/gu, " ").trim();
  if (!clean || clean.length > maximum) throw new Error(`Invalid Phase 4 durable handoff ${label}.`);
  return clean;
}

function boundedRefs(values, label, maximum = 32) {
  if (!Array.isArray(values) || values.length > maximum) throw new Error(`Invalid Phase 4 durable handoff ${label}.`);
  return Object.freeze([...new Set(values.map((value) => bounded(value, label, 240)))].sort());
}

function handoffIdentity(value) {
  return `agent-handoff:${createHash("sha256").update(JSON.stringify(value)).digest("hex")}`;
}

export function ownerPreservingExecutionPolicies() {
  return EXECUTION_POLICIES;
}

export function validateOwnerPreservingProfile(profile) {
  if (!profile || typeof profile !== "object") throw new Error("Canonical Agent Profile is required for a Phase 4 handoff.");
  const profileId = bounded(profile.id, "profile ID", 180);
  const roleId = bounded(profile.execution?.roleId, "runtime role ID", 180);
  const kind = bounded(profile.execution?.kind, "execution kind", 80);
  if (kind === "embedded-mastra") throw new Error("Embedded Mastra roles use the governed durable checkpoint seam, not the Phase 4 external-owner handoff.");
  const policy = EXECUTION_POLICIES[kind];
  if (!policy) throw new Error(`Unsupported Phase 4 execution owner: ${kind}.`);
  return Object.freeze({ profileId, roleId, executionKind: kind, policy });
}

/**
 * Save references across an execution-owner boundary without migrating the
 * execution owner or copying private task payloads into Pi Durable.
 */
export function buildOwnerPreservingDurableHandoff(input = {}) {
  for (const field of FORBIDDEN_INPUT_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      throw new Error(`Phase 4 durable handoff rejects private/execution payload field: ${field}.`);
    }
  }

  const validated = validateOwnerPreservingProfile(input.profile);
  const taskRef = bounded(input.taskRef, "task reference", 180);
  const runRef = bounded(input.runRef, "run reference", 180);
  const evidenceRefs = boundedRefs(input.evidenceRefs || [], "evidence reference");
  const summary = bounded(input.summary, "summary", 500);

  const identityInput = Object.freeze({
    profileId: validated.profileId,
    roleId: validated.roleId,
    executionKind: validated.executionKind,
    owner: validated.policy.owner,
    taskRef,
    runRef,
    evidenceRefs,
  });

  return Object.freeze({
    schemaVersion: 1,
    handoffId: handoffIdentity(identityInput),
    ...identityInput,
    summary,
    authority: Object.freeze({
      canonical: false,
      executionOwnerPreserved: true,
      piExecutionGranted: false,
      providerRequestsIssued: false,
      modelRequestsIssued: false,
      externalActionIssued: false,
      workspaceMigration: validated.policy.workspaceMigration,
      privateRoomAutoSubscribe: validated.policy.privateRoomAutoSubscribe,
      repositoryAuthorityGranted: validated.policy.repositoryAuthorityGranted,
      planningModelExecution: validated.policy.planningModelExecution,
    }),
  });
}
