import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildOwnerPreservingDurableHandoff,
  ownerPreservingExecutionPolicies,
  validateOwnerPreservingProfile,
} from "../core/sidecars/tasks/owner-preserving-handoff.mjs";

const base = JSON.parse(await readFile(new URL("../config/agent-profiles.json", import.meta.url), "utf8")).profiles;
const community = JSON.parse(await readFile(new URL("../config/agent-profile-extensions/community.json", import.meta.url), "utf8")).profiles;
const profiles = [...base, ...community];

function profile(id) {
  const value = profiles.find((item) => item.id === id);
  assert.ok(value, `missing profile ${id}`);
  return value;
}

function handoff(id, overrides = {}) {
  return buildOwnerPreservingDurableHandoff({
    profile: profile(id),
    taskRef: overrides.taskRef || `task:${id}:1`,
    runRef: overrides.runRef || `run:${id}:1`,
    evidenceRefs: overrides.evidenceRefs || ["evidence:one", "evidence:two"],
    summary: overrides.summary || "Bounded handoff evidence is ready for the existing execution owner.",
    ...overrides,
  });
}

test("#2740 classifies every current non-embedded Agent Profile execution owner", () => {
  const policies = ownerPreservingExecutionPolicies();
  assert.deepEqual(Object.keys(policies).sort(), [
    "buzz-managed",
    "deterministic-gate",
    "deterministic-observer",
    "plotpickle-uat",
    "repository-handoff",
  ]);
  const external = profiles.filter((item) => item.execution.kind !== "embedded-mastra");
  assert.ok(external.length > 0);
  for (const item of external) {
    const validated = validateOwnerPreservingProfile(item);
    assert.equal(validated.profileId, item.id);
    assert.equal(validated.roleId, item.execution.roleId);
    assert.equal(validated.executionKind, item.execution.kind);
    assert.ok(policies[item.execution.kind], `missing policy for ${item.id}`);
  }
});

test("#2740 BUZZ-managed roles remain BUZZ-owned without workspace migration or private-room subscription", () => {
  for (const id of ["knot-pickle", "thread-pickle", "heart-pickle", "orin-ledgerbark", "fen-copperwind", "merrin-bellwarden"]) {
    const value = handoff(id);
    assert.equal(value.executionKind, "buzz-managed");
    assert.equal(value.owner, "buzz");
    assert.equal(value.authority.executionOwnerPreserved, true);
    assert.equal(value.authority.piExecutionGranted, false);
    assert.equal(value.authority.workspaceMigration, false);
    assert.equal(value.authority.privateRoomAutoSubscribe, false);
  }
});

test("#2740 UAT, deterministic and repository handoffs retain their existing owners", () => {
  const avery = handoff("avery-north");
  assert.equal(avery.executionKind, "plotpickle-uat");
  assert.equal(avery.owner, "plotpickle-uat");

  for (const id of ["luma-glassfern", "ben"]) {
    const value = handoff(id);
    assert.equal(value.executionKind, "deterministic-observer");
    assert.equal(value.owner, "plotpickle-deterministic-observer");
    assert.equal(value.authority.planningModelExecution, false);
  }

  const bram = handoff("bram-gatewick");
  assert.equal(bram.executionKind, "deterministic-gate");
  assert.equal(bram.owner, "plotpickle-deterministic-gate");
  assert.equal(bram.authority.planningModelExecution, false);

  const rook = handoff("rook-ironquill");
  assert.equal(rook.executionKind, "repository-handoff");
  assert.equal(rook.owner, "repository-handoff");
  assert.equal(rook.authority.repositoryAuthorityGranted, false);
  assert.equal(rook.authority.externalActionIssued, false);
});

test("#2740 handoff identity is deterministic and changes only with bounded authority references", () => {
  const first = handoff("avery-north");
  const same = handoff("avery-north");
  assert.equal(first.handoffId, same.handoffId);
  assert.match(first.handoffId, /^agent-handoff:[a-f0-9]{64}$/u);

  assert.notEqual(first.handoffId, handoff("avery-north", { taskRef: "task:avery:2" }).handoffId);
  assert.notEqual(first.handoffId, handoff("avery-north", { runRef: "run:avery:2" }).handoffId);
  assert.notEqual(first.handoffId, handoff("avery-north", { evidenceRefs: ["evidence:three"] }).handoffId);
});

test("#2740 private payloads and embedded Mastra migration fail closed", () => {
  for (const field of [
    "payload",
    "prompt",
    "context",
    "conversation",
    "messages",
    "credentials",
    "apiKey",
    "secret",
    "privateKey",
    "hiddenReasoning",
    "workspaceState",
    "privateRoom",
    "privateRoomContent",
  ]) {
    assert.throws(
      () => buildOwnerPreservingDurableHandoff({
        profile: profile("avery-north"),
        taskRef: "task:avery:1",
        runRef: "run:avery:1",
        evidenceRefs: [],
        summary: "bounded",
        [field]: "forbidden",
      }),
      /rejects private\/execution payload field/u,
      field,
    );
  }

  assert.throws(() => validateOwnerPreservingProfile(profile("mira-threadmere")), /Embedded Mastra roles/u);
});

test("#2740 returned records contain references and authority only, never a copied execution payload", () => {
  const value = handoff("rook-ironquill");
  assert.deepEqual(Object.keys(value).sort(), [
    "authority",
    "evidenceRefs",
    "executionKind",
    "handoffId",
    "owner",
    "profileId",
    "roleId",
    "runRef",
    "schemaVersion",
    "summary",
    "taskRef",
  ]);
  assert.equal(value.authority.canonical, false);
  assert.equal(value.authority.providerRequestsIssued, false);
  assert.equal(value.authority.modelRequestsIssued, false);
});

test("#2740 planning source has no Pi execution, provider call, BUZZ subscription or repository mutation path", async () => {
  const source = await readFile(new URL("../core/sidecars/tasks/owner-preserving-handoff.mjs", import.meta.url), "utf8");
  for (const forbidden of [
    "pi-durable-adapter",
    "@mastra",
    "askPlotPickleAgent",
    "fetch(",
    "subscribe(",
    "git push",
    "merge_pull_request",
    "writePrivateJson",
  ]) {
    assert.equal(source.includes(forbidden), false, `handoff planner must not contain ${forbidden}`);
  }
  assert.match(source, /piExecutionGranted: false/u);
  assert.match(source, /privateRoomAutoSubscribe/u);
  assert.match(source, /repositoryAuthorityGranted/u);
});
