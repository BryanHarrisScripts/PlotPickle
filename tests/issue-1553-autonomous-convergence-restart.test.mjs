import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { runAutonomousConvergenceAndRestart } from "../core/story-workflow/autonomous/convergence-restart.mjs";

const authority = {
  authorityClass: "delegated-autonomous-operator",
  delegated: true,
  autonomousRunId: "autonomous-afterglow-final",
  operatorId: "plotpickle-autonomous-editor",
  modelRole: "quality",
  modelId: "local-quality-model",
  provider: "local",
  runtime: "llama.cpp",
};

const policy = {
  enabled: true,
  allowConvergenceRestart: true,
  autonomousRunId: "autonomous-afterglow-final",
  projectId: "afterglow-v9-working-copy",
  maxAuditRounds: 4,
};

function convergenceState(overrides = {}) {
  return {
    projectId: "afterglow-v9-working-copy",
    revision: "10",
    telemetry: {
      openRequiredDecisions: 0,
      unresolvedHighMediumFindings: 0,
      missingCurrentFrontierRequirements: 0,
      staleWorkOrProposals: 0,
      specialistDisagreements: 0,
      newMaterialFindings: 0,
    },
    findings: [{
      findingId: "finding-ren-17",
      severity: "high",
      disposition: "resolved",
      resolutionRefs: ["ppf-revision:10"],
    }],
    staleAcceptedChangeConflicts: 0,
    integrityErrors: [],
    affectedRefs: [],
    ...overrides,
  };
}

function resumeState(overrides = {}) {
  return {
    projectId: "afterglow-v9-working-copy",
    revision: "10",
    decisionStateDigest: "decision-a1",
    workflowStateDigest: "workflow-b2",
    visualStateDigest: "visual-c3",
    productionStateDigest: "production-d4",
    textStateDigest: "text-e5",
    ...overrides,
  };
}

function ports(events, options = {}) {
  const states = [...(options.states || [
    convergenceState({ revision: "9", affectedRefs: ["ppf:foundations:ren-motivation"] }),
    convergenceState(),
    convergenceState(),
  ])];
  const audits = [...(options.audits || [
    { completed: true, newMaterialMediumHighFindings: 0, changedRefs: ["ppf:foundations:ren-motivation"] },
    { completed: true, newMaterialMediumHighFindings: 0, changedRefs: [] },
  ])];
  let resumeCapture = 0;
  return {
    async inspectConvergenceState(request) {
      events.push(`inspect:${request.phase}${request.round ? `:${request.round}` : ""}`);
      return states.shift() || states.at(-1) || convergenceState();
    },
    async runAuditRound(request) {
      events.push(`audit:${request.round}:${request.expectedRevision}`);
      return audits.shift() || { completed: true, newMaterialMediumHighFindings: 0, changedRefs: [] };
    },
    async rerunAffectedWork(request) {
      events.push(`rerun:${request.round}:${request.changedRefs.join(",")}`);
      return options.rerun || { affectedWorkItemsRerun: 1, unrelatedWorkItemsTouched: false, resultingRevision: "10" };
    },
    async captureResumeState(request) {
      events.push(`capture:${request.phase}`);
      const value = resumeCapture === 0 ? (options.resumeBefore || resumeState()) : (options.resumeAfter || resumeState());
      resumeCapture += 1;
      return value;
    },
    async persistCheckpoint(request) {
      events.push(`persist:${request.expectedRevision}`);
      return options.checkpoint || { persisted: true, revision: request.expectedRevision };
    },
    async restartApplication() {
      events.push("restart");
      return options.restart || { restarted: true };
    },
    async reopenProject(request) {
      events.push(`reopen:${request.expectedRevision}`);
      return options.reopened || { projectId: request.projectId, revision: request.expectedRevision };
    },
  };
}

