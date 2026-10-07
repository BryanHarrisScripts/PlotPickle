import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { build } from "esbuild";
import { createInMemoryAuthStateStore, createPlotPickleAuthService } from "../core/auth/plotpickle-auth-core.mjs";
import { createProfilePrivateStorageService } from "../core/storage/profile-private/profile-private-storage-core.mjs";

const compiled = await build({ stdin: { contents: 'export { createOutlineTaskController } from "./build/projects/outline-task-controller.ts"; export { normalizeLibraryProject } from "./core/storage/library-project.ts";', resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", write: false, logLevel: "silent" });
const { createOutlineTaskController, normalizeLibraryProject } = await import(`data:text/javascript;base64,${Buffer.from(compiled.outputFiles[0].text).toString("base64")}`);
const output = JSON.stringify({ structural: { state: "unresolved", reason: "Synthetic evidence does not establish this turn.", passageIds: [] }, characters: [], miniBlocks: [1, 2, 3, 4].map((ordinal) => ({ ordinal, state: "unsupported", reason: "No screenplay was supplied for this synthetic block.", passageIds: [], storyboardCue: "" })) });

async function fixture(t, overrides = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-outline-controller-"));
  const authOptions = { nodeId: "synthetic-controller-2711", accessMode: "desktop-loopback", stateStore: createInMemoryAuthStateStore() };
  let auth = await createPlotPickleAuthService(authOptions);
  const password = "Synthetic controller test passphrase 2711";
  const owner = await auth.createFirstProfile({ displayName: "Synthetic controller owner", password });
  let context = owner.authContext;
  let storage = createProfilePrivateStorageService({ root, authService: auth, normalizeProject: normalizeLibraryProject });
  const project = (await storage.saveProject(context, { project: normalizeLibraryProject({ id: "synthetic-controller-project", title: "Synthetic controller material", revision: 4 }), activate: true })).project;
  let calls = 0;
  let timestamp = "2026-10-02T20:00:00.000Z";
  let usage = { inputTokens: 37, outputTokens: 53, totalTokens: 90 };
  let work = async (input) => { await input.onAssessmentUsage(usage); return output; };
  const execution = { provider: "openai", model: "synthetic-model", receipt: "opaque-compute-receipt-v1", grantedCapabilities: ["proposal-draft", "project-context-read"], tokenUpperBound: 2000, cloudCostUpperBoundUsd: 0.02, execute: async (input) => { calls++; return work(input); } };
  const options = () => ({ auth, storage, resolveExecution: async () => execution, limits: { maxAttempts: 8, maxTokens: 16000, maxCloudCostUsd: 1, timeoutMs: 600000, ...overrides }, now: () => timestamp });
  let controller = createOutlineTaskController(options());
  t.after(async () => { controller.close(); storage.close(); auth.close(); await rm(root, { recursive: true, force: true }); });
  return {
    project, execution,
    get auth() { return auth; }, get storage() { return storage; }, get context() { return context; }, get controller() { return controller; }, get calls() { return calls; },
    set usage(value) { usage = value; }, set work(value) { work = value; }, set timestamp(value) { timestamp = value; },
    async reopen() {
      controller.close(); storage.close(); auth.close();
      auth = await createPlotPickleAuthService(authOptions);
      context = (await auth.authenticate({ profileId: owner.profile.profileId, password })).authContext;
      storage = createProfilePrivateStorageService({ root, authService: auth, normalizeProject: normalizeLibraryProject });
      assert.equal(await storage.loadActiveProject(context), null, "A new login does not select the previous story.");
      // Model the Human explicitly reopening the approved story before resuming its task.
      await storage.activateProject(context, project.id);
      controller = createOutlineTaskController(options());
    },
    async create(blocks = [1, 2]) { return controller.create(context, blocks); },
  };
}

test("protected controller reopen requires explicit activation and reuses committed proposals without inference", async (t) => {
  const f = await fixture(t);
  const task = await f.create();
  assert.equal(f.calls, 0);
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0]), /explicit Human/);
  await f.controller.activate(f.context, task.scope.runId);
  const first = await f.controller.executeStep(task.scope, task.steps[0]);
  assert.equal(f.calls, 1);
  await f.reopen();
  const recovered = await f.controller.status(f.context, task.scope.runId);
  assert.equal(recovered.resumeRequired, true);
  assert.equal(recovered.proposals.length, 1);
  assert.equal(recovered.run.usage.attempts, 1);
  assert.equal(recovered.run.usage.tokens, 2000);
  assert.equal(recovered.accounting.reservedCloudCostUsd, 0.02);
  await assert.rejects(f.controller.authorize(task.scope, task.steps[1]), /explicit Human/);
  assert.equal(f.calls, 1, "Reading recovered status must never invoke the provider.");
  await f.controller.activate(f.context, task.scope.runId);
  assert.deepEqual(await f.controller.executeStep(task.scope, task.steps[0]), first);
  assert.equal(f.calls, 1, "Protected artifact persisted before Pi commit must skip a second provider call.");
  await f.controller.executeStep(task.scope, task.steps[1]);
  const finished = await f.controller.finish(f.context, task.scope.runId);
  assert.equal(f.calls, 2);
  assert.equal(finished.run.state, "waiting-for-writer");
  assert.ok(finished.run.artifacts.every((artifact) => artifact.canonical === false));
  assert.deepEqual(await f.storage.loadActiveProject(f.context), f.project, "Controller never writes accepted project material.");
});

