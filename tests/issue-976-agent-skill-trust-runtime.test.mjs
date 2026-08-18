import assert from "node:assert/strict";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  builtInAgentSkillTrustRecords,
  externalSkillTrustState,
  inspectAgentSkillPackage,
  inspectQuarantinedExternalSkill,
  selfTestAgentSkillTrust,
  trustedAgentSkillIndex,
} from "../scripts/agent-skill-trust.mjs";

const ROOT = path.resolve(new URL("..", import.meta.url).pathname);
const FIXTURE = path.join(ROOT, "tests", "fixtures", "agent-skills", "quarantined-external");
const SENTINEL = path.join(FIXTURE, "EXECUTED-SENTINEL.txt");

test("all packaged Skills receive deterministic complete trust records with SHA-256 tree hashes", async () => {
  const records = await builtInAgentSkillTrustRecords();
  assert.equal(records.length, 6);
  for (const record of records) {
    assert.equal(record.sourceKind, "plotpickle-built-in");
    assert.equal(record.trustState, "trusted-built-in");
    assert.equal(record.reviewStatus, "approved");
    assert.match(record.contentSha256, /^[a-f0-9]{64}$/);
    assert.equal(record.hashAlgorithm, "sha256-tree-v1");
    assert.ok(record.pinnedRevision);
    assert.ok(record.license);
    assert.ok(record.author || record.publisher);
    assert.ok(Array.isArray(record.requestedCapabilityClasses));
    assert.ok(Array.isArray(record.forbiddenCapabilityClasses));
    assert.ok(record.evalStatus);
    assert.ok(record.lastEvaluatedRevision);
    assert.equal(record.productionDiscoverable, true);
    assert.equal(record.executionAllowed, true);
    assert.equal(record.capabilitiesGranted, false);
  }
});

test("trusted Skill index exposes safe trust/provenance metadata and never claims capabilities are granted", async () => {
  const index = await trustedAgentSkillIndex();
  assert.equal(index.length, 6);
  for (const item of index) {
    assert.match(item.uri, /^skill:\/\/plotpickle\//);
    assert.match(item.contentSha256, /^[a-f0-9]{64}$/);
    assert.equal(item.trustState, "trusted-built-in");
    assert.equal(item.capabilitiesGranted, false);
    assert.ok(item.pinnedRevision);
    assert.ok(item.evalStatus);
  }
});

test("host trust self-test passes and quarantined external Skill remains non-discoverable and non-executable", async () => {
  await rm(SENTINEL, { force: true });
  const result = await selfTestAgentSkillTrust();
  assert.equal(result.ok, true);
  assert.equal(result.quarantine.trustState, "quarantined");
  assert.equal(result.quarantine.productionDiscoverable, false);
  assert.equal(result.quarantine.executionAllowed, false);
  assert.equal(result.quarantine.executableScriptsPresent, true);
  assert.equal(result.quarantine.capabilitiesGranted, false);
  await assert.rejects(readFile(SENTINEL, "utf8"), (error) => error?.code === "ENOENT");
});

test("quarantine inspection treats hostile external text and scripts as inert data", async () => {
  await rm(SENTINEL, { force: true });
  const { record, inspected } = await inspectQuarantinedExternalSkill();
  assert.equal(inspected.executedScripts, false);
  assert.ok(inspected.staticRiskFindings.some((finding) => finding.ruleId === "credential-access"));
  assert.ok(inspected.staticRiskFindings.some((finding) => finding.ruleId === "network-egress"));
  assert.ok(inspected.staticRiskFindings.some((finding) => finding.ruleId === "direct-canon-mutation"));
  assert.ok(record.requestedCapabilityClasses.includes("credential-read"));
  assert.ok(record.forbiddenCapabilityClasses.includes("credential-read"));
  assert.ok(record.forbiddenCapabilityClasses.includes("ppf-direct-write"));
  await assert.rejects(readFile(SENTINEL, "utf8"), (error) => error?.code === "ENOENT");
});

test("changing one byte changes the Skill package hash and invalidates a previously approved external revision", async () => {
  const temp = await mkdtemp(path.join(os.tmpdir(), "plotpickle-skill-trust-"));
  try {
    const copy = path.join(temp, "skill");
    await cp(FIXTURE, copy, { recursive: true });
    const first = await inspectAgentSkillPackage({ root: copy });
    const skillPath = path.join(copy, "SKILL.md");
    await writeFile(skillPath, `${await readFile(skillPath, "utf8")}\nChanged byte for hash invalidation test.\n`, "utf8");
    const second = await inspectAgentSkillPackage({ root: copy });
    assert.notEqual(first.contentSha256, second.contentSha256);

    const before = externalSkillTrustState({
      requestedTrustState: "approved-external",
      reviewStatus: "approved",
      approvedContentSha256: first.contentSha256,
      approvedPinnedRevision: "external@abc123",
      currentContentSha256: first.contentSha256,
      currentPinnedRevision: "external@abc123",
    });
    assert.equal(before.trustState, "approved-external");

    const after = externalSkillTrustState({
      requestedTrustState: "approved-external",
      reviewStatus: "approved",
      approvedContentSha256: first.contentSha256,
      approvedPinnedRevision: "external@abc123",
      currentContentSha256: second.contentSha256,
      currentPinnedRevision: "external@abc123",
    });
    assert.equal(after.trustState, "quarantined");
    assert.equal(after.contentHashMatchesApproval, false);
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
});
