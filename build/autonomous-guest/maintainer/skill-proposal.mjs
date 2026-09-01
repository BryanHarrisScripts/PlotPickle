import { createHash } from "node:crypto";

const SHA = /^[a-f0-9]{40}$/i;
const DIGEST = /^[a-f0-9]{64}$/i;
const SAFE_ID = /^[a-z0-9][a-z0-9._-]{2,119}$/i;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-[0-9a-z.-]+)?$/i;
const SAFE_TOKEN = /^[a-z0-9][a-z0-9._:-]{1,119}$/i;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-z0-9._@/-]{1,240}$/i;
const MAX_ITEMS = 16;
const MAX_SUMMARY = 500;
const FORBIDDEN = /(?:chain[- ]?of[- ]?thought|hidden reasoning|BEGIN [A-Z ]*PRIVATE KEY|password\s*=|credential\s*=)/i;

function assertGuestAuthority(authority) {
  if (
    authority?.authorityClass !== "delegated-guest-autonomous-operator"
    || authority.delegated !== true
    || authority.humanProfileId !== ""
    || authority.accessMode !== "desktop-loopback"
  ) throw new Error("Skill proposals require delegated non-Human desktop-loopback Guest authority.");
}

function exactSha(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!SHA.test(normalized)) throw new Error("Skill proposals require an exact 40-character commit SHA.");
  return normalized;
}

function safeId(value, label) {
  const normalized = String(value || "").trim();
  if (!SAFE_ID.test(normalized)) throw new Error(`Skill proposal ${label} is missing or invalid.`);
  return normalized;
}

function safeTokens(values, label) {
  if (!Array.isArray(values) || !values.length || values.length > MAX_ITEMS) {
    throw new Error(`Skill proposal ${label} requires a bounded non-empty list.`);
  }
  const normalized = [...new Set(values.map((value) => String(value || "").trim()))].sort();
  if (normalized.some((value) => !SAFE_TOKEN.test(value))) throw new Error(`Skill proposal ${label} contains an invalid value.`);
  return Object.freeze(normalized);
}

function safePaths(values, label) {
  if (!Array.isArray(values) || !values.length || values.length > MAX_ITEMS) {
    throw new Error(`Skill proposal ${label} requires a bounded non-empty list.`);
  }
  const normalized = [...new Set(values.map((value) => String(value || "").trim()))].sort();
  if (normalized.some((value) => !SAFE_PATH.test(value))) throw new Error(`Skill proposal ${label} contains an unsafe path.`);
  return Object.freeze(normalized);
}

function summary(value) {
  const normalized = String(value || "").replace(/\s+/g, " ").trim();
  if (normalized.length < 16 || normalized.length > MAX_SUMMARY || FORBIDDEN.test(normalized)) {
    throw new Error("Skill proposal summary is invalid, unbounded, or contains forbidden material.");
  }
  return normalized;
}

export function createGovernedSkillVersionProposal({
  authority,
  architectureSnapshot,
  learningProposal,
  candidate,
}) {
  assertGuestAuthority(authority);
  if (learningProposal?.kind !== "skill-proposal" || learningProposal.state !== "observed") {
    throw new Error("Governed skill work requires an observed Slice A skill proposal.");
  }
  if (architectureSnapshot?.state !== "verified" || architectureSnapshot.operationalAuthorityGranted !== false) {
    throw new Error("Governed skill work requires a verified non-operational architecture snapshot.");
  }
  const exactCommitSha = exactSha(learningProposal.exactCommitSha);
  if (architectureSnapshot.exactCommitSha !== exactCommitSha) {
    throw new Error("Skill proposal and architecture snapshot must bind the same exact commit.");
  }
  if (!architectureSnapshot.domains?.some((item) => item.domain === "developer")) {
    throw new Error("Skill proposals require the verified developer ownership domain.");
  }

  const skillId = safeId(learningProposal.skillId, "skill ID");
  const proposalId = safeId(learningProposal.proposalId, "learning proposal ID");
  if (!candidate || !["create", "update"].includes(candidate.changeKind)) {
    throw new Error("Skill proposal change kind must be create or update.");
  }
  const proposedVersion = String(candidate.proposedVersion || "").trim();
  const replacesVersion = String(candidate.replacesVersion || "").trim();
  if (!SEMVER.test(proposedVersion)) throw new Error("Skill proposal version must be bounded semantic versioning.");
  if (candidate.changeKind === "create" && replacesVersion) throw new Error("New skill proposals cannot replace an existing version.");
  if (candidate.changeKind === "update" && !SEMVER.test(replacesVersion)) throw new Error("Updated skill proposals must name the version they replace.");

  const entryPath = String(candidate.entryPath || "").trim();
  if (!SAFE_PATH.test(entryPath) || entryPath !== `.agents/skills/${skillId}/SKILL.md`) {
    throw new Error("Skill proposal entry path must stay inside its exact PlotPickle skill package.");
  }
  const candidateDigest = String(candidate.candidateDigest || "").trim().toLowerCase();
  if (!DIGEST.test(candidateDigest)) throw new Error("Skill proposal candidate requires an exact SHA-256 digest.");
  const requestedRoles = safeTokens(candidate.requestedRoles, "roles");
  const requestedConsumers = safeTokens(candidate.requestedConsumers, "consumers");
  const contractTestRefs = safePaths(candidate.contractTestRefs, "contract tests");
  if (contractTestRefs.some((value) => !value.startsWith("tests/") || !value.endsWith(".test.mjs"))) {
    throw new Error("Skill proposal contract tests must reference PlotPickle test files.");
  }
  const normalizedSummary = summary(candidate.summary);
  const versionKey = `${skillId}@${proposedVersion}`;
  const dedupeMaterial = JSON.stringify({ versionKey, exactCommitSha, candidateDigest, contractTestRefs });

  return Object.freeze({
    schemaVersion: 1,
    skillProposalId: `maintainer-skill-${createHash("sha256").update(dedupeMaterial).digest("hex").slice(0, 32)}`,
    learningProposalId: proposalId,
    learningDedupeKey: learningProposal.dedupeKey,
    architectureSnapshotId: architectureSnapshot.snapshotId,
    exactCommitSha,
    skillId,
    changeKind: candidate.changeKind,
    proposedVersion,
    replacesVersion,
    versionKey,
    summary: normalizedSummary,
    entryPath,
    candidateDigest,
    requestedRoles,
    requestedConsumers,
    contractTestRefs,
    registryEvidenceRef: "config/agent-skills.json",
    constitutionRef: "AGENTS.md",
    state: "observed",
    harnessApprovalRef: "",
    registryMutationAllowed: false,
    sourceMutationAllowed: false,
    skillInstallationAllowed: false,
    skillActivationAllowed: false,
    selfApprovalAllowed: false,
    operationalAuthorityGranted: false,
    aiSelfCertified: false,
  });
}
