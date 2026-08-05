import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #353 exposes the requested text image and video provider matrix", async () => {
  const [panel, gateway] = await Promise.all([
    source("app/ai-routing-panel.tsx"),
    source("build/ai-routing-gateway.ts"),
  ]);
  for (const phrase of [
    "Ollama · Local",
    "OpenAI · Cloud",
    "MiniMax Text · Cloud",
    "ComfyUI · Local",
    "Ollama + ComfyUI · Local",
    "OpenAI Images · Cloud",
    "MiniMax Images · Cloud",
    "ComfyUI H3 · Local",
    "OpenAI Video · Cloud",
    "MiniMax H3 · Cloud",
  ]) assert.ok(panel.includes(phrase), `Missing provider switch: ${phrase}`);
  for (const contract of [
    'export type TextRoute = "ollama" | "openai" | "minimax" | "off"',
    'export type ImageRoute = "comfyui" | "ollama-comfyui" | "openai" | "minimax" | "manual"',
    'export type VideoRoute = "comfyui-native" | "minimax" | "openai" | "off"',
  ]) assert.ok(gateway.includes(contract), `Missing routing type: ${contract}`);
  assert.match(panel, /type="radio"/);
  assert.match(panel, /name=\{`ai-route-\$\{capability\}`\}/);
});

test("issue #353 makes the exact active configuration visible", async () => {
  const [panel, css] = await Promise.all([
    source("app/ai-routing-panel.tsx"),
    source("app/ai-routing-panel.module.css"),
  ]);
  for (const phrase of [
    "Current configuration",
    "Active now",
    "These are the exact providers, models and workflows PlotPickle will use at this moment",
    "Model / workflow",
    "Last successful test",
    "Location",
    "Cost",
    "Refresh current configuration",
  ]) assert.ok(panel.includes(phrase), `Missing active configuration field: ${phrase}`);
  for (const contract of [
    ".activeNow",
    ".activeGrid",
    'data-tone="green"',
    'data-tone="yellow"',
    'data-tone="red"',
    "@media (forced-colors: active)",
  ]) assert.ok(css.includes(contract), `Missing active configuration style: ${contract}`);
});

test("issue #353 supports explicit local and cloud presets without silent paid fallback", async () => {
  const [panel, gateway] = await Promise.all([
    source("app/ai-routing-panel.tsx"),
    source("build/ai-routing-gateway.ts"),
  ]);
  for (const phrase of [
    "Use local-first setup",
    "Switch to cloud setup",
    'route: "ollama"',
    'route: "ollama-comfyui"',
    'route: "comfyui-native"',
    'route: "openai"',
    'route: "minimax"',
    "Confirm cloud charges and video data sharing",
  ]) assert.ok(panel.includes(phrase), `Missing preset contract: ${phrase}`);
  assert.match(gateway, /silentPaidFallback: false/);
  assert.match(gateway, /requirePaidConsent/);
  assert.match(gateway, /dataSharingAcknowledged !== true/);
  assert.doesNotMatch(panel, /\/test\/image|\/test\/video/);
});

test("issue #353 discovers selects persists and tests Ollama models", async () => {
  const [provider, store, gateway, consoleSource] = await Promise.all([
    source("build/writing-assistant-provider.ts"),
    source("build/writing-assistant-store.ts"),
    source("build/writing-assistant-gateway.ts"),
    source("app/writing-assistant-console.tsx"),
  ]);
  for (const contract of [
    "export async function probeOllama",
    'fetch(`${normalized}/api/tags`',
    'fetch(`${normalized}/api/version`',
    "latencyMs",
    "checkedAt",
  ]) assert.ok(provider.includes(contract), `Missing Ollama probe contract: ${contract}`);
  assert.ok(store.includes("ollamaBaseUrl"));
  assert.ok(store.includes("writing-assistant-profiles.json"));
  for (const contract of [
    'const OLLAMA_CONNECTION_PATH = `${OLLAMA_PATH}/connection`',
    "handleOllamaConnection",
    "probe.models.includes(model)",
    'testAssistantProfile(store, "ollama")',
  ]) assert.ok(gateway.includes(contract), `Missing Ollama gateway contract: ${contract}`);
  for (const phrase of [
    "Ollama connection and model",
    "Test connection",
    "Refresh models",
    "Installed Ollama LLM",
    "Save, select &amp; test this model",
    "Selected model",
    "Connection latency",
  ]) assert.ok(consoleSource.includes(phrase), `Missing Ollama Settings control: ${phrase}`);
});

test("issue #353 separates ComfyUI service reachability from capability readiness", async () => {
  const [diagnostics, gateway, panel] = await Promise.all([
    source("build/comfyui-connection-diagnostics.ts"),
    source("build/provider-diagnostics-gateway.ts"),
    source("app/media-routing-panel.tsx"),
  ]);
  for (const contract of [
    "serviceReady",
    "capabilityError",
    "missingImageNodes",
    "missingWorkflowNodes",
    "checkpoints",
    'requestJson(baseUrl, "/system_stats")',
    "ComfyUI is running, but PlotPickle is not ready to generate yet",
    "localhost:8188",
  ]) assert.ok(diagnostics.includes(contract), `Missing ComfyUI diagnostic contract: ${contract}`);
  assert.ok(gateway.includes('const COMFYUI_PATH = `${API_ROOT}/comfyui`'));
  assert.ok(gateway.includes("diagnoseComfyUI"));
  for (const phrase of [
    "Save & run live ComfyUI diagnostic",
    "Running · setup needed",
    "Not connected",
    "Last checked",
  ]) assert.ok(panel.includes(phrase), `Missing ComfyUI interface state: ${phrase}`);
});

test("issue #353 routes Ollama-assisted images through ComfyUI rather than claiming Ollama renders pixels", async () => {
  const [gateway, doc] = await Promise.all([
    source("build/ai-routing-gateway.ts"),
    source("docs/AI-ROUTING-DIAGNOSTICS.md"),
  ]);
  for (const contract of [
    "createOllamaComfyImage",
    "generateAssistantText",
    "generateComfyImage",
    "Rewrite the writer's request as one concise cinematic image-generation prompt",
    'route: "ollama-comfyui"',
    "promptModel",
  ]) assert.ok(gateway.includes(contract), `Missing Ollama + ComfyUI contract: ${contract}`);
  assert.match(doc, /does not claim that Ollama itself renders pixels/);
});

test("issue #353 keeps credentials and configuration outside story files and refreshes Dashboard status", async () => {
  const [routing, store, panel, consoleSource] = await Promise.all([
    source("build/ai-routing-gateway.ts"),
    source("build/writing-assistant-store.ts"),
    source("app/ai-routing-panel.tsx"),
    source("app/writing-assistant-console.tsx"),
  ]);
  assert.match(routing, /ai-routing\.json/);
  assert.match(store, /writing-assistant-profiles\.json/);
  assert.doesNotMatch(routing + store, /PlotPickleProject|project\.json|\.ppf/);
  for (const sourceText of [panel, consoleSource]) {
    assert.ok(sourceText.includes("requestConnectionStatusRefresh"));
    assert.ok(sourceText.includes("plotpickle:setup-status-refresh"));
  }
});
