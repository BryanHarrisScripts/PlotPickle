import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createMaintainerHarnessAdmissionDecision } from "../build/autonomous-guest/maintainer/admission-gate.mjs";

const HEAD = "a".repeat(40);
const proposer = Object.freeze({
  authorityClass: "delegated-guest-autonomous-operator",
  autonomousRunId: "run-1592-slice-d",
  workspaceId: "repository-main",
  operatorId: "skill-proposer",
  humanProfileId: "",
});
const harnessAuthority = Object.freeze({
  authorityClass: "plotpickle-maintainer-harness-approver",
  serverOwned: true,
  humanProfileId: "",
  approverId: "harness-policy-engine",
});
const learningProposal = Object.freeze({
  proposalId: "learning-skill-001",
  dedupeKey: "maintainer-learning-example",
  kind: "skill-proposal",
  domain: "developer",
  state: "observed",
  exactCommitSha: HEAD,
  evidence: Object.freeze([
    Object.freeze({ kind: "source", ref: "build/autonomous-guest/maintainer/skill-proposal.mjs" }),
    Object.freeze({ kind: "test", ref: "tests/issue-1592-governed-skill-proposals.test.mjs" }),
  ]),
  freshnessPaths: Object.freeze(["build/autonomous-guest/maintainer"]),
  proposedBy: proposer,
});
const architectureSnapshot = Object.freeze({
  snapshotId: "maintainer-architecture-example",
  state: "verified",
  exactCommitSha: HEAD,
  durableAdmissionAllowed: false,
  operationalAuthorityGranted: false,
  domains: Object.freeze([
    Object.freeze({
      domain: "developer",
      changedPathInvalidationInputs: Object.freeze([
        "config/repository-architecture-target.json",
        "scripts/repository-architecture-inventory.mjs",
        "tests",
        "scripts",
        ".agents/skills",
      ]),
    }),
  ]),
});
const skillProposal = Object.freeze({
  skillProposalId: "maintainer-skill-example",
  learningProposalId: learningProposal.proposalId,
  learningDedupeKey: learningProposal.dedupeKey,
  architectureSnapshotId: architectureSnapshot.snapshotId,
  exactCommitSha: HEAD,
  state: "observed",
  versionKey: "architecture-maintenance@1.0.0",
  entryPath: ".agents/skills/architecture-maintenance/SKILL.md",
  registryEvidenceRef: "config/agent-skills.json",
  constitutionRef: "AGENTS.md",
  requestedRoles: Object.freeze(["architecture-scout"]),
  requestedConsumers: Object.freeze(["developer-worker"]),
  contractTestRefs: Object.freeze(["tests/issue-1592-governed-skill-proposals.test.mjs"]),
  registryMutationAllowed: false,
  sourceMutationAllowed: false,
  skillInstallationAllowed: false,
  skillActivationAllowed: false,
  selfApprovalAllowed: false,
  operationalAuthorityGranted: false,
  aiSelfCertified: false,
});
const policy = Object.freeze({
  policyId: "maintainer-promotion",
  policyVersion: "1.0.0",
  policyRef: "policy:maintainer-promotion-v1",
  allowedDomains: Object.freeze(["developer"]),
  allowedLearningKinds: Object.freeze(["skill-proposal"]),
  requiredCheckKinds: Object.freeze([
    "focused-tests",
    "architecture-inventory",
    "production-build",
    "exact-head-ci",
  ]),
  allowDurableKnowledgeAdmission: true,
  allowSkillVersionPromotion: true,
  allowedSkillRoles: Object.freeze(["architecture-scout"]),
  allowedSkillConsumers: Object.freeze(["developer-worker"]),
});
const deterministicChecks = Object.freeze([
  Object.freeze({
    checkId: "focused-1592-c",
    kind: "focused-tests",
    ref: "tests/issue-1592-governed-skill-proposals.test.mjs",
    commitSha: HEAD,
    status: "passed",
    authority: "deterministic",
  }),
  Object.freeze({
    checkId: "architecture-inventory",
    kind: "architecture-inventory",
    ref: "artifact:repository-architecture/inventory.json",
    commitSha: HEAD,
    status: "passed",
    authority: "deterministic",
  }),
  Object.freeze({
    checkId: "production-build",
    kind: "production-build",
    ref: "npm:build",
    commitSha: HEAD,
    status: "passed",
    authority: "deterministic",
  }),
  Object.freeze({
    checkId: "exact-head-ci",
    kind: "exact-head-ci",
    ref: "workflow:evidence-learning-maintainer",
    commitSha: HEAD,
    status: "passed",
    authority: "deterministic",
  }),
]);

