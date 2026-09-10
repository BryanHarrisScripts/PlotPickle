import assert from "node:assert/strict";
import test from "node:test";

import {
  persistStoryCharacterDefinition,
  persistStoryCharacterState,
} from "../modules/story-the-unwritten/character-persistence.mjs";
import { persistStorySessionSnapshot } from "../modules/story-the-unwritten/project-persistence.mjs";
import { createStoryMechanicalState } from "../modules/story-the-unwritten/resolution.mjs";
import { loadStorySceneWorkingSet } from "../modules/story-the-unwritten/scene-working-set.mjs";
import { createFiveSceneStoryRuntime, transitionFiveSceneStoryRuntime } from "../modules/story-the-unwritten/session-machine.mjs";
import { persistStoryPiece } from "../modules/story-the-unwritten/story-piece-persistence.mjs";

const WORLD_ID = "world:scene-working-set";
const SESSION_ID = "session:scene-working-set";

function baseProject() {
  return {
    id: "project:scene-working-set",
    title: "Sparse scene working-set proof",
    characters: [{ id: "legacy:whole-world-character", biography: "must never enter STORY working set" }],
    extensions: {
      canonicalRevision: {
        version: 1,
        currentRevision: 4,
        proposals: [{ id: "canon:unrelated" }],
        history: [],
      },
    },
  };
}

function provenance(sourceRef) {
  return {
    authorship: "human",
    creatorRef: "human:creator",
    sourceRefs: [sourceRef],
    admittedByRef: null,
    admittedAt: null,
  };
}

function definition(id, name, role) {
  return {
    id,
    schemaVersion: 1,
    worldId: WORLD_ID,
    name,
    role,
    identityRefs: [`identity:${id}`],
    traitRefs: [`trait:${role}`],
    provenance: provenance(`ppf:${id}`),
  };
}

function state(characterId, locationId, eventId) {
  return {
    characterId,
    revision: 0,
    locationId,
    conditionRefs: [],
    objectiveRefs: ["objective:escape"],
    inventoryRefs: [],
    knowledgeRefs: [],
    relationshipEdgeRefs: [],
    memoryCursor: null,
    updatedByEventId: eventId,
  };
}

function piece(id, type, title) {
  return {
    id,
    schemaVersion: 1,
    type,
    title,
    description: `${title} description`,
    worldId: WORLD_ID,
    schools: type === "conflict" ? ["conflict"] : ["world"],
    tags: ["proof"],
    visibility: "private",
    stateRefs: [],
    ruleIds: [],
    relationshipIds: [],
    assetRefs: [],
    agentBinding: null,
    curriculumRefs: [],
    provenance: provenance(`source:${id}`),
    createdAt: "2026-09-04T12:00:00.000Z",
    updatedAt: "2026-09-04T12:00:00.000Z",
  };
}

function activeRuntime() {
  const ready = createFiveSceneStoryRuntime({
    sessionId: SESSION_ID,
    gameDefinitionId: "game:scene-working-set",
    worldId: WORLD_ID,
    worldRevisionRef: `${WORLD_ID}@4`,
    ppfProjectRef: "ppf:scene-working-set",
    sceneDefinitions: [
      {
        id: "scene:1",
        participantIds: ["character:hero", "character:rival"],
        locationId: "location:crossroads",
        objectiveRefs: ["objective:escape"],
        activeConflictIds: ["conflict:storm"],
        unresolvedThreadRefs: ["thread:missing-map"],
        narrativeBudget: 4,
      },
      ...Array.from({ length: 4 }, (_, index) => ({
        id: `scene:${index + 2}`,
        participantIds: ["character:cold"],
        locationId: `location:cold-${index + 2}`,
        objectiveRefs: [`objective:cold-${index + 2}`],
        activeConflictIds: [`conflict:cold-${index + 2}`],
        unresolvedThreadRefs: [],
        narrativeBudget: 4,
      })),
    ],
  });
  return transitionFiveSceneStoryRuntime(ready, "start-session").runtime;
}

