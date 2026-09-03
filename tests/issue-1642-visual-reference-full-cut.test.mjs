import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";

import { buildInventory, validateInventory } from "../scripts/runtime-weight/inventory.mjs";
import {
  buildPublicMediaInventory,
  validatePublicMediaInventory,
} from "../scripts/runtime-weight/public-media-inventory.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..");
const fullRoot = path.join(repoRoot, "public", "visual-references", "full");
const sourceManifestPath = path.join(repoRoot, "public", "visual-references", "manifest.json");

function source(relativePath) {
  return readFileSync(path.join(repoRoot, relativePath), "utf8");
}

test("#1642 retains all 62 full-resolution WebPs in source with exact measured weight", () => {
  const files = readdirSync(fullRoot).filter((name) => name.endsWith(".webp")).sort();
  assert.equal(files.length, 62);
  const bytes = files.reduce((sum, name) => sum + statSync(path.join(fullRoot, name)).size, 0);
  assert.equal(bytes, 17_288_836);
  assert.ok(files.every((name) => statSync(path.join(fullRoot, name)).size > 0));
});

test("#1642 source manifest retains full-resolution provenance and every full locator resolves", () => {
  const references = JSON.parse(readFileSync(sourceManifestPath, "utf8"));
  assert.equal(references.length, 62);
  for (const reference of references) {
    assert.match(reference.image.full, /^\/visual-references\/full\/[^/]+\.webp$/);
    assert.ok(existsSync(path.join(repoRoot, "public", ...reference.image.full.slice(1).split("/"))), `${reference.id}: source full image is missing`);
    assert.match(reference.image.thumbnail, /^\/visual-references\/thumbnail\/[^/]+\.webp$/);
    assert.match(reference.image.card, /^\/visual-references\/card\/[^/]+\.webp$/);
  }
});

test("#1642 live Visual Reference Library has no full-resolution render consumer", () => {
  const library = source("app/visual-reference-library.tsx");
  assert.match(library, /full\?: string/);
  assert.match(library, /reference\.image\.thumbnail/);
  assert.match(library, /selected\.image\.card/);
  assert.doesNotMatch(library, /(?:reference|selected)\.image\.full/);
});

test("#1642 packager excludes only the full tier and projects the staged manifest", () => {
  const packager = source("scripts/package-platform.mjs");
  assert.match(packager, /public\/visual-references\/full/);
  assert.match(packager, /projectPackagedVisualReferenceManifest/);
  assert.match(packager, /full: _sourceOnlyFull/);
  assert.match(packager, /thumbnail/);
  assert.match(packager, /card/);
});

test("#1642 runtime-weight evidence records the exact excluded reference payload", () => {
  const inventory = buildInventory();
  const full = inventory.excludedSourcePayloads.find((item) => item.path === "public/visual-references/full");

  assert.equal(inventory.issue, 1642);
  assert.deepEqual(validateInventory(inventory), []);
  assert.ok(full);
  assert.equal(full.weightClass, "reference-example-payload");
  assert.equal(full.disposition, "excluded-from-base-release");
  assert.equal(full.sourceBytes, 17_288_836);
  assert.ok(inventory.releaseAuthority.sourceOnlyReleaseExclusions.includes("public/visual-references/full"));
  assert.ok(inventory.weightEvidence.excludedReferenceSourceBytes >= 17_288_836);
});

test("#1642 public-media evidence removes the full tier from the reachability queue", () => {
  const inventory = buildPublicMediaInventory();
  const full = inventory.visualReferenceItems.find((item) => item.path === "public/visual-references/full");

  assert.equal(inventory.issue, 1642);
  assert.deepEqual(validatePublicMediaInventory(inventory), []);
  assert.ok(full);
  assert.equal(full.sourceBytes, 17_288_836);
  assert.equal(full.fileCount, 62);
  assert.equal(full.disposition, "excluded-from-base-release");
  assert.ok(!inventory.reachabilityProofQueue.some((item) => item.path === full.path));
});
