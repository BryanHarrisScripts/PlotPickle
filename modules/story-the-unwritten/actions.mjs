import { resolveStoryEventBatch } from "./resolution.mjs";
import { deriveStoryRuleEvents } from "./rules.mjs";

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredReference(value, field) {
  if (typeof value !== "string" || !value.trim()) return `${field} must be a non-empty reference`;
  return null;
}

function illegalResult(code, message, runtime, state) {
  return {
    ok: false,
    status: "illegal",
    runtime,
    state,
    acceptedEvent: null,
    checkpoint: null,
    failure: { code, message },
  };
}

function duplicateResult(runtime, state) {
  return {
    ok: true,
    status: "duplicate",
    runtime,
    state,
    acceptedEvent: null,
    checkpoint: null,
    failure: null,
  };
}

function findCurrentScene(runtime) {
  const currentSceneId = runtime?.session?.currentSceneId;
  if (!currentSceneId || !Array.isArray(runtime?.scenes)) return null;
  return runtime.scenes.find((scene) => scene.id === currentSceneId) || null;
}

function checkpointReference(sessionId, checkpoint) {
  return `story-checkpoint:${sessionId}:${checkpoint.revision}:${checkpoint.stateHash.slice(0, 16)}`;
}

export function validateStoryActionForRuntime({ runtime, state, action }) {
  if (!runtime?.session || !Array.isArray(runtime.scenes)) {
    return { ok: false, code: "invalid-session-runtime", message: "session runtime is required" };
  }
  if (!isRecord(state) || !Number.isSafeInteger(state.revision) || state.revision < 0) {
    return { ok: false, code: "invalid-state", message: "mechanical state with a revision is required" };
  }
  if (!isRecord(action)) {
    return { ok: false, code: "invalid-action", message: "action must be an object" };
  }
  for (const field of ["id", "sessionId", "sceneId", "actorRef", "idempotencyKey", "proposedAt"]) {
    const error = requiredReference(action[field], field);
    if (error) return { ok: false, code: "invalid-action", message: error };
  }
  if (action.pieceId !== null && requiredReference(action.pieceId, "pieceId")) {
    return { ok: false, code: "invalid-action", message: "pieceId must be null or a non-empty reference" };
  }
  if (!isRecord(action.operation) || typeof action.operation.kind !== "string" || !action.operation.kind.trim()) {
    return { ok: false, code: "invalid-action", message: "operation with a kind is required" };
  }

  const session = runtime.session;
  if (session.status !== "active") {
    return { ok: false, code: "session-not-active", message: "actions require an active session" };
  }
  if (action.sessionId !== session.id) {
    return { ok: false, code: "wrong-session", message: "action sessionId does not match the active session" };
  }
  if (action.sceneId !== session.currentSceneId) {
    return { ok: false, code: "wrong-scene", message: "action sceneId does not match the current scene" };
  }
  const scene = findCurrentScene(runtime);
  if (!scene || scene.status !== "active") {
    return { ok: false, code: "scene-not-active", message: "actions require the current scene to be active" };
  }
  if (session.stateRevision !== state.revision) {
    return {
      ok: false,
      code: "stale-state",
      message: `session revision ${session.stateRevision} does not match mechanical state revision ${state.revision}`,
    };
  }
  if (!session.resolutionQueue?.limits || !Array.isArray(session.resolutionQueue.processedIdempotencyKeys)) {
    return { ok: false, code: "invalid-session-runtime", message: "session resolution queue is required" };
  }
  return { ok: true, code: "legal", message: "action is structurally legal" };
}