test("autonomous convergence reaches two clean rounds, reruns only affected work, persists, restarts and resumes", async () => {
  const events = [];
  const result = await runAutonomousConvergenceAndRestart({
    projectId: "afterglow-v9-working-copy",
    currentRevision: "9",
    authority,
    autonomousPolicy: policy,
  }, ports(events));

  assert.equal(result.status, "completed");
  assert.equal(result.readiness.readyForEditorialReview, true);
  assert.equal(result.evidence.twoCleanAuditRounds, true);
  assert.equal(result.evidence.affectedWorkItemsRerun, 1);
  assert.equal(result.evidence.persistence.restartVerified, true);
  assert.equal(result.evidence.resumeState.digestsVerified, true);
  assert.equal(Object.hasOwn(result.evidence, "storyText"), false);
  assert.equal(Object.hasOwn(result.evidence, "chainOfThought"), false);
  assert.deepEqual(events, [
    "inspect:initial",
    "audit:1:9",
    "rerun:1:ppf:foundations:ren-motivation",
    "inspect:after-audit:1",
    "audit:2:10",
    "inspect:after-audit:2",
    "capture:before-restart",
    "persist:10",
    "restart",
    "reopen:10",
    "capture:after-restart",
  ]);
});

test("targeted re-evaluation fails closed if unrelated work is touched", async () => {
  const events = [];
  const result = await runAutonomousConvergenceAndRestart({
    projectId: "afterglow-v9-working-copy",
    currentRevision: "9",
    authority,
    autonomousPolicy: policy,
  }, ports(events, { rerun: { affectedWorkItemsRerun: 3, unrelatedWorkItemsTouched: true } }));

  assert.equal(result.status, "blocked");
  assert.equal(result.blocker.code, "reevaluation-fanout");
  assert.ok(!events.includes("persist:10"));
  assert.ok(!events.includes("restart"));
});

test("convergence is bounded and records a truthful blocker rather than looping forever", async () => {
  const events = [];
  const blockedState = convergenceState({
    revision: "9",
    telemetry: { openRequiredDecisions: 1, missingCurrentFrontierRequirements: 0 },
    findings: [],
  });
  const result = await runAutonomousConvergenceAndRestart({
    projectId: "afterglow-v9-working-copy",
    currentRevision: "9",
    authority,
    autonomousPolicy: { ...policy, maxAuditRounds: 3 },
  }, ports(events, {
    states: [blockedState, blockedState, blockedState, blockedState],
    audits: Array.from({ length: 3 }, () => ({ completed: true, newMaterialMediumHighFindings: 0, changedRefs: [] })),
  }));

  assert.equal(result.status, "blocked");
  assert.equal(result.blocker.code, "convergence-limit");
  assert.equal(result.evidence.auditRounds.length, 3);
  assert.equal(events.filter((item) => item.startsWith("audit:")).length, 3);
  assert.ok(!events.includes("restart"));
});

test("restart resume digest mismatch fails closed after reopen", async () => {
  const events = [];
  const result = await runAutonomousConvergenceAndRestart({
    projectId: "afterglow-v9-working-copy",
    currentRevision: "9",
    authority,
    autonomousPolicy: policy,
  }, ports(events, { resumeAfter: resumeState({ productionStateDigest: "changed-production" }) }));

  assert.equal(result.status, "blocked");
  assert.equal(result.blocker.code, "resume-state-mismatch");
  assert.equal(result.evidence.restartVerified, false);
});

test("normal Human authority cannot be used for autonomous convergence", async () => {
  await assert.rejects(() => runAutonomousConvergenceAndRestart({
    projectId: "afterglow-v9-working-copy",
    currentRevision: "9",
    authority: { authorityClass: "authenticated-human", humanProfileId: "profile-human" },
    autonomousPolicy: policy,
  }, ports([])), /delegated autonomous authority/i);
});

test("convergence controller has no direct PPF, browser storage, database or fixture mutation path", async () => {
  const source = await readFile(new URL("../core/story-workflow/autonomous/convergence-restart.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /applyStoryCommand|saveFoundationProject|sessionStorage|localStorage|writePrivateJson|database|sqlite|fixture/i);
  assert.match(source, /persistCheckpoint/);
  assert.match(source, /restartApplication/);
  assert.match(source, /reopenProject/);
  assert.match(source, /evaluateStoryEditorialReadiness/);
  assert.doesNotMatch(source, /chainOfThought|modelOutput|reasoningTrace/);
});
