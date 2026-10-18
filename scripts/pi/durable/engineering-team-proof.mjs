#!/usr/bin/env node
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { admitEngineeringCampaign } from "../../engineering-team/contract.mjs";
import { createEngineeringCheckpointCallbacks } from "../../engineering-team/durable-checkpoint.mjs";
import { managedPiDurableRoot, probeManagedPiDurable } from "../../pi-durable-managed-install.mjs";
import { importPiDurableModule } from "../../../core/sidecars/pi-durable-adapter.mjs";
import { registerAgentCheckpointTasks } from "../../../core/sidecars/tasks/agent-checkpoint-task.mjs";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const head = String(execFileSync("git", ["rev-parse", "HEAD"], { cwd: repoRoot, encoding: "utf8" })).trim().toLowerCase();
if (!/^[a-f0-9]{40}$/.test(head)) throw new Error("Engineering durable proof needs an actual frozen Git checkout.");
const runtimeRoot = managedPiDurableRoot();
const ready = await probeManagedPiDurable({ root: runtimeRoot });
if (!ready.ready) throw new Error("Engineering durable native proof BLOCKED: managed Pi Durable 1.3.0 not installed; no auto-install performed.");

const directory = await mkdtemp(path.join(os.tmpdir(), "plotpickle-engineering-native-"));
let firstHarness = null;
let secondHarness = null;
try {
  const [durable, jsonl, chord, ai] = await Promise.all([
    importPiDurableModule(runtimeRoot, "@earendil-works/pi-durable"),
    importPiDurableModule(runtimeRoot, "@earendil-works/pi-durable/storage/jsonl/node"),
    importPiDurableModule(runtimeRoot, "@earendil-works/chord/context"),
    importPiDurableModule(runtimeRoot, "@earendil-works/pi-ai/models"),
  ]);
  const context = chord.BACKGROUND_CONTEXT;
  const campaign = admitEngineeringCampaign({
    campaignId: "engineering-native-checkpoint-proof",
    taskRef: "pr-3098",
    exactSha: head, repository: "BryanHarrisScripts/PlotPickle",
    mode: "lossy", roles: ["scout", "tester", "challenger"],
    budget: { maxRoleRuns: 3, maxMessages: 4, maxSummaryChars: 200, maxDurationMs: 120000, maxCloudCostUsd: 0 },
  });
  const calls = [];
  const adapters = Object.fromEntries(campaign.roles.map((role) => [role, {
    executorId: "fixture-" + role,
    routeReceipt: "native-deterministic-no-provider",
    async run() {
      calls.push(role);
      return {
        observationId: "native-" + role, findingRef: "native-fixture",
        state: "candidate",
        summary: role + " deterministic no-provider checkpoint fixture.",
        evidenceRefs: ["fixture:step-" + role],
      };
    },
  }]));
  const callbacks = createEngineeringCheckpointCallbacks(campaign, {
    runDir: directory, adapters, getExactHead: async () => head,
  });

  async function open() {
    const registry = durable.createRegistry();
    const registration = registerAgentCheckpointTasks({
      durable, authorize: callbacks.authorize,
      executeStep: callbacks.executeStep, checkpointDelayMs: 2000,
    });
    registry.install(registration.extension);
    const storage = await jsonl.openNodeJsonlStorage(path.join(directory, "native-jsonl"), context);
    const harness = await durable.Harness.open(storage, { models: ai.createModels(), registry }, context);
    return { harness, registration };
  }

  const first = await open();
  firstHarness = first.harness;
  const taskId = await first.registration.admit(await firstHarness.root(context), callbacks.input, context);
  firstHarness.resume();
  let checkpoint = null;
  for (let attempt = 0; attempt < 200; attempt++) {
    const current = await firstHarness.getTask(taskId, context);
    if (current?.state?.checkpoint?.nextIndex === 1) {
      checkpoint = current.state.checkpoint;
      break;
    }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(checkpoint?.nextIndex, 1, "Must commit exactly one source role before controlled close.");
  await firstHarness.close(context);
  firstHarness = null;

  const second = await open();
  secondHarness = second.harness;
  const reusedId = await second.registration.admit(await secondHarness.root(context), callbacks.input, context);
  assert.equal(reusedId, taskId, "Reopened JSONL must retain the same admitted checkpoint identity.");
  secondHarness.resume();
  const settled = await secondHarness.waitForTask(taskId, context);
  assert.equal(settled.state.outcome.status, "completed");
  const receipt = await callbacks.collect();
  assert.equal(receipt.status, "observed");
  assert.equal(receipt.mergeEligible, false);
  assert.deepEqual(calls, campaign.roles, "Each role must execute exactly once across JSONL close/reopen.");
  await secondHarness.close(context);
  secondHarness = null;

  const proof = {
    schemaVersion: 1, issue: 3098,
    platform: process.platform, node: process.versions.node,
    exactSha: head,
    managedPiDurable: ready.version,
    evidenceClass: "real-managed-runtime-deterministic-worker",
    controlledCloseReopen: true,
    checkpointBeforeRestart: checkpoint.nextIndex,
    sameDurableTaskId: reusedId === taskId,
    skippedPreviouslyCompletedSteps: true,
    executedRoleFixtures: calls,
    providerInference: "not-attempted",
    actualWindowsProviderIOMeasured: false,
    killedProcessRestartProven: false,
    remoteBuzzSigned: false, independentFindingVerified: false,
    mergeEligible: false,
    status: "PASS",
  };
  const target = path.join(repoRoot, ".artifacts", "engineering-durable-3098");
  await mkdir(target, { recursive: true });
  await writeFile(path.join(target, "native-jsonl-proof.json"), JSON.stringify(proof, null, 2) + "\n");
  process.stdout.write(JSON.stringify(proof, null, 2) + "\n");
} finally {
  if (firstHarness) await firstHarness.close().catch(() => {});
  if (secondHarness) await secondHarness.close().catch(() => {});
  await rm(directory, { recursive: true, force: true });
}
