import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1553 autonomous reference bootstraps immutable Afterglow through the real Library UI", async () => {
  const [bootstrap, reference, library, catalog] = await Promise.all([
    read("scripts/creative-uat/autonomous/bootstrap-afterglow-working-copy.mjs"),
    read("scripts/creative-uat/autonomous/run-autonomous-story-reference.mjs"),
    read("modules/library/ui/library-workspace.tsx"),
    read("modules/library/project-library-catalog.ts"),
  ]);

  assert.match(bootstrap, /data-library-catalog-id=[\\"]?afterglow-v9/);
  assert.match(bootstrap, /Load & Explore/);
  assert.match(bootstrap, /Save & Switch/);
  assert.match(bootstrap, /browser_click/);
  assert.match(bootstrap, /data-library-story-id/);
  assert.match(bootstrap, /sourceImmutable:\s*true/);
  assert.match(reference, /bootstrap-afterglow-working-copy\.mjs/);
  assert.match(reference, /runAfterglowBootstrap/);
  assert.match(reference, /afterglowBootstrap/);
  assert.match(reference, /sourceCatalogId !== "afterglow-v9"/);
  assert.match(library, /createLibraryWorkingCopy/);
  assert.match(library, /createAfterglowV9FoundationsReference/);
  assert.match(catalog, /id: "afterglow-v9"/);
  assert.match(catalog, /reference-afterglow-v9-source/);

  const automation = `${bootstrap}\n${reference}`;
  assert.doesNotMatch(automation, /localStorage|sessionStorage|indexedDB|createLibraryWorkingCopy\s*\(|saveProfileActiveProject|projectLibraryProjectKey|applyStoryCommand|database|sqlite|fixture mutation/i);
  assert.doesNotMatch(automation, /authenticated-human/);
  assert.doesNotMatch(automation, /chainOfThought|reasoningTrace|modelOutput/);
});

test("#1553 reference command fails closed when Afterglow bootstrap is not proven", async () => {
  const reference = await read("scripts/creative-uat/autonomous/run-autonomous-story-reference.mjs");
  assert.match(reference, /bootstrap\.child\.code !== 0 \|\| !bootstrap\.report\?\.projectId/);
  assert.match(reference, /deterministic Afterglow working copy was not proven/i);
  assert.match(reference, /workingCopyCreatedThrough/);
});
