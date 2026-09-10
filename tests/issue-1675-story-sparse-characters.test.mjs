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

function definition(id, name, role) {
  return {
    id,
    schemaVersion: 1,
    worldId: "world:sparse-proof",
    name,
    role,
    identityRefs: [`identity:${name.toLowerCase()}`],
    traitRefs: [`trait:${role}`],
    provenance: provenance(),
  };
}

function heroDefinition() {
  return definition("character:hero", "Mara", "seeker");
}

function rivalDefinition() {
  return definition("character:rival", "Orin", "rival");
}

function coldDefinition() {
  return definition("character:cold", "Vela", "observer");
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
    relationshipEdgeRefs: [],
    memoryCursor: revision === 0 ? null : "memory:2",
    updatedByEventId: eventId,
    ...overrides,
  };
}

function memory(id, eventRef, recordedAt, visibility = "remembered") {
  return { id, characterId: "character:hero", eventRef, visibility, recordedAt };
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
  return {
    runtime: transitionFiveSceneStoryRuntime(ready, "start-session").runtime,
    state: createStoryMechanicalState(),
  };
}

test("#1675 Phase 2 persists sparse character definitions and rejects attached biography or host-agent payloads", () => {
  const original = projectFixture();
  const first = persistStoryCharacterDefinition(original, heroDefinition());
  const duplicate = persistStoryCharacterDefinition(first.project, heroDefinition());

  assert.equal(first.status, "stored");
  assert.equal(duplicate.status, "duplicate");
  assert.deepEqual(duplicate.project.extensions.storyTheUnwritten.characterDefinitions["character:hero"], heroDefinition());
  assert.deepEqual(duplicate.project.extensions.canonicalRevision, original.extensions.canonicalRevision);

  for (const field of ["biography", "dialogue", "prompt", "agent"]) {
    const invalid = { ...heroDefinition(), [field]: "must not persist here" };
    const validation = validateStoryCharacterDefinition(invalid);
    assert.equal(validation.ok, false);
    assert.ok(validation.errors.some((error) => error.includes(`unsupported field ${field}`)));
    assert.throws(() => persistStoryCharacterDefinition(first.project, invalid), new RegExp(`unsupported field ${field}`));
  }
});

test("#1675 Phase 2 character states are revision-addressed and immutable per revision", () => {
  let project = persistStoryCharacterDefinition(projectFixture(), heroDefinition()).project;
  const state0 = heroState(0, "event:spawn");
  const state1 = heroState(1, "event:crossroads");

  project = persistStoryCharacterState(project, state0).project;
  const duplicate = persistStoryCharacterState(project, structuredClone(state0));
  assert.equal(duplicate.status, "duplicate");
  project = persistStoryCharacterState(duplicate.project, state1).project;

  assert.equal(storyCharacterStateKey("character:hero", 1), "character:hero@1");
  assert.deepEqual(Object.keys(project.extensions.storyTheUnwritten.characterStates["character:hero"]).sort(), ["0", "1"]);
  assert.throws(() => persistStoryCharacterState(project, { ...state1, locationId: "location:elsewhere" }), /already exists with different content/);

  const bundle = readStoryCharacterBundle(JSON.parse(JSON.stringify(project)), "character:hero");
  assert.equal(bundle.ok, true);
  assert.deepEqual(bundle.states.map((state) => state.revision), [0, 1]);
  assert.deepEqual(bundle.currentState, state1);
});

test("#1675 Phase 2 memory ledger is per-character, append-only and deterministically ordered", () => {
  let project = persistStoryCharacterDefinition(projectFixture(), heroDefinition()).project;
  const later = memory("memory:2", "event:two", "2026-09-04T08:02:00.000Z");
  const earlier = memory("memory:1", "event:one", "2026-09-04T08:01:00.000Z");

  project = appendStoryMemoryEvent(project, later).project;
  project = appendStoryMemoryEvent(project, earlier).project;
  assert.equal(appendStoryMemoryEvent(project, structuredClone(earlier)).status, "duplicate");
  assert.throws(() => appendStoryMemoryEvent(project, { ...earlier, visibility: "forgotten" }), /already exists with different content/);

  const bundle = readStoryCharacterBundle(JSON.parse(JSON.stringify(project)), "character:hero");
  assert.equal(bundle.ok, true);
  assert.deepEqual(bundle.memoryEvents.map((event) => event.id), ["memory:1", "memory:2"]);
});

test("#1675 Phase 2 relationship edges use reference-only character indexes and reject stale updates", () => {
  let project = projectFixture();
  project = persistStoryCharacterDefinition(project, heroDefinition()).project;
  project = persistStoryCharacterDefinition(project, rivalDefinition()).project;

  const initial = relationship(0, "event:relationship-created");
  const stored = persistStoryRelationshipEdge(project, initial);
  assert.equal(stored.status, "stored");
  assert.deepEqual(stored.project.extensions.storyTheUnwritten.relationshipEdges.byCharacter["character:hero"], [initial.id]);
  assert.deepEqual(stored.project.extensions.storyTheUnwritten.relationshipEdges.byCharacter["character:rival"], [initial.id]);
  assert.deepEqual(stored.project.extensions.storyTheUnwritten.relationshipEdges.records[initial.id], initial);
  assert.equal(persistStoryRelationshipEdge(stored.project, structuredClone(initial)).status, "duplicate");

  const updated = relationship(2, "event:trust-grew");
  assert.throws(() => persistStoryRelationshipEdge(stored.project, updated), /stale or missing expectedUpdatedByEventId/);
  assert.throws(() => persistStoryRelationshipEdge(stored.project, updated, { expectedUpdatedByEventId: "event:wrong" }), /stale or missing expectedUpdatedByEventId/);

  const accepted = persistStoryRelationshipEdge(stored.project, updated, {
    expectedUpdatedByEventId: "event:relationship-created",
  });
  assert.equal(accepted.status, "updated");
  assert.equal(accepted.project.extensions.storyTheUnwritten.relationshipEdges.records[initial.id].value, 2);

  const identityChange = { ...relationship(3, "event:bad-change"), kind: "fear" };
  assert.throws(() => persistStoryRelationshipEdge(accepted.project, identityChange, {
    expectedUpdatedByEventId: "event:trust-grew",
  }), /identity fields are immutable/);
});

