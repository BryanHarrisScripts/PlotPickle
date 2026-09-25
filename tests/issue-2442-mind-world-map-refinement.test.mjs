import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { plotPickleCurriculum } from "../adapters/curriculum/current-catalog.ts";
import { buildWorldPlanLessons } from "../core/contracts/world-plan/index.ts";
import {
  WORLD_MAP_CHARACTER_VIEWS,
  approveWorldMapCharacterVisualPackage,
  approvedWorldMapCharacterReferences,
  createEmptyWorldMapState,
  normalizeWorldMapState,
  upsertWorldMapCharacterVisualPackage,
} from "../core/contracts/world-map/index.ts";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2442 Storyboard returns to Dashboard and Outline disclosures default closed", async () => {
  const [visual, timeline, foundation, written] = await Promise.all([
    read("app/_components/storyboard/visual-story-workspace.tsx"),
    read("app/_components/storyboard/scene-timeline-workspace.tsx"),
    read("app/skin-v1/story-card-foundation-board.tsx"),
    read("app/skin-v1/act-written-story-board.tsx"),
  ]);

  for (const source of [visual, timeline]) {
    assert.match(source, /Back to Dashboard/u);
    assert.match(source, /plotpickle:return-dashboard/u);
    assert.doesNotMatch(source, />Back to Storyboard<\/button>/u);
    assert.doesNotMatch(source, /data-skin-v1-return="storyboard"/u);
  }
  assert.doesNotMatch(foundation, /<details[^>]+open=\{!turningPointSelected/u);
  assert.doesNotMatch(written, /<details[^>]+open=\{!turningPointSelected/u);
});

test("#2442 Mind Map is written-only and Creative Director develops all six governed lanes for each Act", async () => {
  const [surface, contract, host, registry] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("core/contracts/discovery/index.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("config/skin-v1-surface-registry.json"),
  ]);

  assert.match(host, /<h1>MINDMAP<\/h1>/u);
  assert.match(host, /aria-label="MindMap"/u);
  assert.match(surface, /MINDMAP · ACT \{selectedAct\} · NON-CANON PROJECTION/u);
  assert.match(surface, /Material type[\s\S]*Written idea/u);
  assert.doesNotMatch(surface, /<select/u);
  assert.doesNotMatch(surface, /Visual reference<\/option>/u);
  assert.match(surface, /const MIND_MAP_ACTS: readonly DiscoveryAct\[\] = \[1, 2, 3, 4\]/u);
  assert.match(surface, /DISCOVERY_LANES/u);
  assert.match(surface, /agentId: "creative-director"/u);
  assert.match(surface, /conversationMode: true/u);
  assert.match(surface, /Develop Act \$\{selectedAct\} Mind Map/u);
  assert.match(surface, /sourceState: "agent-proposal"/u);
  assert.match(surface, /classifierId: "creative-director"/u);
  assert.match(surface, /AGENT PROPOSAL/u);
  assert.match(contract, /"agent-proposal"/u);

  const parsed = JSON.parse(registry);
  assert.equal(parsed.surfaces.find((item) => item.id === "discovery")?.label, "Mind Map");
  for (const lane of ["story-plot", "character", "scene-dialogue", "world-research", "theme-motif", "visual-mood"]) {
    assert.match(contract, new RegExp(`id: "${lane}"`, "u"));
  }
});

test("#2442 World Map exposes World-agent proposal edit save without silent canon promotion", async () => {
  const [surface, host, registry] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("config/skin-v1-surface-registry.json"),
  ]);

  assert.match(host, /<h1>WORLD MAP<\/h1>/u);
  assert.match(host, /aria-label="World Map"/u);
  assert.match(surface, /data-world-map-surface="review"/u);
  assert.match(surface, /agentId: "world"/u);
  assert.match(surface, /Ask World Agent/u);
  assert.match(surface, /Agent proposal · edit before saving/u);
  assert.match(surface, /Save \/ Accept/u);
  assert.match(surface, /Discard proposal/u);
  assert.match(surface, /saveActiveLibraryProject/u);
  assert.match(surface, /answers: \{ \.\.\.lesson\.answers, \[address\.fieldId\]: proposal\.trim\(\)/u);

  const worldLessons = buildWorldPlanLessons(plotPickleCurriculum);
  const genre = worldLessons.find((lesson) => lesson.id === "genres");
  assert.ok(genre?.fields.some((field) => /dominant and secondary genres/iu.test(field.prompt)));

  const parsed = JSON.parse(registry);
  assert.equal(parsed.surfaces.find((item) => item.id === "story-bible")?.label, "World Map");
});

test("#2442 World Map character visuals use eight governed views and require Human approval", async () => {
  assert.equal(WORLD_MAP_CHARACTER_VIEWS.length, 8);
  assert.deepEqual(
    WORLD_MAP_CHARACTER_VIEWS.map((item) => item.id),
    [
      "front-full-body",
      "back-full-body",
      "left-profile",
      "right-profile",
      "left-three-quarter",
      "right-three-quarter",
      "neutral-stance",
      "secondary-stance",
    ],
  );

  const createdAt = "2026-09-25T12:00:00.000Z";
  const refs = WORLD_MAP_CHARACTER_VIEWS.map((view) => ({
    id: `ref-${view.id}`,
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
  let state = upsertWorldMapCharacterVisualPackage(createEmptyWorldMapState(), {
    characterId: "joy",
    characterName: "Joy",
    references: refs,
    approvedAt: null,
    updatedAt: createdAt,
  });
  assert.equal(approvedWorldMapCharacterReferences(state, "joy").length, 0);
  state = approveWorldMapCharacterVisualPackage(state, "joy", "2026-09-25T12:05:00.000Z");
  assert.equal(approvedWorldMapCharacterReferences(state, "joy").length, 8);
  assert.equal(normalizeWorldMapState(state).characterVisuals[0].references.every((ref) => ref.reviewState === "approved"), true);

  const source = await read("app/skin-v1/story-bible-surface.tsx");
  assert.match(source, /Generate Character Visual/u);
  assert.match(source, /Generate eight character-reference views/u);
  assert.match(source, /complete all eight views before approval/u);
  assert.match(source, /Approve \/ Lock Character Visuals/u);
  assert.match(source, /billingAcknowledged: true/u);
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
