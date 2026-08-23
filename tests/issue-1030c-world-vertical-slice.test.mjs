import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1030C derives World PLAN from the real World curriculum", async () => {
  const contract = await read("core/contracts/world-plan/index.ts");
  assert.match(contract, /lesson\.topic === "world"/);
  assert.match(contract, /applicationPrompts\(lesson\)/);
  assert.match(contract, /worldDecisionKey/);
  assert.match(contract, /Foundations \+ World/);
  assert.doesNotMatch(contract, /character-plan|theme-plan|structure-plan/i);
});

test("#1030C stores World decisions and visual history beside Foundations without replacing it", async () => {
  const [project, commands, build] = await Promise.all([
    read("core/project/project.ts"),
    read("core/project/apply-command.ts"),
    read("core/contracts/build-progress.ts"),
  ]);
  assert.match(project, /readonly world: WorldPlanState/);
  assert.match(project, /world: normalizeWorld\(source\.world\)/);
  assert.match(project, /retainedFoundationArtifactIds/);
  assert.match(commands, /case "world\.answer\.update"/);
  assert.match(commands, /case "world\.visual\.store"/);
  assert.match(commands, /case "world\.visual\.accept"/);
  assert.match(build, /readonly world:/);
  assert.match(build, /curriculumFrontier: "Foundations \+ World"/);
  assert.match(build, /WorldArtifactChangeKind = "added" \| "revised" \| "retained" \| "superseded"/);
});

test("#1030C activates World in the canonical progression and leaves Character gated behind approval", async () => {
  const progression = await read("core/progression/guided-progression.ts");
  assert.match(progression, /buildWorldPlanLessons/);
  assert.match(progression, /countWorldAnswers/);
  assert.match(progression, /implemented: true,[\s\S]*complete: worldBuildComplete/);
  assert.match(progression, /unlocked: foundations\.complete/);
  assert.match(progression, /const unlocked = index === 0 && world\.complete/);
  assert.match(progression, /Continue World LEARN/);
  assert.match(progression, /Continue World PLAN/);
  assert.match(progression, /Continue World BUILD/);
  assert.match(progression, /World complete — Character is next/);
});

test("#1030C World wireframe is additive, revision-aware and bounded to Foundations plus World", async () => {
  const wireframe = await read("modules/build/wireframe/world-wireframe.ts");
  assert.match(wireframe, /WORLD_WIREFRAME_FRONTIER = "Foundations \+ World"/);
  assert.match(wireframe, /acceptedWorldDecisions/);
  assert.match(wireframe, /latestAcceptedFoundationFrames/);
  assert.match(wireframe, /affectedFoundationFrame/);
  assert.match(wireframe, /changeKind = parent \? "revised" as const : "added" as const/);
  assert.match(wireframe, /retainedFoundationArtifactIds/);
  assert.match(wireframe, /parentArtifactId: parent\?\.id \?\? null/);
  assert.match(wireframe, /Do not invent Character, Theme, Structure, Drafting, Dialogue, or later-group facts/);
  assert.doesNotMatch(wireframe, /\/api\/comfy|127\.0\.0\.1:8188/);
});

test("#1030C exposes real World PLAN and BUILD workspaces through the existing app shell", async () => {
  const [page, plan, build, dashboard] = await Promise.all([
    read("app/page.tsx"),
    read("modules/plan/ui/world-plan-workspace.tsx"),
    read("modules/build/ui/world-build-workspace.tsx"),
    read("modules/dashboard/ui/dashboard-workspace.tsx"),
  ]);
  assert.match(page, /requestedSection/);
  assert.match(page, /section === "world"/);
  assert.match(page, /WorldPlanWorkspace/);
  assert.match(page, /WorldBuildWorkspace/);
  assert.match(plan, /World PLAN is still locked/);
  assert.match(plan, /Foundations was not changed/);
  assert.match(build, /Foundations \+ World/);
  assert.match(build, /retainedFoundationFrames/);
  assert.match(build, /\/api\/local-ai\/generate\/image/);
  assert.match(build, /billingAcknowledged/);
  assert.match(dashboard, /Second implemented curriculum group/);
  assert.match(dashboard, /World LEARN/);
  assert.match(dashboard, /World PLAN/);
  assert.match(dashboard, /World BUILD/);
});
