import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import test from "node:test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { parsePlotPickleCreativeCommand } from "../app/_components/settings/plotpickle-creative-command.mjs";
import { driveAdmittedOutlineCheckpoint } from "../core/sidecars/tasks/outline-checkpoint-driver.mjs";

const root = await mkdtemp(path.resolve("node_modules/.outline-runtime-2995-"));
await build({ entryPoints: ["build/mastra-agent-runtime.ts"], bundle: true, platform: "node", format: "esm", packages: "external", outfile: path.join(root, "runtime.mjs"), logLevel: "silent", plugins: [{ name: "synthetic-model", setup(b) {
  b.onResolve({ filter: /^@mastra\/core\/(agent|mastra)$/ }, args => ({ path: args.path, namespace: "synthetic-model" }));
  b.onLoad({ filter: /.*/, namespace: "synthetic-model" }, () => ({ contents: `export class Agent { constructor(options) { this.id = options.id; } async generate(prompt, options) { return globalThis.outlineRuntime2995.generate(this.id, prompt, options); } } export class Mastra { constructor({agents}) { this.agents = agents; } getAgent(id) { return this.agents[id]; } }`, loader: "js" }));
} }] });
const runtime = await import(pathToFileURL(path.join(root, "runtime.mjs")).href);
test.after(() => rm(root, { recursive: true, force: true }));
const profile = { provider: "local", runtime: "openai-compatible", baseUrl: "http://127.0.0.1:1234/v1", textModel: "synthetic", apiKey: "" };

