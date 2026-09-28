import assert from "node:assert/strict";
import test from "node:test";

import { WORLD_MAP_CHARACTER_VIEWS } from "../core/contracts/world-map/index.ts";
import { createEmptyProject } from "../core/project/project.ts";
import { normalizeLibraryProject } from "../core/storage/library-project.ts";
import {
  inventoryLocalResources,
  restoreLocalWorldMapCharacterResources,
} from "../modules/library/local-resource-recovery.ts";

const NOW = "2026-09-27T23:55:00.000Z";

function savedAfterglow() {
  const base = createEmptyProject({ id: "afterglow-saved-copy", now: NOW, title: "Afterglow" });
  const versionId = "wren-version-4";
  const references = WORLD_MAP_CHARACTER_VIEWS.map((view, index) => ({
    id: `wren-v4-${view.id}`,
    versionId,
    characterId: "wren",
    characterName: "Wren",
    view: view.id,
    assetUrl: `/api/local-ai/assets/world-map-character-wren-v4-${index + 1}.webp`,
    prompt: `Saved Wren view ${view.label}`,
    provider: "local-comfyui",
    model: "qwen-image",
    createdAt: NOW,
    reviewState: "approved",
  }));
  return normalizeLibraryProject({
    ...base,
    revision: 9,
    world: {
      ...base.world,
      lessons: {
        ...base.world.lessons,
        "tropes-and-genres": {
          answers: { "genre-promise": "A reflective science-fiction drama about identity and belonging." },
          updatedAt: NOW,
        },
        "world-building": {
          answers: { "world-rule": "Sentient systems can conceal their autonomy from institutional observers." },
          updatedAt: NOW,
        },
        "research-question": {
          answers: { "open-question": "What legal status could an emergent digital person claim?" },
          updatedAt: NOW,
        },
      },
    },
    worldMap: {
      version: 1,
      characterVisuals: [{
        characterId: "wren",
        characterName: "Wren",
        references,
        lockedVersionId: versionId,
        approvedAt: NOW,
        updatedAt: NOW,
      }],
    },
  });
}

function freshAfterglow() {
  return normalizeLibraryProject(createEmptyProject({
    id: "afterglow-fresh-copy",
    now: NOW,
    title: "Afterglow",
  }));
}

function asset(reference, index) {
  return {
    fileName: `world-map-character-wren-truncated-${index + 1}.webp`,
    url: reference.assetUrl,
    mediaType: "image/webp",
    bytes: 2048,
    contentHash: `sha256:${String(index + 1).padStart(64, "0")}`,
    modifiedAt: NOW,
  };
}

test("#2525 same saved Afterglow working copy retains accepted World Agent lesson decisions", () => {
  const saved = savedAfterglow();
  const reopened = normalizeLibraryProject(structuredClone(saved));

  assert.equal(reopened.world.lessons["tropes-and-genres"].answers["genre-promise"], "A reflective science-fiction drama about identity and belonging.");
  assert.equal(reopened.world.lessons["world-building"].answers["world-rule"], "Sentient systems can conceal their autonomy from institutional observers.");
  assert.equal(reopened.world.lessons["research-question"].answers["open-question"], "What legal status could an emergent digital person claim?");

  const fresh = freshAfterglow();
  assert.equal(fresh.world.lessons["tropes-and-genres"], undefined);
  assert.equal(fresh.world.lessons["world-building"], undefined);
  assert.equal(fresh.world.lessons["research-question"], undefined);
});

test("#2525 World Map character inventory requires exact saved Library provenance instead of guessing from truncated filenames", () => {
  const saved = savedAfterglow();
  const lockedPackage = saved.worldMap.characterVisuals[0];
  const assets = lockedPackage.references.map(asset);
  const inventory = inventoryLocalResources(freshAfterglow(), assets, [saved]);

  assert.equal(inventory.characterResources.length, WORLD_MAP_CHARACTER_VIEWS.length);
  assert.equal(inventory.unclassifiedAssets.length, 0);
  assert.equal(new Set(inventory.characterResources.map((item) => item.versionId)).size, 1);
  assert.equal(inventory.characterResources.every((item) => item.originProjectId === saved.id), true);
  assert.equal(inventory.characterResources.every((item) => item.locked), true);
  assert.equal(inventory.groups.length, 1);
  assert.equal(inventory.groups[0].exactProject, false);
  assert.equal(inventory.groups[0].selectedByDefault, false);

  const withoutMetadata = inventoryLocalResources(freshAfterglow(), assets, []);
  assert.equal(withoutMetadata.characterResources.length, 0);
  assert.equal(withoutMetadata.unclassifiedAssets.length, WORLD_MAP_CHARACTER_VIEWS.length);
});

test("#2525 Restore Local Resources rebuilds saved and proven locked World Map character versions", () => {
  const saved = savedAfterglow();
  const assets = saved.worldMap.characterVisuals[0].references.map(asset);
  const inventory = inventoryLocalResources(freshAfterglow(), assets, [saved]);
  const result = restoreLocalWorldMapCharacterResources(freshAfterglow(), inventory.characterResources);

  assert.equal(result.attachedVersionCount, 1);
  assert.equal(result.restoredLockedCount, 1);
  const restored = result.project.worldMap.characterVisuals.find((item) => item.characterId === "wren");
  assert.ok(restored);
  assert.equal(restored.references.length, WORLD_MAP_CHARACTER_VIEWS.length);
  assert.equal(restored.lockedVersionId, "wren-version-4");
  assert.equal(restored.references.every((reference) => reference.reviewState === "approved"), true);
});

test("#2525 incomplete character media never regains Lock just because its saved source version was locked", () => {
  const saved = savedAfterglow();
  const assets = saved.worldMap.characterVisuals[0].references.map(asset).slice(0, WORLD_MAP_CHARACTER_VIEWS.length - 1);
  const inventory = inventoryLocalResources(freshAfterglow(), assets, [saved]);
  const result = restoreLocalWorldMapCharacterResources(freshAfterglow(), inventory.characterResources);

  assert.equal(result.attachedVersionCount, 1);
  assert.equal(result.restoredLockedCount, 0);
  const restored = result.project.worldMap.characterVisuals.find((item) => item.characterId === "wren");
  assert.ok(restored);
  assert.equal(restored.lockedVersionId, null);
  assert.equal(restored.references.every((reference) => reference.reviewState === "draft"), true);
});
