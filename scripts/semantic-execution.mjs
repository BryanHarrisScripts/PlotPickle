import { createHash, randomUUID } from "node:crypto";

export const SEMANTIC_EXECUTION_SCHEMA_VERSION = 1;
export const SEMANTIC_EVALUATION_STATUSES = ["pass", "fail", "uncertain", "blocked"];
export const SEMANTIC_EXECUTION_STATUSES = ["running", "completed", "blocked"];

const SECRET_KEY_PATTERN = /(password|passphrase|secret|token|cookie|authorization|api[_-]?key|private[_-]?key|nsec)/i;
const HIDDEN_REASONING_KEYS = new Set([
  "chainofthought",
  "chain_of_thought",
  "reasoning",
  "internalreasoning",
  "internal_reasoning",
  "prompt",
  "messages",
  "scratchpad",
]);

function cleanText(value, limit = 2400) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\bnsec1[a-z0-9]{8,}\b/gi, "[REDACTED_NOSTR_PRIVATE_KEY]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi, "Bearer [REDACTED]")
    .replace(/\b(?:sk|pk)-[A-Za-z0-9_-]{8,}\b/g, "[REDACTED_PROVIDER_KEY]")
    .replace(/\b(api[_-]?key|password|passphrase|secret|token|cookie)\b\s*[:=]\s*[^\s,;]+/gi, "$1=[REDACTED]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function safeValue(value, key = "") {
  const normalizedKey = String(key || "").toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (HIDDEN_REASONING_KEYS.has(normalizedKey)) return undefined;
  if (SECRET_KEY_PATTERN.test(String(key || ""))) return "[REDACTED]";
  if (typeof value === "string") return cleanText(value);
  if (typeof value === "number" || typeof value === "boolean" || value == null) return value;
  if (Array.isArray(value)) return value.map((item) => safeValue(item)).filter((item) => item !== undefined);
  if (typeof value === "object") {
    const output = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      const safe = safeValue(childValue, childKey);
      if (safe !== undefined) output[childKey] = safe;
    }
    return output;
  }
  return cleanText(value);
}

function safeStrings(values, limit = 64, itemLimit = 500) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => cleanText(value, itemLimit)).filter(Boolean))].slice(0, limit);
}

function safeEvidence(values) {
  const input = Array.isArray(values) ? values : values ? [values] : [];
  return input.slice(0, 64).map((item) => {
    if (typeof item === "string") return { kind: "note", ref: "", summary: cleanText(item, 900) };
    return {
      kind: cleanText(item?.kind || item?.label || "evidence", 80),
      ref: cleanText(item?.ref || item?.url || item?.path || "", 700),
      summary: cleanText(item?.summary || item?.message || "", 900),
    };
  });
}

function stableExecutionId(input) {
  const seed = JSON.stringify({
    taskId: cleanText(input.taskId, 240),
    agentId: cleanText(input.agentId, 160),
    domain: cleanText(input.domain, 120),
    objective: cleanText(input.intent?.objective, 900),
  });
  return `semantic-${createHash("sha256").update(seed).digest("hex").slice(0, 20)}-${randomUUID().slice(0, 8)}`;
}

function normalizeScope(scope = {}) {
  return {
    profileId: cleanText(scope.profileId, 240),
    projectId: cleanText(scope.projectId, 240),
    agentId: cleanText(scope.agentId, 240),
    nodeId: cleanText(scope.nodeId, 240),
    sessionId: cleanText(scope.sessionId, 240),
  };
}

function normalizePhaseProfile(profile) {
  if (!profile || typeof profile !== "object") throw new Error("Semantic execution requires a phase profile.");
  const phases = {};
  for (const [phaseId, raw] of Object.entries(profile.phases || {})) {
    const id = cleanText(phaseId, 80);
    if (!id) continue;
    phases[id] = {
      purpose: cleanText(raw?.purpose, 700),
      allowedActionClasses: safeStrings(raw?.allowedActionClasses, 32, 120),
      transitions: safeStrings(raw?.transitions, 32, 80),
      requiresObservationBefore: raw?.requiresObservationBefore === true,
      requiresObservationAfter: raw?.requiresObservationAfter === true,
      requiresEvaluation: raw?.requiresEvaluation !== false,
      terminal: raw?.terminal === true,
    };
  }
  const initialPhase = cleanText(profile.initialPhase, 80);
  if (!initialPhase || !phases[initialPhase]) throw new Error("Semantic phase profile initial phase is invalid.");
  return {
    id: cleanText(profile.id || "semantic-default", 120),
    initialPhase,
    phases,
  };
}

