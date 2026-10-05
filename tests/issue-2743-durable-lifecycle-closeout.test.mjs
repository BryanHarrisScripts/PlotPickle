import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DURABLE_RUN_PRESENTATION_STATES,
  DURABLE_TASK_MAINTENANCE_POLICY,
  durableRunIsTerminal,
  projectDurableRunLifecycle,
} from "../lib/agents/responsibility/durable-run-lifecycle.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const run = (state, stopReason = "") => ({ state, stopReason });

test("#2743 durable lifecycle projects active work versus process-restart interruption without granting resume", () => {
  assert.deepEqual(DURABLE_RUN_PRESENTATION_STATES, [
    "active",
    "paused",
    "interrupted",
    "waiting-for-writer",
    "stale",
    "unavailable",
    "completed",
    "failed",
    "cancelled",
  ]);
  const active = projectDurableRunLifecycle(run("working"), { sessionOwned: true });
  assert.equal(active.state, "active");
  assert.equal(active.resumableHere, false);

  const reopened = projectDurableRunLifecycle(run("working"), { sessionOwned: false });
  assert.equal(reopened.state, "interrupted");
  assert.equal(reopened.resumableHere, false);
  assert.match(reopened.detail, /No Agent was resumed automatically/u);
  assert.match(reopened.nextAction, /owning workflow/u);
});

test("#2743 paused, writer-gated, stale, unavailable and terminal states remain distinct", () => {
  const paused = projectDurableRunLifecycle(run("paused"));
  assert.equal(paused.state, "paused");
  assert.equal(paused.resumableHere, true);

  assert.equal(projectDurableRunLifecycle(run("waiting-for-writer")).state, "waiting-for-writer");
  assert.equal(projectDurableRunLifecycle(run("failed", "Project revision is stale or mismatched.")).state, "stale");
  assert.equal(projectDurableRunLifecycle(run("failed", "Required provider runtime is unavailable.")).state, "unavailable");
  assert.equal(projectDurableRunLifecycle(run("failed", "Authoritative validation failed.")).state, "failed");
  assert.equal(projectDurableRunLifecycle(run("completed")).state, "completed");
  assert.equal(projectDurableRunLifecycle(run("cancelled")).state, "cancelled");
  assert.equal(durableRunIsTerminal(run("completed")), true);
  assert.equal(durableRunIsTerminal(run("cancelled")), true);
  assert.equal(durableRunIsTerminal(run("paused")), false);
});

test("#2743 upgrade/reset/delete policy preserves durable evidence and requires explicit Human maintenance", () => {
  assert.equal(DURABLE_TASK_MAINTENANCE_POLICY.upgrade, "preserve");
  assert.equal(DURABLE_TASK_MAINTENANCE_POLICY.startupInference, false);
  assert.equal(DURABLE_TASK_MAINTENANCE_POLICY.startupReset, false);
  assert.equal(DURABLE_TASK_MAINTENANCE_POLICY.automaticDelete, false);
  assert.equal(DURABLE_TASK_MAINTENANCE_POLICY.resetRequiresHuman, true);
  assert.equal(DURABLE_TASK_MAINTENANCE_POLICY.resetRequiresStoppedTask, true);
  assert.equal(DURABLE_TASK_MAINTENANCE_POLICY.deleteRequiresHuman, true);
  assert.equal(DURABLE_TASK_MAINTENANCE_POLICY.deleteAvailableInRunActivity, false);
  assert.equal(DURABLE_TASK_MAINTENANCE_POLICY.terminalRestartAllowed, false);
});

test("#2743 Responsibility Run GET only projects persisted state and never auto-starts work", async () => {
  const gateway = await read("build/responsibility-run-gateway.ts");
  assert.match(gateway, /const sessionOwnedRuns = new Set<string>\(\)/u);
  assert.match(gateway, /projectDurableRunLifecycle\(run, \{ sessionOwned: sessionOwnedRuns\.has\(run\.runId\) \}\)/u);
  const getBlock = gateway.match(/if \(request\.method === "GET"\) \{[\s\S]*?\n\s*\}\n\s*if \(request\.method === "POST"\)/u)?.[0] || "";
  assert.ok(getBlock, "GET block must remain visible to the regression");
  assert.doesNotMatch(getBlock, /mutate\(|sessionOwnedRuns\.add|beginResponsibilityAttempt|resumeResponsibilityRun/u);
  assert.match(getBlock, /presentRun\(run\)/u);
  assert.match(getBlock, /runs\.map\(presentRun\)/u);
});

test("#2743 Settings Agents exposes Human-facing lifecycle without a destructive generic Delete action", async () => {
  const [activity, agents, gateway] = await Promise.all([
    read("app/responsibility-run-activity.tsx"),
    read("app/skin-v1/plotpickle-agents-host.tsx"),
    read("build/responsibility-run-gateway.ts"),
  ]);
  assert.match(agents, /import ResponsibilityRunActivity/u);
  assert.match(agents, /<ResponsibilityRunActivity \/>/u);
  assert.match(activity, /Reopening PlotPickle never runs or resumes an Agent automatically/u);
  assert.match(activity, /data-durable-state=\{durableState\}/u);
  for (const state of ["interrupted", "stale", "unavailable"]) assert.match(activity, new RegExp(`"${state}"`, "u"));
  assert.match(activity, /run\.state === "paused"[\s\S]*?>Resume<\/button>/u);
  assert.match(activity, /interrupted \|\| run\.state === "waiting-for-writer"/u);
  assert.doesNotMatch(activity, />Delete</u);
  assert.doesNotMatch(gateway, /action === "delete"/u);
});

test("#2743 closeout brief records bounded adoption and does not claim all-Agent or real-provider proof", async () => {
  const brief = await read("docs/developer-briefs/2743-durable-lifecycle-closeout.md");
  assert.match(brief, /PROVEN-APPLICATION/u);
  assert.match(brief, /PROVEN-CHECKPOINT/u);
  assert.match(brief, /NOT-ADOPTED/u);
  assert.match(brief, /No all-Agent rollout is claimed/u);
  assert.match(brief, /not a claim of real user-selected provider\/hardware inference/u);
  assert.match(brief, /there is deliberately no generic Delete control/u);
});