test("cancel during inference is responsive, durable, and denies late admission", async (t) => {
  const f = await fixture(t);
  const task = await f.create();
  await f.controller.activate(f.context, task.scope.runId);
  let complete;
  let entered;
  const began = new Promise((resolve) => { entered = resolve; });
  f.work = async (input) => { entered(input); await new Promise((resolve) => { complete = resolve; }); await input.onAssessmentUsage({ totalTokens: 90 }); return output; };
  const pending = f.controller.executeStep(task.scope, task.steps[0]);
  const request = await began;
  await f.controller.cancel(f.context, task.scope.runId);
  assert.equal(request.signal.aborted, true);
  complete();
  await assert.rejects(pending, /cancel/i);
  await f.reopen();
  const recovered = await f.controller.status(f.context, task.scope.runId);
  assert.equal(recovered.run.state, "cancelled");
  assert.equal(recovered.proposals.length, 0);
  assert.equal(recovered.run.usage.attempts, 1);
  await assert.rejects(f.controller.activate(f.context, task.scope.runId), /cancelled/);
});

test("duplicate concurrent activation and worker callbacks cannot double-charge or duplicate inference", async (t) => {
  const f = await fixture(t);
  const task = await f.create();
  await Promise.all([f.controller.activate(f.context, task.scope.runId), f.controller.activate(f.context, task.scope.runId)]);
  let complete; let entered;
  const began = new Promise((resolve) => { entered = resolve; });
  f.work = async (input) => { entered(); await new Promise((resolve) => { complete = resolve; }); await input.onAssessmentUsage({ totalTokens: 90 }); return output; };
  const first = f.controller.executeStep(task.scope, task.steps[0]);
  await began;
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0]), /already executing/);
  complete(); await first;
  assert.equal(f.calls, 1);
  assert.equal((await f.controller.status(f.context, task.scope.runId)).run.usage.attempts, 1);
});

