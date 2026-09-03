import assert from "node:assert/strict";
import { test } from "node:test";

import { buildInventory, validateInventory } from "../scripts/runtime-weight/inventory.mjs";

const expectedRuntime = new Set([
  "@cloudflare/vite-plugin",
  "@mastra/core",
  "@tailwindcss/postcss",
  "@vitejs/plugin-react",
  "@vitejs/plugin-rsc",
  "ai",
  "drizzle-orm",
  "libsodium-wrappers-sumo",
  "next",
  "react",
  "react-dom",
  "tailwindcss",
  "vinext",
  "vite",
  "wrangler",
]);

const expectedDeveloperOnly = new Set([
  "@types/node",
  "@types/react",
  "@types/react-dom",
  "drizzle-kit",
  "eslint",
  "eslint-config-next",
  "typescript",
]);

test("#1412 classifies every direct package from concrete reachability evidence", () => {
  const inventory = buildInventory();
  assert.equal(inventory.schemaVersion, 6);
  assert.equal(inventory.issue, 1654);
  assert.deepEqual(validateInventory(inventory), []);
  assert.equal(inventory.directPackages.length, expectedRuntime.size + expectedDeveloperOnly.size);
  assert.ok(inventory.directPackages.every((item) => item.weightClass));
  assert.ok(inventory.directPackages.every((item) => item.disposition !== "requires-reachability-proof"));
  assert.ok(inventory.directPackages.every((item) => item.evidence.length > 0));
});

test("#1412 separates current source-runtime packages from developer-only declarations", () => {
  const packages = new Map(buildInventory().directPackages.map((item) => [item.name, item]));
  assert.deepEqual(new Set(packages.keys()), new Set([...expectedRuntime, ...expectedDeveloperOnly]));
  for (const name of expectedRuntime) {
    assert.notEqual(packages.get(name)?.weightClass, "developer-test-only", `${name} must remain in the current source runtime`);
  }
  for (const name of expectedDeveloperOnly) {
    assert.equal(packages.get(name)?.weightClass, "developer-test-only", `${name} should not remain in the user runtime after split proof`);
  }
});

test("#1412 records drizzle-kit as excluded developer tooling, not a product runtime dependency", () => {
  const drizzleKit = buildInventory().directPackages.find((item) => item.name === "drizzle-kit");
  assert.equal(drizzleKit?.declaration, "devDependencies");
  assert.equal(drizzleKit?.weightClass, "developer-test-only");
  assert.equal(drizzleKit?.disposition, "excluded-from-user-runtime");
  assert.ok(drizzleKit?.evidence.some((entry) => entry.includes("db:generate")));
});
