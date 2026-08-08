import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import test from "node:test";

const powerShell = await readFile(new URL("../scripts/run-local-uat.ps1", import.meta.url), "utf8");
const localRunnerUrl = new URL("../scripts/run-local-browser-uat.mjs", import.meta.url);
const localRunner = await readFile(localRunnerUrl, "utf8");
const pluginConfig = await readFile(new URL("../tools/agent-plugins/plotpickle-workflow-tester/mcp.json", import.meta.url), "utf8");

test("local browser UAT script parses as valid JavaScript", () => {
  const check = spawnSync(process.execPath, ["--check", fileURLToPath(localRunnerUrl)], { encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr || check.stdout);
});

test("baseline UAT is local-first and Codex is only an explicit alternate engine", () => {
  assert.match(powerShell, /\[string\]\$Engine = "local"/);
  const localBlock = powerShell.indexOf('if ($Engine -eq "local")');
  const codexBlock = powerShell.indexOf('Engine: CODEX - optional exploratory UAT');
  assert.ok(localBlock >= 0);
  assert.ok(codexBlock > localBlock);
  assert.match(powerShell.slice(localBlock, codexBlock), /run-local-browser-uat\.mjs|\$localRunner/);
  assert.doesNotMatch(powerShell.slice(localBlock, codexBlock), /codex login|@openai\/codex/);
});

test("deterministic local engine drives the real rendered app through Playwright MCP", () => {
  for (const tool of ["browser_navigate", "browser_snapshot", "browser_click", "browser_take_screenshot", "browser_console_messages"]) {
    assert.match(localRunner, new RegExp(tool));
  }
  for (const workspace of ["Dashboard", "Plan", "Storyboard", "Write", "Edit", "Graphic Novel", "Build", "Feedback"]) {
    assert.match(localRunner, new RegExp(workspace.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
  assert.match(localRunner, /Overall: \$\{overall\}/);
  assert.match(localRunner, /direct recovery navigation/);
});

test("Agent Plugins remains the portable Playwright boundary", () => {
  assert.match(pluginConfig, /agent-plugins\.org\/schemas\/1\.0\.0\/mcp\.schema\.json/);
  assert.match(pluginConfig, /@playwright\/mcp@0\.0\.78/);
  assert.match(pluginConfig, /--browser[\s\S]*chrome/);
  assert.match(localRunner, /tools["'], ["']agent-plugins["'], ["']plotpickle-workflow-tester/);
  assert.match(localRunner, /mcpServers\?\.playwright/);
});

test("Ollama usability review is optional, local and cannot block deterministic acceptance", () => {
  assert.match(localRunner, /http:\/\/127\.0\.0\.1:11434\/api\/tags/);
  assert.match(localRunner, /http:\/\/127\.0\.0\.1:11434\/api\/chat/);
  assert.match(localRunner, /No suitable installed Ollama instruction model/);
  assert.match(localRunner, /optional and never changes the deterministic verdict/i);
  assert.doesNotMatch(localRunner, /OPENAI_API_KEY|api\.openai\.com/);
});

test("real Playwright evidence is parsed without false console errors", () => {
  assert.match(localRunner, /function extractFirstJsonObject/);
  assert.match(localRunner, /const marker = "### Result"/);
  assert.match(localRunner, /function consoleHasErrors/);
  assert.match(localRunner, /Errors:\\s\*\(\\d\+\)/);
  assert.match(localRunner, /Returning\\s\+0\\s\+messages/);
  assert.match(localRunner, /const routeMatches = stateMatchesScreen\(screen, state\)/);
  assert.doesNotMatch(localRunner, /!state\.activeId \|\| state\.activeId === screen\.id/);
  assert.doesNotMatch(localRunner, /\/error\/i\.test\(consoleText\)/);
});
