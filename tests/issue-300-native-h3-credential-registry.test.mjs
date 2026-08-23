import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("issue #300 registers encrypted native H3 routing and job state", async () => {
  const [registryText, provider] = await Promise.all([
    source("config/credential-boundary.registry.json"),
    source("build/comfyui-h3-native-provider.ts"),
  ]);
  const registry = JSON.parse(registryText);
  const entries = new Map(registry.credentials.map((entry) => [entry.file, entry]));
  for (const file of ["h3-native-routing.json", "h3-native-jobs.json"]) {
    const entry = entries.get(file);
    assert.ok(entry, `Missing credential registry entry for ${file}`);
    assert.equal(entry.source, "build/comfyui-h3-native-provider.ts");
    assert.match(provider, new RegExp(file.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  }
});
