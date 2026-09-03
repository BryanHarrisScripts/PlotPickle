import { createHash } from "node:crypto";
import { normalizeLifecycleEnvelope } from "./lifecycle-contract.mjs";

export const PLOTPICKLE_LIFECYCLE_VALIDATION_RESULTS = Object.freeze(["pass", "fail", "blocked"]);
const RESULTS = new Set(PLOTPICKLE_LIFECYCLE_VALIDATION_RESULTS);

function text(value, label) {
  const normalized = typeof value === "string" ? value.trim() : "";
  if (!normalized) throw new Error(`${label} is required.`);
  return normalized;
}

function refs(value, label) {
  if (!Array.isArray(value)) throw new Error(`${label} must be an array.`);
  return Object.freeze(value.map((item, index) => text(item, `${label}[${index}]`)));
}

function fingerprint(input) {
  return `lifecycle-failure-${createHash("sha256").update([
    input.checkId,
    input.scopeRef,
    input.reasonRef,
  ].join("\n")).digest("hex").slice(0, 20)}`;
}

export function normalizeLifecycleValidationEvidence(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Lifecycle validation evidence must be an object.");
  const result = text(value.result, "validation result");
  if (!RESULTS.has(result)) throw new Error(`Lifecycle validation result ${result} is not supported.`);
  const normalized = {
    checkId: text(value.checkId, "validation checkId"),
    result,
    scopeRef: text(value.scopeRef, "validation scopeRef"),
    exactRevisionRef: text(value.exactRevisionRef, "validation exactRevisionRef"),
    authorityRef: text(value.authorityRef, "validation authorityRef"),
    reasonRef: text(value.reasonRef, "validation reasonRef"),
    evidenceRefs: refs(value.evidenceRefs ?? [], "validation evidenceRefs"),
    rerunRef: text(value.rerunRef, "validation rerunRef"),
    safeNextAction: text(value.safeNextAction, "validation safeNextAction"),
    repairActorRef: typeof value.repairActorRef === "string" ? value.repairActorRef.trim() : "",
  };
  if (normalized.repairActorRef && normalized.repairActorRef === normalized.authorityRef) {
    throw new Error("A repair actor cannot certify its own lifecycle validation result.");
  }
  return Object.freeze({
    ...normalized,
    failureFingerprint: result === "pass" ? "" : fingerprint(normalized),
  });
}

function stop(evidence, code, reason) {
  return Object.freeze({
    action: "stop",
    code,
    reason,
    checkId: evidence.checkId,
    failureFingerprint: evidence.failureFingerprint,
    safeNextAction: evidence.safeNextAction,
  });
}

export function decideLifecycleRepair(input) {
  const envelope = normalizeLifecycleEnvelope(input?.envelope);
  const evidence = normalizeLifecycleValidationEvidence(input?.evidence);
  if (envelope.stage !== "validate-repair") throw new Error("Lifecycle repair decisions require the validate-repair stage.");

  if (evidence.result === "pass") {
    return Object.freeze({
      action: "advance",
      code: "deterministic-validation-pass",
      toStage: "approve-persist",
      checkId: evidence.checkId,
      authorityRef: evidence.authorityRef,
      exactRevisionRef: evidence.exactRevisionRef,
    });
  }
  if (evidence.result === "blocked") return stop(evidence, "deterministic-validation-blocked", "The authoritative validator is blocked; AI repair cannot waive or reinterpret the blocker.");
  if (envelope.repairBudget.attempts >= envelope.repairBudget.maxAttempts) return stop(evidence, "repair-budget-exhausted", "The bounded repair budget is exhausted.");

  const history = Array.isArray(input?.priorFailureFingerprints) ? input.priorFailureFingerprints.filter((item) => typeof item === "string") : [];
  const repeats = history.filter((item) => item === evidence.failureFingerprint).length;
  if (repeats >= 2) return stop(evidence, "repeated-failure-stop", "The same deterministic failure fingerprint has repeated without resolution.");
  if (history.length >= 2 && history.at(-2) === evidence.failureFingerprint && history.at(-1) !== evidence.failureFingerprint) {
    return stop(evidence, "repair-churn-stop", "The deterministic failure history is cycling between fingerprints.");
  }

  return Object.freeze({
    action: "repair",
    code: "bounded-repair-authorized",
    checkId: evidence.checkId,
    authorityRef: evidence.authorityRef,
    exactRevisionRef: evidence.exactRevisionRef,
    failureFingerprint: evidence.failureFingerprint,
    attempt: envelope.repairBudget.attempts + 1,
    maxAttempts: envelope.repairBudget.maxAttempts,
    requiredRerun: Object.freeze({
      checkId: evidence.checkId,
      authorityRef: evidence.authorityRef,
      rerunRef: evidence.rerunRef,
    }),
  });
}

export function validateLifecycleRepairRerun(instruction, rerunEvidence) {
  if (!instruction || instruction.action !== "repair" || !instruction.requiredRerun) throw new Error("Lifecycle repair rerun requires an authorized repair instruction.");
  const evidence = normalizeLifecycleValidationEvidence(rerunEvidence);
  for (const key of ["checkId", "authorityRef", "rerunRef"]) {
    if (evidence[key] !== instruction.requiredRerun[key]) {
      throw new Error(`Repair must be verified by the same authoritative deterministic ${key}.`);
    }
  }
  if (evidence.exactRevisionRef === instruction.exactRevisionRef) {
    throw new Error("Repair verification requires fresh exact-revision evidence after the repair.");
  }
  return Object.freeze({
    ok: evidence.result === "pass",
    result: evidence.result,
    checkId: evidence.checkId,
    authorityRef: evidence.authorityRef,
    exactRevisionRef: evidence.exactRevisionRef,
    failureFingerprint: evidence.failureFingerprint,
    safeNextAction: evidence.safeNextAction,
  });
}
