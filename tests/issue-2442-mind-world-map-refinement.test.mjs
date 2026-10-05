import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { plotPickleCurriculum } from "../adapters/curriculum/current-catalog.ts";
import { buildWorldPlanLessons } from "../core/contracts/world-plan/index.ts";
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

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2442/#2770 Storyboard and Timeline return to Dashboard and Outline disclosures default closed", async () => {
  const [visual, timeline, foundation, written, registry] = await Promise.all([
    read("app/_components/storyboard/visual-story-workspace.tsx"),
    read("app/_components/storyboard/scene-timeline-workspace.tsx"),
    read("app/skin-v1/story-card-foundation-board.tsx"),
    read("app/skin-v1/act-written-story-board.tsx"),
    read("config/skin-v1-surface-registry.json"),
  ]);

  for (const source of [visual, timeline]) {
    assert.match(source, /Back to Dashboard/u);
    assert.match(source, /plotpickle:return-dashboard/u);
    assert.doesNotMatch(source, />Back to Storyboard<\/button>/u);
    assert.doesNotMatch(source, /data-skin-v1-return="storyboard"/u);
  }
  const registryModel = JSON.parse(registry);
  assert.equal(registryModel.surfaces.find((surface) => surface.id === "scene-timeline")?.parent, "dashboard");
  assert.doesNotMatch(foundation, /<details[^>]+open=\{!turningPointSelected/u);
  assert.doesNotMatch(written, /<details[^>]+open=\{!turningPointSelected/u);
});

test("#2442/#2604 MindMap keeps written ideas plus canonical Learn-backed field authoring", async () => {
  const [surface, contract, host, registry] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("core/contracts/discovery/index.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("config/skin-v1-surface-registry.json"),
  ]);

  assert.match(host, /<h1>MindMap<\/h1>/u);
  assert.match(host, /aria-label="MindMap"/u);
  assert.match(surface, /MindMap · ACT \{selectedAct\} · NON-CANON PROJECTION/u);
  assert.match(surface, /Material type[\s\S]*Written idea/u);
  assert.doesNotMatch(surface, /<select/u);
  assert.doesNotMatch(surface, /Visual reference<\/option>/u);
  assert.match(surface, /<StoryActRail activeAct=\{selectedAct\} ariaLabel="MindMap acts" choiceDataAttribute="data-mind-map-act-choice" onOpen=\{changeAct\} \/>/u);
  assert.match(surface, /DISCOVERY_LANES/u);
  assert.match(surface, /agentId: "creative-director"/u);
  assert.match(surface, /conversationMode: true/u);
  assert.match(surface, /buildStoryDevelopmentFields\(plotPickleCurriculum\)/u);
  assert.match(surface, /field\.actionLabel/u);
  assert.match(surface, /Use Proposal/u);
  assert.match(surface, /sourceState: "agent-proposal"/u);
  assert.match(contract, /"agent-proposal"/u);

  const parsed = JSON.parse(registry);
  assert.equal(parsed.surfaces.find((item) => item.id === "discovery")?.label, "Mind Map");
  for (const lane of ["story", "plot", "character", "scene", "dialogue", "world", "research", "theme", "motif", "visual", "image"]) {
    assert.match(contract, new RegExp(`id: "${lane}"`, "u"));
  }
});

test("#2442/#2605 World Map routes revision to Mind Map instead of owning World-agent saves", async () => {
  const [surface, host, registry] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("config/skin-v1-surface-registry.json"),
  ]);

  assert.match(host, /<h1>WORLD MAP<\/h1>/u);
  assert.match(surface, /data-world-map-surface="review"/u);
  assert.match(surface, /data-story-bible-read-only="true"/u);
  assert.match(surface, /Edit in Mind Map/u);
  assert.match(host, /openMindMapField/u);
  assert.doesNotMatch(surface, /agentId: "world"|Ask World Agent|data-world-agent-review-actions/u);
  assert.doesNotMatch(surface, /saveActiveLibraryProject/u);

  const parsed = JSON.parse(registry);
  assert.equal(parsed.surfaces.find((item) => item.id === "story-bible")?.label, "World Map");
});

test("#2442/#2493/#2605 character visual authority remains durable while World Map only reviews it", async () => {
  assert.equal(WORLD_MAP_CHARACTER_VIEWS.length, 8);
  assert.equal(WORLD_MAP_CHARACTER_MAX_VERSIONS, 5);
  const createdAt = "2026-09-25T12:00:00.000Z";
  const versionId = "joy-version-1";
  const refs = WORLD_MAP_CHARACTER_VIEWS.map((view) => ({
    id: `ref-${view.id}`,
    versionId,
    characterId: "joy",
    characterName: "Joy",
    view: view.id,
    assetUrl: `/api/local-ai/assets/joy-${view.id}.webp`,
    prompt: `Joy ${view.label}`,
    provider: "local",
    model: "image-model",
    createdAt,
    reviewState: "draft",
  }));
  let state = saveWorldMapCharacterVisualVersion(createEmptyWorldMapState(), {
    characterId: "joy", characterName: "Joy", versionId, references: refs, savedAt: createdAt,
  });
  state = lockWorldMapCharacterVisualVersion(state, "joy", versionId, "2026-09-25T12:05:00.000Z");
  assert.equal(approvedWorldMapCharacterReferences(state, "joy").length, 8);
  assert.equal(normalizeWorldMapState(state).characterVisuals[0].lockedVersionId, versionId);

  const source = await read("app/skin-v1/story-bible-surface.tsx");
  assert.match(source, /Approved character truth and visual identity/u);
  assert.doesNotMatch(source, /Generate Character Visual|Generate Missing Views|>Save<\/button>|>Lock<\/button>/u);
});

test("#2442 approved Library World Map character references feed Storyboard identity grounding", async () => {
  const [workspace, library, projection] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("core/storage/library-project.ts"),
    read("core/project/story-bible-projection.ts"),
  ]);

  assert.match(library, /readonly worldMap: WorldMapState/u);
  assert.match(library, /normalizeWorldMapState\(source\.worldMap\)/u);
  assert.match(library, /createEmptyWorldMapState\(\)/u);
  assert.match(workspace, /approvedWorldMapCharacterReferences\(project\.worldMap, characterId\)/u);
  assert.match(workspace, /World Map approved multi-view visual reference package/u);
  assert.match(workspace, /approvedVisualRefs/u);
  assert.match(projection, /approvedWorldMapCharacterReferences\(project\.worldMap, characterId\)/u);
});
