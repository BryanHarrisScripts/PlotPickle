import { createHash } from "node:crypto";

export const MAINTAINER_HARNESS_AUTHORITY_CLASS = "plotpickle-maintainer-harness-approver";
export const MAINTAINER_PROMOTION_ACTIONS = Object.freeze([
  "durable-knowledge-admission",
  "skill-version-promotion",
]);
export const MAINTAINER_DETERMINISTIC_CHECK_KINDS = Object.freeze([
  "focused-tests",
  "architecture-inventory",
  "production-build",
  "exact-head-ci",
  "ben",
]);

const SHA = /^[a-f0-9]{40}$/i;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{2,179}$/i;
const SAFE_REF = /^[a-z0-9][a-z0-9._:/@#-]{1,239}$/i;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-z0-9._@/-]{1,240}$/i;
const POLICY_VERSION = /^[a-z0-9][a-z0-9._-]{0,79}$/i;
const MAX_ITEMS = 64;
const REQUIRED_BASELINE_CHECKS = Object.freeze([
  "focused-tests",
  "architecture-inventory",
  "production-build",
  "exact-head-ci",
]);

function exactSha(value, label) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!SHA.test(normalized)) throw new Error(`Maintainer harness requires an exact ${label} commit SHA.`);
  return normalized;
}

function checkedToken(value, label, pattern) {
  const normalized = String(value || "").trim();
  const accepted = pattern.test(normalized);
  if (!accepted) throw new Error(`Maintainer harness ${label} is missing or invalid.`);
  return normalized;
}

function safePaths(values, label) {
  if (!Array.isArray(values) || values.length > MAX_ITEMS) throw new Error(`Maintainer harness ${label} exceeds its bounded size.`);
  const normalized = [...new Set(values.map((value) => String(value || "").trim()))].sort();
  if (normalized.some((value) => !SAFE_PATH.test(value))) throw new Error(`Maintainer harness ${label} contains an unsafe path.`);
  return Object.freeze(normalized);
}

function safeTokens(values, label, { allowEmpty = false } = {}) {
  if (!Array.isArray(values) || (!allowEmpty && !values.length) || values.length > MAX_ITEMS) {
    throw new Error(`Maintainer harness ${label} requires a bounded${allowEmpty ? "" : " non-empty"} list.`);
  }
  const normalized = [...new Set(values.map((value) => String(value || "").trim()))].sort();
  if (normalized.some((value) => !SAFE_ID.test(value))) throw new Error(`Maintainer harness ${label} contains an invalid value.`);
  return Object.freeze(normalized);
}

function assertHarnessAuthority(authority, learningProposal, skillProposal) {
  if (
    authority?.authorityClass !== MAINTAINER_HARNESS_AUTHORITY_CLASS
    || authority.serverOwned !== true
    || authority.humanProfileId !== ""
  ) throw new Error("Maintainer promotion requires server-owned harness approver authority without Human credentials.");
  const approverId = checkedToken(authority.approverId, "approver ID", SAFE_ID);
  if (approverId === learningProposal?.proposedBy?.operatorId) {
    throw new Error("Maintainer proposer and harness approver must be separate authorities.");
  }
  if (skillProposal?.proposedBy?.operatorId && approverId === skillProposal.proposedBy.operatorId) {
    throw new Error("Maintainer skill proposer and harness approver must be separate authorities.");
  }
  return approverId;
}

function validatePolicy(policy, action, learningProposal, skillProposal) {
  const policyId = checkedToken(policy?.policyId, "policy ID", SAFE_ID);
  const policyVersion = String(policy?.policyVersion || "").trim();
  if (!POLICY_VERSION.test(policyVersion)) throw new Error("Maintainer harness policy version is missing or invalid.");
  const policyRef = checkedToken(policy?.policyRef, "policy reference", SAFE_REF);
  const allowedDomains = safeTokens(policy?.allowedDomains || [], "allowed domains");
  const allowedKinds = safeTokens(policy?.allowedLearningKinds || [], "allowed learning kinds");
  const requiredCheckKinds = safeTokens(policy?.requiredCheckKinds || [], "required deterministic checks");
  if (!REQUIRED_BASELINE_CHECKS.every((kind) => requiredCheckKinds.includes(kind))) {
    throw new Error("Maintainer harness policy cannot weaken the baseline deterministic promotion checks.");
  }
  if (!allowedDomains.includes(learningProposal.domain) || !allowedKinds.includes(learningProposal.kind)) {
    throw new Error("Maintainer learning proposal is outside harness policy scope.");
  }
  if (action === "durable-knowledge-admission" && policy.allowDurableKnowledgeAdmission !== true) {
    throw new Error("Maintainer harness policy does not allow durable knowledge admission.");
  }
  let allowedSkillRoles = Object.freeze([]);
  let allowedSkillConsumers = Object.freeze([]);
  if (action === "skill-version-promotion") {
    if (policy.allowSkillVersionPromotion !== true) throw new Error("Maintainer harness policy does not allow skill version promotion.");
    allowedSkillRoles = safeTokens(policy.allowedSkillRoles || [], "allowed skill roles");
    allowedSkillConsumers = safeTokens(policy.allowedSkillConsumers || [], "allowed skill consumers");
    if (skillProposal.requestedRoles.some((role) => !allowedSkillRoles.includes(role))) {
      throw new Error("Maintainer skill proposal requests a role outside harness policy scope.");
    }
    if (skillProposal.requestedConsumers.some((consumer) => !allowedSkillConsumers.includes(consumer))) {
      throw new Error("Maintainer skill proposal requests a consumer outside harness policy scope.");
    }
  }
  return Object.freeze({ policyId, policyVersion, policyRef, allowedDomains, allowedKinds, requiredCheckKinds, allowedSkillRoles, allowedSkillConsumers });
}

