import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const settings = await readFile(new URL("../lib/ai/settings.ts", import.meta.url), "utf8");
const panel = await readFile(new URL("../app/settings-panel.tsx", import.meta.url), "utf8");
const gateway = await readFile(new URL("../build/local-ai-gateway.ts", import.meta.url), "utf8");
const viteConfig = await readFile(new URL("../vite.config.ts", import.meta.url), "utf8");

test("settings keep AI, music, and future plugins in one local model", () => {
  assert.match(settings, /type PlotPickleSettings/);
  assert.match(settings, /provider: AiProviderKind/);
  assert.match(settings, /service: MusicService/);
  assert.match(settings, /status: "coming-soon"/);
});

test("settings never include API-key storage", () => {
  assert.doesNotMatch(settings, /apiKey|secretValue|accessToken/);
});

test("AI Setup verifies a saved key and displays live connection state", () => {
  assert.match(panel, /Save key & connect/);
  assert.match(panel, /API connected/);
  assert.match(panel, /Last verified/);
  assert.match(panel, /Test again/);
  assert.match(panel, /Remove saved key/);
  assert.match(panel, /\/api\/local-ai\/connection/);
});

test("the saved key stays behind the private localhost gateway", () => {
  assert.match(gateway, /PLOTPICKLE_HOME/);
  assert.match(gateway, /isLocalRequest/);
  assert.match(gateway, /0o600/);
  assert.match(gateway, /AbortSignal\.timeout/);
  assert.match(gateway, /API key was rejected/);
  assert.doesNotMatch(gateway, /console\.(?:log|error|warn)/);
  assert.match(viteConfig, /localAiGateway\(\)/);
});

test("music artist links are limited to Suno and Udio HTTPS profiles", () => {
  assert.match(settings, /"suno" \| "udio"/);
  assert.match(settings, /url\.protocol !== "https:"/);
  assert.match(settings, /hostname === "suno\.com"/);
  assert.match(settings, /hostname === "udio\.com"/);
});
