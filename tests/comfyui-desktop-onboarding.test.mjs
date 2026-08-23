import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("ComfyUI startup distinguishes Desktop installation from a ready local engine", async () => {
  const starter = await source("scripts/start-comfyui-background.ps1");

  for (const contract of [
    "Find-ComfyDesktopExecutable",
    "Get-ComfyRegistryEntries",
    "DisplayIcon",
    "Test-ComfyApi",
    "/system_stats",
    "desktop-installed-not-running",
    "desktop-started-ready",
    "desktop-opened-api-not-ready",
    "installed-entrypoint-not-found",
  ]) {
    assert.ok(starter.includes(contract), `Missing ComfyUI Desktop readiness contract: ${contract}`);
  }

  assert.ok(
    starter.indexOf("if (Test-ComfyApi $endpoint.BaseUrl)") < starter.indexOf("$desktopExe = Find-ComfyDesktopExecutable"),
    "The existing local engine must be accepted before trying to start another process",
  );
});

test("ComfyUI Desktop remains optional while explicit startup may launch the managed local engine", async () => {
  const starter = await source("scripts/start-comfyui-background.ps1");

  assert.match(starter, /\[switch\]\$AllowDesktopLaunch/);
  assert.match(starter, /if \(-not \$AllowDesktopLaunch\)[\s\S]*desktop-managed-engine-stopped/);
  assert.match(starter, /Starting Comfy Desktop's managed ComfyUI engine headlessly/);
  assert.match(starter, /without requiring a Desktop Launch click/);
  assert.match(starter, /Start-Process -FilePath \$instance\.PythonPath/i);
  assert.match(starter, /Start-Process -FilePath \$desktopExe -PassThru/i);
});

test("Desktop support does not replace classic or portable ComfyUI", async () => {
  const starter = await source("scripts/start-comfyui-background.ps1");

  assert.match(starter, /Find-ComfyMain/);
  assert.match(starter, /python_embeded\\python\.exe/);
  assert.match(starter, /--disable-auto-launch/);
  assert.match(starter, /--listen/);
  assert.match(starter, /--port/);
  assert.match(starter, /Wait-ComfyApi/);
});

test("Desktop onboarding remains local-only and does not silently install model packs", async () => {
  const starter = await source("scripts/start-comfyui-background.ps1");

  for (const contract of [
    "127.0.0.1",
    "localhost",
    "ComfyUI startup is restricted to a local HTTP address",
    "PlotPickle will not install checkpoints, workflows, or large video/H3 model packs automatically",
    "PlotPickle did not start a checkpoint, model, workflow, or H3 download",
  ]) {
    assert.ok(starter.includes(contract), `Missing safe onboarding contract: ${contract}`);
  }

  assert.doesNotMatch(starter, /Invoke-WebRequest\s+.*(?:huggingface|civitai)/i);
  assert.doesNotMatch(starter, /git\s+clone/i);
  assert.doesNotMatch(starter, /winget\s+install/i);
});

test("the focused live verifier remains the end-to-end local acceptance test", async () => {
  const verifier = await source("scripts/verify-comfyui-live.mjs");
  const runner = await source("Run-PlotPickle-ComfyUI-Check.bat");

  assert.ok(verifier.includes("Ollama → PlotPickle → local ComfyUI image"));
  assert.ok(verifier.includes("/api/media-routing/test/image"));
  assert.match(runner, /verify-comfyui-live\.mjs/);
  assert.doesNotMatch(
    runner.split(/\r?\n/).find((line) => /^node /i.test(line.trim())) || "",
    /--live-cloud|--live-paid-h3|--live-native-h3/,
  );
});
