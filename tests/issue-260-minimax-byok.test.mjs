import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #260 registers MiniMax as a native BYOK provider", async () => {
  const [registry, provider, route, project] = await Promise.all([
    source("lib/ai-provider-registry.ts"),
    source("lib/minimax.ts"),
    source("app/api/ai/minimax/route.ts"),
    source("lib/project.ts"),
  ]);
  assert.match(registry, /minimax/);
  assert.match(registry, /MiniMax/);
  assert.match(provider, /api\.minimax\.io/);
  assert.match(provider, /image-01/);
  assert.match(provider, /H3/);
  assert.match(route, /createMinimaxImage/);
  assert.match(route, /createMinimaxVideo/);
  assert.match(project, /minimax/);
});

test("issue #260 enforces explicit billing acknowledgement and one request at a time", async () => {
  const route = await source("app/api/ai/minimax/route.ts");
  assert.match(route, /billingAcknowledged !== true/);
  assert.match(route, /requestCount !== 1/);
  assert.match(route, /PAID_REQUEST_NOT_CONFIRMED/);
  const paths = [
    "app/use-graphic-novel-queue.ts",
    "app/use-cast-identity-queue.ts",
    "app/ai-pitch-deck-workspace-base.tsx",
    "app/character-image-generator.tsx",
    "app/visual-storyboard.tsx",
  ];
  for (const path of paths) {
    const value = await source(path);
    assert.match(value, /requestCount: 1/, `${path} does not limit the confirmed request count`);
    assert.match(value, /billingAcknowledged/, `${path} does not send billing acknowledgement`);
  }
});

test("issue #260 settings and dashboard explain user-owned billing", async () => {
  const [settings, dashboard, readme, architecture] = await Promise.all([
    source("app/settings-panel-legacy.tsx"),
    source("app/setup-connections-dashboard.tsx"),
    source("README.md"),
    source("docs/ai-architecture.md"),
  ]);
  for (const phrase of [
    "Bring your own MiniMax account",
    "PlotPickle does not supply credits",
    "Create or manage MiniMax API key",
    "Review MiniMax pricing",
  ]) assert.ok(settings.includes(phrase), `Missing MiniMax settings copy: ${phrase}`);
  for (const phrase of [
    "Cloud images & video · OpenAI, MiniMax or another provider",
    "Create MiniMax API key",
    "MiniMax H3 video guide",
    "never falls back to cloud automatically",
  ]) assert.ok(dashboard.includes(phrase), `Missing MiniMax dashboard copy: ${phrase}`);
  assert.match(readme, /ships no MiniMax key, shared billing proxy or credits/);
  assert.match(readme, /MiniMax H3 cloud create, query, queued-job cancellation and local MP4 download gateway is available/);
  assert.match(readme, /Successful provider media is copied into local asset storage before review/);
  assert.match(architecture, /shared proxy, bundled credit pool or automatic paid fallback/);
});

test("issue #260 regression is registered", async () => {
  const packageJson = JSON.parse(await source("package.json"));
  assert.match(packageJson.scripts.test, /issue-260-minimax-byok\.test\.mjs/);
});
