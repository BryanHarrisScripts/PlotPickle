import assert from "node:assert/strict";
import test from "node:test";
import path from "node:path";
import {
  ENGINEERING_MODES, validEngineeringSelection, runStagedEngineeringTask,
  sanitizeEngineeringOutput,
} from "../scripts/engineering-team/mcp/engineering/factory-engineering-exec.mjs";
import {
  MCP_TOOLS, MCP_CONTROL_TOOLS, MCP_ENGINEERING_TOOLS, handleRpc,
} from "../scripts/engineering-team/mcp/factory-readonly-server.mjs";

const BASE = "a".repeat(40), CANDIDATE = "b".repeat(40);
const rid = n => n.toString(16).padStart(32, "0");
const selection = (patch = {}) => ({
  requestId: rid(20), expectedHead: BASE, stageRequestId: rid(10),
  candidatePrNumber: 3237, candidateHead: CANDIDATE,
  mode: "node-test", target: "tests/issue-3233-canonical-library-entry.test.mjs",
  scriptArgs: [], ...patch,
});
const receipt = {
  state: "TEST_PASSED", code: "CANDIDATE_STATIC_STAGED",
  stageId: rid(10), sourceHead: BASE, candidateHead: CANDIDATE,
  candidatePrNumber: 3237,
};
const stagePath = path.join(path.resolve("factory-private"),
  "chat-candidate-stages", rid(10));
const mockFs = {
  lstat: async () => ({ isDirectory: () => true, isSymbolicLink: () => false,
    isFile: () => true }),
  realpath: async input => input,
};
function harness(options = {}) {
  const calls = [];
  let clean = true, remote = true, localHead = BASE;
  return {
    calls,
    setDirty: () => { clean = false; },
    setRemoteMoved: () => { remote = false; },
    setLocalMoved: () => { localHead = "c".repeat(40); },
    services: {
      selection: selection(), root: path.resolve("factory-private"),
      repoRoot: path.resolve("PlotPickle"),
      stageReceipt: receipt, platform: "win32",
      fs: mockFs,
      verifyHead: async () => localHead,
      inspectPr: async () => remote
        ? { state: "TEST_PASSED", code: "CANDIDATE_HEAD_VERIFIED" }
        : { state: "BLOCKED", code: "CANDIDATE_HEAD_MISMATCH" },
      git: async args => args[0] === "rev-parse" ? CANDIDATE : clean ? "" : " M src.ts",
      execute: async opts => {
        calls.push(opts);
        if (options.mutateAfterExecution) clean = false;
        return options.exitCode === undefined
          ? { exitCode: 0, output: "19 tests passed" }
          : { exitCode: options.exitCode, output: "Error: expected true" };
      },
    },
  };
}

test("#3110 opt-in engineering changes neither default public nor authenticated fixed catalogue", async () => {
  assert.equal(MCP_TOOLS.length, 4);
  assert.equal(MCP_CONTROL_TOOLS.length, 4);
  assert.deepEqual(MCP_ENGINEERING_TOOLS.map(t => t.name), ["factory_engineering_run"]);
  assert.deepEqual(ENGINEERING_MODES, [
    "git-diff-check", "node-test", "node-script",
    "powershell-file", "npm-script", "npm-install",
  ]);
  const call = async (engineeringEnabled, controlAuthenticated, method, name) =>
    handleRpc({
      jsonrpc: "2.0", id: 1, method,
      ...(name ? { params: { name, arguments: selection() } } : {}),
    }, { engineeringEnabled, controlAuthenticated });
  const defaultList = await call(false, true, "tools/list");
  assert.equal(defaultList.result.tools.length, 10);
  assert.ok(defaultList.result.tools.some(tool => tool.name === "factory_storage_inventory"));
  assert.ok(defaultList.result.tools.some(tool => tool.name === "factory_conversation"));
  const optInList = await call(true, true, "tools/list");
  assert.equal(optInList.result.tools.length, 11);
  const readOnly = await call(true, false, "tools/list");
  assert.equal(readOnly.result.tools.length, 4);
  assert.equal(readOnly.result.tools.some(tool => tool.name === "factory_conversation"), false);
  assert.equal((await call(false, true, "tools/call", "factory_engineering_run")).error.code, -32601);
  assert.equal((await call(true, false, "tools/call", "factory_engineering_run")).error.code, -32001);
  const malformed = await handleRpc({jsonrpc:"2.0",id:2,method:"tools/call",
    params:{name:"factory_engineering_run",arguments:{requestId:"not-valid"}}},
    {engineeringEnabled:true,controlAuthenticated:true});
  assert.equal(malformed.error.code,-32602);
});

