import assert from "node:assert/strict";
import test from "node:test";
import { assertAgentTaskAuthorization, defineAgentCheckpointTask, normalizeAgentCheckpointInput } from "../core/sidecars/tasks/agent-checkpoint-task.mjs";

const scope = () => ({ humanProfileId: "writer-a", projectId: "synthetic-project", projectRevision: "rev-1", agentProfileId: "elowen-mapweaver", roleId: "story-architect", runId: "run-a", objectiveRevision: 1, contextReceipt: "receipt-1", provider: "local", model: "fixture/model", humanApprovalRef: "approval-a", grantedCapabilities: ["proposal-draft", "project-context-read"] });
const input = () => ({ scope: scope(), steps: [{ id: "block-1", kind: "review", replayPolicy: "safe" }, { id: "block-2", kind: "review", replayPolicy: "safe" }] });
const authorized = (s) => ({ scope: s, state: "working", budgetAvailable: true });

test("#2709 task identity isolates every host scope and ordered workload", () => {
  const original = normalizeAgentCheckpointInput(input());
  for (const key of Object.keys(scope())) {
    const changed = input();
    changed.scope[key] = key === "grantedCapabilities" ? ["proposal-draft"] : key === "objectiveRevision" ? 2 : `${changed.scope[key]}-different`;
    assert.notEqual(normalizeAgentCheckpointInput(changed).identity, original.identity, key);
  }
  const reordered = input(); reordered.steps.reverse();
  assert.notEqual(normalizeAgentCheckpointInput(reordered).identity, original.identity);
  const reorderedGrants = input(); reorderedGrants.scope.grantedCapabilities.reverse();
  assert.equal(normalizeAgentCheckpointInput(reorderedGrants).identity, original.identity);
});

test("#2709 effects, duplicate steps and malformed scope fail closed", () => {
  for (const kind of ["image-generation", "external-publish", "canon-write", "game-state-write", "github-write"]) {
    const changed = input(); changed.steps[0].kind = kind;
    assert.throws(() => normalizeAgentCheckpointInput(changed), /replay-safe/);
  }
  const unsafe = input(); unsafe.steps[0].replayPolicy = "non-replayable";
  assert.throws(() => normalizeAgentCheckpointInput(unsafe), /replay-safe/);
  const duplicate = input(); duplicate.steps[1].id = "block-1";
  assert.throws(() => normalizeAgentCheckpointInput(duplicate), /Duplicate/);
  const invalid = input(); invalid.scope.projectId = "";
  assert.throws(() => normalizeAgentCheckpointInput(invalid), /Invalid/);
  assert.throws(() => normalizeAgentCheckpointInput({ ...input(), steps: Array(97).fill(input().steps[0]) }), /bounded/);
});

test("#2709 stale scope, terminal runs and exhausted budget deny resume", () => {
  assert.doesNotThrow(() => assertAgentTaskAuthorization(scope(), authorized(scope())));
  assert.throws(() => assertAgentTaskAuthorization(scope(), authorized({ ...scope(), projectRevision: "rev-2" })), /stale/);
  for (const state of ["paused", "waiting-for-writer", "completed", "failed", "cancelled"]) {
    assert.throws(() => assertAgentTaskAuthorization(scope(), { ...authorized(scope()), state }), /active/);
  }
  assert.throws(() => assertAgentTaskAuthorization(scope(), { ...authorized(scope()), budgetAvailable: false }), /budget/);
});

test("#2709 committed artifact references skip earlier steps and remain proposals", async () => {
  const calls = [];
  const definition = defineAgentCheckpointTask({ defineTask: (value) => value, authorize: async (s) => authorized(s), executeStep: async (_s, step) => { calls.push(step.id); return { artifactRef: `responsibility-artifact:${step.id}`, privateText: "never-checkpoint-this" }; } });
  const task = { input: input(), state: { checkpoint: definition.initial(input()) } };
  const runtime = { commit: async (transition) => { task.state = transition(); } };
  await definition.phases.step(task, runtime, {});
  assert.equal(task.state.checkpoint.nextIndex, 1);
  // A fresh registration simulates a different worker process at the contract layer.
  const reopened = defineAgentCheckpointTask({ defineTask: (value) => value, authorize: async (s) => authorized(s), executeStep: async (_s, step) => { calls.push(step.id); return { artifactRef: `responsibility-artifact:${step.id}` }; } });
  await reopened.phases.step(task, runtime, {});
  assert.deepEqual(calls, ["block-1", "block-2"]);
  assert.equal(task.state.status, "terminal");
  assert.equal(task.state.outcome.result.canonical, false);
  assert.equal(task.state.outcome.result.canApproveCanon, false);
  assert.equal(task.state.outcome.result.canMergeCode, false);
  assert.ok(!JSON.stringify(task.state).includes("never-checkpoint-this"));
});

test("#2709 cancellation during worker execution rejects result admission", async () => {
  let state = "working";
  let commits = 0;
  const definition = defineAgentCheckpointTask({ defineTask: (value) => value, authorize: async (s) => ({ ...authorized(s), state }), executeStep: async () => { state = "cancelled"; return { artifactRef: "responsibility-artifact:proposal" }; } });
  const task = { input: input(), state: { checkpoint: definition.initial(input()) } };
  await assert.rejects(definition.phases.step(task, { commit: async () => { commits++; } }, {}), /active/);
  assert.equal(commits, 0);
});

test("#2709 corrupt checkpoint and invalid artifact fail without resetting progress", async () => {
  let calls = 0;
  const definition = defineAgentCheckpointTask({ defineTask: (value) => value, authorize: async (s) => authorized(s), executeStep: async () => { calls++; return { artifactRef: "../../private-file" }; } });
  const task = { input: input(), state: { checkpoint: definition.initial(input()) } };
  task.state.checkpoint.artifacts.push({ stepId: "block-1", ref: "responsibility-artifact:one" });
  await assert.rejects(definition.phases.step(task, {}, {}), /integrity/);
  assert.equal(calls, 0);
  task.state.checkpoint = definition.initial(input());
  await assert.rejects(definition.phases.step(task, {}, {}), /artifact reference/);
});

test("#2709 abort becomes a terminal cancelled task without worker execution", async () => {
  const definition = defineAgentCheckpointTask({ defineTask: (value) => value, authorize: async (s) => authorized(s), executeStep: async () => { throw new Error("must not execute"); } });
  let saved;
  await definition.abort({}, { commit: async (transition) => { saved = transition(); } }, {});
  assert.deepEqual(saved, { status: "terminal", outcome: { status: "aborted" } });
});
