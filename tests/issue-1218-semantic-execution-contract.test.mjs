import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  ENGINEERING_REPAIR_PHASE_PROFILE,
  beginSemanticAction,
  buildSemanticExperienceCandidate,
  completeSemanticAction,
  createSemanticExecution,
  recordSemanticEvaluation,
  recordSemanticObservation,
  safeSemanticExecutionRecord,
  semanticExperienceScopeMatches,
  transitionSemanticExecution,
  validateSemanticExecutionRecord,
} from "../scripts/semantic-execution.mjs";

function createRecord(overrides = {}) {
  return createSemanticExecution({
    taskId: overrides.taskId || "finding-1218",
    agentId: overrides.agentId || "pi-repair",
    domain: "engineering",
    scope: overrides.scope || { profileId: "human-a", projectId: "project-a", agentId: "pi-repair", sessionId: "session-a" },
    phaseProfile: ENGINEERING_REPAIR_PHASE_PROFILE,
    maxRepairAttempts: overrides.maxRepairAttempts ?? 2,
    maxRepeatedFailureCount: overrides.maxRepeatedFailureCount ?? 2,
    intent: {
      objective: "Repair one verified navigation finding without unrelated changes.",
      constraints: ["bounded target", "deterministic verification owns PASS"],
      success: "Focused verification and production build pass.",
      allowedActionClasses: ["developer.repair"],
      allowedTargets: ["uat:finding-1218"],
      exclusions: ["credentials", "ppf-canon"],
    },
  });
}

function understand(record) {
  recordSemanticObservation(record, {
    position: "state",
    source: "verification-finding",
    summary: "The verified finding affects one navigation target.",
    evidence: [{ kind: "finding", ref: "finding-1218", summary: "confirmed" }],
  });
  recordSemanticEvaluation(record, {
    status: "pass",
    verifier: "finding-verifier",
    evidence: [{ kind: "finding", ref: "finding-1218", summary: "confirmed" }],
  });
  transitionSemanticExecution(record, "ACT", { reason: "Target identified." });
  return record;
}

function act(record, { status = "pass", summary = "repair applied" } = {}) {
  recordSemanticObservation(record, {
    position: "before",
    source: "worktree",
    summary: "Observed current isolated worktree state before repair.",
    evidence: [{ kind: "git", ref: "base-head", summary: "clean" }],
  });
  beginSemanticAction(record, {
    actionClass: "developer.repair",
    capability: "developer.repair.pi",
    target: "uat:finding-1218",
    summary: "Apply the smallest repair.",
  });
  completeSemanticAction(record, {
    status,
    resultSummary: summary,
    evidence: [{ kind: "worktree", ref: "candidate", summary }],
  });
  recordSemanticObservation(record, {
    position: "after",
    source: "worktree",
    summary: status === "pass" ? "Observed candidate repair in the worktree." : "Observed repair attempt did not satisfy the target.",
    evidence: [{ kind: "worktree", ref: "candidate", summary: status }],
  });
  return record;
}

function evaluateAct(record, status = "pass", failureClass = "") {
  recordSemanticEvaluation(record, {
    status,
    verifier: "focused-test",
    evidence: [{ kind: "test", ref: "focused", summary: status }],
    mismatch: status === "pass" ? "" : "Focused test is still failing.",
    failureClass,
    repairAllowed: status !== "pass",
  });
  return record;
}

function verifyAndComplete(record) {
  transitionSemanticExecution(record, "VERIFY", { reason: "Repair candidate is ready for deterministic verification." });
  recordSemanticObservation(record, {
    position: "state",
    source: "deterministic-gates",
    summary: "Focused regression and production build passed.",
    evidence: [
      { kind: "test", ref: "test:semantic", summary: "pass" },
      { kind: "build", ref: "npm run build", summary: "pass" },
    ],
  });
  recordSemanticEvaluation(record, {
    status: "pass",
    verifier: "deterministic-gates",
    evidence: [{ kind: "build", ref: "npm run build", summary: "pass" }],
  });
  transitionSemanticExecution(record, "COMPLETE", { reason: "Declared success condition is verified." });
  return record;
}