export const ENGINEERING_REPAIR_PHASE_PROFILE = Object.freeze({
  id: "engineering-repair-v1",
  initialPhase: "UNDERSTAND",
  phases: {
    UNDERSTAND: {
      purpose: "Identify the verified finding, authority boundary and exact repair target.",
      allowedActionClasses: [],
      transitions: ["ACT", "BLOCKED"],
      requiresEvaluation: true,
    },
    ACT: {
      purpose: "Perform one bounded repair action against the authorized target.",
      allowedActionClasses: ["developer.repair"],
      transitions: ["VERIFY", "REPAIR", "BLOCKED"],
      requiresObservationBefore: true,
      requiresObservationAfter: true,
      requiresEvaluation: true,
    },
    VERIFY: {
      purpose: "Compare observed post-action state against deterministic acceptance evidence.",
      allowedActionClasses: [],
      transitions: ["COMPLETE", "REPAIR", "BLOCKED"],
      requiresEvaluation: true,
    },
    REPAIR: {
      purpose: "Repair only the verified mismatch from the previous evaluation.",
      allowedActionClasses: ["developer.repair"],
      transitions: ["VERIFY", "BLOCKED"],
      requiresObservationBefore: true,
      requiresObservationAfter: true,
      requiresEvaluation: true,
    },
    COMPLETE: {
      purpose: "Record the verified final state and bounded structured experience candidate.",
      allowedActionClasses: [],
      transitions: [],
      requiresEvaluation: false,
      terminal: true,
    },
    BLOCKED: {
      purpose: "Stop safely because required evidence, authority or bounded repair capacity is unavailable.",
      allowedActionClasses: [],
      transitions: [],
      requiresEvaluation: false,
      terminal: true,
    },
  },
});

export function createSemanticExecution(input = {}) {
  const profile = normalizePhaseProfile(input.phaseProfile || ENGINEERING_REPAIR_PHASE_PROFILE);
  const scope = normalizeScope({ ...(input.scope || {}), agentId: input.scope?.agentId || input.agentId || "" });
  if (!Object.values(scope).some(Boolean)) throw new Error("Semantic execution must be explicitly scoped.");
  const objective = cleanText(input.intent?.objective, 1200);
  if (!objective) throw new Error("Semantic execution intent objective is required.");
  const now = cleanText(input.now || new Date().toISOString(), 80);
  return {
    schemaVersion: SEMANTIC_EXECUTION_SCHEMA_VERSION,
    executionId: cleanText(input.executionId, 240) || stableExecutionId(input),
    taskId: cleanText(input.taskId || "task", 240),
    agentId: cleanText(input.agentId || "unknown-agent", 160),
    domain: cleanText(input.domain || "generic", 120),
    scope,
    intent: {
      objective,
      constraints: safeStrings(input.intent?.constraints, 64, 700),
      success: cleanText(input.intent?.success, 1200),
      allowedActionClasses: safeStrings(input.intent?.allowedActionClasses, 32, 120),
      allowedTargets: safeStrings(input.intent?.allowedTargets, 64, 500),
      exclusions: safeStrings(input.intent?.exclusions, 64, 500),
    },
    phaseProfile: profile,
    currentPhase: profile.initialPhase,
    phaseRun: 1,
    status: "running",
    repairPolicy: {
      attempts: 0,
      maxAttempts: Math.max(0, Number(input.maxRepairAttempts ?? 2)),
      repeatedFailureCount: 0,
      maxRepeatedFailureCount: Math.max(1, Number(input.maxRepeatedFailureCount ?? 2)),
      lastFailureSignature: "",
    },
    observations: [],
    actions: [],
    evaluations: [],
    transitions: [],
    completion: null,
    createdAt: now,
    updatedAt: now,
  };
}

function phaseDefinition(record) {
  const phase = record?.phaseProfile?.phases?.[record?.currentPhase];
  if (!phase) throw new Error(`Unknown semantic phase: ${record?.currentPhase || "missing"}`);
  return phase;
}

function ensureRunning(record) {
  if (!record || record.status !== "running") throw new Error(`Semantic execution is not running: ${record?.status || "missing"}`);
  if (phaseDefinition(record).terminal) throw new Error(`Semantic phase ${record.currentPhase} is terminal.`);
}

