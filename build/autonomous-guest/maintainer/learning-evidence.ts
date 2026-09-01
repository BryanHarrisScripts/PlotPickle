import { createHash } from "node:crypto";
import type { AutonomousGuestAuthority } from "../../../core/auth/autonomous-guest/guest-authority";

export const MAINTAINER_LEARNING_KINDS = [
  "architecture-fact",
  "operational-procedure",
  "defect-lesson",
  "skill-proposal",
] as const;

export const MAINTAINER_LEARNING_STATES = [
  "observed",
  "verified",
  "approved",
  "stale",
  "retired",
] as const;

export const MAINTAINER_ARCHITECTURE_DOMAINS = [
  "ai",
  "auth",
  "buzz",
  "story",
  "storage",
  "projects",
  "startup",
  "runtime",
  "verification",
  "ui",
  "developer",
  "release",
  "shared-core",
] as const;

export const MAINTAINER_EVIDENCE_KINDS = [
  "source",
  "test",
  "workflow",
  "artifact",
  "defect",
] as const;

export type MaintainerLearningKind = (typeof MAINTAINER_LEARNING_KINDS)[number];
export type MaintainerLearningState = (typeof MAINTAINER_LEARNING_STATES)[number];
export type MaintainerArchitectureDomain = (typeof MAINTAINER_ARCHITECTURE_DOMAINS)[number];
export type MaintainerEvidenceKind = (typeof MAINTAINER_EVIDENCE_KINDS)[number];

export type MaintainerEvidenceReference = Readonly<{
  kind: MaintainerEvidenceKind;
  ref: string;
}>;

export type MaintainerLearningProposalInput = Readonly<{
  proposalId: string;
  kind: MaintainerLearningKind;
  summary: string;
  exactCommitSha: string;
  domain: MaintainerArchitectureDomain;
  evidence: readonly MaintainerEvidenceReference[];
  freshnessPaths: readonly string[];
  applicabilityRefs?: readonly string[];
  exclusionRefs?: readonly string[];
  skillId?: string;
  createdAt: string;
}>;

export type MaintainerLearningProposal = Readonly<{
  schemaVersion: 1;
  proposalId: string;
  dedupeKey: string;
  kind: MaintainerLearningKind;
  summary: string;
  exactCommitSha: string;
  domain: MaintainerArchitectureDomain;
  evidence: readonly MaintainerEvidenceReference[];
  freshnessPaths: readonly string[];
  applicabilityRefs: readonly string[];
  exclusionRefs: readonly string[];
  skillId: string;
  createdAt: string;
  state: "observed";
  proposedBy: Readonly<{
    authorityClass: "delegated-guest-autonomous-operator";
    autonomousRunId: string;
    workspaceId: string;
    operatorId: string;
    humanProfileId: "";
  }>;
  harnessApprovalRef: "";
  sourceMutationAllowed: false;
  directCanonMutationAllowed: false;
  humanCredentialAccessAllowed: false;
  hiddenReasoningStorageAllowed: false;
  privateStoryTextStorageAllowed: false;
  selfApprovalAllowed: false;
  skillInstallationAllowed: false;
  skillActivationAllowed: false;
  operationalAuthorityGranted: false;
  aiSelfCertified: false;
}>;

const SHA = /^[a-f0-9]{40}$/i;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{2,179}$/i;
const SAFE_REF = /^[a-z0-9][a-z0-9._:/@#-]{1,239}$/i;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-z0-9._@/-]{1,240}$/i;
const MAX_EVIDENCE = 64;
const MAX_PATHS = 32;
const MAX_REFS = 64;
const MAX_SUMMARY = 600;
const FORBIDDEN_SUMMARY = /(?:chain[- ]?of[- ]?thought|hidden reasoning|BEGIN [A-Z ]*PRIVATE KEY|password\s*=|credential\s*=)/i;

function assertGuestAuthority(authority: AutonomousGuestAuthority) {
  if (
    authority.authorityClass !== "delegated-guest-autonomous-operator"
    || authority.delegated !== true
    || authority.humanProfileId !== ""
    || authority.accessMode !== "desktop-loopback"
  ) {
    throw new Error("Evidence-learning proposals require delegated non-Human desktop-loopback Guest authority.");
  }
}

function safeId(value: string, label: string, allowEmpty = false) {
  const normalized = String(value || "").trim();
  if (allowEmpty && normalized === "") return "";
  if (!SAFE_ID.test(normalized)) throw new Error(`Evidence-learning ${label} is missing or invalid.`);
  return normalized;
}

function safeRef(value: string, label: string) {
  const normalized = String(value || "").trim();
  if (!SAFE_REF.test(normalized)) throw new Error(`Evidence-learning ${label} is missing or invalid.`);
  return normalized;
}

function uniqueRefs(values: readonly string[] | undefined, label: string, maximum = MAX_REFS) {
  const result = [...new Set((values || []).map((value) => safeRef(value, label)))];
  if (result.length > maximum) throw new Error(`Evidence-learning ${label} exceeds its bounded size.`);
  return Object.freeze(result);
}

function timestamp(value: string) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("Evidence-learning proposal timestamp is invalid.");
  return parsed.toISOString();
}

function summary(value: string) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length < 16 || normalized.length > MAX_SUMMARY) {
    throw new Error("Evidence-learning summary is outside its bounded length.");
  }
  if (FORBIDDEN_SUMMARY.test(normalized)) {
    throw new Error("Evidence-learning summaries cannot contain hidden reasoning or credential material.");
  }
  return normalized;
}

