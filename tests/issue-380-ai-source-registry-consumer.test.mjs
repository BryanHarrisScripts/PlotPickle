import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const panel = await readFile(new URL("app/ai-routing-panel.tsx", root), "utf8");
const loader = await readFile(new URL("lib/ai/source-registry.ts", root), "utf8");
const registry = JSON.parse(await readFile(new URL("config/ai-source-registry.json", root), "utf8"));
const packageJson = JSON.parse(await readFile(new URL("package.json", root), "utf8"));

test("issue #380 moves AI Routing presentation data behind the registry loader", () => {
  assert.match(panel, /AI_SOURCE_GROUPS/);
  assert.match(panel, /AI_SOURCE_OPTION_LABELS/);
  assert.doesNotMatch(panel, /const OPTION_LABELS/);
  assert.doesNotMatch(panel, /const GROUPS/);
  assert.match(loader, /config\/ai-source-registry\.json/);
  assert.match(loader, /assertRegistry\(registry\)/);
});

test("issue #380 keeps complete plain-language presentation copy in the registry", () => {
  assert.deepEqual(registry.capabilities.map(({ id, label }) => [id, label]), [
    ["text", "Writing"],
    ["image", "Images"],
    ["video", "Video"],
  ]);
  assert.ok(registry.capabilities.every(({ description }) => description.length > 20));
  assert.ok(registry.routes.every(({ label, description }) => label.length > 0 && description.length > 20));
});

test("issue #380 preserves the live route keys while deriving option labels", () => {
  assert.deepEqual(
    registry.routes.map(({ capability, id }) => id.slice(capability.length + 1)),
    ["off", "ollama", "openai", "minimax", "manual", "comfyui", "ollama-comfyui", "openai", "minimax", "off", "comfyui-native", "openai", "minimax"],
  );
  assert.match(loader, /route\.id\.slice\(id\.length \+ 1\)/);
});

test("issue #380 regression is registered in the complete suite", () => {
  assert.match(packageJson.scripts.test, /tests\/issue-380-ai-source-registry-consumer\.test\.mjs/);
  assert.equal(packageJson.scripts["test:ai-source-registry-consumer"], "node --test tests/issue-380-ai-source-registry-consumer.test.mjs");
});