test("#3110 flexible script selection is path-scoped, not a raw arbitrary shell", () => {
  assert.equal(validEngineeringSelection(selection()), true);
  assert.equal(validEngineeringSelection(selection({ mode: "powershell-file",
    target: "scripts/run-plotpickle-full-check.ps1" })), true);
  assert.equal(validEngineeringSelection(selection({ mode: "node-script",
    target: "scripts/verification-shadow.mjs" })), true);
  assert.equal(validEngineeringSelection(selection({ mode: "npm-script",
    target: "build" })), true);
  assert.equal(validEngineeringSelection(selection({ mode: "npm-install",
    target: undefined })), true);
  for (const patch of [
    { command: "powershell.exe" }, { mode: "shell" }, { target: "../owner/private.ps1" },
    { target: "scripts/../../owner.ps1" }, { target: "C:/Windows/system32/foo.ps1" },
    { target: "scripts/evil.ps1;rm" }, { target: "scripts/evil.ps1\\.." },
    { scriptArgs: [";Remove-Item"] }, { scriptArgs: ["-Command", "Remove-Item;"] },
    { candidateHead: "f".repeat(39) }, { stageRequestId: rid(20) },
    { mode: "git-diff-check", target: "scripts/run.mjs" },
    { mode: "node-test", target: "scripts/run.mjs" },
    { mode: "powershell-file", target: "tests/thing.test.mjs" },
  ]) assert.equal(validEngineeringSelection(selection(patch)), false, JSON.stringify(patch));
});

test("#3110 exact staged receipt and candidate PR attestations precede any script launch", async () => {
  const h = harness();
  const success = await runStagedEngineeringTask(h.services);
  assert.equal(success.state, "TEST_PASSED");
  assert.equal(success.code, "ENGINEERING_TASK_PASSED");
  assert.equal(success.sourceHead, BASE);
  assert.equal(success.candidateHead, CANDIDATE);
  assert.equal(success.independentVerification, false);
  assert.equal(success.modelInvoked, null);
  assert.equal(h.calls.length, 1);
  assert.equal(h.calls[0].program, process.execPath);
  assert.deepEqual(h.calls[0].argv.slice(0, 1), ["--test"]);
  assert.equal(h.calls[0].cwd, stagePath);

  const wrongReceipt = harness();
  const noStage = await runStagedEngineeringTask({
    ...wrongReceipt.services, stageReceipt: { ...receipt, candidateHead: "c".repeat(40) },
  });
  assert.equal(noStage.code, "ENGINEERING_STAGE_RECEIPT_INVALID");
  assert.equal(wrongReceipt.calls.length, 0);
  const moved = harness(); moved.setRemoteMoved();
  const mismatch = await runStagedEngineeringTask(moved.services);
  assert.equal(mismatch.code, "ENGINEERING_SOURCE_CHANGED");
  assert.equal(moved.calls.length, 0);
  const dirty = harness(); dirty.setDirty();
  assert.equal((await runStagedEngineeringTask(dirty.services)).code, "ENGINEERING_SOURCE_CHANGED");
  assert.equal(dirty.calls.length, 0);
  const localMoved = harness(); localMoved.setLocalMoved();
  assert.equal((await runStagedEngineeringTask(localMoved.services)).code, "ENGINEERING_SOURCE_CHANGED");
  assert.equal(localMoved.calls.length, 0);
  const nonWindows = harness();
  assert.equal((await runStagedEngineeringTask({ ...nonWindows.services,
    platform: "linux" })).code, "WINDOWS_ONLY");
  assert.equal(nonWindows.calls.length, 0);
});

test("#3110 native PowerShell -File selection invokes no inline shell and never main", async () => {
  const h = harness();
  const result = await runStagedEngineeringTask({ ...h.services,
    selection: selection({ mode: "powershell-file",
      target: "scripts/run-plotpickle-full-check.ps1",
      scriptArgs: ["-Scope", "smoke"] }),
  });
  assert.equal(result.state, "TEST_PASSED");
  assert.equal(h.calls.length, 1);
  const x = h.calls[0];
  assert.equal(x.program, "powershell.exe");
  assert.ok(x.argv.includes("-NoProfile"));
  assert.ok(x.argv.includes("-NonInteractive"));
  assert.ok(x.argv.includes("-File"));
  assert.ok(!x.argv.includes("-Command"));
  assert.ok(x.argv.includes(path.join(stagePath, "scripts", "run-plotpickle-full-check.ps1")));
  assert.equal(x.cwd, stagePath);
});

test("#3110 test failures and modified candidate source fail closed, never become product UAT", async () => {
  const failed = harness({ exitCode: 1 });
  const red = await runStagedEngineeringTask(failed.services);
  assert.equal(red.state, "TEST_FAILED");
  assert.equal(red.code, "ENGINEERING_TASK_FAILED");
  assert.equal(red.exitCode, 1);
  assert.equal(red.independentVerification, false);
  const modified = harness({ mutateAfterExecution: true });
  const result = await runStagedEngineeringTask(modified.services);
  assert.equal(result.state, "BLOCKED");
  assert.equal(result.code, "ENGINEERING_SOURCE_CHANGED");
  assert.equal(modified.calls.length, 1);
  assert.equal(sanitizeEngineeringOutput(
    "token=ghp-SUPERSECRET\\nC:\\Users\\private\\AppData\\Local\\secret"
  ).includes("SUPERSECRET"), false);
});
