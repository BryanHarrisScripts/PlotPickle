import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const routingPanel = await readFile(new URL("app/ai-routing-panel.tsx", root), "utf8");

async function readRegistry() {
  return JSON.parse(
    await readFile(new URL("config/ai-source-registry.json", root), "utf8"),
  );
}

test("global AI source registry is modular JSON with stable extension points", async () => {
  const registry = await readRegistry();

  assert.equal(registry.schemaVersion, 1);
  assert.equal(registry.registryId, "plotpickle.global-ai-sources");
  assert.deepEqual(registry.extensionPoints.routeGroups, ["text", "image", "video"]);
  assert.deepEqual(registry.capabilities.map(({ id, label }) => ({ id, label })), [
    { id: "text", label: "Writing" },
    { id: "image", label: "Images" },
    { id: "video", label: "Video" },
  ]);
  assert.ok(registry.capabilities.every(({ description }) => description.length > 20));
  assert.match(registry.extensionPoints.providerModules, /\{providerId\}/);
  assert.ok(registry.extensionPoints.uiConsumers.includes("app/ai-routing-panel.tsx"));
});

test("global AI source registry preserves the full route matrix", async () => {
  const registry = await readRegistry();
  const routeIds = new Set(registry.routes.map((route) => route.id));

  for (const routeId of [
    "text.off",
    "text.ollama",
    "text.openai",
    "text.minimax",
    "image.manual",
    "image.comfyui",
    "image.ollama-comfyui",
    "image.openai",
    "image.minimax",
    "video.off",
    "video.comfyui-native",
    "video.openai",
    "video.minimax",
  ]) {
    assert.ok(routeIds.has(routeId), `Missing route ${routeId}`);
  }

  for (const capability of ["text", "image", "video"]) {
    assert.ok(
      registry.routes.some((route) => route.capability === capability),
      `Missing capability ${capability}`,
    );
  }
});

test("global AI source registry uses the live routing identifiers", async () => {
  const registry = await readRegistry();
  assert.match(routingPanel, /type Capability = AiSourceCapability/);
  assert.match(routingPanel, /text: "ollama" \| "openai" \| "minimax" \| "off"/);
  assert.match(routingPanel, /image: "comfyui" \| "ollama-comfyui" \| "openai" \| "minimax" \| "manual"/);
  assert.match(routingPanel, /video: "comfyui-native" \| "minimax" \| "openai" \| "off"/);

  assert.deepEqual(
    registry.routes.map(({ capability, id }) => id.replace(`${capability}.`, "")),
    ["off", "ollama", "openai", "minimax", "manual", "comfyui", "ollama-comfyui", "openai", "minimax", "off", "comfyui-native", "openai", "minimax"],
  );
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
