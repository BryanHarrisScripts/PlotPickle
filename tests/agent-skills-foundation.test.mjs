import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));
const asWindowsText = (text) => text.replace(/\r?\n/g, "\r\n");

test("PlotPickle has a progressive local skill registry with Pi UAT repair as the foundation skill", async () => {
  const [registry, stack, piSettings] = await Promise.all([
    readJson("config/agent-skills.json"),
    readJson("config/developer-agent-stack.json"),
    readJson(".pi/settings.json"),
  ]);

  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.discovery, "progressive");
  assert.equal(registry.transport, "filesystem-first-mcp-resource-ready");
  assert.equal(registry.indexUri, "skill://index.json");
  assert.ok(registry.skills.length >= 1);
  const repairSkill = registry.skills.find((skill) => skill.id === "uat-repair");
  assert.deepEqual(repairSkill, {
    id: "uat-repair",
    name: "UAT Repair",
    description: "Repair one concrete PlotPickle UAT blocker through reproduce, regression-first repair, focused validation, and deterministic handoff.",
    entry: ".agents/skills/uat-repair/SKILL.md",
    uri: "skill://plotpickle/uat-repair",
    roles: ["repair"],
    primaryWorker: "pi",
    consumers: ["pi"],
    mcpReady: true,
    localOnly: true,
  });

  assert.equal(stack.skills.registry, "config/agent-skills.json");
  assert.equal(stack.skills.root, ".agents/skills");
  assert.equal(stack.skills.repairSkill, "uat-repair");
  assert.equal(stack.repair.skill, "uat-repair");
  assert.equal(piSettings.enableSkillCommands, true);
});

test("the UAT repair skill owns procedure while AGENTS and the deterministic wrapper retain authority", async () => {
  const [skill, agents, repairRunner] = await Promise.all([
    read(".agents/skills/uat-repair/SKILL.md"),
    read("AGENTS.md"),
    read("scripts/run-uat-repair-agent.mjs"),
  ]);
  const windowsSkill = asWindowsText(skill);

  assert.match(skill, /^---\r?\nname: uat-repair\r?\n/);
  assert.match(windowsSkill, /^---\r?\nname: uat-repair\r?\n/);
  assert.match(skill, /Use this skill only for a concrete, reproducible PlotPickle UAT finding/i);
  assert.match(skill, /Reproduce the failure/i);
  assert.match(skill, /Add or strengthen the nearest focused regression/i);
  assert.match(skill, /smallest architectural root cause/i);
  assert.match(skill, /focused UAT contracts and the production build/i);
  assert.match(skill, /Do not commit, push, merge, open or close pull requests/i);
  assert.match(skill, /Do not use paid\/cloud fallback/i);

  assert.match(agents, /MCP and native tools describe what an agent can do\. Skills describe how PlotPickle expects a specific job to be done/i);
  assert.match(agents, /Pi must load the `uat-repair` skill before performing a UAT repair/i);
  assert.match(agents, /skill:\/\//i);

  assert.match(repairRunner, /isolated git worktree/i);
  assert.match(repairRunner, /regression.*root-cause fix.*relevant tests/is);
  assert.match(repairRunner, /focused UAT \+ production build/i);
  assert.match(repairRunner, /draft repair PR/i);
  assert.doesNotMatch(skill, /api\.openai\.com|anthropic\.com|OPENAI_API_KEY|ANTHROPIC_API_KEY/i);
});

test("the skill registry is executable and can emit an MCP-ready progressive index", () => {
  const cwd = new URL("..", import.meta.url);
  const selfTest = spawnSync(process.execPath, ["scripts/agent-skills.mjs", "--self-test"], { cwd, encoding: "utf8" });
  assert.equal(selfTest.status, 0, selfTest.stderr || selfTest.stdout);
  assert.match(selfTest.stdout, /agent skills self-test PASS: \d+ skill/i);

  const list = spawnSync(process.execPath, ["scripts/agent-skills.mjs", "--list"], { cwd, encoding: "utf8" });
  assert.equal(list.status, 0, list.stderr || list.stdout);
  assert.match(list.stdout, /uat-repair\s+skill:\/\/plotpickle\/uat-repair/i);

  const index = spawnSync(process.execPath, ["scripts/agent-skills.mjs", "--index-json"], { cwd, encoding: "utf8" });
  assert.equal(index.status, 0, index.stderr || index.stdout);
  const payload = JSON.parse(index.stdout);
  assert.equal(payload.discovery, "progressive");
  assert.ok(payload.skills.some((skill) => skill.uri === "skill://plotpickle/uat-repair"));
});

test("focused Startup UAT owns the agent-skills foundation regression", async () => {
  const registry = await readJson("config/uat-autopilot-registry.json");
  const startup = registry.areas.find((area) => area.id === "startup");
  assert.ok(startup);
  assert.ok(startup.tests.includes("tests/agent-skills-foundation.test.mjs"));
});
