import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1569 wake runtime registers one deterministic workflow with durable schedule storage", async () => {
  const source = await read("build/autonomous-guest/mastra-wake-runtime.ts");
  assert.match(source, /createAutonomousGuestMastraScheduleStorage\(authority\)/);
  assert.match(source, /const effectiveResolvePolicy = resolvePolicy \?\? createAutonomousGuestStoredRoutePolicyResolver\(authority\)/);
  assert.match(source, /createAutonomousGuestWakeWorkflow\(effectiveResolvePolicy\)/);
  assert.match(source, /workflows: \{ \[AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID\]: wakeWorkflow \}/);
  assert.match(source, /storage,/);
  assert.match(source, /await runtime\.mastra\.startWorkers\(\)/);
  assert.doesNotMatch(source, /agents:\s*\{|new Agent\(|agent\.generate|model\.generate/i);
});

test("#1569 every schedule fire recomputes delegated Guest authority from the current loopback process", async () => {
  const source = await read("build/autonomous-guest/mastra-wake-runtime.ts");
  assert.match(source, /getAutonomousGuestAuthority\("http:\/\/127\.0\.0\.1", "desktop-loopback"\)/);
  assert.match(source, /const authority = currentAutonomousGuestAuthority\(\)/);
  assert.match(source, /assertWakeNamespace\(authority, payload\)/);
  assert.match(source, /payload\.autonomousRunId !== authority\.autonomousRunId/);
  assert.match(source, /payload\.guestWorkspaceId !== authority\.workspaceId/);
  assert.match(source, /wakeAutonomousGuestTask\(\{ authority, payload, resolvePolicy \}\)/);
});

test("#1569 wake workflow payload is reference-only and rejects extra authority material", async () => {
  const source = await read("build/autonomous-guest/mastra-wake-runtime.ts");
  assert.match(source, /required: \["taskId", "autonomousRunId", "guestWorkspaceId"\]/);
  assert.match(source, /additionalProperties: false/);
  assert.match(source, /parseWakePayload/);
  assert.doesNotMatch(source, /humanProfileId|apiKey|credential|password|privateKey|BUZZ|storyText|reasoning/i);
});

test("#1569 wake runtime cannot lease, execute routes or mutate story state", async () => {
  const source = await read("build/autonomous-guest/mastra-wake-runtime.ts");
  assert.doesNotMatch(source, /acquireAutonomousGuestTaskLease|completeAutonomousGuestTask|failAutonomousGuestTask/);
  assert.doesNotMatch(source, /executeRoute|playwright|fetch\(|applyStory|writeProject|ppf|canonStore|localStorage|writeFile/i);
});
