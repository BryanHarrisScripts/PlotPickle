import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("#1996 Phase 0 keeps provider and runtime as separate contracts", async () => {
  const [contract, brief, computeStore] = await Promise.all([
    read("build/agent-runtime-contract.ts"),
    read("docs/developer-briefs/1996-openai-agents-api-runtime-adapter.md"),
    read("build/agent-compute-store.ts"),
  ]);

  assert.match(contract, /provider: TextProvider/u);
  assert.match(contract, /runtime: AgentRuntimeId/u);
  assert.match(contract, /NATIVE_DIRECT_AGENT_RUNTIME = "native\/direct"/u);
  assert.match(contract, /OPENAI_AGENTS_RUNTIME = "openai-agents"/u);
  assert.match(contract, /DEFAULT_AGENT_RUNTIME = NATIVE_DIRECT_AGENT_RUNTIME/u);
  assert.match(brief, /provider is not runtime/i);

  assert.match(computeStore, /defaultProvider: "active"/u);
  assert.doesNotMatch(computeStore, /openai-agents/u);
});

test("#1996 Phase 0 keeps the OpenAI Agents runtime opt-in and not ready", async () => {
  const contract = await read("build/agent-runtime-contract.ts");

  assert.match(contract, /\[OPENAI_AGENTS_RUNTIME\]: \{[\s\S]*?ready: false,[\s\S]*?beta: true/u);
  assert.match(contract, /requireReadyAgentRuntime/u);
  assert.match(contract, /No fallback runtime was used/u);
  assert.doesNotMatch(contract, /@openai|agents\.openai\.com|api\.openai\.com/u);
});

test("#1996 Phase 0 defines bounded session, outbound and observability contracts", async () => {
  const contract = await read("build/agent-runtime-contract.ts");

  for (const required of [
    "AgentRuntimeSessionScope",
    "AgentRuntimeSessionBinding",
    "AgentRuntimeSessionStore",
    "cloudDisclosureAccepted",
    "selectedResourceIds",
    "capabilityGrants",
    "toolsUsed",
    "subagentRoles",
    "elapsedMs",
    "deterministicEvaluation",
  ]) {
    assert.ok(contract.includes(required), `Missing #1996 Phase 0 contract: ${required}`);
  }

  assert.match(contract, /protected local application state only/u);
  assert.match(contract, /must not serialize these bindings into PPF\/story canon/u);
  assert.doesNotMatch(contract, /chainOfThought|chain_of_thought|reasoningTrace|reasoning_trace/u);
});

test("#1996 Phase 0 exposes a runtime-neutral adapter seam without live execution", async () => {
  const contract = await read("build/agent-runtime-contract.ts");

  assert.match(contract, /export interface AgentRuntimeAdapter/u);
  assert.match(contract, /execute<TContext = unknown>\(request: AgentRuntimeExecutionRequest<TContext>\)/u);
  assert.match(contract, /resetSession\?\(scope: AgentRuntimeSessionScope\)/u);
  assert.match(contract, /status: "success" \| "failure" \| "cancelled"/u);
  assert.doesNotMatch(contract, /fetch\(|axios|new OpenAI|client\.agents/u);
});
