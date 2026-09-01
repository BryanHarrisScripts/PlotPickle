import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1592 defines evidence-learning kinds and lifecycle without self-modifying authority", async () => {
  const source = await read("build/autonomous-guest/maintainer/learning-evidence.ts");
  for (const value of [
    "architecture-fact",
    "operational-procedure",
    "defect-lesson",
    "skill-proposal",
    "observed",
    "verified",
    "approved",
    "stale",
    "retired",
  ]) assert.ok(source.includes(`"${value}"`), `Missing evidence-learning contract ${value}`);

  for (const boundary of [
    "sourceMutationAllowed: false",
    "directCanonMutationAllowed: false",
    "humanCredentialAccessAllowed: false",
    "hiddenReasoningStorageAllowed: false",
    "privateStoryTextStorageAllowed: false",
    "selfApprovalAllowed: false",
    "skillInstallationAllowed: false",
    "skillActivationAllowed: false",
    "operationalAuthorityGranted: false",
    "aiSelfCertified: false",
  ]) assert.ok(source.includes(boundary), `Missing evidence-learning boundary ${boundary}`);

  assert.doesNotMatch(source, /writeFile|mkdir|localStorage|database|installSkill|activateSkill|applyStoryCommand|saveActiveLibraryProject/);
});

test("#1592 proposal domains stay aligned with the ratified repository architecture", async () => {
  const [source, architectureText] = await Promise.all([
    read("build/autonomous-guest/maintainer/learning-evidence.ts"),
    read("config/repository-architecture-target.json"),
  ]);
  const architecture = JSON.parse(architectureText);
  for (const domain of Object.keys(architecture.domains)) {
    assert.ok(source.includes(`"${domain}"`), `Missing ratified architecture domain ${domain}`);
  }
  assert.ok(source.includes("MAINTAINER_ARCHITECTURE_DOMAINS"));
  assert.ok(source.includes("Evidence-learning architecture domain is invalid."));
});

test("#1592 proposals bind exact-head evidence, provenance, freshness and deduplication", async () => {
  const source = await read("build/autonomous-guest/maintainer/learning-evidence.ts");
  for (const contract of [
    "createMaintainerLearningProposal",
    "evaluateMaintainerLearningFreshness",
    "exact 40-character commit SHA",
    "evidenceCommitSha",
    "currentCommitSha",
    "requiresHarnessReverification",
    "freshnessPaths",
    "dedupeKey",
    "createHash",
    "source",
    "test",
    "workflow",
    "artifact",
    "defect",
  ]) assert.ok(source.includes(contract), `Missing evidence-learning provenance contract ${contract}`);

  assert.match(source, /proposal\.exactCommitSha !== normalizedCurrent/);
  assert.match(source, /state: stale \? "stale"/);
  assert.match(source, /operationalAuthorityGranted: false/);
});

test("#1592 only delegated non-Human loopback Guests may propose learning", async () => {
  const [source, authority] = await Promise.all([
    read("build/autonomous-guest/maintainer/learning-evidence.ts"),
    read("core/auth/autonomous-guest/guest-authority.ts"),
  ]);
  for (const contract of [
    'authorityClass !== "delegated-guest-autonomous-operator"',
    'authority.humanProfileId !== ""',
    'authority.accessMode !== "desktop-loopback"',
    'humanProfileId: ""',
    "autonomousRunId",
    "workspaceId",
    "operatorId",
  ]) assert.ok(source.includes(contract), `Missing Guest learning authority boundary ${contract}`);

  assert.ok(authority.includes('AUTONOMOUS_GUEST_AUTHORITY_CLASS = "delegated-guest-autonomous-operator"'));
  assert.doesNotMatch(source, /authenticated-human|Human vault|BUZZ_AUTH_TAG|private[_-]?key/i);
});

test("#1592 skill learning remains a proposal and cannot silently activate", async () => {
  const source = await read("build/autonomous-guest/maintainer/learning-evidence.ts");
  assert.match(source, /input\.kind === "skill-proposal" && !skillId/);
  assert.match(source, /input\.kind !== "skill-proposal" && skillId/);
  assert.ok(source.includes("Only evidence-learning skill proposals may name a skill ID."));
  assert.ok(source.includes('harnessApprovalRef: ""'));
  assert.ok(source.includes("skillInstallationAllowed: false"));
  assert.ok(source.includes("skillActivationAllowed: false"));
  assert.doesNotMatch(source, /skills\/install|skill-installer|npm install|request_plugin_install/);
});

test("#1592 evidence and summaries are bounded and reject obvious secret or hidden-reasoning material", async () => {
  const source = await read("build/autonomous-guest/maintainer/learning-evidence.ts");
  for (const contract of [
    "MAX_EVIDENCE = 64",
    "MAX_PATHS = 32",
    "MAX_REFS = 64",
    "MAX_SUMMARY = 600",
    "FORBIDDEN_SUMMARY",
    "hidden reasoning",
    "PRIVATE KEY",
    "freshness path is invalid or escapes the repository",
    "evidence references must be unique",
  ]) assert.ok(source.includes(contract), `Missing bounded learning evidence contract ${contract}`);
});
