import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (file) => readFile(new URL(`../${file}`, import.meta.url), "utf8");

test("Windows maintenance preserves ComfyUI starter readiness instead of collapsing it to installed", async () => {
  const installer = await read("scripts/install-local-ai-tool.ps1");
  assert.match(installer, /PLOTPICKLE_COMFYUI_STATUS/);
  assert.match(installer, /PLOTPICKLE_COMFYUI_DETAIL/);
  assert.match(installer, /ready-existing/);
  assert.match(installer, /desktop-started-ready/);
  assert.match(installer, /started-ready/);
  assert.match(installer, /installed-api-not-ready/);
  assert.match(installer, /if \(-not \$comfyReadiness\.Ready\) \{ exit 1 \}/);
  assert.match(installer, /ComfyUI Desktop may be installed, but its local API is not ready/);
});

test("ComfyUI starter distinguishes launch, first-run, engine, and wrong-port states on loopback only", async () => {
  const starter = await read("scripts/start-comfyui-background.ps1");
  for (const token of [
    "ready-existing",
    "desktop-installed-not-running",
    "desktop-started-ready",
    "desktop-api-wrong-port",
    "desktop-opened-api-not-ready",
    "api-wrong-port",
    "installed-entrypoint-not-found",
    "python-not-found",
    "started-ready",
    "exited-before-ready",
    "starting-timeout",
  ]) assert.ok(starter.includes(token), `Missing ComfyUI readiness state: ${token}`);

  assert.match(starter, /\/system_stats/);
  assert.match(starter, /first-run instance setup/i);
  assert.match(starter, /select\/configure a local instance/i);
  assert.match(starter, /start the local engine/i);
  assert.match(starter, /server port/i);
  assert.match(starter, /Find-AlternateComfyApi/);
  assert.match(starter, /127\.0\.0\.1/);
  assert.match(starter, /localhost/);
  assert.match(starter, /ComfyUI startup is restricted to a local HTTP address/);
  assert.match(starter, /will not install checkpoints, workflows, or large video\/H3 model packs automatically/);
});

test("focused Windows ComfyUI verification runs API readiness before live routes and generation", async () => {
  const runner = await read("Run-PlotPickle-ComfyUI-Check.bat");
  const preflight = runner.indexOf("start-comfyui-background.ps1");
  const live = runner.indexOf("verify-comfyui-live.mjs");
  assert.ok(preflight >= 0, "focused verifier must start with the reviewed ComfyUI readiness helper");
  assert.ok(live > preflight, "live route verification must run after local API readiness");
  assert.match(runner, /-BaseUrl "http:\/\/127\.0\.0\.1:8188"/);
  assert.match(runner, /-ReadyTimeoutSeconds 90 -AllowDesktopLaunch/);
  assert.match(runner, /did not install a checkpoint or switch to paid cloud/i);
});

test("native H3 presents current live readiness separately from historical output", async () => {
  const [provider, gateway, panel] = await Promise.all([
    read("build/comfyui-h3-native-provider.ts"),
    read("build/comfyui-h3-native-gateway.ts"),
    read("app/h3-native-panel.tsx"),
  ]);
  assert.match(provider, /\/system_stats/);
  assert.match(gateway, /const probe = await probeNativeH3\(store\)/);
  assert.match(gateway, /\.\.\.probe/);
  assert.match(panel, /status\.active && status\.ready \? "Active"/);
  assert.match(panel, /status\.reachable \? status\.version \|\| "Connected" : "Not connected"/);
  assert.match(panel, /<h3 id="native-h3-readiness-heading">Live readiness<\/h3>/);
  assert.match(panel, /<dt>Last local output<\/dt>/);
});

test("issue 973 recovery path never introduces cloud fallback or model download", async () => {
  const [installer, starter] = await Promise.all([
    read("scripts/install-local-ai-tool.ps1"),
    read("scripts/start-comfyui-background.ps1"),
  ]);
  assert.match(installer, /does not request a silent install or enable cloud fallback/);
  assert.match(starter, /did not start a checkpoint, model, workflow, or H3 download/);
  assert.doesNotMatch(starter, /api\.openai\.com|api\.minimax|anthropic|openrouter/i);
});
