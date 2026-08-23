import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #285 keeps the live connection dashboard visible and self-updating", async () => {
  const [setup, host, setupCss] = await Promise.all([
    source("app/setup-connections-dashboard.tsx"),
    source("app/configuration-dashboard-host.tsx"),
    source("app/setup-connections-dashboard.module.css"),
  ]);
  for (const phrase of [
    "Connection dashboard",
    "dashboardSummary",
    "verifiedCount",
    "attentionCount",
    "plotpickle:setup-status-refresh",
    'settingsSection: "comfyui"',
  ]) assert.ok(setup.includes(phrase), `Missing dashboard contract: ${phrase}`);
  assert.match(host, /#plotpickle-comfyui-connection/);
  assert.match(host, /scrollIntoView/);
  assert.match(setupCss, /dashboardSummary/);
});

test("issue #285 exposes real ComfyUI configuration and connection testing", async () => {
  const [panel, gateway, css] = await Promise.all([
    source("app/media-routing-panel.tsx"),
    source("build/media-routing-gateway.ts"),
    source("app/media-routing-panel.module.css"),
  ]);
  for (const phrase of [
    "ComfyUI server address",
    "Save & run live ComfyUI diagnostic",
    "plotpickle-comfyui-connection",
    "comfyui/connection",
    "requestConnectionStatusRefresh",
    "plotpickle:setup-status-refresh",
  ]) assert.ok(`${panel}\n${gateway}`.includes(phrase), `Missing ComfyUI setup contract: ${phrase}`);
  assert.match(gateway, /normalizeComfyUIBaseUrl/);
  assert.match(gateway, /127\.0\.0\.1/);
  assert.match(gateway, /localhost/);
  assert.match(css, /comfyConnection/);
});

test("issue #285 removes unsupported provider placeholders from visible settings", async () => {
  const [panel, taxonomy, settings] = await Promise.all([
    source("app/settings-panel-legacy.tsx"),
    source("config/settings-system-taxonomy.json"),
    source("lib/ai/settings.ts"),
  ]);
  assert.doesNotMatch(`${panel}\n${taxonomy}`, /Pika Labs|Runway|Additional media & film engines/);
  assert.match(panel, /Unsupported provider placeholders are hidden until a working connector exists/);
  assert.match(settings, /defaultMediaEnginePlaceholders: PluginSetting\[\] = \[\]/);
});

test("issue #285 makes Buzz verification resilient and refreshes its dashboard light", async () => {
  const [gateway, settings] = await Promise.all([
    source("build/buzz-gateway.ts"),
    source("app/buzz-settings-panel.tsx"),
  ]);
  assert.match(gateway, /await runBuzz\(connection, \["users", "get"\]\)/);
  assert.match(gateway, /await runBuzz\(connection, \["channels", "list"\]\)/);
  assert.match(gateway, /verifyBuzzIdentity/);
  assert.match(gateway, /auth-required\|verification failed\|NIP-OA/);
  assert.match(settings, /refreshDashboardLights/);
  assert.match(settings, /plotpickle:setup-status-refresh/);
});

test("issue #285 gives every Refine diagnostic a reliable return path", async () => {
  const pages = [
    "app/diagnostics/page.tsx",
    "app/resonance/page.tsx",
    "app/labs/page.tsx",
    "app/pageflow/page.tsx",
    "app/draftlens/page.tsx",
    "app/story-craft-essentials/page.tsx",
  ];
  const [nav, engine, ...pageSources] = await Promise.all([
    source("app/refine-return-nav.tsx"),
    source("app/engine-hub.tsx"),
    ...pages.map(source),
  ]);
  for (const phrase of ["Back one screen", "Refine menu", "Main menu", "window.history.back"]) {
    assert.ok(nav.includes(phrase), `Missing Refine navigation action: ${phrase}`);
  }
  for (const [index, page] of pageSources.entries()) {
    assert.match(page, /RefineReturnNav/, `${pages[index]} is missing the shared return navigation`);
  }
  assert.match(engine, /\/diagnostics\?return=refine/);
});

test("issue #285 regression is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-285-connection-dashboard-navigation-fixes\.test\.mjs/);
  assert.equal(packageJson.scripts["test:connection-dashboard-fixes"], "node --test tests/issue-285-connection-dashboard-navigation-fixes.test.mjs");
});
