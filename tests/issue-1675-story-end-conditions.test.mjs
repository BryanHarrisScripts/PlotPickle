import assert from "node:assert/strict";
import test from "node:test";

import {
  STORY_END_OUTCOMES,
  applyStoryEndCondition,
  evaluateStoryEndConditions,
  resolveStorySessionEnd,
  validateStoryEndConditionDefinition,
} from "../modules/story-the-unwritten/end-conditions.mjs";
import { createStoryMechanicalState } from "../modules/story-the-unwritten/resolution.mjs";
import {
  STORY_FIVE_SCENE_COUNT,
  createFiveSceneStoryRuntime,
  transitionFiveSceneStoryRuntime,
} from "../modules/story-the-unwritten/session-machine.mjs";

function fiveSceneRuntime() {
  return createFiveSceneStoryRuntime({
    sessionId: "session:end-condition-proof",
    gameDefinitionId: "game:end-condition-proof",
    worldId: "world:unwritten",
    worldRevisionRef: "world:unwritten@1",
    ppfProjectRef: "ppf:unwritten",
    sceneDefinitions: Array.from({ length: STORY_FIVE_SCENE_COUNT }, (_, index) => ({
      id: `scene:${index + 1}`,
      locationId: `location:${index + 1}`,
      narrativeBudget: 4,
    })),
  });
}

function resolvingRuntime() {
  const active = transitionFiveSceneStoryRuntime(fiveSceneRuntime(), "start-session").runtime;
  return transitionFiveSceneStoryRuntime(active, "begin-scene-resolution").runtime;
}

function endCondition(id, outcome, priority = 10, conditions = [], overrides = {}) {
  return {
    id,
    schemaVersion: 1,
    priority,
    outcome,
    if: conditions,
    enabled: true,
    ...overrides,
  };
}

test("#1675 Phase 1 end outcomes are finite and end-condition definitions cannot contain executable payloads", () => {
  assert.deepEqual(STORY_END_OUTCOMES, ["victory", "loss", "ending"]);
  assert.deepEqual(validateStoryEndConditionDefinition(endCondition("end:victory", "victory")), { ok: true, errors: [] });

  const scripted = validateStoryEndConditionDefinition({
    ...endCondition("end:scripted", "ending"),
    source: "process.exit(0)",
  });
  assert.equal(scripted.ok, false);
  assert.ok(scripted.errors.some((error) => error.includes("unsupported field source")));
  assert.equal(validateStoryEndConditionDefinition(endCondition("end:unknown", "draw")).ok, false);
});

