import assert from "node:assert/strict";
import test from "node:test";

import { reduceStoryActionWithRules } from "../modules/story-the-unwritten/actions.mjs";
import { persistStoryCharacterDefinition } from "../modules/story-the-unwritten/character-persistence.mjs";
import {
  persistAcceptedStoryTransaction,
  readStorySessionHistory,
} from "../modules/story-the-unwritten/history-persistence.mjs";
import {
  resumeStorySessionFromProject,
} from "../modules/story-the-unwritten/project-persistence.mjs";
import { createStoryMechanicalState } from "../modules/story-the-unwritten/resolution.mjs";
import { createFiveSceneStoryRuntime, transitionFiveSceneStoryRuntime } from "../modules/story-the-unwritten/session-machine.mjs";

const provenance = Object.freeze({
  authorship: "human",
  creatorRef: "profile:history-proof",
  sourceRefs: [],
  admittedByRef: "story-admission:history-proof",
  admittedAt: "2026-09-04T08:30:00.000Z",
});

const consequenceRule = Object.freeze({
  id: "rule:history-consequence",
  schemaVersion: 1,
  title: "History consequence",
  priority: 10,
  when: "action-accepted",
  if: [{ kind: "value-at-least", ref: "score", value: 1 }],
  cost: [],
  do: [
    { kind: "move-character", characterId: "character:hero", locationId: "location:crossroads" },
    { kind: "grant-knowledge", characterId: "character:hero", knowledgeRef: "knowledge:road" },
  ],
  then: [],
  enabled: true,
  provenance,
});

function projectFixture() {
  return {
    id: "project:history-proof",
    title: "History proof",
    extensions: {
      canonicalRevision: {
        version: 1,
        currentRevision: 12,
        proposals: [{ id: "canon:must-remain-separate" }],
        history: [],
      },
    },
  };
}

function characterDefinition() {
  return {
    id: "character:hero",
    schemaVersion: 1,
    worldId: "world:history-proof",
    name: "Mara",
    role: "seeker",
    identityRefs: ["identity:mara"],
    traitRefs: ["trait:curious"],
    provenance,
  };
}

function initialRuntime() {
  const ready = createFiveSceneStoryRuntime({
    sessionId: "session:history-proof",
    gameDefinitionId: "game:history-proof",
    worldId: "world:history-proof",
    worldRevisionRef: "world:history-proof@12",
    ppfProjectRef: "ppf:history-proof",
    resolutionLimits: { maximumOperationsPerScene: 12 },
    sceneDefinitions: Array.from({ length: 5 }, (_, index) => ({
      id: `scene:${index + 1}`,
      locationId: `location:${index + 1}`,
      objectiveRefs: [`objective:${index + 1}`],
      narrativeBudget: 4,
    })),
  });
  return transitionFiveSceneStoryRuntime(ready, "start-session").runtime;
}

function action(id, proposedAt) {
  return {
    id,
    sessionId: "session:history-proof",
    sceneId: "scene:1",
    actorRef: "player:history-proof",
    pieceId: null,
    operation: { kind: "adjust-number", ref: "score", delta: 1 },
    idempotencyKey: `idempotency:${id}`,
    proposedAt,
    proposalMetadata: {
      generatedExplanation: "proposal-only text must not become authoritative history",
      provider: "not-authority",
    },
  };
}

function accept(runtime, state, nextAction) {
  const result = reduceStoryActionWithRules({ runtime, state, action: nextAction, rules: [consequenceRule] });
  assert.equal(result.ok, true);
  assert.equal(result.status, "accepted");
  assert.equal(result.acceptedRuleEvents.length, 2);
  return result;
}

function persistTwo(timestampA, timestampB) {
  let project = persistStoryCharacterDefinition(projectFixture(), characterDefinition()).project;
  const canonicalBefore = structuredClone(project.extensions.canonicalRevision);
  const characterBefore = structuredClone(project.extensions.storyTheUnwritten.characterDefinitions);
  let runtime = initialRuntime();
  let state = createStoryMechanicalState({ values: { score: 0 } });

  const firstAction = action("action:first", timestampA);
  const first = accept(runtime, state, firstAction);
  const firstPersisted = persistAcceptedStoryTransaction(project, {
    action: firstAction,
    result: first,
    savedAt: "2026-09-04T08:31:00.000Z",
  });
  project = firstPersisted.project;
  runtime = first.runtime;
  state = first.state;

  const secondAction = action("action:second", timestampB);
  const second = accept(runtime, state, secondAction);
  const secondPersisted = persistAcceptedStoryTransaction(project, {
    action: secondAction,
    result: second,
    savedAt: "2026-09-04T08:32:00.000Z",
  });

  return {
    project: secondPersisted.project,
    runtime: second.runtime,
    state: second.state,
    firstAction,
    first,
    secondAction,
    second,
    canonicalBefore,
    characterBefore,
  };
}

