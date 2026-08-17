import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (relativePath) => readFile(new URL(`../${relativePath}`, import.meta.url), "utf8");

test("full verification preserves child-process output in the transcript", async () => {
  const runner = await read("scripts/run-plotpickle-full-check.ps1");
  const invocationLines = runner
    .split(/\r?\n/)
    .filter((line) => /^\s*Invoke-(?:Node|Npm)Step\s+/.test(line));

  assert.ok(invocationLines.length >= 9, "all verification stages should use the shared step runners");
  for (const line of invocationLines) {
    assert.doesNotMatch(line, /\|\s*Out-Null/i, `child output must remain visible: ${line.trim()}`);
  }
  assert.doesNotMatch(runner, /return\s+\$Code\b/);
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
