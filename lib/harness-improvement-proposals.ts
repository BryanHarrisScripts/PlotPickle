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

const PROTECTED_PATTERNS: readonly RegExp[] = [
  /^tests\//i,
  /^\.github\/workflows\//i,
  /^config\/agent-profiles\.json$/i,
  /^config\/agent-orchestration\.json$/i,
  /(?:^|\/)connector-trust-policy(?:\.|\/|$)/i,
  /(?:^|\/)local-credentials(?:\.|\/|$)/i,
  /(?:^|\/)revision-aware-ppf(?:\.|\/|$)/i,
  /(?:^|\/)ppf(?:\.|\/|$)/i,
  /(?:^|\/)story-knowledge-graph(?:\.|\/|$)/i,
  /(?:^|\/)full-verification(?:\.|\/|$)/i,
  /(?:^|\/)run-plotpickle-full-check(?:\.|\/|$)/i,
  /(?:^|\/)harness-improvement-proposals(?:\.|\/|$)/i,
];

function clean(value: unknown, maximum = 1_200) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function normalizedPath(value: string) {
  return value.replace(/\\/g, "/").replace(/^\.\//, "").replace(/\/+/g, "/").trim();
}

function unique(values: readonly string[], maximum = 64) {
  return [...new Set(values.map((item) => clean(item, 500)).filter(Boolean))].slice(0, maximum);
}

function now(value?: string) {
  const parsed = value ? Date.parse(value) : NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

export function isProtectedHarnessTarget(path: string) {
  const normalized = normalizedPath(path);
  return PROTECTED_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function protectedHarnessTargets(paths: readonly string[]) {
  return unique(paths.map(normalizedPath)).filter(isProtectedHarnessTarget);
}

function proposalId() {
  return `hip-${new Date().toISOString().replace(/[^0-9]/g, "").slice(0, 14)}-${Math.random().toString(36).slice(2, 9)}`;
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
  const proposerId = clean(input.proposerId, 180);
  const title = clean(input.title, 300);
  const rationale = clean(input.rationale, 2_000);
  const targetPaths = unique(input.targetPaths.map(normalizedPath), 48);
  const evaluationRefs = unique(input.evaluationRefs.map(normalizedPath), 64);
  if (!proposerId || !title || !rationale) throw new Error("Harness Improvement Proposal requires proposer, title and rationale.");
  if (!targetPaths.length) throw new Error("Harness Improvement Proposal requires at least one bounded target path.");
  const protectedTargets = protectedHarnessTargets(targetPaths);
  if (protectedTargets.length) throw new Error(`Protected harness targets cannot be self-edited: ${protectedTargets.join(", ")}`);
  const judgedTargets = targetPaths.filter((target) => evaluationRefs.includes(target));
  if (judgedTargets.length) throw new Error(`A proposal cannot edit the evaluation that judges it: ${judgedTargets.join(", ")}`);
  const signature = clean(input.failure.signature, 300);
  const evidenceRefs = unique(input.failure.evidenceRefs, 64);
  const occurrences = Math.max(1, Math.min(10_000, Math.floor(Number(input.failure.occurrences) || 1)));
  if (!signature || !evidenceRefs.length) throw new Error("Harness Improvement Proposal requires a repeated-failure signature and evidence.");
  const createdAt = now(input.createdAt);
  return {
    version: 1,
    proposalId: clean(input.proposalId || proposalId(), 180),
    proposerId,
    title,
    rationale,
    targetPaths,
    failure: {
      signature,
      occurrences,
      evidenceRefs,
      summary: clean(input.failure.summary, 1_200),
    },
    isolation: {
      required: true,
      mode: "git-branch-or-worktree",
      branchRef: clean(input.branchRef, 240),
    },
    evaluationRefs,
    state: "proposed",
    verification: [],
    promotionReason: "",
    createdAt,
    updatedAt: createdAt,
  };
}

export function beginHarnessImprovementEvaluation(proposal: HarnessImprovementProposal, branchRef: string, at?: string) {
  if (proposal.state !== "proposed") throw new Error("Only a proposed harness improvement can begin evaluation.");
  const branch = clean(branchRef, 240);
  if (!branch) throw new Error("Harness improvements must be evaluated on an isolated git branch or worktree.");
  return {
    ...proposal,
    state: "evaluating" as const,
    isolation: { ...proposal.isolation, branchRef: branch },
    updatedAt: now(at),
  };
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
) {
  if (proposal.state !== "evaluating") throw new Error("Harness verification can be recorded only while evaluating.");
  const verifierId = clean(input.verifierId, 180);
  if (!verifierId) throw new Error("Authoritative verifier identity is required.");
  if (verifierId === proposal.proposerId) throw new Error("A harness improvement proposer cannot self-certify its own promotion evidence.");
  const evidenceRef = clean(input.evidenceRef, 500);
  if (!evidenceRef) throw new Error("Harness verification requires an immutable evidence reference.");
  const evidence: HarnessVerificationEvidence = {
    stage: input.stage,
    verifierId,
    authority: "authoritative-system",
    result: input.result,
    evidenceRef,
    summary: clean(input.summary, 1_200),
    recordedAt: now(input.recordedAt),
    immutable: true,
  };
  return {
    ...proposal,
    verification: [...proposal.verification, evidence],
    updatedAt: evidence.recordedAt,
  };
}

function latestStage(proposal: HarnessImprovementProposal, stage: HarnessVerificationStage) {
  return [...proposal.verification].reverse().find((item) => item.stage === stage) ?? null;
}

export function harnessImprovementPromotionStatus(proposal: HarnessImprovementProposal) {
  const baseline = latestStage(proposal, "baseline");
  const candidate = latestStage(proposal, "candidate");
  const isolated = Boolean(proposal.isolation.branchRef);
  const eligible = proposal.state === "evaluating"
    && isolated
    && baseline?.result === "PASS"
    && candidate?.result === "PASS";
  return {
    eligible,
    isolated,
    baseline,
    candidate,
    reason: !isolated
      ? "missing-isolation"
      : !baseline
        ? "missing-baseline-verification"
        : baseline.result !== "PASS"
          ? "baseline-failed"
          : !candidate
            ? "missing-candidate-verification"
            : candidate.result !== "PASS"
              ? "candidate-failed"
              : proposal.state !== "evaluating"
                ? `state:${proposal.state}`
                : "ready-for-host-promotion",
  };
}

export function acceptHarnessImprovementProposal(proposal: HarnessImprovementProposal, reason: string, at?: string) {
  const status = harnessImprovementPromotionStatus(proposal);
  if (!status.eligible) throw new Error(`Harness improvement is not eligible for promotion: ${status.reason}.`);
  return {
    ...proposal,
    state: "accepted" as const,
    promotionReason: clean(reason, 1_000) || "Accepted after authoritative baseline and candidate verification.",
    updatedAt: now(at),
  };
}

export function rejectHarnessImprovementProposal(proposal: HarnessImprovementProposal, reason: string, at?: string) {
  if (proposal.state === "accepted" || proposal.state === "rolled-back") throw new Error(`Cannot reject a harness improvement while ${proposal.state}.`);
  return {
    ...proposal,
    state: "rejected" as const,
    promotionReason: clean(reason, 1_000) || "Rejected by the protected host boundary.",
    updatedAt: now(at),
  };
}

export function rollBackHarnessImprovementProposal(proposal: HarnessImprovementProposal, reason: string, at?: string) {
  if (proposal.state !== "accepted") throw new Error("Only an accepted harness improvement can be marked rolled back.");
  return {
    ...proposal,
    state: "rolled-back" as const,
    promotionReason: clean(reason, 1_000) || "Rolled back to the previous known-good harness state.",
    updatedAt: now(at),
  };
}
