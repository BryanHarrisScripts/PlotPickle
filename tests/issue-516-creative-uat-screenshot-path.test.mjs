import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("Creative Writer Playwright MCP uses local UAT data as its working directory", async () => {
  const config = JSON.parse(await source("tools/agent-plugins/plotpickle-workflow-tester/mcp.json"));
  const server = config.mcpServers.playwright;
  assert.equal(server.cwd, "${PLUGIN_DATA}");
  const outputIndex = server.args.indexOf("--output-dir");
  assert.ok(outputIndex >= 0, "Playwright MCP must declare an output directory");
  assert.equal(server.args[outputIndex + 1], "${PLUGIN_DATA}/creative-writer");
});

test("Creative Writer screenshot names stay relative to the local MCP work directory", async () => {
  const browser = await source("scripts/creative-uat/browser-actions.mjs");
  assert.match(browser, /filename: `creative-writer\/\$\{name\}\.png`/);
  assert.doesNotMatch(browser, /PLUGIN_ROOT|repoRoot/);
});

test("Creative Writer runner creates plugin data before spawning Playwright MCP", async () => {
  const runner = await source("scripts/run-creative-writer-uat.mjs");
  const mkdirIndex = runner.indexOf("await mkdir(pluginData, { recursive: true })");
  const clientIndex = runner.indexOf("const client = new McpClient");
  assert.ok(mkdirIndex >= 0 && clientIndex > mkdirIndex, "plugin data must exist before the MCP process uses it as cwd");
  assert.match(runner, /never edits repository files/);
});
