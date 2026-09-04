import assert from "node:assert/strict";
import test from "node:test";

import {
  createStoryMechanicalState,
  normalizeStoryResolutionLimits,
  resolveStoryEventBatch,
  verifyStoryResolutionReplay,
} from "../modules/story-the-unwritten/resolution.mjs";

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