test("#1675 Phase 2 persists one accepted action, ordered rule events and its exact checkpoint atomically", () => {
  const project = projectFixture();
  const runtime = initialRuntime();
  const state = createStoryMechanicalState({ values: { score: 0 } });
  const acceptedAction = action("action:one", "2026-09-04T08:31:11.000Z");
  const result = accept(runtime, state, acceptedAction);

  const persisted = persistAcceptedStoryTransaction(project, {
    action: acceptedAction,
    result,
    savedAt: "2026-09-04T08:31:12.000Z",
  });
  assert.equal(persisted.status, "stored");
  assert.equal(persisted.history.acceptedEventLogRef, result.runtime.session.acceptedEventLogRef);
  assert.deepEqual(persisted.history.actionOrder, [acceptedAction.id]);
  assert.deepEqual(persisted.history.eventOrder, [
    result.acceptedEvent.id,
    ...result.acceptedRuleEvents.map((event) => event.id),
  ]);
  assert.deepEqual(persisted.history.eventOrder.map((id) => persisted.history.acceptedEvents[id].sequence), [1, 2, 3]);
  assert.equal(persisted.history.latestCheckpointRef, result.runtime.session.latestCheckpointRef);
  assert.deepEqual(persisted.history.checkpoints[persisted.history.latestCheckpointRef], result.checkpoint);
  assert.equal(persisted.snapshot.runtime.session.stateRevision, 3);
  assert.equal(persisted.snapshot.mechanicalState.revision, 3);

  const storedAction = persisted.history.acceptedActions[acceptedAction.id];
  assert.equal("proposedAt" in storedAction, false);
  assert.equal("proposalMetadata" in storedAction, false);
  assert.doesNotMatch(JSON.stringify(persisted.history), /proposal-only text/);
});

test("#1675 Phase 2 accepted transactions append contiguously and close/reopen matches the latest checkpoint", () => {
  const proof = persistTwo("2026-09-04T08:33:00.000Z", "2026-09-04T08:34:00.000Z");
  const reopened = JSON.parse(JSON.stringify(proof.project));
  const historyResult = readStorySessionHistory(reopened, "session:history-proof");
  const resumed = resumeStorySessionFromProject(reopened, "session:history-proof");

  assert.equal(historyResult.ok, true);
  assert.equal(resumed.ok, true);
  const history = historyResult.history;
  assert.deepEqual(history.actionOrder, ["action:first", "action:second"]);
  assert.equal(history.eventOrder.length, 6);
  assert.deepEqual(history.eventOrder.map((id) => history.acceptedEvents[id].sequence), [1, 2, 3, 4, 5, 6]);
  assert.deepEqual(history.checkpointOrder.map((ref) => history.checkpoints[ref].revision), [3, 6]);
  assert.equal(history.latestCheckpointRef, proof.runtime.session.latestCheckpointRef);
  assert.deepEqual(resumed.runtime, proof.runtime);
  assert.deepEqual(resumed.state, proof.state);
  assert.equal(proof.state.revision, 6);
  assert.equal(proof.state.values.score, 2);
  assert.deepEqual(proof.project.extensions.canonicalRevision, proof.canonicalBefore);
  assert.deepEqual(proof.project.extensions.storyTheUnwritten.characterDefinitions, proof.characterBefore);
});

test("#1675 Phase 2 authoritative accepted history is identical when proposal timestamps differ", () => {
  const first = persistTwo("2026-09-04T08:35:00.000Z", "2026-09-04T08:36:00.000Z");
  const replay = persistTwo("2099-12-30T23:58:00.000Z", "2099-12-31T23:59:00.000Z");
  const firstHistory = readStorySessionHistory(first.project, "session:history-proof");
  const replayHistory = readStorySessionHistory(replay.project, "session:history-proof");

  assert.equal(firstHistory.ok, true);
  assert.equal(replayHistory.ok, true);
  assert.deepEqual(firstHistory.history, replayHistory.history);
  assert.deepEqual(first.state, replay.state);
});

test("#1675 Phase 2 persisting the same accepted transaction twice is an exact no-op", () => {
  const project = projectFixture();
  const acceptedAction = action("action:idempotent", "2026-09-04T08:37:00.000Z");
  const result = accept(initialRuntime(), createStoryMechanicalState({ values: { score: 0 } }), acceptedAction);
  const first = persistAcceptedStoryTransaction(project, {
    action: acceptedAction,
    result,
    savedAt: "2026-09-04T08:37:01.000Z",
  });
  const retry = persistAcceptedStoryTransaction(first.project, {
    action: { ...acceptedAction, proposedAt: "2099-12-31T23:59:59.999Z" },
    result,
    savedAt: "2099-12-31T23:59:59.999Z",
  });

  assert.equal(retry.status, "duplicate");
  assert.equal(retry.snapshot, null);
  assert.deepEqual(retry.project, first.project);
  assert.deepEqual(retry.history, first.history);
});

