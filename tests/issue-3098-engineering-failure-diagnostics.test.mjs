import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import {
  diagnoseEngineeringLocalAttempt,
} from "../scripts/engineering-diagnostics.mjs";
import {
  classifyEngineeringFailure,
  parseEngineeringCommand,
  runExplicitEngineeringCampaign,
} from "../scripts/engineering-team/run-local.mjs";
import { admitEngineeringCampaign } from "../scripts/engineering-team/contract.mjs";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);
const FAKE_PIFLAGS = {
  probePi: async () => ({ ready: true }),
  probeDurable: async () => ({ ready: false, state: "not-installed", version: "" }),
};
async function sandbox(fn) {
  const root = await mkdtemp(path.join(os.tmpdir(), "pp-eng-diagnostic-"));
  try { return await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
}
const config = () => parseEngineeringCommand([
  "--run", "--head", HEAD, "--base", BASE, "--task", "issue-3098",
  "--roles", "scout,tester,challenger", "--challenger", "cline", "--durable",
]);
const inspect = async () => ({ head: HEAD, changedPaths: ["scripts/engineering-team/run-local.mjs"] });
const campaignFor = () => admitEngineeringCampaign({
  campaignId: "eng-" + HEAD.slice(0, 12) + "-" + "a".repeat(12) + "-structured-1-cline",
  taskRef: "issue-3098", repository: "BryanHarrisScripts/PlotPickle",
  exactSha: HEAD, mode: "structured", roles: ["scout", "tester", "challenger"],
  budget: { maxRoleRuns: 3, maxMessages: 8, maxSummaryChars: 800, maxDurationMs: 1_800_000, maxCloudCostUsd: 0 },
});

test("read-only inspection reports historical generic failure as UNKNOWN instead of inventing provider cause", () => sandbox(async (root) => {
  const folder = path.join(root, "engineering-team", "runs", "1".repeat(64));
  await mkdir(folder, { recursive: true });
  await writeFile(path.join(folder, "reservation.json"), JSON.stringify({
    schemaVersion: 1, campaignId: "previous-run", exactSha: HEAD,
    scopeHash: "1".repeat(64), state: "reserved", executionMode: "durable",
  }));
  await writeFile(path.join(folder, "failure.json"), JSON.stringify({
    campaignId: "previous-run", state: "blocked", reason: "execution-or-evidence-failure",
  }));
  const before = await readFile(path.join(folder, "failure.json"), "utf8");
  const result = await diagnoseEngineeringLocalAttempt({ appRoot: root, ...FAKE_PIFLAGS });
  const after = await readFile(path.join(folder, "failure.json"), "utf8");
  assert.equal(before, after);
  assert.equal(result.status, "blocked");
  assert.equal(result.failureCode, "LEGACY_FAILURE_NOT_CLASSIFIED");
  assert.equal(result.failureStage, "unknown");
  assert.equal(result.modelInferenceExecuted, "unknown");
  assert.equal(result.replayAuthorized, false);
  assert.equal(result.nativeReadiness.managedPiDurable.state, "not-installed");
  assert.equal(result.nativeReadiness.managedPi.ready, true);
  assert.equal("reason" in result, false);
}));
test("uncommitted role marker is uncertain, saved role evidence does not prove an actual provider request", () => sandbox(async (root) => {
  const scopeHash = "2".repeat(64);
  const folder = path.join(root, "engineering-team", "runs", scopeHash);
  const steps = path.join(folder, "durable-role-artifacts");
  await mkdir(steps, { recursive: true });
  await writeFile(path.join(folder, "reservation.json"), JSON.stringify({
    schemaVersion: 1, campaignId: "provisional", exactSha: HEAD, scopeHash,
    state: "reserved", executionMode: "durable",
  }));
  await writeFile(path.join(folder, "failure.json"), JSON.stringify({
    schemaVersion: 2, code: "CLINE_RESULT_UNAVAILABLE", stage: "role-dispatch",
    role: "challenger", scopeHash, exactSha: HEAD,
  }));
  await writeFile(path.join(steps, "role-0.started.json"), "{}");
  await writeFile(path.join(steps, "role-0.json"), "{}");
  await writeFile(path.join(steps, "role-1.started.json"), "{}");
  const result = await diagnoseEngineeringLocalAttempt({ appRoot: root, ...FAKE_PIFLAGS });
  assert.equal(result.failureCode, "CLINE_RESULT_UNAVAILABLE");
  assert.equal(result.failureStage, "role-dispatch");
  assert.equal(result.failureRole, "challenger");
  assert.deepEqual(result.roleArtifacts, { startedCount: 2, savedCount: 1, uncertainCount: 1 });
  assert.equal(result.modelInferenceExecuted, "unknown");
  assert.equal(result.nextAction, "retain-uncertain-step-evidence-no-replay");
}));
test("missing reservation, irrelevant SHA and absent directory never trigger model calls", () => sandbox(async (root) => {
  let probes = 0;
  const options = { appRoot: root, probePi: async () => { probes++; return { ready: false }; },
    probeDurable: async () => { probes++; return { ready: false, state: "not-installed" }; } };
  const status = await diagnoseEngineeringLocalAttempt(options);
  assert.equal(status.status, "no-matching-attempt");
  assert.equal(status.replayAuthorized, false);
  assert.equal(probes, 2);
  await assert.rejects(diagnoseEngineeringLocalAttempt({ ...options, exactSha: "main" }), /exact SHA/);
}));
test("failure classifier permits only closed, credential-safe operational codes", () => {
  const privateError = new Error("token sk-private-from-provider; internal path C:/Users/someone/private");
  assert.deepEqual(classifyEngineeringFailure(privateError, "adapter-selection"), {
    code: "EXECUTION_FAILED_UNKNOWN", stage: "adapter-selection",
    reasonClass: "safe-operational-code-only", modelRequestState: "unknown",
    replayAuthorized: false, mergeEligible: false,
  });
  assert.equal(classifyEngineeringFailure(new Error("Engineering Durable managed Pi Durable 1.3.0 is unavailable"), "native-runtime-open").code, "PI_DURABLE_UNAVAILABLE");
  assert.equal(classifyEngineeringFailure(new Error("Cline managed CLI version is missing or differs from the reviewed pin"), "role-dispatch").code, "CLINE_VERSION_MISMATCH");
  assert.equal(classifyEngineeringFailure(Object.assign(new Error("File exists"), { code: "EEXIST" }), "role-dispatch").code, "UNCERTAIN_STEP_REPLAY_DENIED");
  assert.equal(classifyEngineeringFailure(new Error("random raw secret"), "credential-path").stage, "unknown");
});
test("failed live step persists sanitized phase and never replays reserved attempt", () => sandbox(async (root) => {
  const argv = config();
  const raw = new Error("provider private credentials should not appear: secret-oops");
  const opts = {
    appRoot: root, inspect,
    buildAdapters: async () => ({ tester: { executorId: "fixture" } }),
    driveDurable: async (_campaign, args) => {
      args.onStage("role-dispatch", "scout");
      throw raw;
    },
  };
  await assert.rejects(runExplicitEngineeringCampaign(argv, opts), /EXECUTION_FAILED_UNKNOWN.*role-dispatch.*scout/);
  const status = await diagnoseEngineeringLocalAttempt({ appRoot: root, ...FAKE_PIFLAGS });
  assert.equal(status.status, "blocked");
  assert.equal(status.failureStage, "role-dispatch");
  assert.equal(status.failureRole, "scout");
  assert.equal(status.failureCode, "EXECUTION_FAILED_UNKNOWN");
  const dir = path.join(root, "engineering-team", "runs", status.scopeHash);
  const evidence = await readFile(path.join(dir, "failure.json"), "utf8");
  assert.doesNotMatch(evidence, /provider private|secret-oops|credentials/);
  const failure = JSON.parse(evidence);
  assert.equal(failure.modelRequestState, "unknown");
  assert.equal(failure.replayAuthorized, false);
  await assert.rejects(runExplicitEngineeringCampaign(argv, opts), /EEXIST/);
}));