function validateArchitecture(architectureSnapshot, exactCommitSha, learningProposal) {
  if (
    architectureSnapshot?.state !== "verified"
    || architectureSnapshot.operationalAuthorityGranted !== false
    || architectureSnapshot.durableAdmissionAllowed !== false
  ) throw new Error("Maintainer promotion requires a verified, non-operational architecture snapshot that has not self-admitted.");
  if (architectureSnapshot.exactCommitSha !== exactCommitSha) {
    throw new Error("Maintainer promotion architecture evidence is stale for the exact head.");
  }
  const domain = architectureSnapshot.domains?.find((item) => item.domain === learningProposal.domain);
  if (!domain) throw new Error("Maintainer promotion requires verified ownership evidence for the learning domain.");
  return domain;
}

function validateLearningProposal(learningProposal, exactCommitSha) {
  if (!learningProposal || learningProposal.state !== "observed") {
    throw new Error("Maintainer promotion requires an observed evidence-learning proposal.");
  }
  if (learningProposal.exactCommitSha !== exactCommitSha) {
    throw new Error("Maintainer learning evidence is stale for the exact head.");
  }
  checkedToken(learningProposal.proposalId, "learning proposal ID", SAFE_ID);
  checkedToken(learningProposal.dedupeKey, "learning dedupe key", SAFE_ID);
  checkedToken(learningProposal.domain, "learning domain", SAFE_ID);
  checkedToken(learningProposal.kind, "learning kind", SAFE_ID);
  if (!Array.isArray(learningProposal.evidence) || !learningProposal.evidence.length || learningProposal.evidence.length > MAX_ITEMS) {
    throw new Error("Maintainer promotion requires bounded learning provenance evidence.");
  }
  for (const item of learningProposal.evidence) checkedToken(item?.ref, "learning evidence reference", SAFE_REF);
}

function validateSkillProposal(skillProposal, learningProposal, architectureSnapshot, exactCommitSha) {
  if (!skillProposal || skillProposal.state !== "observed") {
    throw new Error("Skill version promotion requires an observed governed skill proposal.");
  }
  if (skillProposal.exactCommitSha !== exactCommitSha) throw new Error("Maintainer skill proposal is stale for the exact head.");
  if (skillProposal.learningProposalId !== learningProposal.proposalId || skillProposal.learningDedupeKey !== learningProposal.dedupeKey) {
    throw new Error("Maintainer skill proposal provenance does not match the learning proposal.");
  }
  if (skillProposal.architectureSnapshotId !== architectureSnapshot.snapshotId) {
    throw new Error("Maintainer skill proposal provenance does not match the architecture snapshot.");
  }
  if (
    skillProposal.registryMutationAllowed !== false
    || skillProposal.sourceMutationAllowed !== false
    || skillProposal.skillInstallationAllowed !== false
    || skillProposal.skillActivationAllowed !== false
    || skillProposal.selfApprovalAllowed !== false
    || skillProposal.operationalAuthorityGranted !== false
    || skillProposal.aiSelfCertified !== false
  ) throw new Error("Maintainer skill proposal already claims authority it is not allowed to hold.");
}

function validateDeterministicChecks(checks, exactCommitSha, requiredCheckKinds, skillProposal) {
  if (!Array.isArray(checks) || !checks.length || checks.length > MAX_ITEMS) {
    throw new Error("Maintainer promotion requires bounded deterministic check evidence.");
  }
  const seenIds = new Set();
  const normalized = checks.map((check) => {
    const checkId = checkedToken(check?.checkId, "deterministic check ID", SAFE_ID);
    if (seenIds.has(checkId)) throw new Error("Maintainer deterministic check IDs must be unique.");
    seenIds.add(checkId);
    if (!MAINTAINER_DETERMINISTIC_CHECK_KINDS.includes(check?.kind)) throw new Error("Maintainer deterministic check kind is invalid.");
    if (check?.status !== "passed" || check?.authority !== "deterministic") {
      throw new Error("Maintainer promotion fails closed unless every supplied deterministic check passed authoritatively.");
    }
    if (exactSha(check.commitSha, "deterministic check") !== exactCommitSha) {
      throw new Error("Maintainer deterministic check evidence is not bound to the exact head.");
    }
    return Object.freeze({
      checkId,
      kind: check.kind,
      ref: checkedToken(check.ref, "deterministic check reference", SAFE_REF),
      commitSha: exactCommitSha,
      status: "passed",
      authority: "deterministic",
    });
  });
  for (const requiredKind of requiredCheckKinds) {
    if (!normalized.some((check) => check.kind === requiredKind)) {
      throw new Error(`Maintainer promotion is missing required deterministic check ${requiredKind}.`);
    }
  }
  if (skillProposal) {
    for (const contractTestRef of skillProposal.contractTestRefs || []) {
      if (!normalized.some((check) => check.kind === "focused-tests" && check.ref === contractTestRef)) {
        throw new Error("Maintainer skill promotion requires every proposed contract test to pass on the exact head.");
      }
    }
  }
  return Object.freeze(normalized);
}

