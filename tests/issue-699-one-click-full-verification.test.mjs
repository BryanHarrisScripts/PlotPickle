import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Windows launcher is portable, double-click friendly, and keeps the console open", async () => {
  const launcher = await read("Utilities/Run-PlotPickle-Full-Check.bat");

  assert.match(launcher, /cd \/d "%~dp0\.\."/i);
  assert.match(launcher, /powershell\.exe -NoProfile -ExecutionPolicy Bypass -File "%CD%\\scripts\\run-plotpickle-full-check\.ps1"/i);
  assert.match(launcher, /pause >nul/i);
  assert.match(launcher, /exit \/b %EXIT_CODE%/i);
  assert.doesNotMatch(launcher, /C:\\Users\\/i);
});

test("full verification delegates the requested checks to the graph and centralizes GitHub reporting", async () => {
  const [runner, graph] = await Promise.all([
    read("scripts/run-plotpickle-full-check.ps1"),
    read("scripts/full-verification-graph.mjs"),
  ]);
  const commands = [
    "ensure-local-repair-model.mjs",
    "run-uat-repair-agent.mjs",
    "verify-buzz-live-activity.mjs",
    "run-exhaustive-ui-uat.mjs",
    "run-writer-in-residence.mjs",
  ];

  assert.match(runner, /full-verification-graph\.mjs/);
  for (const command of commands) assert.match(graph, new RegExp(command.replaceAll(".", "\\.")));

  assert.match(graph, /scripts\/ensure-local-repair-model\.mjs", "--worker", "pi"/);
  assert.match(graph, /scripts\/run-uat-repair-agent\.mjs", "--worker", "pi", "--preflight", "--require-ready"/);
  assert.match(graph, /id: "pi-preflight"[\s\S]*dependencies: \[\{ id: "ensure-pi-model", require: "success"/);
  assert.doesNotMatch(runner, /run-exhaustive-ui-uat\.mjs|run-writer-in-residence\.mjs/);
  assert.match(runner, /verification-orchestrator\.mjs/);
  assert.match(runner, /if \(\$GitHubReport\) \{ \$Arguments \+= "--github-report" \}/);
});

test("full verification graph starts one job-scoped dynamic endpoint and proves exact worktree HEAD", async () => {
  const [runner, graph, endpointRuntime, proofGateway] = await Promise.all([
    read("scripts/run-plotpickle-full-check.ps1"),
    read("scripts/full-verification-graph.mjs"),
    read("scripts/local-endpoint-runtime.mjs"),
    read("build/local-instance-proof-gateway.ts"),
  ]);

  assert.match(runner, /full-verification-graph\.mjs/);
  assert.match(graph, /createVerificationEndpointContext/);
  assert.match(graph, /startManagedPlotPickleEndpoint/);
  assert.match(graph, /plotpickle-full-verification-endpoint-v1/);
  assert.match(graph, /endpointProvenance:\s*endpointContext\.evidence\(\)/);
  assert.match(graph, /id: "app-ready"[\s\S]*dependencies: \[\{ id: "production-build", require: "complete"/);
  assert.doesNotMatch(graph, /http:\/\/127\.0\.0\.1:4173|"--port",\s*"4173"/);
  assert.doesNotMatch(graph, /managedVerificationRuntime/);
  assert.match(endpointRuntime, /reserveLoopbackPort/);
  assert.match(endpointRuntime, /--strictPort/);
  assert.match(endpointRuntime, /PLOTPICKLE_EXPECTED_COMMIT/);
  assert.match(endpointRuntime, /verifyExactLocalInstance/);
  assert.match(proofGateway, /git", \["rev-parse", "HEAD"\]/);
  assert.match(proofGateway, /exactHead/);
  assert.doesNotMatch(graph, /Start-PlotPickle\.bat/);
  assert.doesNotMatch(endpointRuntime, /shell:\s*true/);
});

test("normal startup no longer needs a UAT-prompt suppression workaround", async () => {
  const [runner, diagnostics] = await Promise.all([
    read("scripts/run-plotpickle-full-check.ps1"),
    read("build/startup-agent-diagnostics.ts"),
  ]);
  const retired = new URL("../build/startup-uat-decision.ts", import.meta.url);

  assert.doesNotMatch(runner, /PLOTPICKLE_STARTUP_UAT_PROMPT|PreviousStartupPrompt/);
  assert.doesNotMatch(diagnostics, /offerStartupUatDecision|startup-uat-decision|Start the PlotPickle UAT Agent now/);
  await assert.rejects(access(retired), /ENOENT/);
});

test("full verification records every result and fails visibly when any check needs attention", async () => {
  const runner = await read("scripts/run-plotpickle-full-check.ps1");

  assert.match(runner, /Start-Transcript/);
  assert.match(runner, /plotpickle-full-check-\$Stamp\.log/);
  assert.match(runner, /FINAL SUMMARY/);
  assert.match(runner, /Where-Object \{ \$_\.Status -ne "PASS" \}/);
  assert.match(runner, /complete child-process output above is part of this same log/i);
  assert.match(runner, /exit \$FinalExitCode/);
  assert.doesNotMatch(runner, /C:\\Users\\/i);
});

test("one-click runner does not add cloud fallback or model download behavior", async () => {
  const runner = await read("scripts/run-plotpickle-full-check.ps1");

  assert.doesNotMatch(runner, /api\.openai\.com|api\.anthropic\.com|openrouter\.ai/i);
  assert.doesNotMatch(runner, /ollama\s+pull|lms\s+get/i);
});

test("focused Startup UAT owns the one-click verification regression", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const startup = registry.areas.find((area) => area.id === "startup");
  assert.ok(startup);
  assert.ok(startup.tests.includes("tests/issue-699-one-click-full-verification.test.mjs"));
});
