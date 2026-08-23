import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const ROOT = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, ROOT), "utf8");

test("#1333 BUZZ sync launcher resolves its Node implementations from repository scripts", async () => {
  const powershell = await read("Utilities/Sync-PlotPickle-BUZZ.ps1");

  assert.match(powershell, /\$ProjectRoot = Split-Path -Parent \$ScriptRoot/u);
  assert.match(powershell, /\$BootstrapScript = Join-Path \$ProjectRoot "scripts\\bootstrap-buzz-guildhall\.mjs"/u);
  assert.match(powershell, /\$AgentScript = Join-Path \$ProjectRoot "scripts\\provision-community-agents\.mjs"/u);
  assert.doesNotMatch(powershell, /Join-Path \$ScriptRoot "(?:bootstrap-buzz-guildhall|provision-community-agents)\.mjs"/u);

  await Promise.all([
    access(new URL("scripts/bootstrap-buzz-guildhall.mjs", ROOT)),
    access(new URL("scripts/provision-community-agents.mjs", ROOT)),
  ]);
});

test("#1333 BUZZ sync keeps credential and guarded-write protections unchanged", async () => {
  const powershell = await read("Utilities/Sync-PlotPickle-BUZZ.ps1");

  assert.match(powershell, /Human\/admin BUZZ private key" -AsSecureString/u);
  assert.match(powershell, /Type SET UP to synchronize Community rooms and Agent memberships/u);
  assert.match(powershell, /SetEnvironmentVariable\(\$name, \$null, "Process"\)/u);
  assert.doesNotMatch(powershell, /--(?:private-key|secret|token|auth-tag)/iu);
});