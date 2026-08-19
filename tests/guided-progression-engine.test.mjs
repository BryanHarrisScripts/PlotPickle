import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const GROUP_ORDER = [
  "foundations",
  "world",
  "character",
  "theme",
  "structure",
  "visual-storytelling",
  "drafting",
  "dialogue",
  "revision",
  "responsible-ai",
  "industry",
  "collaboration",
];

test("guided progression defines the canonical Visual Writer twelve-group order once", async () => {
  const [source, contract] = await Promise.all([
    read("modules/dashboard/guided-progression.ts"),
    read("core/contracts/visual-writer-progression/index.ts"),
  ]);
  assert.match(source, /from "\.\.\/\.\.\/core\/contracts\/visual-writer-progression"/);
  assert.doesNotMatch(source, /export const VISUAL_WRITER_GROUP_ORDER/);
  assert.match(source, /GUIDED_CURRICULUM_GROUPS[\s\S]*VISUAL_WRITER_GROUP_ORDER\.map/);
  assert.match(contract, /export const VISUAL_WRITER_GROUP_ORDER/);
  const orderBlock = contract.slice(contract.indexOf("export const VISUAL_WRITER_GROUP_ORDER"), contract.indexOf("] as const;") + 11);
  let cursor = -1;
  for (const groupId of GROUP_ORDER) {
    const next = orderBlock.indexOf(`"${groupId}"`);
    assert.ok(next > cursor, `${groupId} should appear after the previous curriculum group`);
    cursor = next;
  }
  assert.equal((orderBlock.match(/^\s+"[^"]+",$/gm) ?? []).length, 12);
});

test("Foundations and World are the implemented frontier while Character and later groups remain gated", async () => {
  const source = await read("modules/dashboard/guided-progression.ts");
  assert.match(source, /id: "foundations"[\s\S]*implemented: true/);
  assert.match(source, /id: "world"[\s\S]*implemented: true/);
  assert.match(source, /const laterGroups = GUIDED_CURRICULUM_GROUPS\.slice\(2\)/);
  assert.match(source, /const unlocked = index === 0 && world\.complete/);
  assert.match(source, /implemented: false/);
  assert.match(source, /learn: "locked" as const/);
  assert.match(source, /plan: "locked" as const/);
  assert.match(source, /build: "locked" as const/);
});

test("recommended next action follows both implemented LEARN PLAN BUILD cycles before Character", async () => {
  const source = await read("modules/dashboard/guided-progression.ts");
  const foundationLearn = source.indexOf("Continue Foundations LEARN");
  const foundationPlan = source.indexOf("Continue Foundations PLAN");
  const foundationBuild = source.indexOf("Continue Foundations BUILD");
  const worldLearn = source.indexOf("Continue World LEARN");
  const worldPlan = source.indexOf("Continue World PLAN");
  const worldBuild = source.indexOf("Continue World BUILD");
  const character = source.indexOf("World complete — Character is next");
  assert.ok(
    foundationLearn > -1
      && foundationPlan > foundationLearn
      && foundationBuild > foundationPlan
      && worldLearn > foundationBuild
      && worldPlan > worldLearn
      && worldBuild > worldPlan
      && character > worldBuild,
  );
  assert.match(source, /groupId: "character",[\s\S]*workspace: null/);
  assert.match(source, /Character is unlocked in the canonical progression model/);
});

test("progress percentages derive from canonical Foundations and World state without a second progress store", async () => {
  const [source, project] = await Promise.all([
    read("modules/dashboard/guided-progression.ts"),
    read("core/project/project.ts"),
  ]);
  assert.match(source, /project\.learning\.completedLessonIds/);
  assert.match(source, /countFoundationAnswers\(foundationPlanLessons, project\.foundations\)/);
  assert.match(source, /project\.build\.foundations\.acceptedVisualArtifactIds\.length/);
  assert.match(source, /countWorldAnswers\(worldPlanLessons, project\.world\)/);
  assert.match(source, /project\.build\.world\.acceptedVisualArtifactIds\.length/);
  assert.match(source, /percentComplete: foundationsPercent/);
  assert.match(source, /percentComplete: worldPercent/);
  assert.match(source, /journeyPercentComplete/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(project, /guidedProgress|journeyProgress|progressionState/);
});

test("every progression group carries the canonical output contract into consumers", async () => {
  const source = await read("modules/dashboard/guided-progression.ts");
  for (const field of [
    "prerequisiteGroupIds",
    "learned",
    "projectDecisionKinds",
    "affectsVisualGeneration",
    "buildCapability",
    "buildContextGroupIds",
    "artifactKinds",
    "approvalRequired",
    "classification",
  ]) assert.match(source, new RegExp(field));
  assert.match(source, /readonly outputContract: GuidedGroupOutputContract/);
  assert.match(source, /outputContract: foundationDefinition\.outputContract/);
  assert.match(source, /outputContract: worldDefinition\.outputContract/);
  assert.match(source, /\.\.\.definition/);
});

test("Dashboard renders World navigation but does not navigate into Character or later workspaces", async () => {
  const dashboard = await read("modules/dashboard/ui/dashboard-workspace.tsx");
  assert.match(dashboard, /progression\.groups\.map/);
  assert.match(dashboard, /12 curriculum groups\. One progression engine\./);
  assert.match(dashboard, /Foundations and World are implemented vertical slices/);
  assert.match(dashboard, /Workspace intentionally gated until the prior approved cycle is proven/);
  assert.match(dashboard, /data-ready=\{readyNext\}/);
  assert.match(dashboard, /onNavigateGuided\("learn", "world"\)/);
  assert.match(dashboard, /onNavigateGuided\("plan", "world"\)/);
  assert.match(dashboard, /onNavigateGuided\("build", "world"\)/);
  assert.doesNotMatch(dashboard, /onNavigateGuided\([^\n]*"character"|onNavigateGuided\([^\n]*"theme"|onNavigateGuided\([^\n]*"structure"/);
});

test("legacy Foundations consumers use the generalized engine through a compatibility adapter", async () => {
  const adapter = await read("modules/dashboard/foundations-progression.ts");
  assert.match(adapter, /deriveGuidedCreationProgression\(curriculum, project\)/);
  assert.match(adapter, /foundationLessonCount: foundations\.lessonCount/);
  assert.match(adapter, /worldUnlocked: Boolean\(world\?\.unlocked\)/);
});
