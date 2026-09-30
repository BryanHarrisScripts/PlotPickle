import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2493/#2605 World Map no longer owns media generation, Save, or Lock UI", async () => {
  const surface = await read("app/skin-v1/story-bible-surface.tsx");
  assert.match(surface, /data-story-bible-read-only="true"/u);
  assert.match(surface, /Current approved marketing reference/u);
  assert.match(surface, /Approved character truth and visual identity/u);
  assert.doesNotMatch(surface, /Generate Poster Visual|Generate Character Visual|Generate Missing Views/u);
  assert.doesNotMatch(surface, /savePosterVersion|lockPosterVersion|saveCandidate|lockSelectedVersion/u);
});

test("#2493 character contract still bounds five versions and one explicit locked version", async () => {
  const contract = await read("core/contracts/world-map/index.ts");
  assert.match(contract, /WORLD_MAP_CHARACTER_MAX_VERSIONS = 5/u);
  assert.match(contract, /versionId: string/u);
  assert.match(contract, /lockedVersionId: string \| null/u);
  assert.match(contract, /existingVersions\.length >= WORLD_MAP_CHARACTER_MAX_VERSIONS/u);
  assert.match(contract, /lockWorldMapCharacterVisualVersion/u);
  assert.match(contract, /target\?\.complete/u);
});

test("#2493 legacy approved character imagery remains a compatibility version", async () => {
  const contract = await read("core/contracts/world-map/index.ts");
  assert.match(contract, /legacy-locked-/u);
  assert.match(contract, /approvedLegacyVersionId/u);
  assert.match(contract, /retainedVersionIds\.includes\(approvedLegacyVersionId\)/u);
  assert.match(contract, /Legacy compatibility alias/u);
});

test("#2493 poster history remains bounded and projection prefers the locked poster", async () => {
  const [buildProgress, projection] = await Promise.all([
    read("core/contracts/build-progress.ts"),
    read("core/project/story-bible-projection.ts"),
  ]);
  assert.match(buildProgress, /MARKETING_REFERENCE_MAX_VERSIONS = 5/u);
  assert.match(buildProgress, /filter\(isMarketingReferenceArtifact\)/u);
  assert.match(buildProgress, /lockedMarketingReference/u);
  assert.match(projection, /lockedMarketingReference/u);
  assert.match(projection, /lockedPosterReference \?\? currentMarketingReference/u);
  assert.match(projection, /"Locked Marketing Reference"/u);
  assert.match(projection, /"Saved Marketing Reference"/u);
});

test("#2564/#2605 approved character visual identity still projects into World Map and Storyboard", async () => {
  const [surface, projection, storyboard] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("core/project/story-bible-projection.ts"),
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
  ]);
  assert.match(surface, /return character\.id === "isobel" \? "Summer" : character\.name/u);
  assert.match(surface, /character\.imageUrl/u);
  assert.match(projection, /approvedWorldMapCharacterReferences\(project\.worldMap, characterId\)/u);
  assert.match(storyboard, /approvedWorldMapCharacterReferences\(project\.worldMap, characterId\)/u);
});

test("#2493 persistence fixtures continue to prove saved WorldMap media history", async () => {
  const [durability, brief, library] = await Promise.all([
    read("tests/issue-2450-library-durable-hydration.test.mjs"),
    read("docs/developer-briefs/2493-worldmap-explicit-save-local-version-history.md"),
    read("core/storage/library-project.ts"),
  ]);
  assert.match(durability, /five saved WorldMap media versions/u);
  assert.match(durability, /wren-version-5/u);
  assert.match(durability, /afterglow-poster-version-5/u);
  assert.match(library, /normalizeWorldMapState\(source\.worldMap\)/u);
  assert.match(brief, /persistentHome\(\)\/assets/u);
});
