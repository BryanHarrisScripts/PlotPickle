import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import {
  decideLifecycleRepair,
  normalizeLifecycleValidationEvidence,
  validateLifecycleRepairRerun,
} from "../core/lifecycle/lifecycle-validation.mjs";

function envelope(overrides = {}) {
  return {
    schemaVersion: 1,
    runId: "run-validation-001",
    projectId: "project-afterglow",
    revision: "12",
    stage: "validate-repair",
    priorTransition: { from: "create-execute", to: "validate-repair", at: "", reasonRef: "verification:run" },
    actor: { actorId: "guest-validation", kind: "guest", authorityClass: "delegated-guest-autonomous-operator", delegated: true, humanProfileId: "", operatorId: "guest-operator", authorityRef: "authority:guest-validation" },
    intent: { kind: "story-run", ref: "intent:afterglow" },
    planOrDecisionRefs: [],
    capabilities: ["route:story-workflow"],
    contextRefs: ["ppf:afterglow@12"],
    inputRefs: [],
    outputRefs: ["candidate:afterglow"],
    evidenceRefs: ["evidence:verification"],
    integrationRefs: [],
    contractRefs: ["verification:scripts/verification-findings.mjs"],
    validation: { result: "fail", authorityRef: "workflow:ben-code-quality", evidenceRefs: ["evidence:verification"] },
    repairBudget: { attempts: 0, maxAttempts: 2 },
    persistence: { classification: "none", ownerRef: "", decision: "pending", approvalRef: "" },
    stopReason: { code: "", detailRef: "" },
    nextAction: { action: "repair", ref: "finding:ben", continuationRef: "run:validation-001" },
    ...overrides,
  };
}

function failure(overrides = {}) {
  return {
    checkId: "ben-code-quality",
    result: "fail",
    scopeRef: "scope:changed-files",
    exactRevisionRef: `git:${"a".repeat(40)}`,
    authorityRef: "workflow:ben-code-quality",
    reasonRef: "finding:fan-out-limit",
    evidenceRefs: ["evidence:ben-report"],
    rerunRef: ".github/workflows/ben-code-quality.yml",
    safeNextAction: "repair-smallest-confirmed-root-cause",
    repairActorRef: "agent:repair-worker",
    ...overrides,
  };
}

test("#1648 standardizes deterministic validation evidence with stable failure fingerprints", () => {
  const first = normalizeLifecycleValidationEvidence(failure());
  const second = normalizeLifecycleValidationEvidence(failure());
  assert.equal(first.failureFingerprint, second.failureFingerprint);
  assert.equal(first.checkId, "ben-code-quality");
  assert.equal(first.result, "fail");
  assert.equal(first.exactRevisionRef, `git:${"a".repeat(40)}`);
  assert.equal(first.rerunRef, ".github/workflows/ben-code-quality.yml");
  assert.ok(first.failureFingerprint.startsWith("lifecycle-failure-"));
});

test("#1648 prevents a repair actor from certifying its own result", () => {
  assert.throws(
    () => normalizeLifecycleValidationEvidence(failure({ authorityRef: "agent:repair-worker" })),
    /cannot certify its own lifecycle validation result/,
  );
});

test("#1648 authorizes only bounded repair for a confirmed deterministic failure", () => {
  const decision = decideLifecycleRepair({ envelope: envelope(), evidence: failure(), priorFailureFingerprints: [] });
  assert.equal(decision.action, "repair");
  assert.equal(decision.code, "bounded-repair-authorized");
  assert.equal(decision.attempt, 1);
  assert.equal(decision.maxAttempts, 2);
  assert.equal(decision.requiredRerun.checkId, "ben-code-quality");
  assert.equal(decision.requiredRerun.authorityRef, "workflow:ben-code-quality");
  assert.equal(decision.requiredRerun.rerunRef, ".github/workflows/ben-code-quality.yml");
});

test("#1648 deterministic PASS advances and BLOCKED stops without AI waiver", () => {
  const pass = decideLifecycleRepair({ envelope: envelope(), evidence: failure({ result: "pass", reasonRef: "result:pass", safeNextAction: "persist" }) });
  assert.equal(pass.action, "advance");
  assert.equal(pass.toStage, "approve-persist");

  const blocked = decideLifecycleRepair({ envelope: envelope(), evidence: failure({ result: "blocked", reasonRef: "blocker:environment", safeNextAction: "resolve-authoritative-blocker" }) });
  assert.equal(blocked.action, "stop");
  assert.equal(blocked.code, "deterministic-validation-blocked");
});

test("#1648 stops on retry exhaustion repeated unchanged failure and churn", () => {
  const exhausted = decideLifecycleRepair({
    envelope: envelope({ repairBudget: { attempts: 2, maxAttempts: 2 } }),
    evidence: failure(),
  });
  assert.equal(exhausted.action, "stop");
  assert.equal(exhausted.code, "repair-budget-exhausted");

  const fingerprint = normalizeLifecycleValidationEvidence(failure()).failureFingerprint;
  const repeated = decideLifecycleRepair({
    envelope: envelope({ repairBudget: { attempts: 1, maxAttempts: 3 } }),
    evidence: failure(),
    priorFailureFingerprints: [fingerprint, fingerprint],
  });
  assert.equal(repeated.code, "repeated-failure-stop");

  const other = normalizeLifecycleValidationEvidence(failure({ reasonRef: "finding:other" })).failureFingerprint;
  const churn = decideLifecycleRepair({
    envelope: envelope({ repairBudget: { attempts: 2, maxAttempts: 4 } }),
    evidence: failure(),
    priorFailureFingerprints: [fingerprint, other],
  });
  assert.equal(churn.code, "repair-churn-stop");
});

test("#1648 requires the same deterministic gate to verify repair on a fresh exact revision", () => {
  const instruction = decideLifecycleRepair({ envelope: envelope(), evidence: failure() });
  assert.throws(
    () => validateLifecycleRepairRerun(instruction, failure({ result: "pass", reasonRef: "result:pass", safeNextAction: "persist" })),
    /fresh exact-revision evidence/,
  );
  assert.throws(
    () => validateLifecycleRepairRerun(instruction, failure({ checkId: "learn-validation", result: "pass", exactRevisionRef: `git:${"b".repeat(40)}`, reasonRef: "result:pass", safeNextAction: "persist" })),
    /same authoritative deterministic checkId/,
  );

  const rerun = validateLifecycleRepairRerun(instruction, failure({
    result: "pass",
    exactRevisionRef: `git:${"b".repeat(40)}`,
    reasonRef: "result:pass",
    safeNextAction: "persist",
  }));
  assert.equal(rerun.ok, true);
  assert.equal(rerun.result, "pass");
  assert.equal(rerun.checkId, "ben-code-quality");
});

test("#1648 maps lifecycle validation to existing validators rather than inventing parallel gates", async () => {
  const map = JSON.parse(await readFile(new URL("../config/lifecycle-validation-gates.json", import.meta.url), "utf8"));
  assert.equal(map.schemaVersion, 1);
  assert.equal(map.owner, "platform");
  assert.equal(map.principle, "reuse-existing-deterministic-validators");
  const ids = new Set(map.gates.map((gate) => gate.checkId));
  for (const required of ["ben-code-quality", "learn-validation", "visual-readiness", "autonomous-qa-campaign", "repository-architecture-inventory", "story-workbench", "story-decisions", "windows-installer", "full-verification"]) {
    assert.ok(ids.has(required), `missing existing validator mapping ${required}`);
  }
  for (const gate of map.gates) await access(new URL(`../${gate.workflowRef}`, import.meta.url));
});
