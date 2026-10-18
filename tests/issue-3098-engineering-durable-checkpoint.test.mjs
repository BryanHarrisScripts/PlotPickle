import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { admitEngineeringCampaign } from "../scripts/engineering-team/contract.mjs";
import { createPiEngineeringReadOnlyAdapter, createFocusedUatEngineeringAdapter } from "../scripts/engineering-team/local-adapters.mjs";
import {
  createEngineeringCheckpointCallbacks,
  driveEngineeringDurableCheckpoint,
} from "../scripts/engineering-team/durable-checkpoint.mjs";
import {
  parseEngineeringCommand, runExplicitEngineeringCampaign,
} from "../scripts/engineering-team/run-local.mjs";

const HEAD = "d".repeat(40);
const BASE = "a".repeat(40);
function campaign() {
  return admitEngineeringCampaign({
    campaignId: "durable-eng-3098",
    taskRef: "pr-3098",
    repository: "BryanHarrisScripts/PlotPickle",
    exactSha: HEAD,
    mode: "lossy",
    roles: ["scout", "tester", "challenger"],
    budget: { maxRoleRuns: 3, maxMessages: 4, maxSummaryChars: 250, maxDurationMs: 60000, maxCloudCostUsd: 0 },
  });
}
function adapters(calls) {
  return Object.fromEntries(["scout", "tester", "challenger"].map((role) => [role, {
    executorId: "independent-" + role,
    routeReceipt: "fixture-readonly-model-v1",
    async run(request) {
      calls.push({ role, request });
      return {
        observationId: "obs-" + role,
        findingRef: "finding-3098",
        state: "candidate",
        summary: role + " advisory analysis, not verified or mergeable.",
        evidenceRefs: ["evidence:contract-" + role],
        verified: true,
        mergeEligible: true,
      };
    },
  }]));
}
function dirTest(fn) {
  return async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-engineering-durable-"));
    try { await fn(root); } finally { await rm(root, { recursive: true, force: true }); }
  };
}
test("checkpoint callbacks enforce exact commit and replay-safe advisory roles", dirTest(async (runDir) => {
  const team = campaign(), calls = [];
  const handler = createEngineeringCheckpointCallbacks(team, {
    runDir, adapters: adapters(calls), getExactHead: async () => HEAD,
  });
  const { scope, steps } = handler.input;
  assert.deepEqual(steps.map((step) => step.kind), ["review", "review", "review"]);
  assert.ok(steps.every((step) => step.replayPolicy === "safe"));
  assert.equal((await handler.authorize(scope, steps[0])).state, "working");
  for (const step of steps) {
    const item = await handler.executeStep(scope, step);
    assert.match(item.artifactRef, /^responsibility-artifact:engineering-/);
  }
  const receipt = await handler.collect();
  assert.equal(receipt.status, "observed");
  assert.equal(receipt.verified, false);
  assert.equal(receipt.mergeEligible, false);
  assert.equal(receipt.observations.length, 3);
  assert.equal(receipt.handoffs.length, 2);
  assert.equal(receipt.handoffs[0].communicationMode, "lossy");
  assert.deepEqual(receipt.handoffs[0].evidenceRefs, []);
  assert.ok(calls.every(({ request }) => !request.permissions.sourceMutationAllowed && !request.permissions.mergeAllowed));
  assert.equal(calls.length, 3);
  const reopened = createEngineeringCheckpointCallbacks(team, {
    runDir, adapters: adapters(calls), getExactHead: async () => HEAD,
  });
  for (const step of reopened.input.steps) await reopened.executeStep(reopened.input.scope, step);
  assert.equal(calls.length, 3, "saved artifacts must not re-invoke model/test callbacks after reopen");
  const file = JSON.parse(await readFile(path.join(runDir, "durable-role-artifacts", "role-1.json"), "utf8"));
  assert.equal(file.verified, false);
  assert.equal(file.mergeEligible, undefined);
}));
test("ambiguous interrupted step refuses a second model invocation", dirTest(async (runDir) => {
  const team = campaign(), calls = [];
  const failing = adapters(calls);
  failing.scout.run = async () => {
    calls.push({ role: "scout" });
    throw new Error("simulated model process crash after submission");
  };
  const one = createEngineeringCheckpointCallbacks(team, {
    runDir, adapters: failing, getExactHead: async () => HEAD,
  });
  await assert.rejects(one.executeStep(one.input.scope, one.input.steps[0]), /simulated model process crash/);
  const reopened = createEngineeringCheckpointCallbacks(team, {
    runDir, adapters: failing, getExactHead: async () => HEAD,
  });
  await assert.rejects(reopened.executeStep(reopened.input.scope, reopened.input.steps[0]), /EEXIST/);
  assert.equal(calls.length, 1, "unknown first provider outcome cannot silently replay");
  assert.equal((await reopened.collect()).status, "blocked");
}));
test("moving SHA, cancellation, route change and scope escalation reject recovery", dirTest(async (runDir) => {
  const team = campaign(), calls = [];
  let head = HEAD;
  const handler = createEngineeringCheckpointCallbacks(team, {
    runDir, adapters: adapters(calls), getExactHead: async () => head,
  });
  const { scope, steps } = handler.input;
  head = "b".repeat(40);
  await assert.rejects(handler.authorize(scope, steps[0]), /head changed/);
  await assert.rejects(handler.executeStep(scope, steps[0]), /head changed/);
  head = HEAD;
  await assert.rejects(handler.executeStep({ ...scope, projectRevision: "other" }, steps[0]), /scope changed/);
  await handler.executeStep(scope, steps[0]);
  const changed = adapters(calls);
  changed.scout.routeReceipt = "different-local-model-route";
  const reopened = createEngineeringCheckpointCallbacks(team, { runDir, adapters: changed, getExactHead: async () => HEAD });
  await assert.rejects(reopened.executeStep(reopened.input.scope, reopened.input.steps[0]), /scope\/route validation/);
  const controller = new AbortController();
  controller.abort();
  const denied = createEngineeringCheckpointCallbacks(team, { runDir, adapters: adapters(calls), getExactHead: async () => HEAD, signal: controller.signal });
  await assert.rejects(denied.authorize(denied.input.scope, denied.input.steps[0]), /cancelled/);
}));
test("native scheduler seam admits, resumes, awaits completion and closes, never self-verifies", dirTest(async (runDir) => {
  const calls = [], team = campaign();
  let admitted = 0, resumed = 0, closed = 0;
  const output = await driveEngineeringDurableCheckpoint(team, {
    runDir, adapters: adapters(calls), getExactHead: async () => HEAD,
    openRuntime: async (callbacks) => ({
      context: {},
      registration: { admit: async () => { admitted++; return "durable-fixture-task"; } },
      harness: {
        root: async () => ({ id: "root" }),
        resume: async () => { resumed++; },
        waitForTask: async () => {
          for (const step of callbacks.input.steps) await callbacks.executeStep(callbacks.input.scope, step);
          return { state: { outcome: { status: "completed" } } };
        },
        close: async () => { closed++; },
      },
    }),
  });
  assert.equal(output.status, "observed");
  assert.equal(output.durableCheckpointAdmitted, true);
  assert.equal(output.durableRecoveryProven, false);
  assert.equal(output.verified, false);
  assert.equal(output.mergeEligible, false);
  assert.deepEqual([admitted, resumed, closed, calls.length], [1, 1, 1, 3]);
}));
test("non-completed task outcome closes durable scheduler and blocks promotion", dirTest(async (runDir) => {
  let closed = false;
  const team = campaign();
  await assert.rejects(driveEngineeringDurableCheckpoint(team, {
    runDir, adapters: adapters([]), getExactHead: async () => HEAD,
    openRuntime: async () => ({
      context: {},
      registration: { admit: async () => "task" },
      harness: { root: async () => ({}), resume: async () => {}, waitForTask: async () => ({ state: { outcome: { status: "faulted" } } }), close: async () => { closed = true; } },
    }),
  }), /did not finish/);
  assert.equal(closed, true);
}));
test("explicit --durable/--resume reuse same attempt only after prior reservation", dirTest(async (appRoot) => {
  const calls = [], config = parseEngineeringCommand([
    "--run", "--head", HEAD, "--base", BASE,
    "--task", "pr-3098", "--roles", "tester,challenger",
    "--durable",
  ]);
  assert.equal(config.durable, true);
  assert.equal(config.resume, false);
  assert.throws(() => parseEngineeringCommand(["--run", "--head", HEAD, "--base", BASE, "--task", "pr-3098", "--resume"]), /requires --durable/);
  const base = {
    appRoot, inspect: async () => ({ head: HEAD, changedPaths: [] }),
    getExactHead: async () => HEAD,
    buildAdapters: async () => ({ tester: adapters(calls).tester, challenger: adapters(calls).challenger }),
  };
  const result = await runExplicitEngineeringCampaign(config, {
    ...base, driveDurable: async (team, settings) => {
      calls.push({ step: "admitted" });
      assert.ok(path.isAbsolute(settings.runDir));
      return {
        schemaVersion: 1, campaignId: team.campaignId, exactSha: team.exactSha,
        scopeHash: team.scopeHash, status: "blocked",
        roleResults: [], observations: [], handoffs: [],
        verified: false, mergeEligible: false, durableCheckpointAdmitted: true,
      };
    },
  });
  assert.equal(result.receipt.durableCheckpointAdmitted, true);
  await assert.rejects(runExplicitEngineeringCampaign(config, base), /EEXIST/);
  const resumable = parseEngineeringCommand([
    "--run", "--head", HEAD, "--base", BASE, "--task", "pr-3098",
    "--roles", "tester,challenger", "--durable", "--resume",
  ]);
  await assert.rejects(runExplicitEngineeringCampaign(resumable, base), /completed attempt cannot be resumed/);
  assert.equal(calls.filter((x) => x.step === "admitted").length, 1);
}));

