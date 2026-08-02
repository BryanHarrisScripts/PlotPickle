import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #258 keeps collaboration modes separate from the three creative-compute paths", async () => {
  const [setup, collaboration] = await Promise.all([
    source("app/setup-connections-dashboard.tsx"),
    source("lib/collaboration-mode.ts"),
  ]);

  for (const phrase of [
    "Choose one of three creative-compute paths",
    "1 · Local AI",
    "2 · Cloud AI",
    "3 · No AI",
    "Local writing & planning · Ollama",
    "Local image generation · ComfyUI",
    "Cloud image generation · OpenAI or another provider",
    "Manual image import",
    "Ready without AI",
  ]) assert.ok(setup.includes(phrase), `Missing creative-compute contract: ${phrase}`);

  for (const mode of [
    "Local Story Mode",
    "Writers' Room Mode",
    "Repository Collaboration Mode",
  ]) assert.ok(collaboration.includes(mode), `Collaboration mode changed or disappeared: ${mode}`);

  assert.match(setup, /Collaboration and scheduling services/);
  assert.match(setup, /PlotPickle remains fully usable when every optional AI choice is declined/);
});

test("issue #258 probes only the documented loopback Ollama and ComfyUI endpoints", async () => {
  const gateway = await source("build/local-connections-gateway.ts");
  for (const contract of [
    'http://127.0.0.1:11434/api/tags',
    'http://127.0.0.1:8188/system_stats',
    'http://127.0.0.1:8188/object_info/CheckpointLoaderSimple',
    "LOCAL_SERVICE_TIMEOUT_MS",
    "probeOllama",
    "probeComfyUI",
    "comfyCheckpointNames",
    'url.hostname !== "127.0.0.1"',
    'state: models.length ? "connected" : "configured"',
    'state: checkpoints.length ? "connected" : "configured"',
    'state: previous ? "error" : "disconnected"',
  ]) assert.ok(gateway.includes(contract), `Missing local health contract: ${contract}`);

  assert.doesNotMatch(gateway, /0\.0\.0\.0:11434|0\.0\.0\.0:8188/);
  assert.doesNotMatch(gateway, /cloud fallback/i);
});

test("issue #258 offers two independent visible Windows installation choices", async () => {
  const [launcher, installer] = await Promise.all([
    source("Start-PlotPickle.bat"),
    source("scripts/install-local-ai-tool.ps1"),
  ]);

  for (const contract of [
    'call :ensure_local_ai_tool Ollama "local writing and planning"',
    'call :ensure_local_ai_tool ComfyUI "local image generation"',
    'choice /C YN /N /M "Install %LOCAL_AI_TOOL% now? [Y/N]: "',
    "Models, checkpoints, custom nodes, and workflows are separate",
    "PlotPickle remains fully usable with No AI and manual image import",
    "PlotPickle will continue normally",
  ]) assert.ok(launcher.includes(contract), `Missing launcher contract: ${contract}`);

  for (const contract of [
    'ValidateSet("Ollama", "ComfyUI")',
    'PackageId = "Ollama.Ollama"',
    'PackageId = "Comfy.ComfyUI-Desktop"',
    'DownloadUrl = "https://ollama.com/download/windows"',
    'DownloadUrl = "https://comfy.org/download"',
    "--interactive",
    "--accept-source-agreements",
    "--accept-package-agreements",
    "Models, checkpoints and workflows remain separate",
  ]) assert.ok(installer.includes(contract), `Missing installer contract: ${contract}`);

  assert.doesNotMatch(installer, /--silent|--quiet|Invoke-Expression|iex\b/i);
  assert.doesNotMatch(installer, /ollama\s+(pull|run)|pip\s+install|git\s+clone/i);
});

test("issue #258 status copy distinguishes running software from model readiness", async () => {
  const setup = await source("app/setup-connections-dashboard.tsx");
  for (const phrase of [
    "language models are selected and downloaded separately",
    "checkpoints and reviewed workflows are configured separately",
    "No cloud provider selected",
    "No account, API key, local model or checkpoint is required",
    "Test all connections",
    "/api/local-connections",
  ]) assert.ok(setup.includes(phrase), `Missing readiness explanation: ${phrase}`);

  assert.match(setup, /refreshLocalServices/);
  assert.match(setup, /Promise\.all\(\[refreshBuzz\(\), refreshLocalServices\(\)\]\)/);
});

test("issue #258 focused regression is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-258-creative-compute-paths\.test\.mjs/);
  assert.equal(
    packageJson.scripts["test:creative-compute-paths"],
    "node --test tests/issue-258-creative-compute-paths.test.mjs",
  );
});
