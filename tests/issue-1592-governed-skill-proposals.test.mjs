import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createExactHeadArchitectureSnapshot } from "../build/autonomous-guest/maintainer/architecture-learner.mjs";
import { createGovernedSkillVersionProposal } from "../build/autonomous-guest/maintainer/skill-proposal.mjs";
import { runRepositoryArchitectureInventory } from "../scripts/repository-architecture-inventory.mjs";

const HEAD = "c".repeat(40);
const authority = Object.freeze({
  authorityClass: "delegated-guest-autonomous-operator",
  delegated: true,
  humanProfileId: "",
  accessMode: "desktop-loopback",
  autonomousRunId: "run-1592-slice-c",
  workspaceId: "repository-main",
  operatorId: "skill-proposer",
});

async function fixtures() {
  const inventory = await runRepositoryArchitectureInventory({ writeArtifact: false });
  const architectureSnapshot = createExactHeadArchitectureSnapshot({ authority, exactCommitSha: HEAD, inventory });
  const learningProposal = Object.freeze({
    proposalId: "learning-skill-001",
    dedupeKey: "maintainer-learning-example",
    kind: "skill-proposal",
    state: "observed",
    exactCommitSha: HEAD,
    skillId: "architecture-maintenance",
  });
  const candidate = Object.freeze({
    changeKind: "create",
    proposedVersion: "1.0.0",
    replacesVersion: "",
    summary: "Inspect one bounded architecture question and return exact-head evidence without changing repository authority.",
    entryPath: ".agents/skills/architecture-maintenance/SKILL.md",
    candidateDigest: createHash("sha256").update("candidate skill package").digest("hex"),
    requestedRoles: ["architecture-scout"],
    requestedConsumers: ["developer-worker"],
    contractTestRefs: ["tests/issue-1592-governed-skill-proposals.test.mjs"],
  });
  return { architectureSnapshot, learningProposal, candidate };
}

test("#1592 Slice C creates a versioned skill proposal from exact-head Slice A and B evidence", async () => {
  const input = await fixtures();
  const proposal = createGovernedSkillVersionProposal({ authority, ...input });
  assert.equal(proposal.skillId, "architecture-maintenance");
  assert.equal(proposal.versionKey, "architecture-maintenance@1.0.0");
  assert.equal(proposal.exactCommitSha, HEAD);
  assert.equal(proposal.state, "observed");
  assert.equal(proposal.registryEvidenceRef, "config/agent-skills.json");
  assert.equal(proposal.constitutionRef, "AGENTS.md");
  assert.match(proposal.skillProposalId, /^maintainer-skill-[a-f0-9]{32}$/);
});

test("#1592 Slice C requires one exact commit across learning and architecture evidence", async () => {
  const input = await fixtures();
  assert.throws(
    () => createGovernedSkillVersionProposal({ authority, ...input, architectureSnapshot: { ...input.architectureSnapshot, exactCommitSha: "d".repeat(40) } }),
    /same exact commit/,
  );
  assert.throws(
    () => createGovernedSkillVersionProposal({ authority, ...input, learningProposal: { ...input.learningProposal, state: "approved" } }),
    /observed Slice A skill proposal/,
  );
  assert.throws(
    () => createGovernedSkillVersionProposal({ authority, ...input, architectureSnapshot: { ...input.architectureSnapshot, state: "stale" } }),
    /verified non-operational architecture snapshot/,
  );
});

test("#1592 Slice C distinguishes create and update versions without touching the registry", async () => {
  const input = await fixtures();
  assert.throws(
    () => createGovernedSkillVersionProposal({ authority, ...input, candidate: { ...input.candidate, changeKind: "create", replacesVersion: "0.9.0" } }),
    /cannot replace/,
  );
  assert.throws(
    () => createGovernedSkillVersionProposal({ authority, ...input, candidate: { ...input.candidate, changeKind: "update", replacesVersion: "" } }),
    /must name the version/,
  );
  const update = createGovernedSkillVersionProposal({
    authority,
    ...input,
    candidate: { ...input.candidate, changeKind: "update", proposedVersion: "1.1.0", replacesVersion: "1.0.0" },
  });
  assert.equal(update.changeKind, "update");
  assert.equal(update.replacesVersion, "1.0.0");
});

test("#1592 Slice C confines candidate paths, digests and deterministic tests", async () => {
  const input = await fixtures();
  assert.throws(
    () => createGovernedSkillVersionProposal({ authority, ...input, candidate: { ...input.candidate, entryPath: ".agents/skills/other/SKILL.md" } }),
    /exact PlotPickle skill package/,
  );
  assert.throws(
    () => createGovernedSkillVersionProposal({ authority, ...input, candidate: { ...input.candidate, candidateDigest: "unknown" } }),
    /exact SHA-256 digest/,
  );
  assert.throws(
    () => createGovernedSkillVersionProposal({ authority, ...input, candidate: { ...input.candidate, contractTestRefs: ["docs/test-plan.md"] } }),
    /PlotPickle test files/,
  );
});

test("#1592 Slice C grants no approval, mutation, installation, activation or operational authority", async () => {
  const input = await fixtures();
  const proposal = createGovernedSkillVersionProposal({ authority, ...input });
  for (const boundary of [
    "registryMutationAllowed",
    "sourceMutationAllowed",
    "skillInstallationAllowed",
    "skillActivationAllowed",
    "selfApprovalAllowed",
    "operationalAuthorityGranted",
    "aiSelfCertified",
  ]) assert.equal(proposal[boundary], false, `${boundary} must remain false`);
  assert.equal(proposal.harnessApprovalRef, "");

  const source = await readFile(new URL("../build/autonomous-guest/maintainer/skill-proposal.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /writeFile|mkdir|update_file|create_file|installSkill|activateSkill|npm install|request_plugin_install/);
});
