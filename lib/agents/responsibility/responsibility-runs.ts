import { agentProfileById } from "../agent-profiles";
import type { ConnectorPolicyScope } from "./connector-trust-policy";

export const RESPONSIBILITY_RUN_STATES = [
  "queued",
  "preparing-context",
  "working",
  "verifying",
  "revising",
  "waiting-for-writer",
  "paused",
  "completed",
  "failed",
  "cancelled",
] as const;

export type ResponsibilityRunState = (typeof RESPONSIBILITY_RUN_STATES)[number];
export type ResponsibilityVerificationMode = "deterministic" | "writer-approval";
export type ResponsibilityRunKind = "deterministic-verification" | "creative-proposal" | "general";

export type ResponsibilityRunLimits = {
  maxAttempts: number;
  timeoutMs: number;
  maxParallelChildren: number;
  maxContextCharacters: number;
  maxTokens: number;
  maxToolCalls: number;
  maxCloudCostUsd: number;
};

export type ResponsibilityRunUsage = {
  attempts: number;
  contextCharacters: number;
  tokens: number;
  toolCalls: number;
  cloudCostUsd: number;
};

export type ResponsibilityRunContextRef = {
  taskId: string;
  sourceIds: string[];
  receiptGeneratedAt: string;
};

export type ResponsibilityRunArtifact = {
  id: string;
  kind: "proposal" | "asset" | "report" | "evidence" | "other";
  ref: string;
  producedAt: string;
  canonical: false;
};

export type ResponsibilityRunVerificationEvidence = {
  id: string;
  verifier: string;
  authority: "authoritative-system" | "worker-observation" | "writer";
  result: "PASS" | "FAIL" | "OBSERVATION" | "ACCEPT" | "REJECT" | "REVISE";
  evidenceRef: string;
  summary: string;
  recordedAt: string;
  immutable: true;
};

export type ResponsibilityWriterDecision = {
  writerId: string;
  decision: "accept" | "reject" | "revise";
  note: string;
  decidedAt: string;
};

export type ResponsibilityRunHandoff = {
  status: string;
  summary: string;
  evidence: string[];
  nextSteps: string[];
  blocker: string;
  createdAt: string;
};

export type ResponsibilityRunRepetition = {
  signature: string;
  connectorId: string;
  count: number;
  deniedCount: number;
  lastSeenAt: string;
};

export type ResponsibilityRunEvent = {
  id: string;
  type: string;
  state: ResponsibilityRunState;
  summary: string;
  at: string;
};

export type ResponsibilityRun = {
  version: 1;
  runId: string;
  kind: ResponsibilityRunKind;
  goal: string;
  objectiveRevision: number;
  profileId: string;
  skillUris: string[];
  allowedScopes: ConnectorPolicyScope[];
  allowedConnectorIds: string[];
  context: ResponsibilityRunContextRef | null;
  verificationMode: ResponsibilityVerificationMode;
  limits: ResponsibilityRunLimits;
  usage: ResponsibilityRunUsage;
  state: ResponsibilityRunState;
  resumeState: Exclude<ResponsibilityRunState, "paused"> | null;
  attemptId: string;
  contextRound: number;
  parentRunId: string;
  childRunIds: string[];
  artifacts: ResponsibilityRunArtifact[];
  verificationEvidence: ResponsibilityRunVerificationEvidence[];
  writerDecisions: ResponsibilityWriterDecision[];
  repetition: ResponsibilityRunRepetition[];
  handoff: ResponsibilityRunHandoff | null;
  startedAt: string;
  updatedAt: string;
  completedAt: string;
  stopReason: string;
  events: ResponsibilityRunEvent[];
};

export type ResponsibilityLimitStatus = {
  exhausted: boolean;
  reason: "attempts" | "timeout" | "context" | "tokens" | "tool-calls" | "cloud-cost" | "parallel-children" | "";
};

