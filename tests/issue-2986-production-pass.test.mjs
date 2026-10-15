import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import { createInMemoryAuthStateStore, createPlotPickleAuthService } from "../core/auth/plotpickle-auth-core.mjs";
import { createProfilePrivateStorageService } from "../core/storage/profile-private/profile-private-storage-core.mjs";
import { createServerSessionBoundary } from "../core/auth/server-session/server-session-boundary-core.mjs";

const compiledRoot = await mkdtemp(path.resolve("node_modules/.production-pass-2986-"));
await build({ stdin: { contents: `
export { createOutlineTaskController } from "./build/projects/outline-task-controller.ts";
export { createOutlineTaskGateway } from "./build/projects/outline-task-gateway.ts";
export { createOutlineTaskHttpHandlers } from "./build/projects/outline-task-http.ts";
export { normalizeLibraryProject } from "./core/storage/library-project.ts";
export { outlineAssessmentMaterialReceipt } from "./modules/plan/outline-agent-assessment.ts";
export { validateProductionFidelity, PRODUCTION_FIDELITY_DIMENSIONS } from "./modules/plan/assessments/outline-production-pass.ts";
`, resolveDir: process.cwd(), loader: "ts" }, bundle: true, platform: "node", format: "esm", packages: "external", outfile: path.join(compiledRoot, "fixture.mjs"), logLevel: "silent" });
const { createOutlineTaskController, createOutlineTaskGateway, createOutlineTaskHttpHandlers, normalizeLibraryProject, outlineAssessmentMaterialReceipt, PRODUCTION_FIDELITY_DIMENSIONS } = await import(pathToFileURL(path.join(compiledRoot, "fixture.mjs")).href);
test.after(() => rm(compiledRoot, { recursive: true, force: true }));
const passages = [1,2,3,4].flatMap(n => [
  { id: `action-${n}`, type: "action", text: `The courier reaches door ${n}.`, blockNumber: 1, miniBlockNumber: n, sceneNumber: n },
  { id: `dialogue-${n}`, type: "dialogue", text: `This is door ${n}.`, blockNumber: 1, miniBlockNumber: n, sceneNumber: n },
]);
const assessment = { structural: { state: "covered", reason: "The courier crosses the four supplied thresholds in source order.", passageIds: ["action-1"] }, characters: [],
  miniBlocks: [1,2,3,4].map(ordinal => ({ ordinal, state: "supported", reason: "The supplied doorway action and exact dialogue support this movement.", passageIds: [`action-${ordinal}`], storyboardCue: `How does the courier approach door ${ordinal}?` })) };
function fidelity(state = "supported") {
  return { findings: PRODUCTION_FIDELITY_DIMENSIONS.map(dimension => ({ dimension, state, reason: "The supplied courier passages preserve the doorway order and quoted speech.", passageIds: dimension === "coverage" ? passages.map(p => p.id) : ["action-1", "dialogue-1"] })) };
}
async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-production-2986-"));
  const auth = await createPlotPickleAuthService({ nodeId: "production-fixture", accessMode: "desktop-loopback", stateStore: createInMemoryAuthStateStore() });
  const owner = await auth.createFirstProfile({ displayName: "Synthetic writer", password: "Synthetic production pass password 2986" });
  const context = owner.authContext;
  const storage = { ...createProfilePrivateStorageService({ root, authService: auth, normalizeProject: normalizeLibraryProject }) };
  const project = normalizeLibraryProject({ id: "production-fixture-project", title: "Synthetic Courier", revision: 4,
    sourceEvidence: { screenplay: { sourceFileName: "synthetic.fdx", sourceFormat: "Final Draft", importedAt: "2026-10-14T00:00:00Z", analysisStatus: "suggested", totalPassageCount: 8, storedPassageCount: 8, passagesTruncated: false, passages } } });
  await storage.saveProject(context, { project, activate: true });
  let calls = 0;
  let second = fidelity();
  let first = structuredClone(assessment);
  let clock = "2026-10-14T00:00:00Z";
  let intercept = async () => {};
  const inputs = [];
  const execution = { provider: "local", model: "synthetic-review-model", receipt: "local-route-2986", grantedCapabilities: ["proposal-draft", "project-context-read"], tokenUpperBound: 2000, cloudCostUpperBoundUsd: 0,
    execute: async input => { calls++; inputs.push(input.message); await intercept(calls); input.signal.throwIfAborted(); await input.onAssessmentUsage({ totalTokens: 100 }); return JSON.stringify(calls === 1 ? first : second); } };
  const options = { auth, storage, resolveExecution: async () => execution, limits: { maxAttempts: 12, maxTokens: 16000, maxCloudCostUsd: 12, timeoutMs: 600000, maxContextCharacters: 12000 }, now: () => clock };
  let controller = createOutlineTaskController(options);
  t.after(async () => { controller.close(); storage.close(); auth.close(); await rm(root, { recursive: true, force: true }); });
  return { project, auth, context, storage, execution, inputs, root,
    get controller() { return controller; }, get calls() { return calls; },
    set second(v) { second = v; }, set first(v) { first = v; }, set intercept(v) { intercept = v; }, set clock(v) { clock = v; },
    async start() { const record = await controller.create(context, [1], true); await controller.activate(context, record.scope.runId); return record; },
    reopen() { controller.close(); controller = createOutlineTaskController(options); },
  };
}

