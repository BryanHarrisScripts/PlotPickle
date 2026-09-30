import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import {
  appendDevelopmentLedgerEvent,
  assertDevelopmentMutationAuthorized,
  authorizeDevelopmentMerge,
  authorizeDevelopmentTask,
  bindDevelopmentWorktree,
  canMergeDevelopmentTask,
  claimDevelopmentScopes,
  createDevelopmentTask,
  developmentScopesOverlap,
  loadDevelopmentTask,
  readDevelopmentClaims,
  recordDevelopmentPrHead,
  recordExactHeadVerification,
  reconcileDevelopmentClaims,
  recoverDevelopmentTask,
  releaseDevelopmentClaims,
  saveDevelopmentClaims,
  saveDevelopmentTask,
  transitionDevelopmentTask,
} from "../lib/agents/governed-development-delivery.mjs";

function baseTask() {
  return createDevelopmentTask({
    issueNumber: 2594,
    repository: "BryanHarrisScripts/PlotPickle",
    baseSha: "base-123",
    dsddFingerprint: "dsdd-test",
    intentVersion: 3,
    intentDigest: "locked-digest-abc",
    writeScopes: ["lib/agents/**", "tests/**"],
    route: {
      logicalProviderId: "plotpickle",
      logicalModelId: "developer",
      providerId: "plotpickle-local",
      modelId: "qwen3.8-27b",
    },
  }, "2026-09-30T16:00:00Z");
}

function authorizedTask() {
  return bindDevelopmentWorktree(
    authorizeDevelopmentTask(baseTask(), {
      authority: "human",
      authorizationRef: "chat:explicit-build-approval",
    }, "2026-09-30T16:01:00Z"),
    {
      branch: "feat/2594-governed-delivery",
      worktree: "C:\\Users\\Bryan\\PlotPickle-2594",
    },
    "2026-09-30T16:02:00Z",
  );
}

test("#2594 task creation never infers source-mutation authorization", () => {
  const task = baseTask();
  assert.equal(task.state, "proposed");
  assert.equal(task.authorization, null);
  assert.throws(() => assertDevelopmentMutationAuthorized(task, "lib/agents/a.mjs"), /Human implementation authorization/u);
});

test("#2594 explicit Human authorization plus branch/worktree and write scope gates mutation", () => {
  const task = authorizedTask();
  assert.equal(task.state, "active");
  assert.equal(assertDevelopmentMutationAuthorized(task, "lib/agents/a.mjs").allowed, true);
  assert.throws(() => assertDevelopmentMutationAuthorized(task, "app/page.tsx"), /outside the task write scope/u);
  assert.match(task.worktree, /PlotPickle-2594/u);
});

test("#2594 overlapping write scopes block before concurrent mutation while reads remain outside the claim contract", () => {
  const one = authorizedTask();
  const claims = claimDevelopmentScopes([], one, ["lib/agents/**"], "2026-09-30T16:03:00Z");
  const two = bindDevelopmentWorktree(
    authorizeDevelopmentTask(createDevelopmentTask({
      issueNumber: 2600,
      repository: "BryanHarrisScripts/PlotPickle",
      baseSha: "base-123",
      writeScopes: ["lib/agents/pi/**"],
    }), { authority: "human", authorizationRef: "chat:2600" }),
    { branch: "feat/2600", worktree: "C:\\work\\2600" },
  );
  assert.equal(developmentScopesOverlap("lib/agents", "lib/agents/pi"), true);
  assert.throws(
    () => claimDevelopmentScopes(claims, two, ["lib/agents/pi/**"]),
    (error) => error.code === "PLOTPICKLE_WRITE_SCOPE_CONFLICT",
  );
});

test("#2594 stale and terminal claims reconcile safely", () => {
  const task = authorizedTask();
  const claims = claimDevelopmentScopes([], task, ["tests/**"], "2026-09-30T15:00:00Z");
  const stale = reconcileDevelopmentClaims(claims, [task], {
    now: "2026-09-30T16:00:00Z",
    staleAfterMs: 10 * 60_000,
  });
  assert.equal(stale[0].reconciliation, "stale-heartbeat");
  assert.ok(stale[0].releasedAt);

  const fresh = claimDevelopmentScopes([], task, ["tests/**"], "2026-09-30T16:00:00Z");
  const cancelled = transitionDevelopmentTask(task, "cancelled", {}, "2026-09-30T16:01:00Z");
  const reconciled = reconcileDevelopmentClaims(fresh, [cancelled], { now: "2026-09-30T16:02:00Z" });
  assert.equal(reconciled[0].reconciliation, "task-terminal");
});

