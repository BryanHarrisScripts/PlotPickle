import path from "node:path";
import { recordLocalBuzzActivity } from "../buzz-live-activity.mjs";

// BUZZ is a local evidence transport here. It is never a model execution,
// a signed external speaker, a verifier, a code writer or a merge gate.
const SAFE = /^[a-z0-9][a-z0-9._:/-]{0,199}$/i;
function assertRun(campaign, run) {
  if (!campaign || campaign.schemaVersion !== 1
    || !run || run.schemaVersion !== 1
    || run.campaignId !== campaign.campaignId
    || run.scopeHash !== campaign.scopeHash
    || run.exactSha !== campaign.exactSha
    || !Array.isArray(run.handoffs)
    || !Array.isArray(run.observations)
    || !Array.isArray(run.roleResults)) {
    throw new Error("Engineering Team BUZZ receipt does not match the admitted campaign/head.");
  }
  if (run.handoffs.length > campaign.budget.maxMessages) {
    throw new Error("Engineering Team BUZZ exceeds admitted message budget.");
  }
  for (const item of run.handoffs) {
    if (item.schemaVersion !== 1
      || item.campaignId !== campaign.campaignId
      || item.scopeHash !== campaign.scopeHash
      || item.exactSha !== campaign.exactSha
      || item.communicationMode !== campaign.mode
      || item.grantsAuthority !== false
      || item.trust !== "untrusted-suggestion"
      || !campaign.roles.includes(item.fromRole)
      || !campaign.roles.includes(item.toRole)
      || !SAFE.test(item.sourceObservationId || "")
      || !Array.isArray(item.evidenceRefs)
      || (campaign.mode === "lossy" && item.evidenceRefs.length !== 0)
      || !Number.isInteger(item.evidenceReceiptCount)
      || item.evidenceReceiptCount < 0) {
      throw new Error("Engineering Team BUZZ rejects untrusted, stale or privilege-raising handoff.");
    }
  }
  return run;
}

export async function recordEngineeringLocalHandoffs(campaign, run, options = {}) {
  assertRun(campaign, run);
  if (!options.localRoot || !path.isAbsolute(options.localRoot)) {
    throw new Error("Engineering Team BUZZ requires an explicit local evidence directory.");
  }
  const write = options.record || recordLocalBuzzActivity;
  const receipts = [];
  for (let i = 0; i < run.handoffs.length; i++) {
    const handoff = run.handoffs[i];
    // DO NOT copy the model summary or full evidence references into BUZZ.
    // References remain in the host's local restricted campaign ledger.
    const value = await write({
      actorId: "rook-ironquill",
      type: "agent.note",
      eventId: "engineering-" + campaign.scopeHash.slice(0, 16) + "-" + i,
      runId: campaign.campaignId,
      executionId: handoff.sourceObservationId,
      taskId: campaign.taskRef,
      target: "engineering-" + handoff.toRole,
      verified: false,
      actionable: false,
      severity: "info",
      summary: "Engineering Team local " + campaign.mode
        + " handoff " + handoff.fromRole + " to " + handoff.toRole
        + "; source receipts " + handoff.evidenceReceiptCount + "; advisory only.",
      evidence: [{ label: "campaign", ref: "engineering:" + campaign.scopeHash.slice(0, 16) }],
    }, { localRoot: options.localRoot });
    if (value?.ok !== true || value?.buzzMirrored === true) {
      throw new Error("Engineering Team local BUZZ writer did not provide a strictly local receipt.");
    }
    receipts.push(Object.freeze({ index: i, localRecorded: true, externalSigned: false }));
  }
  return Object.freeze({
    campaignId: campaign.campaignId,
    exactSha: campaign.exactSha,
    localRecorded: receipts.length,
    externalSigned: false,
    remoteBuzzDelivered: false,
    verificationGranted: false,
    receipts: Object.freeze(receipts),
  });
}

export function measureEngineeringCommunicationArms(
  structuredCampaign, structuredRun, lossyCampaign, lossyRun,
) {
  if (structuredCampaign?.mode !== "structured" || lossyCampaign?.mode !== "lossy"
    || structuredCampaign.exactSha !== lossyCampaign.exactSha
    || structuredCampaign.taskRef !== lossyCampaign.taskRef
    || structuredCampaign.repository !== lossyCampaign.repository
    || JSON.stringify(structuredCampaign.roles) !== JSON.stringify(lossyCampaign.roles)
    || JSON.stringify(structuredCampaign.budget) !== JSON.stringify(lossyCampaign.budget)) {
    throw new Error("Engineering Team comparison requires equal commit, task, roles and budget.");
  }
  assertRun(structuredCampaign, structuredRun);
  assertRun(lossyCampaign, lossyRun);
  if (structuredRun.status !== "observed" || lossyRun.status !== "observed"
    || structuredRun.roleResults.length !== structuredCampaign.roles.length
    || lossyRun.roleResults.length !== lossyCampaign.roles.length
    || [...structuredRun.roleResults, ...lossyRun.roleResults].some((item) => item.status !== "observed")) {
    throw new Error("Engineering Team comparison refuses blocked, stale or partial runs.");
  }
  function observedMetrics(run) {
    return Object.freeze({
      handoffs: run.handoffs.length,
      messageBytes: run.handoffs.reduce((count, item) => count + Buffer.byteLength(JSON.stringify(item), "utf8"), 0),
      roleObservations: run.observations.length,
    });
  }
  return Object.freeze({
    exactSha: structuredCampaign.exactSha,
    taskRef: structuredCampaign.taskRef,
    structured: observedMetrics(structuredRun),
    lossy: observedMetrics(lossyRun),
    metricSource: "actual-serialised-local-handoff-payloads",
    defectDetectionEffect: null,
    falsePositiveRate: null,
    executionCostUsd: null,
    conclusion: "not-established",
    independentlyVerified: false,
    mergeEligible: false,
  });
}
