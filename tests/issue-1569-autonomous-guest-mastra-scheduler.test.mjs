import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1569 Mastra scheduling is typed against the installed schedules API", async () => {
  const source = await read("build/autonomous-guest/mastra-task-scheduler.ts");
  assert.match(source, /import type \{ Mastra \} from "@mastra\/core\/mastra"/);
  assert.match(source, /type MastraSchedules = Mastra\["schedules"\]/);
  assert.match(source, /schedules\.create/);
  assert.match(source, /schedules\.run/);
  assert.match(source, /schedules\.pause/);
  assert.match(source, /schedules\.resume/);
  assert.match(source, /schedules\.delete/);
});

test("#1569 a schedule targets a deterministic wake workflow rather than an agent", async () => {
  const source = await read("build/autonomous-guest/mastra-task-scheduler.ts");
  assert.match(source, /AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID = "plotpickle-autonomous-guest-task-wake"/);
  assert.match(source, /workflowId: AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID/);
  assert.match(source, /inputData: autonomousGuestTaskWakePayload\(task\)/);
  assert.doesNotMatch(source, /agentId|prompt|generate\(|stream\(|model:/i);
});

test("#1569 schedule payload carries references only and cannot impersonate a Human", async () => {
  const source = await read("build/autonomous-guest/mastra-task-scheduler.ts");
  assert.match(source, /taskId: task\.taskId/);
  assert.match(source, /autonomousRunId: task\.autonomousRunId/);
  assert.match(source, /guestWorkspaceId: task\.guestWorkspaceId/);
  assert.match(source, /humanProfileId !== ""/);
  assert.doesNotMatch(source, /apiKey|password|credential|privateKey|recoverySecret|storyText|screenplay|BUZZ/i);
});

test("#1569 schedule fire only revalidates PlotPickle policy and never grants a lease", async () => {
  const source = await read("build/autonomous-guest/mastra-task-scheduler.ts");
  assert.match(source, /wakeAutonomousGuestTask/);
  assert.match(source, /resolvePolicy\(task\)/);
  assert.match(source, /revalidateAutonomousGuestTask/);
  assert.match(source, /eligible: revalidated\.state === "eligible"/);
  assert.doesNotMatch(source, /acquireAutonomousGuestTaskLease|completeAutonomousGuestTask|failAutonomousGuestTask|executeRoute|operateAutonomous|playwright|fetch\(/);
});

test("#1569 schedule operations remain Guest namespace scoped", async () => {
  const source = await read("build/autonomous-guest/mastra-task-scheduler.ts");
  assert.match(source, /task\.autonomousRunId !== authority\.autonomousRunId/);
  assert.match(source, /task\.guestWorkspaceId !== authority\.workspaceId/);
  assert.match(source, /payload\.autonomousRunId !== task\.autonomousRunId/);
  assert.match(source, /payload\.guestWorkspaceId !== task\.guestWorkspaceId/);
  assert.match(source, /plotpickle-guest-wake-/);
});

test("#1569 scheduler cannot mutate story canon or persistence directly", async () => {
  const source = await read("build/autonomous-guest/mastra-task-scheduler.ts");
  assert.doesNotMatch(source, /writeFile|rename\(|database|ppf|canonStore|writeCanon|applyCanon|applyStory|writeProject/i);
  assert.match(source, /cancelAutonomousGuestTask/);
  assert.match(source, /revalidateAutonomousGuestTask/);
});
