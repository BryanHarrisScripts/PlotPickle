import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1569 task eligibility revalidates authority, namespace, policy, revision, prerequisites and budget", async () => {
  const source = await read("build/autonomous-guest/task-lifecycle.ts");
  assert.match(source, /guestEnabled/);
  assert.match(source, /autonomousRunId !== task\.autonomousRunId/);
  assert.match(source, /guestWorkspaceId !== task\.guestWorkspaceId/);
  assert.match(source, /projectId !== task\.projectId/);
  assert.match(source, /allowListedTaskKinds\.includes\(task\.taskKind\)/);
  assert.match(source, /policy\.currentRevision !== task\.baseRevision/);
  assert.match(source, /task\.dependencyRefs\.some/);
  assert.match(source, /policy\.providerPolicyRef !== task\.providerPolicyRef/);
  assert.match(source, /!policy\.providerAllowed/);
  assert.match(source, /!policy\.budgetAllowed/);
  for (const failureClass of [
    "guest-autonomous-disabled",
    "guest-namespace-mismatch",
    "task-kind-not-allowed",
    "stale-revision",
    "prerequisite-not-ready",
    "provider-policy-changed",
    "provider-not-allowed",
    "provider-budget-blocked",
  ]) assert.match(source, new RegExp(failureClass));
});

test("#1569 not-before, expiry and cancellation remain explicit bounded task states", async () => {
  const [ledger, lifecycle] = await Promise.all([
    read("build/autonomous-guest/task-ledger.ts"),
    read("build/autonomous-guest/task-lifecycle.ts"),
  ]);
  assert.match(ledger, /expiresAt: string/);
  assert.match(ledger, /affectsCanon: boolean/);
  assert.match(lifecycle, /state: "cancelled"/);
  assert.match(lifecycle, /state: "expired"/);
  assert.match(lifecycle, /state: "pending", failureClass: "not-before"/);
  assert.match(lifecycle, /preserveRetryWait/);
});

test("#1569 one bounded running lease is required before execution can be represented", async () => {
  const source = await read("build/autonomous-guest/task-lifecycle.ts");
  assert.match(source, /MAX_LEASE_MS = 5 \* 60 \* 1000/);
  assert.match(source, /task\.state !== "eligible"/);
  assert.match(source, /task\.attempt >= task\.maxAttempts/);
  assert.match(source, /guest-lease-/);
  assert.match(source, /state: "running"/);
  assert.match(source, /attempt: task\.attempt \+ 1/);
  assert.match(source, /leaseExpiresAt/);
});

test("#1569 canon-affecting work is serialized per project", async () => {
  const source = await read("build/autonomous-guest/task-lifecycle.ts");
  assert.match(source, /if \(task\.affectsCanon\)/);
  assert.match(source, /item\.projectId === task\.projectId/);
  assert.match(source, /item\.affectsCanon/);
  assert.match(source, /item\.state === "running"/);
  assert.match(source, /new Date\(item\.leaseExpiresAt\)\.getTime\(\) > at\.getTime\(\)/);
  assert.match(source, /if \(canonBusy\) return null/);
});

test("#1569 completion and failure require the current lease and retries stay bounded", async () => {
  const source = await read("build/autonomous-guest/task-lifecycle.ts");
  assert.match(source, /completion requires its current running lease/);
  assert.match(source, /failure requires its current running lease/);
  assert.match(source, /MAX_RETRY_DELAY_MS = 60 \* 60 \* 1000/);
  assert.match(source, /input\.retryable && task\.attempt < task\.maxAttempts/);
  assert.match(source, /state: retry \? "retry-wait" : "failed"/);
  assert.match(source, /expectedLeaseId: leaseId/);
});

test("#1569 lifecycle records state only and cannot execute routes or mutate canon directly", async () => {
  const source = await read("build/autonomous-guest/task-lifecycle.ts");
  assert.match(source, /revalidateAutonomousGuestTask/);
  assert.match(source, /acquireAutonomousGuestTaskLease/);
  assert.match(source, /completeAutonomousGuestTask/);
  assert.match(source, /failAutonomousGuestTask/);
  assert.match(source, /cancelAutonomousGuestTask/);
  assert.doesNotMatch(source, /fetch\(|playwright|executeRoute|applyStory|writeProject|writeFile|database|ppf|canonStore|credential|password|BUZZ/i);
});

test("#1569 transition commits fail closed when state, attempt or lease changed", async () => {
  const source = await read("build/autonomous-guest/task-ledger.ts");
  assert.match(source, /commitAutonomousGuestTaskTransition/);
  assert.match(source, /current\.state !== input\.expectedState \|\| current\.attempt !== input\.expectedAttempt/);
  assert.match(source, /current\.leaseId !== input\.expectedLeaseId/);
  assert.match(source, /task identity cannot change during a lifecycle transition/);
});
