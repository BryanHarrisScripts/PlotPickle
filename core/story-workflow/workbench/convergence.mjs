import { storyWorkbenchConvergenceTelemetry } from "./core.mjs";

export const STORY_CONVERGENCE_EVIDENCE_VERSION = 1;

const TERMINAL_FINDING_DISPOSITIONS = new Set([
  "resolved",
  "rejected",
  "superseded",
  "deferred",
  "blocked",
  "duplicate",
  "not-reproducible",
]);

function text(value, maximum = 1_200) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function integer(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 0;
}

function strings(value, maximum = 128, itemMaximum = 360) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => text(item, itemMaximum)).filter(Boolean))].slice(0, maximum);
}

export function normalizeStoryFindingLifecycle(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Story finding lifecycle requires a structured finding record.");
  const findingId = text(input.findingId, 180);
  const severity = text(input.severity, 40).toLowerCase();
  const disposition = text(input.disposition, 60).toLowerCase();
  if (!findingId) throw new Error("Story finding lifecycle requires finding identity.");
  if (!new Set(["low", "medium", "high"]).has(severity)) throw new Error(`Unsupported story finding severity ${severity || "missing"}.`);
  if (disposition !== "open" && !TERMINAL_FINDING_DISPOSITIONS.has(disposition)) {
    throw new Error(`Unsupported story finding disposition ${disposition || "missing"}.`);
  }
  const resolutionRefs = strings(input.resolutionRefs, 64, 240);
  if (disposition !== "open" && disposition !== "deferred" && disposition !== "blocked" && !resolutionRefs.length) {
    throw new Error(`Finding ${findingId} cannot disappear without explicit resolution evidence.`);
  }
  return {
    findingId,
    severity,
    disposition,
    targetRefs: strings(input.targetRefs),
    evidenceRefs: strings(input.evidenceRefs),
    resolutionRefs,
    rationale: text(input.rationale, 1_200),
  };
}

export function evaluateStoryEditorialReadiness(input) {
  const telemetry = storyWorkbenchConvergenceTelemetry(input.telemetry ?? {});
  const findings = (Array.isArray(input.findings) ? input.findings : []).map(normalizeStoryFindingLifecycle);
  const auditRounds = (Array.isArray(input.auditRounds) ? input.auditRounds : []).map((round, index) => ({
    round: integer(round?.round) || index + 1,
    newMaterialMediumHighFindings: integer(round?.newMaterialMediumHighFindings),
    completed: round?.completed === true,
  }));
  const lastTwo = auditRounds.slice(-2);
  const twoCleanAuditRounds = lastTwo.length === 2 && lastTwo.every((round) => round.completed && round.newMaterialMediumHighFindings === 0);
  const unresolvedHigh = findings.filter((finding) => finding.severity === "high" && finding.disposition === "open").length;
  const unresolvedMaterial = findings.filter((finding) => ["medium", "high"].includes(finding.severity) && finding.disposition === "open").length;
  const integrityErrors = strings(input.integrityErrors, 64, 360);
  const staleAcceptedChangeConflicts = integer(input.staleAcceptedChangeConflicts);
  const blockers = [];

  if (telemetry.openRequiredDecisions > 0) blockers.push(`${telemetry.openRequiredDecisions} required Story Decision(s) remain open.`);
  if (unresolvedHigh > 0) blockers.push(`${unresolvedHigh} high-severity finding(s) remain unresolved.`);
  if (staleAcceptedChangeConflicts > 0) blockers.push(`${staleAcceptedChangeConflicts} stale accepted-change conflict(s) remain.`);
  if (telemetry.missingCurrentFrontierRequirements > 0) blockers.push(`${telemetry.missingCurrentFrontierRequirements} required current-frontier item(s) remain missing.`);
  if (integrityErrors.length > 0) blockers.push(`${integrityErrors.length} integrity/provenance error(s) remain.`);
  if (!twoCleanAuditRounds) blockers.push("Two consecutive completed audit rounds with no new material medium/high finding are required.");

  return {
    status: blockers.length === 0 ? "ready-for-editorial-review" : "not-ready",
    readyForEditorialReview: blockers.length === 0,
    humanMayStop: true,
    telemetry,
    findingCounts: {
      total: findings.length,
      unresolvedMaterial,
      unresolvedHigh,
      terminal: findings.filter((finding) => finding.disposition !== "open").length,
    },
    auditRounds,
    twoCleanAuditRounds,
    staleAcceptedChangeConflicts,
    integrityErrors,
    blockers,
  };
}

export function createStoryConvergenceEvidence(input) {
  const readiness = evaluateStoryEditorialReadiness(input);
  return {
    schemaVersion: STORY_CONVERGENCE_EVIDENCE_VERSION,
    reference: {
      fixtureId: text(input.reference?.fixtureId, 180),
      fixtureVersion: integer(input.reference?.fixtureVersion),
      sourceVersion: text(input.reference?.sourceVersion, 60),
      sourceSha: text(input.reference?.sourceSha, 80),
      startingRevision: integer(input.reference?.startingRevision),
      endingRevision: integer(input.reference?.endingRevision),
      applicationCommit: text(input.reference?.applicationCommit, 80),
    },
    capabilities: {
      buzz: text(input.capabilities?.buzz, 60) || "disabled",
      localModel: text(input.capabilities?.localModel, 120) || "not-recorded",
      paidCloudUsed: input.capabilities?.paidCloudUsed === true,
    },
    execution: {
      workItemsPlanned: integer(input.execution?.workItemsPlanned),
      workItemsExecuted: integer(input.execution?.workItemsExecuted),
      affectedWorkItemsRerun: readiness.telemetry.affectedWorkItemsRerun,
      councilContributions: integer(input.execution?.councilContributions),
      decisionsCreated: integer(input.execution?.decisionsCreated),
      decisionsResolved: integer(input.execution?.decisionsResolved),
      revisionsProduced: Math.max(0, integer(input.reference?.endingRevision) - integer(input.reference?.startingRevision)),
    },
    persistence: {
      saveCloseReopenVerified: input.persistence?.saveCloseReopenVerified === true,
      stateCoherentAfterReopen: input.persistence?.stateCoherentAfterReopen === true,
    },
    projections: {
      visualStateCoherent: input.projections?.visualStateCoherent === true,
      textStateCoherentOrHonestlyStale: input.projections?.textStateCoherentOrHonestlyStale === true,
      storyboardFrontierHonest: input.projections?.storyboardFrontierHonest === true,
    },
    readiness,
  };
}
