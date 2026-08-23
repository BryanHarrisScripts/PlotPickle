import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1288 Windows launcher provides a deliberate one-time BUZZ setup path", async () => {
  const [launcher, setup, docs] = await Promise.all([
    read("Sync-PlotPickle-BUZZ.cmd"),
    read("scripts/setup-buzz-community.ps1"),
    read("docs/buzz-community-one-time-setup.md"),
  ]);

  assert.match(launcher, /setup-buzz-community\.ps1/i);
  assert.match(setup, /Type SET UP/);
  assert.match(setup, /bootstrap-buzz-guildhall\.mjs/);
  assert.match(setup, /provision-community-agents\.mjs/);
  assert.match(setup, /--apply/);
  assert.match(setup, /\[switch\]\$PlanOnly/);
  assert.match(docs, /creates only missing/i);
  assert.match(docs, /Agents → Import Team/i);
});

test("#1288 setup prompts only for the Human admin credential and never places it on command lines", async () => {
  const setup = await read("scripts/setup-buzz-community.ps1");

  assert.match(setup, /Human\/admin BUZZ private key" -AsSecureString/);
  assert.doesNotMatch(setup, /owner\/provisioner credential/i);
  assert.doesNotMatch(setup, /Read-Host "BUZZ_AUTH_TAG"/i);
  assert.match(setup, /ZeroFreeBSTR/);
  assert.match(setup, /SetEnvironmentVariable\(\$name, \$null, "Process"\)/);
  assert.doesNotMatch(setup, /--(?:private-key|secret|token|auth-tag)/i);
  assert.doesNotMatch(setup, /Write-(?:Host|Output)[^\n]*(?:humanKey|provisionerKey|authTag)/i);
});

test("#1288 setup preserves Human and Agent signer separation", async () => {
  const [setup, provisioner] = await Promise.all([
    read("scripts/setup-buzz-community.ps1"),
    read("scripts/provision-community-agents.mjs"),
  ]);

  assert.match(setup, /BUZZ_PRIVATE_KEY = \$humanKey/);
  assert.match(setup, /PLOTPICKLE_BUZZ_PROVISIONER_PRIVATE_KEY = ""/);
  assert.match(provisioner, /"channels", "add-member"[\s\S]*"--role", "bot"/);
  assert.match(provisioner, /Never sign or speak as the connected Human/);
  assert.match(provisioner, /awaiting-owner-approval/);
});

test("#1288 sync accepts BUZZ single-user discovery and prepares one credential-free team import", async () => {
  const [setup, provisioner, docs] = await Promise.all([
    read("scripts/setup-buzz-community.ps1"),
    read("scripts/provision-community-agents.mjs"),
    read("docs/buzz-community-one-time-setup.md"),
  ]);

  assert.match(provisioner, /return \[value\]/);
  assert.match(provisioner, /buzz-team-snapshot/);
  assert.match(provisioner, /buzz-agent-snapshot/);
  assert.match(provisioner, /avatarDataUrl/);
  assert.match(provisioner, /image\/webp/);
  assert.match(provisioner, /respondTo: "owner-only"/);
  assert.match(provisioner, /memory: \{ level: "none", entries: \[\] \}/);
  assert.match(setup, /Import Team/);
  assert.match(docs, /contains no credentials, memory or Human profile data/i);
});

test("#1288 generated BUZZ team import carries all public profiles and no identity secrets", async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "plotpickle-buzz-team-"));
  const outputPath = path.join(directory, "PlotPickle-BUZZ-Missing-Agents.team.json");
  const run = spawnSync(process.execPath, ["scripts/provision-community-agents.mjs", "--prepare-team"], {
    cwd: process.cwd(),
    env: { ...process.env, PLOTPICKLE_BUZZ_SYNC_PACKAGE_PATH: outputPath },
    encoding: "utf8",
  });
  assert.equal(run.status, 0, run.stderr);
  const manifest = JSON.parse(await readFile(outputPath, "utf8"));
  assert.equal(manifest.format, "buzz-team-snapshot");
  assert.equal(manifest.version, 1);
  assert.equal(manifest.members.length, 12);
  assert.equal(new Set(manifest.members.map((member) => member.profile.displayName)).size, 12);
  for (const member of manifest.members) {
    assert.equal(member.format, "buzz-agent-snapshot");
    assert.equal(member.memory.level, "none");
    assert.deepEqual(member.memory.entries, []);
    assert.match(member.profile.avatarDataUrl, /^data:image\/webp;base64,UklGR/u);
    assert.ok(member.profile.about?.length > 20);
    assert.match(member.definition.systemPrompt, /Never sign or speak as the connected Human/u);
  }
  const serialized = JSON.stringify(manifest);
  assert.doesNotMatch(serialized, /BUZZ_PRIVATE_KEY|BUZZ_AUTH_TAG|privateKeyNsec|nsec1/iu);
});
