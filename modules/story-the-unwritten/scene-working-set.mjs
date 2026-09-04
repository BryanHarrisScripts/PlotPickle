import { readStoryCharacterBundle } from "./character-persistence.mjs";
import { loadStorySessionSnapshot } from "./project-persistence.mjs";
import { loadStoryPiece } from "./story-piece-persistence.mjs";

function isReference(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function failure(reason, errors = []) {
  return {
    ok: false,
    reason,
    sessionId: null,
    scene: null,
    participants: [],
    location: null,
    conflicts: [],
    objectiveRefs: [],
    unresolvedThreadRefs: [],
    errors,
  };
}

function loadTypedPiece(project, pieceId, expectedType, worldId, label) {
  const loaded = loadStoryPiece(project, pieceId);
  if (!loaded.ok || !loaded.piece) {
    return {
      ok: false,
      error: `${label} ${pieceId} could not be loaded${loaded.errors.length ? `: ${loaded.errors.join("; ")}` : ""}`,
      piece: null,
    };
  }
  if (loaded.piece.type !== expectedType) {
    return { ok: false, error: `${label} ${pieceId} must be a ${expectedType} Story Piece`, piece: null };
  }
  if (loaded.piece.worldId !== worldId) {
    return { ok: false, error: `${label} ${pieceId} belongs to a different Story World`, piece: null };
  }
  return { ok: true, error: null, piece: loaded.piece };
}

export function loadStorySceneWorkingSet(project, sessionId, sceneId = null) {
  if (!isReference(sessionId)) return failure("invalid-session-id", ["session id is required"]);
  if (sceneId !== null && !isReference(sceneId)) return failure("invalid-scene-id", ["scene id must be null or a reference"]);

  const loadedSession = loadStorySessionSnapshot(project, sessionId);
  if (!loadedSession.ok || !loadedSession.snapshot) {
    return failure("session-unavailable", loadedSession.errors ?? []);
  }

  const runtime = loadedSession.snapshot.runtime;
  const targetSceneId = sceneId ?? runtime.session.currentSceneId;
  if (!isReference(targetSceneId)) {
    return failure("scene-unavailable", ["session does not identify a scene to hydrate"]);
  }
  const scene = runtime.scenes.find((candidate) => candidate.id === targetSceneId);
  if (!scene) return failure("scene-unavailable", [`scene ${targetSceneId} is not part of session ${sessionId}`]);

  const errors = [];
  const participants = [];
  for (const characterId of scene.participantIds) {
    const bundle = readStoryCharacterBundle(project, characterId);
    if (!bundle.ok || !bundle.definition || !bundle.currentState) {
      errors.push(`participant ${characterId} could not be hydrated${bundle.errors.length ? `: ${bundle.errors.join("; ")}` : ""}`);
      continue;
    }
    if (bundle.definition.worldId !== runtime.session.worldId) {
      errors.push(`participant ${characterId} belongs to a different Story World`);
      continue;
    }
    participants.push({
      characterId,
      definition: bundle.definition,
      currentState: bundle.currentState,
      memoryEvents: bundle.memoryEvents,
      relationshipEdges: bundle.relationshipEdges,
    });
  }

  const locationResult = loadTypedPiece(project, scene.locationId, "location", runtime.session.worldId, "location");
  if (!locationResult.ok) errors.push(locationResult.error);

  const conflicts = [];
  for (const conflictId of scene.activeConflictIds) {
    const conflictResult = loadTypedPiece(project, conflictId, "conflict", runtime.session.worldId, "conflict");
    if (!conflictResult.ok) errors.push(conflictResult.error);
    else conflicts.push(conflictResult.piece);
  }

  if (errors.length) return failure("invalid-local-working-set", errors);

  participants.sort((left, right) => left.characterId.localeCompare(right.characterId));
  conflicts.sort((left, right) => left.id.localeCompare(right.id));
  return {
    ok: true,
    reason: null,
    sessionId,
    scene: cloneJson(scene),
    participants,
    location: locationResult.piece,
    conflicts,
    objectiveRefs: [...scene.objectiveRefs],
    unresolvedThreadRefs: [...scene.unresolvedThreadRefs],
    errors: [],
  };
}