function approve(overrides = {}) {
  return createMaintainerHarnessAdmissionDecision({
    harnessAuthority,
    action: "skill-version-promotion",
    currentCommitSha: HEAD,
    architectureSnapshot,
    learningProposal,
    skillProposal,
    policy,
    deterministicChecks,
    approvedAt: "2026-09-01T13:00:00Z",
    ...overrides,
  });
}

test("#1592 Slice D lets only the harness approve exact-head evidence for later admission or promotion", () => {
  const decision = approve();
  assert.equal(decision.state, "approved");
  assert.equal(decision.action, "skill-version-promotion");
  assert.equal(decision.exactCommitSha, HEAD);
  assert.equal(decision.approvedBy.authorityClass, "plotpickle-maintainer-harness-approver");
  assert.equal(decision.approvedBy.approverId, "harness-policy-engine");
  assert.equal(decision.policy.policyRef, "policy:maintainer-promotion-v1");
  assert.match(decision.decisionId, /^maintainer-approval-[a-f0-9]{32}$/);
  assert.equal(decision.harnessApprovalRef, `harness-approval:${decision.decisionId}`);
});

test("#1592 Slice D separates proposer from approver and never accepts Guest self-approval", () => {
  assert.throws(
    () => approve({ harnessAuthority: { ...harnessAuthority, approverId: proposer.operatorId } }),
    /separate authorities/,
  );
  assert.throws(
    () => approve({ harnessAuthority: { ...harnessAuthority, authorityClass: proposer.authorityClass } }),
    /server-owned harness approver authority/,
  );
});

test("#1592 Slice D fails closed on stale architecture, learning, skill or deterministic evidence", () => {
  assert.throws(
    () => approve({ currentCommitSha: "b".repeat(40) }),
    /stale for the exact head/,
  );
  assert.throws(
    () => approve({ architectureSnapshot: { ...architectureSnapshot, state: "stale" } }),
    /verified, non-operational architecture snapshot/,
  );
  assert.throws(
    () => approve({ skillProposal: { ...skillProposal, exactCommitSha: "b".repeat(40) } }),
    /stale for the exact head/,
  );
  const redChecks = deterministicChecks.map((check) => check.kind === "production-build" ? { ...check, status: "failed" } : check);
  assert.throws(
    () => approve({ deterministicChecks: redChecks }),
    /fails closed/,
  );
});

test("#1592 Slice D refuses policy weakening, out-of-scope roles and missing contract-test proof", () => {
  assert.throws(
    () => approve({ policy: { ...policy, requiredCheckKinds: ["focused-tests", "production-build"] } }),
    /cannot weaken the baseline/,
  );
  assert.throws(
    () => approve({ policy: { ...policy, allowedSkillRoles: ["repair"] } }),
    /role outside harness policy scope/,
  );
  assert.throws(
    () => approve({ deterministicChecks: deterministicChecks.filter((check) => check.kind !== "focused-tests") }),
    /missing required deterministic check focused-tests/,
  );
  assert.throws(
    () => approve({ deterministicChecks: deterministicChecks.map((check) => check.kind === "focused-tests" ? { ...check, ref: "tests/issue-1592-harness-admission-promotion.test.mjs" } : check) }),
    /every proposed contract test to pass/,
  );
});

test("#1592 Slice D approval grants eligibility only; it does not persist, install, activate or gain operational authority", async () => {
  const decision = approve();
  assert.equal(decision.durableAdmissionEligible, true);
  assert.equal(decision.skillVersionPromotionEligible, true);
  assert.equal(decision.skillActivationEligible, true);
  for (const boundary of [
    "durablyAdmitted",
    "registryMutationAllowed",
    "sourceMutationAllowed",
    "skillInstalled",
    "skillActivated",
    "operationalAuthorityGranted",
    "aiSelfCertified",
  ]) assert.equal(decision[boundary], false, `${boundary} must remain false`);

  const source = await readFile(new URL("../build/autonomous-guest/maintainer/admission-gate.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /writeFile|mkdir|update_file|create_file|installSkill|activateSkill|npm install|request_plugin_install/);
});
