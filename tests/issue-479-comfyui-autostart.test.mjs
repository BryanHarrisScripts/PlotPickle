import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("#479 ComfyUI background starter is local-only and suppresses browser launch", async () => {
  const script = await source("scripts/start-comfyui-background.ps1");
  assert.match(script, /--dont-launch-browser/);
  assert.match(script, /--listen/);
  assert.match(script, /127\.0\.0\.1/);
  assert.match(script, /localhost/);
  assert.match(script, /::1/);
  assert.match(script, /ComfyUI startup is restricted to localhost/);
  assert.match(script, /--port/);
});

test("#479 never starts a duplicate ComfyUI service when the configured API is already healthy", async () => {
  const script = await source("scripts/start-comfyui-background.ps1");
  assert.match(script, /Test-ComfyApi -Url \$endpoint\.BaseUrl/);
  assert.match(script, /ComfyUI is already running/);
  assert.match(script, /ready-existing/);
});

test("#479 uses a hidden process and persistent diagnostics rather than opening another console", async () => {
  const script = await source("scripts/start-comfyui-background.ps1");
  assert.match(script, /Start-Process -FilePath \$python/);
  assert.match(script, /-WindowStyle Hidden/);
  assert.match(script, /-RedirectStandardOutput \$stdoutLog/);
  assert.match(script, /-RedirectStandardError \$stderrLog/);
  assert.match(script, /comfyui-startup\.log/);
  assert.match(script, /comfyui-startup-error\.log/);
});

test("#479 supports portable and virtual-environment Python layouts without assuming global Python", async () => {
  const script = await source("scripts/start-comfyui-background.ps1");
  assert.match(script, /python_embeded\\python\.exe/);
  assert.match(script, /python_embedded\\python\.exe/);
  assert.match(script, /\.venv\\Scripts\\python\.exe/);
  assert.match(script, /venv\\Scripts\\python\.exe/);
  assert.match(script, /Get-Command "python\.exe"/);
});

test("#479 polls real ComfyUI API readiness and records ownership when PlotPickle starts it", async () => {
  const script = await source("scripts/start-comfyui-background.ps1");
  assert.match(script, /system_stats/);
  assert.match(script, /while \(\(Get-Date\) -lt \$deadline\)/);
  assert.match(script, /comfyui-process\.json/);
  assert.match(script, /startedBy = "PlotPickle"/);
  assert.match(script, /started-ready/);
});
