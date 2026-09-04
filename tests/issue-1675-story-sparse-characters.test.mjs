import assert from "node:assert/strict";
import test from "node:test";

import {
  appendStoryMemoryEvent,
  persistStoryCharacterDefinition,
  persistStoryCharacterState,
  persistStoryRelationshipEdge,
  readStoryCharacterBundle,
  storyCharacterStateKey,
  validateStoryCharacterDefinition,
} from "../modules/story-the-unwritten/character-persistence.mjs";
import { persistStorySessionSnapshot } from "../modules/story-the-unwritten/project-persistence.mjs";
import { createStoryMechanicalState } from "../modules/story-the-unwritten/resolution.mjs";
import { createFiveSceneStoryRuntime, transitionFiveSceneStoryRuntime } from "../modules/story-the-unwritten/session-machine.mjs";

function projectFixture() {
  return {
    id: "project:sparse-character-proof",
    title: "Sparse character proof",
    characters: [{ id: "legacy:large-character", biography: "whole project character payload" }],
    extensions: {
      canonicalRevision: {
        version: 1,
        currentRevision: 11,
        proposals: [{ id: "canon:proposal:must-stay-separate" }],
        history: [],
      },
    },
  };
}

function provenance() {
  return {
    authorship: "human",
    creatorRef: "human:creator",
    sourceRefs: ["ppf:character:hero"],
    admittedByRef: "canon-admission:hero",
    admittedAt: "2026-09-04T08:00:00.000Z",
  };
}

function heroDefinition() {
  return {
    id: "character:hero",
    schemaVersion: 1,
    worldId: "world:sparse-proof",
    name: "Mara",
    role: "seeker",
    identityRefs: ["identity:mara"],
    traitRefs: ["trait:stubborn", "trait:curious"],
    provenance: provenance(),
  };
}

function rivalDefinition() {
  return {
    id: "character:rival",
    schemaVersion: 1,
    worldId: "world:sparse-proof",
    name: "Orin",
    role: "rival",
    identityRefs: ["identity:orin"],
    traitRefs: ["trait:guarded"],
    provenance: provenance(),
  };
}

function heroState(revision, eventId, overrides = {}) {
  return {
    characterId: "character:hero",
    revision,
    locationId: revision === 0 ? "location:gate" : "location:crossroads",
    conditionRefs: [],
    objectiveRefs: ["objective:find-road"],
    inventoryRefs: revision === 0 ? [] : ["object:key"],
    knowledgeRefs: revision === 0 ? [] : ["knowledge:road"],
    relationshipEdgeRefs: ["relationship:hero-rival"],
    memoryCursor: revision === 0 ? null : "memory:2",
    updatedByEventId: eventId,
    ...overrides,
  };
}

function memory(id, eventRef, recordedAt, visibility = "remembered") {
  return {
    id,
    characterId: "character:hero",
    eventRef,
    visibility,
    recordedAt,
  };
}

function relationship(value, updatedByEventId) {
  return {
    id: "relationship:hero-rival",
    fromCharacterId: "character:hero",
    toCharacterId: "character:rival",
    kind: "trust",
    value,
    historyIndexRef: "relationship-history:hero-rival",
    updatedByEventId,
  };
}

function activeRuntimeAndState() {
  const ready = createFiveSceneStoryRuntime({
    sessionId: "session:sparse-proof",
    gameDefinitionId: "game:sparse-proof",
    worldId: "world:sparse-proof",
    worldRevisionRef: "world:sparse-proof@11",
    ppfProjectRef: "ppf:sparse-proof",
    sceneDefinitions: Array.from({ length: 5 }, (_, index) => ({
      id: `scene:${index + 1}`,
      locationId: `location:${index + 1}`,
      objectiveRefs: [`objective:${index + 1}`],
      narrativeBudget: 4,
    })),
  });
  const runtime = transitionFiveSceneStoryRuntime(ready, "start-session").runtime;
  const state = createStoryMechanicalState();
  return { runtime, state };
}

