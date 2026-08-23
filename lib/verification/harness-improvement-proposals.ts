import {
  acceptHarnessImprovementProposalCore,
  beginHarnessImprovementEvaluationCore,
  createHarnessImprovementProposalCore,
  harnessImprovementPromotionStatusCore,
  isProtectedHarnessTarget as coreIsProtectedHarnessTarget,
  protectedHarnessTargets as coreProtectedHarnessTargets,
  recordHarnessImprovementVerificationCore,
  rejectHarnessImprovementProposalCore,
  rollBackHarnessImprovementProposalCore,
} from "./harness-improvement-core.mjs";

export const HARNESS_IMPROVEMENT_STATES = [
  "proposed",
  "evaluating",
  "accepted",
  "rejected",
  "rolled-back",
] as const;

export type HarnessImprovementState = (typeof HARNESS_IMPROVEMENT_STATES)[number];
export type HarnessVerificationStage = "baseline" | "candidate";

export type HarnessFailureEvidence = {
  signature: string;
  occurrences: number;
  evidenceRefs: string[];
  summary: string;
};

export type HarnessVerificationEvidence = {
  stage: HarnessVerificationStage;
  verifierId: string;
  authority: "authoritative-system";
  result: "PASS" | "FAIL";
  evidenceRef: string;
  summary: string;
  recordedAt: string;
  immutable: true;
};

export type HarnessImprovementProposal = {
  version: 1;
  proposalId: string;
  proposerId: string;
  title: string;
  rationale: string;
  targetPaths: string[];
  failure: HarnessFailureEvidence;
  isolation: {
    required: true;
    mode: "git-branch-or-worktree";
    branchRef: string;
  };
  evaluationRefs: string[];
  state: HarnessImprovementState;
  verification: HarnessVerificationEvidence[];
  promotionReason: string;
  createdAt: string;
  updatedAt: string;
};

export function isProtectedHarnessTarget(path: string) {
  return coreIsProtectedHarnessTarget(path) as boolean;
}

export function protectedHarnessTargets(paths: readonly string[]) {
  return coreProtectedHarnessTargets(paths) as string[];
}

export function createHarnessImprovementProposal(input: {
  proposalId?: string;
  proposerId: string;
  title: string;
  rationale: string;
  targetPaths: readonly string[];
  failure: HarnessFailureEvidence;
  evaluationRefs: readonly string[];
  branchRef?: string;
  createdAt?: string;
}): HarnessImprovementProposal {
  return createHarnessImprovementProposalCore(input) as HarnessImprovementProposal;
}

export function beginHarnessImprovementEvaluation(proposal: HarnessImprovementProposal, branchRef: string, at?: string): HarnessImprovementProposal {
  return beginHarnessImprovementEvaluationCore(proposal, branchRef, at) as HarnessImprovementProposal;
}

export function recordHarnessImprovementVerification(
  proposal: HarnessImprovementProposal,
  input: {
    stage: HarnessVerificationStage;
    verifierId: string;
    result: "PASS" | "FAIL";
    evidenceRef: string;
    summary: string;
    recordedAt?: string;
  },
): HarnessImprovementProposal {
  return recordHarnessImprovementVerificationCore(proposal, input) as HarnessImprovementProposal;
}

export function harnessImprovementPromotionStatus(proposal: HarnessImprovementProposal) {
  return harnessImprovementPromotionStatusCore(proposal) as {
    eligible: boolean;
    isolated: boolean;
    baseline: HarnessVerificationEvidence | null;
    candidate: HarnessVerificationEvidence | null;
    reason: string;
  };
}

export function acceptHarnessImprovementProposal(proposal: HarnessImprovementProposal, reason: string, at?: string): HarnessImprovementProposal {
  return acceptHarnessImprovementProposalCore(proposal, reason, at) as HarnessImprovementProposal;
}

export function rejectHarnessImprovementProposal(proposal: HarnessImprovementProposal, reason: string, at?: string): HarnessImprovementProposal {
  return rejectHarnessImprovementProposalCore(proposal, reason, at) as HarnessImprovementProposal;
}

export function rollBackHarnessImprovementProposal(proposal: HarnessImprovementProposal, reason: string, at?: string): HarnessImprovementProposal {
  return rollBackHarnessImprovementProposalCore(proposal, reason, at) as HarnessImprovementProposal;
}
