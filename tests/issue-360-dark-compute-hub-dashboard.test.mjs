import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (file) => readFile(new URL(file, root), "utf8");

test("issue #360 makes dark Appearance the first-run default without removing system or light choices", async () => {
  const [settings, panel, runtime, layout, css] = await Promise.all([
    source("lib/ai/settings.ts"),
    source("app/settings-panel-legacy.tsx"),
    source("app/appearance-runtime.tsx"),
    source("app/layout.tsx"),
    source("app/appearance-runtime.css"),
  ]);

  assert.match(settings, /appearance:\s*\{[\s\S]*?theme:\s*"dark"/);
  assert.match(settings, /appearance\.theme === "system"/);
  assert.match(panel, /<option value="system">Use system setting<\/option>/);
  assert.match(panel, /<option value="light">Light<\/option>/);
  assert.match(panel, /<option value="dark">Dark<\/option>/);
  assert.match(runtime, /dataset\.plotpickleTheme/);
  assert.match(runtime, /plotpickle:settings-changed/);
  assert.match(runtime, /prefers-color-scheme: dark/);
  assert.match(layout, /<AppearanceRuntime \/>/);
  assert.match(layout, /data-plotpickle-theme="dark"/);
  assert.match(layout, /appearance-runtime\.css/);
  assert.match(css, /data-plotpickle-theme="dark"/);
  assert.match(css, /data-plotpickle-motion="reduced"/);
  assert.match(css, /data-plotpickle-contrast="high"/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("issue #360 exposes only loopback local system telemetry and refuses invented GPU values", async () => {
  const [gateway, vite] = await Promise.all([
    source("build/local-system-status-gateway.ts"),
    source("vite.config.ts"),
  ]);

  assert.match(gateway, /\/api\/local-system\/status/);
  assert.match(gateway, /isLocalRequest/);
  assert.match(gateway, /127\.0\.0\.1/);
  assert.match(gateway, /os\.cpus\(\)/);
  assert.match(gateway, /os\.totalmem\(\)/);
  assert.match(gateway, /statfs\(process\.cwd\(\)\)/);
  assert.match(gateway, /http:\/\/127\.0\.0\.1:8188\/queue/);
  assert.match(gateway, /GPU and VRAM telemetry are not exposed/);
  assert.match(gateway, /available:\s*false,[\s\S]*?model:\s*"Unavailable"/);
  assert.doesNotMatch(gateway, /apiKey|privateKey|credential|story content/i);
  assert.match(vite, /localSystemStatusGateway/);
  assert.match(vite, /localSystemStatusGateway\(\)/);
});

test("issue #360 keeps Compute Hub read-only and routes every service card to Settings", async () => {
  const [hub, dashboard, css] = await Promise.all([
    source("app/compute-hub-dashboard.tsx"),
    source("app/dashboard-command-centre.tsx"),
    source("app/compute-hub-dashboard.module.css"),
  ]);

  assert.match(dashboard, /import ComputeHubDashboard/);
  assert.match(dashboard, /href="#dashboard-compute-hub"/);
  assert.match(dashboard, /<ComputeHubDashboard/);
  assert.match(hub, /id="dashboard-compute-hub"/);
  assert.match(hub, /Dashboard is read-only/);
  assert.match(hub, /\/api\/ai-routing\/status/);
  assert.match(hub, /\/api\/local-connections/);
  assert.match(hub, /\/api\/local-buzz\/status/);
  assert.match(hub, /\/api\/local-system\/status/);
  assert.match(hub, /Open \{service\.label\} Settings/);
  assert.match(hub, /GPU \/ VRAM/);
  assert.match(hub, /No decorative activity/);
  assert.match(hub, /Recent local events/);
  assert.doesNotMatch(hub, /<input|<select|type="password"|apiKey|endpoint editor/i);
  assert.match(css, /grid-template-columns:repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /@media\(max-width:760px\)/);
  assert.match(css, /@media\(forced-colors:active\)/);
  assert.match(css, /@media\(prefers-reduced-motion:reduce\)/);
});

test("issue #360 reports route locality, real ComfyUI queue state and explicit unavailable job sources", async () => {
  const hub = await source("app/compute-hub-dashboard.tsx");
  assert.match(hub, /modeForRoute/);
  assert.match(hub, /Local/);
  assert.match(hub, /Cloud/);
  assert.match(hub, /Off \/ Manual/);
  assert.match(hub, /system\.jobs\.comfyui\.running/);
  assert.match(hub, /Ollama model pulls/);
  assert.match(hub, /Repository operations/);
  assert.match(hub, /Unavailable/);
  assert.match(hub, /connectionStatus\.items/);
  assert.match(hub, /lastSuccessfulConnection/);
});
