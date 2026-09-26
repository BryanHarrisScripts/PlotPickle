import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  WORLD_MAP_CHARACTER_MAX_VERSIONS,
  WORLD_MAP_CHARACTER_VIEWS,
  approvedWorldMapCharacterReferences,
  createEmptyWorldMapState,
  lockWorldMapCharacterVisualVersion,
  normalizeWorldMapState,
  saveWorldMapCharacterVisualVersion,
  worldMapCharacterVisualVersions,
} from "../core/contracts/world-map/index.ts";
import {
  FOUNDATIONS_MARKETING_REFERENCE_FRONTIER,
  FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW,
  MARKETING_REFERENCE_MAX_VERSIONS,
  lockedMarketingReference,
  marketingReferenceVersions,
} from "../core/contracts/build-progress.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function characterVersion(characterId, version) {
  const versionId = `${characterId}-version-${version}`;
  const createdAt = `2026-09-26T18:${String(10 + version).padStart(2, "0")}:00.000Z`;
  return {
    versionId,
    references: WORLD_MAP_CHARACTER_VIEWS.map((view, index) => ({
      id: `${versionId}-${view.id}`,
      versionId,
      characterId,
      characterName: characterId === "wren" ? "Wren" : "Character",
      view: view.id,
      assetUrl: `/api/local-ai/assets/${characterId}-v${version}-${index + 1}.webp`,
      prompt: `${characterId} version ${version} ${view.label}`,
      provider: "local",
      model: "qwen-image",
      createdAt,
      reviewState: "draft",
    })),
    createdAt,
  };
}

function poster(version) {
  return {
    id: `poster-${version}`,
    assetUrl: `/api/local-ai/assets/worldmap-poster-afterglow-v${version}.webp`,
    prompt: `Poster ${version}`,
    createdAt: `2026-09-26T18:${String(10 + version).padStart(2, "0")}:30.000Z`,
    provider: "local",
    model: "qwen-image",
    narrativeIntention: "PPF Marketing Reference · WorldMap poster",
    curriculumFrontier: FOUNDATIONS_MARKETING_REFERENCE_FRONTIER,
    sourceDecisionKeys: ["surface:worldmap"],
    workflow: FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW,
    reviewState: version === 4 ? "accepted" : "draft",
    parentArtifactId: null,
  };
}

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

  assert.match(surface, /Save this Version/u);
  assert.match(surface, /Lock this Version/u);
  assert.match(surface, /UNSAVED/u);
  assert.match(surface, /SAVED/u);
  assert.match(surface, /LOCKED/u);
  assert.match(surface, /Previous saved version/u);
  assert.match(surface, /Next saved version/u);
  assert.doesNotMatch(surface, /Approve \/ Lock Character Visuals/u);

  assert.doesNotMatch(posterGenerate, /foundations\.visual\.store|saveActiveLibraryProject/u);
  assert.match(posterSave, /foundations\.visual\.store/u);
  assert.match(posterSave, /saveActiveLibraryProject/u);
  assert.doesNotMatch(characterGenerate, /saveActiveLibraryProject|saveWorldMapCharacterVisualVersion/u);
  assert.match(characterSave, /saveWorldMapCharacterVisualVersion/u);
  assert.match(characterSave, /saveActiveLibraryProject/u);

  assert.match(surface, /WORLD_MAP_CHARACTER_MAX_VERSIONS/u);
  assert.match(surface, /MARKETING_REFERENCE_MAX_VERSIONS/u);
  assert.match(surface, /disabled=\{Boolean\(candidate\) \|\| safeVersionIndex <= 0\}/u);
  assert.match(surface, /safeVersionIndex >= versions\.length - 1/u);
  assert.match(surface, /disabled=\{Boolean\(posterCandidate\) \|\| safePosterIndex <= 0\}/u);
  assert.match(surface, /safePosterIndex >= posterVersions\.length - 1/u);
});

