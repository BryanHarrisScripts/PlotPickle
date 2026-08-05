import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #358 defines one reviewed minimal Ollama starter model", async () => {
  const config = JSON.parse(await source("config/ollama-starter-model.json"));
  assert.equal(config.model, "smollm2:135m-instruct-q2_K");
  assert.equal(config.approximateDownloadBytes, 92274688);
  assert.match(config.qualityBoundary, /not the recommended model for final story development/i);
  assert.equal(config.officialLibraryUrl, "https://ollama.com/library/smollm2:135m-instruct-q2_K");
});

test("issue #358 inventories only curated PlotPickle companion software", async () => {
  const script = await source("scripts/windows-companion-software.ps1");
  for (const contract of [
    "PLOTPICKLE COMPANION SOFTWARE - BEFORE MAINTENANCE",
    "PLOTPICKLE COMPANION SOFTWARE - READY STATE",
    '-Name "Node.js"',
    '-Name "npm"',
    'Name = "Ollama"',
    'Name = "ComfyUI Desktop"',
    'Name = "Buzz Desktop / CLI"',
    '-Name "Git"',
    '-Name "GitHub CLI"',
    "Unrelated installed applications are never enumerated",
  ]) assert.ok(script.includes(contract), `Missing curated inventory contract: ${contract}`);
  assert.doesNotMatch(script, /Win32_Product|Get-Package\s+(?!-Name)|winget\s+list\s*$/im);
});

test("issue #358 performs bounded best-effort companion maintenance", async () => {
  const [manager, localAi, buzz] = await Promise.all([
    source("scripts/windows-companion-software.ps1"),
    source("scripts/install-local-ai-tool.ps1"),
    source("scripts/install-buzz-desktop.ps1"),
  ]);
  for (const packageId of ["OpenJS.NodeJS.LTS", "Git.Git", "GitHub.cli", "Ollama.Ollama", "Comfy.ComfyUI-Desktop"]) {
    assert.ok(`${manager}\n${localAi}`.includes(packageId), `Missing reviewed update package: ${packageId}`);
  }
  assert.match(manager, /A third-party update failure never blocks core PlotPickle or No AI mode/);
  assert.match(localAi, /\[switch\]\$Maintain/);
  assert.match(buzz, /\[switch\]\$Maintain/);
  assert.match(buzz, /reviewed package is \$version/);
  assert.doesNotMatch(`${manager}\n${localAi}\n${buzz}`, /Invoke-Expression|\biex\b|--silent|--quiet/i);
});

test("issue #358 installs the starter only through allowlisted loopback Ollama APIs", async () => {
  const [installer, gateway, host] = await Promise.all([
    source("scripts/install-local-ai-tool.ps1"),
    source("build/ollama-bootstrap-gateway.ts"),
    source("build/local-ai-gateway.ts"),
  ]);
  for (const contract of [
    '"http://127.0.0.1:11434/api/tags"',
    '"http://127.0.0.1:11434/api/pull"',
    'model = $StarterModel; stream = $false',
    "Get-OllamaModels",
    "Install-OllamaStarterModel",
    "PlotPickle will continue in No AI mode",
  ]) assert.ok(installer.includes(contract), `Missing Windows model bootstrap contract: ${contract}`);
  for (const contract of [
    'const API_PATH = "/api/ollama-bootstrap/starter-model"',
    'const OLLAMA_BASE_URL = "http://127.0.0.1:11434"',
    "starterSource.model",
    "JSON.stringify({ model: STARTER_MODEL, stream: false })",
    "AbortSignal.timeout(PULL_TIMEOUT_MS)",
    "isLocalRequest(request)",
    "models.includes(STARTER_MODEL)",
  ]) assert.ok(gateway.includes(contract), `Missing local gateway bootstrap contract: ${contract}`);
  assert.match(host, /registerOllamaBootstrapGateway\(server\)/);
  assert.doesNotMatch(gateway, /0\.0\.0\.0/);
  assert.doesNotMatch(gateway, /\bbody\.model\b|requestedModel|readBody\s*\(/i);
});

test("issue #358 exposes a direct Settings recovery action and refreshes models", async () => {
  const panel = await source("app/writing-assistant-console.tsx");
  for (const contract of [
    'const STARTER_MODEL_PATH = "/api/ollama-bootstrap/starter-model"',
    "async function installStarterModel()",
    "Install starter model",
    "reviewed 88 MB SmolLM2 starter",
    "await refreshStatus()",
    "refreshDashboardLights()",
    "Save, select &amp; test this model",
  ]) assert.ok(panel.includes(contract), `Missing Settings starter-model recovery: ${contract}`);
  assert.match(panel, /status\?\.ollama\.reachable && !status\.ollama\.models\.length/);
});

test("issue #358 runs companion inventory during Windows startup without blocking core mode", async () => {
  const launcher = await source("Start-PlotPickle.bat");
  for (const contract of [
    'set "COMPANION_MANAGER=scripts\\windows-companion-software.ps1"',
    "[COMPANION CHECK] Listing PlotPickle-relevant software",
    'powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%COMPANION_MANAGER%" -Mode Maintain',
    "PlotPickle will continue and No AI mode remains available",
    "The companion-software inventory is missing",
  ]) assert.ok(launcher.includes(contract), `Missing Windows startup companion contract: ${contract}`);
});

test("issue #358 documents the ownership and quality boundaries", async () => {
  const doc = await source("docs/ISSUE-358-COMPANION-SOFTWARE.md");
  for (const phrase of [
    "It does not enumerate unrelated Windows applications",
    "third-party update failure",
    "not presented as a production-quality story model",
    "local loopback Ollama service",
    "never enables cloud fallback",
  ]) assert.ok(doc.includes(phrase), `Missing companion maintenance documentation: ${phrase}`);
});