function touch(record) {
  record.updatedAt = new Date().toISOString();
  return record;
}

function currentItems(items, record) {
  return (items || []).filter((item) => item.phase === record.currentPhase && item.phaseRun === record.phaseRun);
}

function targetAllowed(record, target) {
  const normalized = cleanText(target, 500);
  if (!normalized) return false;
  const exclusions = record.intent.exclusions || [];
  if (exclusions.some((excluded) => normalized === excluded || normalized.startsWith(`${excluded}/`) || normalized.startsWith(`${excluded}:`))) return false;
  const allowed = record.intent.allowedTargets || [];
  if (!allowed.length) return true;
  return allowed.some((entry) => normalized === entry || normalized.startsWith(`${entry}/`) || normalized.startsWith(`${entry}:`));
}

export function recordSemanticObservation(record, input = {}) {
  ensureRunning(record);
  const position = ["before", "after", "state"].includes(input.position) ? input.position : "state";
  const summary = cleanText(input.summary, 1600);
  if (!summary) throw new Error("Semantic observation summary is required.");
  const observation = {
    observationId: `observation-${record.observations.length + 1}`,
    phase: record.currentPhase,
    phaseRun: record.phaseRun,
    position,
    source: cleanText(input.source || "unknown", 160),
    summary,
    evidence: safeEvidence(input.evidence),
    stateVersion: cleanText(input.stateVersion, 240),
    truthStatus: ["observed", "unknown", "uncertain", "stale"].includes(input.truthStatus) ? input.truthStatus : "observed",
    observedAt: cleanText(input.observedAt || new Date().toISOString(), 80),
  };
  record.observations.push(observation);
  return touch(record);
}

export function beginSemanticAction(record, input = {}) {
  ensureRunning(record);
  const phase = phaseDefinition(record);
  const actionClass = cleanText(input.actionClass, 120);
  if (!actionClass || !phase.allowedActionClasses.includes(actionClass)) {
    throw new Error(`Action class ${actionClass || "missing"} is not permitted in semantic phase ${record.currentPhase}.`);
  }
  if (record.intent.allowedActionClasses.length && !record.intent.allowedActionClasses.includes(actionClass)) {
    throw new Error(`Action class ${actionClass} is outside the semantic intent authority.`);
  }
  const target = cleanText(input.target, 500);
  if (!targetAllowed(record, target)) throw new Error(`Action target ${target || "missing"} is outside the semantic intent scope.`);
  if (phase.requiresObservationBefore && !currentItems(record.observations, record).some((item) => item.position === "before" || item.position === "state")) {
    throw new Error(`Semantic phase ${record.currentPhase} requires a current observation before action.`);
  }
  if (currentItems(record.actions, record).some((item) => item.status === "running")) throw new Error("A semantic action is already running in this phase.");
  record.actions.push({
    actionId: `action-${record.actions.length + 1}`,
    phase: record.currentPhase,
    phaseRun: record.phaseRun,
    actionClass,
    capability: cleanText(input.capability || actionClass, 180),
    target,
    summary: cleanText(input.summary, 1200),
    evidence: safeEvidence(input.evidence),
    status: "running",
    startedAt: cleanText(input.startedAt || new Date().toISOString(), 80),
    completedAt: "",
    resultSummary: "",
  });
  return touch(record);
}

export function completeSemanticAction(record, input = {}) {
  ensureRunning(record);
  const actions = currentItems(record.actions, record);
  const action = [...actions].reverse().find((item) => item.status === "running");
  if (!action) throw new Error(`Semantic phase ${record.currentPhase} has no running action to complete.`);
  action.status = input.status === "pass" ? "pass" : "fail";
  action.resultSummary = cleanText(input.resultSummary, 1400);
  action.evidence = [...action.evidence, ...safeEvidence(input.evidence)].slice(0, 64);
  action.completedAt = cleanText(input.completedAt || new Date().toISOString(), 80);
  return touch(record);
}

