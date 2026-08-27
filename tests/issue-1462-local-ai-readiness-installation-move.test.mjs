import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const read = (relative) => readFile(new URL(relative, root), "utf8");

const moved = [
  ["build/local-ai-installation-status.ts", "build/ai/local-ai-installation-status.ts"],
  ["build/local-ai-installation-gateway.ts", "build/ai/local-ai-installation-gateway.ts"],
  ["build/local-ai-readiness.ts", "build/ai/local-ai-readiness.ts"],
];

test("#1462 retires the flat local AI readiness and installation sources without compatibility shims", async () => {
  for (const [source, target] of moved) {
    await assert.rejects(access(new URL(source, root)), `${source} must be retired after the move`);
    await access(new URL(target, root));
  }

  const [composition, runtimeGateway, registryText, installationGateway] = await Promise.all([
    read("build/local-ai-gateway.ts"),
    read("build/local-runtime-gateway.ts"),
    read("config/ai-source-registry.json"),
    read("build/ai/local-ai-installation-gateway.ts"),
  ]);
  const registry = JSON.parse(registryText);

  assert.match(composition, /\.\/ai\/local-ai-installation-gateway/);
  assert.doesNotMatch(composition, /from "\.\/local-ai-installation-gateway"/);
  assert.match(runtimeGateway, /\.\/ai\/local-ai-readiness/);
  assert.doesNotMatch(runtimeGateway, /from "\.\/local-ai-readiness"/);
  assert.match(installationGateway, /from "\.\/local-ai-installation-status"/);
  assert.ok(registry.extensionPoints.diagnosticConsumers.includes("build/ai/local-ai-installation-gateway.ts"));
  assert.ok(!registry.extensionPoints.diagnosticConsumers.includes("build/local-ai-installation-gateway.ts"));
});

test("#1462 preserves reviewed local installation detection and loopback-only status probes", async () => {
  const [detector, gateway] = await Promise.all([
    read("build/ai/local-ai-installation-status.ts"),
    read("build/ai/local-ai-installation-gateway.ts"),
  ]);

  for (const contract of [
    "CACHE_MS = 30_000",
    'path.join(process.env.LOCALAPPDATA, "Programs", "Ollama", "ollama.exe")',
    "ComfyUI Desktop",
    "^(ComfyUI|Comfy Desktop)",
    "where.exe",
    "powershell.exe",
    '"-NoProfile"',
    '"-NonInteractive"',
  ]) assert.ok(detector.includes(contract), `Missing local installation contract: ${contract}`);

  for (const contract of [
    'const API_PATH = "/api/local-ai/installations"',
    'const LLAMA_CPP_URL = "http://127.0.0.1:8080/v1/models"',
    'const LM_STUDIO_URL = "http://127.0.0.1:1234/v1/models"',
    'const OLLAMA_COMPAT_URL = "http://127.0.0.1:11434/v1/models"',
    'const COMFYUI_URL = "http://127.0.0.1:8188/system_stats"',
    'request.method !== "GET"',
    "isLocalRequest(request)",
    "new URL(origin).host === hostUrl.host",
    "AbortSignal.timeout(1_500)",
  ]) assert.ok(gateway.includes(contract), `Missing installation gateway contract: ${contract}`);

  assert.doesNotMatch(`${detector}\n${gateway}`, /0\.0\.0\.0|Invoke-Expression|\biex\b/i);
});

test("#1462 preserves bounded local readiness probing, managed-start behavior and private evidence", async () => {
  const readiness = await read("build/ai/local-ai-readiness.ts");

  for (const contract of [
    "Local AI readiness refuses non-loopback inference targets.",
    "Local AI readiness requires an HTTP loopback endpoint.",
    "timeoutMs = 12_000",
    "`${baseUrl}/chat/completions`",
    'method: "POST"',
    "max_tokens: 4",
    "temperature: 0",
    "attemptManagedStart",
    'startManagedLlama("fast")',
    "LOCAL_AI_READINESS_FILE",
    "persistentHome()",
    "mode: 0o600",
  ]) assert.ok(readiness.includes(contract), `Missing readiness contract: ${contract}`);

  assert.match(readiness, /\.\.\/\.\.\/lib\/runtime\/ai\/local-runtime/);
  assert.match(readiness, /from "\.\.\/local-credentials"/);
  assert.match(readiness, /from "\.\.\/local-runtime-manager"/);
});

test("#1462 keeps the larger AI move batch open after this bounded slice", async () => {
  const config = JSON.parse(await read("config/repository-architecture-target.json"));
  const batch = config.moveBatches.find((item) => item.id === "phase1-build-ai");
  assert.notEqual(batch?.status, "completed", "the AI batch must remain open until every ratified AI root is moved");
});
