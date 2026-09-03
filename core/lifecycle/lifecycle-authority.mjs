import {
  normalizeLifecycleEnvelope,
  validateLifecycleTransition,
} from "./lifecycle-contract.mjs";

export const PLOTPICKLE_LIFECYCLE_AUTHORITY_ACTIONS = Object.freeze([
  "observe",
  "propose",
  "execute",
  "use-evidence",
  "transition",
  "persist",
  "continue",
  "change-authority",
]);

export const PLOTPICKLE_HARNESS_APPROVER_AUTHORITY_CLASS = "plotpickle-maintainer-harness-approver";

const ACTIONS = new Set(PLOTPICKLE_LIFECYCLE_AUTHORITY_ACTIONS);
const SAFE_PERSISTENCE_WITHOUT_DURABLE_PROMOTION = new Set(["none", "evidence", "durable-non-canon"]);

function text(value) {
  return typeof value === "string" ? value.trim() : "";
}

function deny(envelope, action, code, reason, extra = {}) {
  return Object.freeze({
    allowed: false,
    action,
    code,
    reason,
    actorId: envelope.actor.actorId,
    actorKind: envelope.actor.kind,
    authorityClass: envelope.actor.authorityClass,
    humanApproved: false,
    autonomousPolicyApproved: false,
    ...extra,
  });
}

function allow(envelope, action, code, reason, extra = {}) {
  return Object.freeze({
    allowed: true,
    action,
    code,
    reason,
    actorId: envelope.actor.actorId,
    actorKind: envelope.actor.kind,
    authorityClass: envelope.actor.authorityClass,
    humanApproved: false,
    autonomousPolicyApproved: false,
    ...extra,
  });
}

function sameActorAuthority(expected, resumed) {
  if (!resumed || typeof resumed !== "object" || Array.isArray(resumed)) return false;
  for (const key of ["actorId", "kind", "authorityClass", "delegated", "humanProfileId", "operatorId", "authorityRef"]) {
    if (expected[key] !== resumed[key]) return false;
  }
  return true;
}

function policyApprovalMatches(envelope, approval) {
  return Boolean(
    approval
    && approval.kind === "harness-policy"
    && approval.authorityClass === PLOTPICKLE_HARNESS_APPROVER_AUTHORITY_CLASS
    && approval.serverOwned === true
    && text(approval.humanProfileId) === ""
    && text(approval.approvalRef)
    && text(approval.approvalRef) === envelope.persistence.approvalRef,
  );
}

function humanWriterApprovalMatches(envelope, approval) {
  return Boolean(
    approval
    && approval.kind === "human-writer"
    && envelope.actor.kind === "human"
    && text(envelope.actor.humanProfileId)
    && text(approval.humanProfileId) === envelope.actor.humanProfileId
    && text(approval.approvalRef)
    && text(approval.approvalRef) === envelope.persistence.approvalRef,
  );
}

function decidePersistence(envelope, approval) {
  const persistence = envelope.persistence;
  if (persistence.decision !== "approved") {
    return deny(envelope, "persist", "persistence-not-approved", "Persistence requires an approved lifecycle persistence decision.", {
      persistenceClass: persistence.classification,
      persistenceOwnerRef: persistence.ownerRef,
    });
  }

  if (SAFE_PERSISTENCE_WITHOUT_DURABLE_PROMOTION.has(persistence.classification)) {
    if (persistence.classification !== "none" && !persistence.approvalRef) {
      return deny(envelope, "persist", "persistence-approval-provenance-required", "Persistent evidence or non-canon state requires approval provenance from its existing owner or policy.", {
        persistenceClass: persistence.classification,
        persistenceOwnerRef: persistence.ownerRef,
      });
    }
    return allow(envelope, "persist", "existing-owner-persistence", "The lifecycle may hand this state to its existing persistence owner without granting new operational authority.", {
      persistenceClass: persistence.classification,
      persistenceOwnerRef: persistence.ownerRef,
    });
  }

  if (persistence.classification === "durable-knowledge") {
    if (!policyApprovalMatches(envelope, approval)) {
      return deny(envelope, "persist", "harness-policy-approval-required", "Durable knowledge requires a matching server-owned harness policy approval; an agent or Guest cannot durably approve its own learning.", {
        persistenceClass: persistence.classification,
        persistenceOwnerRef: persistence.ownerRef,
      });
    }
    return allow(envelope, "persist", "harness-policy-approved-durable-knowledge", "The existing server-owned harness approver may admit evidence-backed durable knowledge without granting operational authority.", {
      persistenceClass: persistence.classification,
      persistenceOwnerRef: persistence.ownerRef,
      autonomousPolicyApproved: true,
      approvalRef: persistence.approvalRef,
      operationalAuthorityGranted: false,
    });
  }

  if (persistence.classification === "canonical-project-state") {
    if (!humanWriterApprovalMatches(envelope, approval)) {
      return deny(envelope, "persist", "human-writer-approval-required", "Canonical project state remains behind the existing explicit Human writer approval route.", {
        persistenceClass: persistence.classification,
        persistenceOwnerRef: persistence.ownerRef,
      });
    }
    return allow(envelope, "persist", "human-writer-approved-canonical-state", "The lifecycle may hand the approved canonical mutation to the existing PPF revision writer route.", {
      persistenceClass: persistence.classification,
      persistenceOwnerRef: persistence.ownerRef,
      humanApproved: true,
      approvalRef: persistence.approvalRef,
    });
  }

  return deny(envelope, "persist", "unsupported-persistence-class", `Persistence class ${persistence.classification} is not governed by lifecycle authority policy.`);
}

