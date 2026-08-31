import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1569 task ledger is durable, Guest-scoped and non-canon", async () => {
  const source = await read("build/autonomous-guest/task-ledger.ts");
  assert.match(source, /plotpickle-autonomous-guest-task-ledger/);
  assert.match(source, /"autonomous-guest", authority\.workspaceId/);
  assert.match(source, /delegated-guest-autonomous-operator/);
  assert.match(source, /humanProfileId !== ""/);
  assert.match(source, /task-ledger\.json/);
  assert.match(source, /writeFile\(temporary/);
  assert.match(source, /rename\(temporary, target\)/);
  assert.doesNotMatch(source, /authenticated-human|readCredentialJson|writeCredentialJson|privateStorage|profileCredentialsDirectory|BUZZ|ppf|canonStore|writeCanon|applyCanon/i);
});

test("#1569 task ledger has bounded explicit lifecycle states and retry budgets", async () => {
  const source = await read("build/autonomous-guest/task-ledger.ts");
  for (const state of ["pending", "eligible", "running", "completed", "blocked", "retry-wait", "cancelled", "expired", "failed"]) {
    assert.match(source, new RegExp(`"${state}"`));
  }
  assert.match(source, /MAX_TASKS = 512/);
  assert.match(source, /maxAttempts < 1 \|\| maxAttempts > 10/);
  assert.match(source, /priority < -100 \|\| priority > 100/);
  assert.match(source, /dedupeKey/);
  assert.match(source, /TERMINAL_STATES/);
});

test("#1569 tasks accept canonical PlotPickle route paths without accepting remote URLs", async () => {
  const [source, registry] = await Promise.all([
    read("build/autonomous-guest/task-ledger.ts"),
    read("config/uat-autopilot-registry.json"),
  ]);
  assert.match(source, /function safeTargetRoute/);
  assert.match(source, /normalized\.startsWith\("\/"\)/);
  assert.match(source, /normalized\.startsWith\("\/\/"\)/);
  assert.match(source, /targetRoute: safeTargetRoute/);
  assert.match(registry, /"route": "\/library"/);
  assert.match(registry, /"route": "\/\?workspace=plan&section=foundations"/);
});

test("#1569 duplicate pending work is idempotent", async () => {
  const source = await read("build/autonomous-guest/task-ledger.ts");
  assert.match(source, /tasks\.find\(\(task\) => task\.dedupeKey === dedupeKey && !TERMINAL_STATES\.has\(task\.state\)\)/);
  assert.match(source, /if \(duplicate\) return duplicate/);
});

test("#1569 abandoned running tasks recover without blind replay", async () => {
  const source = await read("build/autonomous-guest/task-ledger.ts");
  assert.match(source, /recoverAbandonedAutonomousGuestTasks/);
  assert.match(source, /task\.state !== "running"/);
  assert.match(source, /leaseExpiresAt/);
  assert.match(source, /task\.attempt >= task\.maxAttempts/);
  assert.match(source, /"retry-wait" as const/);
  assert.match(source, /"failed" as const/);
  assert.match(source, /lastFailureClass: "abandoned-process-lease"/);
  assert.doesNotMatch(source, /execute\(|applyStory|writeProject|database|localStorage/i);
});

test("#1569 persisted task evidence is references and bounded metadata, not secrets or reasoning", async () => {
  const source = await read("build/autonomous-guest/task-ledger.ts");
  assert.match(source, /providerPolicyRef/);
  assert.match(source, /resultRefs/);
  assert.match(source, /dependencyRefs/);
  assert.match(source, /baseRevision/);
  assert.doesNotMatch(source, /chain.?of.?thought|reasoningText|apiKey|password|recoverySecret|privateKey/i);
});
