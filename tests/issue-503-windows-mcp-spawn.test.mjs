import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { readFile } from "node:fs/promises";
import test from "node:test";

const launcherUrl = new URL("../scripts/run-npx-stdio.mjs", import.meta.url);
const launcher = await readFile(launcherUrl, "utf8");
const pluginConfig = JSON.parse(await readFile(new URL("../tools/agent-plugins/plotpickle-workflow-tester/mcp.json", import.meta.url), "utf8"));

test("portable npx stdio launcher parses as valid JavaScript", () => {
  const check = spawnSync(process.execPath, ["--check", fileURLToPath(launcherUrl)], { encoding: "utf8" });
  assert.equal(check.status, 0, check.stderr || check.stdout);
});

test("Agent Plugin routes Playwright MCP through the portable Node launcher", () => {
  const server = pluginConfig.mcpServers.playwright;
  assert.equal(server.command, "node");
  assert.equal(server.args[0], "${PLUGIN_ROOT}/../../../scripts/run-npx-stdio.mjs");
  assert.ok(server.args.includes("@playwright/mcp@0.0.78"));
});

test("Windows .cmd execution goes through ComSpec instead of direct spawn", () => {
  assert.match(launcher, /process\.env\.ComSpec \|\| process\.env\.COMSPEC \|\| "cmd\.exe"/);
  assert.match(launcher, /\["\/d", "\/c", "npx\.cmd", \.\.\.npxArgs\]/);
  assert.match(launcher, /stdio: "inherit"/);
  assert.doesNotMatch(launcher, /spawn\("npx\.cmd"/);
});

test("non-Windows hosts continue to execute npx directly", () => {
  assert.match(launcher, /: "npx";/);
  assert.match(launcher, /: npxArgs;/);
});
