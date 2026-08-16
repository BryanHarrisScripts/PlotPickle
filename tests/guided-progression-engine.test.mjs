import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

const GROUP_ORDER = [
  "foundations",
  "world",
  "structure",
  "drafting",
  "character",
  "industry",
  "responsible-ai",
  "theme",
  "visual-storytelling",
  "revision",
  "dialogue",
  "collaboration",
];

test("guided progression defines the canonical twelve-group order once", async () => {
  const source = await read("modules/dashboard/guided-progression.ts");
  assert.match(source, /export const GUIDED_CURRICULUM_GROUPS/);
  let cursor = -1;
  for (const groupId of GROUP_ORDER) {
    const next = source.indexOf(`id: "${groupId}"`);
    assert.ok(next > cursor, `${groupId} should appear after the previous curriculum group`);
    cursor = next;
  }
  assert.equal((source.match(/\{ id: "[^"]+", label: "[^"]+" \}/g) ?? []).length, 12);
});

test("Foundations remains the only implemented vertical slice", async () => {
  const source = await read("modules/dashboard/guided-progression.ts");
  assert.match(source, /id: "foundations"[\s\S]*implemented: true/);
  assert.match(source, /const laterGroups = GUIDED_CURRICULUM_GROUPS\.slice\(1\)/);
  assert.match(source, /implemented: false/);
  assert.match(source, /const unlocked = index === 0 && foundations\.complete/);
  assert.match(source, /learn: "locked" as const/);
  assert.match(source, /plan: "locked" as const/);
  assert.match(source, /build: "locked" as const/);
});

test("recommended next action follows LEARN then PLAN then BUILD and stops before WORLD implementation", async () => {
  const source = await read("modules/dashboard/guided-progression.ts");
  const learn = source.indexOf("Continue Foundations LEARN");
  const plan = source.indexOf("Continue Foundations PLAN");
  const build = source.indexOf("Continue Foundations BUILD");
  const world = source.indexOf("Foundations complete — World is next");
  assert.ok(learn > -1 && plan > learn && build > plan && world > build);
  assert.match(source, /workspace: null,[\s\S]*WORLD is unlocked in the progression model, but its LEARN → PLAN → BUILD implementation remains intentionally gated/);
});

test("progress percentages derive from canonical state without a second progress store", async () => {
  const [source, project] = await Promise.all([
    read("modules/dashboard/guided-progression.ts"),
    read("core/project/project.ts"),
  ]);
  assert.match(source, /project\.learning\.completedLessonIds/);
  assert.match(source, /countFoundationAnswers\(planLessons, project\.foundations\)/);
  assert.match(source, /project\.build\.foundations\.acceptedVisualArtifactIds\.length/);
  assert.match(source, /percentComplete: foundationsPercent/);
  assert.match(source, /journeyPercentComplete/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(project, /guidedProgress|journeyProgress|progressionState/);
});

test("Dashboard renders the full generalized map but does not navigate into later curriculum workspaces", async () => {
  const dashboard = await read("modules/dashboard/ui/dashboard-workspace.tsx");
  assert.match(dashboard, /progression\.groups\.map/);
  assert.match(dashboard, /12 curriculum groups\. One progression engine\./);
  assert.match(dashboard, /Only Foundations is implemented today/);
  assert.match(dashboard, /Workspace intentionally gated until the prior approved cycle is proven/);
  assert.match(dashboard, /data-ready=\{readyNext\}/);
  assert.doesNotMatch(dashboard, /onNavigate\("world"\)|onNavigate\("structure"\)|onNavigate\("character"\)/);
});

test("legacy Foundations consumers use the generalized engine through a compatibility adapter", async () => {
  const adapter = await read("modules/dashboard/foundations-progression.ts");
  assert.match(adapter, /deriveGuidedCreationProgression\(curriculum, project\)/);
  assert.match(adapter, /foundationLessonCount: foundations\.lessonCount/);
  assert.match(adapter, /worldUnlocked: Boolean\(world\?\.unlocked\)/);
});