test("#2986 scoped grant executes assessment then separate semantic review and persists source-linked candidate without canon mutation", async t => {
  const f = await fixture(t), task = await f.start();
  assert.equal(task.productionPass.grant.cloudCostLimitUsd, 0);
  assert.equal(task.run.limits.maxAttempts, 2);
  await f.controller.executeStep(task.scope, task.steps[0]);
  const done = await f.controller.finish(f.context, task.scope.runId);
  assert.equal(f.calls, 2);
  assert.match(f.inputs[1], /Independently review/);
  assert.match(f.inputs[1], /How does the courier approach door 1/);
  const packet = done.productionPass.candidate;
  assert.equal(packet.canonical, false); assert.equal(packet.mediaSpendAuthorized, false);
  assert.equal(packet.findings.length, 7); assert.equal(packet.miniBlocks.length, 4);
  assert.deepEqual(packet.miniBlocks.flatMap(m => m.passageIds), passages.map(p => p.id));
  assert.deepEqual(packet.miniBlocks.flatMap(m => m.dialoguePassageIds), passages.filter(p => p.type === "dialogue").map(p => p.id));
  assert.equal(packet.timing, "derive-from-action-and-dialogue");
  assert.equal(done.run.state, "waiting-for-writer");
  assert.deepEqual(await f.storage.loadActiveProject(f.context), f.project);
  const reopened = await f.controller.create(f.context, [1], true);
  assert.equal(reopened.scope.runId, task.scope.runId, "repeat start reuses completed candidate");
  f.reopen();
  const saved = await f.controller.status(f.context, task.scope.runId);
  assert.deepEqual(saved.productionPass.candidate, packet); assert.equal(f.calls, 2);
});