test("#1675 Phase 2 persists sparse character definition and rejects attached biography or host-agent payloads", () => {
  const definition = heroDefinition();
  const first = persistStoryCharacterDefinition(projectFixture(), definition);
  const duplicate = persistStoryCharacterDefinition(first.project, structuredClone(definition));

  assert.equal(first.status, "stored");
  assert.equal(duplicate.status, "duplicate");
  assert.deepEqual(duplicate.project.extensions.storyTheUnwritten.characterDefinitions["character:hero"], definition);
  assert.equal("biography" in definition, false);
  assert.equal("prompt" in definition, false);
  assert.equal("agent" in definition, false);
  assert.deepEqual(duplicate.project.extensions.canonicalRevision, projectFixture().extensions.canonicalRevision);

  const invalid = { ...definition, biography: "must stay in canonical/project-owned data" };
  const validation = validateStoryCharacterDefinition(invalid);
  assert.equal(validation.ok, false);
  assert.ok(validation.errors.some((error) => error.includes("unsupported field biography")));
  assert.throws(() => persistStoryCharacterDefinition(first.project, invalid), /unsupported field biography/);
});

test("#1675 Phase 2 character states are revision-addressed, immutable per revision and resume with the latest revision", () => {
  let project = persistStoryCharacterDefinition(projectFixture(), heroDefinition()).project;
  const state0 = heroState(0, "event:spawn");
  const state1 = heroState(1, "event:crossroads");

  project = persistStoryCharacterState(project, state0).project;
  const duplicate = persistStoryCharacterState(project, structuredClone(state0));
  assert.equal(duplicate.status, "duplicate");
  project = persistStoryCharacterState(duplicate.project, state1).project;

  assert.equal(storyCharacterStateKey("character:hero", 1), "character:hero@1");
  assert.deepEqual(Object.keys(project.extensions.storyTheUnwritten.characterStates).sort(), ["character:hero@0", "character:hero@1"]);

  const conflict = { ...state1, locationId: "location:elsewhere" };
  assert.throws(() => persistStoryCharacterState(project, conflict), /already exists with different content/);

  const reopened = JSON.parse(JSON.stringify(project));
  const bundle = readStoryCharacterBundle(reopened, "character:hero");
  assert.equal(bundle.ok, true);
  assert.deepEqual(bundle.states.map((state) => state.revision), [0, 1]);
  assert.deepEqual(bundle.currentState, state1);
});

test("#1675 Phase 2 memory ledger is append-only, replay-idempotent and deterministically ordered", () => {
  let project = persistStoryCharacterDefinition(projectFixture(), heroDefinition()).project;
  const later = memory("memory:2", "event:two", "2026-09-04T08:02:00.000Z");
  const earlier = memory("memory:1", "event:one", "2026-09-04T08:01:00.000Z");

  project = appendStoryMemoryEvent(project, later).project;
  project = appendStoryMemoryEvent(project, earlier).project;
  const duplicate = appendStoryMemoryEvent(project, structuredClone(earlier));
  assert.equal(duplicate.status, "duplicate");

  assert.throws(() => appendStoryMemoryEvent(project, { ...earlier, visibility: "forgotten" }), /already exists with different content/);

  const bundle = readStoryCharacterBundle(JSON.parse(JSON.stringify(project)), "character:hero");
  assert.equal(bundle.ok, true);
  assert.deepEqual(bundle.memoryEvents.map((event) => event.id), ["memory:1", "memory:2"]);
});

test("#1675 Phase 2 relationship edges stay sparse and reject stale or identity-changing updates", () => {
  let project = projectFixture();
  project = persistStoryCharacterDefinition(project, heroDefinition()).project;
  project = persistStoryCharacterDefinition(project, rivalDefinition()).project;

  const initial = relationship(0, "event:relationship-created");
  const stored = persistStoryRelationshipEdge(project, initial);
  assert.equal(stored.status, "stored");

  const duplicate = persistStoryRelationshipEdge(stored.project, structuredClone(initial));
  assert.equal(duplicate.status, "duplicate");

  const updated = relationship(2, "event:trust-grew");
  assert.throws(() => persistStoryRelationshipEdge(stored.project, updated), /stale or missing expectedUpdatedByEventId/);
  assert.throws(() => persistStoryRelationshipEdge(stored.project, updated, { expectedUpdatedByEventId: "event:wrong" }), /stale or missing expectedUpdatedByEventId/);

  const acceptedUpdate = persistStoryRelationshipEdge(stored.project, updated, {
    expectedUpdatedByEventId: "event:relationship-created",
  });
  assert.equal(acceptedUpdate.status, "updated");
  assert.equal(acceptedUpdate.project.extensions.storyTheUnwritten.relationshipEdges[initial.id].value, 2);

  const identityChange = { ...relationship(3, "event:bad-change"), kind: "fear" };
  assert.throws(() => persistStoryRelationshipEdge(acceptedUpdate.project, identityChange, {
    expectedUpdatedByEventId: "event:trust-grew",
  }), /identity fields are immutable/);
});

