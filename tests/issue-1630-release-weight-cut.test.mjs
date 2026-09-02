import assert from "node:assert/strict";
import { test } from "node:test";

import { buildInventory, validateInventory } from "../scripts/runtime-weight/inventory.mjs";

test("#1630 excludes only proven developer payload from base package authority", () => {
  const inventory = buildInventory();
  assert.equal(inventory.issue, 1630);
  assert.ok(!inventory.releaseAuthority.runtimeDirectories.includes("tests"));
  assert.ok(!inventory.releaseAuthority.copiedRootFiles.includes("CONTRIBUTING.md"));
  assert.deepEqual(validateInventory(inventory), []);
});

test("#1630 keeps excluded developer payload measurable and available in source checkout", () => {
  const inventory = buildInventory();
  const excluded = new Map(inventory.excludedSourcePayloads.map((item) => [item.path, item]));
  assert.deepEqual([...excluded.keys()].sort(), ["CONTRIBUTING.md", "tests"]);
  for (const pathName of ["tests", "CONTRIBUTING.md"]) {
    const item = excluded.get(pathName);
    assert.equal(item.weightClass, "developer-test-only");
    assert.equal(item.disposition, "excluded-from-base-release");
    assert.ok(item.sourceBytes > 0, `${pathName} source bytes should remain measurable`);
  }
  assert.equal(
    inventory.weightEvidence.excludedDeveloperSourceBytes,
    [...excluded.values()].reduce((total, item) => total + item.sourceBytes, 0),
  );
});

test("#1630 corrects .openai reachability instead of removing a required build input", () => {
  const inventory = buildInventory();
  assert.ok(inventory.releaseAuthority.runtimeDirectories.includes(".openai"));
  const openai = inventory.releasePayloads.find((item) => item.path === ".openai");
  assert.equal(openai?.weightClass, "core-maintenance-runtime-tooling");
  assert.ok(openai?.evidence.some((entry) => entry.includes("vite.config.ts")));
  assert.ok(openai?.evidence.some((entry) => entry.includes("package-smoke.mjs")));
});

test("#1630 leaves persistent runtime dependency policy unchanged", () => {
  const inventory = buildInventory();
  assert.equal(inventory.installationPolicy.windowsPersistentRuntimeIncludesDev, true);
  assert.deepEqual(inventory.installationPolicy.windowsCoreReadyPackages, [
    "vite",
    "next",
    "react",
    "vinext",
    "rolldown",
    "drizzle-kit",
  ]);
});
