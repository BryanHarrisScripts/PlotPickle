import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

const TOPICS = [
  "foundations","world","character","theme","structure","previs",
  "drafting","dialogue","revision","responsible-ai","industry","collaboration",
];

test("#2605 World Map projects the same twelve canonical Learn-backed fields as Mind Map", async () => {
  const [worldMap, mindMap, model, spine] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/discovery-surface.tsx"),
    read("modules/learn/model/story-development-fields.ts"),
    read("modules/learn/model/story-learning-context.ts"),
  ]);

  assert.match(worldMap, /buildStoryDevelopmentFields\(plotPickleCurriculum\)/u);
  assert.match(worldMap, /storyDevelopmentFieldView\(project, field, act\)/u);
  assert.match(worldMap, /data-world-map-canonical-field=\{field\.canonicalId\}/u);
  assert.match(worldMap, /data-world-map-canonical-topic=\{activeTopic\}/u);
  assert.match(mindMap, /buildStoryDevelopmentFields\(plotPickleCurriculum\)/u);
  assert.match(mindMap, /data-canonical-field-id=\{field\.canonicalId\}/u);
  assert.match(model, /storyDevelopmentCanonicalId\(topic\.id, lesson\.id, fieldId\)/u);
  for (const id of TOPICS) assert.match(spine, new RegExp(`id: "${id}"`, "u"));
});

test("#2605 World Map is read/review-only and contains no story authoring or approval controls", async () => {
  const surface = await read("app/skin-v1/story-bible-surface.tsx");

  assert.match(surface, /data-world-map-surface="review"/u);
  assert.match(surface, /data-story-bible-read-only="true"/u);
  assert.match(surface, /Current canonical project truth/u);
  assert.match(surface, /World Map does not edit, approve, or generate them/u);

  for (const forbidden of [
    "Ask World Agent",
    "Generate Poster Visual",
    "Generate Character Visual",
    "Generate Missing Views",
    "WorldFactEditor",
    "saveWorldMapProject",
    "saveActiveLibraryProject",
    "saveDetachedLibraryProjectAs",
    "/api/local-ai/generate/image",
  ]) {
    assert.equal(surface.includes(forbidden), false, `World Map still contains authoring control: ${forbidden}`);
  }
});

test("#2605 every canonical review card can reopen its Learn lesson and exact Mind Map field", async () => {
  const [surface, spine, host, mindMap] = await Promise.all([
    read("app/skin-v1/story-bible-surface.tsx"),
    read("modules/learn/model/story-learning-context.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/discovery-surface.tsx"),
  ]);

  assert.match(surface, /onOpenLearn\(field\.topicId, field\.lessonId, act\)/u);
  assert.doesNotMatch(surface, /learnLessonHref|learnTopicHref|window\.location\.assign/u);
  assert.match(surface, /Edit in Mind Map/u);
  assert.match(surface, /onEditField\(field\.topicId, field\.canonicalId, act\)/u);
  assert.match(spine, /export function learnLessonHref/u);
  assert.match(spine, /lesson: lessonId/u);

  assert.match(host, /function openMindMapField\(topic: LearnTopicSpineId, canonicalFieldId: string, act: StoryDevelopmentAct\)/u);
  assert.match(host, /setDiscoveryInitialTopic\(topic\)/u);
  assert.match(host, /setDiscoveryInitialFieldId\(canonicalFieldId\)/u);
  assert.match(host, /<StoryBibleSurface[\s\S]*onEditField=\{openMindMapField\}[\s\S]*onOpenLearn=/u);
  assert.match(host, /initialTopic=\{discoveryInitialTopic\}/u);
  assert.match(host, /initialFieldId=\{discoveryInitialFieldId\}/u);
  assert.match(host, /initialAct=\{discoveryInitialAct\}/u);

  assert.match(mindMap, /setSelectedTopic\(initialTopic\)/u);
  assert.match(mindMap, /setSelectedAct\(initialAct\)/u);
  assert.match(mindMap, /element\.dataset\.canonicalFieldId === initialFieldId/u);
  assert.match(mindMap, /scrollIntoView\(\{ behavior: "smooth", block: "center" \}\)/u);
});

test("#2605 shared project storage makes Mind Map edits visible in World Map without synchronization copies", async () => {
  const [adapter, library, host, worldMap] = await Promise.all([
    read("core/project/story-development.ts"),
    read("core/storage/library-project.ts"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/story-bible-surface.tsx"),
  ]);

  assert.match(adapter, /project\.foundations\.lessons\[field\.lessonId\]\?\.answers\[field\.fieldId\]/u);
  assert.match(adapter, /project\.world\.lessons\[field\.lessonId\]\?\.answers\[field\.fieldId\]/u);
  assert.match(adapter, /storyDevelopmentFieldState\(project\.storyDevelopment, field\.canonicalId\)\.value/u);
  assert.match(library, /readonly storyDevelopment: StoryDevelopmentState/u);
  assert.match(host, /PROJECT_LIBRARY_CHANGED_EVENT, refreshStoryBible/u);
  assert.match(host, /setStoryBibleProject\(loadActiveLibraryProject\(\)\)/u);
  assert.match(worldMap, /storyDevelopmentFieldView\(project, field, act\)/u);
});

test("#2605 Blank stays structurally complete and empty while packaged Afterglow is reviewed through the same surface", async () => {
  const [library, snapshot, surface] = await Promise.all([
    read("core/storage/library-project.ts"),
    readJson("data/afterglow-packaged-current/snapshot.json"),
    read("app/skin-v1/story-bible-surface.tsx"),
  ]);

  assert.match(library, /createEmptyStoryDevelopmentState\(\)/u);
  assert.match(surface, /Not established yet\./u);
  assert.match(surface, /NO APPROVED CHARACTER IMAGE YET/u);
  assert.match(surface, /NO POSTER YET/u);

  const project = snapshot.project;
  const foundationValues = Object.values(project.foundations.lessons)
    .flatMap((lesson) => Object.values(lesson.answers ?? {}))
    .filter((value) => typeof value === "string" && value.trim());
  assert.ok(foundationValues.length > 0);
  assert.ok((project.sourceEvidence.characterTruth?.principalCharacterIds ?? []).length >= 3);
  assert.ok(project.structure.blocks.length >= 24);
  assert.ok(project.build.foundations.visualArtifacts.length > 0);
});

test("#2605 World Map keeps rich read-only evidence supplements without making them competing value stores", async () => {
  const surface = await read("app/skin-v1/story-bible-surface.tsx");
  assert.match(surface, /activeTopic === "character"/u);
  assert.match(surface, /Approved character truth and visual identity/u);
  assert.match(surface, /activeTopic === "structure"/u);
  assert.match(surface, /4 Acts · 12 Sequences · 24 Blocks · 96 Mini-Blocks/u);
  assert.match(surface, /activeTopic === "previs"/u);
  assert.match(surface, /Current approved marketing reference/u);
  assert.match(surface, /activeTopic === "drafting"/u);
  assert.match(surface, /Written material currently connected to this Act/u);
  assert.match(surface, /activeTopic === "responsible-ai"/u);
  assert.match(surface, /Canonical evidence currently available/u);
});
