import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  verificationCommandFor,
  windowsVerificationCommand,
} from "../scripts/full-verification-process.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("#1036 wraps npm.cmd through ComSpec on Windows without shell:true", () => {
  const command = verificationCommandFor(
    { tool: "npm", args: ["run", "build"] },
    {
      platform: "win32",
      env: { ComSpec: "C:\\Windows\\System32\\cmd.exe" },
      nodeExecPath: "C:\\Program Files\\nodejs\\node.exe",
    },
  );

  assert.equal(command.command, "C:\\Windows\\System32\\cmd.exe");
  assert.deepEqual(command.args, ["/d", "/s", "/c", '"npm.cmd" "run" "build"']);
  assert.equal(windowsVerificationCommand("npm.cmd", ["run", "validate:learn"]), '"npm.cmd" "run" "validate:learn"');
});

test("#1036 keeps direct Node verification commands shell-free", () => {
  const command = verificationCommandFor(
    { tool: "node", args: ["scripts/agent-skills.mjs", "--self-test"] },
    { platform: "win32", nodeExecPath: "C:\\Program Files\\nodejs\\node.exe", env: {} },
  );
  assert.equal(command.command, "C:\\Program Files\\nodejs\\node.exe");
  assert.deepEqual(command.args, ["scripts/agent-skills.mjs", "--self-test"]);
});

test("#1036 progress runner uses the shared Windows-safe verification command contract", async () => {
  const progressRunner = await source("scripts/full-verification-progress-runner.mjs");
  assert.match(progressRunner, /from "\.\/full-verification-process\.mjs"/);
  assert.match(progressRunner, /verificationCommandFor\(node\)/);
  assert.match(progressRunner, /terminateVerificationProcessTree\(child\)/);
  assert.doesNotMatch(progressRunner, /process\.platform === "win32" \? "npm\.cmd"/);
  assert.doesNotMatch(progressRunner, /shell:\s*true/);
});

test("#1036 standalone app readiness owns a managed Vite server and fails fast on early exit", async () => {
  const graph = await source("scripts/full-verification-graph.mjs");
  assert.match(graph, /node_modules", "vite", "bin", "vite\.js"/);
  assert.match(graph, /spawn\(process\.execPath, \[viteCli, "--host", "127\.0\.0\.1", "--port", "4173", "--strictPort"\]/);
  assert.match(graph, /PLOTPICKLE_STARTUP_CONTRACT:\s*"plotpickle-full-verification"/);
  assert.match(graph, /child\.exitCode !== null \|\| child\.signalCode !== null/);
  assert.match(graph, /exited before becoming ready/);
  assert.match(graph, /terminateVerificationProcessTree\(child\)/);
  assert.match(graph, /await stopManagedPlotPickleVerificationServer\(\);/);
  assert.doesNotMatch(graph, /Start-PlotPickle\.bat/);
  assert.doesNotMatch(graph, /shell:\s*true/);
});

test("#1036 Full Check tells Windows users it is standalone", async () => {
  const launcher = await source("Run-PlotPickle-Full-Check.bat");
  assert.match(launcher, /STANDALONE: You do not need to run Start-PlotPickle\.bat first\./);
  assert.match(launcher, /Full Verification starts and owns the local app server when browser checks need it\./);
});
