import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { WORLD_MAP_CHARACTER_VIEWS } from "../core/contracts/world-map/index.ts";
import { createEmptyProject } from "../core/project/project.ts";
import { normalizeLibraryProject } from "../core/storage/library-project.ts";
import { mindMapCharacterRoster } from "../modules/learn/model/mind-map-character-roster.ts";

const NOW = "2026-10-01T16:30:00.000Z";
const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function characterTruth(ids) {
  return {
    schemaVersion: 1,
    fixtureId: "issue-2646-roster",
    sources: [],
    principalCharacterIds: ids,
    claims: ids.map((id) => ({
      id: `identity-${id}`,
      characterIds: [id],
      kind: "identity",
      summary: id.charAt(0).toUpperCase() + id.slice(1),
      sourceId: "issue-2646",
      sourceRef: `character:${id}`,
      sourceVersion: "1",
      reviewState: "human-approved",
      targetArcField: null,
      handling: "writer-reference",
      canonEffect: "none",
      note: "",
    })),
    arcCells: [],
    checkpoints: [],
    governingRule: "Human-owned Character Truth roster.",
  };
}

function visualPackage(characterId, versionCount = 1) {
  const versions = Array.from({ length: versionCount }, (_, versionIndex) => {
    const version = versionIndex + 1;
    return WORLD_MAP_CHARACTER_VIEWS.map((view, viewIndex) => ({
      id: `${characterId}-v${version}-${view.id}`,
      versionId: `${characterId}-version-${version}`,
      characterId,
      characterName: characterId.charAt(0).toUpperCase() + characterId.slice(1),
      view: view.id,
      assetUrl: `/api/local-ai/assets/${characterId}-v${version}-${viewIndex + 1}.webp`,
      prompt: `${characterId} ${view.label}`,
      provider: "local-comfyui",
      model: "qwen-image",
      createdAt: `2026-10-01T16:${String(30 + version).padStart(2, "0")}:00.000Z`,
      reviewState: version === 1 ? "approved" : "draft",
    }));
  }).flat();

  return {
    characterId,
    characterName: characterId.charAt(0).toUpperCase() + characterId.slice(1),
    references: versions,
    lockedVersionId: `${characterId}-version-1`,
    approvedAt: NOW,
    updatedAt: NOW,
  };
}

function projectWithRoster(ids) {
  const base = createEmptyProject({ id: "issue-2646", now: NOW, title: "Roster proof" });
  return normalizeLibraryProject({
    ...base,
    sourceEvidence: {
      screenplay: null,
      referenceFixture: null,
      storyMatrix: null,
      characterTruth: characterTruth(ids),
    },
    worldMap: {
      version: 1,
      characterVisuals: [
        visualPackage(ids[0], 2),
        ...ids.slice(1).map((id) => visualPackage(id, 1)),
      ],
    },
  });
}

test("#2646 complete Character roster follows principal Character Truth without a presentation cap", () => {
  const ids = ["ren", "amy", "isobel", "joy", "kai", "jai"];
  const project = projectWithRoster(ids);
  const roster = mindMapCharacterRoster(project);

  assert.equal(roster.length, ids.length);
  assert.deepEqual(roster.map((character) => character.id), ids);
  assert.deepEqual(roster.map((character) => character.name), ["Ren", "Amy", "Isobel", "Joy", "Kai", "Jai"]);
  assert.equal(roster[0].visualVersions.length, 2);
  assert.equal(roster[0].references.length, WORLD_MAP_CHARACTER_VIEWS.length * 2);
  assert.equal(roster[0].lockedVersionId, "ren-version-1");
  assert.ok(roster[0].previewUrl?.includes("/api/local-ai/assets/ren-v1-"));
});

test("#2646 Blank has no leaked Character roster or visual resources", () => {
  const blank = normalizeLibraryProject(createEmptyProject({ id: "blank", now: NOW, title: "Blank" }));
  assert.deepEqual(mindMapCharacterRoster(blank), []);
  assert.deepEqual(blank.worldMap.characterVisuals, []);
  assert.equal(blank.sourceEvidence.characterTruth, null);
});

test("#2646 roster projection enumerates all saved versions and references from existing owners", async () => {
  const source = await read("modules/learn/model/mind-map-character-roster.ts");

  assert.match(source, /evidence\.principalCharacterIds/u);
  assert.match(source, /worldMapCharacterVisualPackage\(project\.worldMap, characterId\)/u);
  assert.match(source, /worldMapCharacterVisualVersions\(project\.worldMap, characterId\)/u);
  assert.match(source, /visualVersions\.flatMap\(\(version\) => version\.references\)/u);
  assert.doesNotMatch(source, /characterIds\.slice|visualVersions\.slice|references\.slice/u);
});

test("#2646 Mind Map Character selection establishes one active roster target for fields, Notes and Agent context", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /const \[selectedCharacterId, setSelectedCharacterId\] = useState<string \| null>\(null\)/u);
  assert.match(surface, /const characterRoster = useMemo\(\(\) => project \? mindMapCharacterRoster\(project\) : \[\], \[project\]\)/u);
  assert.match(surface, /data-mind-map-character-roster-count=\{characterRoster\.length\}/u);
  assert.match(surface, /data-mind-map-character-id=\{character\.id\}/u);
  assert.match(surface, /data-selected-character=\{selectedCharacter\?\.id === character\.id \? "true" : "false"\}/u);
  assert.match(surface, /setSelectedCharacterId\(character\.id\)/u);
  assert.match(surface, /data-mind-map-character-target=\{selectedCharacter\.id\}/u);
  assert.match(surface, /::character-\$\{selectedCharacter\.id\}/u);
  assert.match(surface, /characterTarget: field\.topicId === "character" && selectedCharacter/u);
  assert.match(surface, /field\.topicId === "character" \? selectedCharacter\?\.id : null/u);
});

test("#2646 Character visual history has no UI subset and preserves resource/provenance IDs", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /character\.visualVersions\.map\(\(version\) => \(/u);
  assert.match(surface, /version\.references\.map\(\(reference\) => \(/u);
  assert.match(surface, /data-character-visual-version=\{version\.id\}/u);
  assert.match(surface, /data-character-visual-reference=\{reference\.id\}/u);
  assert.match(surface, /reference\.assetUrl/u);
  assert.match(surface, /reference\.reviewState/u);
  assert.doesNotMatch(surface, /characterRoster\.slice|character\.visualVersions\.slice|version\.references\.slice/u);
});

test("#2646 local resource restoration remains additive across every recovered Character group", async () => {
  const recovery = await read("modules/library/local-resource-recovery.ts");
  const start = recovery.indexOf("export function restoreLocalWorldMapCharacterResources");
  const end = recovery.indexOf("\n}", start) + 2;
  const body = recovery.slice(start, end);

  assert.match(body, /const groups = new Map/u);
  assert.match(body, /for \(const resource of resources\)/u);
  assert.match(body, /for \(const group of groups\.values\(\)\)/u);
  assert.match(body, /saveWorldMapCharacterVisualVersion/u);
  assert.doesNotMatch(body, /resources\.slice|groups\.values\(\)\.next/u);
});
