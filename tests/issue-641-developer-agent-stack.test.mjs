import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

const PINNED_PI_PACKAGES = [
  "npm:@dietrichgebert/ponytail@4.8.4",
  "npm:pi-subagents@0.35.1",
  "npm:@ff-labs/pi-fff@0.10.1",
  "npm:pi-mcp-adapter@2.26.0",
  "npm:pi-context-view@0.4.2",
];

function collectKeys(value, output = []) {
  if (Array.isArray(value)) {
    for (const entry of value) collectKeys(entry, output);
    return output;
  }
  if (!value || typeof value !== "object") return output;
  for (const [key, entry] of Object.entries(value)) {
    output.push(key);
    collectKeys(entry, output);
  }
  return output;
}

test("AGENTS.md is the Windows-native shared constitution for Pi and Cline", async () => {
  const agents = await read("AGENTS.md");

  assert.match(agents, /Windows-native first/i);
  assert.match(agents, /supported developer-agent candidates are Pi and Cline/i);
  assert.match(agents, /Do not add OpenHands or Herdr to the required stack/i);
  assert.match(agents, /Mastra remains the application-agent runtime/i);
  assert.match(agents, /Never develop directly on `main`/i);
  assert.match(agents, /Merge only the exact tested head after required checks are green/i);
  assert.match(agents, /Startup, Settings, Foundations\/LEARN, PLAN, and Wyrmwood/i);
  assert.match(agents, /smallest safe change/i);
});

test("the canonical developer stack contains only Pi and Cline as required coding agents", async () => {
  const stack = await readJson("config/developer-agent-stack.json");

  assert.equal(stack.schemaVersion, 1);
  assert.equal(stack.platform, "windows-native");
  assert.equal(stack.sharedRules, "AGENTS.md");
  assert.deepEqual(stack.requiredAgents.map((agent) => agent.id), ["pi", "cline"]);
  assert.deepEqual(stack.excludedRequiredTools, ["OpenHands", "Herdr"]);
  assert.deepEqual(stack.piPackages, PINNED_PI_PACKAGES);
  assert.equal(stack.mcp.sharedConfig, ".mcp.json");
  assert.equal(stack.mcp.clineConfig, ".cline/mcp.json");
  assert.equal(stack.mcp.args[0], "scripts/developer-agent-mcp.mjs");
  assert.deepEqual(stack.agentBench.agents, ["pi", "cline"]);
  assert.equal(stack.mergePolicy, "green-exact-head-only");
});

test("Pi extensions are pinned while model, provider and credentials stay outside project settings", async () => {
  const settings = await readJson(".pi/settings.json");

  assert.equal(settings.enableInstallTelemetry, false);
  assert.deepEqual(settings.packages, PINNED_PI_PACKAGES);
  const forbiddenKeys = new Set(["apiKey", "apikey", "password", "provider", "model", "modelId", "baseUrl", "authorization"]);
  const committedForbiddenKeys = collectKeys(settings).filter((key) => forbiddenKeys.has(key));
  assert.deepEqual(committedForbiddenKeys, []);
});

test("Pi and Cline share the same narrow PlotPickle MCP boundary", async () => {
  const [shared, cline, clineRule, source] = await Promise.all([
    readJson(".mcp.json"),
    readJson(".cline/mcp.json"),
    read(".cline/rules/00-plotpickle.md"),
    read("scripts/developer-agent-mcp.mjs"),
  ]);

  assert.deepEqual(shared, cline);
  assert.deepEqual(shared.mcpServers["plotpickle-dev"], {
    command: "node",
    args: ["scripts/developer-agent-mcp.mjs"],
    cwd: ".",
  });
  assert.match(clineRule, /AGENTS\.md.*canonical PlotPickle development contract/is);
  for (const tool of [
    "plotpickle_status",
    "plotpickle_uat_findings",
    "plotpickle_focused_uat",
    "plotpickle_build",
    "plotpickle_validate",
  ]) {
    assert.match(source, new RegExp(tool));
  }
  assert.match(source, /run-uat-autopilot\.mjs/);
  assert.match(source, /npm.*run.*build/s);
  assert.match(source, /--self-test/);
  assert.doesNotMatch(source, /api\.openai\.com|anthropic\.com|OPENAI_API_KEY|ANTHROPIC_API_KEY|merge_pull_request/i);
});

