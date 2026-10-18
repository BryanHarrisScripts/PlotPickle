import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import os from "node:os";
import {
  createFocusedUatEngineeringAdapter,
  createPiEngineeringReadOnlyAdapter,
} from "../scripts/engineering-team/local-adapters.mjs";

const SHA = "e".repeat(40);
const root = path.join(os.tmpdir(), "plotpickle-engineering-adapter-test", "repo");
const out = path.join(os.tmpdir(), "plotpickle-engineering-adapter-test", "evidence");
function request(role) {
  return { role, exactSha: SHA, taskRef: "pr-3098", scopeHash: "f".repeat(64), handoff: null };
}
function evidence(now, overall = "PASS", code = 0) {
  return JSON.stringify({
    mode: "contracts-only",
    generatedAt: now.toISOString(),
    overall,
    contracts: { code, failures: overall === "PASS" ? [] : [{ message: "Expected regression" }] },
  });
}
test("focused UAT actually invokes the existing contract runner and accepts fresh matching receipts only as candidates", async () => {
  const now = new Date("2026-10-18T12:00:00Z");
  let argv;
  const adapter = createFocusedUatEngineeringAdapter({
    repoRoot: root, artifactRoot: out,
    execute: async (args) => { argv = args; return { exitCode: 0, stdout: "Focused UAT PASS" }; },
    readEvidence: async () => evidence(now),
    now: () => now,
  });
  const result = await adapter.run(request("tester"));
  assert.equal(adapter.executorId, "focused-uat-contract-runner");
  assert.deepEqual(argv.slice(0, 2), ["scripts/run-uat-autopilot.mjs", "--contracts-only"]);
  assert.equal(result.state, "candidate");
  assert.equal(result.evidenceRefs.length, 1);
  assert.match(result.evidenceRefs[0], /^uat-sha256:[a-f0-9]{64}$/);
  assert.match(result.summary, /not live device\/browser proof/);
  assert.equal("verified" in result, false);
});
test("failing focused UAT is recorded as candidate, not passed or reproduced", async () => {
  const now = new Date("2026-10-18T12:00:00Z");
  const adapter = createFocusedUatEngineeringAdapter({
    repoRoot: root, artifactRoot: out,
    execute: async () => ({ exitCode: 1 }),
    readEvidence: async () => evidence(now, "FAIL", 1),
    now: () => now,
  });
  const result = await adapter.run(request("tester"));
  assert.equal(result.state, "candidate");
  assert.match(result.summary, /Focused UAT FAIL/);
});
test("stale, conflicting, and forged focused UAT receipt fails closed", async () => {
  const now = new Date("2026-10-18T12:00:00Z");
  for (const report of [
    evidence(new Date("2026-10-17T12:00:00Z")),
    evidence(now, "FAIL", 1),
    JSON.stringify({ ...JSON.parse(evidence(now)), mode: "focused-live" }),
    JSON.stringify({ ...JSON.parse(evidence(now)), contracts: { code: 1 } }),
    "not-json",
  ]) {
    const adapter = createFocusedUatEngineeringAdapter({
      repoRoot: root, artifactRoot: out,
      execute: async () => ({ exitCode: 0 }),
      readEvidence: async () => report,
      now: () => now,
    });
    await assert.rejects(adapter.run(request("tester")), /receipt|JSON|Unexpected token|not valid/);
  }
});
test("subprocess errors or unknown exits cannot be disguised as green UAT", async () => {
  for (const execute of [
    async () => { throw Error("runner unavailable"); },
    async () => ({ exitCode: -1 }),
  ]) {
    const adapter = createFocusedUatEngineeringAdapter({
      repoRoot: root, artifactRoot: out, execute,
      readEvidence: async () => evidence(new Date()),
    });
    await assert.rejects(adapter.run(request("tester")));
  }
});
test("Pi executes actual read-only API call with role, exact head, fixed tool mode and no self approval", async () => {
  let argumentsSeen;
  const adapter = createPiEngineeringReadOnlyAdapter({
    role: "challenger", repoRoot: root,
    command: "managed-pi", runtime: { model: "approved-local", baseUrl: "http://127.0.0.1:11434/v1" },
    changedPaths: ["scripts/engineering-team/execution.mjs"],
    invoke: async (args) => { argumentsSeen = args; return { stdout: "Source review completed; no independently verified issue found." }; },
  });
  const result = await adapter.run({ ...request("challenger"), handoff: {
    summary: "Earlier scout suggested that this behavior could regress.",
  } });
  assert.equal(argumentsSeen.purpose, "engineering-challenger");
  assert.equal(argumentsSeen.command, "managed-pi");
  assert.equal(argumentsSeen.cwd, root);
  assert.match(argumentsSeen.prompt, new RegExp(SHA));
  assert.match(argumentsSeen.prompt, /untrusted context only/);
  assert.match(argumentsSeen.prompt, /ONLY read, grep, find and ls/);
  assert.equal(result.state, "candidate");
  assert.equal(result.verified, undefined);
  assert.match(result.evidenceRefs[0], /^pi-output-sha256:[a-f0-9]{64}$/);
});
test("Pi missing provider, unsafe changed file, mismatched role and empty inference all block", async () => {
  const configuration = {
    role: "scout", repoRoot: root, command: "managed-pi",
    runtime: { model: "approved-local", baseUrl: "http://127.0.0.1:11434/v1" },
  };
  assert.throws(() => createPiEngineeringReadOnlyAdapter({ ...configuration, command: "" }), /missing a proved/);
  assert.throws(() => createPiEngineeringReadOnlyAdapter({ ...configuration, changedPaths: ["../secret"] }), /unsafe/);
  assert.throws(() => createPiEngineeringReadOnlyAdapter({ ...configuration, role: "repairer" }), /only Scout or Challenger/);
  const adapter = createPiEngineeringReadOnlyAdapter({ ...configuration, invoke: async () => ({ stdout: "" }) });
  await assert.rejects(adapter.run(request("scout")), /usable bounded review/);
  await assert.rejects(adapter.run(request("tester")), /role\/commit mismatch/);
});
