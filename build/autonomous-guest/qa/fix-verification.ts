import type { AutonomousQaDefectCandidate } from "./defect-fingerprint";
import { autonomousQaTesterJourney } from "./tester-journeys";

export type AutonomousQaFixVerificationPlan = Readonly<{
  campaignType: "targeted-rerun";
  defectFingerprint: string;
  failingCommitSha: string;
  fixCommitSha: string;
  testerRole: AutonomousQaDefectCandidate["testerRole"];
  reproductionRefs: readonly string[];
  regressionRouteIds: readonly string[];
}>;

export type AutonomousQaFixVerificationEvidence = Readonly<{
  defectFingerprint: string;
  commitSha: string;
  reproductionPassed: boolean;
  passedRouteIds: readonly string[];
  deterministicGateRefs: readonly string[];
}>;

const SHA = /^[a-f0-9]{40}$/i;

export function createAutonomousQaFixVerificationPlan(input: Readonly<{
  defect: AutonomousQaDefectCandidate;
  fixCommitSha: string;
}>) {
  if (!input.defect.reproducible || input.defect.severity === "flaky") {
    throw new Error("Autonomous QA cannot verify a fix for an unreproduced flaky observation.");
  }
  if (!SHA.test(input.fixCommitSha)) throw new Error("Autonomous QA fix verification requires an exact fix commit SHA.");
  const failingCommitSha = input.defect.observations[0]?.commitSha || "";
  if (!SHA.test(failingCommitSha)) throw new Error("Autonomous QA defect is missing its exact failing commit SHA.");
  if (input.fixCommitSha.toLowerCase() === failingCommitSha.toLowerCase()) {
    throw new Error("Autonomous QA fix verification must run on a different exact commit than the failing build.");
  }
  const journey = autonomousQaTesterJourney(input.defect.testerRole);
  const regressionRouteIds = new Set(journey.routeIds);
  if (input.defect.routeId) regressionRouteIds.add(input.defect.routeId);
  return Object.freeze({
    campaignType: "targeted-rerun" as const,
    defectFingerprint: input.defect.fingerprint,
    failingCommitSha: failingCommitSha.toLowerCase(),
    fixCommitSha: input.fixCommitSha.toLowerCase(),
    testerRole: input.defect.testerRole,
    reproductionRefs: Object.freeze([...input.defect.reproductionRefs]),
    regressionRouteIds: Object.freeze([...regressionRouteIds]),
  } satisfies AutonomousQaFixVerificationPlan);
}

export function evaluateAutonomousQaFixVerification(
  plan: AutonomousQaFixVerificationPlan,
  evidence: AutonomousQaFixVerificationEvidence,
) {
  if (evidence.defectFingerprint !== plan.defectFingerprint) {
    throw new Error("Autonomous QA fix evidence belongs to a different defect fingerprint.");
  }
  if (evidence.commitSha.toLowerCase() !== plan.fixCommitSha) {
    throw new Error("Autonomous QA fix evidence does not match the exact fix commit.");
  }
  const passedRoutes = new Set(evidence.passedRouteIds);
  const missingRoutes = plan.regressionRouteIds.filter((routeId) => !passedRoutes.has(routeId));
  const deterministic = evidence.deterministicGateRefs.length > 0;
  const verified = evidence.reproductionPassed === true && deterministic && missingRoutes.length === 0;
  return Object.freeze({
    defectFingerprint: plan.defectFingerprint,
    fixCommitSha: plan.fixCommitSha,
    disposition: verified ? "verified-fixed" as const : "not-fixed" as const,
    reproductionPassed: evidence.reproductionPassed === true,
    missingRouteIds: Object.freeze(missingRoutes),
    deterministicGateRefs: Object.freeze([...evidence.deterministicGateRefs]),
    aiSelfCertified: false as const,
  });
}
