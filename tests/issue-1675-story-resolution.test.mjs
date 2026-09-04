import assert from "node:assert/strict";
import test from "node:test";

import "./issue-1675-story-rules.test.mjs";
import {
  reduceStoryAction,
  validateStoryActionForRuntime,
} from "../modules/story-the-unwritten/actions.mjs";
import {
  createStoryMechanicalState,
  normalizeStoryResolutionLimits,
  resolveStoryEventBatch,
  verifyStoryResolutionReplay,
} from "../modules/story-the-unwritten/resolution.mjs";
import {
  STORY_FIVE_SCENE_COUNT,
  createFiveSceneStoryRuntime,
  transitionFiveSceneStoryRuntime,
} from "../modules/story-the-unwritten/session-machine.mjs";

function event(id, priority, enqueueOrder, operation, overrides = {}) {
  return {
    id,
    idempotencyKey: `idempotency:${id}`,
    cycleKey: `cycle:${id}`,
    ancestryKeys: [],
    priority,
    enqueueOrder,
    triggerDepth: 0,
    operation,
    ...overrides,
  };
}

function fiveSceneRuntime() {
  return createFiveSceneStoryRuntime({
    sessionId: "session:five-scene-proof",
    gameDefinitionId: "game:unwritten-proof",
    worldId: "world:unwritten",
    worldRevisionRef: "world:unwritten@1",
    ppfProjectRef: "ppf:unwritten",
    resolutionLimits: { maximumOperationsPerScene: 12 },
    sceneDefinitions: Array.from({ length: STORY_FIVE_SCENE_COUNT }, (_, index) => ({
      id: `scene:${index + 1}`,
      locationId: `location:${index + 1}`,
      objectiveRefs: [`objective:${index + 1}`],
      narrativeBudget: 4,
    })),
  });
}

function activeFiveSceneRuntime() {
  return transitionFiveSceneStoryRuntime(fiveSceneRuntime(), "start-session").runtime;
}

function storyAction(id = "action:one", overrides = {}) {
  return {
    id,
    sessionId: "session:five-scene-proof",
    sceneId: "scene:1",
    actorRef: "player:creator",
    pieceId: null,
    operation: { kind: "adjust-number", ref: "pressure:scene", delta: 1 },
    idempotencyKey: `idempotency:${id}`,
    proposedAt: "2026-09-04T01:00:00.000Z",
    ...overrides,
  };
}

test("#1675 normalizes finite deterministic resolution limits", () => {
  assert.deepEqual(normalizeStoryResolutionLimits({
    maximumTriggerDepth: 4,
    maximumOperationsPerScene: 12,
    maximumAgentCallsPerTurn: 2,
  }), {
    maximumTriggerDepth: 4,
    maximumOperationsPerScene: 12,
    maximumAgentCallsPerTurn: 2,
  });
  assert.deepEqual(normalizeStoryResolutionLimits({ maximumTriggerDepth: Infinity }), {
    maximumTriggerDepth: 8,
    maximumOperationsPerScene: 64,
    maximumAgentCallsPerTurn: 1,
  });
});

test("#1675 resolves by stable priority and enqueue order rather than input or model order", () => {
  const initial = createStoryMechanicalState({ values: { "pressure:scene": 0 } });
  const events = [
    event("later", 20, 1, { kind: "set-value", ref: "result", value: "later" }),
    event("first", 10, 4, { kind: "adjust-number", ref: "pressure:scene", delta: 2 }),
    event("second", 20, 0, { kind: "set-value", ref: "result", value: "second" }),
  ];
  const forward = resolveStoryEventBatch({ state: initial, events });
  const reverse = resolveStoryEventBatch({ state: initial, events: [...events].reverse() });
  assert.equal(forward.ok, true);
  assert.deepEqual(forward.acceptedEvents.map((item) => item.id), ["first", "second", "later"]);
  assert.deepEqual(reverse.state, forward.state);
  assert.equal(reverse.checkpoint.stateHash, forward.checkpoint.stateHash);
  assert.equal(forward.state.values.result, "later");
});

