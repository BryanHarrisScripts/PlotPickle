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
