import assert from "node:assert/strict";
import test from "node:test";

import { reduceStoryActionWithRules } from "../modules/story-the-unwritten/actions.mjs";
import {
  STORY_PROJECT_EXTENSION_KEY,
  STORY_PROJECT_PERSISTENCE_VERSION,
  createStorySessionSnapshot,
  loadStorySessionSnapshot,
  persistStorySessionSnapshot,
  resumeStorySessionFromProject,
  validateStorySessionSnapshotInput,
} from "../modules/story-the-unwritten/project-persistence.mjs";
import { createStoryMechanicalState } from "../modules/story-the-unwritten/resolution.mjs";
import {
  STORY_FIVE_SCENE_COUNT,
  createFiveSceneStoryRuntime,
  transitionFiveSceneStoryRuntime,
} from "../modules/story-the-unwritten/session-machine.mjs";

function phase2Runtime() {
  const ready = createFiveSceneStoryRuntime({
    sessionId: "session:phase2-proof",
    gameDefinitionId: "game:phase2-proof",
    worldId: "world:phase2-proof",
    worldRevisionRef: "world:phase2-proof@7",
    ppfProjectRef: "ppf:phase2-proof",
    resolutionLimits: { maximumOperationsPerScene: 12 },
    sceneDefinitions: Array.from({ length: STORY_FIVE_SCENE_COUNT }, (_, index) => ({
      id: `scene:${index + 1}`,
      locationId: `location:${index + 1}`,
      objectiveRefs: [`objective:${index + 1}`],
      narrativeBudget: 4,
    })),
  });
  return transitionFiveSceneStoryRuntime(ready, "start-session").runtime;
}

function phase2State() {
  return createStoryMechanicalState({
    values: { score: 3, "world:weather": "rain" },
    characterLocations: { "character:hero": "location:1" },
    objectCustody: { "object:key": "character:hero" },
    knowledgeByCharacter: { "character:hero": ["knowledge:road"] },
    relationships: { "relationship:trust": 2 },
    openThreads: ["thread:map"],
  });
}

function phase2Action() {
  return {
    id: "action:phase2-save",
    sessionId: "session:phase2-proof",
    sceneId: "scene:1",
    actorRef: "player:phase2-proof",
    pieceId: null,
    operation: { kind: "adjust-number", ref: "score", delta: 1 },
    idempotencyKey: "idempotency:phase2-save",
    proposedAt: "2026-09-04T04:00:00.000Z",
  };
}

function projectFixture() {
  return {
    id: "project:phase2-proof",
    title: "Phase 2 proof",
    characters: [{ id: "character:not-loaded", biography: "large whole-world payload must not be copied into a STORY snapshot" }],
    extensions: {
      canonicalRevision: {
        version: 1,
        currentRevision: 7,
        proposals: [{ id: "canon-only-proposal" }],
        history: [],
      },
      visualWritingSessions: {
        version: 1,
        sessions: { "scene:other": { id: "unrelated-session" } },
      },
    },
  };
}

function acceptedState() {
  const runtime = phase2Runtime();
  const state = phase2State();
  const result = reduceStoryActionWithRules({ runtime, state, action: phase2Action(), rules: [] });
  assert.equal(result.ok, true);
  assert.equal(result.status, "accepted");
  return result;
}

