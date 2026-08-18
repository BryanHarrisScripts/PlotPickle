import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("managed Comfy Desktop discovery is bounded to current known Windows roots", async () => {
  const core = await read("scripts/comfyui-managed-instance-core.ps1");
  assert.match(core, /Comfy-Desktop\\ComfyUI-Installs/);
  assert.match(core, /ComfyUI-Installs/);
  assert.match(core, /Get-ChildItem -LiteralPath \$root -Directory/);
  assert.doesNotMatch(core, /Get-ChildItem[^\n]*-Recurse/i);
  assert.match(core, /ComfyUI"\), \$directory\.FullName/);
  assert.match(core, /\.venv/);
  assert.match(core, /State = \$state/);
});

test("starter distinguishes no-instance, provisioning, stopped, crash, wrong-port and ready states", async () => {
  const starter = await read("scripts/start-comfyui-background.ps1");
  for (const status of [
    "desktop-no-managed-instance",
    "desktop-instance-provisioning",
    "desktop-managed-engine-stopped",
    "desktop-managed-engine-crashed",
    "desktop-pascal-stack-incompatible",
    "desktop-api-wrong-port",
    "desktop-started-ready",
    "started-ready",
  ]) assert.ok(starter.includes(status), `Missing managed ComfyUI readiness state: ${status}`);

  assert.match(starter, /choose New Instance/i);
  assert.match(starter, /Installation or package provisioning appears to still be in progress/i);
  assert.match(starter, /Get-ComfyManagedCrashEvidence/);
  assert.match(starter, /\/system_stats/);
  assert.match(starter, /did not download a model or enable cloud fallback/i);
});

test("passive managed-instance inspection never repairs PyTorch or downloads models", async () => {
  const [core, starter] = await Promise.all([
    read("scripts/comfyui-managed-instance-core.ps1"),
    read("scripts/start-comfyui-background.ps1"),
  ]);
  assert.doesNotMatch(core, /pip install|Invoke-WebRequest|Start-BitsTransfer/i);
  assert.doesNotMatch(starter, /pip install|download\.pytorch\.org\/whl/i);
  assert.match(starter, /Passive verification will not modify it/);
  assert.match(starter, /-Mode Configure -ConfigureComfyUI/);
  assert.match(starter, /if \(-not \$AllowDesktopLaunch\)[\s\S]*desktop-managed-engine-stopped/);
});

test("Pascal compatibility uses the current reviewed ComfyUI CUDA 12.6 standalone pins", async () => {
  const [core, configurator] = await Promise.all([
    read("scripts/comfyui-managed-instance-core.ps1"),
    read("scripts/configure-hardware-aware-local-ai.ps1"),
  ]);
  assert.match(core, /Torch = "2\.10\.0\+cu126"/);
  assert.match(core, /TorchVision = "0\.25\.0\+cu126"/);
  assert.match(core, /TorchAudio = "2\.10\.0\+cu126"/);
  assert.match(core, /download\.pytorch\.org\/whl\/cu126/);
  assert.match(core, /Test-ComfyPascalCu126Stack/);
  assert.match(configurator, /Get-ComfyManagedInstances/);
  assert.match(configurator, /Explicit repair approved/);
  assert.match(configurator, /"torch==\$\(\$PascalStack\.Torch\)"/);
  assert.match(configurator, /"torchvision==\$\(\$PascalStack\.TorchVision\)"/);
  assert.match(configurator, /"torchaudio==\$\(\$PascalStack\.TorchAudio\)"/);
  assert.match(configurator, /CUDA 13 auto-install:\s+disabled/);
});

test("managed environment diagnosis is filesystem-based and crash evidence is bounded", async () => {
  const core = await read("scripts/comfyui-managed-instance-core.ps1");
  assert.match(core, /pyvenv\.cfg/);
  assert.match(core, /torch-\*\.dist-info/);
  assert.match(core, /torchvision-\*\.dist-info/);
  assert.match(core, /torchaudio-\*\.dist-info/);
  assert.match(core, /Get-Content -LiteralPath \$logPath -Tail 160/);
  assert.match(core, /Windows fatal exception\|access violation\|0xC0000005\|3221225477/);
  assert.doesNotMatch(core, /torch\.cuda\.is_available|torch\.cuda\.get_device/i);
});

test("explicit managed startup reuses Desktop's engine and model paths without requiring a Desktop Launch click", async () => {
  const starter = await read("scripts/start-comfyui-background.ps1");
  const managedStart = starter.indexOf("if (-not $mainPath -and $desktopExe -and $managedInstalled.Count -gt 0)");
  const classicStart = starter.indexOf('[STARTING] Starting classic/portable ComfyUI as a hidden local backend');
  assert.ok(managedStart >= 0, "managed Desktop branch must exist");
  assert.ok(classicStart > managedStart, "classic headless start must remain a later, separate path");
  const managedBlock = starter.slice(managedStart, classicStart);
  assert.match(managedBlock, /if \(-not \$AllowDesktopLaunch\)/);
  assert.match(managedBlock, /Start-Process -FilePath \$instance\.PythonPath/);
  assert.match(managedBlock, /\$instance\.MainPath/);
  assert.match(managedBlock, /--disable-auto-launch/);
  assert.match(managedBlock, /--listen/);
  assert.match(managedBlock, /--port/);
  assert.match(managedBlock, /--extra-model-paths-config/);
  assert.match(managedBlock, /shared_model_paths\.yaml/);
  assert.match(managedBlock, /instance-model-paths/);
  assert.match(managedBlock, /without requiring a Desktop Launch click/);
  assert.doesNotMatch(managedBlock, /Open-ComfyDesktop \$desktopExe/);
});
