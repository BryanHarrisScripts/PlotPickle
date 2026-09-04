import assert from "node:assert/strict";
import test from "node:test";

import "./issue-1675-story-end-conditions.test.mjs";
import { createStoryMechanicalState } from "../modules/story-the-unwritten/resolution.mjs";
import {
  STORY_RULE_TRIGGERS,
  deriveStoryRuleEvents,
  evaluateStoryCondition,
  resolveStoryRuleTrigger,
  validateStoryConditionDefinition,
  validateStoryOperationDefinition,
  validateStoryRuleDefinition,
} from "../modules/story-the-unwritten/rules.mjs";

const provenance = Object.freeze({
  authorship: "human",
  creatorRef: "profile:creator",
  sourceRefs: [],
  admittedByRef: "story-admission:rule",
  admittedAt: "2026-09-04T01:00:00.000Z",
});

function storyRule(id = "rule:pressure", overrides = {}) {
  return {
    id,
    schemaVersion: 1,
    title: "Pressure consequence",
    priority: 10,
    when: "action-accepted",
    if: [{ kind: "value-at-least", ref: "pressure:scene", value: 2 }],
    cost: [{ kind: "adjust-number", ref: "coins", delta: -1 }],
    do: [{ kind: "set-value", ref: "door:open", value: true }],
    then: [{ kind: "open-thread", threadRef: "thread:opened-door" }],
    enabled: true,
    provenance,
    ...overrides,
  };
}

test("#1675 Phase 1 ratified rule triggers stay finite and creator rules cannot smuggle executable fields", () => {
  assert.deepEqual(STORY_RULE_TRIGGERS, [
    "action-proposed",
    "action-accepted",
    "scene-started",
    "scene-ended",
    "state-changed",
    "knowledge-changed",
    "relationship-changed",
  ]);
  assert.deepEqual(validateStoryRuleDefinition(storyRule()), { ok: true, errors: [] });

  const scripted = storyRule("rule:scripted", {
    do: [{ kind: "set-value", ref: "safe:value", value: true, source: "process.exit(0)" }],
  });
  const result = validateStoryRuleDefinition(scripted);
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("unsupported field source")));
  assert.equal(validateStoryOperationDefinition({ kind: "execute-javascript", source: "danger" }).ok, false);
});

test("#1675 Phase 1 validates the exact six IF condition forms and rejects extra authority-shaped fields", () => {
  for (const condition of [
    { kind: "ref-exists", ref: "thread:map" },
    { kind: "ref-absent", ref: "thread:missing" },
    { kind: "value-equals", ref: "door:open", value: true },
    { kind: "value-at-least", ref: "coins", value: 2 },
    { kind: "actor-knows", actorId: "character:elara", knowledgeRef: "knowledge:road" },
    { kind: "actor-present", actorId: "character:elara", locationId: "location:archive" },
  ]) assert.equal(validateStoryConditionDefinition(condition).ok, true, condition.kind);

  const result = validateStoryConditionDefinition({ kind: "ref-exists", ref: "thread:map", tool: "shell" });
  assert.equal(result.ok, false);
  assert.ok(result.errors.some((error) => error.includes("unsupported field tool")));
});

test("#1675 Phase 1 evaluates IF conditions only from deterministic mechanical state", () => {
  const state = createStoryMechanicalState({
    values: { "door:open": true, coins: 3 },
    characterLocations: { "character:elara": "location:archive" },
    objectCustody: { "object:key": "character:elara" },
    knowledgeByCharacter: { "character:elara": ["knowledge:road"] },
    relationships: { "relationship:trust": 4 },
    openThreads: ["thread:map"],
  });

  assert.equal(evaluateStoryCondition(state, { kind: "ref-exists", ref: "thread:map" }), true);
  assert.equal(evaluateStoryCondition(state, { kind: "ref-exists", ref: "object:key" }), true);
  assert.equal(evaluateStoryCondition(state, { kind: "ref-absent", ref: "thread:missing" }), true);
  assert.equal(evaluateStoryCondition(state, { kind: "value-equals", ref: "door:open", value: true }), true);
  assert.equal(evaluateStoryCondition(state, { kind: "value-at-least", ref: "coins", value: 3 }), true);
  assert.equal(evaluateStoryCondition(state, { kind: "actor-knows", actorId: "character:elara", knowledgeRef: "knowledge:road" }), true);
  assert.equal(evaluateStoryCondition(state, { kind: "actor-present", actorId: "character:elara", locationId: "location:archive" }), true);
  assert.equal(evaluateStoryCondition(state, { kind: "value-at-least", ref: "coins", value: 4 }), false);
});