export function recordSemanticEvaluation(record, input = {}) {
  ensureRunning(record);
  const phase = phaseDefinition(record);
  const status = SEMANTIC_EVALUATION_STATUSES.includes(input.status) ? input.status : "uncertain";
  const phaseActions = currentItems(record.actions, record);
  if (phase.requiresObservationAfter && phaseActions.length && !currentItems(record.observations, record).some((item) => item.position === "after")) {
    throw new Error(`Semantic phase ${record.currentPhase} requires a post-action observation before evaluation.`);
  }
  const evidence = safeEvidence(input.evidence);
  if (status === "pass" && !evidence.length && !currentItems(record.observations, record).some((item) => item.evidence.length)) {
    throw new Error(`Semantic PASS in phase ${record.currentPhase} requires evidence.`);
  }
  const evaluation = {
    evaluationId: `evaluation-${record.evaluations.length + 1}`,
    phase: record.currentPhase,
    phaseRun: record.phaseRun,
    status,
    verifier: cleanText(input.verifier || "semantic-runtime", 180),
    evidence,
    mismatch: cleanText(input.mismatch, 1400),
    failureClass: cleanText(input.failureClass, 240),
    repairAllowed: input.repairAllowed === true,
    evaluatedAt: cleanText(input.evaluatedAt || new Date().toISOString(), 80),
  };
  record.evaluations.push(evaluation);
  return touch(record);
}

function latestEvaluation(record) {
  return [...currentItems(record.evaluations, record)].reverse()[0] || null;
}

function blockForRepairLimit(record, reason, evaluation) {
  const from = record.currentPhase;
  record.currentPhase = "BLOCKED";
  record.phaseRun += 1;
  record.status = "blocked";
  record.transitions.push({
    from,
    to: "BLOCKED",
    reason: cleanText(reason, 1000),
    evidence: evaluation?.evidence || [],
    transitionedAt: new Date().toISOString(),
  });
  record.completion = {
    finalDisposition: "blocked",
    evidence: evaluation?.evidence || [],
    summary: cleanText(reason, 1200),
    completedAt: new Date().toISOString(),
  };
  return touch(record);
}

export function transitionSemanticExecution(record, nextPhase, input = {}) {
  ensureRunning(record);
  const phase = phaseDefinition(record);
  const targetPhase = cleanText(nextPhase, 80);
  if (!phase.transitions.includes(targetPhase)) throw new Error(`Invalid semantic transition ${record.currentPhase} -> ${targetPhase}.`);
  const evaluation = latestEvaluation(record);
  if (phase.requiresEvaluation && !evaluation) throw new Error(`Semantic phase ${record.currentPhase} requires evaluation before transition.`);

  if (targetPhase === "REPAIR") {
    if (!evaluation || !["fail", "uncertain"].includes(evaluation.status) || evaluation.repairAllowed !== true) {
      throw new Error("Semantic REPAIR transition requires a failed/uncertain evaluation with repair permission.");
    }
    const signature = cleanText(`${evaluation.failureClass}:${evaluation.mismatch}`, 1000) || "unspecified-failure";
    const repeated = signature === record.repairPolicy.lastFailureSignature
      ? record.repairPolicy.repeatedFailureCount + 1
      : 1;
    if (record.repairPolicy.attempts >= record.repairPolicy.maxAttempts) {
      return blockForRepairLimit(record, "Repair limit reached; semantic execution stopped instead of repeating blindly.", evaluation);
    }
    if (repeated > record.repairPolicy.maxRepeatedFailureCount) {
      return blockForRepairLimit(record, "Repeated identical failure limit reached; semantic execution stopped instead of looping.", evaluation);
    }
    record.repairPolicy.attempts += 1;
    record.repairPolicy.repeatedFailureCount = repeated;
    record.repairPolicy.lastFailureSignature = signature;
  }

  if (targetPhase === "COMPLETE") {
    if (!evaluation || evaluation.status !== "pass") throw new Error("Semantic COMPLETE requires the current phase to verify PASS.");
    const acceptedEvidence = [...evaluation.evidence, ...currentItems(record.observations, record).flatMap((item) => item.evidence)].slice(0, 64);
    if (!acceptedEvidence.length) throw new Error("Semantic COMPLETE requires accepted evidence.");
    record.status = "completed";
    record.completion = {
      finalDisposition: "pass",
      evidence: acceptedEvidence,
      summary: cleanText(input.reason || "Verified semantic execution completed.", 1200),
      completedAt: new Date().toISOString(),
    };
  } else if (targetPhase === "BLOCKED") {
    record.status = "blocked";
    record.completion = {
      finalDisposition: "blocked",
      evidence: evaluation?.evidence || [],
      summary: cleanText(input.reason || evaluation?.mismatch || "Semantic execution blocked.", 1200),
      completedAt: new Date().toISOString(),
    };
  }

  const from = record.currentPhase;
  record.currentPhase = targetPhase;
  record.phaseRun += 1;
  record.transitions.push({
    from,
    to: targetPhase,
    reason: cleanText(input.reason || evaluation?.mismatch || evaluation?.status || "transition", 1000),
    evidence: evaluation?.evidence || [],
    transitionedAt: new Date().toISOString(),
  });
  return touch(record);
}