test("#1675 Phase 2 persists one STORY session through the existing PlotPickle project extension boundary", () => {
  const accepted = acceptedState();
  const project = projectFixture();
  const originalCanonical = structuredClone(project.extensions.canonicalRevision);
  const originalVisualSession = structuredClone(project.extensions.visualWritingSessions);
  const result = persistStorySessionSnapshot(project, {
    runtime: accepted.runtime,
    state: accepted.state,
    savedAt: "2026-09-04T04:01:00.000Z",
  });

  assert.equal(STORY_PROJECT_EXTENSION_KEY, "storyTheUnwritten");
  assert.equal(STORY_PROJECT_PERSISTENCE_VERSION, 1);
  assert.equal(project.extensions[STORY_PROJECT_EXTENSION_KEY], undefined);
  assert.deepEqual(result.project.extensions.canonicalRevision, originalCanonical);
  assert.deepEqual(result.project.extensions.visualWritingSessions, originalVisualSession);
  assert.equal(result.project.extensions[STORY_PROJECT_EXTENSION_KEY].version, 1);
  assert.equal(result.snapshot.sessionId, "session:phase2-proof");
  assert.equal(result.snapshot.ppfProjectRef, "ppf:phase2-proof");
  assert.equal(result.snapshot.runtime.session.stateRevision, 1);
  assert.equal(result.snapshot.mechanicalState.revision, 1);
});

test("#1675 Phase 2 snapshot stays sparse and does not duplicate whole-project or canonical PPF payloads", () => {
  const accepted = acceptedState();
  const snapshot = createStorySessionSnapshot({
    runtime: accepted.runtime,
    state: accepted.state,
    savedAt: "2026-09-04T04:02:00.000Z",
  });
  const serialized = JSON.stringify(snapshot);

  assert.equal("project" in snapshot, false);
  assert.equal("characters" in snapshot, false);
  assert.equal("canonicalRevision" in snapshot, false);
  assert.equal("ppf" in snapshot, false);
  assert.doesNotMatch(serialized, /canon-only-proposal/);
  assert.doesNotMatch(serialized, /large whole-world payload/);
  assert.match(serialized, /"ppfProjectRef":"ppf:phase2-proof"/);
  assert.deepEqual(snapshot.mechanicalState.knowledgeByCharacter["character:hero"], ["knowledge:road"]);
  assert.equal(snapshot.mechanicalState.objectCustody["object:key"], "character:hero");
});

test("#1675 Phase 2 rejects attached whole-world or undeclared state payloads instead of serializing them", () => {
  const accepted = acceptedState();
  const runtime = structuredClone(accepted.runtime);
  runtime.wholeWorld = { characters: [{ id: "character:all" }] };
  const runtimeValidation = validateStorySessionSnapshotInput({ runtime, state: accepted.state });
  assert.equal(runtimeValidation.ok, false);
  assert.ok(runtimeValidation.errors.some((error) => error.includes("unsupported field wholeWorld")));

  const state = structuredClone(accepted.state);
  state.hiddenCreatorPayload = { secrets: ["should-not-be-here"] };
  const stateValidation = validateStorySessionSnapshotInput({ runtime: accepted.runtime, state });
  assert.equal(stateValidation.ok, false);
  assert.ok(stateValidation.errors.some((error) => error.includes("unsupported field hiddenCreatorPayload")));
});

test("#1675 Phase 2 persists only quiescent checkpoints because queued event payloads are not stored yet", () => {
  const accepted = acceptedState();
  const pending = structuredClone(accepted.runtime);
  pending.session.resolutionQueue.queuedEventIds = ["story-event:pending"];
  const pendingValidation = validateStorySessionSnapshotInput({ runtime: pending, state: accepted.state });
  assert.equal(pendingValidation.ok, false);
  assert.ok(pendingValidation.errors.some((error) => error.includes("must be quiescent")));

  const nested = structuredClone(accepted.runtime);
  nested.session.resolutionQueue.triggerDepth = 1;
  const nestedValidation = validateStorySessionSnapshotInput({ runtime: nested, state: accepted.state });
  assert.equal(nestedValidation.ok, false);
  assert.ok(nestedValidation.errors.some((error) => error.includes("triggerDepth must be zero")));
});