function persistedLocalSceneProject() {
  let project = baseProject();
  project = persistStoryCharacterDefinition(project, definition("character:hero", "Mara", "seeker")).project;
  project = persistStoryCharacterDefinition(project, definition("character:rival", "Orin", "rival")).project;
  project = persistStoryCharacterDefinition(project, definition("character:cold", "Vela", "observer")).project;
  project = persistStoryCharacterState(project, state("character:hero", "location:crossroads", "event:hero-spawn")).project;
  project = persistStoryCharacterState(project, state("character:rival", "location:crossroads", "event:rival-spawn")).project;
  project = persistStoryPiece(project, piece("location:crossroads", "location", "The Crossroads")).project;
  project = persistStoryPiece(project, piece("conflict:storm", "conflict", "The Storm")).project;
  project = persistStorySessionSnapshot(project, {
    runtime: activeRuntime(),
    state: createStoryMechanicalState(),
    savedAt: "2026-09-04T12:05:00.000Z",
  }).project;
  return project;
}

test("#1675 Phase 2 scene hydration loads only the active local working set", () => {
  const project = persistedLocalSceneProject();
  const loaded = loadStorySceneWorkingSet(project, SESSION_ID);

  assert.equal(loaded.ok, true);
  assert.equal(loaded.scene.id, "scene:1");
  assert.deepEqual(loaded.participants.map((participant) => participant.characterId), ["character:hero", "character:rival"]);
  assert.equal(loaded.location.id, "location:crossroads");
  assert.deepEqual(loaded.conflicts.map((conflict) => conflict.id), ["conflict:storm"]);
  assert.deepEqual(loaded.objectiveRefs, ["objective:escape"]);
  assert.deepEqual(loaded.unresolvedThreadRefs, ["thread:missing-map"]);

  const serialized = JSON.stringify(loaded);
  assert.doesNotMatch(serialized, /character:cold/);
  assert.doesNotMatch(serialized, /location:cold-/);
  assert.doesNotMatch(serialized, /conflict:cold-/);
  assert.doesNotMatch(serialized, /legacy:whole-world-character/);
  assert.doesNotMatch(serialized, /canon:unrelated/);
});

test("#1675 Phase 2 unrelated cold-world corruption cannot block active scene hydration", () => {
  const project = persistedLocalSceneProject();
  project.extensions.storyTheUnwritten.characterStates["character:cold"] = {
    corrupt: { biography: "giant cold character payload" },
  };
  project.extensions.storyTheUnwritten.memoryEvents["character:cold"] = {
    corrupt: { prompt: "cold prompt payload" },
  };
  project.extensions.storyTheUnwritten.storyPieces["location:cold-2"] = {
    id: "location:cold-2",
    biography: "corrupt unrelated location payload",
  };

  const loaded = loadStorySceneWorkingSet(project, SESSION_ID);
  assert.equal(loaded.ok, true);
  const serialized = JSON.stringify(loaded);
  assert.doesNotMatch(serialized, /giant cold character payload/);
  assert.doesNotMatch(serialized, /cold prompt payload/);
  assert.doesNotMatch(serialized, /corrupt unrelated location payload/);
});

test("#1675 Phase 2 requested local corruption fails closed instead of returning a partial scene", () => {
  const missingParticipant = persistedLocalSceneProject();
  missingParticipant.extensions.storyTheUnwritten.characterStates["character:hero"]["0"].biography = "invalid local payload";
  const participantResult = loadStorySceneWorkingSet(missingParticipant, SESSION_ID);
  assert.equal(participantResult.ok, false);
  assert.equal(participantResult.reason, "invalid-local-working-set");
  assert.equal(participantResult.participants.length, 0);
  assert.ok(participantResult.errors.some((error) => error.includes("participant character:hero")));

  const wrongLocation = persistedLocalSceneProject();
  wrongLocation.extensions.storyTheUnwritten.storyPieces["location:crossroads"].type = "object";
  const locationResult = loadStorySceneWorkingSet(wrongLocation, SESSION_ID);
  assert.equal(locationResult.ok, false);
  assert.equal(locationResult.reason, "invalid-local-working-set");
  assert.ok(locationResult.errors.some((error) => error.includes("must be a location Story Piece")));
});

test("#1675 Phase 2 loader does not materialize later scene neighborhoods merely because they are referenced by the session", () => {
  const project = persistedLocalSceneProject();
  const loaded = loadStorySceneWorkingSet(project, SESSION_ID);
  assert.equal(loaded.ok, true);
  assert.equal(loaded.participants.length, 2);
  assert.equal(loaded.conflicts.length, 1);

  const later = loadStorySceneWorkingSet(project, SESSION_ID, "scene:2");
  assert.equal(later.ok, false);
  assert.equal(later.reason, "invalid-local-working-set");
  assert.ok(later.errors.some((error) => error.includes("character:cold") || error.includes("location:cold-2")));
});
