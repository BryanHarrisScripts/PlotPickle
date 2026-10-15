import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";

const root = await mkdtemp(path.resolve("node_modules/.outline-runtime-2995-"));
await build({ entryPoints: ["build/mastra-agent-runtime.ts"], bundle: true, platform: "node", format: "esm", packages: "external", outfile: path.join(root, "runtime.mjs"), logLevel: "silent", plugins: [{ name: "synthetic-model", setup(b) {
  b.onResolve({ filter: /^@mastra\/core\/(agent|mastra)$/ }, args => ({ path: args.path, namespace: "synthetic-model" }));
  b.onLoad({ filter: /.*/, namespace: "synthetic-model" }, () => ({ contents: `export class Agent { constructor(options) { this.id = options.id; } async generate(prompt, options) { return globalThis.outlineRuntime2995.generate(this.id, prompt, options); } } export class Mastra { constructor({agents}) { this.agents = agents; } getAgent(id) { return this.agents[id]; } }`, loader: "js" }));
} }] });
const runtime = await import(pathToFileURL(path.join(root, "runtime.mjs")).href);
test.after(() => rm(root, { recursive: true, force: true }));
const profile = { provider: "local", runtime: "openai-compatible", baseUrl: "http://127.0.0.1:1234/v1", textModel: "synthetic", apiKey: "" };

test("#2995 real Mastra dispatch gives structured review its own bounded deadline and fidelity schema", async () => {
  const originalTimeout = AbortSignal.timeout;
  const deadlines = [];
  AbortSignal.timeout = ms => { deadlines.push(ms); return originalTimeout(ms); };
  const calls = [];
  globalThis.outlineRuntime2995 = { generate: async (id, prompt, options) => { calls.push({id, options}); return { object: { findings: [] }, text: "synthetic", usage: { totalTokens: 12 } }; } };
  try {
    await runtime.askPlotPickleAgent({profile, agentId: "story-architect", tone: "direct", message: "synthetic assessment"});
    await runtime.askPlotPickleAgent({profile, agentId: "story-architect", tone: "direct", message: "synthetic fidelity", outputFormat: {kind: "production-fidelity"}});
    await runtime.askPlotPickleAgent({profile, agentId: "story-architect", tone: "direct", message: "ordinary conversation", conversationMode: true});
    assert.equal(deadlines[0], 180000);
    assert.equal(deadlines[1], 180000);
    assert.equal(deadlines[2], 25000);
    assert.ok(calls[0].options.structuredOutput.schema.jsonSchema.properties.structural);
    const schema = calls[1].options.structuredOutput.schema.jsonSchema;
    assert.deepEqual(schema.required, ["findings"]);
    assert.equal(schema.properties.findings.minItems, 7);
    assert.equal(schema.properties.findings.maxItems, 7);
    assert.deepEqual(schema.properties.findings.items.properties.state.enum, ["supported", "unresolved", "contradictory"]);
    assert.equal(calls[1].options.modelSettings.maxOutputTokens, 4000);
    assert.ok(runtime.storyArchitectTokenUpperBound() > 2 * 4000);
  } finally { AbortSignal.timeout = originalTimeout; delete globalThis.outlineRuntime2995; }
});

test("#2995 external cancellation still aborts structured review and admits no result", async () => {
  const controller = new AbortController();
  globalThis.outlineRuntime2995 = { generate: async (_id, _prompt, options) => { controller.abort(); options.abortSignal.throwIfAborted(); } };
  try {
    await assert.rejects(runtime.askPlotPickleAgent({profile, agentId: "story-architect", tone: "direct", message: "synthetic", signal: controller.signal, outputFormat: {kind: "production-fidelity"}}), /cancelled/);
  } finally { delete globalThis.outlineRuntime2995; }
});

await build({ entryPoints: ["build/projects/outline-task-gateway.ts"], bundle: true, platform: "node", format: "esm", packages: "external", outfile: path.join(root, "gateway.mjs"), logLevel: "silent" });
const gateway = await import(pathToFileURL(path.join(root, "gateway.mjs")).href);
test("#2995 scheduler timeout is actionable and arbitrary checkpoint errors remain private", () => {
  const fault = message => ({ status: "faulted", error: {message} });
  const timeout = gateway.outlineSchedulerFailure(fault("The Mastra agent did not finish within PlotPickle's 25-second response limit. Try again or choose a faster local model."));
  assert.match(timeout, /timed out.*25-second/u);
  assert.match(timeout, /Cancel.*new review/u);
  assert.doesNotMatch(timeout, /completed|candidate ready/u);
  assert.doesNotMatch(gateway.outlineSchedulerFailure(fault("secret-key and private screenplay")), /secret-key|private screenplay/u);
  assert.doesNotMatch(gateway.outlineSchedulerFailure(fault("The Mastra agent did not finish within PlotPickle's 25-second response limit. secret-key")), /secret-key/u);
  assert.match(gateway.outlineSchedulerFailure({status:"aborted"}), /cancelled/u);
});

test("#2999 unclassified scheduler failure never invents a cause or recommends duplicate retries", () => {
  const fault = message => ({ status: "faulted", error: { message } });
  const secret = "private screenplay and provider key";
  const unknown = gateway.outlineSchedulerFailure(fault(secret));
  assert.match(unknown, /UNCLASSIFIED_PRIVATE_FAILURE/u);
  assert.doesNotMatch(unknown, /private screenplay|provider key|Cancel this run and start a new review/u);
  const usage = gateway.outlineSchedulerFailure(fault("Outline worker did not persist usage before result admission."));
  assert.match(usage, /USAGE_NOT_RECORDED/u);
  assert.match(usage, /No completed review was reported/u);
  assert.match(gateway.outlineSchedulerFailure(fault("Outline task context exceeds the host limit.")), /SOURCE_CONTEXT_LIMIT/u);
  assert.match(gateway.outlineSchedulerFailure({ status: "pending", error: { message: secret } }), /UNKNOWN_OUTCOME/u);
  assert.doesNotMatch(gateway.outlineSchedulerFailure({ status: "pending", error: { message: secret } }), /private screenplay|provider key/u);
});

