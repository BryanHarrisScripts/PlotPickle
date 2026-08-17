import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("ComfyUI startup distinguishes Desktop installation from a ready local API", async () => {
  const starter = await source("scripts/start-comfyui-background.ps1");

  for (const contract of [
    "Find-ComfyDesktopExecutable",
    "Get-ComfyRegistryEntries",
    "DisplayIcon",
    "Test-ComfyApi",
    "/system_stats",
    "desktop-started-ready",
    "desktop-opened-api-not-ready",
    "installed-entrypoint-not-found",
  ]) {
    assert.ok(starter.includes(contract), `Missing ComfyUI Desktop readiness contract: ${contract}`);
  }

  assert.ok(
    starter.indexOf("Test-ComfyApi $endpoint.BaseUrl") < starter.indexOf("Find-ComfyDesktopExecutable"),
    "The existing local API must be accepted before trying to start another process",
  );
});

test("ComfyUI Desktop can be opened without replacing classic or portable ComfyUI support", async () => {
  const starter = await source("scripts/start-comfyui-background.ps1");

  assert.match(starter, /Start-Process -FilePath \$desktopExe -PassThru/);
  assert.match(starter, /Find-ComfyMain/);
  assert.match(starter, /python_embeded\\python\.exe/);
  assert.match(starter, /--dont-launch-browser/);
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
    "PlotPickle did not start a model/H3 download",
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