test("#2986 production POST uses real auth/CSRF gateway, auto-handoff and durable candidate status", async t => {
  const f = await fixture(t);
  const origin = "http://127.0.0.1:3000";
  const boundary = createServerSessionBoundary({ authService: f.auth, exposure: { accessMode: "desktop-loopback", externalOrigin: origin, allowedOrigins: [origin], allowedHosts: ["127.0.0.1:3000"] } });
  const session = f.auth.createBrowserSession(f.context, { deviceLabel: "Synthetic production", originLabel: origin });
  const runtime = { auth: f.auth, privateStorage: f.storage, home: f.root, boundaryFor: () => boundary };
  const gateway = createOutlineTaskGateway(runtime, { resolveExecution: async () => f.execution,
    openScheduler: async (_id, controller) => ({ async run(input) { for (const step of input.steps) { await controller.authorize(input.scope, step); await controller.executeStep(input.scope, step); } return true; }, async close() {} }) });
  t.after(() => gateway.close());
  const http = createOutlineTaskHttpHandlers(async () => runtime, () => gateway);
  const request = (body, csrf = true) => new Request(origin + "/api/outline/tasks", { method: "POST", headers: { host: "127.0.0.1:3000", origin, cookie: "ppsid=" + session.cookieValue, "Content-Type": "application/json", ...(csrf ? { "X-PlotPickle-CSRF": session.csrfToken } : {}) }, body: JSON.stringify(body) });
  // Scope receipt comes from the canonical owner, never a made-up test digest.
  const body = { action: "start-production", projectId: f.project.id, blocks: [1], materialReceipt: await outlineAssessmentMaterialReceipt(f.project) };
  assert.notEqual((await http.POST(request(body, false))).status, 202); assert.equal(f.calls, 0);
  assert.equal((await http.POST(request({ ...body, materialReceipt: "stale" }))).status, 409); assert.equal(f.calls, 0);
  const admitted = await http.POST(request(body)); assert.equal(admitted.status, 202);
  const id = (await admitted.json()).task.scope.runId;
  let task;
  for (let i = 0; i < 100; i++) { task = await gateway.status(f.context, id); if (!task.running) break; await new Promise(r => setTimeout(r, 10)); }
  assert.equal(task.run.state, "waiting-for-writer"); assert.equal(task.productionPass.candidate.canonical, false); assert.equal(f.calls, 2);
  const repeat = await http.POST(request(body)); assert.equal((await repeat.json()).task.scope.runId, id); assert.equal(f.calls, 2);
  assert.deepEqual(await f.storage.loadActiveProject(f.context), f.project);
});

test("#2986 unresolved or contradictory semantic evidence checkpoints findings but never advances candidate", async t => {
  for (const state of ["unresolved", "contradictory"]) await t.test(state, async t => {
    const f = await fixture(t); f.second = fidelity(state); const task = await f.start();
    await f.controller.executeStep(task.scope, task.steps[0]);
    await assert.rejects(f.controller.finish(f.context, task.scope.runId), /unresolved semantic/);
    const saved = await f.controller.status(f.context, task.scope.runId);
    assert.equal(saved.productionPass.candidate, null); assert.equal(saved.productionPass.review.findings[0].state, state);
    await f.controller.executeStep(task.scope, task.steps[0]); assert.equal(f.calls, 2, "no inference repeats on findings replay");
  });
});

test("#2986 rejects remote, cost, truncated, missing and stale inputs before calls", async t => {
  const f = await fixture(t);
  for (const [provider, cost] of [["openai", 0], ["local", 0.01]]) {
    f.execution.provider = provider; f.execution.cloudCostUpperBoundUsd = cost;
    await assert.rejects(f.controller.create(f.context, [1], true), /zero-cost local/);
  }
  f.execution.provider = "local"; f.execution.cloudCostUpperBoundUsd = 0;
  await assert.rejects(f.controller.create(f.context, [2], true), /source passages/);
  await f.storage.saveProject(f.context, { project: { ...f.project, sourceEvidence: { ...f.project.sourceEvidence, screenplay: { ...f.project.sourceEvidence.screenplay, passagesTruncated: true } } }, activate: true });
  await assert.rejects(f.controller.create(f.context, [1], true), /complete/);
  await f.storage.saveProject(f.context, { project: f.project, activate: true });
  const task = await f.start();
  await f.storage.saveProject(f.context, { project: { ...f.project, title: "Changed source identity", revision: 5 }, activate: true });
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0]), /stale/);
  assert.equal(f.calls, 0);
});

test("#2986 missing or foreign citations fail closed at the real result admission boundary", async t => {
  for (const variant of ["missing", "foreign", "coverage"]) await t.test(variant, async t => {
    const f = await fixture(t); const output = fidelity();
    if (variant === "missing") output.findings.pop();
    else if (variant === "foreign") output.findings[0].passageIds = ["foreign-passage"];
    else output.findings.find(f => f.dimension === "coverage").passageIds = ["action-1"];
    f.second = output; const task = await f.start();
    await assert.rejects(f.controller.executeStep(task.scope, task.steps[0]), /semantic review/);
    assert.equal((await f.controller.status(f.context, task.scope.runId)).productionPass.candidate, null);
    assert.equal(f.calls, 2);
  });
});

