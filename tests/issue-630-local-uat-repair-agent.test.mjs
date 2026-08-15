import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("UAT repair retains the real Mastra coding agent as an optional isolated legacy worker", async () => {
  const source = await read("scripts/run-uat-repair-agent.mjs");

  assert.match(source, /Agent\s*}\s*from\s*"@mastra\/core\/agent"/);
  assert.match(source, /LocalFilesystem, LocalSandbox, Workspace/);
  assert.match(source, /id:\s*"uat-repair-agent"/);
  assert.match(source, /new LocalFilesystem\(\{[\s\S]*basePath:\s*worktreeRoot/);
  assert.match(source, /new LocalSandbox\(\{[\s\S]*workingDirectory:\s*worktreeRoot/);
  assert.match(source, /git", \["worktree", "add", "-b", branch, worktreeRoot, "origin\/main"\]/);
  assert.match(source, /isolated git worktree/i);
  assert.match(source, /"mastra-qwen"/);
});

test("Qwen3.8-27B remains dedicated to legacy repair work and can be discovered through LM Studio", async () => {
  const source = await read("scripts/run-uat-repair-agent.mjs");

  assert.match(source, /label:\s*"Qwen3\.8-27B"/);
  assert.match(source, /qwen3\.8-27b/);
  assert.match(source, /LM Studio/);
  assert.match(source, /127\.0\.0\.1:1234\/v1/);
  assert.match(source, /PlotPickle will not silently downgrade UAT repair work to the Fast or Quality story models/);
  assert.doesNotMatch(source, /Qwen3\.5-4B/);
  assert.doesNotMatch(source, /Qwen3\.5-9B/);
});

test("repair agent must reproduce, add a regression, fix root cause, and test rather than only write a diagnosis", async () => {
  const source = await read("scripts/run-uat-repair-agent.mjs");

  assert.match(source, /First inspect the finding and reproduce the failure/);
  assert.match(source, /Before changing product behavior, add or strengthen a focused regression/);
  assert.match(source, /smallest architectural root cause/);
  assert.match(source, /Do not merely describe a fix/);
  assert.match(source, /maxSteps:\s*48/);
});

test("deterministic wrapper validates repairs before a draft PR and never lets any worker merge itself", async () => {
  const source = await read("scripts/run-uat-repair-agent.mjs");

  assert.match(source, /git", \["diff", "--check"\]/);
  assert.match(source, /scripts\/run-uat-autopilot\.mjs/);
  assert.match(source, /"--contracts-only"/);
  assert.match(source, /"run", "build"/);
  assert.match(source, /"pr", "create"/);
  assert.match(source, /"--draft"/);
  assert.match(source, /GitHub CI remains the merge gate/);
  assert.doesNotMatch(source, /gh\("pr", "merge"/);
});

test("closed-loop UAT preflights the developer repair worker and uses Pi by default", async () => {
  const source = await read("scripts/run-uat-closed-loop.mjs");
  const startup = await read("build/uat-discovery-plugin.ts");

  assert.match(source, /const repair = args\.includes\("--repair"\)/);
  assert.match(source, /repairWorker = argument\("--repair-worker", process\.env\.PLOTPICKLE_REPAIR_WORKER \|\| "pi"\)/);
  assert.match(source, /scripts\/run-uat-repair-agent\.mjs/);
  assert.match(source, /"--preflight", "--require-ready"/);
  assert.match(source, /"--fingerprint", finding\.fingerprint/);
  assert.match(startup, /run-uat-closed-loop\.mjs --github-report --repair/);
  assert.match(startup, /Developer repair worker/);
  assert.match(startup, /Pi default \/ Cline selectable \/ no cloud fallback/);
  assert.match(startup, /--worker mastra-qwen/);
});

test("GitHub handoff no longer creates an empty placeholder repair PR", async () => {
  const workflow = await read(".github/workflows/uat-repair-handoff.yml");

  assert.match(workflow, /run-uat-repair-agent\.mjs --issue/);
  assert.match(workflow, /GitHub Actions no longer creates an empty placeholder PR/);
  assert.doesNotMatch(workflow, /git checkout -b/);
  assert.doesNotMatch(workflow, /gh pr create/);
  assert.doesNotMatch(workflow, /contents:\s*write/);
});

test("focused Startup UAT owns the repair-agent regression", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const startup = registry.areas.find((area) => area.id === "startup");
  assert.ok(startup?.tests.includes("tests/issue-630-local-uat-repair-agent.test.mjs"));
});