test("#1675 Phase 2 rejected or duplicate action results cannot enter accepted durable history", () => {
  const project = projectFixture();
  const acceptedAction = action("action:reject-proof", "2026-09-04T08:38:00.000Z");
  const accepted = accept(initialRuntime(), createStoryMechanicalState({ values: { score: 0 } }), acceptedAction);
  const stored = persistAcceptedStoryTransaction(project, {
    action: acceptedAction,
    result: accepted,
    savedAt: "2026-09-04T08:38:01.000Z",
  });
  const duplicate = reduceStoryActionWithRules({
    runtime: accepted.runtime,
    state: accepted.state,
    action: { ...acceptedAction, proposedAt: "2099-01-01T00:00:00.000Z" },
    rules: [consequenceRule],
  });
  assert.equal(duplicate.status, "duplicate");
  assert.throws(() => persistAcceptedStoryTransaction(stored.project, {
    action: acceptedAction,
    result: duplicate,
    savedAt: "2026-09-04T08:38:02.000Z",
  }), /only a complete accepted STORY action result can be persisted/);
  assert.throws(() => persistAcceptedStoryTransaction(stored.project, {
    action: acceptedAction,
    result: { ok: false, status: "illegal" },
    savedAt: "2026-09-04T08:38:03.000Z",
  }), /only a complete accepted STORY action result can be persisted/);
  assert.deepEqual(readStorySessionHistory(stored.project, "session:history-proof").history.actionOrder, [acceptedAction.id]);
});

test("#1675 Phase 2 conflicting accepted history cannot partially mutate the project", () => {
  const project = projectFixture();
  const acceptedAction = action("action:conflict", "2026-09-04T08:39:00.000Z");
  const result = accept(initialRuntime(), createStoryMechanicalState({ values: { score: 0 } }), acceptedAction);
  const stored = persistAcceptedStoryTransaction(project, {
    action: acceptedAction,
    result,
    savedAt: "2026-09-04T08:39:01.000Z",
  });
  const before = structuredClone(stored.project);
  const conflictingResult = structuredClone(result);
  conflictingResult.acceptedEvent.operation.delta = 9;

  assert.throws(() => persistAcceptedStoryTransaction(stored.project, {
    action: acceptedAction,
    result: conflictingResult,
    savedAt: "2026-09-04T08:39:02.000Z",
  }), /direct accepted event operation must equal action operation/);
  assert.deepEqual(stored.project, before);
});

test("#1675 Phase 2 corrupted event order, checkpoint linkage or snapshot linkage fails closed", () => {
  const proof = persistTwo("2026-09-04T08:40:00.000Z", "2026-09-04T08:41:00.000Z");

  const wrongOrder = structuredClone(proof.project);
  const history = wrongOrder.extensions.storyTheUnwritten.sessionHistories["session:history-proof"];
  [history.eventOrder[0], history.eventOrder[1]] = [history.eventOrder[1], history.eventOrder[0]];
  const wrongOrderResult = readStorySessionHistory(wrongOrder, "session:history-proof");
  assert.equal(wrongOrderResult.ok, false);
  assert.equal(wrongOrderResult.reason, "invalid-history");

  const wrongCheckpoint = structuredClone(proof.project);
  const checkpointHistory = wrongCheckpoint.extensions.storyTheUnwritten.sessionHistories["session:history-proof"];
  const checkpointRef = checkpointHistory.latestCheckpointRef;
  checkpointHistory.checkpoints[checkpointRef].lastAcceptedEventId = "story-event:wrong";
  const wrongCheckpointResult = readStorySessionHistory(wrongCheckpoint, "session:history-proof");
  assert.equal(wrongCheckpointResult.ok, false);
  assert.equal(wrongCheckpointResult.reason, "invalid-history");

  const wrongSnapshot = structuredClone(proof.project);
  wrongSnapshot.extensions.storyTheUnwritten.sessions["session:history-proof"].runtime.session.latestCheckpointRef = "story-checkpoint:wrong";
  const wrongSnapshotResult = readStorySessionHistory(wrongSnapshot, "session:history-proof");
  assert.equal(wrongSnapshotResult.ok, false);
  assert.equal(wrongSnapshotResult.reason, "invalid-history");
});
