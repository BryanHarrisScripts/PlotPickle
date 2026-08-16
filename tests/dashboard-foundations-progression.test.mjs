import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Dashboard is a real root workspace and LEARN remains the default entry", async () => {
  const [page, shell] = await Promise.all([
    read("app/page.tsx"),
    read("app/plotpickle-workspace-shell.tsx"),
  ]);

  assert.match(shell, /RootWorkspace = [^;]*"dashboard"/);
  assert.match(shell, /RootWorkspace = [^;]*"build"/);
  assert.match(shell, /id: "dashboard"[^\n]*selectable: true/);
  assert.match(shell, /id: "build"[^\n]*selectable: true/);
  assert.match(page, /requested === "dashboard"/);
  assert.match(page, /requested === "build"/);
  assert.match(page, /workspace === "dashboard"/);
  assert.match(page, /workspace === "build"/);
  assert.match(page, /<DashboardWorkspace curriculum=\{plotPickleCurriculum\}/);
  assert.match(page, /<FoundationsBuildWorkspace/);
  assert.match(page, /return "learn"/);
});

test("Foundations progression is derived from canonical LEARN PLAN and BUILD state", async () => {
  const [progression, project, buildContract] = await Promise.all([
    read("modules/dashboard/foundations-progression.ts"),
    read("core/project/project.ts"),
    read("core/contracts/build-progress.ts"),
  ]);

  assert.match(progression, /lesson\.topic === "foundations"/);
  assert.match(progression, /project\.learning\.completedLessonIds/);
  assert.match(progression, /buildFoundationPlanLessons\(curriculum\)/);
  assert.match(progression, /countFoundationAnswers\(planLessons, project\.foundations\)/);
  assert.match(progression, /project\.build\.foundations\.acceptedVisualArtifactIds\.length/);
  assert.match(progression, /plan: planComplete \? "complete" : learnComplete \? "available" : "locked"/);
  assert.match(progression, /build: buildComplete \? "complete" : planComplete \? "available" : "locked"/);
  assert.match(progression, /worldUnlocked: buildComplete/);
  assert.match(project, /readonly build: BuildProgressState/);
  assert.match(project, /build: createEmptyBuildProgressState\(\)/);
  assert.match(project, /build: normalizeBuild\(source\.build\)/);
  assert.match(buildContract, /visualArtifacts/);
  assert.match(buildContract, /acceptedVisualArtifactIds/);
});

test("BUILD acceptance is a project command rather than a Dashboard-only flag", async () => {
  const [commands, reducer, dashboard] = await Promise.all([
    read("core/contracts/story-command.ts"),
    read("core/project/apply-command.ts"),
    read("modules/dashboard/ui/dashboard-workspace.tsx"),
  ]);

  assert.match(commands, /"foundations\.visual\.store"/);
  assert.match(commands, /"foundations\.visual\.accept"/);
  assert.match(commands, /"foundations\.visual\.unaccept"/);
  assert.match(reducer, /case "foundations\.visual\.accept"/);
  assert.match(reducer, /artifactExists/);
  assert.match(reducer, /case "foundations\.visual\.unaccept"/);
  assert.doesNotMatch(dashboard, /localStorage\.setItem/);
  assert.match(dashboard, /FOUNDATION_PROJECT_SAVED_EVENT/);
});

test("Dashboard makes the LEARN PLAN BUILD unlock path visually explicit", async () => {
  const [dashboard, styles] = await Promise.all([
    read("modules/dashboard/ui/dashboard-workspace.tsx"),
    read("modules/dashboard/ui/dashboard-workspace.module.css"),
  ]);

  assert.match(dashboard, /Learn it\. Plan it\. See it\./);
  assert.match(dashboard, /✓ Complete/);
  assert.match(dashboard, /→ Available/);
  assert.match(dashboard, /🔒 Locked/);
  assert.match(dashboard, /Complete the 11 Foundations lessons/);
  assert.match(dashboard, /Finish the Foundations PLAN questions to open BUILD/);
  assert.match(dashboard, /WORLD unlocks after at least one Foundations visual is accepted in BUILD/);
  assert.match(dashboard, /disabled=\{locked\}/);
  assert.match(dashboard, /onNavigate\(stage\.id\)/);
  assert.match(styles, /grid-template-columns: repeat\(3/);
  assert.match(styles, /@media \(max-width: 820px\)/);
  assert.match(styles, /:focus-visible/);
});

test("BUILD creates real persisted visuals and requires explicit writer acceptance", async () => {
  const build = await read("modules/build/ui/foundations-build-workspace.tsx");
  assert.match(build, /deriveFoundationsProgression/);
  assert.match(build, /Finish PLAN before BUILD/);
  assert.match(build, /\/api\/local-ai\/generate\/image/);
  assert.match(build, /type: "foundations\.visual\.store"/);
  assert.match(build, /type: "foundations\.visual\.accept"/);
  assert.match(build, /type: "foundations\.visual\.unaccept"/);
  assert.match(build, /type: "foundations\.visual\.discard"/);
  assert.match(build, /generation alone does not complete BUILD/i);
  assert.match(build, /WORLD is now unlocked/);
  assert.match(build, /saveFoundationProject/);
});