test("#2999 production status reports reservation separately from model usage and expired task recovery", async () => {
  const src = await (await import("node:fs/promises")).readFile(
    new URL("../app/skin-v1/global-dsdd-conversation.tsx", import.meta.url), "utf8");
  assert.match(src, /Model reservations: /u);
  assert.match(src, /usage-confirmed attempts:/u);
  assert.match(src, /Actual provider dispatch\/charge cannot be inferred from a reservation/u);
  assert.match(src, /grantExpired \? " \\(EXPIRED\\)"/u);
  assert.match(src, /RESUME is not available/u);
});
await build({ entryPoints: ["modules/plan/assessments/outline-task-selection.ts"], bundle: true, platform: "node", format: "esm", packages: "external", outfile: path.join(root, "task-selection.mjs"), logLevel: "silent" });
const { selectCurrentOutlineTask } = await import(pathToFileURL(path.join(root, "task-selection.mjs")).href);
const scope = { projectId: "brotherly-love", contextReceipt: "saved-source-v1", blockNumber: 1, production: true, profileId: "human-1" };
function productionTask(runId, state, createdAt, overrides = {}) {
  return {
    scope: { runId, projectId: scope.projectId, contextReceipt: scope.contextReceipt, humanProfileId: scope.profileId, ...(overrides.scope || {}) },
    steps: overrides.steps || [{ id: "block-1" }],
    productionPass: overrides.productionPass === undefined ? { grant: { blockNumber: 1, sourceReceipt: scope.contextReceipt } } : overrides.productionPass,
    run: { state, createdAt },
  };
}

test("#2997 current Block task selects a newer queued run before an older cancelled run regardless of gateway ordering", () => {
  const old = productionTask("old-cancelled", "cancelled", "2026-10-15T10:00:00Z");
  const current = productionTask("new-active", "queued", "2026-10-15T11:00:00Z");
  for (const tasks of [[current, old], [old, current]]) {
    assert.equal(selectCurrentOutlineTask(tasks, scope)?.scope.runId, "new-active");
    assert.equal(selectCurrentOutlineTask(tasks, { ...scope, pinnedRunId: "new-active" })?.scope.runId, "new-active");
    assert.equal(selectCurrentOutlineTask(tasks, { ...scope, pinnedRunId: "missing" }), null, "a missing admitted run must not fall back to cancelled history");
  }
  assert.equal([current, old].at(-1).scope.runId, "old-cancelled", "negative control: gateway order previously selected the wrong task");
});

test("#2997 settled history selects newest creation, not last list position or last update", () => {
  const older = productionTask("settled-a", "cancelled", "2026-10-15T08:00:00Z");
  const latest = productionTask("settled-b", "failed", "2026-10-15T09:00:00Z");
  const middle = productionTask("settled-c", "waiting-for-writer", "2026-10-15T08:30:00Z");
  assert.equal(selectCurrentOutlineTask([latest, older, middle], scope)?.scope.runId, "settled-b");
  assert.equal(selectCurrentOutlineTask([older, middle, latest], scope)?.scope.runId, "settled-b");
  assert.equal(selectCurrentOutlineTask([older, latest], { ...scope, pinnedRunId: "settled-a" })?.scope.runId, "settled-a");
  const a = productionTask("tie-a", "cancelled", "2026-10-15T09:00:00Z");
  const b = productionTask("tie-b", "cancelled", "2026-10-15T09:00:00Z");
  assert.equal(selectCurrentOutlineTask([a, b], scope)?.scope.runId, selectCurrentOutlineTask([b, a], scope)?.scope.runId);
});

test("#2997 exact authenticated project, material, profile, Block and production scope cannot cross-select", () => {
  const valid = productionTask("current-exact", "working", "2026-10-15T09:00:00Z");
  const wrongProject = productionTask("foreign-project", "working", "2026-10-15T12:00:00Z", { scope: { projectId: "different-project" } });
  const wrongSource = productionTask("foreign-material", "working", "2026-10-15T12:00:00Z", { scope: { contextReceipt: "other-material" } });
  const wrongProfile = productionTask("foreign-profile", "working", "2026-10-15T12:00:00Z", { scope: { humanProfileId: "human-2" } });
  const wrongBlock = productionTask("foreign-block", "working", "2026-10-15T12:00:00Z", { steps: [{ id: "block-2" }] });
  const wrongGrant = productionTask("foreign-grant", "working", "2026-10-15T12:00:00Z", { productionPass: { grant: { blockNumber: 1, sourceReceipt: "wrong-grant" } } });
  const assessment = productionTask("foreign-assessment", "working", "2026-10-15T12:00:00Z", { productionPass: null });
  const tasks = [wrongProject, wrongSource, wrongProfile, wrongBlock, wrongGrant, assessment, valid];
  assert.equal(selectCurrentOutlineTask(tasks, scope)?.scope.runId, "current-exact");
  assert.equal(selectCurrentOutlineTask(tasks.filter(t => t !== valid), scope), null);
  assert.equal(selectCurrentOutlineTask([], scope), null);
});
