import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
const root = new URL("..", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");

test("#2647 canonical Character creation has deterministic identity and Human-approved Character Truth semantics", async () => {
  const contract = await read("core/contracts/character-truth-evidence.ts");

  assert.match(contract, /export function createCanonicalCharacterTruth/u);
  assert.match(contract, /canonicalCharacterSlug\(characterName\)/u);
  assert.match(contract, /\.normalize\("NFKD"\)/u);
  assert.match(contract, /\.toLowerCase\(\)[\s\S]*\.replace\(\/\[\^a-z0-9\]\+\/gu, "-"\)/u);
  assert.match(contract, /if \(!occupied\.has\(base\)\) return base/u);
  assert.match(contract, /const candidate = `\$\{base\.slice\(0, 150\)\}-\$\{suffix\}`/u);
  assert.match(contract, /fixtureId: `project-\$\{projectId\}-character-truth`/u);
  assert.match(contract, /principalCharacterIds: \[\.\.\.current\.principalCharacterIds, characterId\]/u);
  assert.match(contract, /kind: "identity"/u);
  assert.match(contract, /summary: characterName/u);
  assert.match(contract, /reviewState: "human-approved"/u);
  assert.match(contract, /handling: "writer-reference"/u);
  assert.match(contract, /sourceRef: `project:\$\{projectId\}:character:\$\{characterId\}`/u);
  assert.match(contract, /if \(!characterName \|\| !projectId \|\| !occurredAt\) return null/u);
  assert.doesNotMatch(contract, /Date\.now\(\)/u);
});
test("#2647 Mind Map creation writes sourceEvidence.characterTruth and immediately selects the new canonical identity", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");
  const start = surface.indexOf("function createCharacter()");
  const end = surface.indexOf("async function generateCharacterVisual", start);
  const create = surface.slice(start, end);

  assert.match(surface, /data-mind-map-create-character="true"/u);
  assert.match(surface, />Create Character<\/button>/u);
  assert.match(create, /createCanonicalCharacterTruth\(project\.sourceEvidence\.characterTruth \?\? null/u);
  assert.match(create, /sourceEvidence: \{[\s\S]*\.\.\.project\.sourceEvidence,[\s\S]*characterTruth: created\.evidence/u);
  assert.match(create, /persistCanonicalProject\(next\)/u);
  assert.match(create, /setSelectedCharacterId\(created\.characterId\)/u);
  assert.doesNotMatch(create, /characters:\s*\[|mindMapCharacters|characterRoster:\s*/u);
});

test("#2647 Blank retains creation capability without hard-coded sample characters", async () => {
  const [surface, sourceEvidence] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("core/contracts/imported-screenplay-evidence/index.ts"),
  ]);

  assert.match(sourceEvidence, /return \{ screenplay: null, referenceFixture: null, storyMatrix: null, characterTruth: null \}/u);
  assert.match(surface, /No canonical characters are established for this project yet/u);
  assert.match(surface, /data-mind-map-create-character="true"/u);
  assert.doesNotMatch(surface, /\["ren", "amy", "isobel"|defaultCharacters|sampleCharacters/iu);
});

test("#2647 governed Character visual generation uses approved truth, locked references and the existing media boundary", async () => {
  const [surface, roster] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("modules/learn/model/mind-map-character-roster.ts"),
  ]);

  assert.match(surface, /data-mind-map-character-generation=\{selectedCharacter\.id\}/u);
  assert.match(surface, /"Generate Character Visual"/u);
  assert.match(surface, /fetch\("\/api\/local-ai\/generate\/image"/u);
  assert.match(surface, /referenceImages: plan\.approvedReferenceImages/u);
  assert.match(surface, /saveWorldMapCharacterVisualVersion\(project\.worldMap/u);
  assert.match(surface, /reviewState: "draft"/u);
  assert.match(surface, /provider: result\.provider\?\.trim\(\) \|\| "configured-image-route"/u);
  assert.match(surface, /model: result\.model\?\.trim\(\) \|\| "configured-image-model"/u);
  assert.doesNotMatch(surface, /127\.0\.0\.1:8188|ComfyUI|comfyui/iu);

  assert.match(roster, /claim\.reviewState === "human-approved"/u);
  assert.match(roster, /approvedWorldMapCharacterReferences\(project\.worldMap, characterId\)/u);
  assert.match(roster, /Do not treat provider-invented physical details, wardrobe, props, age, ethnicity, or other traits as canon/u);
  assert.doesNotMatch(roster, /mindMapNotes|Human Notes/u);
});

test("#2647 generation plan never edits a locked version and respects the existing five-version limit", async () => {
  const roster = await read("modules/learn/model/mind-map-character-roster.ts");

  assert.match(roster, /versions\.find\(\(version\) => !version\.locked && !version\.complete\) \?\? null/u);
  assert.match(roster, /if \(versions\.length >= WORLD_MAP_CHARACTER_MAX_VERSIONS\)/u);
  assert.match(roster, /versionId: editable\.id/u);
  assert.match(roster, /existingReferences: editable\.references/u);
  assert.match(roster, /versionId: `mind-map-\$\{characterId\}-\$\{stamp\}`/u);
});

test("#2647 complete Character visual versions require an explicit Human lock action", async () => {
  const [surface, worldMap] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("core/contracts/world-map/index.ts"),
  ]);

  assert.match(surface, /Lock Complete Version/u);
  assert.match(surface, /disabled=\{!version\.complete \|\| savingMindMap\}/u);
  assert.match(surface, /lockWorldMapCharacterVisualVersion\(project\.worldMap, selectedCharacter\.id, versionId, now\)/u);
  assert.match(worldMap, /if \(!target\?\.complete\) return state/u);
  assert.match(worldMap, /reviewState: reference\.versionId === versionId \? "approved" as const : "draft" as const/u);
});

test("#2647 Agent Character context is bounded to Human-approved truth and excludes Human Notes", async () => {
  const surface = await read("app/skin-v1/discovery-surface.tsx");
  const start = surface.indexOf("function compactProjectContext");
  const end = surface.indexOf("export default function DiscoverySurface", start);
  const compact = surface.slice(start, end);

  assert.match(compact, /claim\.reviewState === "human-approved"/u);
  assert.match(compact, /claim\.handling === "writer-reference"/u);
  assert.match(compact, /claim\.kind !== "sensitive-source"/u);
  assert.doesNotMatch(compact, /mindMapNotes|noteDrafts|selectedFieldNote/u);
});

test("#2647 World Map and downstream projection read the same Character Truth owner", async () => {
  const [projection, library] = await Promise.all([
    read("core/project/story-bible-projection.ts"),
    read("core/storage/project-library-browser.ts"),
  ]);

  assert.match(projection, /const evidence = normalizeProjectSourceEvidence\(project\.sourceEvidence\)\.characterTruth/u);
  assert.match(projection, /evidence\.principalCharacterIds/u);
  assert.match(library, /const sourceEvidence = "sourceEvidence" in incoming[\s\S]*normalizeProjectSourceEvidence\(incoming\.sourceEvidence\)/u);
  assert.match(library, /const worldMap = "worldMap" in incoming[\s\S]*normalizeWorldMapState\(incoming\.worldMap\)/u);
});
