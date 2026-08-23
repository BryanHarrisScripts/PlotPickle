import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("full verification preserves graph child-process output in the same transcript", async () => {
  const [runner, launcher, supervisor, progressRunner, graph] = await Promise.all([
    read("scripts/run-plotpickle-full-check.ps1"),
    read("scripts/invoke-full-verification-supervisor.ps1"),
    read("scripts/full-verification-supervisor.mjs"),
    read("scripts/full-verification-progress-runner.mjs"),
    read("scripts/full-verification-graph.mjs"),
  ]);

  assert.match(runner, /invoke-full-verification-supervisor\.ps1/);
  assert.doesNotMatch(runner, /full-verification-supervisor\.mjs[^\r\n]*\|\s*Out-Null/i);
  assert.match(launcher, /RedirectStandardOutput\s+\$StdoutPath/);
  assert.match(launcher, /RedirectStandardError\s+\$StderrPath/);
  assert.match(launcher, /Write-AvailableOutput\s+-ReaderPair\s+\$stdoutPair/);
  assert.match(launcher, /Write-AvailableOutput\s+-ReaderPair\s+\$stderrPair\s+-IsError/);
  assert.match(launcher, /Full Verification launcher \.{8} START/);
  assert.match(supervisor, /full-verification-progress-runner\.mjs/);
  assert.match(supervisor, /stdio:\s*\["ignore", "pipe", "pipe"\]/);
  assert.match(supervisor, /child\.stdout\?\.on\("data"/);
  assert.match(supervisor, /child\.stderr\?\.on\("data"/);
  assert.match(supervisor, /stream\?\.write\?\.\(text\)/);
  assert.match(progressRunner, /from "\.\/full-verification-graph\.mjs"/);
  assert.match(progressRunner, /stdio:\s*\["ignore", "pipe", "pipe"\]/);
  assert.match(progressRunner, /child\.stdout\?\.on\("data"/);
  assert.match(progressRunner, /child\.stderr\?\.on\("data"/);
  assert.match(progressRunner, /writeChunk\(node\.id, stream, text\)/);
  assert.match(graph, /runVerificationGraph/);
  assert.match(runner, /complete child-process output above is part of this same log/i);
});

test("full verification keeps the exact Agent Skills architecture pair visible in CI", async () => {
  const workflow = await read(".github/workflows/learn-validation.yml");

  for (const testPath of [
    "tests/sage-brinewick-agent-skill.test.mjs",
    "tests/issue-913-agent-skills-migration.test.mjs",
  ]) {
    assert.ok(workflow.includes(testPath), `${testPath} must run in the full-verification architecture pair in PR CI`);
  }
  assert.match(workflow, /node --test tests\/sage-brinewick-agent-skill\.test\.mjs tests\/issue-913-agent-skills-migration\.test\.mjs/);
});

test("production build sets Vite native-loader advisory control before Vite starts", async () => {
  const [buildVerified, packageJsonText] = await Promise.all([
    read("scripts/build-verified.mjs"),
    read("package.json"),
  ]);
  const packageJson = JSON.parse(packageJsonText);

  assert.equal(packageJson.scripts.build, "node scripts/build-verified.mjs");
  assert.match(buildVerified, /VITE_CONFIG_NATIVE_IGNORE_WARNING:\s*"true"/);
});

test("winget no-applicable-update is a healthy maintenance result rather than a warning", async () => {
  const companion = await read("scripts/windows-companion-software.ps1");

  assert.match(companion, /\$WingetNoApplicableUpdate\s*=\s*-1978335189/);
  assert.match(companion, /elseif\s*\(\$code\s*-eq\s*\$WingetNoApplicableUpdate\)/);
  assert.match(companion, /\[OK\].*already current; no applicable update was found/);
});
