import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2493 generation stays unsaved until explicit Save for WorldMap poster and characters", async () => {
  const surface = await read("app/skin-v1/story-bible-surface.tsx");
  const posterGenerate = surface.slice(
    surface.indexOf("async function generatePosterVisual"),
    surface.indexOf("function savePosterVersion"),
  );
  const posterSave = surface.slice(
    surface.indexOf("function savePosterVersion"),
    surface.indexOf("function lockPosterVersion"),
  );
  const characterGenerate = surface.slice(
    surface.indexOf("async function generateSheet"),
    surface.indexOf("function saveCandidate"),
  );
  const characterSave = surface.slice(
    surface.indexOf("function saveCandidate"),
    surface.indexOf("function lockSelectedVersion"),
  );

  assert.match(surface, />Save<\/button>/u);
  assert.match(surface, />Lock<\/button>/u);
  assert.match(surface, /UNSAVED/u);
  assert.match(surface, /SAVED/u);
  assert.match(surface, /LOCKED/u);
  assert.match(surface, /Previous character image/u);
  assert.match(surface, /Next character image/u);
  assert.doesNotMatch(surface, /Approve \/ Lock Character Visuals/u);

  assert.doesNotMatch(posterGenerate, /foundations\.visual\.store|saveActiveLibraryProject/u);
  assert.match(posterSave, /foundations\.visual\.store/u);
  assert.match(posterSave, /saveActiveLibraryProject/u);
  assert.doesNotMatch(characterGenerate, /saveActiveLibraryProject|saveWorldMapCharacterVisualVersion/u);
  assert.match(characterSave, /saveWorldMapCharacterVisualVersion/u);
  assert.match(characterSave, /saveActiveLibraryProject/u);
});

test("#2493 character contract bounds five versions and uses one explicit locked version", async () => {
  const contract = await read("core/contracts/world-map/index.ts");

  assert.match(contract, /WORLD_MAP_CHARACTER_MAX_VERSIONS = 5/u);
  assert.match(contract, /versionId: string/u);
  assert.match(contract, /lockedVersionId: string \| null/u);
  assert.match(contract, /versionOrder\(normalizedReferences\)\.slice\(0, WORLD_MAP_CHARACTER_MAX_VERSIONS\)/u);
  assert.match(contract, /existingVersions\.length >= WORLD_MAP_CHARACTER_MAX_VERSIONS/u);
  assert.match(contract, /lockWorldMapCharacterVisualVersion/u);
  assert.match(contract, /reference\.versionId === versionId \? "approved" as const : "draft" as const/u);
  assert.match(contract, /current\.lockedVersionId === versionId/u);
  assert.match(contract, /reference\.versionId === current\.lockedVersionId && reference\.reviewState === "approved"/u);
  assert.match(contract, /target\?\.complete/u);
});

test("#2493 legacy approved character imagery becomes one saved and locked compatibility version", async () => {
  const contract = await read("core/contracts/world-map/index.ts");

  assert.match(contract, /legacy-locked-\$\{characterId\}/u);
  assert.match(contract, /approvedLegacyVersionId/u);
  assert.match(contract, /retainedVersionIds\.includes\(approvedLegacyVersionId\)/u);
  assert.match(contract, /lockedVersionId \? clean\(source\.approvedAt/u);
  assert.match(contract, /Legacy compatibility alias/u);
});

test("#2493 poster history is bounded and Lock is scoped to Marketing References", async () => {
  const [surface, buildProgress] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("core/contracts/build-progress.ts"),
  ]);

  assert.match(buildProgress, /MARKETING_REFERENCE_MAX_VERSIONS = 5/u);
  assert.match(buildProgress, /filter\(isMarketingReferenceArtifact\)/u);
  assert.match(buildProgress, /slice\(0, MARKETING_REFERENCE_MAX_VERSIONS\)/u);
  assert.match(buildProgress, /lockedMarketingReference/u);
  assert.match(buildProgress, /accepted\.has\(artifact\.id\)/u);

  const lockPoster = surface.slice(
    surface.indexOf("function lockPosterVersion"),
    surface.indexOf("  return (", surface.indexOf("function lockPosterVersion")),
  );
  assert.match(lockPoster, /for \(const artifact of posterVersions\)/u);
  assert.match(lockPoster, /foundations\.visual\.unaccept/u);
  assert.match(lockPoster, /foundations\.visual\.accept/u);
  assert.match(lockPoster, /artifact\.id !== selectedPoster\.id/u);
  assert.match(lockPoster, /acceptedVisualArtifactIds\.includes\(artifact\.id\)/u);
});