const TERMINAL_STATES = new Set<ResponsibilityRunState>(["completed", "failed", "cancelled"]);
const REPETITION_THRESHOLDS = [3, 5, 8] as const;

function boundedText(value: unknown, maximum = 1_200) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function boundedStringList(value: readonly string[] | undefined, maximum = 64, itemMaximum = 240) {
  return [...new Set((value || []).map((item) => boundedText(item, itemMaximum)).filter(Boolean))].slice(0, maximum);
}

export function responsibilityRunTimestamp(value?: string, fallback = new Date().toISOString()) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function runId() {
  return `run-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 10)}`;
}

function eventId(run: ResponsibilityRun, type: string) {
  return `${run.runId}:${type}:${run.events.length + 1}`;
}

function normalizeLimits(input: Partial<ResponsibilityRunLimits> = {}): ResponsibilityRunLimits {
  const integer = (value: unknown, fallback: number, minimum: number, maximum: number) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(minimum, Math.min(maximum, Math.floor(parsed))) : fallback;
  };
  const money = Number(input.maxCloudCostUsd);
  return {
    maxAttempts: integer(input.maxAttempts, 4, 1, 24),
    timeoutMs: integer(input.timeoutMs, 30 * 60_000, 10_000, 24 * 60 * 60_000),
    maxParallelChildren: integer(input.maxParallelChildren, 2, 0, 16),
    maxContextCharacters: integer(input.maxContextCharacters, 48_000, 2_000, 256_000),
    maxTokens: integer(input.maxTokens, 32_000, 1_000, 2_000_000),
    maxToolCalls: integer(input.maxToolCalls, 120, 1, 5_000),
    maxCloudCostUsd: Number.isFinite(money) ? Math.max(0, Math.min(1_000, Number(money.toFixed(4)))) : 0,
  };
}

function addEvent(run: ResponsibilityRun, type: string, summary: string, at = new Date().toISOString()): ResponsibilityRun {
  const cleanAt = responsibilityRunTimestamp(at);
  return {
    ...run,
    updatedAt: cleanAt,
    events: [...run.events, {
      id: eventId(run, type),
      type: boundedText(type, 80),
      state: run.state,
      summary: boundedText(summary, 500),
      at: cleanAt,
    }],
  };
}

function withState(run: ResponsibilityRun, state: ResponsibilityRunState, summary: string, at = new Date().toISOString()) {
  const next: ResponsibilityRun = {
    ...run,
    state,
    updatedAt: responsibilityRunTimestamp(at),
    completedAt: TERMINAL_STATES.has(state) ? responsibilityRunTimestamp(at) : run.completedAt,
  };
  return addEvent(next, `state.${state}`, summary, at);
}

function orderedRunValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(orderedRunValue);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, orderedRunValue(child)]));
}

function stable(value: unknown): string {
  return JSON.stringify(orderedRunValue(value)) ?? "undefined";
}