test("changed material, active project, compute or grants deny resumed work before inference", async (t) => {
  const f = await fixture(t);
  const task = await f.create();
  f.execution.receipt = "changed-compute";
  await assert.rejects(f.controller.activate(f.context, task.scope.runId), /compute or grants changed/);
  f.execution.receipt = task.computeReceipt;
  f.execution.grantedCapabilities.push("publish-playhouse");
  await assert.rejects(f.controller.activate(f.context, task.scope.runId), /compute or grants changed/);
  f.execution.grantedCapabilities.pop();
  await f.storage.saveProject(f.context, { project: { ...f.project, id: "another-project" }, activate: true });
  await assert.rejects(f.controller.activate(f.context, task.scope.runId), /approved active project/);
  await f.storage.saveProject(f.context, { project: { ...f.project, title: "Changed writer material" }, activate: true });
  await assert.rejects(f.controller.activate(f.context, task.scope.runId), /material is stale/);
  assert.equal(f.calls, 0);
});

test("context changes while worker runs deny the proposal even when usage is reported", async (t) => {
  const f = await fixture(t);
  const task = await f.create();
  await f.controller.activate(f.context, task.scope.runId);
  f.work = async (input) => { await input.onAssessmentUsage({ totalTokens: 90 }); f.execution.model = "new-model"; return output; };
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0]), /compute or grants changed/);
  const status = await f.controller.status(f.context, task.scope.runId);
  assert.equal(status.proposals.length, 0);
  assert.equal(status.run.usage.attempts, 1);
});

test("own advisory history and revision updates do not invalidate approved material", async (t) => {
  const f = await fixture(t);
  const task = await f.create();
  await f.storage.saveProject(f.context, { project: { ...f.project, revision: 8, updatedAt: "2026-10-02T20:01:00.000Z", sourceEvidence: { ...f.project.sourceEvidence, outlineAssessments: [], outlineAssessmentRuns: [] } }, activate: true });
  await f.controller.activate(f.context, task.scope.runId);
  await f.controller.executeStep(task.scope, task.steps[0]);
  assert.equal(f.calls, 1);
});

test("another profile and locked owner cannot read, resume or cancel protected tasks", async (t) => {
  const f = await fixture(t);
  const task = await f.create();
  const other = await f.auth.createProfile({ displayName: "Synthetic second profile", password: "Synthetic other profile passphrase 2711" }, f.context);
  await assert.rejects(f.controller.status(other.authContext, task.scope.runId), /not found/);
  await assert.rejects(f.controller.activate(other.authContext, task.scope.runId), /not found/);
  await assert.rejects(f.controller.cancel(other.authContext, task.scope.runId), /not found/);
  await f.controller.activate(f.context, task.scope.runId);
  f.auth.lock(f.context);
  await assert.rejects(f.controller.status(f.context, task.scope.runId));
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0]), /explicit Human/);
  assert.equal(f.calls, 0);
});

test("unknown usage and interrupted inference retain reservations across reopen", async (t) => {
  const f = await fixture(t);
  const task = await f.create();
  await f.controller.activate(f.context, task.scope.runId);
  f.work = async () => { throw new Error("Synthetic interrupted inference"); };
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0]), /interrupted/);
  await f.reopen();
  await f.controller.activate(f.context, task.scope.runId);
  f.work = async (input) => { await input.onAssessmentUsage({}); return output; };
  await f.controller.executeStep(task.scope, task.steps[0]);
  const status = await f.controller.status(f.context, task.scope.runId);
  assert.equal(status.run.usage.attempts, 2);
  assert.equal(status.accounting.reservedTokens, 4000);
  assert.equal(status.accounting.reservedCloudCostUsd, 0.04);
  assert.equal(status.accounting.unknownAttempts, 2);
  assert.equal(status.accounting.cloudCostIsUpperBound, true);
});

test("exhausted attempts cannot reset on resume; final permitted result may be admitted", async (t) => {
  const f = await fixture(t, { maxAttempts: 1 });
  const task = await f.create([1]);
  await f.controller.activate(f.context, task.scope.runId);
  await f.controller.executeStep(task.scope, task.steps[0]);
  assert.equal((await f.controller.authorize(task.scope, task.steps[0])).budgetAvailable, true);
  await f.reopen();
  await f.controller.activate(f.context, task.scope.runId);
  await f.controller.executeStep(task.scope, task.steps[0]);
  assert.equal(f.calls, 1);
  await f.controller.finish(f.context, task.scope.runId);
});