test("#2986 full-source assessment does not sample or truncate a retained passage", async t => {
  const f = await fixture(t);
  const longText = "A source-backed action. ".repeat(24) + "FULL SOURCE END MARKER";
  const extra = Array.from({ length: 7 }, (_, index) => ({ ...passages[0], id: "extra-" + index, text: index === 3 ? longText : "The courier holds the same envelope." }));
  const full = [...passages, ...extra];
  const project = { ...f.project, sourceEvidence: { ...f.project.sourceEvidence, screenplay: { ...f.project.sourceEvidence.screenplay, passages: full, totalPassageCount: full.length, storedPassageCount: full.length } } };
  await f.storage.saveProject(f.context, { project, activate: true });
  f.first = { ...assessment, structural: { ...assessment.structural, passageIds: ["extra-3"] } };
  f.second = { findings: fidelity().findings.map(finding => finding.dimension === "coverage" ? { ...finding, passageIds: full.map(p => p.id) } : finding) };
  const task = await f.start(); await f.controller.executeStep(task.scope, task.steps[0]);
  const done = await f.controller.finish(f.context, task.scope.runId);
  assert.ok(f.inputs.every(input => input.includes("FULL SOURCE END MARKER")));
  assert.equal(done.productionPass.candidate.miniBlocks.flatMap(m => m.passageIds).length, full.length);
});

test("#2986 cancellation between actual calls preserves assessment and prevents candidate; expiry and changed route deny resume", async t => {
  const f = await fixture(t); const task = await f.start();
  f.intercept = async calls => { if (calls === 2) await f.controller.cancel(f.context, task.scope.runId); };
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0]));
  const saved = await f.controller.status(f.context, task.scope.runId);
  assert.equal(saved.run.state, "cancelled"); assert.equal(saved.proposals.length, 1); assert.equal(saved.productionPass.candidate, null);
  await assert.rejects(f.controller.activate(f.context, task.scope.runId), /cancelled/);
  const g = await fixture(t), pending = await g.start();
  g.execution.receipt = "changed-route";
  await assert.rejects(g.controller.executeStep(pending.scope, pending.steps[0]), /compute or grants changed/);
  g.execution.receipt = "local-route-2986"; g.clock = pending.productionPass.grant.expiresAt;
  await assert.rejects(g.controller.executeStep(pending.scope, pending.steps[0]), /expired/); assert.equal(g.calls, 0);
});

test("#2986 checkpoint before semantic inference survives reopen without repeating assessment", async t => {
  const f = await fixture(t), task = await f.start();
  // Stop immediately after the persisted assessment, before the second reservation.
  const originalWrite = f.storage.writePrivateJson.bind(f.storage);
  let stopped = false;
  f.storage.writePrivateJson = async (auth, input) => {
    const result = await originalWrite(auth, input);
    if (!stopped && input.value?.proposals?.length === 1 && input.value?.attempts?.length === 1) { stopped = true; f.controller.deactivate(task.scope.runId); }
    return result;
  };
  await assert.rejects(f.controller.executeStep(task.scope, task.steps[0])); assert.equal(f.calls, 1);
  f.reopen(); await f.controller.activate(f.context, task.scope.runId);
  await f.controller.executeStep(task.scope, task.steps[0]);
  await f.controller.finish(f.context, task.scope.runId); assert.equal(f.calls, 2);
});


test("#2995 two bounded structured calls fit the production grant without extending expired grants", async t => {
  const f = await fixture(t);
  f.intercept = async call => { f.clock = call === 1 ? "2026-10-14T00:02:50Z" : "2026-10-14T00:05:40Z"; };
  const task = await f.start();
  await f.controller.executeStep(task.scope, task.steps[0]);
  await f.controller.finish(f.context, task.scope.runId);
  const completed = await f.controller.status(f.context, task.scope.runId);
  assert.ok(completed.productionPass.candidate);
  assert.equal(f.calls, 2);
  f.clock = completed.productionPass.grant.expiresAt;
  await assert.rejects(f.controller.activate(f.context, task.scope.runId), /expired/);
});
