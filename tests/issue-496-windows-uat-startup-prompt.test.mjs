import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const startup = await readFile(new URL("../Start-PlotPickle.bat", import.meta.url), "utf8");
const runner = await readFile(new URL("../scripts/run-local-uat.ps1", import.meta.url), "utf8");

test("Windows startup exposes an explicit temporary Y/N UAT prompt", () => {
  assert.match(startup, /USER ACCEPTANCE TESTING - TEMPORARY TEST CONTROL/);
  assert.match(startup, /Run the human-like UAT agent after PlotPickle starts\? \[Y\/N\]/);
  assert.match(startup, /set "RUN_UAT=0"/);
  assert.match(startup, /if not errorlevel 2 set "RUN_UAT=1"/);
});

test("normal startup remains the default when UAT is declined", () => {
  assert.match(startup, /if "!RUN_UAT!"=="1" start "PlotPickle UAT Agent"/);
  assert.match(startup, /call "%VITE_CMD%" --host 127\.0\.0\.1 --port %PLOTPICKLE_PORT% --strictPort/);
});

test("local UAT runner waits for PlotPickle and invokes the existing agent package", () => {
  assert.match(runner, /Invoke-WebRequest -UseBasicParsing -Uri \$BaseUrl/);
  assert.match(runner, /prepare-agent-plugin-runner\.mjs/);
  assert.match(runner, /Playwright MCP browser server/);
  assert.match(runner, /@openai\/codex/);
  assert.match(runner, /acceptance-report\.md/);
});

test("local UAT remains read-only and bounded to smoke/full acceptance scopes", () => {
  assert.match(runner, /ValidateSet\("smoke", "full"\)/);
  assert.match(runner, /--sandbox", "read-only"/);
  assert.match(runner, /do not spend money/i);
  assert.match(runner, /do not perform external writes/i);
});

test("local UAT stores Codex work outside the Vite repository tree and keeps failures visible", () => {
  assert.match(runner, /\$env:LOCALAPPDATA/);
  assert.match(runner, /PlotPickle\\uat/);
  assert.doesNotMatch(runner, /\$repoRoot "\.artifacts\\local-uat"/);
  assert.match(runner, /Status: RUNNING - Codex UAT agent started/);
  assert.match(runner, /Codex UAT agent exited with code/);
  assert.match(runner, /Read-Host "Press Enter to close the UAT window"/);
});

test("local UAT prefers the user's existing Codex ChatGPT login", () => {
  assert.match(runner, /login", "status/);
  assert.match(runner, /Logged in using ChatGPT/);
  assert.match(runner, /Copy-Item -Force \$normalAuthPath \$tempAuthPath/);
  assert.match(runner, /Remove-Item Env:OPENAI_API_KEY/);
  assert.match(runner, /Authentication: ChatGPT login detected/);
});

test("local UAT refuses implicit API-key billing and cleans temporary credentials", () => {
  assert.match(runner, /PLOTPICKLE_UAT_ALLOW_API_KEY/);
  assert.match(runner, /will not use billable API-key auth by default/);
  assert.match(runner, /Clear-UatAuth/);
  assert.match(runner, /Remove-Item -Force \$script:tempAuthPath/);
});

test("local UAT does not treat normal Codex stderr as a terminating Windows PowerShell failure", () => {
  assert.match(runner, /function Invoke-NativeCapture/);
  assert.match(runner, /\$ErrorActionPreference = "Continue"/);
  assert.match(runner, /ForEach-Object \{ \$_\.ToString\(\) \}/);
  assert.match(runner, /\$authResult = Invoke-NativeCapture/);
  assert.match(runner, /\$authExitCode = \$authResult\.ExitCode/);
  assert.match(runner, /Tee-Object -FilePath \$tracePath/);
  assert.match(runner, /\$exitCode = \$LASTEXITCODE/);
});
