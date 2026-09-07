import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1728 centralizes QA workspace access without rewriting canonical progression", async () => {
  const [qaAccess, progression] = await Promise.all([
    read("core/progression/qa-access.ts"),
    read("core/progression/guided-progression.ts"),
  ]);

  assert.match(qaAccess, /enabled: true/);
  assert.match(qaAccess, /hasQaWorkspaceAccess/);
  assert.match(qaAccess, /canonicalAccess \|\| PLOTPICKLE_QA_ACCESS\.enabled/);
  assert.match(qaAccess, /isQaAccessOverride/);
  assert.doesNotMatch(progression, /qa-access|PLOTPICKLE_QA_ACCESS|hasQaWorkspaceAccess/);
  assert.match(progression, /learn: "locked" as const/);
  assert.match(progression, /plan: "locked" as const/);
  assert.match(progression, /build: "locked" as const/);
});

test("#1728 keeps canonical Dashboard states visible while progression-locked implemented destinations stay reachable", async () => {
  const dashboard = await read("modules/dashboard/ui/dashboard-workspace.tsx");

  assert.match(dashboard, /hasQaWorkspaceAccess/);
  assert.match(dashboard, /isQaAccessOverride/);
  assert.match(dashboard, /const locked = state === "locked"/);
  assert.match(dashboard, /data-state=\{state\}/);
  assert.match(dashboard, /Open \$\{stage\.label\} · QA/);
  assert.match(dashboard, /hasQaWorkspaceAccess\(world\.learn !== "locked"\)/);
  assert.match(dashboard, /hasQaWorkspaceAccess\(world\.plan !== "locked"\)/);
  assert.match(dashboard, /hasQaWorkspaceAccess\(world\.build !== "locked"\)/);
  assert.match(dashboard, /later groups remain honestly gated/);
});

test("#1728 opens World PLAN for QA while its canonical state and prior-stage evidence remain truthful", async () => {
  const worldPlan = await read("modules/plan/ui/world-plan-workspace.tsx");

  assert.match(worldPlan, /const canonicalPlanAccess = world\.plan !== "locked"/);
  assert.match(worldPlan, /const planAccessible = hasQaWorkspaceAccess\(canonicalPlanAccess\)/);
  assert.match(worldPlan, /if \(!planAccessible\)/);
  assert.match(worldPlan, /QA access:[\s\S]*World PLAN remains canonically locked/);
  assert.match(worldPlan, /World BUILD: \{world\.build === "locked" \? "Locked"/);
  assert.match(worldPlan, /hasQaWorkspaceAccess\(planComplete\)/);
  assert.match(worldPlan, /Open World BUILD · QA/);
});

test("#1728 opens Storyboard inspection but does not let QA access silently Keep an unearned canonical visual", async () => {
  const [workspace, editorial] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/storyboard/storyboard-editorial-workspace.tsx"),
  ]);

  assert.match(workspace, /hasQaWorkspaceAccess\(selectedTarget\.storyboardAllowed\)/);
  assert.match(workspace, /QA access is open; BUILD readiness remains unresolved/);
  assert.match(workspace, /data-state=\{selectedTarget\.state\}/);
  assert.match(workspace, /storyboardAccessible && selectedTarget/);
  assert.doesNotMatch(workspace, /Locked by BUILD/);

  assert.match(editorial, /hasQaWorkspaceAccess\(target\.storyboardAllowed\)/);
  assert.match(editorial, /isQaAccessOverride\(target\.storyboardAllowed\)/);
  assert.match(editorial, /if \(qaOnlyAccess\)[\s\S]*Keep remains protected/);
  assert.match(editorial, /disabled=\{selectedIsKept \|\| qaOnlyAccess\}/);
  assert.match(editorial, /Change \/ Try/);
  assert.match(editorial, /Compare/);
});

test("#1728 QA access is not imported into profile authentication or canonical Story Workbench apply authority", async () => {
  const [profileStore, workbench] = await Promise.all([
    read("core/storage/profile-private-browser.ts"),
    read("modules/story-workflow/workbench/workflow.ts"),
  ]);

  assert.doesNotMatch(profileStore, /qa-access|PLOTPICKLE_QA_ACCESS|hasQaWorkspaceAccess/);
  assert.match(profileStore, /Human profile is locked/);
  assert.doesNotMatch(workbench, /qa-access|PLOTPICKLE_QA_ACCESS|hasQaWorkspaceAccess/);
  assert.match(workbench, /editable: progression\.foundations\.plan !== "locked"/);
  assert.match(workbench, /editable: progression\.world\.unlocked && progression\.world\.plan !== "locked"/);
});
