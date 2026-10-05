import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildPhase3RoleCheckpointInput,
  phase3DurableRoleContracts,
  validatePhase3DurableRoleProfile,
} from "../core/sidecars/tasks/phase3-role-checkpoint-plan.mjs";

const profiles = JSON.parse(await readFile(new URL("../config/agent-profiles.json", import.meta.url), "utf8")).profiles;

const fixtures = {
  "mira-threadmere": {
    roleId: "continuity",
    grantedCapabilities: ["continuity-analysis", "project-context-read", "proposal-draft"],
    kind: "review",
  },
  "critics-circle": {
    roleId: "critic",
    grantedCapabilities: ["critique", "project-context-read", "proposal-draft"],
    kind: "review",
  },
  "quillan-reedcloak": {
    roleId: "creative-director",
    grantedCapabilities: ["project-context-read", "proposal-draft", "specialist-coordination"],
    kind: "proposal",
  },
};

function scope(profileId, overrides = {}) {
  const fixture = fixtures[profileId];
  return {
    humanProfileId: "writer-a",
    projectId: "project-a",
    projectRevision: "rev-9",
    agentProfileId: profileId,
    roleId: fixture.roleId,
    runId: `run-${profileId}`,
    objectiveRevision: 1,
    contextReceipt: "context-abc",
    provider: "local",
    model: "fixture-model",
    humanApprovalRef: "approval-a",
    grantedCapabilities: fixture.grantedCapabilities,
    ...overrides,
  };
}

function steps(profileId) {
  return [
    { id: "slice-1", kind: fixtures[profileId].kind, replayPolicy: "safe" },
    { id: "slice-2", kind: fixtures[profileId].kind, replayPolicy: "safe" },
  ];
}

test("#2736 canonical Agent Profiles match the adopted Phase 3 checkpoint contracts", () => {
  const contracts = phase3DurableRoleContracts();
  assert.deepEqual(contracts.map((item) => item.profileId), [
    "mira-threadmere",
    "critics-circle",
    "quillan-reedcloak",
  ]);
  for (const contract of contracts) {
    const profile = profiles.find((item) => item.id === contract.profileId);
    assert.ok(profile, `missing canonical profile ${contract.profileId}`);
    assert.equal(validatePhase3DurableRoleProfile(profile), contract);
  }
});

test("#2736 continuity, critic and creative direction use the existing scoped checkpoint identity", () => {
  for (const profileId of Object.keys(fixtures)) {
    const first = buildPhase3RoleCheckpointInput({ scope: scope(profileId), steps: steps(profileId) });
    const repeated = buildPhase3RoleCheckpointInput({ scope: scope(profileId), steps: steps(profileId) });

    assert.equal(first.identity, repeated.identity, `${profileId} same input must retain one durable identity`);
    assert.equal(first.adoption.profileId, profileId);
    assert.equal(first.adoption.roleId, fixtures[profileId].roleId);
    assert.equal(first.adoption.canonical, false);
    assert.equal(first.adoption.providerRequestsIssued, false);
    assert.equal(first.adoption.modelRequestsIssued, false);
    assert.equal(first.adoption.automaticResume, false);

    for (const [field, value] of [
      ["humanProfileId", "writer-b"],
      ["projectId", "project-b"],
      ["projectRevision", "rev-10"],
      ["runId", `run-${profileId}-b`],
      ["contextReceipt", "context-def"],
      ["provider", "openai"],
      ["model", "different-model"],
      ["humanApprovalRef", "approval-b"],
    ]) {
      const changed = buildPhase3RoleCheckpointInput({
        scope: scope(profileId, { [field]: value }),
        steps: steps(profileId),
      });
      assert.notEqual(first.identity, changed.identity, `${profileId} identity must include ${field}`);
    }
    const changedObjective = buildPhase3RoleCheckpointInput({
      scope: scope(profileId, { objectiveRevision: 2 }),
      steps: steps(profileId),
    });
    assert.notEqual(first.identity, changedObjective.identity);
  }
});

test("#2736 wrong role, widened grants and unsafe operations fail closed", () => {
  assert.throws(
    () => buildPhase3RoleCheckpointInput({
      scope: scope("mira-threadmere", { roleId: "critic" }),
      steps: steps("mira-threadmere"),
    }),
    /role does not match/u,
  );

  assert.throws(
    () => buildPhase3RoleCheckpointInput({
      scope: scope("critics-circle", {
        grantedCapabilities: [...fixtures["critics-circle"].grantedCapabilities, "external-publish"],
      }),
      steps: steps("critics-circle"),
    }),
    /grants must exactly match/u,
  );

  assert.throws(
    () => buildPhase3RoleCheckpointInput({
      scope: scope("quillan-reedcloak"),
      steps: [{ id: "publish-1", kind: "proposal", replayPolicy: "non-replayable" }],
    }),
    /replay-safe/u,
  );

  assert.throws(
    () => buildPhase3RoleCheckpointInput({
      scope: scope("quillan-reedcloak"),
      steps: [{ id: "review-1", kind: "review", replayPolicy: "safe" }],
    }),
    /step class/u,
  );

  assert.throws(
    () => buildPhase3RoleCheckpointInput({
      scope: scope("mira-threadmere"),
      steps: [{ id: "proposal-1", kind: "proposal", replayPolicy: "safe" }],
    }),
    /step class/u,
  );
});

test("#2736 registration/validation is provider-free and cannot grant canon authority", async () => {
  const source = await readFile(new URL("../core/sidecars/tasks/phase3-role-checkpoint-plan.mjs", import.meta.url), "utf8");
  assert.match(source, /^import \{ normalizeAgentCheckpointInput \} from "\.\/agent-checkpoint-task\.mjs";/u);
  for (const forbidden of ["@mastra", "writing-assistant", "askPlotPickleAgent", "resolveConfiguredAgentExecutionProfile", "fetch("]) {
    assert.equal(source.includes(forbidden), false, `role plan must not execute through ${forbidden}`);
  }
  assert.match(source, /canonical: false/u);
  assert.match(source, /providerRequestsIssued: false/u);
  assert.match(source, /automaticResume: false/u);
});
