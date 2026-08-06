import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);

async function readRegistry() {
  return JSON.parse(
    await readFile(new URL("config/ai-source-registry.json", root), "utf8"),
  );
}

test("global AI source registry is modular JSON with stable extension points", async () => {
  const registry = await readRegistry();

  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.registryId, "plotpickle.global-ai-sources");
  assert.deepEqual(registry.extensionPoints.routeGroups, ["writing", "images", "video"]);
  assert.match(registry.extensionPoints.providerModules, /\{providerId\}/);
  assert.ok(registry.extensionPoints.uiConsumers.includes("app/ai-routing-panel.tsx"));
});

test("global AI source registry preserves the full route matrix", async () => {
  const registry = await readRegistry();
  const routeIds = new Set(registry.routes.map((route) => route.id));

  for (const routeId of [
    "writing.off",
    "writing.ollama",
    "writing.openai",
    "writing.minimax-text",
    "images.manual",
    "images.comfyui",
    "images.ollama-comfyui",
    "images.openai",
    "images.minimax",
    "video.off",
    "video.comfyui-h3",
    "video.openai",
    "video.minimax-h3",
  ]) {
    assert.ok(routeIds.has(routeId), `Missing route ${routeId}`);
  }

  for (const capability of ["writing", "images", "video"]) {
    assert.ok(
      registry.routes.some((route) => route.capability === capability),
      `Missing capability ${capability}`,
    );
  }
});

test("global AI source registry keeps cloud cost and local probe boundaries explicit", async () => {
  const registry = await readRegistry();
  const providers = new Map(registry.providers.map((provider) => [provider.id, provider]));

  for (const providerId of ["openai", "minimax"]) {
    const provider = providers.get(providerId);
    assert.equal(provider.kind, "cloud");
    assert.equal(provider.cost, "paid");
    assert.equal(provider.requiresConsent, true);
    assert.equal(provider.probe.configuration, "encrypted-local-api-key");
  }

  for (const providerId of ["ollama", "comfyui"]) {
    const provider = providers.get(providerId);
    assert.equal(provider.kind, "local");
    assert.equal(provider.cost, "free");
    assert.equal(provider.requiresConsent, false);
    assert.match(provider.probe.health, /^http:\/\/127\.0\.0\.1:/);
    assert.match(provider.probe.installation, /^reviewed-local-/);
  }
});

test("global AI source registry prevents paid automatic defaults", async () => {
  const registry = await readRegistry();
  const providers = new Map(registry.providers.map((provider) => [provider.id, provider]));

  for (const [capability, routeId] of Object.entries(registry.defaults)) {
    const route = registry.routes.find((candidate) => candidate.id === `${capability}.${routeId}`);
    assert.ok(route, `Default route missing for ${capability}`);
    for (const providerId of route.providerIds) {
      assert.notEqual(providers.get(providerId)?.cost, "paid");
    }
    assert.equal(route.selectableWhen, "always");
  }
});

