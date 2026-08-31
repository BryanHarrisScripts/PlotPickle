import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1569 Mastra schedule storage is durable and Guest-scoped", async () => {
  const source = await read("build/autonomous-guest/mastra-file-schedules-storage.ts");
  assert.match(source, /extends SchedulesStorage/);
  assert.match(source, /new MastraCompositeStore/);
  assert.match(source, /domains: \{ schedules \}/);
  assert.match(source, /"autonomous-guest", authority\.workspaceId/);
  assert.match(source, /mastra-schedules\.json/);
  assert.match(source, /writeFile\(temporary/);
  assert.match(source, /rename\(temporary, target\)/);
  assert.match(source, /mode: 0o600/);
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
  const source = await read("build/autonomous-guest/mastra-file-schedules-storage.ts");
  assert.match(source, /MAX_BYTES = 2 \* 1024 \* 1024/);
  assert.match(source, /MAX_SCHEDULES = 256/);
  assert.match(source, /MAX_TRIGGERS = 2048/);
  assert.match(source, /state\.triggers\.length > MAX_TRIGGERS/);
  assert.match(source, /slice\(0, MAX_TRIGGERS\)/);
});

test("#1569 next-fire claiming uses active-state compare-and-swap semantics", async () => {
  const source = await read("build/autonomous-guest/mastra-file-schedules-storage.ts");
  assert.match(source, /updateScheduleNextFire/);
  assert.match(source, /existing\.status !== "active" \|\| existing\.nextFireAt !== expectedNextFireAt/);
  assert.match(source, /nextFireAt: newNextFireAt/);
  assert.match(source, /lastFireAt/);
  assert.match(source, /lastRunId/);
  assert.match(source, /private mutation: Promise<void> = Promise\.resolve\(\)/);
});

test("#1569 schedule persistence remains timing infrastructure, not canon authority", async () => {
  const source = await read("build/autonomous-guest/mastra-file-schedules-storage.ts");
  assert.doesNotMatch(source, /applyStory|writeProject|ppf|canonStore|database|localStorage|readCredentialJson|writeCredentialJson|privateStorage|profileCredentialsDirectory|apiKey|privateKey|password|BUZZ/i);
  assert.doesNotMatch(source, /fetch\(|playwright|executeRoute/);
});