test("#1218 defines a scoped versioned semantic execution envelope", () => {
  const record = createRecord();
  const checked = validateSemanticExecutionRecord(record);
  assert.equal(checked.ok, true, checked.errors.join("\n"));
  assert.equal(record.schemaVersion, 1);
  assert.equal(record.currentPhase, "UNDERSTAND");
  assert.equal(record.status, "running");
  assert.equal(record.intent.allowedActionClasses[0], "developer.repair");
  assert.equal(record.phaseProfile.id, "engineering-repair-v1");
});

test("COMPLETE cannot be reached because a model merely says done", () => {
  const record = createRecord();
  assert.throws(() => transitionSemanticExecution(record, "COMPLETE"), /Invalid semantic transition/);
  understand(record);
  assert.throws(() => transitionSemanticExecution(record, "VERIFY"), /requires evaluation/);
});

test("missing evidence yields no fabricated semantic PASS", () => {
  const record = createRecord();
  recordSemanticObservation(record, { position: "state", source: "observer", summary: "State is visible but no evidence reference was retained." });
  assert.throws(() => recordSemanticEvaluation(record, { status: "pass", verifier: "agent" }), /requires evidence/);
});

test("invalid phase transitions are rejected", () => {
  const record = createRecord();
  recordSemanticObservation(record, { position: "state", source: "finding", summary: "Observed.", evidence: ["confirmed"] });
  recordSemanticEvaluation(record, { status: "pass", evidence: ["confirmed"] });
  assert.throws(() => transitionSemanticExecution(record, "VERIFY"), /Invalid semantic transition UNDERSTAND -> VERIFY/);
});

test("actions outside the current phase capability are rejected", () => {
  const record = createRecord();
  assert.throws(() => beginSemanticAction(record, { actionClass: "developer.repair", target: "uat:finding-1218" }), /not permitted in semantic phase UNDERSTAND/);
});

test("bounded actions require a current observation and authorized target", () => {
  const record = understand(createRecord());
  assert.throws(() => beginSemanticAction(record, { actionClass: "developer.repair", target: "uat:finding-1218" }), /requires a current observation before action/);
  recordSemanticObservation(record, { position: "before", source: "worktree", summary: "Observed.", evidence: ["clean"] });
  assert.throws(() => beginSemanticAction(record, { actionClass: "developer.repair", target: "credentials" }), /outside the semantic intent scope/);
  assert.throws(() => beginSemanticAction(record, { actionClass: "developer.repair", target: "uat:other-finding" }), /outside the semantic intent scope/);
});

test("post-action observation is mandatory before evaluation", () => {
  const record = understand(createRecord());
  recordSemanticObservation(record, { position: "before", source: "worktree", summary: "Observed.", evidence: ["clean"] });
  beginSemanticAction(record, { actionClass: "developer.repair", target: "uat:finding-1218" });
  completeSemanticAction(record, { status: "pass", resultSummary: "changed" });
  assert.throws(() => recordSemanticEvaluation(record, { status: "pass", evidence: ["test pass"] }), /requires a post-action observation/);
});

test("failed verification routes only into an explicitly permitted bounded REPAIR", () => {
  const record = understand(createRecord());
  act(record, { status: "fail" });
  evaluateAct(record, "fail", "navigation-regression");
  transitionSemanticExecution(record, "REPAIR", { reason: "Focused regression remains red." });
  assert.equal(record.currentPhase, "REPAIR");
  assert.equal(record.repairPolicy.attempts, 1);
  assert.equal(record.transitions.at(-1).from, "ACT");
});

