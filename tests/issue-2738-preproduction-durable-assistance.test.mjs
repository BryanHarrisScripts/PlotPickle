import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildDurablePreproductionAssistancePlan,
  durablePreproductionRoleAdoptions,
} from "../core/sidecars/tasks/preproduction-assistance-checkpoint.mjs";

const FIXTURES = {
  "continuity-review": { profileId: "mira-threadmere", roleId: "continuity", kind: "review" },
  "story-review": { profileId: "critics-circle", roleId: "critic", kind: "review" },
  "creative-coordination": { profileId: "quillan-reedcloak", roleId: "creative-director", kind: "proposal" },
};

function envelope(role, overrides = {}) {
  const fixture = FIXTURES[role];
  const runId = overrides.runId || `preproduction-run-${fixture?.profileId || "unsupported"}`;
  return {
    role,
    profileId: overrides.profileId || fixture?.profileId || "sage-brinewick",
    sourceIds: ["ppf:block:1", "ppf:revision:9"],
    run: {
      runId,
      kind: overrides.kind || "creative-proposal",
      profileId: overrides.runProfileId || overrides.profileId || fixture?.profileId || "sage-brinewick",
      objectiveRevision: overrides.objectiveRevision || 1,
      verificationMode: overrides.verificationMode || "writer-approval",
      context: overrides.context || {
        taskId: `task-${role}`,
        sourceIds: ["ppf:block:1", "ppf:revision:9"],
        receiptGeneratedAt: "2026-10-05T00:00:00.000Z",
      },
    },
  };
}

function plan(role, overrides = {}) {
  return buildDurablePreproductionAssistancePlan({
    envelope: overrides.envelope || envelope(role),
    humanProfileId: overrides.humanProfileId || "writer-a",
    projectId: overrides.projectId || "project-a",
    projectRevision: overrides.projectRevision || "9",
    provider: overrides.provider || "local",
    model: overrides.model || "fixture-model",
    humanApprovalRef: overrides.humanApprovalRef || "human-approval-a",
    workUnitIds: overrides.workUnitIds || ["slice-1", "slice-2"],
  });
}

test("#2738 adopts exactly the existing Continuity, Story Review and Creative Coordination assistance roles", () => {
  assert.deepEqual(durablePreproductionRoleAdoptions(), [
    { role: "continuity-review", profileId: "mira-threadmere", roleId: "continuity", stepKind: "review" },
    { role: "story-review", profileId: "critics-circle", roleId: "critic", stepKind: "review" },
    { role: "creative-coordination", profileId: "quillan-reedcloak", roleId: "creative-director", stepKind: "proposal" },
  ]);
  for (const [role, fixture] of Object.entries(FIXTURES)) {
    const value = plan(role);
    assert.equal(value.checkpoint.scope.agentProfileId, fixture.profileId);
    assert.equal(value.checkpoint.scope.roleId, fixture.roleId);
    assert.ok(value.checkpoint.steps.every((step) => step.kind === fixture.kind && step.replayPolicy === "safe"));
    assert.equal(value.checkpoint.scope.runId, envelope(role).run.runId);
    assert.equal(value.assistance.responsibilityRunId, envelope(role).run.runId);
    assert.equal(value.assistance.canonical, false);
    assert.equal(value.assistance.proposalOnly, true);
    assert.equal(value.assistance.providerRequestsIssued, false);
    assert.equal(value.assistance.modelRequestsIssued, false);
    assert.equal(value.assistance.automaticResume, false);
  }
});

test("#2738 derives one stable context receipt from the existing Responsibility Run context", () => {
  const first = plan("continuity-review");
  const repeated = plan("continuity-review");
  assert.equal(first.checkpoint.scope.contextReceipt, repeated.checkpoint.scope.contextReceipt);
  assert.match(first.checkpoint.scope.contextReceipt, /^preproduction-context:[a-f0-9]{64}$/u);

  const changedContext = plan("continuity-review", {
    envelope: envelope("continuity-review", {
      context: {
        taskId: "task-continuity-review",
        sourceIds: ["ppf:block:1", "ppf:revision:10"],
        receiptGeneratedAt: "2026-10-05T00:00:00.000Z",
      },
    }),
  });
  assert.notEqual(first.checkpoint.identity, changedContext.checkpoint.identity);
});

test("#2738 host project/profile/revision/provider/model/approval values remain identity-significant", () => {
  const first = plan("story-review");
  for (const [field, value] of [
    ["humanProfileId", "writer-b"],
    ["projectId", "project-b"],
    ["projectRevision", "10"],
    ["provider", "openai"],
    ["model", "different-model"],
    ["humanApprovalRef", "human-approval-b"],
  ]) {
    const changed = plan("story-review", { [field]: value });
    assert.notEqual(first.checkpoint.identity, changed.checkpoint.identity, `identity must include ${field}`);
  }
  const runChanged = plan("story-review", {
    envelope: envelope("story-review", { runId: "preproduction-run-critics-circle-2" }),
  });
  assert.notEqual(first.checkpoint.identity, runChanged.checkpoint.identity);
});

test("#2738 wrong profile, wrong run authority, unsupported roles and duplicate work units fail closed", () => {
  assert.throws(
    () => plan("continuity-review", { envelope: envelope("continuity-review", { profileId: "critics-circle" }) }),
    /profile does not match/u,
  );
  assert.throws(
    () => plan("creative-coordination", {
      envelope: envelope("creative-coordination", { verificationMode: "deterministic" }),
    }),
    /proposal-only writer-approval/u,
  );
  assert.throws(
    () => buildDurablePreproductionAssistancePlan({
      envelope: {
        role: "craft-guidance",
        profileId: "sage-brinewick",
        run: {
          runId: "run-sage",
          kind: "creative-proposal",
          profileId: "sage-brinewick",
          objectiveRevision: 1,
          verificationMode: "writer-approval",
          context: { taskId: "sage", sourceIds: ["lesson:1"], receiptGeneratedAt: "2026-10-05T00:00:00.000Z" },
        },
      },
      humanProfileId: "writer-a",
      projectId: "project-a",
      projectRevision: "9",
      provider: "local",
      model: "fixture",
      humanApprovalRef: "approval",
      workUnitIds: ["lesson-1"],
    }),
    /not adopted/u,
  );
  assert.throws(() => plan("creative-coordination", { workUnitIds: ["same", "same"] }), /Duplicate/u);
});

test("#2738 planning does not execute providers, mutate PPF or auto-resume", async () => {
  const source = await readFile(new URL("../core/sidecars/tasks/preproduction-assistance-checkpoint.mjs", import.meta.url), "utf8");
  for (const forbidden of [
    "@mastra",
    "askPlotPickleAgent",
    "resolveConfiguredAgentExecutionProfile",
    "fetch(",
    "writePrivateJson",
    "saveProject",
    ".resume(",
  ]) {
    assert.equal(source.includes(forbidden), false, `planning must not contain ${forbidden}`);
  }
  assert.match(source, /providerRequestsIssued: false/u);
  assert.match(source, /modelRequestsIssued: false/u);
  assert.match(source, /automaticResume: false/u);
  assert.match(source, /canonical: false/u);
});

test("#2738 existing PRE-PRODUCTION source remains the Responsibility Run owner", async () => {
  const assistance = await readFile(new URL("../lib/preproduction/assistance.ts", import.meta.url), "utf8");
  assert.match(assistance, /createResponsibilityRun/u);
  assert.match(assistance, /"continuity-review": "mira-threadmere"/u);
  assert.match(assistance, /"story-review": "critics-circle"/u);
  assert.match(assistance, /"creative-coordination": "quillan-reedcloak"/u);
});