test("#1675 Phase 2 one-character hydration follows only that character's buckets and relationship refs", () => {
  let project = projectFixture();
  project = persistStoryCharacterDefinition(project, heroDefinition()).project;
  project = persistStoryCharacterDefinition(project, rivalDefinition()).project;
  project = persistStoryCharacterDefinition(project, coldDefinition()).project;
  project = persistStoryRelationshipEdge(project, relationship(0, "event:relationship-created")).project;
  project = persistStoryCharacterState(project, heroState(0, "event:spawn", {
    relationshipEdgeRefs: ["relationship:hero-rival"],
  })).project;
  project = appendStoryMemoryEvent(project, memory("memory:1", "event:one", "2026-09-04T08:01:00.000Z")).project;

  const coldBucket = {
    0: {
      characterId: "character:cold",
      revision: 0,
      biography: "corrupted cold payload that must remain untouched",
    },
  };
  project.extensions.storyTheUnwritten.characterStates["character:cold"] = coldBucket;
  project.extensions.storyTheUnwritten.memoryEvents["character:cold"] = { corrupt: { biography: "not loaded" } };

  const bundle = readStoryCharacterBundle(project, "character:hero");
  assert.equal(bundle.ok, true);
  assert.equal(bundle.definition.id, "character:hero");
  assert.equal(bundle.states.length, 1);
  assert.equal(bundle.memoryEvents.length, 1);
  assert.equal(bundle.relationshipEdges.length, 1);
  const serialized = JSON.stringify(bundle);
  assert.doesNotMatch(serialized, /corrupted cold payload/);
  assert.doesNotMatch(serialized, /whole project character payload/);
  assert.doesNotMatch(serialized, /canon:proposal:must-stay-separate/);
});

test("#1675 Phase 2 later session persistence preserves sparse character stores byte-for-byte", () => {
  let project = projectFixture();
  project = persistStoryCharacterDefinition(project, heroDefinition()).project;
  project = persistStoryCharacterState(project, heroState(0, "event:spawn")).project;
  project = appendStoryMemoryEvent(project, memory("memory:1", "event:one", "2026-09-04T08:01:00.000Z")).project;
  project = persistStoryRelationshipEdge(project, relationship(0, "event:relationship-created")).project;

  const before = structuredClone(project.extensions.storyTheUnwritten);
  const { runtime, state } = activeRuntimeAndState();
  const saved = persistStorySessionSnapshot(project, { runtime, state, savedAt: "2026-09-04T08:03:00.000Z" });

  assert.deepEqual(saved.project.extensions.storyTheUnwritten.characterDefinitions, before.characterDefinitions);
  assert.deepEqual(saved.project.extensions.storyTheUnwritten.characterStates, before.characterStates);
  assert.deepEqual(saved.project.extensions.storyTheUnwritten.memoryEvents, before.memoryEvents);
  assert.deepEqual(saved.project.extensions.storyTheUnwritten.relationshipEdges, before.relationshipEdges);
  assert.ok(saved.project.extensions.storyTheUnwritten.sessions["session:sparse-proof"]);
});

test("#1675 Phase 2 corruption in requested character records is rejected instead of partially hydrated", () => {
  let project = persistStoryCharacterDefinition(projectFixture(), heroDefinition()).project;
  project = persistStoryCharacterState(project, heroState(0, "event:spawn")).project;

  const wrongRevision = structuredClone(project);
  wrongRevision.extensions.storyTheUnwritten.characterStates["character:hero"]["999"] = wrongRevision.extensions.storyTheUnwritten.characterStates["character:hero"]["0"];
  delete wrongRevision.extensions.storyTheUnwritten.characterStates["character:hero"]["0"];
  const wrongRevisionBundle = readStoryCharacterBundle(wrongRevision, "character:hero");
  assert.equal(wrongRevisionBundle.ok, false);
  assert.equal(wrongRevisionBundle.reason, "invalid-character-store");
  assert.ok(wrongRevisionBundle.errors.some((error) => error.includes("wrong character or revision")));

  const attachedPayload = structuredClone(project);
  attachedPayload.extensions.storyTheUnwritten.characterDefinitions["character:hero"].dialogue = ["hidden payload"];
  const attachedPayloadBundle = readStoryCharacterBundle(attachedPayload, "character:hero");
  assert.equal(attachedPayloadBundle.ok, false);
  assert.equal(attachedPayloadBundle.reason, "invalid-character-store");
  assert.ok(attachedPayloadBundle.errors.some((error) => error.includes("unsupported field dialogue")));

  const missingRelationship = structuredClone(project);
  missingRelationship.extensions.storyTheUnwritten.characterStates["character:hero"]["0"].relationshipEdgeRefs = ["relationship:missing"];
  const missingRelationshipBundle = readStoryCharacterBundle(missingRelationship, "character:hero");
  assert.equal(missingRelationshipBundle.ok, false);
  assert.ok(missingRelationshipBundle.errors.some((error) => error.includes("references missing relationship edge")));
});
