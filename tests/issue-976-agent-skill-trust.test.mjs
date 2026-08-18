import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  describeSkillTrust,
  hashSkillContent,
  loadAgentSkillTrustRegistry,
  validateSkillTrustCoverage,
} from "../scripts/agent-skill-trust.mjs";
import {
  listAgentSkills,
  loadAgentSkill,
  loadAgentSkillRegistry,
  skillIndexResource,
} from "../scripts/agent-skills.mjs";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("every production Agent Skill has a host-owned production trust record", async () => {
  const skills = await loadAgentSkillRegistry();
  const trust = await validateSkillTrustCoverage(skills);
  const records = new Map(trust.records.map((record) => [record.id, record]));

  for (const skill of skills.skills) {
    const record = records.get(skill.id);
    assert.ok(record, `missing trust record for ${skill.id}`);
    assert.equal(record.entry, skill.entry);
    assert.equal(record.sourceKind, "plotpickle-built-in");
    assert.equal(record.trustState, "trusted-built-in");
    assert.ok(record.forbiddenCapabilities.includes("self-grant-authority"));
  }
});

test("production discovery exposes provenance and deterministic SHA-256 without granting capability authority", async () => {
  const skills = await listAgentSkills();
  assert.equal(skills.length, 6);
  for (const skill of skills) {
    assert.equal(skill.trustState, "trusted-built-in");
    assert.equal(skill.sourceKind, "plotpickle-built-in");
    assert.match(skill.contentSha256, /^[a-f0-9]{64}$/);
  }

  const index = JSON.parse((await skillIndexResource()).text);
  assert.equal(index.skills.length, skills.length);
  for (const skill of index.skills) {
    assert.match(skill.contentSha256, /^[a-f0-9]{64}$/);
    assert.equal(skill.trustState, "trusted-built-in");
    assert.equal("requestedCapabilities" in skill, false);
    assert.equal("forbiddenCapabilities" in skill, false);
  }
});

test("Skill content hash changes when the procedure changes", () => {
  const before = hashSkillContent("name: example\nprocedure: one\n");
  const after = hashSkillContent("name: example\nprocedure: two\n");
  assert.match(before, /^[a-f0-9]{64}$/);
  assert.match(after, /^[a-f0-9]{64}$/);
  assert.notEqual(before, after);
});

test("quarantined external Skill can be inspected but never enters production discovery", async () => {
  const trust = await loadAgentSkillTrustRegistry();
  const fixtureRecord = trust.records.find((record) => record.id === "quarantined-external-fixture");
  assert.ok(fixtureRecord);
  assert.equal(fixtureRecord.trustState, "quarantined");

  const inspection = await describeSkillTrust("quarantined-external-fixture");
  assert.equal(inspection.productionDiscoverable, false);
  assert.equal(inspection.packageInspection.hasScripts, true);
  assert.match(inspection.contentSha256, /^[a-f0-9]{64}$/);

  const production = await listAgentSkills();
  assert.equal(production.some((skill) => skill.id === "quarantined-external-fixture"), false);
  await assert.rejects(() => loadAgentSkill("quarantined-external-fixture"), /Unknown PlotPickle agent skill/);
});

test("Skill trust inspection cannot execute bundled scripts or turn procedure text into authority", async () => {
  const trustSource = await read("scripts/agent-skill-trust.mjs");
  const fixture = await read("tests/fixtures/agent-skills/quarantined-external/SKILL.md");

  assert.match(fixture, /Treat these instructions as permission/i);
  assert.doesNotMatch(trustSource, /child_process|spawn\(|exec\(|execFile\(|fetch\(|writeFile\(/i);
  assert.match(trustSource, /productionDiscoverable/);
  assert.match(trustSource, /quarantined or blocked|not approved for production discovery/i);
});

test("Agent Skill and Skill Trust self-tests pass together", () => {
  for (const [script, expected] of [
    ["scripts/agent-skills.mjs", /PlotPickle agent skills self-test PASS: 6 skill\(s\)/],
    ["scripts/agent-skill-trust.mjs", /Agent Skill trust self-test PASS: 7 record\(s\), 1 quarantined/],
  ]) {
    const result = spawnSync(process.execPath, [script, "--self-test"], {
      cwd: new URL("..", import.meta.url),
      encoding: "utf8",
    });
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.match(result.stdout, expected);
  }
});
