import assert from "node:assert/strict";
import test from "node:test";

import { reduceStoryActionWithRules } from "../modules/story-the-unwritten/actions.mjs";
import { resolveStorySessionEnd } from "../modules/story-the-unwritten/end-conditions.mjs";
import { createStoryMechanicalState } from "../modules/story-the-unwritten/resolution.mjs";
import {
  STORY_FIVE_SCENE_COUNT,
  createFiveSceneStoryRuntime,
  transitionFiveSceneStoryRuntime,
} from "../modules/story-the-unwritten/session-machine.mjs";

const provenance = Object.freeze({
  authorship: "human",
  creatorRef: "profile:phase1-proof",
  sourceRefs: [],
  admittedByRef: "story-admission:phase1-proof",
  admittedAt: "2026-09-04T01:15:00.000Z",
});

function rule(id, priority, conditions, operation) {
  return {
    id,
    schemaVersion: 1,
    title: id,
    priority,
    when: "action-accepted",
    if: conditions,
    cost: [],
    do: [operation],
    then: [],
    enabled: true,
    provenance,
  };
}

const fiveSceneRules = Object.freeze([
  rule("rule:move-hero", 10, [{ kind: "value-at-least", ref: "score", value: 1 }], {
    kind: "move-character",
    characterId: "character:hero",
    locationId: "location:crossroads",
  }),
  rule("rule:reveal-secret", 20, [{ kind: "value-at-least", ref: "score", value: 2 }], {
    kind: "grant-knowledge",
    characterId: "character:hero",
    knowledgeRef: "knowledge:road",
  }),
  rule("rule:claim-key", 30, [{ kind: "value-at-least", ref: "score", value: 3 }], {
    kind: "transfer-object",
    objectId: "object:key",
    custodianRef: "character:hero",
  }),
  rule("rule:trust-grows", 40, [{ kind: "value-at-least", ref: "score", value: 4 }], {
    kind: "adjust-relationship",
    relationshipId: "relationship:trust",
    delta: 1,
  }),
  rule("rule:open-ending", 50, [{ kind: "value-at-least", ref: "score", value: 5 }], {
    kind: "open-thread",
    threadRef: "thread:ending-earned",
  }),
]);

const victoryRef = "end-ref:phase1-victory";
const victoryDefinitions = Object.freeze({
  [victoryRef]: Object.freeze({
    id: "end:phase1-victory",
    schemaVersion: 1,
    priority: 10,
    outcome: "victory",
    if: Object.freeze([{ kind: "value-at-least", ref: "score", value: 5 }]),
    enabled: true,
  }),
});

function createPhase1Runtime() {
  return createFiveSceneStoryRuntime({
    sessionId: "session:phase1-proof",
    gameDefinitionId: "game:phase1-proof",
    worldId: "world:phase1-proof",
    worldRevisionRef: "world:phase1-proof@1",
    ppfProjectRef: "ppf:phase1-proof",
    resolutionLimits: { maximumOperationsPerScene: 16 },
    sceneDefinitions: Array.from({ length: STORY_FIVE_SCENE_COUNT }, (_, index) => ({
      id: `scene:${index + 1}`,
      locationId: `location:${index + 1}`,
      objectiveRefs: [`objective:${index + 1}`],
      narrativeBudget: 4,
    })),
  });
}

function actionForScene(sceneNumber, proposedAt) {
  return {
    id: `action:scene-${sceneNumber}`,
    sessionId: "session:phase1-proof",
    sceneId: `scene:${sceneNumber}`,
    actorRef: "player:phase1-proof",
    pieceId: null,
    operation: { kind: "adjust-number", ref: "score", delta: 1 },
    idempotencyKey: `idempotency:scene-${sceneNumber}`,
    proposedAt,
  };
}

function playFiveSceneProof(timestampPrefix) {
  let runtime = transitionFiveSceneStoryRuntime(createPhase1Runtime(), "start-session").runtime;
  let state = createStoryMechanicalState({
    values: { score: 0 },
    relationships: { "relationship:trust": 0 },
  });

  for (let sceneNumber = 1; sceneNumber <= STORY_FIVE_SCENE_COUNT; sceneNumber += 1) {
    const actionResult = reduceStoryActionWithRules({
      runtime,
      state,
      action: actionForScene(sceneNumber, `${timestampPrefix}-0${sceneNumber}T00:00:00.000Z`),
      rules: fiveSceneRules,
    });
    assert.equal(actionResult.ok, true, `scene ${sceneNumber} action should be accepted`);
    assert.equal(actionResult.status, "accepted");
    runtime = actionResult.runtime;
    state = actionResult.state;
    assert.equal(runtime.session.stateRevision, state.revision);

    const resolving = transitionFiveSceneStoryRuntime(runtime, "begin-scene-resolution");
    assert.equal(resolving.ok, true, `scene ${sceneNumber} should enter resolution`);
    runtime = resolving.runtime;

    const endResult = resolveStorySessionEnd({
      runtime,
      state,
      endConditionRefs: [victoryRef],
      definitionsByRef: victoryDefinitions,
    });
    assert.equal(endResult.ok, true);

    if (sceneNumber < STORY_FIVE_SCENE_COUNT) {
      assert.equal(endResult.status, "ongoing");
      const advance = transitionFiveSceneStoryRuntime(runtime, "complete-scene");
      assert.equal(advance.ok, true, `scene ${sceneNumber} should advance exactly once`);
      runtime = advance.runtime;
    } else {
      assert.equal(endResult.status, "ended");
      assert.equal(endResult.evaluation.match.outcome, "victory");
      runtime = endResult.runtime;
    }
  }

  return { runtime, state };
}

