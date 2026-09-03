import assert from "node:assert/strict";
import { test } from "node:test";

import { buildInventory, validateInventory } from "../scripts/runtime-weight/inventory.mjs";

const expectedDomains = [
  "core",
  "story",
  "intelligence",
  "community-integrations",
  "experience",
  "platform",
];

const expectedWeightClasses = [
  "core-runtime",
  "core-maintenance-runtime-tooling",
  "optional-integration-runtime",
  "reference-example-payload",
  "developer-test-only",
];

test("#1626 keeps six repository ownership domains separate from five shipping-weight classes", () => {
  const inventory = buildInventory();
  assert.deepEqual(inventory.ownershipDomains.map((item) => item.id), expectedDomains);
  assert.deepEqual(inventory.weightClasses, expectedWeightClasses);
});

test("#1626 covers every currently packaged top-level payload without changing packager authority", () => {
  const inventory = buildInventory();
  assert.equal(inventory.releaseAuthority.packager, "scripts/package-platform.mjs");
  assert.equal(inventory.coverage.runtimeDirectoryCount, inventory.coverage.classifiedRuntimeDirectoryCount);
  assert.equal(inventory.coverage.copiedRootFileCount, inventory.coverage.classifiedCopiedRootFileCount);
  assert.deepEqual(validateInventory(inventory), []);
});

test("#1626 records the current Windows include-dev and readiness package baseline as evidence", () => {
  const inventory = buildInventory();
  assert.equal(inventory.installationPolicy.windowsPersistentRuntimeIncludesDev, true);
  assert.equal(inventory.installationPolicy.mastraVerifiedBeforeServerStart, true);
  assert.deepEqual(inventory.installationPolicy.windowsCoreReadyPackages, [
    "vite",
    "next",
    "react",
    "vinext",
    "rolldown",
    "drizzle-kit",
  ]);
});

test("#1626 classifies or explicitly defers every direct package declaration", () => {
  const inventory = buildInventory();
  const weightClasses = new Set(inventory.weightClasses);
  assert.ok(inventory.directPackages.length > 0);
  for (const item of inventory.directPackages) {
    assert.ok(
      (item.weightClass && weightClasses.has(item.weightClass)) || item.disposition === "requires-reachability-proof",
      `${item.name} needs a weight class or requires-reachability-proof disposition`,
    );
    assert.ok(item.evidence.length > 0, `${item.name} needs evidence`);
  }
});

test("#1626 preserves explicit current runtime consumers instead of guessing from dependency sections", () => {
  const inventory = buildInventory();
  const packages = new Map(inventory.directPackages.map((item) => [item.name, item]));
  for (const [name, weightClass] of [
    ["next", "core-runtime"],
    ["react", "core-runtime"],
    ["vite", "core-maintenance-runtime-tooling"],
    ["vinext", "core-maintenance-runtime-tooling"],
    ["rolldown", "core-maintenance-runtime-tooling"],
    ["@mastra/core", "core-runtime"],
  ]) {
    const item = packages.get(name);
    if (!item) continue;
    assert.equal(item.weightClass, weightClass, `${name} should retain its evidence-backed current role`);
    assert.ok(item.evidence.some((entry) => /Start-PlotPickle|windows-runtime/.test(entry)));
  }
});

test("#1626 inventory output is deterministic for one exact repository head", () => {
  assert.deepEqual(buildInventory(), buildInventory());
});
