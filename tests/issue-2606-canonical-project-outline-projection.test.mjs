import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2606 defines a stable derived canonical project projection for Outline", async () => {
  const [projection, library, outline] = await Promise.all([
    read("modules/plan/projections/canonical-project-outline.ts"),
    read("core/storage/library-project.ts"),
    read("app/skin-v1/matrix-story-map-surface.tsx"),
  ]);

  assert.match(projection, /OUTLINE_CANONICAL_PROJECT_PROJECTION_VERSION = 1/u);
  assert.match(projection, /buildStoryDevelopmentFields\(plotPickleCurriculum\)/u);
  assert.match(projection, /storyDevelopmentFieldView\(project, field\)/u);
  assert.match(projection, /project\.structure\.blocks\.map/u);
  assert.match(projection, /projectRevision: project\.revision/u);
  assert.match(projection, /never persists an Outline-owned copy/u);

  assert.doesNotMatch(library, /readonly outline\s*:/u);
  assert.match(outline, /projectCanonicalProjectForOutline\(project\)/u);
  assert.match(outline, /data-outline-canonical-projection-version=\{canonicalProjection\.version\}/u);
  assert.match(outline, /data-outline-canonical-field-count=\{canonicalProjection\.fields\.length\}/u);
});

test("#2606 keeps Blank as the default while first Save creates durable project identity", async () => {
  const [browser, mindMap, policy] = await Promise.all([
    read("core/storage/project-library-browser.ts"),
    read("app/skin-v1/discovery-surface.tsx"),
    readJson("config/blank-example-project-policy.json"),
  ]);

  assert.match(browser, /detachedProjectCache = \{ profileId: activeProfileId, project \}/u);
  assert.match(browser, /export function loadActiveLibraryProject/u);
  assert.match(browser, /export function saveDetachedLibraryProjectAs/u);
  assert.match(mindMap, /Save as New Project/u);
  assert.match(mindMap, /saveDetachedLibraryProjectAs/u);
  assert.equal(policy.blankToProject.actionLabel, "Save as New Project");
  assert.equal(policy.blankToProject.createsFreshIdentity, true);
});

test("#2606 preserves the Mind Map -> World Map -> Learn -> Mind Map canonical loop", async () => {
  const [mindMap, worldMap, host, learning] = await Promise.all([
    read("app/skin-v1/discovery-surface.tsx"),
    read("app/skin-v1/story-bible-surface.tsx"),
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("modules/learn/model/story-learning-context.ts"),
  ]);

  assert.match(mindMap, /storyDevelopmentFieldView\(project, field, selectedAct\)/u);
  assert.match(worldMap, /storyDevelopmentFieldView\(project, field, act\)/u);
  assert.match(worldMap, /onOpenLearn\(field\.topicId, field\.lessonId, act\)/u);
  assert.match(worldMap, /onEditField\(field\.topicId, field\.canonicalId, act\)/u);
  assert.match(host, /openMindMapField\(topic: LearnTopicSpineId, canonicalFieldId: string, act: StoryDevelopmentAct\)/u);
  assert.match(learning, /lesson: lessonId/u);
  assert.match(host, /function openContextualLearn/u);
  assert.doesNotMatch(worldMap, /window\.location\.assign/u);
});

test("#2606 packaged Afterglow remains explicit and projects through the same canonical stores", async () => {
  const snapshot = await readJson("data/afterglow-packaged-current/snapshot.json");
  const project = snapshot.project;

  const foundationValues = Object.values(project.foundations.lessons)
    .flatMap((lesson) => Object.values(lesson.answers ?? {}))
    .filter((value) => typeof value === "string" && value.trim());
  assert.ok(foundationValues.length > 0);
  assert.equal(project.structure.blocks.length, 24);
  assert.ok((project.sourceEvidence.characterTruth?.principalCharacterIds ?? []).length >= 3);
});

test("#2606 Outline keeps existing behavior while consuming only derived canonical truth", async () => {
  const outline = await read("app/skin-v1/matrix-story-map-surface.tsx");
  assert.match(outline, /deriveOutlineReadiness\(project\)/u);
  assert.match(outline, /<ProgressiveStoryMap/u);
  assert.match(outline, /<StoryCardFoundationBoard/u);
  assert.match(outline, /<ActWrittenStoryBoard/u);
  assert.doesNotMatch(outline, /setCanonicalProjection/u);
  assert.doesNotMatch(outline, /saveCanonicalProjection/u);
});