test("#1675 Phase 2 JSON project close and reopen restores the same authoritative runtime and state", () => {
  const accepted = acceptedState();
  const saved = persistStorySessionSnapshot(projectFixture(), {
    runtime: accepted.runtime,
    state: accepted.state,
    savedAt: "2026-09-04T04:03:00.000Z",
  });
  const reopenedProject = JSON.parse(JSON.stringify(saved.project));
  const loaded = loadStorySessionSnapshot(reopenedProject, "session:phase2-proof");
  const resumed = resumeStorySessionFromProject(reopenedProject, "session:phase2-proof");

  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.snapshot, saved.snapshot);
  assert.equal(resumed.ok, true);
  assert.deepEqual(resumed.runtime, accepted.runtime);
  assert.deepEqual(resumed.state, accepted.state);
  assert.equal(resumed.savedAt, "2026-09-04T04:03:00.000Z");
});

test("#1675 Phase 2 resumed idempotency state prevents a previously accepted action from applying twice", () => {
  const accepted = acceptedState();
  const saved = persistStorySessionSnapshot(projectFixture(), {
    runtime: accepted.runtime,
    state: accepted.state,
    savedAt: "2026-09-04T04:04:00.000Z",
  });
  const reopenedProject = JSON.parse(JSON.stringify(saved.project));
  const resumed = resumeStorySessionFromProject(reopenedProject, "session:phase2-proof");
  assert.equal(resumed.ok, true);

  const retried = reduceStoryActionWithRules({
    runtime: resumed.runtime,
    state: resumed.state,
    action: { ...phase2Action(), proposedAt: "2099-12-31T23:59:59.999Z" },
    rules: [],
  });
  assert.equal(retried.ok, true);
  assert.equal(retried.status, "duplicate");
  assert.equal(retried.state.revision, 1);
  assert.equal(retried.state.values.score, 4);
  assert.deepEqual(retried.runtime.session.resolutionQueue.processedIdempotencyKeys, ["idempotency:phase2-save"]);
});

test("#1675 Phase 2 refuses to persist a stale runtime/state pair instead of repairing it silently", () => {
  const runtime = phase2Runtime();
  const state = createStoryMechanicalState({ revision: 2 });
  const validation = validateStorySessionSnapshotInput({ runtime, state });
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes("stateRevision must match")));

  const project = projectFixture();
  assert.throws(() => persistStorySessionSnapshot(project, {
    runtime,
    state,
    savedAt: "2026-09-04T04:05:00.000Z",
  }), /stateRevision must match/);
  assert.equal(project.extensions[STORY_PROJECT_EXTENSION_KEY], undefined);
});

test("#1675 Phase 2 refuses to overwrite a future incompatible or malformed STORY extension", () => {
  const accepted = acceptedState();
  const project = projectFixture();
  project.extensions[STORY_PROJECT_EXTENSION_KEY] = {
    version: 2,
    sessions: { "session:future": { version: 2 } },
  };
  const before = structuredClone(project.extensions[STORY_PROJECT_EXTENSION_KEY]);

  assert.throws(() => persistStorySessionSnapshot(project, {
    runtime: accepted.runtime,
    state: accepted.state,
    savedAt: "2026-09-04T04:05:30.000Z",
  }), /incompatible project extension version 2/);
  assert.deepEqual(project.extensions[STORY_PROJECT_EXTENSION_KEY], before);

  const malformed = projectFixture();
  malformed.extensions[STORY_PROJECT_EXTENSION_KEY] = "corrupt";
  const malformedLoad = loadStorySessionSnapshot(malformed, "session:phase2-proof");
  assert.equal(malformedLoad.ok, false);
  assert.equal(malformedLoad.reason, "invalid-extension");
  assert.throws(() => persistStorySessionSnapshot(malformed, {
    runtime: accepted.runtime,
    state: accepted.state,
    savedAt: "2026-09-04T04:05:45.000Z",
  }), /malformed project extension data/);
  assert.equal(malformed.extensions[STORY_PROJECT_EXTENSION_KEY], "corrupt");

  const malformedSessions = projectFixture();
  malformedSessions.extensions[STORY_PROJECT_EXTENSION_KEY] = { version: 1, sessions: "corrupt" };
  const malformedSessionsLoad = loadStorySessionSnapshot(malformedSessions, "session:phase2-proof");
  assert.equal(malformedSessionsLoad.ok, false);
  assert.equal(malformedSessionsLoad.reason, "invalid-extension");
  assert.ok(malformedSessionsLoad.errors.some((error) => error.includes("sessions must be an object")));
  assert.throws(() => persistStorySessionSnapshot(malformedSessions, {
    runtime: accepted.runtime,
    state: accepted.state,
    savedAt: "2026-09-04T04:05:50.000Z",
  }), /malformed project extension data/);

  const overloadedStore = projectFixture();
  overloadedStore.extensions[STORY_PROJECT_EXTENSION_KEY] = {
    version: 1,
    sessions: {},
    wholeWorld: { characters: [{ id: "character:all" }] },
  };
  const overloadedLoad = loadStorySessionSnapshot(overloadedStore, "session:phase2-proof");
  assert.equal(overloadedLoad.ok, false);
  assert.equal(overloadedLoad.reason, "invalid-extension");
  assert.ok(overloadedLoad.errors.some((error) => error.includes("unsupported field wholeWorld")));
  assert.throws(() => persistStorySessionSnapshot(overloadedStore, {
    runtime: accepted.runtime,
    state: accepted.state,
    savedAt: "2026-09-04T04:05:55.000Z",
  }), /malformed project extension data/);
});