test("real adapter route receipt changes with local Pi model, endpoint or executable", () => {
  const root = path.join(os.tmpdir(), "engineering-adapter-identity-repo");
  const base = {
    role: "scout", repoRoot: root, command: "managed-pi.exe",
    runtime: { model: "model-one", baseUrl: "http://127.0.0.1:11434/v1" },
    invoke: async () => ({ stdout: "Source grounded advisory finding, no verification claim." }),
  };
  const original = createPiEngineeringReadOnlyAdapter(base);
  assert.match(original.routeReceipt, /^[a-f0-9]{64}$/);
  const model = createPiEngineeringReadOnlyAdapter({ ...base, runtime: { ...base.runtime, model: "model-two" } });
  const endpoint = createPiEngineeringReadOnlyAdapter({ ...base, runtime: { ...base.runtime, baseUrl: "http://localhost:8080/v1" } });
  const executable = createPiEngineeringReadOnlyAdapter({ ...base, command: "another-pi.exe" });
  assert.notEqual(original.routeReceipt, model.routeReceipt);
  assert.notEqual(original.routeReceipt, endpoint.routeReceipt);
  assert.notEqual(original.routeReceipt, executable.routeReceipt);
  const uat = createFocusedUatEngineeringAdapter({
    repoRoot: root, artifactRoot: path.join(os.tmpdir(), "engineering-adapter-identity-artifact"),
    execute: async () => ({ exitCode: 0 }),
  });
  assert.match(uat.routeReceipt, /^[a-f0-9]{64}$/);
  assert.notEqual(uat.routeReceipt, original.routeReceipt);
});