function simpleHash(source: string) {
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function samePermissions(left: ResponsibilityRun, right: ResponsibilityRun) {
  return stable({ profileId: left.profileId, skillUris: left.skillUris, allowedScopes: left.allowedScopes, allowedConnectorIds: left.allowedConnectorIds })
    === stable({ profileId: right.profileId, skillUris: right.skillUris, allowedScopes: right.allowedScopes, allowedConnectorIds: right.allowedConnectorIds });
}

export function createResponsibilityRun(input: {
  runId?: string;
  kind?: ResponsibilityRunKind;
  goal: string;
  profileId: string;
  skillUris?: readonly string[];
  allowedScopes?: readonly ConnectorPolicyScope[];
  allowedConnectorIds?: readonly string[];
  context?: ResponsibilityRunContextRef | null;
  verificationMode: ResponsibilityVerificationMode;
  limits?: Partial<ResponsibilityRunLimits>;
  parentRunId?: string;
  createdAt?: string;
}): ResponsibilityRun {
  const profile = agentProfileById(input.profileId);
  if (!profile) throw new Error(`Unknown Agent Profile: ${input.profileId}.`);
  const goal = boundedText(input.goal, 2_000);
  if (!goal) throw new Error("Responsibility Run goal is required.");
  const requestedSkills = boundedStringList(input.skillUris);
  const approvedSkills = new Set(profile.skillUris);
  if (requestedSkills.some((skill) => !approvedSkills.has(skill))) throw new Error("Responsibility Run cannot load a Skill outside the owning Agent Contract.");
  const createdAt = responsibilityRunTimestamp(input.createdAt);
  const run: ResponsibilityRun = {
    version: 1,
    runId: boundedText(input.runId || runId(), 160),
    kind: input.kind || "general",
    goal,
    objectiveRevision: 1,
    profileId: profile.id,
    skillUris: requestedSkills,
    allowedScopes: [...new Set(input.allowedScopes || [])],
    allowedConnectorIds: boundedStringList(input.allowedConnectorIds, 128, 180),
    context: input.context ? {
      taskId: boundedText(input.context.taskId, 180),
      sourceIds: boundedStringList(input.context.sourceIds, 256, 240),
      receiptGeneratedAt: responsibilityRunTimestamp(input.context.receiptGeneratedAt),
    } : null,
    verificationMode: input.verificationMode,
    limits: normalizeLimits(input.limits),
    usage: { attempts: 0, contextCharacters: 0, tokens: 0, toolCalls: 0, cloudCostUsd: 0 },
    state: "queued",
    resumeState: null,
    attemptId: "",
    contextRound: 1,
    parentRunId: boundedText(input.parentRunId, 160),
    childRunIds: [],
    artifacts: [],
    verificationEvidence: [],
    writerDecisions: [],
    repetition: [],
    handoff: null,
    startedAt: "",
    updatedAt: createdAt,
    completedAt: "",
    stopReason: "",
    events: [],
  };
  return addEvent(run, "run.created", "Responsibility Run queued with host-owned limits.", createdAt);
}

export function responsibilityRunLimitStatus(run: ResponsibilityRun, now = new Date().toISOString()): ResponsibilityLimitStatus {
  if (run.usage.attempts >= run.limits.maxAttempts) return { exhausted: true, reason: "attempts" };
  const start = Date.parse(run.startedAt || run.updatedAt);
  const current = Date.parse(responsibilityRunTimestamp(now));
  if (Number.isFinite(start) && Number.isFinite(current) && current - start >= run.limits.timeoutMs) return { exhausted: true, reason: "timeout" };
  if (run.usage.contextCharacters > run.limits.maxContextCharacters) return { exhausted: true, reason: "context" };
  if (run.usage.tokens > run.limits.maxTokens) return { exhausted: true, reason: "tokens" };
  if (run.usage.toolCalls >= run.limits.maxToolCalls) return { exhausted: true, reason: "tool-calls" };
  if (run.usage.cloudCostUsd > run.limits.maxCloudCostUsd) return { exhausted: true, reason: "cloud-cost" };
  if (run.childRunIds.length > run.limits.maxParallelChildren) return { exhausted: true, reason: "parallel-children" };
  return { exhausted: false, reason: "" };
}

export function prepareResponsibilityRun(run: ResponsibilityRun, contextCharacters = 0, now = new Date().toISOString()) {
  if (run.state !== "queued") throw new Error("Only a queued Responsibility Run can prepare context.");
  const next: ResponsibilityRun = {
    ...run,
    startedAt: run.startedAt || responsibilityRunTimestamp(now),
    usage: { ...run.usage, contextCharacters: Math.max(0, Math.floor(contextCharacters)) },
  };
  const limit = responsibilityRunLimitStatus(next, now);
  if (limit.exhausted) return withState({ ...next, stopReason: `limit:${limit.reason}` }, "failed", `Run stopped before work because the ${limit.reason} limit was reached.`, now);
  return withState(next, "preparing-context", "Bounded context prepared for the Run.", now);
}

export function beginResponsibilityAttempt(run: ResponsibilityRun, now = new Date().toISOString()) {
  if (TERMINAL_STATES.has(run.state) || run.state === "paused" || run.state === "waiting-for-writer") throw new Error(`Run cannot begin an attempt while ${run.state}.`);
  const limit = responsibilityRunLimitStatus(run, now);
  if (limit.exhausted) return withState({ ...run, stopReason: `limit:${limit.reason}` }, "failed", `Run stopped because the ${limit.reason} limit was reached.`, now);
  const attempts = run.usage.attempts + 1;
  if (attempts > run.limits.maxAttempts) return withState({ ...run, stopReason: "limit:attempts" }, "failed", "Run stopped at the host-owned attempt limit.", now);
  const next: ResponsibilityRun = {
    ...run,
    attemptId: `${run.runId}:attempt:${attempts}`,
    usage: { ...run.usage, attempts },
  };
  return withState(next, "working", `Attempt ${attempts} started within host-owned limits.`, now);
}

export function recordResponsibilityUsage(run: ResponsibilityRun, input: { tokens?: number; cloudCostUsd?: number; contextCharacters?: number }, now = new Date().toISOString()) {
  const next: ResponsibilityRun = {
    ...run,
    usage: {
      ...run.usage,
      tokens: run.usage.tokens + Math.max(0, Math.floor(Number(input.tokens) || 0)),
      cloudCostUsd: Number((run.usage.cloudCostUsd + Math.max(0, Number(input.cloudCostUsd) || 0)).toFixed(4)),
      contextCharacters: Math.max(run.usage.contextCharacters, Math.max(0, Math.floor(Number(input.contextCharacters) || 0))),
    },
  };
  const limit = responsibilityRunLimitStatus(next, now);
  return limit.exhausted ? withState({ ...next, stopReason: `limit:${limit.reason}` }, "failed", `Run stopped because the ${limit.reason} limit was reached.`, now) : next;
}

export function recordResponsibilityToolCall(run: ResponsibilityRun, input: { connectorId: string; arguments: unknown; allowed: boolean }, now = new Date().toISOString()) {
  if (TERMINAL_STATES.has(run.state)) return { run, reminder: "", level: 0 };
  const connectorId = boundedText(input.connectorId, 180);
  const signature = `${connectorId}:${simpleHash(stable(input.arguments))}`;
  const existing = run.repetition.find((item) => item.signature === signature);
  const count = (existing?.count || 0) + 1;
  const deniedCount = (existing?.deniedCount || 0) + (input.allowed ? 0 : 1);
  const replacement: ResponsibilityRunRepetition = { signature, connectorId, count, deniedCount, lastSeenAt: responsibilityRunTimestamp(now) };
  let next: ResponsibilityRun = {
    ...run,
    usage: { ...run.usage, toolCalls: run.usage.toolCalls + 1 },
    repetition: existing ? run.repetition.map((item) => item.signature === signature ? replacement : item) : [...run.repetition, replacement],
  };
  const level = count >= REPETITION_THRESHOLDS[2] ? 3 : count >= REPETITION_THRESHOLDS[1] ? 2 : count >= REPETITION_THRESHOLDS[0] ? 1 : 0;
  const reminder = level === 1
    ? "This equivalent tool call has repeated. Re-read the previous result before trying it again."
    : level === 2
      ? "The same tool call keeps repeating. Change approach, use existing evidence, or conclude this step."
      : level === 3
        ? "Repeated tool use is consuming the Run budget. Stop repeating this call and choose a different bounded approach or finish."
        : "";
  if (reminder) next = addEvent(next, `loop-reminder.${level}`, `${reminder} Repeats=${count}; denied=${deniedCount}.`, now);
  const limit = responsibilityRunLimitStatus(next, now);
  if (limit.exhausted) next = withState({ ...next, stopReason: `limit:${limit.reason}` }, "failed", `Run stopped because the ${limit.reason} limit was reached.`, now);
  return { run: next, reminder, level };
}

export function addResponsibilityArtifact(run: ResponsibilityRun, artifact: Omit<ResponsibilityRunArtifact, "canonical">) {
  const normalized: ResponsibilityRunArtifact = {
    id: boundedText(artifact.id, 180),
    kind: artifact.kind,
    ref: boundedText(artifact.ref, 500),
    producedAt: responsibilityRunTimestamp(artifact.producedAt),
    canonical: false,
  };
  return addEvent({ ...run, artifacts: [...run.artifacts.filter((item) => item.id !== normalized.id), normalized] }, "artifact.produced", `Produced non-canonical ${normalized.kind} ${normalized.id}.`, normalized.producedAt);
}

export function beginResponsibilityVerification(run: ResponsibilityRun, now = new Date().toISOString()) {
  if (run.state !== "working" && run.state !== "revising") throw new Error("Verification starts only after bounded work or revision.");
  return withState(run, "verifying", "Worker output handed to the independent verification boundary.", now);
}

function appendVerification(run: ResponsibilityRun, evidence: ResponsibilityRunVerificationEvidence) {
  return { ...run, verificationEvidence: [...run.verificationEvidence, evidence] };
}

export function recordWorkerVerificationObservation(run: ResponsibilityRun, input: { workerId: string; summary: string; evidenceRef?: string }, now = new Date().toISOString()) {
  const evidence: ResponsibilityRunVerificationEvidence = {
    id: `${run.runId}:worker-observation:${run.verificationEvidence.length + 1}`,
    verifier: boundedText(input.workerId, 180),
    authority: "worker-observation",
    result: "OBSERVATION",
    evidenceRef: boundedText(input.evidenceRef, 500),
    summary: boundedText(input.summary, 800),
    recordedAt: responsibilityRunTimestamp(now),
    immutable: true,
  };
  return addEvent(appendVerification(run, evidence), "verification.worker-observation", "Worker observation recorded without PASS/FAIL authority.", now);
}

export function recordAuthoritativeDeterministicVerification(run: ResponsibilityRun, input: { verifierId: string; result: "PASS" | "FAIL"; evidenceRef: string; summary: string; retestOfEvidenceId?: string }, now = new Date().toISOString()) {
  if (run.verificationMode !== "deterministic") throw new Error("This Run requires writer approval rather than deterministic verification.");
  if (run.state !== "verifying") throw new Error("Authoritative deterministic evidence can be recorded only in verifying state.");
  const evidence: ResponsibilityRunVerificationEvidence = {
    id: `${run.runId}:authoritative:${run.verificationEvidence.length + 1}`,
    verifier: boundedText(input.verifierId, 180),
    authority: "authoritative-system",
    result: input.result,
    evidenceRef: boundedText(input.evidenceRef, 500),
    summary: boundedText(`${input.summary}${input.retestOfEvidenceId ? ` Retest of ${input.retestOfEvidenceId}.` : ""}`, 800),
    recordedAt: responsibilityRunTimestamp(now),
    immutable: true,
  };
  const next = appendVerification(run, evidence);
  if (input.result === "PASS") return withState(next, "completed", "Authoritative deterministic verification passed.", now);
  if (next.usage.attempts >= next.limits.maxAttempts) return withState({ ...next, stopReason: "deterministic-fail-attempt-limit" }, "failed", "Authoritative verification failed at the attempt limit.", now);
  return withState(next, "revising", "Authoritative verification failed. Prior FAIL evidence remains immutable; bounded revision may occur before a fresh retest.", now);
}

export function requestWriterApproval(run: ResponsibilityRun, now = new Date().toISOString()) {
  if (run.verificationMode !== "writer-approval") throw new Error("This Run uses deterministic verification.");
  if (run.state !== "working" && run.state !== "verifying" && run.state !== "revising") throw new Error("Writer approval can be requested only after bounded creative work.");
  return withState(run, "waiting-for-writer", "Creative output is a proposal and is waiting for explicit writer approval.", now);
}

export function recordResponsibilityWriterDecision(run: ResponsibilityRun, input: { writerId: string; decision: "accept" | "reject" | "revise"; note?: string }, now = new Date().toISOString()) {
  if (run.verificationMode !== "writer-approval" || run.state !== "waiting-for-writer") throw new Error("This Run is not waiting for writer approval.");
  const writerId = boundedText(input.writerId, 180);
  if (!writerId) throw new Error("Writer identity is required for a creative approval decision.");
  const decision: ResponsibilityWriterDecision = { writerId, decision: input.decision, note: boundedText(input.note, 800), decidedAt: responsibilityRunTimestamp(now) };
  const evidence: ResponsibilityRunVerificationEvidence = {
    id: `${run.runId}:writer:${run.writerDecisions.length + 1}`,
    verifier: writerId,
    authority: "writer",
    result: input.decision === "accept" ? "ACCEPT" : input.decision === "reject" ? "REJECT" : "REVISE",
    evidenceRef: "",
    summary: decision.note || `Writer chose ${input.decision}.`,
    recordedAt: decision.decidedAt,
    immutable: true,
  };
  const next = appendVerification({ ...run, writerDecisions: [...run.writerDecisions, decision] }, evidence);
  if (input.decision === "accept") return withState(next, "completed", "Writer accepted the Run proposal. PPF canon mutation still requires the separate revision-aware PPF apply boundary.", now);
  if (input.decision === "reject") return withState({ ...next, stopReason: "writer-rejected" }, "failed", "Writer rejected the creative proposal; no canon mutation occurred.", now);
  if (next.usage.attempts >= next.limits.maxAttempts) return withState({ ...next, stopReason: "writer-revise-attempt-limit" }, "failed", "Writer requested revision but the Run attempt limit is exhausted.", now);
  return withState(next, "revising", "Writer requested a bounded revision; the proposal remains non-canonical.", now);
}

export function pauseResponsibilityRun(run: ResponsibilityRun, now = new Date().toISOString()) {
  if (TERMINAL_STATES.has(run.state) || run.state === "paused") return run;
  const resumeState = run.state === "waiting-for-writer" ? "waiting-for-writer" : run.state;
  return withState({ ...run, resumeState }, "paused", "Run paused by the host/user without changing project canon.", now);
}

export function resumeResponsibilityRun(run: ResponsibilityRun, now = new Date().toISOString()) {
  if (run.state !== "paused") return run;
  const limit = responsibilityRunLimitStatus(run, now);
  if (limit.exhausted) return withState({ ...run, resumeState: null, stopReason: `limit:${limit.reason}` }, "failed", `Run cannot resume because the ${limit.reason} limit is exhausted.`, now);
  const state = run.resumeState || "working";
  return withState({ ...run, resumeState: null }, state, "Run resumed with the same objective, permissions and budgets.", now);
}

export function cancelResponsibilityRun(run: ResponsibilityRun, reason = "Cancelled by the user.", now = new Date().toISOString()) {
  if (TERMINAL_STATES.has(run.state)) return run;
  return withState({ ...run, stopReason: boundedText(reason, 500) || "cancelled" }, "cancelled", "Run cancelled. Produced creative artifacts remain non-canonical proposals/evidence only.", now);
}

export function redirectResponsibilityRun(run: ResponsibilityRun, input: { writerId: string; goal: string; note?: string }, now = new Date().toISOString()) {
  if (TERMINAL_STATES.has(run.state)) throw new Error("A completed Run cannot be redirected.");
  if (!boundedText(input.writerId, 180)) throw new Error("Writer identity is required to redirect a Run objective.");
  const goal = boundedText(input.goal, 2_000);
  if (!goal) throw new Error("Redirected Run goal is required.");
  return addEvent({ ...run, goal, objectiveRevision: run.objectiveRevision + 1 }, "objective.redirected", `Writer redirected objective revision ${run.objectiveRevision + 1}. ${boundedText(input.note, 500)}`, now);
}

export function restartResponsibilityRunContext(run: ResponsibilityRun, handoff: Omit<ResponsibilityRunHandoff, "createdAt">, now = new Date().toISOString()) {
  if (TERMINAL_STATES.has(run.state)) throw new Error("A terminal Run cannot start a fresh context round.");
  const compact: ResponsibilityRunHandoff = {
    status: boundedText(handoff.status, 300),
    summary: boundedText(handoff.summary, 1_200),
    evidence: boundedStringList(handoff.evidence, 24, 400),
    nextSteps: boundedStringList(handoff.nextSteps, 24, 400),
    blocker: boundedText(handoff.blocker, 800),
    createdAt: responsibilityRunTimestamp(now),
  };
  const next: ResponsibilityRun = { ...run, contextRound: run.contextRound + 1, handoff: compact };
  if (!samePermissions(run, next) || next.goal !== run.goal || next.objectiveRevision !== run.objectiveRevision) throw new Error("Fresh-context restart cannot change objective or permissions.");
  return addEvent(next, "context.restarted", `Fresh context round ${next.contextRound} started from bounded handoff; prior transcript is not part of the handoff.`, now);
}

export function attachResponsibilityChild(run: ResponsibilityRun, childRunId: string, now = new Date().toISOString()) {
  const child = boundedText(childRunId, 160);
  if (!child) throw new Error("Child Run ID is required.");
  const next = { ...run, childRunIds: [...new Set([...run.childRunIds, child])] };
  if (next.childRunIds.length > next.limits.maxParallelChildren) return withState({ ...next, stopReason: "limit:parallel-children" }, "failed", "Run exceeded its host-owned parallel child limit.", now);
  return addEvent(next, "child.attached", `Attached bounded child Run ${child}.`, now);
}

export function createDeterministicResponsibilityRun(input: Omit<Parameters<typeof createResponsibilityRun>[0], "verificationMode" | "kind">) {
  return createResponsibilityRun({ ...input, kind: "deterministic-verification", verificationMode: "deterministic" });
}

export function createCreativeResponsibilityRun(input: Omit<Parameters<typeof createResponsibilityRun>[0], "verificationMode" | "kind">) {
  return createResponsibilityRun({ ...input, kind: "creative-proposal", verificationMode: "writer-approval" });
}

export function responsibilityRunFromFullVerification(input: {
  runId: string;
  goal?: string;
  profileId?: string;
  deterministicResult: "PASS" | "FAIL";
  evidenceRef: string;
  startedAt: string;
  completedAt: string;
}) {
  let run = createDeterministicResponsibilityRun({
    runId: `responsibility-${boundedText(input.runId, 120)}`,
    goal: input.goal || "Run PlotPickle Full Verification and preserve deterministic evidence.",
    profileId: input.profileId || "bram-gatewick",
    skillUris: [],
    allowedScopes: [],
    allowedConnectorIds: [],
    limits: { maxAttempts: 1, timeoutMs: Math.max(10_000, Date.parse(input.completedAt) - Date.parse(input.startedAt) + 60_000) },
    createdAt: input.startedAt,
  });
  run = prepareResponsibilityRun(run, 0, input.startedAt);
  run = beginResponsibilityAttempt(run, input.startedAt);
  run = beginResponsibilityVerification(run, input.completedAt);
  return recordAuthoritativeDeterministicVerification(run, {
    verifierId: "full-verification-deterministic-runner",
    result: input.deterministicResult,
    evidenceRef: input.evidenceRef,
    summary: "Imported immutable Full Verification result; worker observations cannot override it.",
  }, input.completedAt);
}
