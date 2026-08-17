import { bestEffortLiveBuzzActivity } from "./buzz-live-activity.mjs";

async function emit(input, baseUrl) {
  return bestEffortLiveBuzzActivity(input, baseUrl ? { baseUrl } : undefined);
}

export async function reportVerificationLifecycle({ record, review, repair, github, reviewRef, baseUrl = "" }) {
  const results = [];
  results.push(await emit({
    type: "decision.record",
    actorId: "bram-gatewick",
    summary: `Full Verification ${record.runId} started for commit ${String(record.git?.commit || "unknown").slice(0, 12)}. Deterministic stages own PASS/FAIL.`,
    severity: "info",
    target: `verification run ${record.runId}`,
    verified: true,
    actionable: false,
    occurredAt: record.startedAt,
  }, baseUrl));

  if (Array.isArray(record.failureSummaries) && record.failureSummaries.length) {
    results.push(await emit({
      type: "uat.result",
      actorId: "bram-gatewick",
      summary: `Full Verification ${record.runId} recorded ${record.failureSummaries.length} deterministic failed or blocked stage(s): ${record.failureSummaries.map((item) => item.stage).join("; ")}.`,
      severity: "high",
      target: `verification run ${record.runId}`,
      verified: true,
      actionable: true,
      occurredAt: record.completedAt,
    }, baseUrl));
  }

  results.push(await emit({
    type: "decision.record",
    actorId: "bram-gatewick",
    summary: `Full Verification ${record.runId} completed ${record.passCount}/${record.totalStages} deterministic stages. Advisory agent review was queued separately from the authoritative result.`,
    severity: record.deterministicResult === "PASS" ? "info" : "high",
    target: `verification run ${record.runId}`,
    verified: true,
    actionable: record.deterministicResult === "FAIL",
    occurredAt: record.completedAt,
  }, baseUrl));

  results.push(await emit({
    type: "decision.record",
    actorId: "bram-gatewick",
    summary: `Advisory review for ${record.runId} completed: agent observations=${review.agentObservations.length}, product defects=${review.likelyProductDefects.length}, harness/environment observations=${review.likelyHarnessDefects.length}. The deterministic result remains ${record.deterministicResult}.`,
    severity: record.deterministicResult === "PASS" ? "info" : "medium",
    target: `verification run ${record.runId}`,
    verified: true,
    actionable: review.repairRequired === true,
    evidence: reviewRef ? [{ label: "Verification review", ref: reviewRef }] : [],
  }, baseUrl));

  if (repair?.attempted) {
    results.push(await emit({
      type: "repair.request",
      actorId: "rook-ironquill",
      summary: `Pi repair workflow for ${record.runId} ${String(repair.status || "completed").toLowerCase()}. A new deterministic Full Verification rerun is required before PASS/FAIL can change.`,
      severity: repair.status === "COMPLETE" ? "medium" : "high",
      target: `verification run ${record.runId}`,
      verified: repair.status === "COMPLETE",
      actionable: repair.status !== "COMPLETE",
      evidence: repair.evidenceRef ? [{ label: "Bounded repair evidence", ref: repair.evidenceRef }] : [],
    }, baseUrl));
  }

  const retestOf = Array.isArray(record.retests) ? record.retests.find((item) => item?.kind === "retest-of" && item.runId)?.runId : "";
  if (retestOf) {
    results.push(await emit({
      type: "uat.result",
      actorId: "bram-gatewick",
      summary: `Deterministic retest ${record.runId} completed for earlier run ${retestOf}: ${record.headline}. The earlier result remains preserved in the Verification Inbox.`,
      severity: record.deterministicResult === "PASS" ? "info" : "high",
      target: `retest of ${retestOf}`,
      verified: true,
      actionable: record.deterministicResult === "FAIL",
    }, baseUrl));
  }

  if (github) {
    results.push(await emit({
      type: "github.status",
      actorId: "fen-copperwind",
      summary: `Sanitized Full Verification review for ${record.runId} was published as one commit-linked GitHub comment for ${String(record.git?.commit || "").slice(0, 12)}.`,
      severity: "info",
      target: `commit ${record.git?.commit || "unknown"}`,
      verified: true,
      actionable: false,
    }, baseUrl));
  }

  return results;
}