test("#1675 Phase 2 rejects incompatible and corrupted stored snapshots explicitly", () => {
  const accepted = acceptedState();
  const saved = persistStorySessionSnapshot(projectFixture(), {
    runtime: accepted.runtime,
    state: accepted.state,
    savedAt: "2026-09-04T04:06:00.000Z",
  });

  const incompatible = structuredClone(saved.project);
  incompatible.extensions[STORY_PROJECT_EXTENSION_KEY].version = 2;
  const incompatibleResult = loadStorySessionSnapshot(incompatible, "session:phase2-proof");
  assert.equal(incompatibleResult.ok, false);
  assert.equal(incompatibleResult.reason, "incompatible-version");

  const corrupted = structuredClone(saved.project);
  corrupted.extensions[STORY_PROJECT_EXTENSION_KEY].sessions["session:phase2-proof"].mechanicalState.revision = 99;
  const corruptedResult = loadStorySessionSnapshot(corrupted, "session:phase2-proof");
  assert.equal(corruptedResult.ok, false);
  assert.equal(corruptedResult.reason, "invalid-snapshot");
  assert.ok(corruptedResult.errors.some((error) => error.includes("stateRevision must match")));

  const corruptedQueue = structuredClone(saved.project);
  corruptedQueue.extensions[STORY_PROJECT_EXTENSION_KEY].sessions["session:phase2-proof"].runtime.session.resolutionQueue.processedIdempotencyKeys = [null];
  const corruptedQueueResult = loadStorySessionSnapshot(corruptedQueue, "session:phase2-proof");
  assert.equal(corruptedQueueResult.ok, false);
  assert.equal(corruptedQueueResult.reason, "invalid-snapshot");
  assert.ok(corruptedQueueResult.errors.some((error) => error.includes("processedIdempotencyKeys")));

  const corruptedWrapper = structuredClone(saved.project);
  corruptedWrapper.extensions[STORY_PROJECT_EXTENSION_KEY].sessions["session:phase2-proof"].wholeWorld = {
    characters: [{ id: "character:should-not-load" }],
  };
  const corruptedWrapperResult = loadStorySessionSnapshot(corruptedWrapper, "session:phase2-proof");
  assert.equal(corruptedWrapperResult.ok, false);
  assert.equal(corruptedWrapperResult.reason, "invalid-snapshot");
  assert.ok(corruptedWrapperResult.errors.some((error) => error.includes("unsupported field wholeWorld")));
});