export function lifecycleActorAuthorityProjection(value) {
  const envelope = normalizeLifecycleEnvelope(value);
  const guest = envelope.actor.kind === "guest";
  return Object.freeze({
    actorId: envelope.actor.actorId,
    actorKind: envelope.actor.kind,
    authorityClass: envelope.actor.authorityClass,
    delegated: envelope.actor.delegated,
    humanProfileId: envelope.actor.humanProfileId,
    mayObserve: true,
    mayPropose: true,
    mayExecuteBoundedCapabilities: envelope.capabilities.length > 0,
    mayUseEvidenceForReasoning: true,
    mayPersistEvidenceOrNonCanon: true,
    mayApproveOwnDurableLearning: false,
    mayChangeOwnAuthority: false,
    mayClaimHumanApproval: !guest && envelope.actor.kind === "human",
    canonicalMutationRequiresHumanWriterApproval: true,
    durableKnowledgeRequiresHarnessPolicyApproval: true,
  });
}

export function decideLifecycleAuthority(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Lifecycle authority request must be an object.");
  const envelope = normalizeLifecycleEnvelope(input.envelope);
  const action = text(input.action);
  if (!ACTIONS.has(action)) throw new Error(`Unsupported lifecycle authority action ${action || "(empty)"}.`);

  if (action === "observe") {
    return allow(envelope, action, "observe-allowed", "Lifecycle state may be observed through the actor's existing scoped context.");
  }

  if (action === "propose") {
    return allow(envelope, action, "proposal-only", "The actor may propose bounded work or changes; proposal authority does not imply persistence or canon authority.");
  }

  if (action === "execute") {
    const capabilityRef = text(input.capabilityRef);
    if (!capabilityRef || !envelope.capabilities.includes(capabilityRef)) {
      return deny(envelope, action, "capability-not-delegated", "Execution requires an explicitly delegated capability reference in the lifecycle envelope.", { capabilityRef });
    }
    return allow(envelope, action, "bounded-capability-execution", "Execution is allowed only for the capability already granted by the existing harness/provider route.", { capabilityRef });
  }

  if (action === "use-evidence") {
    const evidenceRef = text(input.evidenceRef);
    if (!evidenceRef || !envelope.evidenceRefs.includes(evidenceRef)) {
      return deny(envelope, action, "evidence-not-in-run-context", "Evidence may influence reasoning only when it is explicitly referenced by the lifecycle run.", { evidenceRef });
    }
    return allow(envelope, action, "evidence-reasoning-only", "Referenced evidence may influence later reasoning, but this decision does not make it durable or expand actor authority.", {
      evidenceRef,
      durableKnowledgeGranted: false,
      operationalAuthorityGranted: false,
    });
  }

  if (action === "transition") {
    const toStage = text(input.toStage);
    const transition = validateLifecycleTransition(envelope.stage, toStage);
    if (!transition.ok) {
      return deny(envelope, action, transition.code, transition.message, {
        fromStage: transition.from,
        toStage: transition.to,
        allowedTransitions: transition.allowed,
      });
    }
    if (transition.kind === "bounded-repair-loop" && envelope.repairBudget.attempts >= envelope.repairBudget.maxAttempts) {
      return deny(envelope, action, "repair-budget-exhausted", "The bounded repair budget is exhausted; the harness must stop rather than re-enter Create/Execute.", {
        fromStage: transition.from,
        toStage: transition.to,
        repairAttempts: envelope.repairBudget.attempts,
        repairMaxAttempts: envelope.repairBudget.maxAttempts,
      });
    }
    return allow(envelope, action, transition.kind === "bounded-repair-loop" ? "bounded-repair-transition" : "lifecycle-transition", "The requested transition is valid under the canonical lifecycle table and current repair budget.", {
      fromStage: transition.from,
      toStage: transition.to,
      transitionKind: transition.kind,
    });
  }

  if (action === "persist") return decidePersistence(envelope, input.approval);

  if (action === "continue") {
    if (!envelope.nextAction.action) {
      return deny(envelope, action, "no-continuation-action", "The lifecycle run has no valid continuation action.");
    }
    if (input.resumeActor !== undefined && !sameActorAuthority(envelope.actor, input.resumeActor)) {
      return deny(envelope, action, "resume-authority-mismatch", "Reconnect or resume must preserve the exact actor authority snapshot; it cannot leak or elevate authority.");
    }
    return allow(envelope, action, "continuation-allowed", "The actor may continue only through the lifecycle's recorded next action with unchanged authority.", {
      nextAction: envelope.nextAction.action,
      nextActionRef: envelope.nextAction.ref,
      continuationRef: envelope.nextAction.continuationRef,
    });
  }

  return deny(envelope, action, "authority-change-not-self-service", "Lifecycle actors cannot change or promote their own operational authority; authority changes remain outside actor-controlled execution.", {
    operationalAuthorityGranted: false,
  });
}