test("#1675 Phase 1 WHEN and IF filter rules before any COST, DO or THEN event exists", () => {
  const state = createStoryMechanicalState({ values: { "pressure:scene": 1, coins: 3 } });
  const result = deriveStoryRuleEvents({
    rules: [
      storyRule("rule:condition-false"),
      storyRule("rule:disabled", { enabled: false, if: [] }),
      storyRule("rule:wrong-trigger", { when: "scene-started", if: [] }),
    ],
    trigger: "action-accepted",
    state,
    causationRef: "action:one",
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.matchedRuleIds, []);
  assert.deepEqual(result.events, []);
});

test("#1675 Phase 1 rule ordering is stable by priority then id, while COST precedes DO and THEN", () => {
  const state = createStoryMechanicalState({ values: { coins: 10 } });
  const rules = [
    storyRule("rule:z", { priority: 20, if: [] }),
    storyRule("rule:b", { priority: 10, if: [] }),
    storyRule("rule:a", { priority: 10, if: [] }),
  ];
  const forward = deriveStoryRuleEvents({ rules, trigger: "action-accepted", state, causationRef: "action:order", nextSequence: 7 });
  const reverse = deriveStoryRuleEvents({ rules: [...rules].reverse(), trigger: "action-accepted", state, causationRef: "action:order", nextSequence: 7 });

  assert.equal(forward.ok, true);
  assert.deepEqual(forward.matchedRuleIds, ["rule:a", "rule:b", "rule:z"]);
  assert.deepEqual(forward.events, reverse.events);
  assert.deepEqual(forward.events.map((event) => [event.ruleId, event.operation.kind]), [
    ["rule:a", "adjust-number"],
    ["rule:a", "set-value"],
    ["rule:a", "open-thread"],
    ["rule:b", "adjust-number"],
    ["rule:b", "set-value"],
    ["rule:b", "open-thread"],
    ["rule:z", "adjust-number"],
    ["rule:z", "set-value"],
    ["rule:z", "open-thread"],
  ]);
  assert.deepEqual(forward.events.map((event) => event.enqueueOrder), [7, 8, 9, 10, 11, 12, 13, 14, 15]);
});

test("#1675 Phase 1 resolves COST, DO and THEN as one deterministic atomic event batch", () => {
  const state = createStoryMechanicalState({ values: { "pressure:scene": 2, coins: 3 } });
  const result = resolveStoryRuleTrigger({
    rules: [storyRule()],
    trigger: "action-accepted",
    state,
    causationRef: "action:one",
  });

  assert.equal(result.ok, true);
  assert.deepEqual(result.matchedRuleIds, ["rule:pressure"]);
  assert.equal(result.state.values.coins, 2);
  assert.equal(result.state.values["door:open"], true);
  assert.deepEqual(result.state.openThreads, ["thread:opened-door"]);
  assert.equal(result.state.revision, 3);
  assert.deepEqual(result.acceptedEvents.map((event) => event.operation.kind), ["adjust-number", "set-value", "open-thread"]);
  assert.equal(state.values.coins, 3);
  assert.equal(state.values["door:open"], undefined);
});

test("#1675 Phase 1 a dynamically impossible later operation rolls back earlier rule stages", () => {
  const state = createStoryMechanicalState({ values: { "pressure:scene": 2, coins: 3, score: "not-a-number" } });
  const rule = storyRule("rule:atomic", {
    cost: [{ kind: "adjust-number", ref: "coins", delta: -1 }],
    do: [{ kind: "set-value", ref: "door:open", value: true }],
    then: [{ kind: "adjust-number", ref: "score", delta: 1 }],
  });
  const result = resolveStoryRuleTrigger({ rules: [rule], trigger: "action-accepted", state, causationRef: "action:atomic" });

  assert.equal(result.ok, false);
  assert.equal(result.failure.code, "operation-rejected");
  assert.equal(result.state, state);
  assert.equal(state.values.coins, 3);
  assert.equal(state.values["door:open"], undefined);
  assert.deepEqual(result.acceptedEvents, []);
});

test("#1675 Phase 1 rule event identities are replay-safe for the same causation", () => {
  const state = createStoryMechanicalState({ values: { "pressure:scene": 2, coins: 3 } });
  const first = resolveStoryRuleTrigger({ rules: [storyRule()], trigger: "action-accepted", state, causationRef: "action:replay" });
  assert.equal(first.ok, true);

  const replay = resolveStoryRuleTrigger({
    rules: [storyRule()],
    trigger: "action-accepted",
    state: first.state,
    causationRef: "action:replay",
    processedIdempotencyKeys: first.checkpoint.processedIdempotencyKeys,
  });
  assert.equal(replay.ok, true);
  assert.equal(replay.state.revision, first.state.revision);
  assert.equal(replay.state.values.coins, 2);
  assert.deepEqual(replay.acceptedEvents, []);
});

test("#1675 Phase 1 ancestry cycle protection rejects a rule re-entering its own causal chain", () => {
  const state = createStoryMechanicalState({ values: { coins: 3 } });
  const rule = storyRule("rule:loop", { if: [] });
  const result = resolveStoryRuleTrigger({
    rules: [rule],
    trigger: "action-accepted",
    state,
    causationRef: "action:loop",
    triggerDepth: 1,
    ancestryKeys: ["story-rule:rule:loop"],
  });
  assert.equal(result.ok, false);
  assert.equal(result.failure.code, "cycle-detected");
  assert.equal(result.state, state);
});