function evidence(values: readonly MaintainerEvidenceReference[]) {
  if (!Array.isArray(values) || !values.length || values.length > MAX_EVIDENCE) {
    throw new Error("Evidence-learning proposals require a bounded evidence set.");
  }
  const seen = new Set<string>();
  const result = values.map((item) => {
    if (!(MAINTAINER_EVIDENCE_KINDS as readonly string[]).includes(item.kind)) {
      throw new Error("Evidence-learning evidence kind is invalid.");
    }
    const ref = safeRef(item.ref, "evidence reference");
    const key = `${item.kind}:${ref}`;
    if (seen.has(key)) throw new Error("Evidence-learning evidence references must be unique.");
    seen.add(key);
    return Object.freeze({ kind: item.kind, ref });
  });
  return Object.freeze(result);
}

function freshnessPaths(values: readonly string[]) {
  if (!Array.isArray(values) || !values.length || values.length > MAX_PATHS) {
    throw new Error("Evidence-learning proposals require bounded freshness paths.");
  }
  const result = [...new Set(values.map((value) => String(value || "").trim()))];
  if (result.some((value) => !SAFE_PATH.test(value))) {
    throw new Error("Evidence-learning freshness path is invalid or escapes the repository.");
  }
  return Object.freeze(result);
}

export function createMaintainerLearningProposal(
  authority: AutonomousGuestAuthority,
  input: MaintainerLearningProposalInput,
): MaintainerLearningProposal {
  assertGuestAuthority(authority);
  if (!(MAINTAINER_LEARNING_KINDS as readonly string[]).includes(input.kind)) {
    throw new Error("Evidence-learning kind is invalid.");
  }
  if (!(MAINTAINER_ARCHITECTURE_DOMAINS as readonly string[]).includes(input.domain)) {
    throw new Error("Evidence-learning architecture domain is invalid.");
  }
  if (!SHA.test(input.exactCommitSha)) {
    throw new Error("Evidence-learning proposals require an exact 40-character commit SHA.");
  }
  const skillId = safeId(input.skillId || "", "skill ID", true);
  if (input.kind === "skill-proposal" && !skillId) {
    throw new Error("Evidence-learning skill proposals require a bounded skill ID.");
  }
  if (input.kind !== "skill-proposal" && skillId) {
    throw new Error("Only evidence-learning skill proposals may name a skill ID.");
  }

  const normalizedSummary = summary(input.summary);
  const normalizedEvidence = evidence(input.evidence);
  const normalizedPaths = freshnessPaths(input.freshnessPaths);
  const exactCommitSha = input.exactCommitSha.toLowerCase();
  const dedupeMaterial = [
    input.kind,
    input.domain,
    skillId,
    normalizedSummary,
    exactCommitSha,
    ...normalizedEvidence.map((item) => `${item.kind}:${item.ref}`),
  ].join("\n");

  return Object.freeze({
    schemaVersion: 1 as const,
    proposalId: safeId(input.proposalId, "proposal ID"),
    dedupeKey: `maintainer-learning-${createHash("sha256").update(dedupeMaterial).digest("hex").slice(0, 32)}`,
    kind: input.kind,
    summary: normalizedSummary,
    exactCommitSha,
    domain: input.domain,
    evidence: normalizedEvidence,
    freshnessPaths: normalizedPaths,
    applicabilityRefs: uniqueRefs(input.applicabilityRefs, "applicability reference"),
    exclusionRefs: uniqueRefs(input.exclusionRefs, "exclusion reference"),
    skillId,
    createdAt: timestamp(input.createdAt),
    state: "observed" as const,
    proposedBy: Object.freeze({
      authorityClass: authority.authorityClass,
      autonomousRunId: authority.autonomousRunId,
      workspaceId: authority.workspaceId,
      operatorId: authority.operatorId,
      humanProfileId: "" as const,
    }),
    harnessApprovalRef: "" as const,
    sourceMutationAllowed: false as const,
    directCanonMutationAllowed: false as const,
    humanCredentialAccessAllowed: false as const,
    hiddenReasoningStorageAllowed: false as const,
    privateStoryTextStorageAllowed: false as const,
    selfApprovalAllowed: false as const,
    skillInstallationAllowed: false as const,
    skillActivationAllowed: false as const,
    operationalAuthorityGranted: false as const,
    aiSelfCertified: false as const,
  });
}

export function evaluateMaintainerLearningFreshness(
  proposal: MaintainerLearningProposal,
  currentCommitSha: string,
): Readonly<{
  proposalId: string;
  evidenceCommitSha: string;
  currentCommitSha: string;
  state: "observed" | "stale";
  requiresHarnessReverification: boolean;
  operationalAuthorityGranted: false;
}> {
  if (!SHA.test(currentCommitSha)) {
    throw new Error("Evidence-learning freshness evaluation requires an exact current commit SHA.");
  }
  const normalizedCurrent = currentCommitSha.toLowerCase();
  const stale = proposal.exactCommitSha !== normalizedCurrent;
  return Object.freeze({
    proposalId: proposal.proposalId,
    evidenceCommitSha: proposal.exactCommitSha,
    currentCommitSha: normalizedCurrent,
    state: stale ? "stale" as const : "observed" as const,
    requiresHarnessReverification: stale,
    operationalAuthorityGranted: false as const,
  });
}
