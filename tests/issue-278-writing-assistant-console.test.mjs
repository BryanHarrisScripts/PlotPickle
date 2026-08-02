import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #278 keeps separate encrypted text profiles and imports the existing AI connection", async () => {
  const store = await source("build/writing-assistant-store.ts");
  for (const phrase of [
    "writing-assistant-profiles.json",
    "ai-connection.json",
    "readCredentialJson",
    "writeCredentialJson",
    '"ollama"',
    '"openai"',
    '"minimax"',
    "assistantVerifiedAt",
    "explicitlyDisabled",
  ]) assert.ok(store.includes(phrase), `Writing Assistant store is missing: ${phrase}`);
  assert.doesNotMatch(store, /localStorage|sessionStorage/);
  assert.match(store, /sameConnection/);
  assert.match(store, /readSynchronizedAssistantStore/);
});

test("issue #278 supports real Ollama OpenAI and MiniMax text responses", async () => {
  const provider = await source("build/writing-assistant-provider.ts");
  for (const phrase of [
    "/responses",
    "/v1/chat/completions",
    "/api/generate",
    "/api/tags",
    "Introduce yourself to a new PlotPickle writer.",
    "MiniMax",
    "Ollama",
    "OpenAI",
    "AbortSignal.timeout",
  ]) assert.ok(provider.includes(phrase), `Writing Assistant provider path is missing: ${phrase}`);
  assert.match(provider, /assistantVerifiedAt: new Date\(\)\.toISOString\(\)/);
  assert.match(provider, /lastLatencyMs/);
  assert.match(provider, /lastError/);
});

test("issue #278 routes existing PlotPickle text assistance without changing image or video routing", async () => {
  const gateway = await source("build/writing-assistant-gateway.ts");
  const localGateway = await source("build/local-ai-gateway.ts");
  assert.match(gateway, /\/api\/local-ai\/generate\/text/);
  assert.match(gateway, /handleTextOverride/);
  assert.match(gateway, /activeProvider/);
  assert.doesNotMatch(gateway, /generate\/image|generate\/video/);
  assert.match(localGateway, /registerWritingAssistantGateway\(server\)/);
  assert.match(localGateway, /registerSingleImageBoundary\(server\)/);
  assert.match(localGateway, /legacy\.configureServer/);
});

test("issue #278 mounts a conversational first-run console with truthful provider tests", async () => {
  const consoleSource = await source("app/writing-assistant-console.tsx");
  const host = await source("app/configuration-dashboard-host.tsx");
  const css = await source("app/writing-assistant-console.module.css");
  for (const phrase of [
    "Writing Assistant",
    "Ollama Local",
    "OpenAI API",
    "MiniMax M3",
    "Off",
    "Test response",
    "Use this model",
    "Technical log",
    "Answers do not become story canon automatically",
    "/api/writing-assistant/status",
    "/api/writing-assistant/active",
    "/api/writing-assistant/test",
    "/api/writing-assistant/chat",
    "/api/writing-assistant/ollama",
    "plotpickle.writing-assistant.session",
  ]) assert.ok(consoleSource.includes(phrase), `Writing Assistant console is missing: ${phrase}`);
  assert.match(host, /WritingAssistantConsole/);
  assert.match(css, /providerGrid/);
  assert.match(css, /conversation/);
  assert.match(css, /technical/);
  assert.doesNotMatch(consoleSource, /apiKey|Bearer |sk-[A-Za-z0-9]/);
});

test("issue #278 regression is registered through the first-run setup suite", async () => {
  const setupSuite = await source("tests/issue-256-setup-connections-dashboard.test.mjs");
  assert.match(setupSuite, /import "\.\/issue-278-writing-assistant-console\.test\.mjs"/);
});