export function buildSemanticExperienceCandidate(record) {
  if (!record || record.status !== "completed" || record.completion?.finalDisposition !== "pass") return null;
  const failedEvaluations = (record.evaluations || []).filter((item) => ["fail", "uncertain"].includes(item.status));
  const successfulActions = (record.actions || []).filter((item) => item.status === "pass");
  return safeValue({
    schemaVersion: 1,
    status: "candidate",
    authorityClass: "derived",
    sourceType: "semantic-execution",
    memoryType: failedEvaluations.length ? "failure-recovery" : "procedural",
    executionId: record.executionId,
    taskId: record.taskId,
    scope: record.scope,
    agentId: record.agentId,
    domain: record.domain,
    phaseProfileId: record.phaseProfile.id,
    intent: record.intent.objective,
    preconditions: (record.observations || []).filter((item) => item.position === "before" || item.position === "state").slice(0, 6).map((item) => item.summary),
    failedApproaches: failedEvaluations.map((item) => ({ failureClass: item.failureClass, summary: item.mismatch, evidence: item.evidence })).slice(0, 8),
    successfulPattern: successfulActions.map((item) => ({ actionClass: item.actionClass, target: item.target, summary: item.resultSummary || item.summary, evidence: item.evidence })).slice(0, 8),
    verificationEvidence: record.completion.evidence,
    verified: true,
    createdAt: record.completion.completedAt,
  });
}

export function semanticExperienceScopeMatches(candidate, requestedScope = {}) {
  if (!candidate?.scope) return false;
  const candidateScope = normalizeScope(candidate.scope);
  const request = normalizeScope(requestedScope);
  for (const key of ["profileId", "projectId", "agentId", "nodeId", "sessionId"]) {
    if (candidateScope[key] && candidateScope[key] !== request[key]) return false;
  }
  return true;
}

export function validateSemanticExecutionRecord(record) {
  const errors = [];
  if (record?.schemaVersion !== SEMANTIC_EXECUTION_SCHEMA_VERSION) errors.push("Unsupported semantic execution schema version.");
  if (!cleanText(record?.executionId) || !cleanText(record?.taskId) || !cleanText(record?.agentId)) errors.push("Semantic execution identity is incomplete.");
  if (!SEMANTIC_EXECUTION_STATUSES.includes(record?.status)) errors.push("Semantic execution status is invalid.");
  if (!record?.phaseProfile?.phases?.[record?.currentPhase]) errors.push("Semantic execution current phase is invalid.");
  if (!Object.values(normalizeScope(record?.scope || {})).some(Boolean)) errors.push("Semantic execution scope is missing.");
  if (!cleanText(record?.intent?.objective)) errors.push("Semantic execution intent is missing.");
  if (!Array.isArray(record?.observations) || !Array.isArray(record?.actions) || !Array.isArray(record?.evaluations) || !Array.isArray(record?.transitions)) errors.push("Semantic execution event collections are invalid.");
  const serialized = JSON.stringify(safeValue(record));
  if (/\bnsec1[a-z0-9]{8,}\b/i.test(serialized) || /\bBearer\s+(?!\[REDACTED\])/i.test(serialized) || /\b(?:sk|pk)-[A-Za-z0-9_-]{8,}\b/.test(serialized)) errors.push("Semantic execution contains secret material.");
  for (const hidden of HIDDEN_REASONING_KEYS) {
    if (serialized.toLowerCase().includes(`\"${hidden}\"`)) errors.push("Semantic execution must not persist hidden reasoning or raw prompts.");
  }
  if (record?.status === "completed" && record?.completion?.finalDisposition !== "pass") errors.push("Completed semantic execution must have verified PASS disposition.");
  return { ok: errors.length === 0, errors, record: safeValue(record) };
}

export function safeSemanticExecutionRecord(record) {
  const sanitized = safeValue(record);
  if (!sanitized || typeof sanitized !== "object" || Array.isArray(sanitized)) {
    throw new Error("Semantic execution record must be an object.");
  }
  return structuredClone(sanitized);
}