export function reduceStoryAction({ runtime, state, action }) {
  const validation = validateStoryActionForRuntime({ runtime, state, action });
  if (!validation.ok) return illegalResult(validation.code, validation.message, runtime, state);

  const session = runtime.session;
  const scene = findCurrentScene(runtime);
  const processedIdempotencyKeys = session.resolutionQueue.processedIdempotencyKeys;
  if (processedIdempotencyKeys.includes(action.idempotencyKey)) return duplicateResult(runtime, state);

  const maximumOperationsPerScene = session.resolutionQueue.limits.maximumOperationsPerScene;
  const remainingOperations = maximumOperationsPerScene - scene.operationsUsed;
  if (remainingOperations <= 0) {
    return illegalResult(
      "operation-budget-exceeded",
      `scene operation budget of ${maximumOperationsPerScene} is exhausted`,
      runtime,
      state,
    );
  }

  const queuedEvent = {
    id: `story-event:${action.id}`,
    idempotencyKey: action.idempotencyKey,
    cycleKey: `story-action:${action.id}`,
    ancestryKeys: [],
    priority: 0,
    enqueueOrder: session.resolutionQueue.nextSequence,
    triggerDepth: 0,
    sequence: 0,
    causationRef: action.id,
    actionId: action.id,
    ruleId: null,
    operation: structuredClone(action.operation),
    status: "queued",
    stateRevisionBefore: state.revision,
    stateRevisionAfter: null,
  };

  const resolution = resolveStoryEventBatch({
    state,
    events: [queuedEvent],
    limits: {
      ...session.resolutionQueue.limits,
      maximumOperationsPerScene: remainingOperations,
    },
    processedIdempotencyKeys,
  });
  if (!resolution.ok) {
    return illegalResult(resolution.failure.code, resolution.failure.message, runtime, state);
  }
  const acceptedEvent = resolution.acceptedEvents[0] || null;
  if (!acceptedEvent) return duplicateResult(runtime, state);

  const nextRuntime = structuredClone(runtime);
  const nextSession = nextRuntime.session;
  const nextScene = findCurrentScene(nextRuntime);
  const checkpointRef = checkpointReference(nextSession.id, resolution.checkpoint);

  nextScene.operationsUsed += 1;
  nextScene.checkpointRef = checkpointRef;
  nextSession.stateRevision = resolution.state.revision;
  nextSession.latestCheckpointRef = checkpointRef;
  nextSession.resolutionQueue.nextSequence += 1;
  nextSession.resolutionQueue.queuedEventIds = [];
  nextSession.resolutionQueue.processedIdempotencyKeys = [...resolution.checkpoint.processedIdempotencyKeys];
  nextSession.resolutionQueue.triggerDepth = 0;

  return {
    ok: true,
    status: "accepted",
    runtime: nextRuntime,
    state: resolution.state,
    acceptedEvent,
    checkpoint: resolution.checkpoint,
    failure: null,
  };
}

export function reduceStoryActionWithRules({ runtime, state, action, rules = [] }) {
  const direct = reduceStoryAction({ runtime, state, action });
  if (!direct.ok || direct.status !== "accepted") {
    return {
      ...direct,
      matchedRuleIds: [],
      acceptedRuleEvents: [],
    };
  }

  const directSession = direct.runtime.session;
  const directScene = findCurrentScene(direct.runtime);
  const remainingOperations = directSession.resolutionQueue.limits.maximumOperationsPerScene - directScene.operationsUsed;
  const derived = deriveStoryRuleEvents({
    rules,
    trigger: "action-accepted",
    state: direct.state,
    causationRef: action.id,
    actionId: action.id,
    nextSequence: directSession.resolutionQueue.nextSequence,
    triggerDepth: directSession.resolutionQueue.triggerDepth,
    ancestryKeys: [],
  });

  if (!derived.ok) {
    return {
      ...illegalResult(derived.failure.code, derived.failure.message, runtime, state),
      matchedRuleIds: derived.matchedRuleIds || [],
      acceptedRuleEvents: [],
    };
  }
  if (derived.events.length > remainingOperations) {
    return {
      ...illegalResult(
        "operation-budget-exceeded",
        `action and matched rules exceed the scene operation budget of ${directSession.resolutionQueue.limits.maximumOperationsPerScene}`,
        runtime,
        state,
      ),
      matchedRuleIds: derived.matchedRuleIds,
      acceptedRuleEvents: [],
    };
  }
  if (derived.events.length === 0) {
    return {
      ...direct,
      matchedRuleIds: derived.matchedRuleIds,
      acceptedRuleEvents: [],
    };
  }

  const ruleResolution = resolveStoryEventBatch({
    state: direct.state,
    events: derived.events,
    limits: {
      ...directSession.resolutionQueue.limits,
      maximumOperationsPerScene: remainingOperations,
    },
    processedIdempotencyKeys: directSession.resolutionQueue.processedIdempotencyKeys,
  });
  if (!ruleResolution.ok) {
    return {
      ...illegalResult(ruleResolution.failure.code, ruleResolution.failure.message, runtime, state),
      matchedRuleIds: derived.matchedRuleIds,
      acceptedRuleEvents: [],
    };
  }

  const nextRuntime = structuredClone(direct.runtime);
  const nextSession = nextRuntime.session;
  const nextScene = findCurrentScene(nextRuntime);
  const checkpointRef = checkpointReference(nextSession.id, ruleResolution.checkpoint);

  nextScene.operationsUsed += ruleResolution.acceptedEvents.length;
  nextScene.checkpointRef = checkpointRef;
  nextSession.stateRevision = ruleResolution.state.revision;
  nextSession.latestCheckpointRef = checkpointRef;
  nextSession.resolutionQueue.nextSequence = derived.nextSequence;
  nextSession.resolutionQueue.queuedEventIds = [];
  nextSession.resolutionQueue.processedIdempotencyKeys = [...ruleResolution.checkpoint.processedIdempotencyKeys];
  nextSession.resolutionQueue.triggerDepth = 0;

  return {
    ok: true,
    status: "accepted",
    runtime: nextRuntime,
    state: ruleResolution.state,
    acceptedEvent: direct.acceptedEvent,
    matchedRuleIds: derived.matchedRuleIds,
    acceptedRuleEvents: ruleResolution.acceptedEvents,
    checkpoint: ruleResolution.checkpoint,
    failure: null,
  };
}