test("the Windows setup installs only the two chosen agents and the pinned Pi packages", async () => {
  const setup = await read("scripts/setup-developer-agent-stack.ps1");

  assert.match(setup, /npm install -g cline/);
  assert.match(setup, /npm install -g --ignore-scripts @earendil-works\/pi-coding-agent/);
  assert.match(setup, /pi install \$package -l/);
  for (const packageName of PINNED_PI_PACKAGES) assert.match(setup, new RegExp(packageName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.match(setup, /Node\.js 22\.19\.0 or newer/);
  assert.match(setup, /Git Bash|compatible Bash/i);
  assert.match(setup, /\[switch\]\$VerifyOnly/);
  assert.match(setup, /if \(-not \$VerifyOnly\)/);
  assert.match(setup, /developer-agent-mcp\.mjs --self-test/);
  assert.doesNotMatch(setup, /(?:npm|pip|winget|choco).*install.*(?:openhands|herdr)/i);
});

test("Agent Bench compares Pi and Cline on frozen PlotPickle repairs in isolated worktrees", async () => {
  const [catalog, runner] = await Promise.all([
    readJson("config/agent-bench/tasks.json"),
    read("scripts/run-agent-bench.mjs"),
  ]);

  assert.equal(catalog.schemaVersion, 1);
  assert.ok(catalog.tasks.length >= 2);
  assert.equal(new Set(catalog.tasks.map((task) => task.id)).size, catalog.tasks.length);
  for (const task of catalog.tasks) {
    assert.match(task.baseSha, /^[0-9a-f]{40}$/);
    assert.ok(task.prompt.length > 200);
    assert.ok(task.verify.includes("npm run build"));
    assert.ok(task.verify.some((command) => command.includes("run-uat-autopilot.mjs")));
  }

  assert.match(runner, /SUPPORTED_AGENTS = new Set\(\["pi", "cline"\]\)/);
  assert.match(runner, /git.*worktree|"worktree", "add", "--detach"/s);
  assert.match(runner, /current AGENTS\.md/is);
  assert.match(runner, /"--mode", "json", "-p", "--no-session"/);
  assert.match(runner, /"--json", "--auto-approve", "true", "--cwd"/);
  assert.match(runner, /testFilesChanged/);
  assert.match(runner, /"diff", "--check"/);
  assert.doesNotMatch(runner, /OpenHands|Herdr/);
});

test("developer MCP and benchmark catalog have executable CI-safe self checks", () => {
  const mcp = spawnSync(process.execPath, ["scripts/developer-agent-mcp.mjs", "--self-test"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  assert.equal(mcp.status, 0, mcp.stderr || mcp.stdout);
  assert.match(mcp.stdout, /MCP self-test PASS/);

  const bench = spawnSync(process.execPath, ["scripts/run-agent-bench.mjs", "--list"], {
    cwd: new URL("..", import.meta.url),
    encoding: "utf8",
  });
  assert.equal(bench.status, 0, bench.stderr || bench.stdout);
  assert.match(bench.stdout, /Agents: pi, cline/);
  assert.match(bench.stdout, /sage-help-followup-637/);
});

test("focused Startup UAT owns the developer-agent stack regression", async () => {
  const registry = await readJson("config/uat-autopilot-registry.json");
  const startup = registry.areas.find((area) => area.id === "startup");
  assert.ok(startup);
  assert.ok(startup.tests.includes("tests/issue-641-developer-agent-stack.test.mjs"));
});
