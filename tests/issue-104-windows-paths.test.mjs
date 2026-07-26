import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #104 preserves Windows executable paths containing spaces", async () => {
  const [helper, build, timeout, audit] = await Promise.all([
    source("scripts/spawn-command.mjs"),
    source("scripts/build-verified.mjs"),
    source("scripts/run-command-with-timeout.mjs"),
    source("scripts/lighthouse-audit.mjs"),
  ]);

  assert.match(helper, /process\.env\.ComSpec/);
  assert.ok(helper.includes('/\\.(?:cmd|bat)$/i'));
  assert.match(helper, /shell: false/);
  assert.match(helper, /quoteForCommandPrompt/);
  assert.match(helper, /C:\\Program Files\\nodejs\\node\.exe/);

  for (const file of [build, timeout, audit]) {
    assert.match(file, /spawnCommand/);
    assert.doesNotMatch(file, /shell:\s*process\.platform\s*===\s*["']win32["']/);
    assert.doesNotMatch(file, /shell:\s*true/);
  }

  assert.match(build, /process\.execPath/);
  assert.match(audit, /npm\.cmd/);
  assert.match(audit, /npx\.cmd/);
});