function timestamp(value) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new Error("Maintainer harness approval timestamp is invalid.");
  return parsed.toISOString();
}

export function createMaintainerHarnessAdmissionDecision({
  harnessAuthority,
  action,
  currentCommitSha,
  architectureSnapshot,
  learningProposal,
  skillProposal = null,
  policy,
  deterministicChecks,
  approvedAt,
}) {
  if (!MAINTAINER_PROMOTION_ACTIONS.includes(action)) throw new Error("Maintainer harness promotion action is invalid.");
  const exactCommitSha = exactSha(currentCommitSha, "current");
  validateLearningProposal(learningProposal, exactCommitSha);
  const approverId = assertHarnessAuthority(harnessAuthority, learningProposal, skillProposal);
  const domainEvidence = validateArchitecture(architectureSnapshot, exactCommitSha, learningProposal);
  if (action === "skill-version-promotion") {
    if (learningProposal.kind !== "skill-proposal") throw new Error("Skill version promotion requires a skill learning proposal.");
    validateSkillProposal(skillProposal, learningProposal, architectureSnapshot, exactCommitSha);
  } else if (skillProposal) {
    throw new Error("Durable knowledge admission cannot silently promote a skill proposal.");
  }
  const normalizedPolicy = validatePolicy(policy, action, learningProposal, skillProposal);
  const normalizedChecks = validateDeterministicChecks(
    deterministicChecks,
    exactCommitSha,
    normalizedPolicy.requiredCheckKinds,
    skillProposal,
  );
  const freshnessPaths = safePaths([
    ...(learningProposal.freshnessPaths || []),
    ...(domainEvidence.changedPathInvalidationInputs || []),
    ...(skillProposal ? [skillProposal.entryPath, skillProposal.registryEvidenceRef, skillProposal.constitutionRef] : []),
  ], "freshness paths");
  const approvedTimestamp = timestamp(approvedAt);
  const decisionMaterial = JSON.stringify({
    action,
    exactCommitSha,
    learningDedupeKey: learningProposal.dedupeKey,
    skillProposalId: skillProposal?.skillProposalId || "",
    policyId: normalizedPolicy.policyId,
    policyVersion: normalizedPolicy.policyVersion,
    deterministicChecks: normalizedChecks.map((item) => [item.checkId, item.ref]),
  });
  const decisionId = `maintainer-approval-${createHash("sha256").update(decisionMaterial).digest("hex").slice(0, 32)}`;

  return Object.freeze({
    schemaVersion: 1,
    decisionId,
    harnessApprovalRef: `harness-approval:${decisionId}`,
    action,
    state: "approved",
    exactCommitSha,
    learningProposalId: learningProposal.proposalId,
    learningDedupeKey: learningProposal.dedupeKey,
    architectureSnapshotId: architectureSnapshot.snapshotId,
    skillProposalId: skillProposal?.skillProposalId || "",
    skillVersionKey: skillProposal?.versionKey || "",
    domain: learningProposal.domain,
    kind: learningProposal.kind,
    policy: Object.freeze({
      policyId: normalizedPolicy.policyId,
      policyVersion: normalizedPolicy.policyVersion,
      policyRef: normalizedPolicy.policyRef,
    }),
    approvedBy: Object.freeze({
      authorityClass: MAINTAINER_HARNESS_AUTHORITY_CLASS,
      serverOwned: true,
      approverId,
      humanProfileId: "",
    }),
    deterministicCheckRefs: Object.freeze(normalizedChecks.map((item) => `${item.kind}:${item.ref}`)),
    freshnessPaths,
    approvedAt: approvedTimestamp,
    durableAdmissionEligible: true,
    skillVersionPromotionEligible: action === "skill-version-promotion",
    skillActivationEligible: action === "skill-version-promotion",
    durablyAdmitted: false,
    registryMutationAllowed: false,
    sourceMutationAllowed: false,
    skillInstalled: false,
    skillActivated: false,
    operationalAuthorityGranted: false,
    aiSelfCertified: false,
  });
}