test("#1675 duplicate idempotency keys cannot apply an effect twice", () => {
  const initial = createStoryMechanicalState({ values: { coins: 1 } });
  const duplicate = event("duplicate", 1, 1, { kind: "adjust-number", ref: "coins", delta: 10 }, {
    idempotencyKey: "already-processed",
  });
  const result = resolveStoryEventBatch({
    state: initial,
    events: [duplicate],
    processedIdempotencyKeys: ["already-processed"],
  });
  assert.equal(result.ok, true);
  assert.equal(result.state.values.coins, 1);
  assert.equal(result.state.revision, 0);
  assert.deepEqual(result.skippedDuplicateEventIds, ["duplicate"]);
});

test("#1675 operation-budget failure is atomic and commits no partial state", () => {
  const initial = createStoryMechanicalState({ values: { tension: 0 } });
  const result = resolveStoryEventBatch({
    state: initial,
    limits: { maximumOperationsPerScene: 1 },
    events: [
      event("one", 1, 0, { kind: "adjust-number", ref: "tension", delta: 1 }),
      event("two", 1, 1, { kind: "adjust-number", ref: "tension", delta: 1 }),
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.failure.code, "operation-budget-exceeded");
  assert.equal(result.state, initial);
  assert.equal(initial.values.tension, 0);
  assert.equal(result.checkpoint, null);
});

test("#1675 trigger-depth and ancestry cycle failures are deterministic and atomic", () => {
  const initial = createStoryMechanicalState();
  const tooDeep = event("deep", 1, 0, { kind: "open-thread", threadRef: "thread:deep" }, { triggerDepth: 9 });
  const cycle = event("cycle", 1, 0, { kind: "open-thread", threadRef: "thread:cycle" }, {
    cycleKey: "rule:memory-loop",
    ancestryKeys: ["rule:memory-loop"],
  });
  for (const [candidate, message] of [[tooDeep, /trigger depth/], [cycle, /cycle detected/]]) {
    const result = resolveStoryEventBatch({ state: initial, events: [candidate] });
    assert.equal(result.ok, false);
    assert.equal(result.state, initial);
    assert.match(result.failure.message, message);
  }
});

test("#1675 one invalid operation rolls back the entire accepted batch", () => {
  const initial = createStoryMechanicalState({ values: { score: 3 } });
  const result = resolveStoryEventBatch({
    state: initial,
    events: [
      event("valid", 1, 0, { kind: "adjust-number", ref: "score", delta: 4 }),
      event("invalid", 2, 1, { kind: "execute-javascript", source: "score = 999" }),
    ],
  });
  assert.equal(result.ok, false);
  assert.equal(result.failure.code, "operation-rejected");
  assert.equal(initial.values.score, 3);
  assert.equal(result.state, initial);
  assert.deepEqual(result.acceptedEvents, []);
});

test("#1675 malformed persisted state fails explicitly rather than partially mutating", () => {
  const malformed = { revision: 4, knowledgeByCharacter: { "character:elara": null } };
  const result = resolveStoryEventBatch({
    state: malformed,
    events: [event("knowledge", 1, 0, {
      kind: "grant-knowledge",
      characterId: "character:elara",
      knowledgeRef: "knowledge:road",
    })],
  });
  assert.equal(result.ok, false);
  assert.equal(result.failure.code, "invalid-state");
  assert.equal(result.state, malformed);
});

test("#1675 checkpoints make accepted history replayable and tamper-evident", () => {
  const initial = createStoryMechanicalState({
    revision: 7,
    knowledgeByCharacter: { "character:elara": ["knowledge:old-road"] },
    openThreads: ["thread:lost-map"],
  });
  const events = [
    event("forget-road", 1, 0, {
      kind: "revoke-knowledge",
      characterId: "character:elara",
      knowledgeRef: "knowledge:old-road",
    }),
    event("resolve-map", 2, 1, { kind: "resolve-thread", threadRef: "thread:lost-map" }),
  ];
  const first = resolveStoryEventBatch({ state: initial, events });
  const replay = resolveStoryEventBatch({ state: initial, events });
  assert.equal(first.state.revision, 9);
  assert.equal(verifyStoryResolutionReplay(first.checkpoint, replay), true);
  assert.equal(verifyStoryResolutionReplay({ ...first.checkpoint, stateHash: "tampered" }, replay), false);
});

test("#1675 Phase 1 creates exactly five ordered scenes without starting play implicitly", () => {
  const runtime = fiveSceneRuntime();
  assert.equal(runtime.session.status, "ready");
  assert.equal(runtime.session.currentSceneId, null);
  assert.equal(runtime.session.sceneIds.length, 5);
  assert.deepEqual(runtime.scenes.map((scene) => scene.ordinal), [1, 2, 3, 4, 5]);
  assert.deepEqual(runtime.scenes.map((scene) => scene.status), ["ready", "ready", "ready", "ready", "ready"]);
  assert.equal(runtime.session.resolutionQueue.limits.maximumOperationsPerScene, 12);
  assert.equal(runtime.session.canonAdmissionRef, null);
});

test("#1675 Phase 1 rejects missing, extra or duplicate scenes before a session can exist", () => {
  const base = {
    sessionId: "session:invalid",
    gameDefinitionId: "game:invalid",
    worldId: "world:invalid",
    worldRevisionRef: "world:invalid@1",
    ppfProjectRef: "ppf:invalid",
  };
  assert.throws(() => createFiveSceneStoryRuntime({ ...base, sceneDefinitions: [] }), /exactly 5/);
  assert.throws(() => createFiveSceneStoryRuntime({
    ...base,
    sceneDefinitions: Array.from({ length: 6 }, (_, index) => ({ id: `scene:${index}`, locationId: "location:a" })),
  }), /exactly 5/);
  assert.throws(() => createFiveSceneStoryRuntime({
    ...base,
    sceneDefinitions: Array.from({ length: 5 }, () => ({ id: "scene:duplicate", locationId: "location:a" })),
  }), /duplicate scene id/);
});

test("#1675 Phase 1 advances one scene at a time and completes only after scene five resolves", () => {
  const initial = fiveSceneRuntime();
  let result = transitionFiveSceneStoryRuntime(initial, "start-session");
  assert.equal(result.ok, true);
  let runtime = result.runtime;
  assert.equal(runtime.session.currentSceneId, "scene:1");
  assert.equal(runtime.scenes[0].status, "active");
  assert.equal(initial.session.status, "ready");

  for (let index = 0; index < STORY_FIVE_SCENE_COUNT; index += 1) {
    assert.equal(runtime.session.currentSceneId, `scene:${index + 1}`);
    result = transitionFiveSceneStoryRuntime(runtime, "begin-scene-resolution");
    assert.equal(result.ok, true);
    runtime = result.runtime;
    assert.equal(runtime.scenes[index].status, "resolving");

    if (index === 0) {
      result = transitionFiveSceneStoryRuntime(runtime, "resume-scene");
      assert.equal(result.ok, true);
      runtime = result.runtime;
      assert.equal(runtime.scenes[index].status, "active");
      result = transitionFiveSceneStoryRuntime(runtime, "begin-scene-resolution");
      assert.equal(result.ok, true);
      runtime = result.runtime;
    }

    result = transitionFiveSceneStoryRuntime(runtime, "complete-scene");
    assert.equal(result.ok, true);
    runtime = result.runtime;
  }

  assert.equal(runtime.session.status, "completed");
  assert.equal(runtime.session.currentSceneId, null);
  assert.deepEqual(runtime.scenes.map((scene) => scene.status), ["resolved", "resolved", "resolved", "resolved", "resolved"]);
});

test("#1675 Phase 1 rejects scene skipping and leaves the prior runtime untouched", () => {
  const ready = fiveSceneRuntime();
  const premature = transitionFiveSceneStoryRuntime(ready, "complete-scene");
  assert.equal(premature.ok, false);
  assert.equal(premature.runtime, ready);

  const started = transitionFiveSceneStoryRuntime(ready, "start-session").runtime;
  const skipped = transitionFiveSceneStoryRuntime(started, "complete-scene");
  assert.equal(skipped.ok, false);
  assert.equal(skipped.runtime, started);
  assert.equal(started.scenes[0].status, "active");
  assert.equal(started.scenes[1].status, "ready");
});

test("#1675 Phase 1 scene failure terminates the session and cannot advance into a later scene", () => {
  const started = transitionFiveSceneStoryRuntime(fiveSceneRuntime(), "start-session").runtime;
  const failed = transitionFiveSceneStoryRuntime(started, "fail-scene");
  assert.equal(failed.ok, true);
  assert.equal(failed.runtime.session.status, "failed");
  assert.equal(failed.runtime.scenes[0].status, "failed");
  assert.equal(failed.runtime.scenes[1].status, "ready");

  const afterFailure = transitionFiveSceneStoryRuntime(failed.runtime, "begin-scene-resolution");
  assert.equal(afterFailure.ok, false);
  assert.equal(afterFailure.runtime, failed.runtime);
});

test("#1675 Phase 1 validates actions against the active session, scene and authoritative revision", () => {
  const runtime = activeFiveSceneRuntime();
  const state = createStoryMechanicalState({ values: { "pressure:scene": 0 } });
  assert.deepEqual(validateStoryActionForRuntime({ runtime, state, action: storyAction() }), {
    ok: true,
    code: "legal",
    message: "action is structurally legal",
  });

  assert.equal(validateStoryActionForRuntime({
    runtime,
    state,
    action: storyAction("action:wrong-session", { sessionId: "session:other" }),
  }).code, "wrong-session");
  assert.equal(validateStoryActionForRuntime({
    runtime,
    state,
    action: storyAction("action:wrong-scene", { sceneId: "scene:2" }),
  }).code, "wrong-scene");
  assert.equal(validateStoryActionForRuntime({
    runtime,
    state: createStoryMechanicalState({ revision: 1 }),
    action: storyAction("action:stale"),
  }).code, "stale-state");
});

test("#1675 Phase 1 accepts one legal action through the deterministic reducer and synchronizes revisions", () => {
  const runtime = activeFiveSceneRuntime();
  const state = createStoryMechanicalState({ values: { "pressure:scene": 0 } });
  const result = reduceStoryAction({ runtime, state, action: storyAction() });

  assert.equal(result.ok, true);
  assert.equal(result.status, "accepted");
  assert.equal(result.state.values["pressure:scene"], 1);
  assert.equal(result.state.revision, 1);
  assert.equal(result.runtime.session.stateRevision, 1);
  assert.equal(result.runtime.scenes[0].operationsUsed, 1);
  assert.equal(result.runtime.session.resolutionQueue.nextSequence, 2);
  assert.deepEqual(result.runtime.session.resolutionQueue.processedIdempotencyKeys, ["idempotency:action:one"]);
  assert.equal(result.acceptedEvent.actionId, "action:one");
  assert.equal(result.acceptedEvent.ruleId, null);
  assert.equal(runtime.session.stateRevision, 0);
  assert.equal(state.values["pressure:scene"], 0);
});

test("#1675 Phase 1 duplicate accepted actions are idempotent and do not spend the scene budget twice", () => {
  const initialRuntime = activeFiveSceneRuntime();
  const initialState = createStoryMechanicalState({ values: { "pressure:scene": 0 } });
  const accepted = reduceStoryAction({ runtime: initialRuntime, state: initialState, action: storyAction() });
  const duplicate = reduceStoryAction({ runtime: accepted.runtime, state: accepted.state, action: storyAction() });

  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.status, "duplicate");
  assert.equal(duplicate.runtime, accepted.runtime);
  assert.equal(duplicate.state, accepted.state);
  assert.equal(duplicate.state.values["pressure:scene"], 1);
  assert.equal(duplicate.runtime.scenes[0].operationsUsed, 1);
});

test("#1675 Phase 1 illegal or unsupported actions are atomic and preserve both runtime and state", () => {
  const runtime = activeFiveSceneRuntime();
  const state = createStoryMechanicalState({ values: { score: 3 } });
  const unsupported = reduceStoryAction({
    runtime,
    state,
    action: storyAction("action:unsupported", { operation: { kind: "execute-javascript", source: "score = 999" } }),
  });
  assert.equal(unsupported.ok, false);
  assert.equal(unsupported.status, "illegal");
  assert.equal(unsupported.failure.code, "operation-rejected");
  assert.equal(unsupported.runtime, runtime);
  assert.equal(unsupported.state, state);
  assert.equal(state.values.score, 3);

  const resolvingRuntime = transitionFiveSceneStoryRuntime(runtime, "begin-scene-resolution").runtime;
  const duringResolution = reduceStoryAction({ runtime: resolvingRuntime, state, action: storyAction("action:late") });
  assert.equal(duringResolution.ok, false);
  assert.equal(duringResolution.failure.code, "scene-not-active");
  assert.equal(duringResolution.runtime, resolvingRuntime);
  assert.equal(duringResolution.state, state);
});

test("#1675 Phase 1 enforces the operation budget cumulatively across separate accepted actions", () => {
  const runtime = structuredClone(activeFiveSceneRuntime());
  runtime.session.resolutionQueue.limits.maximumOperationsPerScene = 2;
  let state = createStoryMechanicalState({ values: { "pressure:scene": 0 } });
  let currentRuntime = runtime;

  for (const id of ["action:budget-1", "action:budget-2"]) {
    const accepted = reduceStoryAction({ runtime: currentRuntime, state, action: storyAction(id) });
    assert.equal(accepted.status, "accepted");
    currentRuntime = accepted.runtime;
    state = accepted.state;
  }

  const rejected = reduceStoryAction({
    runtime: currentRuntime,
    state,
    action: storyAction("action:budget-3"),
  });
  assert.equal(rejected.ok, false);
  assert.equal(rejected.failure.code, "operation-budget-exceeded");
  assert.equal(rejected.runtime, currentRuntime);
  assert.equal(rejected.state, state);
  assert.equal(state.values["pressure:scene"], 2);
  assert.equal(currentRuntime.scenes[0].operationsUsed, 2);
});

test("#1675 Phase 1 action reduction is deterministic and ignores proposal timestamp for mechanical ordering", () => {
  const runtimeA = activeFiveSceneRuntime();
  const runtimeB = activeFiveSceneRuntime();
  const stateA = createStoryMechanicalState({ values: { "pressure:scene": 0 } });
  const stateB = createStoryMechanicalState({ values: { "pressure:scene": 0 } });
  const actionA = storyAction("action:deterministic", { proposedAt: "2026-09-04T01:00:00.000Z" });
  const actionB = storyAction("action:deterministic", { proposedAt: "2099-12-31T23:59:59.999Z" });
  const resultA = reduceStoryAction({ runtime: runtimeA, state: stateA, action: actionA });
  const resultB = reduceStoryAction({ runtime: runtimeB, state: stateB, action: actionB });

  assert.equal(resultA.status, "accepted");
  assert.equal(resultB.status, "accepted");
  assert.deepEqual(resultA.state, resultB.state);
  assert.equal(resultA.checkpoint.stateHash, resultB.checkpoint.stateHash);
  assert.deepEqual(resultA.acceptedEvent.operation, resultB.acceptedEvent.operation);
});
