export const PLOTPICKLE_LIFECYCLE_SCHEMA_VERSION = 1;

export const PLOTPICKLE_LIFECYCLE_STAGES = Object.freeze([
  "enter-understand",
  "learn-prepare",
  "plan-decide",
  "create-execute",
  "validate-repair",
  "approve-persist",
  "package-present-continue",
]);

export const PLOTPICKLE_LIFECYCLE_TRANSITIONS = Object.freeze({
  "enter-understand": Object.freeze(["learn-prepare"]),
  "learn-prepare": Object.freeze(["plan-decide"]),
  "plan-decide": Object.freeze(["create-execute"]),
  "create-execute": Object.freeze(["validate-repair"]),
  "validate-repair": Object.freeze(["create-execute", "approve-persist"]),
  "approve-persist": Object.freeze(["package-present-continue"]),
  "package-present-continue": Object.freeze([]),
});

export const PLOTPICKLE_LIFECYCLE_FIELD_OWNERS = Object.freeze({
  identity: "core",
  lifecycle: "core",
  actorAuthority: "core",
  intentPlan: "story",
  capabilities: "intelligence",
  integrationRefs: "community-integrations",
  presentationContinuation: "experience",
  evidenceValidationRepair: "platform",
  persistenceDecisionProjection: "core",
});

export const PLOTPICKLE_LIFECYCLE_VERSION_POLICY = Object.freeze({
  currentVersion: PLOTPICKLE_LIFECYCLE_SCHEMA_VERSION,
  supportedVersions: Object.freeze([PLOTPICKLE_LIFECYCLE_SCHEMA_VERSION]),
  rule: "additive-compatible-fields-or-explicit-versioned-adapter",
});

const STAGE_SET = new Set(PLOTPICKLE_LIFECYCLE_STAGES);
const ACTOR_KINDS = new Set(["human", "guest", "agent", "system"]);
const VALIDATION_RESULTS = new Set(["not-run", "pass", "fail", "blocked"]);
const PERSISTENCE_CLASSES = new Set(["none", "evidence", "durable-non-canon", "durable-knowledge", "canonical-project-state"]);
const PERSISTENCE_DECISIONS = new Set(["none", "pending", "approved", "rejected", "stale"]);

const TOP_LEVEL_FIELDS = new Set([
  "schemaVersion", "runId", "projectId", "revision", "stage", "priorTransition", "actor", "intent",
  "planOrDecisionRefs", "capabilities", "contextRefs", "inputRefs", "outputRefs", "evidenceRefs",
  "integrationRefs", "contractRefs", "validation", "repairBudget", "persistence", "stopReason", "nextAction",
]);
const PRIOR_TRANSITION_FIELDS = new Set(["from", "to", "at", "reasonRef"]);
const ACTOR_FIELDS = new Set(["actorId", "kind", "authorityClass", "delegated", "humanProfileId", "operatorId", "authorityRef"]);
const INTENT_FIELDS = new Set(["kind", "ref"]);
const VALIDATION_FIELDS = new Set(["result", "authorityRef", "evidenceRefs"]);
const REPAIR_FIELDS = new Set(["attempts", "maxAttempts"]);
const PERSISTENCE_FIELDS = new Set(["classification", "ownerRef", "decision", "approvalRef"]);
const STOP_FIELDS = new Set(["code", "detailRef"]);
const NEXT_FIELDS = new Set(["action", "ref", "continuationRef"]);
const FORBIDDEN_KEY = /(?:api[_-]?key|private[_-]?key|password|secret|credential|chain[_ -]?of[_ -]?thought|hidden[_ -]?reasoning|scratchpad|transcript|messages|story[_ -]?text|prompt)/i;