test("#2999 configured OpenAI uses native Responses settings at the real Mastra HTTP boundary", async () => {
  const compiled = path.join(root, "real-runtime.mjs");
  await build({ entryPoints: ["build/mastra-agent-runtime.ts"], bundle: true, platform: "node", format: "esm", packages: "external", outfile: compiled, logLevel: "silent" });
  const real = await import(pathToFileURL(compiled).href);
  const requests = [];
  const assessment = { structural: { state: "unresolved", reason: "Synthetic fixture cannot establish the whole story.", passageIds: ["synthetic-01"] }, characters: [], miniBlocks: [1,2,3,4].map(ordinal => ({ ordinal, state: "unsupported", reason: "Synthetic source does not establish this Mini-Block.", passageIds: ["synthetic-01"], storyboardCue: "" })) };
  let responseOutput = assessment;
  const server = createServer(async (request, response) => {
    let body = "";
    for await (const chunk of request) body += chunk;
    const input = JSON.parse(body);
    requests.push({ path: request.url, input });
    response.setHeader("Content-Type", "application/json");
    if (request.url !== "/v1/responses" || input.max_tokens !== undefined || input.temperature !== undefined) {
      response.statusCode = 400;
      response.end(JSON.stringify({ error: { message: "SYNTHETIC_UNSUPPORTED_OPENAI_SETTINGS", type: "invalid_request_error", param: "max_tokens", code: "unsupported_parameter" } }));
      return;
    }
    response.end(JSON.stringify({ id: "resp_synthetic", object: "response", created_at: 1, model: input.model, status: "completed", output: [{ id: "msg_synthetic", type: "message", role: "assistant", status: "completed", content: [{ type: "output_text", text: typeof responseOutput === "string" ? responseOutput : JSON.stringify(responseOutput), annotations: [] }] }], usage: { input_tokens: 37, output_tokens: 53, total_tokens: 90 } }));
  });
  await new Promise(resolve => server.listen(0, "127.0.0.1", resolve));
  try {
    let usage;
    const output = await real.askPlotPickleAgent({ profile: { ...profile, provider: "openai", baseUrl: `http://127.0.0.1:${server.address().port}/v1`, textModel: "gpt-5.6", apiKey: "synthetic-not-a-secret" }, agentId: "story-architect", tone: "direct", message: "Assess synthetic-01 only; no private story.", onAssessmentUsage: async value => { usage = value; } });
    assert.deepEqual(JSON.parse(output), assessment);
    assert.equal(requests.length, 1, "No retry is needed for an accepted native request.");
    assert.equal(requests[0].path, "/v1/responses");
    assert.equal(requests[0].input.store, false, "Changing transport must not enable provider response storage.");
    assert.equal(requests[0].input.max_output_tokens, 1800);
    assert.equal(requests[0].input.text.format.type, "json_schema");
    assert.ok(requests[0].input.text.format.schema.properties.structural);
    assert.deepEqual(usage, { inputTokens: 37, outputTokens: 53, totalTokens: 90 });
    const fixtures = [
      ["curriculum-guide", "A synthetic compass changes hands; clear choices establish consequences."],
      ["foundations-planner", { values: { "output-1": "A borrowed compass creates a synthetic trust conflict." } }],
      ["discovery-mapper", { act: 1, lane: "scene", reason: "A synthetic opening choice creates conflict.", evidenceRefs: ["synthetic-01"] }],
      ["wyrmwood-rival-director", { oakenOpening: "A synthetic choice begins.", pickle: { title: "Compass", situation: "A compass changes hands.", goal: "Establish ownership", constraints: ["No new facts"], establishedElements: ["Compass", "Table"], failurePressure: "Time" }, rivals: Object.fromEntries(["aiden-glowhart", "damien-darkmore", "barnaby-barnacle", "master-spirit-talker", "sienna-silvertongue"].map(id => [id, { action: "Ask", complication: "Time passes" }])) }],
      ["wyrmwood-curriculum-evaluator", { dimensions: { storyLogic: 10, lessonApplication: 10, establishedElements: 10, consequences: 10, rivalCounter: 8, clarity: 7 }, whatWorked: ["A choice"], whatNeedsWork: ["Consent"], conceptUsed: "Consequence", teachingDebrief: "Check ownership." }],
    ];
    for (const [agentId, expected] of fixtures) {
      responseOutput = expected;
      const result = await real.askPlotPickleAgent({ profile: { ...profile, provider: "openai", baseUrl: `http://127.0.0.1:${server.address().port}/v1`, textModel: "gpt-5.6", apiKey: "synthetic-not-a-secret" }, agentId, tone: "direct", message: "Discuss synthetic-01 compass choices only.", ...(agentId === "foundations-planner" ? { foundationFieldIds: ["output-1"] } : {}) });
      assert.deepEqual(typeof expected === "string" ? result : JSON.parse(result), expected, agentId);
      const sent = requests.at(-1);
      assert.equal(sent.path, "/v1/responses", agentId);
      assert.equal(sent.input.store, false, agentId);
      assert.equal(sent.input.max_tokens, undefined, agentId);
      assert.equal(sent.input.temperature, undefined, agentId);
      assert.ok(sent.input.max_output_tokens > 0, agentId);
      if (agentId !== "curriculum-guide") assert.equal(sent.input.text.format.type, "json_schema", agentId);
    }
    assert.equal(requests.length, 6, "Exactly one synthetic request for each formerly failed role.");
    assert.equal(real.mastraModelConfig(profile).api, undefined, "Other configured providers retain their existing adapter.");
  } finally { server.closeAllConnections(); await new Promise(resolve => server.close(resolve)); }
});

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
test("#2999 private provider errors cannot use a host-looking prefix to leak into CMD", async () => {
  for (const message of [
    "Outline API key=private-password", "The scheduler <private screenplay>", "Pi Durable secret-token",
    "Story Architect recovery with confidential project text", "Unknown provider failure",
  ]) {
    const safe = gateway.outlineGatewaySafeError(new Error(message));
    assert.match(safe, /UNCLASSIFIED_PRIVATE_FAILURE/u);
    assert.doesNotMatch(safe, /password|secret-token|private screenplay|confidential project|Unknown provider failure/u);
  }
  assert.match(gateway.outlineGatewaySafeError(new Error("Pi Durable is not ready. Wait for startup readiness before starting or resuming Story Architect.")), /Pi Durable is not ready/u);
  const source = await (await import("node:fs/promises")).readFile(
    new URL("../build/projects/outline-task-gateway.ts", import.meta.url), "utf8");
  assert.match(source, /errors\.set\(id, outlineGatewaySafeError\(error\)\)/u);
  assert.doesNotMatch(source, /\/\^\(Outline \|Story Architect recovery/u);
});

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
  assert.match(src, /grantExpired.*EXPIRED/u);
  assert.match(src, /RESUME is not available/u);
});
await build({ entryPoints: ["modules/plan/assessments/outline-task-selection.ts"], bundle: true, platform: "node", format: "esm", packages: "external", outfile: path.join(root, "task-selection.mjs"), logLevel: "silent" });
const { selectCurrentOutlineTask, outlineTaskDisplayStatus, describeOutlineTaskDiagnostic } = await import(pathToFileURL(path.join(root, "task-selection.mjs")).href);
test("#2999 CMD distinguishes safe non-timeout host fault from a genuine timeout", () => {
  const task = {
    scope: { runId: "synthetic-fault", provider: "openai", model: "synthetic-model" },
    run: { state: "working" }, steps: [{ id: "block-1" }],
    proposals: [], productionPass: null, running: false, resumeRequired: true,
    attempts: [{ id: "attempt-fixture", status: "reserved", usage: null, checkpointStage: "worker-callback-entered" }],
    error: "The scheduler faulted (USAGE_NOT_RECORDED). No completed review was reported;",
  };
  const known = describeOutlineTaskDiagnostic(task);
  assert.match(known, /Safe fault category: USAGE_NOT_RECORDED/u);
  assert.doesNotMatch(known, /Safe fault category: HOST_TIMEOUT/u);
  assert.match(known, /Last durable host checkpoint: worker-callback-entered/u);
  assert.match(known, /provider HTTP dispatch and cost UNKNOWN/u);
  assert.match(known, /Attempts reserved: 1; usage-reported: 0/u);
  assert.doesNotMatch(known, /API credential|private screenplay/u);
  const unclassified = describeOutlineTaskDiagnostic({ ...task,
    error: "Story Architect stopped (UNCLASSIFIED_PRIVATE_FAILURE). Inspect the protected task checkpoint;" });
  assert.match(unclassified, /Safe fault category: UNCLASSIFIED/u);
  const timeout = describeOutlineTaskDiagnostic({ ...task,
    error: "The scheduler review timed out at the 180-second response limit. Cancel this run" });
  assert.match(timeout, /Safe fault category: HOST_TIMEOUT/u);
  const legacy = describeOutlineTaskDiagnostic({ ...task, attempts: [{ id: "old", status: "reserved", usage: null }] });
  assert.match(legacy, /Last durable host checkpoint: NOT_CAPTURED_LEGACY/u);
  assert.doesNotMatch(legacy, /worker callback entered; provider HTTP dispatch/u);
});