test("REPAIR cannot silently broaden the task target", () => {
  const record = understand(createRecord());
  act(record, { status: "fail" });
  evaluateAct(record, "fail", "navigation-regression");
  transitionSemanticExecution(record, "REPAIR");
  recordSemanticObservation(record, { position: "before", source: "worktree", summary: "Observed failed state.", evidence: ["red"] });
  assert.throws(() => beginSemanticAction(record, { actionClass: "developer.repair", target: "uat:unrelated-cleanup" }), /outside the semantic intent scope/);
});

test("repair retries are bounded and repeated identical failures cannot loop forever", () => {
  const record = understand(createRecord({ maxRepairAttempts: 1, maxRepeatedFailureCount: 1 }));
  act(record, { status: "fail" });
  evaluateAct(record, "fail", "same-failure");
  transitionSemanticExecution(record, "REPAIR");
  recordSemanticObservation(record, { position: "before", source: "worktree", summary: "Observed failed state.", evidence: ["red"] });
  beginSemanticAction(record, { actionClass: "developer.repair", target: "uat:finding-1218" });
  completeSemanticAction(record, { status: "fail", resultSummary: "same failure" });
  recordSemanticObservation(record, { position: "after", source: "test", summary: "Same failure remains.", evidence: ["red"] });
  recordSemanticEvaluation(record, { status: "fail", verifier: "test", evidence: ["red"], mismatch: "Focused test is still failing.", failureClass: "same-failure", repairAllowed: true });
  transitionSemanticExecution(record, "VERIFY");
  recordSemanticObservation(record, { position: "state", source: "test", summary: "Same failure remains after bounded repair.", evidence: ["red"] });
  recordSemanticEvaluation(record, { status: "fail", verifier: "test", evidence: ["red"], mismatch: "Focused test is still failing.", failureClass: "same-failure", repairAllowed: true });
  transitionSemanticExecution(record, "REPAIR");
  assert.equal(record.status, "blocked");
  assert.equal(record.currentPhase, "BLOCKED");
  assert.match(record.completion.summary, /Repair limit reached|Repeated identical failure limit reached/);
});

test("a successful execution records final evidence and produces only a candidate experience", () => {
  const record = understand(createRecord());
  act(record);
  evaluateAct(record, "pass");
  verifyAndComplete(record);
  assert.equal(record.status, "completed");
  assert.equal(record.completion.finalDisposition, "pass");
  assert.ok(record.completion.evidence.length > 0);
  const candidate = buildSemanticExperienceCandidate(record);
  assert.equal(candidate.status, "candidate");
  assert.equal(candidate.authorityClass, "derived");
  assert.equal(candidate.verified, true);
  assert.equal(candidate.memoryType, "procedural");
});

test("failed approaches never become verified successful procedures", () => {
  const blocked = understand(createRecord({ maxRepairAttempts: 0 }));
  act(blocked, { status: "fail" });
  evaluateAct(blocked, "fail", "failed-approach");
  transitionSemanticExecution(blocked, "REPAIR");
  assert.equal(blocked.status, "blocked");
  assert.equal(buildSemanticExperienceCandidate(blocked), null);
});

test("successful recovery retains failed approach as failure-recovery history rather than success", () => {
  const record = understand(createRecord());
  act(record, { status: "fail", summary: "first attempt failed" });
  evaluateAct(record, "fail", "first-attempt");
  transitionSemanticExecution(record, "REPAIR");
  recordSemanticObservation(record, { position: "before", source: "worktree", summary: "Observed remaining mismatch.", evidence: ["red"] });
  beginSemanticAction(record, { actionClass: "developer.repair", target: "uat:finding-1218", summary: "Target only the verified mismatch." });
  completeSemanticAction(record, { status: "pass", resultSummary: "targeted repair passed", evidence: ["green"] });
  recordSemanticObservation(record, { position: "after", source: "test", summary: "Focused test is green.", evidence: ["green"] });
  recordSemanticEvaluation(record, { status: "pass", verifier: "test", evidence: ["green"] });
  verifyAndComplete(record);
  const candidate = buildSemanticExperienceCandidate(record);
  assert.equal(candidate.memoryType, "failure-recovery");
  assert.equal(candidate.failedApproaches.length, 1);
  assert.ok(candidate.successfulPattern.every((item) => !/first attempt failed/i.test(item.summary)));
});

