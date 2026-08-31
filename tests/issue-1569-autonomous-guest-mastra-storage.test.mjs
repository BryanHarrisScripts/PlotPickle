import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1569 Mastra schedule storage is durable and Guest-scoped", async () => {
  const [adapter, fileState] = await Promise.all([
    read("build/autonomous-guest/mastra-file-schedules-storage.ts"),
    read("build/autonomous-guest/storage/schedule-file-state.ts"),
  ]);
  assert.match(adapter, /extends SchedulesStorage/);
  assert.match(adapter, /new MastraCompositeStore/);
  assert.match(adapter, /domains: \{ schedules \}/);
  assert.match(adapter, /readAutonomousGuestScheduleFileState/);
  assert.match(adapter, /mutateAutonomousGuestScheduleFileState/);
  assert.match(fileState, /"autonomous-guest", authority\.workspaceId/);
  assert.match(fileState, /mastra-schedules\.json/);
  assert.match(fileState, /writeFile\(temporary/);
  assert.match(fileState, /rename\(temporary, target\)/);
  assert.match(fileState, /mode: 0o600/);
});

test("#1569 schedule storage accepts only the PlotPickle wake workflow", async () => {
  const source = await read("build/autonomous-guest/mastra-file-schedules-storage.ts");
  assert.match(source, /target\.type !== "workflow"/);
  assert.match(source, /target\.workflowId !== AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID/);
  assert.match(source, /payload\.autonomousRunId !== authority\.autonomousRunId/);
  assert.match(source, /payload\.guestWorkspaceId !== authority\.workspaceId/);
  assert.match(source, /plotpickle-guest-wake-/);
  assert.doesNotMatch(source, /agent\.generate|model\.generate|authenticated-human|humanProfileId:\s*[^"\s]/i);
});

test("#1569 schedule and trigger persistence is explicitly bounded", async () => {
  const [adapter, fileState] = await Promise.all([
    read("build/autonomous-guest/mastra-file-schedules-storage.ts"),
    read("build/autonomous-guest/storage/schedule-file-state.ts"),
  ]);
  assert.match(fileState, /MAX_BYTES = 2 \* 1024 \* 1024/);
  assert.match(fileState, /MAX_AUTONOMOUS_GUEST_SCHEDULES = 256/);
  assert.match(fileState, /MAX_AUTONOMOUS_GUEST_SCHEDULE_TRIGGERS = 2048/);
  assert.match(adapter, /state\.triggers\.length > MAX_AUTONOMOUS_GUEST_SCHEDULE_TRIGGERS/);
  assert.match(adapter, /slice\(0, MAX_AUTONOMOUS_GUEST_SCHEDULE_TRIGGERS\)/);
});

test("#1569 next-fire claiming uses active-state compare-and-swap semantics", async () => {
  const [adapter, fileState] = await Promise.all([
    read("build/autonomous-guest/mastra-file-schedules-storage.ts"),
    read("build/autonomous-guest/storage/schedule-file-state.ts"),
  ]);
  assert.match(adapter, /updateScheduleNextFire/);
  assert.match(adapter, /existing\.status !== "active" \|\| existing\.nextFireAt !== expectedNextFireAt/);
  assert.match(adapter, /nextFireAt: newNextFireAt/);
  assert.match(adapter, /lastFireAt/);
  assert.match(adapter, /lastRunId/);
  assert.match(fileState, /const mutations = new Map<string, Promise<void>>\(\)/);
  assert.match(fileState, /const prior = mutations\.get\(key\) \?\? Promise\.resolve\(\)/);
});

test("#1569 schedule persistence remains timing infrastructure, not canon authority", async () => {
  const source = `${await read("build/autonomous-guest/mastra-file-schedules-storage.ts")}\n${await read("build/autonomous-guest/storage/schedule-file-state.ts")}`;
  assert.doesNotMatch(source, /applyStory|writeProject|ppf|canonStore|database|localStorage|readCredentialJson|writeCredentialJson|privateStorage|profileCredentialsDirectory|apiKey|privateKey|password|BUZZ/i);
  assert.doesNotMatch(source, /fetch\(|playwright|executeRoute/);
});
