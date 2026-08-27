import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1026/#1377 AI Routing opens the shared Local or Cloud Compute owner without duplicating provider sections", async () => {
  const [routing, settings, compute, providerSetup] = await Promise.all([
    read("app/ai-routing-panel.tsx"),
    read("app/sage-settings-workspace.tsx"),
    read("app/settings/compute/ai-compute-workspace.tsx"),
    read("app/settings/ai-provider/ai-provider-setup-panel.tsx"),
  ]);

  assert.match(settings, /id=["']settings-local-compute["']/);
  assert.match(settings, /id=["']settings-cloud-compute["']/);
  assert.match(settings, /id=["']settings-comfyui["']/);
  assert.match(settings, /"settings-ollama": "local-compute"/);
  assert.match(settings, /"settings-comfyui": "comfyui"/);
  assert.match(settings, /"settings-openai": "cloud-compute"/);
  assert.match(settings, /"settings-minimax": "cloud-compute"/);
  assert.match(routing, /type ProviderTarget = "ollama" \| "openai" \| "minimax" \| "comfyui"/);
  assert.match(routing, /route === "ollama-comfyui"\) return \["ollama", "comfyui"\]/);
  assert.match(routing, /if \(onManage\)/);
  assert.match(routing, /plotpickle:settings-section/);
  assert.match(compute, /<AiRoutingPanel/);
  assert.match(compute, /<AiProviderSetupPanel provider="openai" \/>/);
  assert.match(compute, /<AiProviderSetupPanel provider="minimax" \/>/);
  assert.match(settings, /<MediaRoutingPanel/);
  assert.doesNotMatch(compute, /<MediaRoutingPanel/);
  assert.match(compute, /detail: "comfyui"/);
  assert.match(providerSetup, /\/api\/local-ai\/connection/);
  assert.match(providerSetup, /type="password"/);
  assert.match(providerSetup, /Leave blank to keep saved key/);
});

test("#1026 normal Windows startup cannot wait on optional companion or ComfyUI maintenance", async () => {
  const [launcher, deferred, graph] = await Promise.all([
    read("Start-PlotPickle.bat"),
    read("scripts/windows-companion-maintenance-after-ready.ps1"),
    read("scripts/full-verification-graph.mjs"),
  ]);

  assert.match(launcher, /COMPANION_AFTER_READY=scripts\\windows-companion-maintenance-after-ready\.ps1/);
  assert.match(launcher, /call :start_deferred_companion_maintenance/);
  assert.doesNotMatch(launcher, /powershell\.exe[^\n]+-File "%COMPANION_MANAGER%" -Mode Maintain/);
  assert.match(deferred, /Test-PlotPickleReady/);
  assert.match(deferred, /-Mode Maintain -NoPrompt/);
  assert.ok(deferred.indexOf("Test-PlotPickleReady") < deferred.indexOf("-Mode Maintain -NoPrompt"));
  const appReady = graph.slice(graph.indexOf('id: "app-ready"'), graph.indexOf('id: "buzz-live"'));
  assert.match(appReady, /tool: "app-ready"/);
  assert.doesNotMatch(appReady, /ComfyUI|start-comfyui|Desktop/i);
});

test("#1026 explicit ComfyUI start uses the reviewed managed engine headlessly and preserves Desktop model paths", async () => {
  const [starter, onboarding] = await Promise.all([
    read("scripts/start-comfyui-background.ps1"),
    read("build/ai/comfyui-onboarding-gateway.ts"),
  ]);

  const managedStart = starter.indexOf("if (-not $mainPath -and $desktopExe -and $managedInstalled.Count -gt 0)");
  const managedEnd = starter.indexOf("if (-not $mainPath -and $desktopExe -and -not $AllowDesktopLaunch)", managedStart);
  assert.ok(managedStart >= 0 && managedEnd > managedStart);
  const managedBlock = starter.slice(managedStart, managedEnd);
  assert.match(managedBlock, /Start-Process -FilePath \$instance\.PythonPath/);
  assert.match(managedBlock, /\$instance\.MainPath/);
  assert.match(managedBlock, /--disable-auto-launch/);
  assert.match(managedBlock, /--listen/);
  assert.match(managedBlock, /--port/);
  assert.match(managedBlock, /--extra-model-paths-config/);
  assert.match(starter, /shared_model_paths\.yaml/);
  assert.doesNotMatch(managedBlock, /Open-ComfyDesktop \$desktopExe/);
  assert.match(onboarding, /start-comfyui-background\.ps1/);
  assert.match(onboarding, /-AllowDesktopLaunch/);
});

test("#1026 ComfyUI routing language distinguishes running, model readiness, testing and activation", async () => {
  const routing = await read("app/ai-routing-panel.tsx");
  for (const phrase of ["Running · Test needed", "Model ready", "Active · Model ready", "Active · Test needed"]) {
    assert.ok(routing.includes(phrase), `Missing ComfyUI readiness phrase: ${phrase}`);
  }
});
