import assert from "node:assert/strict";
import test from "node:test";

import { defineAgentCheckpointTask } from "../core/sidecars/tasks/agent-checkpoint-task.mjs";
import { buildPhase3RoleCheckpointInput } from "../core/sidecars/tasks/phase3-role-checkpoint-plan.mjs";

const fixtures = [
  {
    profileId: "mira-threadmere",
    roleId: "continuity",
    grantedCapabilities: ["continuity-analysis", "project-context-read", "proposal-draft"],
    kind: "review",
  },
  {
    profileId: "critics-circle",
    roleId: "critic",
    grantedCapabilities: ["critique", "project-context-read", "proposal-draft"],
    kind: "review",
  },
  {
    profileId: "quillan-reedcloak",
    roleId: "creative-director",
    grantedCapabilities: ["project-context-read", "proposal-draft", "specialist-coordination"],
    kind: "proposal",
  },
];

function checkpointInput(fixture) {
  return buildPhase3RoleCheckpointInput({
    scope: {
      humanProfileId: "writer-a",
      projectId: "project-a",
      projectRevision: "rev-42",
      agentProfileId: fixture.profileId,
      roleId: fixture.roleId,
      runId: `run-${fixture.profileId}`,
      objectiveRevision: 3,
      contextReceipt: "context:phase5-closeout",
      provider: "local",
      model: "fixture/model",
      humanApprovalRef: "approval:phase5",
      grantedCapabilities: fixture.grantedCapabilities,
    },
    steps: [
      { id: "work-1", kind: fixture.kind, replayPolicy: "safe" },
      { id: "work-2", kind: fixture.kind, replayPolicy: "safe" },
    ],
  });
}

function authorization(scope, overrides = {}) {
  return { scope: { ...scope, ...(overrides.scope || {}) }, state: overrides.state || "working", budgetAvailable: overrides.budgetAvailable ?? true };
}

test("#2743 adopted Phase 3 roles reopen checkpoints, skip completed work and remain non-canonical", async () => {
  for (const fixture of fixtures) {
    const input = checkpointInput(fixture);
    const calls = [];
    const executeStep = async (_scope, step) => {
      calls.push(step.id);
      return { artifactRef: `responsibility-artifact:${fixture.profileId}:${step.id}`, privateText: "must-not-persist" };
    };
    const define = () => defineAgentCheckpointTask({
      defineTask: (value) => value,
      authorize: async (scope) => authorization(scope),
      executeStep,
    });

    const firstWorker = define();
    const task = { input, state: { checkpoint: firstWorker.initial(input) } };
    const runtime = { commit: async (transition) => { task.state = transition(); } };

    await firstWorker.phases.step(task, runtime, {});
    assert.equal(task.state.checkpoint.nextIndex, 1, fixture.profileId);
    assert.equal(task.state.checkpoint.artifacts.length, 1, fixture.profileId);

    const reopenedWorker = define();
    await reopenedWorker.phases.step(task, runtime, {});

    assert.deepEqual(calls, ["work-1", "work-2"], `${fixture.profileId} must not replay work-1`);
    assert.equal(task.state.status, "terminal");
    assert.equal(task.state.outcome.result.canonical, false);
    assert.equal(task.state.outcome.result.canApproveCanon, false);
    assert.equal(task.state.outcome.result.canMergeCode, false);
    assert.equal(JSON.stringify(task.state).includes("must-not-persist"), false);
  }
});

test("#2743 adopted Phase 3 task execution still fails closed on stale scope and budget exhaustion", async () => {
  for (const fixture of fixtures) {
    const input = checkpointInput(fixture);
    const stale = defineAgentCheckpointTask({
      defineTask: (value) => value,
      authorize: async (scope) => authorization(scope, { scope: { projectRevision: "rev-stale" } }),
      executeStep: async () => ({ artifactRef: "responsibility-artifact:must-not-run" }),
    });
    const staleTask = { input, state: { checkpoint: stale.initial(input) } };
    await assert.rejects(stale.phases.step(staleTask, { commit: async () => { throw new Error("must not commit stale work"); } }, {}), /stale|mismatched/u);

    const exhausted = defineAgentCheckpointTask({
      defineTask: (value) => value,
      authorize: async (scope) => authorization(scope, { budgetAvailable: false }),
      executeStep: async () => ({ artifactRef: "responsibility-artifact:must-not-run" }),
    });
    const exhaustedTask = { input, state: { checkpoint: exhausted.initial(input) } };
    await assert.rejects(exhausted.phases.step(exhaustedTask, { commit: async () => { throw new Error("must not commit exhausted work"); } }, {}), /budget/u);
  }
});
