import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2646 complete Character roster follows canonical Character Truth without a presentation cap", async () => {
  const [projection, afterglowTruth] = await Promise.all([
    read("modules/learn/model/mind-map-character-roster.ts"),
    read("modules/library/reference/afterglow-character-truth.ts"),
  ]);

  assert.match(projection, /const evidence = project\.sourceEvidence\.characterTruth/u);
  assert.match(projection, /\.\.\.evidence\.principalCharacterIds/u);
  assert.match(projection, /return characterIds\.map\(\(characterId\) => \{/u);
  assert.doesNotMatch(projection, /characterIds\.slice|characterIds\.splice/u);

  for (const id of ["ren", "amy", "isobel", "joy", "kai", "jai"]) {
    assert.match(afterglowTruth, new RegExp(`\\b${id}: \\[`, "u"), `Afterglow Character Truth is missing canonical roster id ${id}`);
  }
  assert.match(afterglowTruth, /const principalCharacterIds = Object\.keys\(principalCharacterAliases\)/u);
  assert.match(afterglowTruth, /currentProject\.characters\.map\(\(character\) => character\.id\)/u);
});

test("#2646 Blank owns no sample Character roster or character visuals", async () => {
  const [sourceEvidence, worldMap, surface] = await Promise.all([
    read("core/contracts/imported-screenplay-evidence/index.ts"),
    read("core/contracts/world-map/index.ts"),
    read("app/skin-v1/discovery-surface.tsx"),
  ]);

  assert.match(sourceEvidence, /return \{ screenplay: null, referenceFixture: null, storyMatrix: null, characterTruth: null, resumeProvenance: null \}/u);
  assert.match(worldMap, /return \{ version: WORLD_MAP_VERSION, characterVisuals: \[\] \}/u);
  assert.match(surface, /const characterRoster = useMemo\(\(\) => project \? mindMapCharacterRoster\(project\) : \[\], \[project\]\)/u);
  assert.doesNotMatch(surface, /\["ren", "amy", "isobel"|Afterglow.*characterRoster/iu);
});

test("#2646 roster projection enumerates all saved versions and references from existing owners", async () => {
  const projection = await read("modules/learn/model/mind-map-character-roster.ts");

  assert.match(projection, /worldMapCharacterVisualPackage\(project\.worldMap, characterId\)/u);
  assert.match(projection, /worldMapCharacterVisualVersions\(project\.worldMap, characterId\)/u);
  assert.match(projection, /visualVersions\.flatMap\(\(version\) => version\.references\)/u);
  assert.match(projection, /approvedWorldMapCharacterReferences\(project\.worldMap, characterId\)/u);
  assert.match(projection, /lockedVersionId: visualPackage\?\.lockedVersionId \?\? null/u);
  assert.doesNotMatch(projection, /visualVersions\.slice|references\.slice/u);
});

test("#2646 Mind Map Character selection establishes one active roster target for fields, Notes and Agent context", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /const \[selectedCharacterId, setSelectedCharacterId\] = useState<string \| null>\(null\)/u);
  assert.match(surface, /data-mind-map-character-roster-count=\{characterRoster\.length\}/u);
  assert.match(surface, /data-mind-map-character-id=\{character\.id\}/u);
  assert.match(surface, /data-selected-character=\{selectedCharacter\?\.id === character\.id \? "true" : "false"\}/u);
  assert.match(surface, /setSelectedCharacterId\(character\.id\)/u);
  assert.match(surface, /data-mind-map-character-target=\{selectedCharacter\.id\}/u);
  assert.match(surface, /::character-\$\{selectedCharacter\.id\}/u);
  assert.match(surface, /characterTarget: field\.topicId === "character" && selectedCharacter/u);
  assert.match(surface, /field\.topicId === "character" \? selectedCharacter\?\.id : null/u);
});

test("#2646 Character visual history renders every saved version/reference with original provenance IDs", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");

  assert.match(surface, /characterRoster\.map\(\(character\) => \(/u);
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
  const body = recovery.slice(start);

  assert.match(body, /const groups = new Map/u);
  assert.match(body, /for \(const resource of resources\)/u);
  assert.match(body, /for \(const group of groups\.values\(\)\)/u);
  assert.match(body, /saveWorldMapCharacterVisualVersion/u);
  assert.match(body, /lockWorldMapCharacterVisualVersion/u);
  assert.doesNotMatch(body, /resources\.slice|groups\.values\(\)\.next/u);
});
