import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { handleRpc, MCP_CONTROL_TOOLS, factoryControlReceipt } from "../scripts/engineering-team/mcp/factory-readonly-server.mjs";

const MAIN = "a".repeat(40);
const CANDIDATE = "b".repeat(40);
const STAGE = "c".repeat(32);
const REQUEST = "d".repeat(32);
const DIGEST = "e".repeat(64);
const selection = { requestId: REQUEST, expectedHead: MAIN,
  suite: "factory-gateway-acceptance", candidatePrNumber: 3301,
  candidateHead: CANDIDATE, sourceRequestId: STAGE };
const rpc = (args, opts) => handleRpc({ jsonrpc: "2.0", id: 3303,
  method: "tools/call", params: { name: "factory_run_named_test", arguments: args } }, opts);

async function sandbox(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pp-gateway-acceptance-"));
  try { return await fn(root); }
  finally { await rm(root, { recursive: true, force: true }); }
}
async function stageReceipt(root) {
  const dir = path.join(root, "mcp-control-requests");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, STAGE + ".json"), JSON.stringify({
    schemaVersion: 1, requestId: STAGE, operation: "factory_run_named_test",
    expectedHead: MAIN, candidatePrNumber: 3301, candidateHead: CANDIDATE,
  }) + "\n");
  await writeFile(path.join(dir, STAGE + "-result.json"), JSON.stringify({
    requestId: STAGE, state: "TEST_PASSED", code: "CANDIDATE_STATIC_STAGED",
    sourceHead: MAIN, suite: "factory-pr-stage", stageId: STAGE,
    candidatePrNumber: 3301, candidateHead: CANDIDATE, changedFileCount: 6,
  }) + "\n");
}

test("#3303 fixed headless gateway suite requires authentication and six exact identity fields", () => sandbox(async root => {
  const tool = MCP_CONTROL_TOOLS.find(t => t.name === "factory_run_named_test");
  assert.ok(tool.inputSchema.properties.suite.enum.includes("factory-gateway-acceptance"));
  let calls = 0;
  const opts = { root, controlAuthenticated: true, engineeringEnabled: true, controlOps: {
    testHead: async () => MAIN, engineering: async () => { calls++; throw Error("must not run"); },
  } };
  assert.equal((await rpc(selection, { ...opts, controlAuthenticated: false })).error.code, -32001);
  assert.equal((await rpc(selection, { ...opts, engineeringEnabled: false })).error.code, -32601);
  assert.equal((await rpc({ ...selection, command: "powershell" }, opts)).error.code, -32602);
  assert.equal((await rpc({ ...selection, sourceRequestId: REQUEST }, opts)).error.code, -32602);
  assert.equal((await rpc({ ...selection, candidateHead: "wrong" }, opts)).error.code, -32602);
  assert.equal((await rpc({ ...selection, candidatePrNumber: undefined }, opts)).error.code, -32602);
  assert.equal(calls, 0);
}));

test("#3303 owner Windows headless route uses existing isolated engineering runner and write-once receipt", () => sandbox(async root => {
  await stageReceipt(root);
  let calls = 0;
  const opts = { root, controlAuthenticated: true, engineeringEnabled: true, controlOps: {
    testHead: async () => MAIN,
    engineering: async ({ selection: task, stageReceipt: stage, root: receivedRoot }) => {
      calls++;
      assert.equal(receivedRoot, root);
      assert.equal(stage.code, "CANDIDATE_STATIC_STAGED");
      assert.equal(stage.stageId, STAGE);
      assert.deepEqual(task, { requestId: REQUEST, expectedHead: MAIN,
        stageRequestId: STAGE, candidatePrNumber: 3301, candidateHead: CANDIDATE,
        mode: "node-test", target: "tests/issue-3259-outbound-openai-once.test.mjs",
        scriptArgs: [] });
      return { state: "TEST_PASSED", code: "ENGINEERING_TASK_PASSED",
        sourceHead: MAIN, candidateHead: CANDIDATE, candidatePrNumber: 3301,
        stageId: STAGE, mode: "node-test", exitCode: 0, durationMs: 25,
        outputDigest: DIGEST, independentVerification: false, modelInvoked: false };
    },
  } };
  const answer = (await rpc(selection, opts)).result.structuredContent;
  assert.equal(answer.state, "TEST_PASSED");
  assert.equal(answer.code, "ENGINEERING_TASK_PASSED");
  assert.equal(answer.candidateHead, CANDIDATE);
  assert.equal(answer.candidatePrNumber, 3301);
  assert.equal(answer.stageId, STAGE);
  assert.equal(answer.exitCode, 0);
  assert.equal(answer.outputDigest, DIGEST);
  assert.equal(answer.independentVerification, false);
  // A subprocess test receipt cannot independently attest a live provider outcome.
  assert.equal(answer.modelInvoked, null);
  assert.equal(calls, 1);
  const receipt = await factoryControlReceipt({ root, requestId: REQUEST });
  assert.equal(receipt.outputDigest, DIGEST);
  assert.equal((await rpc(selection, opts)).result.structuredContent.state, "DUPLICATE_OR_UNVERIFIABLE_REQUEST");
  assert.equal(calls, 1);
  const persisted = await readFile(path.join(root, "mcp-control-requests", REQUEST + "-result.json"), "utf8");
  assert.equal(persisted.includes("OPENAI_API_KEY"), false);
}));

test("#3303 missing staged proof is refused, and wrong exact MAIN blocks before execution", () => sandbox(async root => {
  let calls = 0;
  const opts = { root, controlAuthenticated: true, engineeringEnabled: true, controlOps: {
    testHead: async () => MAIN,
    engineering: async ({ stageReceipt: stage }) => {
      calls++;
      assert.equal(stage.state, "NO_REQUEST");
      return { state: "BLOCKED", code: "ENGINEERING_STAGE_RECEIPT_INVALID", sourceHead: MAIN };
    },
  } };
  const noStage = (await rpc(selection, opts)).result.structuredContent;
  assert.equal(noStage.state, "BLOCKED");
  assert.equal(noStage.code, "ENGINEERING_STAGE_RECEIPT_INVALID");
  assert.equal(calls, 1);
  const other = { ...selection, requestId: "f".repeat(32) };
  const mismatch = (await rpc(other, { ...opts, controlOps: {
    ...opts.controlOps, testHead: async () => CANDIDATE,
  } })).result.structuredContent;
  assert.equal(mismatch.code, "EXACT_HEAD_MISMATCH");
  assert.equal(calls, 1);
}));
