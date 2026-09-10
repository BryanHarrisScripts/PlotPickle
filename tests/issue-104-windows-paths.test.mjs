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
  const [helper, build, timeout] = await Promise.all([
    source("scripts/spawn-command.mjs"),
    source("scripts/build-verified.mjs"),
    source("scripts/run-command-with-timeout.mjs"),
  ]);

  assert.match(helper, /windowsJavaScriptCliInvocation/);
  assert.ok(helper.includes('/\\.(?:cmd|bat)$/i'));
  assert.match(helper, /shell: false/);
  assert.doesNotMatch(helper, /process\.env\.ComSpec/);
  assert.doesNotMatch(helper, /windowsVerbatimArguments/);
  assert.doesNotMatch(helper, /quoteForCommandPrompt/);
  assert.match(helper, /roots\.push\(dirname\(nodeExecutable\)\)/);
  assert.match(helper, /join\(root, "node_modules", "npm", "bin", cliName\)/);
  assert.match(helper, /commandName === "vinext\.cmd"/);
  assert.match(helper, /Unsupported Windows batch wrapper/);
  assert.doesNotMatch(helper, /windowsBatchInvocation|spawn\(\s*["']cmd\.exe|PLOTPICKLE_BATCH_/);

  for (const file of [build, timeout]) {
    assert.match(file, /spawnCommand/);
    assert.doesNotMatch(file, /shell:\s*process\.platform\s*===\s*["']win32["']/);
    assert.doesNotMatch(file, /shell:\s*true/);
  }

  assert.match(build, /process\.execPath/);
});

test("issue #106 executes npm.cmd and spaced native commands while rejecting arbitrary batch wrappers", { skip: process.platform !== "win32" }, async () => {
  const directory = await mkdtemp(join(tmpdir(), "PlotPickle command path "));
  try {
    const copiedNode = join(directory, "node copy.exe");
    const commandFile = join(directory, "argument check.cmd");
    await copyFile(process.execPath, copiedNode);
    await writeFile(commandFile, '@echo off\r\nif "%~1"=="hello world" exit /b 0\r\nexit /b 1\r\n', "utf8");

    await completed(copiedNode, ["-e", "process.exit(0)"]);
    await completed("npm.cmd", ["--version"]);
    await assert.rejects(completed(commandFile, ["hello world"]), /Unsupported Windows batch wrapper/);
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});