const scope = { projectId: "brotherly-love", contextReceipt: "saved-source-v1", blockNumber: 1, production: true, profileId: "human-1" };
function productionTask(runId, state, createdAt, overrides = {}) {
  return {
    scope: { runId, projectId: scope.projectId, contextReceipt: scope.contextReceipt, humanProfileId: scope.profileId, ...(overrides.scope || {}) },
    steps: overrides.steps || [{ id: "block-1" }],
    productionPass: overrides.productionPass === undefined ? { grant: { blockNumber: 1, sourceReceipt: scope.contextReceipt } } : overrides.productionPass,
    run: { state, context: { receiptGeneratedAt: createdAt }, events: [{ type: "run.created", at: createdAt }] },
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

test("#3015 persisted run-created events select the new reviewed task over lexical historical IDs", () => {
  const old = productionTask("z-old-local", "working", "2026-10-15T10:00:00Z");
  const current = productionTask("a-new-openai", "working", "2026-10-16T13:17:31Z");
  old.run.updatedAt = "2026-10-16T15:00:00Z";
  current.run.updatedAt = "2026-10-16T13:18:20Z";
  assert.equal(current.run.createdAt, undefined, "The real persistence shape has no createdAt field.");
  for (const tasks of [[old, current], [current, old]]) {
    assert.equal(selectCurrentOutlineTask(tasks, scope)?.scope.runId, "a-new-openai");
    assert.equal(selectCurrentOutlineTask(tasks, { ...scope, pinnedRunId: "z-old-local" })?.scope.runId, "z-old-local");
  }
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

test("#2999 stopped Story Architect worker is never displayed as working even if durable run state remains working", async () => {
  const old = productionTask("saved-run", "working", "2026-10-15T09:00:00Z");
  const failed = { ...old, running: false, resumeRequired: true, error: "The scheduler faulted (UNCLASSIFIED_PRIVATE_FAILURE)." };
  assert.equal(outlineTaskDisplayStatus(failed), "blocked - recovery required");
  assert.doesNotMatch(outlineTaskDisplayStatus(failed), /working|UNCLASSIFIED_PRIVATE_FAILURE/u);
  assert.equal(outlineTaskDisplayStatus({ ...failed, error: null }), "recovery required");
  assert.equal(outlineTaskDisplayStatus({ ...failed, resumeRequired: false }), "not executing - inspect recovery");
  assert.equal(outlineTaskDisplayStatus({ ...failed, running: true, resumeRequired: false, error: null }), "working");
  assert.equal(outlineTaskDisplayStatus({ ...failed, run: { ...old.run, state: "cancelled" }, resumeRequired: false, error: null }), "cancelled");
  const src = await (await import("node:fs/promises")).readFile(
    new URL("../app/skin-v1/story-card-foundation-board.tsx", import.meta.url), "utf8");
  assert.match(src, /Story Architect · \{outlineTaskDisplayStatus\(task\)\}/u, "Outline UI must use actual host execution projection");
  assert.doesNotMatch(src, /Story Architect · \{task\.run\.state\.replaceAll/u, "stale state may not label a stopped worker as working");
});

test("#2999 Command read-only diagnosis shows reservations, host state and UNKNOWN dispatch without exposing protected errors", async () => {
  assert.deepEqual(parsePlotPickleCreativeCommand("PlotPickle diagnose Block 01"), { action: "diagnose", blockNumber: 1 });
  assert.deepEqual(parsePlotPickleCreativeCommand("PlotPickle diagnose Block 24"), { action: "diagnose", blockNumber: 24 });
  assert.equal(parsePlotPickleCreativeCommand("PlotPickle diagnose Block 25").action, "invalid");
  const task = {
    ...productionTask("outline-task-synthetic", "working", "2026-10-15T12:00:00Z"),
    scope: { runId: "outline-task-synthetic", provider: "local", model: "synthetic", projectId: scope.projectId },
    running: false, resumeRequired: true,
    attempts: [{ status: "reserved", usage: null }, { status: "reported", usage: { totalTokens: 7 } }],
    proposals: [], error: "The scheduler faulted (UNCLASSIFIED_PRIVATE_FAILURE). private-text=never-echo",
    productionPass: { candidate: null, review: null },
  };
  const output = describeOutlineTaskDiagnostic(task);
  assert.match(output, /blocked - recovery required/u);
  assert.match(output, /Attempts reserved: 2; usage-reported: 1; model dispatch: UNKNOWN/u);
  assert.match(output, /Admitted source-bound assessments: 0\/1/u);
  assert.match(output, /Safe fault category: UNCLASSIFIED_PRIVATE_FAILURE/u);
  assert.doesNotMatch(output, /private-text=never-echo/u);
  assert.match(describeOutlineTaskDiagnostic({ ...task, running: true, resumeRequired: false, error: null }), /Execution: working/u);
  assert.match(describeOutlineTaskDiagnostic({ ...task, error: null }), /NOT_RECORDED_OR_UNAVAILABLE/u);
  const src = await (await import("node:fs/promises")).readFile(
    new URL("../app/skin-v1/global-dsdd-conversation.tsx", import.meta.url), "utf8");
  assert.match(src, /command\.action === "diagnose"/u);
  assert.match(src, /describeOutlineTaskDiagnostic\(report\.task\)/u);
  assert.match(src, /production \? \["local", "ollama", "openai"\] : \["local", "ollama"\]/u,
    "Production status must allow previously authorized OpenAI text tasks");
  assert.match(src, /const tasks = await readOutlineTasks\(\)/u);
});

test("#2999 native Pi Durable scheduler must resume after admission before waiting", async () => {
  const stages = [];
  const input = { scope: { runId: "synthetic-only" }, steps: [{ id: "block-1" }] };
  const context = { boundary: "synthetic" };
  const scheduler = {
    async root(seenContext) {
      assert.equal(seenContext, context);
      stages.push("root");
      return { owner: "synthetic-task" };
    },
    resume() { stages.push("resume"); },
    async waitForTask(taskId, seenContext) {
      assert.equal(taskId, "pi-synthetic-task");
      assert.equal(seenContext, context);
      assert.deepEqual(stages, ["root", "admit", "resume"],
        "Pi waitForTask observes completion; it cannot substitute for harness.resume");
      stages.push("wait");
      return { state: { outcome: { status: "completed" } } };
    },
  };
  const registration = {
    async admit(root, seenInput, seenContext) {
      assert.deepEqual(root, { owner: "synthetic-task" });
      assert.equal(seenInput, input);
      assert.equal(seenContext, context);
      stages.push("admit");
      return "pi-synthetic-task";
    },
  };
  const result = await driveAdmittedOutlineCheckpoint({ harness: scheduler, registration, input, context });
  assert.equal(result.state.outcome.status, "completed");
  assert.deepEqual(stages, ["root", "admit", "resume", "wait"]);
  const gatewaySource = await (await import("node:fs/promises")).readFile(
    new URL("../build/projects/outline-task-gateway.ts", import.meta.url), "utf8");
  assert.match(gatewaySource, /driveAdmittedOutlineCheckpoint\(\{ harness, registration, input, context \}\)/u,
    "real production gateway must use the tested admit-resume-wait driver");
  assert.doesNotMatch(gatewaySource, /const piId = await registration\.admit\(await harness\.root/u,
    "do not regress to the prior admitted-but-not-driven production path");
});

test("#2999 failed Pi admission never resumes or duplicates inference", async () => {
  const stages = [];
  const harness = {
    async root() { stages.push("root"); return {}; },
    resume() { stages.push("resume"); },
    async waitForTask() { stages.push("wait"); return null; },
  };
  const registration = {
    async admit() { stages.push("admit-rejected"); throw new Error("SYNTHETIC_ADMISSION_DENIED"); },
  };
  await assert.rejects(
    driveAdmittedOutlineCheckpoint({ harness, registration, input: {}, context: {} }),
    /SYNTHETIC_ADMISSION_DENIED/u,
  );
  assert.deepEqual(stages, ["root", "admit-rejected"]);
});
