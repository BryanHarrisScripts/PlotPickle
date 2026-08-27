import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

const ROOT = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");
const HOST_FORBIDDEN = ["ppf-direct-write", "github-write", "developer-shell", "credential-read", "provider-selection"];

test("BEN is a deterministic code-quality observer with no developer or merge authority", async () => {
  const registry = JSON.parse(await read("config/agent-profiles.json"));
  const ben = registry.profiles.find((profile) => profile.id === "ben");
  assert.ok(ben, "BEN Agent Profile must exist");
  assert.equal(ben.displayName, "BEN");
  assert.equal(ben.execution.kind, "deterministic-observer");
  assert.equal(ben.execution.roleId, "code-quality-review");
  assert.equal(ben.buzzBinding.mode, "service");
  assert.equal(ben.requestedCapabilityRole, null);
  assert.deepEqual(ben.skillUris, ["skill://plotpickle/ben-code-quality"]);
  assert.ok(ben.requestedCapabilities.includes("repository-diff-read"));
  assert.ok(ben.requestedCapabilities.includes("code-quality-evidence"));
  assert.ok(ben.proposalScopes.includes("code-quality-finding"));
  assert.ok(ben.verificationContract.includes("cannot self-certify"));
  for (const capability of HOST_FORBIDDEN) {
    assert.equal(ben.requestedCapabilities.includes(capability), false, `BEN cannot request ${capability}`);
  }
  assert.ok(ben.forbiddenCapabilities.includes("merge-authority"));
  assert.equal(ben.creativeAuthority, "none");
});

test("BEN Skill is a local progressive coding standard consumed by BEN and coding workers", async () => {
  const registry = JSON.parse(await read("config/agent-skills.json"));
  const skill = registry.skills.find((entry) => entry.id === "ben-code-quality");
  assert.ok(skill);
  assert.equal(skill.uri, "skill://plotpickle/ben-code-quality");
  assert.equal(skill.primaryWorker, "ben");
  assert.equal(skill.localOnly, true);
  assert.equal(skill.mcpReady, true);
  for (const consumer of ["ben", "pi", "developer-worker"]) assert.ok(skill.consumers.includes(consumer));

  const source = await read(".agents/skills/ben-code-quality/SKILL.md");
  for (const expected of [
    /descriptive 2–4 word exported names/i,
    /concept-named files/i,
    /one authoritative definition/i,
    /precise domain types/i,
    /plain-language documentation where search lands/i,
    /stable, distinctive literal phrase/i,
    /Keep orchestrators thin/i,
    /moved code has no stale duplicate definition/i,
  ]) assert.match(source, expected);
  assert.match(source, /adapted from Modem's `write-discoverable-code`/i);
  assert.match(source, /licensed MIT/i);
  assert.match(source, /Skill is procedure only/i);
  assert.match(source, /cannot waive a failing gate/i);
});

test("repair workers inherit BEN discoverability standards without receiving new authority", async () => {
  const repair = await read(".agents/skills/uat-repair/SKILL.md");
  assert.match(repair, /skill:\/\/plotpickle\/ben-code-quality/);
  assert.match(repair, /descriptive exported names/i);
  assert.match(repair, /concept-named files/i);
  assert.match(repair, /one authoritative definition/i);
  assert.match(repair, /precise types/i);
  assert.match(repair, /searchable literal phrases/i);
  assert.match(repair, /orchestration thin/i);
  assert.match(repair, /Do not commit, push, merge/i);
});

test("BEN Skill Trust records procedure provenance without granting capabilities", async () => {
  const trust = JSON.parse(await read("config/agent-skill-trust.json"));
  const record = trust.records.find((entry) => entry.uri === "skill://plotpickle/ben-code-quality");
  assert.ok(record);
  assert.equal(record.evalStatus, "covered");
  assert.equal(record.lastEvaluatedRevision, "issue-1005");
  assert.ok(record.requestedCapabilityClasses.includes("code-quality-evidence"));
  assert.ok(trust.universalForbiddenCapabilityClasses.includes("github-write-by-product-agent"));
  assert.match(trust.authority.skillMeaning, /never grants tools, credentials, network access, developer authority or PPF mutation authority/i);
});

test("BEN pins slop-scan and fails CI only on added or worsened delta findings", async () => {
  const policy = JSON.parse(await read("config/ben-code-quality.json"));
  assert.equal(policy.agentProfileId, "ben");
  assert.equal(policy.skillUri, "skill://plotpickle/ben-code-quality");
  assert.equal(policy.discoverableCodeSource.repository, "modem-dev/skills");
  assert.equal(policy.discoverableCodeSource.path, "write-discoverable-code/SKILL.md");
  assert.equal(policy.discoverableCodeSource.license, "MIT");
  assert.equal(policy.slopScan.package, "slop-scan");
  assert.equal(policy.slopScan.version, "0.3.0");
  assert.equal(policy.slopScan.sourceRepository, "modem-dev/slop-scan");
  assert.equal(policy.slopScan.comparisonMode, "delta");
  assert.deepEqual(policy.slopScan.failOn, ["added", "worsened"]);
  assert.match(policy.authority.meaning, /does not write code/i);
  assert.match(policy.authority.meaning, /merge pull requests/i);
});

test("BEN runner is pinned, rename-aware, produces machine-readable evidence, and cannot become merge authority", async () => {
  const source = await read("scripts/run-ben-code-quality.mjs");
  assert.match(source, /policy\.slopScan\.package/);
  assert.match(source, /policy\.slopScan\.version/);
  assert.match(source, /"--yes"/);
  assert.match(source, /"scan"/);
  assert.match(source, /"delta"/);
  assert.match(source, /"--base"/);
  assert.match(source, /"--head"/);
  assert.match(source, /"--fail-on"/);
  assert.match(source, /"worktree", "add", "--detach"/);
  assert.match(source, /"diff", "--name-status", "-M"/);
  assert.match(source, /renamePreservesExistingFinding/);
  assert.match(source, /candidate\?\.status === "resolved"/);
  assert.match(source, /findingGroupFingerprint\(candidate, "base"\) === groupFingerprint/);
  assert.match(source, /ben-result\.json/);
  assert.match(source, /authoritative: false/);
  assert.doesNotMatch(source, /merge_pull_request|create_pull_request|update_ref|ppf-direct-write|credential-read/);

  const check = spawnSync(process.execPath, ["--check", "scripts/run-ben-code-quality.mjs"], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(check.status, 0, check.stderr || check.stdout);
});
