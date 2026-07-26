import assert from "node:assert/strict";
import { copyFile, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";
import test from "node:test";
import { spawnCommand } from "../scripts/spawn-command.mjs";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

function completed(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawnCommand(command, args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} failed with ${signal ?? `exit ${code}`}`));
    });
  });
}

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
  assert.match(helper, /windowsVerbatimArguments: true/);
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

test("issue #106 executes npm.cmd and spaced Windows commands without literal quote characters", { skip: process.platform !== "win32" }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "PlotPickle command path "));
  try {
    const copiedNode = join(directory, "node copy.exe");
    const commandFile = join(directory, "argument check.cmd");
    await copyFile(process.execPath, copiedNode);
    await writeFile(commandFile, '@echo off\r\nif "%~1"=="hello world" exit /b 0\r\nexit /b 1\r\n', "utf8");

    await completed(copiedNode, ["-e", "process.exit(0)"]);
    await completed("npm.cmd", ["--version"]);
    await completed(commandFile, ["hello world"]);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
