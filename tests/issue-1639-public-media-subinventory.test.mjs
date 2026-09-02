import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { buildInventory } from "../scripts/runtime-weight/inventory.mjs";
import {
  buildPublicMediaInventory,
  validatePublicMediaInventory,
} from "../scripts/runtime-weight/public-media-inventory.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");

test("#1639 subinventories every first-class public payload and reconciles bytes", () => {
  const inventory = buildPublicMediaInventory();
  const expected = readdirSync(path.join(repoRoot, "public")).sort().map((name) => `public/${name}`);
  const actual = inventory.topLevelItems.map((item) => item.path);

  assert.equal(inventory.issue, 1639);
  assert.equal(inventory.parentIssue, 1412);
  assert.deepEqual(actual, expected);
  assert.equal(inventory.reconciliation.topLevelSourceBytes, inventory.publicPayload.sourceBytes);
  assert.deepEqual(validatePublicMediaInventory(inventory), []);
});

test("#1639 keeps active Afterglow legacy visuals bundled with concrete consumer evidence", () => {
  const inventory = buildPublicMediaInventory();
  const legacy = inventory.afterglowItems.find((item) => item.path === "public/afterglow/legacy-visuals");

  assert.ok(legacy);
  assert.equal(legacy.weightClass, "reference-example-payload");
  assert.equal(legacy.disposition, "retain-active-reference");
  assert.ok(legacy.sourceBytes > 0);
  assert.ok(legacy.fileCount > 0);
  assert.ok(legacy.evidence.some((item) => item.includes("app/afterglow-legacy-visuals.tsx")));
  assert.ok(legacy.evidence.some((item) => item.includes("data/afterglow-visual-manifest.json")));
});

test("#1639 retains the active Visual Reference Library and isolates full-resolution media for later proof", () => {
  const inventory = buildPublicMediaInventory();
  const container = inventory.topLevelItems.find((item) => item.path === "public/visual-references");
  const manifest = inventory.visualReferenceItems.find((item) => item.path === "public/visual-references/manifest.json");
  const thumbnails = inventory.visualReferenceItems.find((item) => item.path === "public/visual-references/thumbnail");
  const cards = inventory.visualReferenceItems.find((item) => item.path === "public/visual-references/card");
  const full = inventory.visualReferenceItems.find((item) => item.path === "public/visual-references/full");

  assert.ok(container);
  assert.equal(container.disposition, "retain-current-product");
  assert.ok(container.evidence.some((item) => item.includes("app/visual-reference-library.tsx")));
  assert.equal(inventory.reconciliation.visualReferenceSourceBytes, container.sourceBytes);

  for (const active of [manifest, thumbnails, cards]) {
    assert.ok(active);
    assert.equal(active.disposition, "retain-active-reference");
    assert.ok(active.sourceBytes > 0);
  }

  assert.ok(full);
  assert.equal(full.disposition, "requires-reachability-proof");
  assert.ok(full.sourceBytes > 0);
  assert.ok(inventory.reachabilityProofQueue.some((item) => item.path === full.path));
  assert.ok(!inventory.reachabilityProofQueue.some((item) => item.path === container.path));
});

test("#1639 changes evidence only and does not create a public packaging exclusion", () => {
  const parent = buildInventory();
  const inventory = buildPublicMediaInventory();

  assert.ok(parent.releaseAuthority.runtimeDirectories.includes("public"));
  assert.deepEqual(inventory.releaseAuthority.publicSourceOnlyExclusions, []);
  assert.ok(inventory.reachabilityProofQueue.every((item) => item.sourceBytes >= 0));
});
