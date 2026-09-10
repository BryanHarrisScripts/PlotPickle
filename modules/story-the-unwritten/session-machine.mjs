import { validateStorySceneTransition } from "./contract-invariants.mjs";
import { normalizeStoryResolutionLimits } from "./resolution.mjs";

export const STORY_FIVE_SCENE_COUNT = 5;

const STORY_STATE_ZONES = Object.freeze([
  "available",
  "active-scene",
  "world",
  "custody",
  "hidden-knowledge",
  "unresolved-threads",
  "resolved-history",
]);

function requiredReference(value, field) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${field} must be a non-empty reference`);
  return value;
}

function sessionFailure(code, message, runtime) {
  return { ok: false, runtime, failure: { code, message } };
}

function validateSceneDefinitions(sceneDefinitions) {
  if (!Array.isArray(sceneDefinitions) || sceneDefinitions.length !== STORY_FIVE_SCENE_COUNT) {
    throw new Error(`five-scene session requires exactly ${STORY_FIVE_SCENE_COUNT} scene definitions`);
  }
  const ids = new Set();
  return sceneDefinitions.map((definition, index) => {
    const id = requiredReference(definition?.id, `sceneDefinitions[${index}].id`);
    if (ids.has(id)) throw new Error(`duplicate scene id: ${id}`);
    ids.add(id);
    return {
      id,
      ordinal: index + 1,
      status: "ready",
      participantIds: [...new Set(definition.participantIds || [])],
      locationId: requiredReference(definition.locationId, `sceneDefinitions[${index}].locationId`),
      objectiveRefs: [...new Set(definition.objectiveRefs || [])],
      activeConflictIds: [...new Set(definition.activeConflictIds || [])],
      unresolvedThreadRefs: [...new Set(definition.unresolvedThreadRefs || [])],
      narrativeBudget: Number.isSafeInteger(definition.narrativeBudget) && definition.narrativeBudget > 0
        ? definition.narrativeBudget
        : 1,
      operationsUsed: 0,
      checkpointRef: `story-checkpoint:${id}:0`,
    };
  });
}

export function createFiveSceneStoryRuntime({
  sessionId,
  gameDefinitionId,
  worldId,
  worldRevisionRef,
  ppfProjectRef,
  sceneDefinitions,
  resolutionLimits,
}) {
  const id = requiredReference(sessionId, "sessionId");
  const scenes = validateSceneDefinitions(sceneDefinitions);
  const limits = normalizeStoryResolutionLimits(resolutionLimits);
  const stateZoneIndexRefs = Object.fromEntries(
    STORY_STATE_ZONES.map((zone) => [zone, `story-session:${id}:zone:${zone}`]),
  );

  return {
    session: {
      id,
      schemaVersion: 1,
      gameDefinitionId: requiredReference(gameDefinitionId, "gameDefinitionId"),
      worldId: requiredReference(worldId, "worldId"),
      worldRevisionRef: requiredReference(worldRevisionRef, "worldRevisionRef"),
      ppfProjectRef: requiredReference(ppfProjectRef, "ppfProjectRef"),
      status: "ready",
      currentSceneId: null,
      sceneIds: scenes.map((scene) => scene.id),
      stateRevision: 0,
      stateZoneIndexRefs,
      resolutionQueue: {
        nextSequence: 1,
        queuedEventIds: [],
        processedIdempotencyKeys: [],
        triggerDepth: 0,
        limits,
      },
      acceptedEventLogRef: `story-session:${id}:accepted-events`,
      latestCheckpointRef: `story-session:${id}:checkpoint:0`,
      canonAdmissionRef: null,
    },
    scenes,
  };
}

function validateRuntime(runtime) {
  if (!runtime?.session || !Array.isArray(runtime.scenes)) return "session runtime is required";
  if (runtime.scenes.length !== STORY_FIVE_SCENE_COUNT) return "session runtime must contain exactly five scenes";
  if (!Array.isArray(runtime.session.sceneIds) || runtime.session.sceneIds.length !== STORY_FIVE_SCENE_COUNT) {
    return "session must reference exactly five scenes";
  }
  const orderedIds = runtime.scenes.map((scene, index) => {
    if (scene?.ordinal !== index + 1) return null;
    return scene?.id;
  });
  if (orderedIds.some((id) => !id) || orderedIds.some((id, index) => id !== runtime.session.sceneIds[index])) {
    return "scene order must be stable and match session.sceneIds";
  }
  if (new Set(orderedIds).size !== STORY_FIVE_SCENE_COUNT) return "scene ids must be unique";
  return null;
}

function currentScene(runtime) {
  if (!runtime.session.currentSceneId) return null;
  return runtime.scenes.find((scene) => scene.id === runtime.session.currentSceneId) || null;
}

function transitionScene(scene, to) {
  const transition = validateStorySceneTransition(scene.status, to);
  if (!transition.ok) return false;
  scene.status = to;
  return true;
}

export function transitionFiveSceneStoryRuntime(runtime, command) {
  const runtimeError = validateRuntime(runtime);
  if (runtimeError) return sessionFailure("invalid-session-runtime", runtimeError, runtime);
  if (typeof command !== "string") return sessionFailure("invalid-command", "command must be a string", runtime);

  const next = structuredClone(runtime);
  const session = next.session;
  const scene = currentScene(next);

  switch (command) {
    case "start-session": {
      if (session.status !== "ready" || session.currentSceneId !== null) {
        return sessionFailure("illegal-session-transition", "only a ready session can start", runtime);
      }
      const first = next.scenes[0];
      if (!transitionScene(first, "active")) {
        return sessionFailure("illegal-scene-transition", "first scene cannot become active", runtime);
      }
      session.status = "active";
      session.currentSceneId = first.id;
      return { ok: true, runtime: next, failure: null };
    }

    case "begin-scene-resolution": {
      if (session.status !== "active" || !scene || !transitionScene(scene, "resolving")) {
        return sessionFailure("illegal-scene-transition", "active scene cannot begin resolution", runtime);
      }
      return { ok: true, runtime: next, failure: null };
    }

    case "resume-scene": {
      if (session.status !== "active" || !scene || !transitionScene(scene, "active")) {
        return sessionFailure("illegal-scene-transition", "resolving scene cannot resume play", runtime);
      }
      return { ok: true, runtime: next, failure: null };
    }

    case "complete-scene": {
      if (session.status !== "active" || !scene || scene.status !== "resolving") {
        return sessionFailure("illegal-scene-transition", "only the resolving current scene can complete", runtime);
      }
      const sceneIndex = next.scenes.findIndex((candidate) => candidate.id === scene.id);
      if (!transitionScene(scene, "resolved")) {
        return sessionFailure("illegal-scene-transition", "current scene cannot resolve", runtime);
      }
      if (sceneIndex === STORY_FIVE_SCENE_COUNT - 1) {
        session.status = "completed";
        session.currentSceneId = null;
        return { ok: true, runtime: next, failure: null };
      }
      const following = next.scenes[sceneIndex + 1];
      if (!transitionScene(following, "active")) {
        return sessionFailure("illegal-scene-transition", "next scene cannot become active", runtime);
      }
      session.currentSceneId = following.id;
      return { ok: true, runtime: next, failure: null };
    }

    case "fail-scene": {
      if (session.status !== "active" || !scene || !["active", "resolving"].includes(scene.status)) {
        return sessionFailure("illegal-scene-transition", "only the current active or resolving scene can fail", runtime);
      }
      if (!transitionScene(scene, "failed")) {
        return sessionFailure("illegal-scene-transition", "current scene cannot fail", runtime);
      }
      session.status = "failed";
      return { ok: true, runtime: next, failure: null };
    }

    default:
      return sessionFailure("unknown-command", `unsupported session command: ${command}`, runtime);
  }
}
