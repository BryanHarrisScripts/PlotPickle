import { createHash } from "node:crypto";

const SHA = /^[a-f0-9]{40}$/i;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{2,179}$/i;
const SAFE_REF = /^[a-z0-9][a-z0-9._:/@#-]{1,239}$/i;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-z0-9._@/-]{1,240}$/i;
const MAX_REFS = 64;
const MAX_HANDOFF_REFS = 32;
const MAX_PATHS = 16;

function boundedToken(value, label, pattern = SAFE_REF, maximum = 240) {
  const normalized = String(value || "").trim();
  if (!normalized || normalized.length > maximum || !pattern.test(normalized)) {
    throw new Error(`Maintainer QA handoff ${label} is missing or invalid.`);
  }
  return normalized;
}

function boundedList(values, label, pattern = SAFE_REF, maximum = MAX_REFS, allowEmpty = false) {
  if (!Array.isArray(values) || values.length > maximum || (!allowEmpty && !values.length)) {
    throw new Error(`Maintainer QA handoff ${label} requires a bounded${allowEmpty ? "" : " non-empty"} list.`);
  }
  return Object.freeze([...new Set(values.map((value) => boundedToken(value, label, pattern)))].sort());
}

function ownsPath(pathname, ownershipPaths) {
  return ownershipPaths.some((owned) => pathname === owned || pathname.startsWith(`${owned}/`) || owned.startsWith(`${pathname}/`));
}

export function createMaintainerQaAnalysisPackage({ defect, exactCommitSha, architectureSnapshot, domain }) {
  const commitSha = String(exactCommitSha || "").trim().toLowerCase();
  if (!SHA.test(commitSha)) throw new Error("Maintainer QA handoff requires an exact defect commit SHA.");
  if (!defect?.reproducible || defect.severity === "flaky") {
    throw new Error("Maintainer QA analysis requires a reproduced non-flaky #1571 defect.");
  }
  if (architectureSnapshot?.state !== "verified" || architectureSnapshot.exactCommitSha !== commitSha) {
    throw new Error("Maintainer QA analysis requires a verified exact-head architecture snapshot for the failing commit.");
  }
  if (architectureSnapshot.operationalAuthorityGranted !== false || architectureSnapshot.sourceMutationAllowed !== false) {
    throw new Error("Maintainer QA analysis architecture evidence must remain non-operational and read-only.");
  }
  const domainId = boundedToken(domain, "domain", SAFE_ID, 180);
  const ownership = architectureSnapshot.domains?.find((item) => item.domain === domainId);
  if (!ownership) throw new Error("Maintainer QA analysis requires verified ownership for the affected domain.");
  const exactHeadObservations = (defect.observations || []).filter((item) => String(item?.commitSha || "").toLowerCase() === commitSha);
  if (exactHeadObservations.length < 2) {
    throw new Error("Maintainer QA analysis requires two matching reproductions on the exact failing commit.");
  }
  if (exactHeadObservations.some((item) => item.testerRole !== defect.testerRole || item.routeId !== defect.routeId || item.assertionRef !== defect.assertionRef)) {
    throw new Error("Maintainer QA analysis reproduction evidence does not match the defect fingerprint contract.");
  }
  const reproductionRefs = boundedList(exactHeadObservations.flatMap((item) => item.reproductionRefs || []), "reproduction references", SAFE_REF, MAX_HANDOFF_REFS);
  const evidenceRefs = boundedList(exactHeadObservations.flatMap((item) => item.evidenceRefs || []), "evidence references", SAFE_REF, MAX_HANDOFF_REFS);
  const ownershipPaths = boundedList(ownership.ownershipPaths || [], "ownership paths", SAFE_PATH, MAX_PATHS);
  const freshnessPaths = boundedList(ownership.changedPathInvalidationInputs || [], "freshness paths", SAFE_PATH, MAX_HANDOFF_REFS);
  const fingerprint = boundedToken(defect.fingerprint, "defect fingerprint", SAFE_ID, 180);
  const material = JSON.stringify({ fingerprint, commitSha, domain: domainId, reproductionRefs, evidenceRefs });

  return Object.freeze({
    schemaVersion: 1,
    analysisId: `maintainer-qa-${createHash("sha256").update(material).digest("hex").slice(0, 32)}`,
    state: "reproduced",
    defectFingerprint: fingerprint,
    severity: boundedToken(defect.severity, "severity", SAFE_ID, 32),
    testerRole: boundedToken(defect.testerRole, "tester role", SAFE_ID, 80),
    routeId: defect.routeId ? boundedToken(defect.routeId, "route ID") : "",
    assertionRef: boundedToken(defect.assertionRef, "assertion reference"),
    expectedRef: boundedToken(defect.expectedRef, "expected reference"),
    actualRef: boundedToken(defect.actualRef, "actual reference"),
    errorClass: defect.errorClass ? boundedToken(defect.errorClass, "error class") : "",
    exactCommitSha: commitSha,
    architectureSnapshotId: boundedToken(architectureSnapshot.snapshotId, "architecture snapshot ID", SAFE_ID, 180),
    domain: domainId,
    ownershipPaths,
    freshnessPaths,
    reproductionRefs,
    evidenceRefs,
    exactHeadObservationCount: exactHeadObservations.length,
    maximumAnalysisAttempts: 1,
    testerRepairAuthorityGranted: false,
    testerApprovalAuthorityGranted: false,
    sourceMutationAllowed: false,
    repairAuthorityGranted: false,
    operationalAuthorityGranted: false,
    aiSelfCertified: false,
  });
}

export function createMaintainerDefectLearningInput({ analysis, proposalId, createdAt }) {
  if (analysis?.state !== "reproduced" || analysis.repairAuthorityGranted !== false || analysis.testerRepairAuthorityGranted !== false) {
    throw new Error("Maintainer defect learning requires a reproduced read-only QA analysis package.");
  }
  const sourceCommitSha = String(analysis.exactCommitSha || "").trim().toLowerCase();
  if (!SHA.test(sourceCommitSha)) throw new Error("Maintainer QA handoff learning source commit is invalid.");
  const created = new Date(createdAt);
  if (!Number.isFinite(created.getTime())) throw new Error("Maintainer QA handoff learning timestamp is invalid.");
  return Object.freeze({
    proposalId: boundedToken(proposalId, "learning proposal ID", SAFE_ID, 180),
    kind: "defect-lesson",
    summary: `Reproduced ${analysis.defectFingerprint} on ${analysis.routeId || "the bounded product route"}; expected ${analysis.expectedRef} but observed ${analysis.actualRef}.`,
    exactCommitSha: sourceCommitSha,
    domain: boundedToken(analysis.domain, "learning domain", SAFE_ID, 180),
    evidence: Object.freeze([
      Object.freeze({ kind: "defect", ref: analysis.defectFingerprint }),
      Object.freeze({ kind: "test", ref: analysis.assertionRef }),
      ...analysis.evidenceRefs.map((ref) => Object.freeze({ kind: "artifact", ref })),
    ]),
    freshnessPaths: analysis.freshnessPaths,
    applicabilityRefs: Object.freeze([analysis.assertionRef, ...analysis.reproductionRefs]),
    exclusionRefs: Object.freeze([]),
    createdAt: created.toISOString(),
  });
}

export function createMaintainerBoundedRepairRequest({
  analysis,
  learningProposal,
  harnessDecision,
  targetPaths,
  deterministicGateRefs,
  maximumAttempts = 2,
}) {
  if (analysis?.state !== "reproduced" || learningProposal?.kind !== "defect-lesson" || learningProposal.state !== "observed") {
    throw new Error("Maintainer repair requests require reproduced QA evidence and an observed defect lesson.");
  }
  if (
    learningProposal.sourceMutationAllowed !== false
    || learningProposal.selfApprovalAllowed !== false
    || learningProposal.operationalAuthorityGranted !== false
    || learningProposal.aiSelfCertified !== false
  ) throw new Error("Maintainer repair requests reject self-authorizing or operational learning proposals.");
  if (
    learningProposal.exactCommitSha !== analysis.exactCommitSha
    || learningProposal.domain !== analysis.domain
    || !learningProposal.evidence?.some((item) => item.kind === "defect" && item.ref === analysis.defectFingerprint)
  ) throw new Error("Maintainer repair request learning provenance does not match the reproduced defect.");
  if (
    harnessDecision?.state !== "approved"
    || harnessDecision.action !== "durable-knowledge-admission"
    || harnessDecision.learningProposalId !== learningProposal.proposalId
    || harnessDecision.learningDedupeKey !== learningProposal.dedupeKey
    || harnessDecision.exactCommitSha !== analysis.exactCommitSha
    || harnessDecision.operationalAuthorityGranted !== false
    || harnessDecision.sourceMutationAllowed !== false
    || harnessDecision.aiSelfCertified !== false
  ) throw new Error("Maintainer repair request requires matching harness-approved learning without operational authority.");
  const paths = boundedList(targetPaths, "target paths", SAFE_PATH, MAX_PATHS);
  if (paths.some((pathname) => !ownsPath(pathname, analysis.ownershipPaths))) {
    throw new Error("Maintainer repair request target path escapes the verified ownership boundary.");
  }
  const gateRefs = boundedList(deterministicGateRefs, "deterministic gate references");
  const attempts = Number(maximumAttempts);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 3) {
    throw new Error("Maintainer repair request maximum attempts must remain between one and three.");
  }
  const requestMaterial = JSON.stringify({
    defectFingerprint: analysis.defectFingerprint,
    exactCommitSha: analysis.exactCommitSha,
    learningDedupeKey: learningProposal.dedupeKey,
    targetPaths: paths,
    deterministicGateRefs: gateRefs,
  });

  return Object.freeze({
    schemaVersion: 1,
    requestId: `maintainer-repair-${createHash("sha256").update(requestMaterial).digest("hex").slice(0, 32)}`,
    state: "requested",
    repairContract: "issue-1451-bounded-repair-request",
    defectFingerprint: analysis.defectFingerprint,
    exactCommitSha: analysis.exactCommitSha,
    domain: analysis.domain,
    learningProposalId: learningProposal.proposalId,
    learningDedupeKey: learningProposal.dedupeKey,
    harnessApprovalRef: harnessDecision.harnessApprovalRef,
    targetPaths: paths,
    reproductionRefs: analysis.reproductionRefs,
    deterministicGateRefs: gateRefs,
    maximumAttempts: attempts,
    requiresSameDeterministicRerun: true,
    requiresExactHeadCi: true,
    requiresSeparateCodingAuthority: true,
    testerRepairAuthorityGranted: false,
    testerApprovalAuthorityGranted: false,
    learnerApprovalAuthorityGranted: false,
    repairAuthorityGranted: false,
    sourceMutationAllowed: false,
    mergeAuthorityGranted: false,
    operationalAuthorityGranted: false,
    deterministicSuccessClaimed: false,
    aiSelfCertified: false,
  });
}
