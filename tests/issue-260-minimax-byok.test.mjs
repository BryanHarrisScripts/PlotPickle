import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #260 registers MiniMax without removing existing provider choices", async () => {
  const [contracts, providers, settings] = await Promise.all([
    source("lib/ai/contracts.ts"),
    source("lib/ai/providers.ts"),
    source("lib/ai/settings.ts"),
  ]);
  assert.match(contracts, /"openai" \| "minimax" \| "openai-compatible" \| "ollama" \| "manual" \| "disabled"/);
  for (const value of ["MiniMax API", "https://api.minimax.io", "MiniMax-M3", "image-01", "MiniMax-H3", "video-generation"]) {
    assert.ok(providers.includes(value), `Missing MiniMax provider contract: ${value}`);
  }
  assert.match(providers, /PlotPickle does not supply credits or pay for generation/);
  assert.match(settings, /SETTINGS_VERSION = "1\.3\.0"/);
  assert.match(settings, /videoModel: string/);
  assert.match(settings, /"openai", "minimax", "openai-compatible", "ollama", "manual", "disabled"/);
});

test("issue #260 adapter matches MiniMax image and H3 v2 contracts", async () => {
  const adapters = await source("lib/ai/adapters.ts");
  for (const contract of [
    "class MiniMaxAdapter",
    "/v1/models",
    "/v1/chat/completions",
    "/v1/image_generation",
    'response_format: "base64"',
    'n: 1',
    "/v2/video_generation",
    "/v2/query/video_generation/",
    'method: "DELETE"',
    'role: "first_frame"',
    'resolution: "2K"',
    "billing-confirmation-required",
    "insufficient-balance",
    "rate-limited",
    "provider-safety-rejection",
  ]) assert.ok(adapters.includes(contract), `Missing MiniMax adapter contract: ${contract}`);
});

test("issue #260 local gateway enforces BYOK and paid-call confirmation", async () => {
  const gateway = await source("build/local-ai-gateway-base.ts");
  for (const contract of [
    'type LiveProvider = "openai" | "minimax" | "openai-compatible" | "ollama"',
    'value.provider === "minimax" ? `${baseUrl}/v1/models`',
    "owned by the current user",
    "billingAcknowledged !== true",
    "requestCount !== 1",
    "/v1/image_generation",
    'response_format: "base64"',
    'subject_reference: [{ type: "character"',
    "video-jobs.json",
    "/v2/video_generation",
    "/v2/query/video_generation/",
    "MiniMax can cancel only a queued job",
    "reviewState: \"unreviewed\"",
    "MAX_VIDEO_BYTES",
  ]) assert.ok(gateway.includes(contract), `Missing MiniMax gateway contract: ${contract}`);
  const publicBlock = gateway.slice(gateway.indexOf("function publicConnection"), gateway.indexOf("function normalizedUrl"));
  assert.doesNotMatch(publicBlock, /apiKey/);
  assert.match(gateway, /insufficient balance[\s\S]*PlotPickle does not supply credits/i);
  assert.match(gateway, /will not switch to another paid provider automatically/);
});

test("issue #260 all shipped image call sites send one-request billing consent", async () => {
  const paths = [
    "app/use-graphic-novel-queue.ts",
    "app/use-cast-identity-queue.ts",
    "app/ai-pitch-deck-workspace-base.tsx",
    "app/character-image-generator.tsx",
    "app/visual-storyboard.tsx",
  ];
  for (const path of paths) {
    const value = await source(path);
    assert.match(value, /requestCount: 1/, `${path} does not limit the confirmed request count`);
    assert.match(value, /billingAcknowledged/, `${path} does not send billing acknowledgement`);
  }
});

test("issue #260 settings and dashboard explain user-owned billing", async () => {
  const [settings, dashboard, readme, architecture] = await Promise.all([
    source("app/settings-panel-legacy.tsx"),
    source("app/setup-connections-dashboard.tsx"),
    source("README.md"),
    source("docs/ai-architecture.md"),
  ]);
  for (const phrase of [
    "Bring your own MiniMax account",
    "PlotPickle does not supply credits",
    "Create or manage MiniMax API key",
    "Review MiniMax pricing",
  ]) assert.ok(settings.includes(phrase), `Missing MiniMax settings copy: ${phrase}`);
  for (const phrase of [
    "Cloud images & video · OpenAI, MiniMax or another provider",
    "Create MiniMax API key",
    "MiniMax H3 video guide",
    "never falls back to cloud automatically",
  ]) assert.ok(dashboard.includes(phrase), `Missing MiniMax dashboard copy: ${phrase}`);
  assert.match(readme, /ships no MiniMax key, shared billing proxy or credits/);
  assert.match(readme, /Animate Panel[\s\S]*next UI increment/);
  assert.match(architecture, /shared proxy, bundled credit pool or automatic paid fallback/);
});

test("issue #260 regression is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-260-minimax-byok\.test\.mjs/);
  assert.equal(packageJson.scripts["test:minimax-byok"], "node --test tests/issue-260-minimax-byok.test.mjs");
});