test("structured experience remains scope-bound and cannot match another Human/project/agent", () => {
  const record = understand(createRecord());
  act(record);
  evaluateAct(record, "pass");
  verifyAndComplete(record);
  const candidate = buildSemanticExperienceCandidate(record);
  assert.equal(semanticExperienceScopeMatches(candidate, { profileId: "human-a", projectId: "project-a", agentId: "pi-repair", sessionId: "session-a" }), true);
  assert.equal(semanticExperienceScopeMatches(candidate, { profileId: "human-b", projectId: "project-a", agentId: "pi-repair", sessionId: "session-a" }), false);
  assert.equal(semanticExperienceScopeMatches(candidate, { profileId: "human-a", projectId: "project-b", agentId: "pi-repair", sessionId: "session-a" }), false);
});

test("execution evidence strips secret material and hidden reasoning fields", () => {
  const record = createRecord();
  recordSemanticObservation(record, {
    position: "state",
    source: "probe",
    summary: "token=abc123456789 nsec1abcdefghijklmnop sk-abcdefghijklmnop",
    evidence: [{ kind: "probe", ref: "private", summary: "Bearer abcdefghijklmnop" }],
    reasoning: "should never persist",
  });
  const safe = safeSemanticExecutionRecord({ ...record, chainOfThought: "private", prompt: "raw prompt", password: "secret-value" });
  const serialized = JSON.stringify(safe);
  assert.doesNotMatch(serialized, /abc123456789|nsec1abcdefghijklmnop|sk-abcdefghijklmnop|Bearer abcdefghijklmnop|secret-value|raw prompt|private\"/i);
  assert.doesNotMatch(serialized, /chainOfThought|\"prompt\"|\"reasoning\"/i);
  assert.match(serialized, /REDACTED/);
});

test("worker/model choice is outside the stable semantic contract", () => {
  const pi = createRecord({ agentId: "pi-repair" });
  const cline = createRecord({ agentId: "cline-repair", scope: { profileId: "human-a", projectId: "project-a", agentId: "cline-repair", sessionId: "session-a" } });
  assert.equal(pi.phaseProfile.id, cline.phaseProfile.id);
  assert.deepEqual(Object.keys(pi.phaseProfile.phases), Object.keys(cline.phaseProfile.phases));
  assert.equal(pi.intent.allowedActionClasses[0], "developer.repair");
  assert.equal(cline.intent.allowedActionClasses[0], "developer.repair");
});

test("#1218 is wired in front of the existing isolated UAT repair worker without replacing #989 authority", async () => {
  const [closedLoop, semanticWrapper, verificationGraph] = await Promise.all([
    readFile(new URL("../scripts/run-uat-closed-loop.mjs", import.meta.url), "utf8"),
    readFile(new URL("../scripts/run-semantic-uat-repair.mjs", import.meta.url), "utf8"),
    readFile(new URL("./issue-989-verification-execution-graph.test.mjs", import.meta.url), "utf8"),
  ]);
  assert.match(closedLoop, /run-semantic-uat-repair\.mjs/);
  assert.match(semanticWrapper, /run-uat-repair-agent\.mjs/);
  assert.match(semanticWrapper, /candidate-only; durable promotion remains owned by PlotPickle Memory Service #1200/);
  assert.match(semanticWrapper, /hiddenReasoningStored:\s*false/);
  assert.match(verificationGraph, /unverified findings do not reach write-capable workers|hands Pi only confirmed findings/i);
});
