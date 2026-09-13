import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

async function fixture(name) {
  return JSON.parse(await read(`tests/fixtures/issue-1996/${name}.json`));
}

test("#1996 Phase 1 keeps beta schemas inside one mocked runtime adapter", async () => {
  const [contract, adapter] = await Promise.all([
    read("build/agent-runtime-contract.ts"),
    read("build/openai-agents-runtime-adapter.ts"),
  ]);

  assert.match(contract, /instructions: string/u);
  assert.doesNotMatch(contract, /BetaSession|AgentSessionTurn|agent\.session\./u);

  assert.match(adapter, /interface OpenAIAgentsRuntimeTransport/u);
  assert.match(adapter, /runSession\(request: unknown\): Promise<readonly unknown\[\]>/u);
  assert.match(adapter, /type BetaSessionCreateRequest/u);
  assert.match(adapter, /environment: \{ type: "none" \}/u);
  assert.match(adapter, /instructions: request\.instructions/u);
  assert.match(adapter, /model: request\.model/u);
  assert.match(adapter, /tools: \[\]/u);
  assert.match(adapter, /stream: true/u);

  assert.doesNotMatch(adapter, /from ["']openai["']|new OpenAI|fetch\(|axios|https:\/\//u);
});

test("#1996 Phase 1 fixtures model final text, usage and explicit failure", async () => {
  const [adapter, success, failure] = await Promise.all([
    read("build/openai-agents-runtime-adapter.ts"),
    fixture("openai-agents-session-success"),
    fixture("openai-agents-session-failure"),
  ]);

  assert.equal(success[0].type, "agent.session.created");
  assert.equal(success[1].type, "agent.session.turn.output_text.done");
  assert.equal(success[1].text, "Mock Sage transport response.");
  assert.equal(success[2].type, "agent.session.turn.completed");
  assert.deepEqual(success[2].usage, {
    input_tokens: 42,
    output_tokens: 12,
    total_tokens: 54,
  });

  assert.equal(failure[1].type, "agent.session.turn.failed");
  assert.equal(failure[1].error.message, "Mock Agents API failure.");

  for (const eventType of [
    "agent.session.turn.output_text.done",
    "agent.session.turn.completed",
    "agent.session.turn.failed",
    "agent.session.turn.cancelled",
  ]) {
    assert.ok(adapter.includes(eventType), `Adapter does not map mocked beta event ${eventType}`);
  }

  assert.match(adapter, /inputTokens/u);
  assert.match(adapter, /outputTokens/u);
  assert.match(adapter, /totalTokens/u);
  assert.match(adapter, /finalState: "success"/u);
  assert.match(adapter, /finalState: "cancelled"/u);
  assert.match(adapter, /status: "failure"/u);
});

test("#1996 Phase 1 fails closed for unsupported provider, disclosure, capability and durable-session requests", async () => {
  const adapter = await read("build/openai-agents-runtime-adapter.ts");

  assert.match(adapter, /request\.provider !== "openai"/u);
  assert.match(adapter, /No fallback provider was used/u);
  assert.match(adapter, /request\.runtime !== OPENAI_AGENTS_RUNTIME/u);
  assert.match(adapter, /no fallback runtime was used/u);
  assert.match(adapter, /!request\.outbound\.cloudDisclosureAccepted/u);
  assert.match(adapter, /request\.outbound\.capabilityGrants\.length > 0/u);
  assert.match(adapter, /does not expose tools, MCP, or other runtime capabilities/u);
  assert.match(adapter, /request\.session && request\.session\.action !== "none"/u);
  assert.match(adapter, /session durability is deferred to Phase 3/u);
});

test("#1996 Phase 1 remains unreachable and preserves every existing provider route", async () => {
  const [contract, gateway, computeStore, writingStore] = await Promise.all([
    read("build/agent-runtime-contract.ts"),
    read("build/writing-assistant-gateway.ts"),
    read("build/agent-compute-store.ts"),
    read("build/writing-assistant-store.ts"),
  ]);

  assert.match(contract, /\[OPENAI_AGENTS_RUNTIME\]: \{[\s\S]*?ready: false,[\s\S]*?beta: true/u);
  assert.match(writingStore, /export type TextProvider = "local" \| "ollama" \| "openai" \| "minimax" \| "gemini"/u);
  assert.match(gateway, /const text = await askPlotPickleAgent\(\{/u);
  assert.doesNotMatch(gateway, /openai-agents-runtime-adapter|createOpenAIAgentsRuntimeAdapter|OPENAI_AGENTS_RUNTIME/u);
  assert.doesNotMatch(computeStore, /openai-agents/u);
});

test("#1996 Phase 1 never serializes arbitrary context, selected resources, reasoning or canon into the beta payload", async () => {
  const adapter = await read("build/openai-agents-runtime-adapter.ts");
  const buildRequest = adapter.slice(
    adapter.indexOf("function buildBetaRequest"),
    adapter.indexOf("function baseEvidence"),
  );

  assert.doesNotMatch(buildRequest, /request\.context/u);
  assert.doesNotMatch(buildRequest, /selectedResourceIds/u);
  assert.doesNotMatch(buildRequest, /chainOfThought|chain_of_thought|reasoningTrace|reasoning_trace/u);
  assert.doesNotMatch(buildRequest, /PPF|canon/u);
});
