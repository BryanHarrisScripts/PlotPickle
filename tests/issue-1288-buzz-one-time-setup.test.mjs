import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1288 Windows launcher provides a deliberate one-time BUZZ setup path", async () => {
  const [launcher, setup, docs] = await Promise.all([
    read("Setup-PlotPickle-BUZZ.cmd"),
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
  assert.match(docs, /Approve those drafts in BUZZ Desktop and rerun/i);
});

test("#1288 setup prompts securely and never places BUZZ credentials on command lines", async () => {
  const setup = await read("scripts/setup-buzz-community.ps1");

  assert.match(setup, /Human\/admin BUZZ private key" -AsSecureString/);
  assert.match(setup, /BUZZ owner\/provisioner private key" -AsSecureString/);
  assert.match(setup, /BUZZ_AUTH_TAG" -AsSecureString/);
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
  assert.match(setup, /PLOTPICKLE_BUZZ_PROVISIONER_PRIVATE_KEY = \$provisionerKey/);
  assert.match(provisioner, /"channels", "add-member"[\s\S]*"--role", "bot"/);
  assert.match(provisioner, /Never sign or speak as the connected Human/);
  assert.match(provisioner, /awaiting-owner-approval/);
});
