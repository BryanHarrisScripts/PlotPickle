import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { WORLD_MAP_CHARACTER_VIEWS, saveWorldMapCharacterVisualVersion, lockWorldMapCharacterVisualVersion, worldMapCharacterVisualVersions, createEmptyWorldMapState } from "../core/contracts/world-map/index.ts";

const read = (p) => readFile(new URL(`../${p}`, import.meta.url), "utf8");

test("#3019 Characters is a true in-ASSETS panel rather than jumping to Mind Map", async () => {
  const [assets, host, char] = await Promise.all([
    read("app/skin-v1/assets-workspace.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/assets-characters.tsx"),
  ]);
  assert.match(assets, /setFolder\("characters"\)/u);
  assert.match(assets, /<AssetsCharacters/u);
  assert.match(char, /aria-label="Characters visual workspace"/u);
  assert.match(char, /aria-label="Screenplay character roster"/u);
  assert.match(char, /onManageCharacterTruth/u);
  assert.match(host, /onOpenCharacters=/u);
});

test("#3019 character workflow binds selected project, canonical Truth and identity-locked view generation", async () => {
  const s = await read("app/skin-v1/assets-characters.tsx");
  for (const token of [
    "mindMapCharacterRoster(project)",
    "mindMapCharacterVisualPrompt(project, selected.id, selectedView)",
    "mindMapCharacterVisualGenerationPlan(project, selected.id",
    "plan.approvedReferenceImages",
    '"world-map-locked-character-reference"',
    "billingAcknowledged: cloud && paidConsent",
    "validateProject(project.id, project.revision)",
    "verifyLocalImage(image.assetUrl)",
    'requestCount: 1',
  ]) assert.ok(s.includes(token), `missing character truth/route guard: ${token}`);
  assert.doesNotMatch(s, /window\.confirm|window\.location\.assign|localStorage\.setItem/u);
});

test("#3019 Save then Lock uses existing PPF World Map reference ownership and readback", async () => {
  const s = await read("app/skin-v1/assets-characters.tsx");
  for (const token of [
    "saveWorldMapCharacterVisualVersion",
    "lockWorldMapCharacterVisualVersion",
    "worldMapCharacterVisualVersions",
    "loadLibraryProjectSnapshot",
    "sessionActiveProjectId()",
    "saveActiveLibraryProject(next)",
    "await persistActiveProfileProject()",
    "await flushProfilePrivateWrites()",
    "reference.assetUrl",
    "reference.id",
    "version.complete",
  ]) assert.ok(s.includes(token), `missing PPF save/reopen gate: ${token}`);
  assert.match(s, /only complete eight-view versions can be locked/iu);
});

test("#3019 complete view package locks without evicting previously saved evidence", () => {
  assert.equal(WORLD_MAP_CHARACTER_VIEWS.length, 8);
  const versionId = "v1";
  let map = createEmptyWorldMapState();
  const references = WORLD_MAP_CHARACTER_VIEWS.map((view, i) => ({
    id: `ref-${i}`, versionId, characterId: "character:pilot", characterName: "Pilot",
    view: view.id, assetUrl: `/api/local-ai/assets/ref-${i}.webp`,
    prompt: "A source-bound production view", provider: "local", model: "test-fixture",
    createdAt: "2026-10-16T00:00:00.000Z", reviewState: "draft",
  }));
  map = saveWorldMapCharacterVisualVersion(map, { characterId: "character:pilot", characterName: "Pilot", versionId, references, savedAt: "2026-10-16T00:00:00.000Z" });
  assert.equal(worldMapCharacterVisualVersions(map, "character:pilot")[0].complete, true);
  map = lockWorldMapCharacterVisualVersion(map, "character:pilot", versionId, "2026-10-16T00:00:01.000Z");
  const locked = worldMapCharacterVisualVersions(map, "character:pilot")[0];
  assert.equal(locked.locked, true);
  assert.equal(locked.references.length, 8);
  assert.equal(locked.references.every((ref) => ref.reviewState === "approved"), true);
});

test("#3019 Character UI reuses Community/Outline panel hierarchy and accessible status rather than unstyled image dump", async () => {
  const [jsx, css] = await Promise.all([read("app/skin-v1/assets-characters.tsx"), read("app/skin-v1/assets-characters.module.css")]);
  for (const cls of ["hero", "rail", "person", "detail", "panel", "grid", "controls", "actions", "candidate", "state"]) {
    assert.match(css, new RegExp(`\\.${cls}\\b`, "u"));
  }
  assert.match(jsx, /aria-pressed=\{selected\?\.id === item\.id\}/u);
  assert.match(jsx, /role="status" aria-live="polite"/u);
  assert.match(css, /focus-visible/u);
  assert.match(css, /@media\(max-width:900px\)/u);
  assert.match(css, /var\(--pp-skin-accent-bright\)/u);
});