test("#1675 Phase 1 accepted action and matched rules commit atomically or not at all", () => {
  const runtime = transitionFiveSceneStoryRuntime(createPhase1Runtime(), "start-session").runtime;
  const state = createStoryMechanicalState({
    values: { score: 0, coins: 3, "broken:number": "not-a-number" },
  });
  const failingRule = {
    id: "rule:atomic-failure",
    schemaVersion: 1,
    title: "Atomic failure proof",
    priority: 10,
    when: "action-accepted",
    if: [],
    cost: [{ kind: "adjust-number", ref: "coins", delta: -1 }],
    do: [{ kind: "adjust-number", ref: "broken:number", delta: 1 }],
    then: [],
    enabled: true,
    provenance,
  };

  const result = reduceStoryActionWithRules({
    runtime,
    state,
    action: actionForScene(1, "2026-09-04T01:16:00.000Z"),
    rules: [failingRule],
  });

  assert.equal(result.ok, false);
  assert.equal(result.status, "illegal");
  assert.equal(result.failure.code, "operation-rejected");
  assert.equal(result.runtime, runtime);
  assert.equal(result.state, state);
  assert.equal(state.values.score, 0);
  assert.equal(state.values.coins, 3);
  assert.equal(runtime.session.stateRevision, 0);
  assert.equal(runtime.scenes[0].operationsUsed, 0);
});

test("#1675 Phase 1 action plus rule consequences share one cumulative scene operation budget", () => {
  const runtime = createPhase1Runtime();
  runtime.session.resolutionQueue.limits.maximumOperationsPerScene = 2;
  const active = transitionFiveSceneStoryRuntime(runtime, "start-session").runtime;
  const state = createStoryMechanicalState({ values: { score: 0 } });
  const twoConsequences = {
    id: "rule:too-many-consequences",
    schemaVersion: 1,
    title: "Budget proof",
    priority: 10,
    when: "action-accepted",
    if: [],
    cost: [],
    do: [
      { kind: "set-value", ref: "one", value: true },
      { kind: "set-value", ref: "two", value: true },
    ],
    then: [],
    enabled: true,
    provenance,
  };

  const result = reduceStoryActionWithRules({
    runtime: active,
    state,
    action: actionForScene(1, "2026-09-04T01:17:00.000Z"),
    rules: [twoConsequences],
  });

  assert.equal(result.ok, false);
  assert.equal(result.failure.code, "operation-budget-exceeded");
  assert.equal(result.runtime, active);
  assert.equal(result.state, state);
  assert.equal(state.values.score, 0);
  assert.equal(active.scenes[0].operationsUsed, 0);
});

test("#1675 Phase 1 duplicate action retries cannot replay their matched rule consequences", () => {
  const runtime = transitionFiveSceneStoryRuntime(createPhase1Runtime(), "start-session").runtime;
  const state = createStoryMechanicalState({ values: { score: 0 } });
  const first = reduceStoryActionWithRules({
    runtime,
    state,
    action: actionForScene(1, "2026-09-04T01:18:00.000Z"),
    rules: [fiveSceneRules[0]],
  });
  assert.equal(first.status, "accepted");
  assert.equal(first.acceptedRuleEvents.length, 1);

  const duplicate = reduceStoryActionWithRules({
    runtime: first.runtime,
    state: first.state,
    action: actionForScene(1, "2099-12-31T23:59:59.999Z"),
    rules: [fiveSceneRules[0]],
  });
  assert.equal(duplicate.ok, true);
  assert.equal(duplicate.status, "duplicate");
  assert.equal(duplicate.runtime, first.runtime);
  assert.equal(duplicate.state, first.state);
  assert.deepEqual(duplicate.acceptedRuleEvents, []);
  assert.equal(duplicate.state.revision, 2);
  assert.equal(duplicate.runtime.scenes[0].operationsUsed, 2);
});

test("#1675 Phase 1 replays the same five accepted actions into the same authoritative final state without an LLM", () => {
  const first = playFiveSceneProof("2026-09");
  const replay = playFiveSceneProof("2099-12");

  assert.deepEqual(replay.state, first.state);
  assert.deepEqual(replay.runtime, first.runtime);
  assert.equal(first.runtime.session.status, "completed");
  assert.equal(first.runtime.session.currentSceneId, null);
  assert.deepEqual(first.runtime.scenes.map((scene) => scene.status), ["resolved", "resolved", "resolved", "resolved", "resolved"]);
  assert.deepEqual(first.runtime.scenes.map((scene) => scene.operationsUsed), [2, 3, 4, 5, 6]);
  assert.equal(first.state.revision, 20);
  assert.equal(first.runtime.session.stateRevision, 20);
  assert.equal(first.state.values.score, 5);
  assert.equal(first.state.characterLocations["character:hero"], "location:crossroads");
  assert.equal(first.state.objectCustody["object:key"], "character:hero");
  assert.deepEqual(first.state.knowledgeByCharacter["character:hero"], ["knowledge:road"]);
  assert.equal(first.state.relationships["relationship:trust"], 2);
  assert.deepEqual(first.state.openThreads, ["thread:ending-earned"]);
});
