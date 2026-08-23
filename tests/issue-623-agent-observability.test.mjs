import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("agent observability is a passive local gateway registered before the Writing Assistant", async () => {
  const [localGateway, observer] = await Promise.all([
    read("build/local-ai-gateway.ts"),
    read("build/agent-observability-gateway.ts"),
  ]);

  assert.match(localGateway, /registerAgentObservabilityGateway/);
  assert.ok(localGateway.indexOf("registerAgentObservabilityGateway(server)") < localGateway.indexOf("registerWritingAssistantGateway(server)"));

  assert.match(observer, /\/api\/writing-assistant\/traces/);
  assert.match(observer, /\/api\/writing-assistant\/chat/);
  assert.match(observer, /request\.method === "GET"/);
  assert.match(observer, /request\.method === "DELETE"/);
  assert.match(observer, /isLocalRequest\(request\)/);
  assert.match(observer, /response\.end/);
  assert.match(observer, /payload\.agentId/);
  assert.match(observer, /payload\.runtimeProvider/);
  assert.match(observer, /payload\.modelRole/);
  assert.match(observer, /payload\.latencyMs/);
});

test("session traces store operational metadata but not prompts, answers or hidden reasoning", async () => {
  const store = await read("build/agent-observability-store.ts");

  assert.match(store, /retention: "session-memory"/);
  assert.match(store, /maximumTraces: MAX_SESSION_TRACES/);
  assert.match(store, /promptsStored: false/);
  assert.match(store, /responsesStored: false/);
  assert.match(store, /hiddenReasoningStored: false/);
  assert.match(store, /operationalMetadataOnly: true/);
  assert.match(store, /agentId:/);
  assert.match(store, /runtimeProvider:/);
  assert.match(store, /modelRole:/);
  assert.match(store, /durationMs:/);
  assert.match(store, /events:/);
  assert.doesNotMatch(store, /\bprompt\s*:/i);
  assert.doesNotMatch(store, /\bresponse\s*:/i);
  assert.doesNotMatch(store, /\breasoning\s*:/i);
});

test("Settings shows a trajectory-style Agent Activity timeline without exposing message content", async () => {
  const [workspace, panel] = await Promise.all([
    read("app/sage-settings-workspace.tsx"),
    read("app/agent-observability-panel.tsx"),
  ]);

  assert.match(workspace, /AgentObservabilityPanel/);
  assert.match(workspace, /<AgentObservabilityPanel \/>/);
  assert.match(panel, />Agent Activity</);
  assert.match(panel, /\/api\/writing-assistant\/traces/);
  assert.match(panel, /setInterval\(\(\) => void refresh\(\), 5000\)/);
  assert.match(panel, /which model handled it/);
  assert.match(panel, /does not store prompts, responses, or hidden model reasoning/i);
  assert.match(panel, /trace\.events\.map/);
  assert.match(panel, /Clear session/);
});

test("observability automatically covers Sage, Foundations Planner and Wyrmwood structured agents", async () => {
  const observer = await read("build/agent-observability-gateway.ts");

  assert.match(observer, /"foundations-planner"/);
  assert.match(observer, /"wyrmwood-rival-director"/);
  assert.match(observer, /"wyrmwood-curriculum-evaluator"/);
  assert.match(observer, /STRUCTURED_AGENTS\.has\(agentId\)/);
  assert.match(observer, /finishAgentTrace\(traceId, outputChars\)/);
  assert.match(observer, /failAgentTrace\(traceId/);
});

test("focused UAT owns the observability regression under Startup and Settings", async () => {
  const registry = JSON.parse(await read("config/uat-autopilot-registry.json"));
  const startup = registry.areas.find((area) => area.id === "startup");
  const settings = registry.areas.find((area) => area.id === "settings");
  assert.ok(startup?.tests.includes("tests/issue-623-agent-observability.test.mjs"));
  assert.ok(settings?.tests.includes("tests/issue-623-agent-observability.test.mjs"));
});
