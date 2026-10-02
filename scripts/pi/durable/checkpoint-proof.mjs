#!/usr/bin/env node
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { ensureManagedPiDurableInstalled } from "../../pi-durable-managed-install.mjs";
import { importPiDurableModule } from "../../../core/sidecars/pi-durable-adapter.mjs";
import { registerAgentCheckpointTasks } from "../../../core/sidecars/tasks/agent-checkpoint-task.mjs";

const directory = await mkdtemp(path.join(os.tmpdir(), "plotpickle-agent-checkpoint-"));
let harness;
let context;
let cleanupContext;
const originalFetch = globalThis.fetch;
try {
  const installed = await ensureManagedPiDurableInstalled({ home: process.env.PLOTPICKLE_CHECKPOINT_PROOF_HOME || directory });
  let providerRequests = 0;
  globalThis.fetch = async () => { providerRequests++; throw new Error("Checkpoint proof must issue no provider request."); };
  const [durable, storage, chord, ai] = await Promise.all([
    importPiDurableModule(installed.root, "@earendil-works/pi-durable"),
    importPiDurableModule(installed.root, "@earendil-works/pi-durable/storage/jsonl/node"),
    importPiDurableModule(installed.root, "@earendil-works/chord/context"),
    importPiDurableModule(installed.root, "@earendil-works/pi-ai/models"),
  ]);
  cleanupContext = chord.BACKGROUND_CONTEXT;
  context = chord.withAbortSignal(AbortSignal.timeout(30_000), cleanupContext);
  const scope = { humanProfileId: "fixture-writer", projectId: "fixture-project", projectRevision: "fixture-rev-1", agentProfileId: "elowen-mapweaver", roleId: "story-architect", runId: "fixture-run", objectiveRevision: 1, contextReceipt: "fixture-context-1", provider: "local", model: "fixture-only", humanApprovalRef: "fixture-human-task", grantedCapabilities: ["project-context-read", "proposal-draft"] };
  const input = { scope, steps: [1, 2, 3].map((n) => ({ id: `block-${n}`, kind: "review", replayPolicy: "safe" })) };
  const calls = [];
  let allowed = true;
  const registry = durable.createRegistry();
  const registration = registerAgentCheckpointTasks({
    durable,
    checkpointDelayMs: 1000,
    authorize: async (expected) => ({ scope: expected, state: allowed ? "working" : "cancelled", budgetAvailable: true }),
    executeStep: async (_scope, step) => { calls.push(step.id); return { artifactRef: `responsibility-artifact:fixture-${step.id}` }; },
  });
  registry.install(registration.extension);
  const open = async () => durable.Harness.open(await storage.openNodeJsonlStorage(path.join(directory, "state"), context), { models: ai.createModels(), registry }, context);
  harness = await open();
  const root = await harness.root(context);
  const [id, duplicate] = await Promise.all([registration.admit(root, input, context), registration.admit(root, input, context)]);
  assert.equal(duplicate, id, "Repeated admission must reuse the original Pi task.");
  harness.resume();
  let checkpoint;
  for (let attempt = 0; attempt < 150; attempt++) {
    const current = await harness.getTask(id, context);
    if (current?.state.checkpoint?.nextIndex === 1) { checkpoint = current.state.checkpoint; break; }
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  assert.equal(checkpoint?.nextIndex, 1, "First completed block must be durable before close.");
  await harness.close(context);
  harness = await open();
  assert.equal(await registration.admit(await harness.root(context), input, context), id, "Admission identity must survive real JSONL reopen.");
  const recovered = await harness.waitForTask(id, context);
  assert.equal(recovered.state.outcome.status, "completed");
  assert.deepEqual(calls, ["block-1", "block-2", "block-3"]);
  assert.equal(recovered.state.outcome.result.artifacts.length, 3);
  assert.equal(recovered.state.outcome.result.canApproveCanon, false);
  assert.equal(recovered.state.outcome.result.canMergeCode, false);
  assert.equal(recovered.state.outcome.result.canonical, false);
  await harness.close(context);
  harness = await open();
  // A different project receives a different durable task identity; cancelling
  // its host run must prevent any worker step from running.
  const isolated = await registration.admit(await harness.root(context), { ...input, scope: { ...scope, projectId: "fixture-other-project" } }, context);
  assert.notEqual(isolated, id);
  allowed = false;
  const denied = await harness.waitForTask(isolated, context);
  assert.notEqual(denied.state.outcome.status, "completed");
  assert.deepEqual(calls, ["block-1", "block-2", "block-3"]);
  assert.equal(providerRequests, 0);
  await harness.close(context);
  harness = null;
  const report = { issue: 2709, sourceHead: process.env.PLOTPICKLE_PROOF_SOURCE_HEAD || process.env.GITHUB_SHA || "local", platform: process.platform, package: "@earendil-works/pi-durable@1.0.0", status: "PASS", checkpointBeforeRestart: checkpoint.nextIndex, completedSteps: calls, admissionReusedAfterReopen: true, isolatedCancellationDenied: true, providerRequests: 0, liveMastraExecution: "UNPROVEN", productRecovery: "UNPROVEN" };
  const reportRoot = path.resolve(".artifacts", "agent-checkpoint-2709");
  await mkdir(reportRoot, { recursive: true });
  await writeFile(path.join(reportRoot, "proof.json"), JSON.stringify(report, null, 2) + "\n");
  console.log(JSON.stringify(report));
} finally {
  globalThis.fetch = originalFetch;
  if (harness) await harness.close(cleanupContext);
  await rm(directory, { recursive: true, force: true });
}
