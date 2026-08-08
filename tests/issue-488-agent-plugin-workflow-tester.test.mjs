import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const pluginRoot = new URL("tools/agent-plugins/plotpickle-workflow-tester/", root);
const readText = (path) => readFile(new URL(path, pluginRoot), "utf8");
const readJson = async (path) => JSON.parse(await readText(path));

test("#488 Agent Plugins manifest targets the v1 portable schema", async () => {
  const manifest = await readJson("plugin.json");
  assert.equal(manifest.$schema, "https://agent-plugins.org/schemas/1.0.0/plugin.schema.json");
  assert.equal(manifest.name, "plotpickle-workflow-tester");
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(manifest.license, "AGPL-3.0-or-later");
  assert.ok(!("mcpServers" in manifest), "portable MCP configuration belongs in mcp.json, not plugin.json");
});

test("#488 Playwright MCP is pinned, isolated and restricted to local PlotPickle origins", async () => {
  const config = await readJson("mcp.json");
  assert.equal(config.$schema, "https://agent-plugins.org/schemas/1.0.0/mcp.schema.json");
  const server = config.mcpServers.playwright;
  assert.equal(server.type, "stdio");
  assert.equal(server.command, "npx");
  assert.ok(server.args.includes("@playwright/mcp@0.0.78"), "pin the reviewed Playwright MCP version");
  assert.ok(server.args.includes("--headless"));
  assert.ok(server.args.includes("--isolated"));
  const originsIndex = server.args.indexOf("--allowed-origins");
  assert.ok(originsIndex >= 0);
  assert.equal(server.args[originsIndex + 1], "http://127.0.0.1:*;http://localhost:*");
  assert.ok(server.args.includes("${PLUGIN_DATA}/artifacts"));
  assert.equal(server.cwd, "${PLUGIN_ROOT}");
});

test("#488 skill requires visible UI interaction and disposable project safety", async () => {
  const skill = await readText("skills/plotpickle-human-acceptance/SKILL.md");
  assert.match(skill, /visible rendered controls only/i);
  assert.match(skill, /disposable acceptance project/i);
  assert.match(skill, /Dashboard.*Learn.*Plan.*Storyboard.*Write.*Edit.*Graphic Novel.*Build.*Feedback.*Refine.*Reports\/Export/s);
  assert.match(skill, /Do not approve cloud spend/i);
  assert.match(skill, /PASS, WARN and FAIL/i);
  assert.match(skill, /current Project, Act, Block, Scene and Mini-Block/i);
});

test("#488 checklist covers persistence, local AI recovery and every canonical handoff", async () => {
  const checklist = await readText("skills/plotpickle-human-acceptance/references/workflow-checklist.md");
  for (const heading of ["Dashboard", "Learn", "Plan", "Storyboard", "Write", "Edit", "Graphic Novel", "Build", "Feedback", "Refine", "Reports / Export"]) {
    assert.match(checklist, new RegExp(`## ${heading.replaceAll("/", "\\/")}`));
  }
  assert.match(checklist, /Refresh once and verify/i);
  assert.match(checklist, /Ollama missing/i);
  assert.match(checklist, /ComfyUI missing/i);
  assert.match(checklist, /red\/yellow\/green status/i);
  assert.match(checklist, /No credentials appearing/i);
});

test("#488 visual contract preserves the reviewed PlotPickle family", async () => {
  const contract = await readText("skills/plotpickle-human-acceptance/references/visual-continuity-contract.md");
  assert.match(contract, /Matte-black \/ charcoal/i);
  assert.match(contract, /warm-gold/i);
  assert.match(contract, /Settings and integrations remain global utilities/i);
  assert.match(contract, /No module should introduce unrelated purple\/blue product chrome/i);
});