test("#2493 Story Bible projection prefers the locked poster over merely newest saved media", async () => {
  const projection = await read("core/project/story-bible-projection.ts");
  assert.match(projection, /lockedMarketingReference/u);
  assert.match(projection, /lockedPosterReference \?\? currentMarketingReference/u);
  assert.match(projection, /"Locked Marketing Reference"/u);
  assert.match(projection, /"Saved Marketing Reference"/u);
});

test("#2493/#2564 character chevrons browse individual images while poster chevrons remain version-based", async () => {
  const [surface, styles] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/story-bible-surface.module.css"),
  ]);

  assert.match(surface, /aria-label="Previous character image"/u);
  assert.match(surface, /disabled=\{safeReferenceIndex <= 0\}/u);
  assert.match(surface, /safeReferenceIndex >= browseItems\.length - 1/u);
  assert.match(surface, /selectedBrowseItem\.generationNumber/u);
  assert.match(surface, /selectedBrowseItem\.viewNumber/u);
  assert.match(surface, /disabled=\{Boolean\(posterCandidate\) \|\| safePosterIndex <= 0\}/u);
  assert.match(surface, /safePosterIndex >= posterVersions\.length - 1/u);
  assert.match(surface, /exactly one generation may be locked/u);
  assert.match(styles, /\.versionBar/u);
  assert.match(styles, /\.referenceCarouselFigure/u);
  assert.match(styles, /button:disabled/u);
});

test("#2564 incomplete saved character generations can fill missing views before Lock", async () => {
  const [surface, contract] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("core/contracts/world-map/index.ts"),
  ]);

  assert.match(contract, /id: "right-three-quarter", label: "Right 45°"/u);
  assert.match(surface, /Generate Missing Views/u);
  assert.match(surface, /selectedMissingViews/u);
  assert.match(surface, /generateMissingViews/u);
  assert.match(surface, /versionId: selectedVersion\.id/u);
  assert.match(surface, /references: canonicalReferences\(\[\.\.\.selectedVersion\.references, \.\.\.generated\]\)/u);
  assert.match(surface, /only a complete eight-view saved generation can be locked/u);
  assert.match(surface, /if \(!selectedVersion\?\.complete \|\| selectedVersion\.locked\) return/u);
});

test("#2564 World Map visual UI presents the Afterglow isobel record simply as Summer", async () => {
  const surface = await read("app/skin-v1/story-bible-surface.tsx");
  assert.match(surface, /return character\.id === "isobel" \? "Summer" : character\.name/u);
  assert.match(surface, /data-world-map-character-name=\{displayName\}/u);
  assert.match(surface, /<h3>\{displayName\}<\/h3>/u);
});

test("#2493 persistence fixtures prove five saved WorldMap media versions and the brief records local durability", async () => {
  const [durability, brief, library] = await Promise.all([
    read("tests/issue-2450-library-durable-hydration.test.mjs"),
    read("docs/developer-briefs/2493-worldmap-explicit-save-local-version-history.md"),
    read("core/storage/library-project.ts"),
  ]);

  assert.match(durability, /five saved WorldMap media versions/u);
  assert.match(durability, /wren-version-5/u);
  assert.match(durability, /references\.length, 40/u);
  assert.match(durability, /afterglow-poster-version-5/u);
  assert.match(durability, /FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW/u);
  assert.match(library, /normalizeWorldMapState\(source\.worldMap\)/u);
  assert.match(brief, /Generation creates a review candidate/u);
  assert.match(brief, /persistentHome\(\)\/assets/u);
  assert.match(brief, /Stop at green; merge only when the Human separately requests it/u);
});