test("#1675 Phase 2 character bundle contains only one character's sparse records and relationship references", () => {
  let project = projectFixture();
  project = persistStoryCharacterDefinition(project, heroDefinition()).project;
  project = persistStoryCharacterDefinition(project, rivalDefinition()).project;
  project = persistStoryCharacterState(project, heroState(0, "event:spawn")).project;
  project = appendStoryMemoryEvent(project, memory("memory:1", "event:one", "2026-09-04T08:01:00.000Z")).project;
  project = persistStoryRelationshipEdge(project, relationship(0, "event:relationship-created")).project;

  const bundle = readStoryCharacterBundle(project, "character:hero");
  assert.equal(bundle.ok, true);
  assert.equal(bundle.definition.id, "character:hero");
  assert.equal(bundle.states.length, 1);
  assert.equal(bundle.memoryEvents.length, 1);
  assert.equal(bundle.relationshipEdges.length, 1);

  const serialized = JSON.stringify(bundle);
  assert.doesNotMatch(serialized, /whole project character payload/);
  assert.doesNotMatch(serialized, /canon:proposal:must-stay-separate/);
});

test("#1675 Phase 2 later session persistence preserves all sparse character stores", () => {
  let project = projectFixture();
  project = persistStoryCharacterDefinition(project, heroDefinition()).project;
  project = persistStoryCharacterState(project, heroState(0, "event:spawn")).project;
  project = appendStoryMemoryEvent(project, memory("memory:1", "event:one", "2026-09-04T08:01:00.000Z")).project;
  project = persistStoryRelationshipEdge(project, relationship(0, "event:relationship-created")).project;

  const before = structuredClone(project.extensions.storyTheUnwritten);
  const { runtime, state } = activeRuntimeAndState();
  const saved = persistStorySessionSnapshot(project, {
    runtime,
    state,
    savedAt: "2026-09-04T08:03:00.000Z",
  });

  assert.deepEqual(saved.project.extensions.storyTheUnwritten.characterDefinitions, before.characterDefinitions);
  assert.deepEqual(saved.project.extensions.storyTheUnwritten.characterStates, before.characterStates);
  assert.deepEqual(saved.project.extensions.storyTheUnwritten.memoryEvents, before.memoryEvents);
  assert.deepEqual(saved.project.extensions.storyTheUnwritten.relationshipEdges, before.relationshipEdges);
  assert.ok(saved.project.extensions.storyTheUnwritten.sessions["session:sparse-proof"]);
});

test("#1675 Phase 2 corrupted character stores are rejected instead of partially hydrated", () => {
  let project = persistStoryCharacterDefinition(projectFixture(), heroDefinition()).project;
  project = persistStoryCharacterState(project, heroState(0, "event:spawn")).project;

  const wrongKey = structuredClone(project);
  wrongKey.extensions.storyTheUnwritten.characterStates["character:hero@999"] = wrongKey.extensions.storyTheUnwritten.characterStates["character:hero@0"];
  delete wrongKey.extensions.storyTheUnwritten.characterStates["character:hero@0"];
  const wrongKeyBundle = readStoryCharacterBundle(wrongKey, "character:hero");
  assert.equal(wrongKeyBundle.ok, false);
  assert.equal(wrongKeyBundle.reason, "invalid-character-store");
  assert.ok(wrongKeyBundle.errors.some((error) => error.includes("indexed under the wrong key")));

  const attachedPayload = structuredClone(project);
  attachedPayload.extensions.storyTheUnwritten.characterDefinitions["character:hero"].dialogue = ["hidden payload"];
  const attachedPayloadBundle = readStoryCharacterBundle(attachedPayload, "character:hero");
  assert.equal(attachedPayloadBundle.ok, false);
  assert.equal(attachedPayloadBundle.reason, "invalid-character-store");
  assert.ok(attachedPayloadBundle.errors.some((error) => error.includes("unsupported field dialogue")));
});
