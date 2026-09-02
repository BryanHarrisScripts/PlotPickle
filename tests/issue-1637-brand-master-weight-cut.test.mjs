import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { buildInventory, validateInventory } from "../scripts/runtime-weight/inventory.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("#1637 excludes nested source brand masters while retaining docs", () => {
  const inventory = buildInventory();
  assert.ok(inventory.issue >= 1637);
  assert.ok(inventory.schemaVersion >= 3);
  assert.ok(inventory.releaseAuthority.runtimeDirectories.includes("docs"));
  assert.ok(inventory.releaseAuthority.sourceOnlyReleaseExclusions.includes("docs/brand-sources"));
  assert.deepEqual(validateInventory(inventory), []);
});

test("#1637 keeps brand masters in source checkout and measures them as reference-only weight", () => {
  const inventory = buildInventory();
  const brandMasters = inventory.excludedSourcePayloads.find((item) => item.path === "docs/brand-sources");
  assert.ok(brandMasters);
  assert.equal(brandMasters.weightClass, "reference-example-payload");
  assert.equal(brandMasters.disposition, "excluded-from-base-release");
  assert.ok(brandMasters.sourceBytes > 5_000_000);
  assert.ok(inventory.weightEvidence.excludedReferenceSourceBytes >= brandMasters.sourceBytes);
  assert.equal(
    inventory.weightEvidence.excludedBaseReleaseSourceBytes,
    inventory.weightEvidence.excludedDeveloperSourceBytes + inventory.weightEvidence.excludedReferenceSourceBytes,
  );

  for (const relative of [
    "docs/brand-sources/plotpickle-ouroboros-v2-master.png",
    "docs/brand-sources/plotpickle-sage-logo-reference-2026-08-13.png",
    "docs/brand-sources/sage-brinewick-v2-master.png",
  ]) {
    assert.ok(existsSync(path.join(repoRoot, relative)), `${relative} should remain in source checkout`);
  }
});

test("#1637 leaves runtime dependency and startup policy unchanged", () => {
  const inventory = buildInventory();
  assert.equal(inventory.installationPolicy.windowsPersistentRuntimeIncludesDev, true);
  assert.ok(inventory.releaseAuthority.runtimeDirectories.includes(".openai"));
  assert.ok(inventory.releaseAuthority.runtimeDirectories.includes("public"));
});
