import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #376 exposes the complete supported writing image and video matrix", async () => {
  const panel = await source("app/ai-routing-panel.tsx");
  for (const route of [
    "Ollama · Local",
    "OpenAI · Cloud",
    "MiniMax Text · Cloud",
    "Off",
    "Manual Import",
    "ComfyUI · Local",
    "Ollama + ComfyUI · Local",
    "OpenAI Images · Cloud",
    "MiniMax Images · Cloud",
    "ComfyUI H3 · Local",
    "OpenAI Video · Cloud",
    "MiniMax H3 · Cloud",
  ]) assert.ok(panel.includes(route), `Missing supported route: ${route}`);
  assert.match(panel, /name=\{`ai-route-\$\{capability\}`\}/);
  assert.match(panel, /type="radio"/);
  assert.doesNotMatch(panel, /type="checkbox"[^>]*name=\{`ai-route/);
});

test("issue #376 adds one compact active source console without forcing one global source", async () => {
  const panel = await source("app/ai-routing-panel.tsx");
  for (const contract of [
    "System Source Console",
    "ACTIVE SOURCE:",
    'localActive && cloudActive ? "HYBRID"',
    "NO AI / MANUAL",
    "Current configuration",
    "Active now",
    "These are the exact providers, models and workflows PlotPickle will use at this moment",
    "Model / workflow",
    "Last successful test",
    "Location",
    "Cost",
  ]) assert.ok(panel.includes(contract), `Missing source-console contract: ${contract}`);
  assert.doesNotMatch(panel, /globalLocalCloud|singleSourceMode/);
});

test("issue #376 separates installed configured running ready active and off", async () => {
  const panel = await source("app/ai-routing-panel.tsx");
  for (const phrase of [
    "Installed &amp; available",
    "Installed or configured is not the same as ready",
    "Installed · not running",
    "API account not configured",
    "Running",
    "Stopped",
    "Ready",
    "Not ready",
    "Active",
    "Off",
  ]) assert.ok(panel.includes(phrase), `Missing truthful state: ${phrase}`);
  assert.ok(panel.includes("installationForRoute"));
  assert.ok(panel.includes("providerCards"));
});

test("issue #376 detects only reviewed local Ollama and ComfyUI installations", async () => {
  const [detector, gateway, host] = await Promise.all([
    source("build/local-ai-installation-status.ts"),
    source("build/local-ai-installation-gateway.ts"),
    source("build/local-ai-gateway.ts"),
  ]);
  for (const contract of [
    "detectLocalAiInstallations",
    'path.join(process.env.LOCALAPPDATA, "Programs", "Ollama", "ollama.exe")',
    "ComfyUI Desktop",
    "^(ComfyUI|Comfy Desktop)",
    "where.exe",
    "CACHE_MS = 30_000",
  ]) assert.ok(detector.includes(contract), `Missing local installation detector contract: ${contract}`);
  for (const contract of [
    'const API_PATH = "/api/local-ai/installations"',
    'const OLLAMA_URL = "http://127.0.0.1:11434/api/tags"',
    'const COMFYUI_URL = "http://127.0.0.1:8188/system_stats"',
    "isLocalRequest(request)",
    "AbortSignal.timeout(1_500)",
  ]) assert.ok(gateway.includes(contract), `Missing installation gateway contract: ${contract}`);
  assert.ok(host.includes("registerLocalAiInstallationGateway(server)"));
  assert.doesNotMatch(`${detector}\n${gateway}`, /0\.0\.0\.0|Invoke-Expression|\biex\b/i);
});

test("issue #376 blocks unavailable routes in the interface and keeps free choices selectable", async () => {
  const panel = await source("app/ai-routing-panel.tsx");
  for (const contract of [
    'route === "off" || route === "manual" || option.ready',
    "disabled={Boolean(working) || !selectable}",
    "cannot be turned on yet",
    "Complete installation, configuration and a successful test before turning this route on",
    "const unavailable = choices.filter",
  ]) assert.ok(panel.includes(contract), `Missing unavailable-route gate: ${contract}`);
});

test("issue #376 preserves cloud consent local credential boundaries and Dashboard refresh", async () => {
  const panel = await source("app/ai-routing-panel.tsx");
  for (const contract of [
    "I understand cloud API requests can incur charges",
    "I understand cloud video sends the prompt and selected reference image",
    "PlotPickle never switches to a paid provider automatically",
    "Routing choices stay in encrypted local application settings",
    "requestConnectionStatusRefresh()",
    'window.dispatchEvent(new CustomEvent("plotpickle:setup-status-refresh"))',
  ]) assert.ok(panel.includes(contract), `Missing consent or refresh contract: ${contract}`);
});

test("issue #376 uses a responsive dark premium console with accessible states", async () => {
  const css = await source("app/ai-routing-source-console.module.css");
  for (const contract of [
    ".sourceConsole",
    ".installedGate",
    ".modeSelectors",
    ".providerGrid",
    ".routeBadges",
    '[data-active="true"]',
    '[data-state="active"]',
    "@media (max-width: 720px)",
    "@media (prefers-reduced-motion: reduce)",
    "@media (forced-colors: active)",
  ]) assert.ok(css.includes(contract), `Missing source-console style: ${contract}`);
});
