import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const startup = await readFile(new URL("../Start-PlotPickle.bat", import.meta.url), "utf8");
const runner = await readFile(new URL("../scripts/run-local-uat.ps1", import.meta.url), "utf8");
const localBrowserRunner = await readFile(new URL("../scripts/run-local-browser-uat.mjs", import.meta.url), "utf8");

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

test("Windows UAT defaults to the local engine and keeps Codex explicit", () => {
  assert.match(runner, /ValidateSet\("local", "codex"\)/);
  assert.match(runner, /\[string\]\$Engine = "local"/);
  assert.match(runner, /if \(\$Engine -eq "local"\)/);
  assert.match(runner, /run-local-browser-uat\.mjs/);
  assert.match(runner, /No ChatGPT\/Codex quota is required/);
  assert.match(runner, /Engine: CODEX - optional exploratory UAT/);
});

test("local UAT waits for PlotPickle and preserves the existing optional Codex agent package", () => {
  assert.match(runner, /Invoke-WebRequest -UseBasicParsing -Uri \$BaseUrl/);
  assert.match(runner, /prepare-agent-plugin-runner\.mjs/);
  assert.match(runner, /Playwright MCP browser server/);
  assert.match(runner, /@openai\/codex/);
  assert.match(runner, /acceptance-report\.md/);
});

test("local UAT remains bounded and Codex exploratory mode remains read-only", () => {
  assert.match(runner, /ValidateSet\("smoke", "full"\)/);
  assert.match(runner, /--sandbox", "read-only"/);
  assert.match(runner, /do not spend money/i);
  assert.match(runner, /do not perform external writes/i);
});

test("local UAT stores work outside the Vite repository tree and keeps failures visible", () => {
  assert.match(runner, /\$env:LOCALAPPDATA/);
  assert.match(runner, /PlotPickle\\uat/);
  assert.doesNotMatch(runner, /\$repoRoot "\.artifacts\\local-uat"/);
  assert.match(runner, /Status: RUNNING - local deterministic UAT started/);
  assert.match(runner, /Local deterministic UAT reported a blocking failure/);
  assert.match(runner, /Status: RUNNING - Codex exploratory UAT agent started/);
  assert.match(runner, /Read-Host "Press Enter to close the UAT window"/);
});

test("local browser UAT uses the Agent Plugin Playwright MCP without cloud AI", () => {
  assert.match(localBrowserRunner, /tools\/agent-plugins\/plotpickle-workflow-tester|tools", "agent-plugins", "plotpickle-workflow-tester/);
  assert.match(localBrowserRunner, /mcp\.json/);
  assert.match(localBrowserRunner, /browser_navigate/);
  assert.match(localBrowserRunner, /browser_snapshot/);
  assert.match(localBrowserRunner, /browser_take_screenshot/);
  assert.match(localBrowserRunner, /Cloud AI required: no/);
  assert.match(localBrowserRunner, /Codex required: no/);
  assert.doesNotMatch(localBrowserRunner, /api\.openai\.com/);
});

test("local browser UAT can optionally review deterministic evidence with Ollama", () => {
  assert.match(localBrowserRunner, /127\.0\.0\.1:11434\/api\/tags/);
  assert.match(localBrowserRunner, /127\.0\.0\.1:11434\/api\/chat/);
  assert.match(localBrowserRunner, /PLOTPICKLE_UAT_OLLAMA_MODEL/);
  assert.match(localBrowserRunner, /Ollama review is optional|Optional local AI review/);
  assert.match(localBrowserRunner, /never changes the deterministic verdict/i);
});

test("optional Codex mode prefers the user's existing ChatGPT login", () => {
  assert.match(runner, /login", "status/);
  assert.match(runner, /Logged in using ChatGPT/);
  assert.match(runner, /Copy-Item -Force \$normalAuthPath \$tempAuthPath/);
  assert.match(runner, /Remove-Item Env:OPENAI_API_KEY/);
  assert.match(runner, /Authentication: ChatGPT login detected/);
});

test("optional Codex mode refuses implicit API-key billing and cleans temporary credentials", () => {
  assert.match(runner, /PLOTPICKLE_UAT_ALLOW_API_KEY/);
  assert.match(runner, /will not use billable API-key auth by default/);
  assert.match(runner, /Clear-UatAuth/);
  assert.match(runner, /Remove-Item -Force \$script:tempAuthPath/);
});

test("optional Codex mode does not treat normal stderr as a terminating Windows PowerShell failure", () => {
  assert.match(runner, /function Invoke-NativeCapture/);
  assert.match(runner, /\$ErrorActionPreference = "Continue"/);
  assert.match(runner, /ForEach-Object \{ \$_\.ToString\(\) \}/);
  assert.match(runner, /\$authResult = Invoke-NativeCapture/);
  assert.match(runner, /\$authExitCode = \$authResult\.ExitCode/);
  assert.match(runner, /Tee-Object -FilePath \$tracePath/);
  assert.match(runner, /\$exitCode = \$LASTEXITCODE/);
});
