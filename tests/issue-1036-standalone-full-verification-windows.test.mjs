import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";
import path from "node:path";
import {
  verificationCommandFor,
  windowsVerificationCommandArgs,
} from "../scripts/full-verification-process.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function source(relativePath) {
  return readFile(path.join(repoRoot, relativePath), "utf8");
}

test("#1042 passes npm.cmd and npm arguments separately through ComSpec", () => {
  const command = verificationCommandFor(
    { tool: "npm", args: ["run", "build"] },
    {
      platform: "win32",
      env: { ComSpec: "C:\\Windows\\System32\\cmd.exe" },
      nodeExecPath: "C:\\Program Files\\nodejs\\node.exe",
    },
  );

  assert.equal(command.command, "C:\\Windows\\System32\\cmd.exe");
  assert.deepEqual(command.args, ["/d", "/s", "/c", "npm.cmd", "run", "build"]);
  assert.deepEqual(
    windowsVerificationCommandArgs("npm.cmd", ["run", "validate:learn"]),
    ["npm.cmd", "run", "validate:learn"],
  );
});

test("#1042 rejects unsafe Windows verification command and argument tokens", () => {
  assert.throws(
    () => windowsVerificationCommandArgs("npm.cmd & whoami", ["run", "build"]),
    /Windows verification command contains unsupported characters/,
  );
  assert.throws(
    () => windowsVerificationCommandArgs("npm.cmd", ["run", "build & whoami"]),
    /Windows verification argument contains unsupported characters/,
  );
  assert.throws(
    () => windowsVerificationCommandArgs("npm.cmd", ["run", "build target"]),
    /Windows verification argument contains unsupported characters/,
  );
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
  assert.match(progressRunner, /endpointContext\.environment\(\)/);
  assert.doesNotMatch(progressRunner, /process\.platform === "win32" \? "npm\.cmd"/);
  assert.doesNotMatch(progressRunner, /shell:\s*true/);
});

test("#1036 standalone app readiness owns a dynamically allocated exact-instance Vite endpoint", async () => {
  const [graph, endpointRuntime] = await Promise.all([
    source("scripts/full-verification-graph.mjs"),
    source("scripts/local-endpoint-runtime.mjs"),
  ]);
  assert.match(graph, /startManagedPlotPickleEndpoint/);
  assert.match(graph, /serviceKind:\s*"plotpickle-full-verification"/);
  assert.match(graph, /plotpickle-full-verification-endpoint-v1/);
  assert.match(graph, /createVerificationEndpointContext/);
  assert.match(graph, /context\.environment\(\)/);
  assert.match(graph, /stopManagedLocalEndpoint/);
  assert.doesNotMatch(graph, /"--port",\s*"4173"/);
  assert.doesNotMatch(graph, /plotPickleUrl\s*=\s*"http:\/\/127\.0\.0\.1:4173"/);
  assert.match(endpointRuntime, /reserveLoopbackPort/);
  assert.match(endpointRuntime, /--strictPort/);
  assert.match(endpointRuntime, /PLOTPICKLE_EXPECTED_COMMIT/);
  assert.match(endpointRuntime, /verifyExactLocalInstance/);
  assert.match(endpointRuntime, /EADDRINUSE/);
  assert.doesNotMatch(graph, /Start-PlotPickle\.bat/);
  assert.doesNotMatch(endpointRuntime, /shell:\s*true/);
});

test("#1036 Full Check tells Windows users it is standalone", async () => {
  const launcher = await source("Run-PlotPickle-Full-Check.bat");
  assert.match(launcher, /STANDALONE: You do not need to run Start-PlotPickle\.bat first\./);
  assert.match(launcher, /Full Verification starts and owns the local app server when browser checks need it\./);
});