test("#2493 character single lock preserves saved versions and downstream authority", () => {
  let state = createEmptyWorldMapState();
  for (let version = 1; version <= WORLD_MAP_CHARACTER_MAX_VERSIONS; version += 1) {
    const candidate = characterVersion("wren", version);
    state = saveWorldMapCharacterVisualVersion(state, {
      characterId: "wren",
      characterName: "Wren",
      versionId: candidate.versionId,
      references: candidate.references,
      savedAt: candidate.createdAt,
    });
  }
  assert.equal(worldMapCharacterVisualVersions(state, "wren").length, 5);

  const sixth = characterVersion("wren", 6);
  const capped = saveWorldMapCharacterVisualVersion(state, {
    characterId: "wren",
    characterName: "Wren",
    versionId: sixth.versionId,
    references: sixth.references,
    savedAt: sixth.createdAt,
  });
  assert.equal(worldMapCharacterVisualVersions(capped, "wren").length, 5);
  assert.equal(worldMapCharacterVisualVersions(capped, "wren").some((version) => version.id === sixth.versionId), false);

  state = lockWorldMapCharacterVisualVersion(state, "wren", "wren-version-2", "2026-09-26T19:00:00.000Z");
  assert.equal(worldMapCharacterVisualVersions(state, "wren").filter((version) => version.locked).length, 1);
  assert.equal(approvedWorldMapCharacterReferences(state, "wren").every((url) => url.includes("wren-v2-")), true);

  state = lockWorldMapCharacterVisualVersion(state, "wren", "wren-version-5", "2026-09-26T19:01:00.000Z");
  const versions = worldMapCharacterVisualVersions(state, "wren");
  assert.equal(versions.length, 5);
  assert.equal(versions.filter((version) => version.locked).length, 1);
  assert.equal(versions.find((version) => version.locked)?.id, "wren-version-5");
  assert.equal(approvedWorldMapCharacterReferences(state, "wren").length, 8);
  assert.equal(approvedWorldMapCharacterReferences(state, "wren").every((url) => url.includes("wren-v5-")), true);
  assert.equal(state.characterVisuals[0].references.filter((reference) => reference.reviewState === "approved").length, 8);
});

test("#2493 legacy approved character package normalizes to one saved and locked version", () => {
  const legacy = normalizeWorldMapState({
    version: 1,
    characterVisuals: [{
      characterId: "wren",
      characterName: "Wren",
      references: WORLD_MAP_CHARACTER_VIEWS.map((view, index) => ({
        id: `legacy-${view.id}`,
        characterId: "wren",
        characterName: "Wren",
        view: view.id,
        assetUrl: `/api/local-ai/assets/legacy-wren-${index + 1}.webp`,
        prompt: `Legacy Wren ${view.label}`,
        provider: "local",
        model: "image",
        createdAt: "2026-09-25T12:00:00.000Z",
        reviewState: "approved",
      })),
      approvedAt: "2026-09-25T12:05:00.000Z",
      updatedAt: "2026-09-25T12:05:00.000Z",
    }],
  });

  const versions = worldMapCharacterVisualVersions(legacy, "wren");
  assert.equal(versions.length, 1);
  assert.equal(versions[0].locked, true);
  assert.equal(versions[0].complete, true);
  assert.match(versions[0].id, /^legacy-locked-wren$/u);
  assert.equal(approvedWorldMapCharacterReferences(legacy, "wren").length, 8);
});

test("#2493 poster versions cap at five and one accepted Marketing Reference is the lock", () => {
  const artifacts = [poster(1), poster(2), poster(3), poster(4), poster(5), poster(6)];
  const versions = marketingReferenceVersions(artifacts);
  assert.equal(MARKETING_REFERENCE_MAX_VERSIONS, 5);
  assert.equal(versions.length, 5);
  assert.deepEqual(versions.map((artifact) => artifact.id), ["poster-6", "poster-5", "poster-4", "poster-3", "poster-2"]);
  const locked = lockedMarketingReference(artifacts, ["unrelated-foundation-artifact", "poster-4"]);
  assert.equal(locked?.id, "poster-4");
  assert.equal(lockedMarketingReference(artifacts, ["unrelated-foundation-artifact"]), null);
});

test("#2493 single lock preserves saved versions and the developer brief records local durability", async () => {
  const [surface, brief, contract] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("docs/developer-briefs/2493-worldmap-explicit-save-local-version-history.md"),
    read("core/contracts/world-map/index.ts"),
  ]);

  const lockPoster = surface.slice(surface.indexOf("function lockPosterVersion"), surface.indexOf("  return (", surface.indexOf("function lockPosterVersion")));
  assert.match(lockPoster, /foundations\.visual\.unaccept/u);
  assert.match(lockPoster, /foundations\.visual\.accept/u);
  assert.match(lockPoster, /posterVersions/u);
  assert.doesNotMatch(lockPoster, /acceptedVisualArtifactIds\.map/u);

  assert.match(contract, /WORLD_MAP_CHARACTER_MAX_VERSIONS = 5/u);
  assert.match(contract, /lockedVersionId/u);
  assert.match(contract, /lockWorldMapCharacterVisualVersion/u);
  assert.match(brief, /Generation creates a review candidate/u);
  assert.match(brief, /persistentHome\(\)\/assets/u);
  assert.match(brief, /Stop at green; merge only when the Human separately requests it/u);
});
