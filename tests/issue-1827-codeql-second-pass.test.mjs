import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { windowsBatchInvocation } from "../scripts/windows-batch-command.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1827 keeps dynamic Windows batch values out of shell command text", () => {
  const command = "C:\\Program Files\\PlotPickle\\worker.cmd";
  const argument = "hello world";
  const invocation = windowsBatchInvocation(command, [argument], { Path: "C:\\Windows\\System32" });

  assert.equal(invocation.executable, "cmd.exe");
  assert.deepEqual(invocation.args.slice(0, 3), ["/d", "/s", "/c"]);
  assert.match(invocation.args[3], /^call "%PLOTPICKLE_BATCH_COMMAND%" "%PLOTPICKLE_BATCH_ARG_0%"$/u);
  assert.equal(invocation.args[3].includes(command), false);
  assert.equal(invocation.args[3].includes(argument), false);
  assert.equal(invocation.env.PLOTPICKLE_BATCH_COMMAND, command);
  assert.equal(invocation.env.PLOTPICKLE_BATCH_ARG_0, argument);
  assert.throws(() => windowsBatchInvocation("worker.cmd", ["bad&argument"], {}), /unsupported command-shell characters/u);
});

test("#1827 routes every flagged Windows shell callsite through the reviewed boundary", async () => {
  const [spawnHelper, npxLauncher, piRuntime] = await Promise.all([
    read("scripts/spawn-command.mjs"),
    read("scripts/run-npx-stdio.mjs"),
    read("scripts/pi-worker-runtime.mjs"),
  ]);

  for (const source of [spawnHelper, npxLauncher, piRuntime]) {
    assert.doesNotMatch(source, /process\.env\.(?:ComSpec|COMSPEC)/u);
  }
  assert.match(spawnHelper, /windowsBatchInvocation\(command, args/u);
  assert.match(npxLauncher, /spawnCommand\(command, npxArgs/u);
  assert.match(piRuntime, /windowsBatchInvocation\(command, commandArgs/u);
  assert.match(piRuntime, /shell: false/u);
});

test("#1827 sanitizes the flagged Casebook browser label after JSON encoding", async () => {
  const source = await read("scripts/casebook-evidence.mjs");
  assert.match(source, /function safeBrowserStringLiteral\(value\)/u);
  assert.match(source, /JSON\.stringify\(String\(value\)\)\.replace\(/u);
  assert.match(source, /const wanted = safeBrowserStringLiteral\(label\)/u);
  assert.doesNotMatch(source, /const wanted = JSON\.stringify\(String\(label\)\)/u);
});

test("#1827 removes the two no-op substring replacements flagged in tests", async () => {
  const [feedback, visualBoard] = await Promise.all([
    read("tests/issue-483-feedback-studio.test.mjs"),
    read("tests/issue-88-visual-board-navigation.test.mjs"),
  ]);
  assert.match(feedback, /new RegExp\(label\)/u);
  assert.match(visualBoard, /new RegExp\(label\)/u);
  assert.doesNotMatch(feedback, /label\.replace/u);
  assert.doesNotMatch(visualBoard, /label\.replace/u);
});

test("#1827 gives Runtime Weight Inventory explicit least-privilege permissions", async () => {
  const workflow = await read(".github/workflows/runtime-weight-inventory.yml");
  assert.match(workflow, /^permissions:\s*\n\s+contents:\s*read\s*$/mu);
  assert.doesNotMatch(workflow, /contents:\s*write/u);
});