test("unknown cloud quote, token/cost exhaustion and timeout deny inference", async (t) => {
  const f = await fixture(t, { maxTokens: 1000, maxCloudCostUsd: 0 });
  const task = await f.create();
  await f.controller.activate(f.context, task.scope.runId);
  f.execution.cloudCostUpperBoundUsd = null;
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0]), /bounded host token\/cost quote/);
  f.execution.cloudCostUpperBoundUsd = 0.02;
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0]), /bounded host token\/cost quote/);
  f.timestamp = "2026-10-02T21:00:00.000Z";
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0]), /budget is exhausted/);
  assert.equal(f.calls, 0);
});

test("invalid or absent accounting and unsupported citations cannot admit proposals", async (t) => {
  const f = await fixture(t);
  const task = await f.create();
  await f.controller.activate(f.context, task.scope.runId);
  f.usage = { totalTokens: 5000 };
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0]), /exceeds or contradicts/);
  f.work = async () => output;
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0]), /did not persist usage/);
  f.work = async (input) => { await input.onAssessmentUsage({ totalTokens: 90 }); return output.replace('"passageIds":[]', '"passageIds":["unsupplied-passage"]'); };
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0]), /outside this Block/);
  assert.equal((await f.controller.status(f.context, task.scope.runId)).proposals.length, 0);
});

test("corrupt protected accounting, forged callback scope and reordered steps fail closed", async (t) => {
  const f = await fixture(t);
  const task = await f.create();
  await f.controller.activate(f.context, task.scope.runId);
  await assert.rejects(f.controller.executeStep({ ...task.scope, projectId: "forged" }, task.steps[0]), /scope or step mismatch/);
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[1]), /step order mismatch/);
  const corrupt = structuredClone(task);
  corrupt.run.usage.attempts = 9;
  await f.storage.writePrivateJson(f.context, { domain: "projects", objectId: task.scope.runId, value: corrupt });
  await assert.rejects(f.controller.status(f.context, task.scope.runId), /accounting/);
  assert.equal(f.calls, 0);
});

test("scheduler cancellation reaches the worker and cannot admit a late proposal", async (t) => {
  const f = await fixture(t);
  const task = await f.create();
  await f.controller.activate(f.context, task.scope.runId);
  const cancellation = new AbortController();
  cancellation.abort(new Error("Synthetic scheduler closed"));
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0], { abortSignal: cancellation.signal }), /scheduler closed/);
  assert.equal(f.calls, 0);
  assert.equal((await f.controller.status(f.context, task.scope.runId)).run.usage.attempts, 0);
  const active = new AbortController();
  f.work = async (input) => { await input.onAssessmentUsage({ totalTokens: 90 }); active.abort(new Error("Synthetic scheduler closed during inference")); assert.equal(input.signal.aborted, true); return output; };
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0], { abortSignal: active.signal }), /closed during inference/);
  assert.equal((await f.controller.status(f.context, task.scope.runId)).proposals.length, 0);
});

test("interrupted final attempt remains spent and resume cannot replenish it", async (t) => {
  const f = await fixture(t, { maxAttempts: 1 });
  const task = await f.create([1]);
  await f.controller.activate(f.context, task.scope.runId);
  f.work = async () => { throw new Error("Synthetic provider connection lost"); };
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0]), /connection lost/);
  await f.reopen();
  await assert.rejects(f.controller.activate(f.context, task.scope.runId), /budget is exhausted/);
  const status = await f.controller.status(f.context, task.scope.runId);
  assert.equal(status.run.usage.attempts, 1);
  assert.equal(status.run.usage.tokens, 2000);
  assert.equal(status.accounting.unknownAttempts, 1);
  assert.equal(f.calls, 1);
});