test("#2594 a new PR commit invalidates prior exact-head green and merge-when-green authority", () => {
  let task = authorizedTask();
  task = transitionDevelopmentTask(task, "testing");
  task = recordDevelopmentPrHead(task, { prNumber: 2601, headSha: "head-a" });
  task = recordExactHeadVerification(task, { headSha: "head-a", status: "green", runIds: ["run-1"] });
  task = authorizeDevelopmentMerge(task, {
    authority: "human",
    policy: "merge-when-current-head-green",
    prNumber: 2601,
    headSha: "head-a",
    authorizationRef: "chat:merge-when-green",
  });
  assert.equal(task.state, "ready-to-merge");
  assert.equal(canMergeDevelopmentTask(task).allowed, true);

  task = recordDevelopmentPrHead(task, { prNumber: 2601, headSha: "head-b" });
  assert.equal(task.exactHeadVerification.status, "unverified");
  assert.equal(task.state, "verifying");
  assert.equal(task.mergeAuthorization.validForHeadSha, "");
  assert.equal(canMergeDevelopmentTask(task).allowed, false);
});

test("#2594 failure returns to repair without mutating locked DSDD intent", () => {
  let task = authorizedTask();
  task = transitionDevelopmentTask(task, "testing");
  task = recordDevelopmentPrHead(task, { prNumber: 2602, headSha: "failed-head" });
  const before = structuredClone(task.lockedIntent);
  task = recordExactHeadVerification(task, {
    headSha: "failed-head",
    status: "failed",
    evidenceRefs: ["ci:layer4"],
  });
  assert.equal(task.state, "repair");
  assert.deepEqual(task.lockedIntent, before);
  assert.equal(task.blockingReason, "exact-head-verification-failed");
});

test("#2594 restart recovery identifies the next legal action and never resumes mutation without provable Human authority", () => {
  let task = authorizedTask();
  task = transitionDevelopmentTask(task, "testing");
  task = recordDevelopmentPrHead(task, { prNumber: 2603, headSha: "head-current" });
  const recovery = recoverDevelopmentTask(task, {
    branchExists: true,
    worktreeExists: true,
    providerReady: true,
    currentPrHead: "head-current",
  });
  assert.equal(recovery.nextLegalAction, "verify-current-pr-head");

  const unauthorized = { ...task, authorization: null };
  const stopped = recoverDevelopmentTask(unauthorized, {
    branchExists: true,
    worktreeExists: true,
    providerReady: true,
    currentPrHead: "head-current",
  });
  assert.equal(stopped.mutationAllowed, false);
  assert.equal(stopped.nextLegalAction, "request-human-authorization");
});

test("#2594 task/claim persistence and append-only evidence stay outside story canon and exclude private payloads", async (t) => {
  const root = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2594-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const task = authorizedTask();
  await saveDevelopmentTask(root, task);
  assert.equal((await loadDevelopmentTask(root, task.taskId)).taskId, task.taskId);

  const claims = claimDevelopmentScopes([], task, ["tests/**"]);
  await saveDevelopmentClaims(root, claims);
  assert.equal((await readDevelopmentClaims(root))[0].taskId, task.taskId);
  await saveDevelopmentClaims(root, releaseDevelopmentClaims(claims, task.taskId));

  const event = await appendDevelopmentLedgerEvent(root, {
    taskId: task.taskId,
    type: "nested-tools",
    state: task.state,
    issueNumber: task.issue.number,
    branch: task.branch,
    logicalProviderId: "plotpickle",
    logicalModelId: "developer",
    providerId: "plotpickle-local",
    modelId: "qwen3.8-27b",
    toolIds: ["read", "plotpickle_validate"],
    evidenceRefs: ["verification:2603"],
    summary: "Bounded evidence only",
    prompt: "must-not-store",
    response: "must-not-store",
    secret: "must-not-store",
  });
  assert.equal("prompt" in event, false);
  assert.equal("response" in event, false);
  assert.equal("secret" in event, false);

  const ledger = await readFile(path.join(root, "ledger", "events.ndjson"), "utf8");
  assert.doesNotMatch(ledger, /must-not-store/u);
  assert.doesNotMatch(root.replace(/\\/gu, "/"), /story|ppf/u);
});
