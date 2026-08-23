import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import test from "node:test";

const ROOT = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("#1331 registers one bounded engineering discipline skill for coding workers", async () => {
  const registry = JSON.parse(await read("config/agent-skills.json"));
  const skill = registry.skills.find((entry) => entry.id === "engineering-discipline");

  assert.ok(skill);
  assert.equal(skill.uri, "skill://plotpickle/engineering-discipline");
  assert.equal(skill.primaryWorker, "developer-worker");
  assert.deepEqual(skill.consumers, ["pi", "developer-worker"]);
  assert.equal(skill.localOnly, true);
  assert.equal(skill.mcpReady, true);
});

test("#1331 adapts the reviewed Karpathy-inspired themes without importing a parallel framework", async () => {
  const source = await read(".agents/skills/engineering-discipline/SKILL.md");

  for (const expected of [
    /Resolve material uncertainty before editing/i,
    /Choose the smallest sufficient solution/i,
    /Keep every changed line task-scoped/i,
    /Define proof before relying on implementation/i,
    /Loop on evidence, not on scope expansion/i,
  ]) assert.match(source, expected);

  assert.match(source, /multica-ai\/andrej-karpathy-skills/i);
  assert.match(source, /2c606141936f1eeef17fa3043a72095b4765b9c2/i);
  assert.match(source, /MIT license/i);
  assert.match(source, /skill:\/\/plotpickle\/ben-code-quality/i);
  assert.match(source, /does not grant repository, shell, GitHub, credential, provider, network, or PPF authority/i);
});

test("#1331 makes UAT repair consume scope discipline alongside BEN discoverability", async () => {
  const repair = await read(".agents/skills/uat-repair/SKILL.md");

  assert.match(repair, /skill:\/\/plotpickle\/engineering-discipline/);
  assert.match(repair, /resolve material assumptions from repository evidence/i);
  assert.match(repair, /observable success criteria/i);
  assert.match(repair, /smallest sufficient task-scoped change/i);
  assert.match(repair, /skill:\/\/plotpickle\/ben-code-quality/);
});

test("#1331 trust record remains procedural and cannot grant authority", async () => {
  const trust = JSON.parse(await read("config/agent-skill-trust.json"));
  const record = trust.records.find((entry) => entry.uri === "skill://plotpickle/engineering-discipline");

  assert.ok(record);
  assert.equal(record.evalStatus, "covered");
  assert.equal(record.lastEvaluatedRevision, "issue-1331");
  assert.ok(record.requestedCapabilityClasses.includes("engineering-procedure"));
  assert.match(trust.authority.skillMeaning, /never grants tools, credentials, network access, developer authority or PPF mutation authority/i);
  for (const forbidden of trust.universalForbiddenCapabilityClasses) {
    assert.equal(record.requestedCapabilityClasses.includes(forbidden), false, `skill cannot request ${forbidden}`);
  }
});

test("#1331 remains discoverable through the existing Agent Skill self-test", () => {
  const result = spawnSync(process.execPath, ["scripts/agent-skills.mjs", "--self-test"], {
    cwd: ROOT,
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr || result.stdout);
  assert.match(result.stdout, /PlotPickle agent skills self-test PASS:/u);
});