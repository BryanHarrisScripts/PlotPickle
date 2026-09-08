import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Dashboard is a real root workspace and active projects now enter the Story Map", async () => {
  const [page, navigation, storyMapWorkspace] = await Promise.all([
    read("app/page.tsx"),
    read("app/navigation/global-shortcuts.ts"),
    read("app/story-map-workspace/index.tsx"),
  ]);

  assert.match(navigation, /RootWorkspace = [^;]*"dashboard"/);
  assert.match(navigation, /RootWorkspace = [^;]*"build"/);
  assert.match(navigation, /id: "dashboard"[^\n]*workspace: "dashboard"/);
  assert.match(navigation, /id: "build"[^\n]*workspace: "build"/);
  assert.match(page, /requested === "dashboard"/);
  assert.match(page, /requested === "learn"/);
  assert.match(page, /requested === "build"/);
  assert.match(page, /workspace === "dashboard"/);
  assert.match(page, /workspace === "build"/);
  assert.match(page, /hasActiveLibraryProject\(\) \? "dashboard" : "library"/);
  assert.match(page, /<StoryMapShell onNavigate=\{navigateWorkspace\}>[\s\S]*<StoryMapWorkspace[\s\S]*curriculum=\{plotPickleCurriculum\}[\s\S]*onNavigateGuided=\{navigateGuided\}/);
  assert.match(storyMapWorkspace, /<ProgressiveStoryMap project=\{project\} \/>/);
  assert.match(storyMapWorkspace, /<DashboardWorkspace/);
  assert.match(page, /<FoundationsBuildWorkspace/);
  assert.match(page, /<WorldBuildWorkspace/);
});

test("Guided progression derives Foundations and World from canonical LEARN PLAN and BUILD state", async () => {
  const [guided, adapter, project, buildContract] = await Promise.all([
    read("core/progression/guided-progression.ts"),
    read("core/progression/foundations-progression.ts"),
    read("core/project/project.ts"),
    read("core/contracts/build-progress.ts"),
  ]);

  assert.match(guided, /project\.learning\.completedLessonIds/);
  assert.match(guided, /buildFoundationPlanLessons\(curriculum\)/);
  assert.match(guided, /countFoundationAnswers\(foundationPlanLessons, project\.foundations\)/);
  assert.match(guided, /project\.build\.foundations\.acceptedVisualArtifactIds\.length/);
  assert.match(guided, /foundationPlanComplete \? "complete" : foundationLearnComplete \? "available" : "locked"/);
  assert.match(guided, /foundationBuildComplete \? "complete" : foundationPlanComplete \? "available" : "locked"/);
  assert.match(guided, /buildWorldPlanLessons\(curriculum\)/);
  assert.match(guided, /countWorldAnswers\(worldPlanLessons, project\.world\)/);
  assert.match(guided, /project\.build\.world\.acceptedVisualArtifactIds\.length/);
  assert.match(adapter, /deriveGuidedCreationProgression/);
  assert.match(adapter, /worldUnlocked: Boolean\(world\?\.unlocked\)/);
  assert.match(project, /readonly build: BuildProgressState/);
  assert.match(project, /readonly world: WorldPlanState/);
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
  assert.match(commands, /"world\.visual\.store"/);
  assert.match(commands, /"world\.visual\.accept"/);
  assert.match(reducer, /case "foundations\.visual\.accept"/);
  assert.match(reducer, /case "world\.visual\.accept"/);
  assert.match(reducer, /artifactExists/);
  assert.match(reducer, /case "foundations\.visual\.unaccept"/);
  assert.match(reducer, /case "world\.visual\.unaccept"/);
  assert.doesNotMatch(dashboard, /localStorage\.setItem/);
  assert.match(dashboard, /FOUNDATION_PROJECT_SAVED_EVENT/);
});

test("App Story Map host leads with 24/96 while Dashboard preserves guided support", async () => {
  const [workspace, dashboard, styles] = await Promise.all([
    read("app/story-map-workspace/index.tsx"),
    read("modules/dashboard/ui/dashboard-workspace.tsx"),
    read("modules/dashboard/ui/dashboard-workspace.module.css"),
  ]);

  assert.match(workspace, /ProgressiveStoryMap/);
  assert.match(workspace, /DashboardWorkspace/);
  assert.match(dashboard, /Your whole story is the main menu\./);
  assert.match(dashboard, /Support · Current Visual Writer state/);
  assert.match(dashboard, /deriveGuidedCreationProgression/);
  assert.match(dashboard, /deriveVisualWriterFrontierStatus/);
  assert.match(dashboard, /frontierStatus\.nextActionLabel/);
  assert.match(dashboard, /FOUNDATIONS · \{stage\.label\}/);
  assert.match(dashboard, /WORLD · Foundations \+ World/);
  assert.match(dashboard, /World LEARN/);
  assert.match(dashboard, /World PLAN/);
  assert.match(dashboard, /World BUILD/);
  assert.match(dashboard, /World remains canonically locked until Foundations is complete/);
  assert.match(dashboard, /hasQaWorkspaceAccess\(!locked\)/);
  assert.match(dashboard, /disabled=\{!accessible\}/);
  assert.match(dashboard, /onNavigate\(stage\.id\)/);
  assert.match(dashboard, /onNavigateGuided\("learn", "world"\)/);
  assert.match(dashboard, /onNavigateGuided\("plan", "world"\)/);
  assert.match(dashboard, /onNavigateGuided\("build", "world"\)/);
  assert.doesNotMatch(dashboard, /\.\.\/\.\.\/build\//);
  assert.match(styles, /grid-template-columns: repeat\(3/);
  assert.match(styles, /@media \(max-width: 820px\)/);
  assert.match(styles, /:focus-visible/);
});

test("Foundations BUILD creates real persisted visuals and requires explicit writer acceptance", async () => {
  const build = await read("modules/build/ui/foundations-build-workspace.tsx");
  assert.match(build, /deriveFoundationsProgression/);
  assert.match(build, /Finish PLAN before BUILD/);
  assert.match(build, /\/api\/local-ai\/generate\/image/);
  assert.match(build, /type: "foundations\.visual\.store"/);
  assert.match(build, /type: "foundations\.visual\.accept"/);
  assert.match(build, /type: "foundations\.visual\.unaccept"/);
  assert.match(build, /type: "foundations\.visual\.discard"/);
  assert.match(build, /generation alone does not complete BUILD/i);
  assert.match(build, /progression\.worldUnlocked \? "→ Unlocked" : "🔒 Locked"/);
  assert.match(build, /saveFoundationProject/);
});
