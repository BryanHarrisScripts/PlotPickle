import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("PlotPickle discovers Comfy Desktop registered managed instances instead of depending on the Desktop exe", async () => {
  const core = await source("scripts/comfyui-managed-instance-core.ps1");

  for (const contract of [
    "Get-ComfyDesktopInstallationRegistryFiles",
    "Get-ComfyDesktopRegisteredInstallPaths",
    "installations.json",
    "installPath",
    'Join-Path $env:APPDATA "Comfy Desktop"',
    'Join-Path $env:LOCALAPPDATA "Comfy Desktop"',
    "Split-Path -Parent $installPath",
  ]) assert.ok(core.includes(contract), `Missing managed Comfy Desktop discovery contract: ${contract}`);
});

test("managed ComfyUI startup is headless-first and only enters the Desktop-capable branch after proving a managed engine exists", async () => {
  const gateway = await source("build/ai/comfyui-onboarding-gateway.ts");

  assert.match(gateway, /const MANAGED_STOPPED_STATES = new Set\(\["desktop-managed-engine-stopped"\]\)/u);
  const inspect = gateway.indexOf("const inspected = await runWindowsStarter(false)");
  const guard = gateway.indexOf("MANAGED_STOPPED_STATES.has(inspected.state)", inspect);
  const start = gateway.indexOf("return runWindowsStarter(true)", guard);
  assert.ok(inspect >= 0 && guard > inspect && start > guard, "Headless managed discovery must happen before the Desktop-capable launcher branch");
  assert.match(gateway, /manager: allowDesktopLaunch \? "managed-desktop-instance" : "managed-local-probe"/u);
  assert.match(gateway, /comfy-cli started the managed local ComfyUI service/u);
});

test("Skin V1 automatically bootstraps the fixed local image service without introducing cloud fallback", async () => {
  const runtime = await source("app/skin-v1-runtime.tsx");

  assert.match(runtime, /bootstrapManagedLocalImages/u);
  assert.match(runtime, /status\.imageRoute !== "comfyui"/u);
  assert.match(runtime, /status\.comfyui\?\.reachable/u);
  assert.match(runtime, /\/api\/media-routing\/comfyui\/start/u);
  assert.match(runtime, /approved: true/u);
  assert.match(runtime, /skin-v1-local-image-default/u);
  assert.match(runtime, /plotpickle:setup-status-refresh/u);
  assert.doesNotMatch(runtime, /api\.openai\.com|generativelanguage\.googleapis\.com|api\.minimax/u);
});

test("the managed engine remains a hidden loopback service with a direct health probe", async () => {
  const [manifest, starter] = await Promise.all([
    source("config/runtime-manifest.json"),
    source("scripts/start-comfyui-background.ps1"),
  ]);

  assert.match(manifest, /"id": "comfyui-engine"/u);
  assert.match(manifest, /"launchStrategy": "managed-script"/u);
  assert.match(manifest, /http:\/\/127\.0\.0\.1:8188\/system_stats/u);
  assert.match(manifest, /"hideManagedConsoles": true/u);
  assert.match(starter, /Starting Comfy Desktop's managed ComfyUI engine headlessly/u);
  assert.match(starter, /Start-Process -FilePath \$instance\.PythonPath/u);
  assert.match(starter, /-WindowStyle Hidden/u);
});
