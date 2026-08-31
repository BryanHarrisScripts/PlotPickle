import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1569 route tasks are derived from the existing autonomous route registry", async () => {
  const [source, registry] = await Promise.all([
    read("build/autonomous-guest/route-task-policy.ts"),
    read("config/uat-autopilot-registry.json"),
  ]);
  assert.match(source, /uat-autopilot-registry\.json/);
  assert.match(source, /routeRegistrySource\.autonomousStoryRoutes/);
  assert.match(source, /taskKind: taskKind\(route\.id\)/);
  assert.match(source, /affectsCanon: route\.operation === "operate"/);
  assert.match(source, /route\.prerequisites/);
  assert.match(registry, /"id": "story-decisions"/);
  assert.match(registry, /"id": "storyboard"/);
});

test("#1569 dynamic route inputs are bounded and materialized without remote targets", async () => {
  const source = await read("build/autonomous-guest/route-task-policy.ts");
  assert.match(source, /SAFE_ROUTE_INPUT/);
  assert.match(source, /encodeURIComponent\(value\)/);
  assert.match(source, /materialized\.replaceAll/);
  assert.match(source, /Autonomous Guest task route is missing required route inputs/);
  assert.doesNotMatch(source, /https?:\/\//i);
});

test("#1569 current run policy remains authoritative for route, revision, prerequisites and provider budget", async () => {
  const source = await read("build/autonomous-guest/route-task-policy.ts");
  assert.match(source, /resolveAutonomousGuestRouteTaskPolicy/);
  assert.match(source, /runPolicy\.allowedRouteIds\.includes\(route\.id\)/);
  assert.match(source, /currentRevision: runPolicy\.currentRevision/);
  assert.match(source, /satisfiedDependencyRefs: Object\.freeze/);
  assert.match(source, /providerPolicyRef: runPolicy\.providerPolicyRef/);
  assert.match(source, /providerAllowed: runPolicy\.providerAllowed/);
  assert.match(source, /budgetAllowed: runPolicy\.budgetAllowed/);
  assert.match(source, /runPolicy\.autonomousRunId === authority\.autonomousRunId/);
  assert.match(source, /runPolicy\.guestWorkspaceId === authority\.workspaceId/);
});

test("#1569 restart recovery handles abandoned leases but never revalidates terminal or active running work", async () => {
  const source = await read("build/autonomous-guest/restart-recovery.ts");
  assert.match(source, /recoverAbandonedAutonomousGuestTasks\(input\.authority, at\)/);
  assert.match(source, /TERMINAL_STATES\.has\(task\.state\) \|\| task\.state === "running"/);
  assert.match(source, /new Date\(task\.notBefore\)\.getTime\(\) > at\.getTime\(\)/);
  assert.match(source, /revalidateAutonomousGuestTask/);
  assert.match(source, /abandonedLeaseTaskIds/);
  assert.match(source, /activeLeaseTaskIdsPreserved/);
});

test("#1569 completed task replay is fail-closed across restart recovery", async () => {
  const source = await read("build/autonomous-guest/restart-recovery.ts");
  assert.match(source, /completedTaskIdsPreserved/);
  assert.match(source, /afterTask\.state !== "completed"/);
  assert.match(source, /afterTask\.attempt !== beforeTask\.attempt/);
  assert.match(source, /afterTask\.completedAt !== beforeTask\.completedAt/);
  assert.match(source, /Completed Autonomous Guest task changed during restart recovery/);
  assert.doesNotMatch(source, /acquireAutonomousGuestTaskLease|completeAutonomousGuestTask|executeRoute|playwright|fetch\(|applyStory|writeProject|ppf|canonStore/i);
});

test("#1569 restart recovery evidence contains bounded identifiers and states, not story or reasoning content", async () => {
  const source = await read("build/autonomous-guest/restart-recovery.ts");
  assert.match(source, /AutonomousGuestRestartRecoveryEvidence/);
  assert.match(source, /autonomousRunId/);
  assert.match(source, /guestWorkspaceId/);
  assert.match(source, /resultingStates/);
  assert.doesNotMatch(source, /storyText|chainOfThought|reasoningText|apiKey|password|privateKey|BUZZ/i);
});
