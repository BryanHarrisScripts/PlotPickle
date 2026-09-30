import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2508/#2605 World Map poster is a concise read-only reference", async () => {
  const [surface, css] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/story-bible-surface.module.css"),
  ]);
  assert.match(surface, /Current approved marketing reference/u);
  assert.match(surface, /bible\.posterUrl/u);
  assert.match(surface, /bible\.posterLabel/u);
  assert.match(surface, /NO POSTER YET/u);
  assert.doesNotMatch(surface, /Generate Poster Visual|savePosterVersion|lockPosterVersion/u);
  assert.match(css, /\.posterFrame/u);
  assert.match(css, /\.posterReview/u);
});

test("#2508/#2564/#2605 character visual identity is reviewed without save or lock controls", async () => {
  const surface = await read("app/skin-v1/story-bible-surface.tsx");
  assert.match(surface, /function CharacterReview/u);
  assert.match(surface, /Approved character truth and visual identity/u);
  assert.match(surface, /character\.imageUrl/u);
  assert.match(surface, /NO APPROVED CHARACTER IMAGE YET/u);
  assert.doesNotMatch(surface, /Generate Missing Views|Generate Character Visual|saveWorldMapCharacterVisualVersion|lockWorldMapCharacterVisualVersion/u);
});

test("#2508/#2605 World Agent proposal decisions moved out of World Map", async () => {
  const surface = await read("app/skin-v1/story-bible-surface.tsx");
  assert.match(surface, /World Map does not edit, approve, or generate them/u);
  assert.match(surface, /Edit in Mind Map/u);
  assert.doesNotMatch(surface, /WorldFactEditor|Ask World Agent|data-world-agent-review-actions/u);
  assert.doesNotMatch(surface, />Redo<\/button>|>Discard<\/button>/u);
});

test("#2508 durable World Map media authorities remain project data even though this surface no longer mutates them", async () => {
  const [surface, worldContract, library, projection] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("core/contracts/world-map/index.ts"),
    read("core/storage/library-project.ts"),
    read("core/project/story-bible-projection.ts"),
  ]);
  assert.doesNotMatch(surface, /saveActiveLibraryProject|foundations\.visual\.store|foundations\.visual\.accept/u);
  assert.match(worldContract, /saveWorldMapCharacterVisualVersion/u);
  assert.match(worldContract, /lockWorldMapCharacterVisualVersion/u);
  assert.match(library, /normalizeWorldMapState\(source\.worldMap\)/u);
  assert.match(projection, /approvedWorldMapCharacterReferences\(project\.worldMap, characterId\)/u);
});