function object(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function onlyFields(value, fields, label) {
  for (const key of Object.keys(value)) {
    if (FORBIDDEN_KEY.test(key)) throw new Error(`${label} contains forbidden private or credential field ${key}.`);
    if (!fields.has(key)) throw new Error(`${label} contains unsupported field ${key}.`);
  }
}

function text(value, label, { allowEmpty = false } = {}) {
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const normalized = value.trim();
  if (!allowEmpty && !normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function refs(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array of references.`);
  return Object.freeze(value.map((item, index) => text(item, `${label}[${index}]`)));
}

function integer(value, label) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer.`);
  return value;
}

function stage(value, label = "lifecycle stage") {
  const normalized = text(value, label);
  if (!STAGE_SET.has(normalized)) throw new Error(`${label} ${normalized} is not recognized by lifecycle schema v1.`);
  return normalized;
}

export function allowedLifecycleTransitions(currentStage) {
  const normalized = stage(currentStage);
  return PLOTPICKLE_LIFECYCLE_TRANSITIONS[normalized];
}

export function validateLifecycleTransition(fromStage, toStage) {
  const from = stage(fromStage, "from lifecycle stage");
  const to = stage(toStage, "to lifecycle stage");
  if (from === to) return Object.freeze({ ok: true, kind: "same-stage-update", from, to, allowed: allowedLifecycleTransitions(from) });
  const allowed = allowedLifecycleTransitions(from);
  if (allowed.includes(to)) return Object.freeze({ ok: true, kind: to === "create-execute" && from === "validate-repair" ? "bounded-repair-loop" : "forward", from, to, allowed });
  return Object.freeze({
    ok: false,
    kind: "invalid",
    from,
    to,
    allowed,
    code: "invalid-lifecycle-transition",
    message: `Lifecycle transition ${from} -> ${to} is invalid; allowed next stages: ${allowed.length ? allowed.join(", ") : "none"}.`,
  });
}

function normalizePriorTransition(value, currentStage) {
  if (value == null) return null;
  const input = object(value, "priorTransition");
  onlyFields(input, PRIOR_TRANSITION_FIELDS, "priorTransition");
  const from = stage(input.from, "priorTransition.from");
  const to = stage(input.to, "priorTransition.to");
  const checked = validateLifecycleTransition(from, to);
  if (!checked.ok) throw new Error(checked.message);
  if (to !== currentStage) throw new Error(`priorTransition.to ${to} must equal current stage ${currentStage}.`);
  return Object.freeze({
    from,
    to,
    at: text(input.at ?? "", "priorTransition.at", { allowEmpty: true }),
    reasonRef: text(input.reasonRef ?? "", "priorTransition.reasonRef", { allowEmpty: true }),
  });
}

function normalizeActor(value) {
  const input = object(value, "actor");
  onlyFields(input, ACTOR_FIELDS, "actor");
  const kind = text(input.kind, "actor.kind");
  if (!ACTOR_KINDS.has(kind)) throw new Error(`actor.kind ${kind} is not supported.`);
  const actor = {
    actorId: text(input.actorId, "actor.actorId"),
    kind,
    authorityClass: text(input.authorityClass, "actor.authorityClass"),
    delegated: input.delegated === true,
    humanProfileId: text(input.humanProfileId ?? "", "actor.humanProfileId", { allowEmpty: true }),
    operatorId: text(input.operatorId ?? "", "actor.operatorId", { allowEmpty: true }),
    authorityRef: text(input.authorityRef, "actor.authorityRef"),
  };
  if (kind === "guest") {
    if (!actor.delegated) throw new Error("Guest lifecycle actors must be explicitly delegated.");
    if (actor.humanProfileId) throw new Error("Guest lifecycle actors cannot impersonate a Human profile.");
  }
  if (kind === "human" && !actor.humanProfileId) throw new Error("Human lifecycle actors require a Human profile reference.");
  return Object.freeze(actor);
}

function normalizeIntent(value) {
  const input = object(value, "intent");
  onlyFields(input, INTENT_FIELDS, "intent");
  return Object.freeze({ kind: text(input.kind, "intent.kind"), ref: text(input.ref, "intent.ref") });
}

function normalizeValidation(value) {
  const input = object(value, "validation");
  onlyFields(input, VALIDATION_FIELDS, "validation");
  const result = text(input.result, "validation.result");
  if (!VALIDATION_RESULTS.has(result)) throw new Error(`validation.result ${result} is not supported.`);
  const authorityRef = text(input.authorityRef ?? "", "validation.authorityRef", { allowEmpty: true });
  if (result !== "not-run" && !authorityRef) throw new Error("Completed validation requires an authoritative validation reference.");
  return Object.freeze({ result, authorityRef, evidenceRefs: refs(input.evidenceRefs ?? [], "validation.evidenceRefs") });
}

function normalizeRepairBudget(value) {
  const input = object(value, "repairBudget");
  onlyFields(input, REPAIR_FIELDS, "repairBudget");
  const attempts = integer(input.attempts, "repairBudget.attempts");
  const maxAttempts = integer(input.maxAttempts, "repairBudget.maxAttempts");
  if (attempts > maxAttempts) throw new Error("repairBudget.attempts cannot exceed repairBudget.maxAttempts.");
  return Object.freeze({ attempts, maxAttempts });
}

function normalizePersistence(value) {
  const input = object(value, "persistence");
  onlyFields(input, PERSISTENCE_FIELDS, "persistence");
  const classification = text(input.classification, "persistence.classification");
  const decision = text(input.decision, "persistence.decision");
  if (!PERSISTENCE_CLASSES.has(classification)) throw new Error(`persistence.classification ${classification} is not supported.`);
  if (!PERSISTENCE_DECISIONS.has(decision)) throw new Error(`persistence.decision ${decision} is not supported.`);
  const ownerRef = text(input.ownerRef ?? "", "persistence.ownerRef", { allowEmpty: true });
  const approvalRef = text(input.approvalRef ?? "", "persistence.approvalRef", { allowEmpty: true });
  if (classification !== "none" && !ownerRef) throw new Error("Persistent lifecycle state must reference its existing subsystem owner.");
  if (["durable-knowledge", "canonical-project-state"].includes(classification) && decision === "approved" && !approvalRef) {
    throw new Error(`${classification} approval requires explicit approval provenance.`);
  }
  return Object.freeze({ classification, ownerRef, decision, approvalRef });
}

function normalizeStopReason(value) {
  const input = object(value, "stopReason");
  onlyFields(input, STOP_FIELDS, "stopReason");
  return Object.freeze({
    code: text(input.code ?? "", "stopReason.code", { allowEmpty: true }),
    detailRef: text(input.detailRef ?? "", "stopReason.detailRef", { allowEmpty: true }),
  });
}

function normalizeNextAction(value) {
  const input = object(value, "nextAction");
  onlyFields(input, NEXT_FIELDS, "nextAction");
  return Object.freeze({
    action: text(input.action ?? "", "nextAction.action", { allowEmpty: true }),
    ref: text(input.ref ?? "", "nextAction.ref", { allowEmpty: true }),
    continuationRef: text(input.continuationRef ?? "", "nextAction.continuationRef", { allowEmpty: true }),
  });
}

export function normalizeLifecycleEnvelope(value) {
  const input = object(value, "lifecycle envelope");
  onlyFields(input, TOP_LEVEL_FIELDS, "lifecycle envelope");
  if (input.schemaVersion !== PLOTPICKLE_LIFECYCLE_SCHEMA_VERSION) {
    throw new Error(`Unsupported lifecycle schema version ${String(input.schemaVersion)}; expected ${PLOTPICKLE_LIFECYCLE_SCHEMA_VERSION}.`);
  }
  const currentStage = stage(input.stage);
  const envelope = {
    schemaVersion: PLOTPICKLE_LIFECYCLE_SCHEMA_VERSION,
    runId: text(input.runId, "runId"),
    projectId: text(input.projectId ?? "", "projectId", { allowEmpty: true }),
    revision: text(input.revision ?? "", "revision", { allowEmpty: true }),
    stage: currentStage,
    priorTransition: normalizePriorTransition(input.priorTransition, currentStage),
    actor: normalizeActor(input.actor),
    intent: normalizeIntent(input.intent),
    planOrDecisionRefs: refs(input.planOrDecisionRefs ?? [], "planOrDecisionRefs"),
    capabilities: refs(input.capabilities ?? [], "capabilities"),
    contextRefs: refs(input.contextRefs ?? [], "contextRefs"),
    inputRefs: refs(input.inputRefs ?? [], "inputRefs"),
    outputRefs: refs(input.outputRefs ?? [], "outputRefs"),
    evidenceRefs: refs(input.evidenceRefs ?? [], "evidenceRefs"),
    integrationRefs: refs(input.integrationRefs ?? [], "integrationRefs"),
    contractRefs: refs(input.contractRefs ?? [], "contractRefs"),
    validation: normalizeValidation(input.validation),
    repairBudget: normalizeRepairBudget(input.repairBudget),
    persistence: normalizePersistence(input.persistence),
    stopReason: normalizeStopReason(input.stopReason),
    nextAction: normalizeNextAction(input.nextAction),
    allowedTransitions: allowedLifecycleTransitions(currentStage),
  };
  return Object.freeze(envelope);
}

export function transitionLifecycleEnvelope(value, toStage, transition = {}) {
  const current = normalizeLifecycleEnvelope(value);
  const checked = validateLifecycleTransition(current.stage, toStage);
  if (!checked.ok) {
    const error = new Error(checked.message);
    error.code = checked.code;
    error.fromStage = checked.from;
    error.toStage = checked.to;
    error.allowedTransitions = checked.allowed;
    throw error;
  }
  if (checked.kind === "same-stage-update") return current;
  return normalizeLifecycleEnvelope({
    ...current,
    stage: checked.to,
    priorTransition: {
      from: checked.from,
      to: checked.to,
      at: typeof transition.at === "string" ? transition.at : "",
      reasonRef: typeof transition.reasonRef === "string" ? transition.reasonRef : "",
    },
  });
}