test("#1675 Phase 1 resolves only end-condition references declared by the game definition boundary", () => {
  const state = createStoryMechanicalState({ values: { score: 10 } });
  const result = evaluateStoryEndConditions({
    endConditionRefs: ["end-ref:victory"],
    definitionsByRef: {
      "end-ref:victory": endCondition("end:victory", "victory", 10, [{ kind: "value-at-least", ref: "score", value: 10 }]),
      "end-ref:unlisted-loss": endCondition("end:loss", "loss", 1, []),
    },
    state,
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, "matched");
  assert.equal(result.match.endConditionRef, "end-ref:victory");
  assert.equal(result.match.outcome, "victory");
});

test("#1675 Phase 1 missing or duplicate end-condition references fail explicitly before play can end", () => {
  const state = createStoryMechanicalState();
  const missing = evaluateStoryEndConditions({
    endConditionRefs: ["end-ref:missing"],
    definitionsByRef: {},
    state,
  });
  assert.equal(missing.ok, false);
  assert.equal(missing.failure.code, "missing-end-condition");
  assert.equal(missing.failure.endConditionRef, "end-ref:missing");

  const duplicate = evaluateStoryEndConditions({
    endConditionRefs: ["end-ref:a", "end-ref:a"],
    definitionsByRef: { "end-ref:a": endCondition("end:a", "ending") },
    state,
  });
  assert.equal(duplicate.ok, false);
  assert.equal(duplicate.failure.code, "duplicate-end-condition-ref");
});

test("#1675 Phase 1 matching end conditions are selected deterministically by priority then reference", () => {
  const state = createStoryMechanicalState({ values: { score: 10 } });
  const definitions = {
    "end-ref:z": endCondition("end:z", "ending", 20, []),
    "end-ref:b": endCondition("end:b", "loss", 10, []),
    "end-ref:a": endCondition("end:a", "victory", 10, []),
  };
  const forward = evaluateStoryEndConditions({
    endConditionRefs: ["end-ref:z", "end-ref:b", "end-ref:a"],
    definitionsByRef: definitions,
    state,
  });
  const reverse = evaluateStoryEndConditions({
    endConditionRefs: ["end-ref:a", "end-ref:b", "end-ref:z"],
    definitionsByRef: definitions,
    state,
  });
  assert.equal(forward.match.endConditionRef, "end-ref:a");
  assert.deepEqual(reverse, forward);
});

test("#1675 Phase 1 unmet end conditions leave the exact session runtime untouched", () => {
  const runtime = resolvingRuntime();
  const state = createStoryMechanicalState({ values: { score: 1 } });
  const result = resolveStorySessionEnd({
    runtime,
    state,
    endConditionRefs: ["end-ref:victory"],
    definitionsByRef: {
      "end-ref:victory": endCondition("end:victory", "victory", 10, [{ kind: "value-at-least", ref: "score", value: 10 }]),
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, "ongoing");
  assert.equal(result.runtime, runtime);
  assert.equal(runtime.session.status, "active");
  assert.equal(runtime.scenes[0].status, "resolving");
});

test("#1675 Phase 1 victory and neutral ending outcomes resolve the current scene and complete the session", () => {
  for (const outcome of ["victory", "ending"]) {
    const runtime = resolvingRuntime();
    const result = resolveStorySessionEnd({
      runtime,
      state: createStoryMechanicalState({ values: { "story:done": true } }),
      endConditionRefs: [`end-ref:${outcome}`],
      definitionsByRef: {
        [`end-ref:${outcome}`]: endCondition(`end:${outcome}`, outcome, 10, [{ kind: "value-equals", ref: "story:done", value: true }]),
      },
    });
    assert.equal(result.ok, true, outcome);
    assert.equal(result.status, "ended", outcome);
    assert.equal(result.evaluation.match.outcome, outcome);
    assert.equal(result.runtime.session.status, "completed");
    assert.equal(result.runtime.session.currentSceneId, null);
    assert.equal(result.runtime.scenes[0].status, "resolved");
    assert.equal(result.runtime.scenes[1].status, "ready");
    assert.equal(runtime.session.status, "active");
    assert.equal(runtime.scenes[0].status, "resolving");
  }
});

test("#1675 Phase 1 loss resolves deterministically as terminal failure without entering a later scene", () => {
  const runtime = resolvingRuntime();
  const result = resolveStorySessionEnd({
    runtime,
    state: createStoryMechanicalState({ openThreads: ["thread:irrecoverable-loss"] }),
    endConditionRefs: ["end-ref:loss"],
    definitionsByRef: {
      "end-ref:loss": endCondition("end:loss", "loss", 10, [{ kind: "ref-exists", ref: "thread:irrecoverable-loss" }]),
    },
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, "ended");
  assert.equal(result.runtime.session.status, "failed");
  assert.equal(result.runtime.session.currentSceneId, "scene:1");
  assert.equal(result.runtime.scenes[0].status, "failed");
  assert.equal(result.runtime.scenes[1].status, "ready");
});

test("#1675 Phase 1 end conditions may be evaluated during play but can commit only at a resolving scene boundary", () => {
  const active = transitionFiveSceneStoryRuntime(fiveSceneRuntime(), "start-session").runtime;
  const evaluation = evaluateStoryEndConditions({
    endConditionRefs: ["end-ref:victory"],
    definitionsByRef: { "end-ref:victory": endCondition("end:victory", "victory", 10, []) },
    state: createStoryMechanicalState(),
  });
  assert.equal(evaluation.status, "matched");

  const result = applyStoryEndCondition({ runtime: active, evaluation });
  assert.equal(result.ok, false);
  assert.equal(result.status, "illegal");
  assert.equal(result.failure.code, "scene-not-resolving");
  assert.equal(result.runtime, active);
  assert.equal(active.session.status, "active");
  assert.equal(active.scenes[0].status, "active");
});

test("#1675 Phase 1 disabled end conditions and legal knowledge conditions remain deterministic and non-terminal", () => {
  const state = createStoryMechanicalState({
    knowledgeByCharacter: { "character:elara": ["knowledge:road"] },
  });
  const result = evaluateStoryEndConditions({
    endConditionRefs: ["end-ref:disabled", "end-ref:unknown"],
    definitionsByRef: {
      "end-ref:disabled": endCondition("end:disabled", "victory", 1, [], { enabled: false }),
      "end-ref:unknown": endCondition("end:unknown", "ending", 2, [
        { kind: "actor-knows", actorId: "character:elara", knowledgeRef: "knowledge:forbidden" },
      ]),
    },
    state,
  });
  assert.equal(result.ok, true);
  assert.equal(result.status, "ongoing");
  assert.equal(result.match, null);
});
