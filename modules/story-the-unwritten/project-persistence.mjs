import { STORY_FIVE_SCENE_COUNT } from "./session-machine.mjs";

export const STORY_PROJECT_EXTENSION_KEY = "storyTheUnwritten";
export const STORY_PROJECT_PERSISTENCE_VERSION = 1;

const STORY_SCENE_STATUSES = new Set(["ready", "active", "resolving", "resolved", "failed"]);
const STORY_SESSION_STATUSES = new Set(["ready", "active", "paused", "completed", "failed"]);
const STORY_EXTENSION_FIELDS = ["version", "sessions"];
const STORY_SNAPSHOT_FIELDS = [
  "version",
  "sessionId",
  "worldId",
  "gameDefinitionId",
  "worldRevisionRef",
  "ppfProjectRef",
  "savedAt",
  "runtime",
  "mechanicalState",
];
const STORY_RUNTIME_FIELDS = ["session", "scenes"];
const STORY_SESSION_FIELDS = [
  "id",
  "schemaVersion",
  "gameDefinitionId",
  "worldId",
  "worldRevisionRef",
  "ppfProjectRef",
  "status",
  "currentSceneId",
  "sceneIds",
  "stateRevision",
  "stateZoneIndexRefs",
  "resolutionQueue",
  "acceptedEventLogRef",
  "latestCheckpointRef",
  "canonAdmissionRef",
];
const STORY_SCENE_FIELDS = [
  "id",
  "ordinal",
  "status",
  "participantIds",
  "locationId",
  "objectiveRefs",
  "activeConflictIds",
  "unresolvedThreadRefs",
  "narrativeBudget",
  "operationsUsed",
  "checkpointRef",
];
const STORY_QUEUE_FIELDS = ["nextSequence", "queuedEventIds", "processedIdempotencyKeys", "triggerDepth", "limits"];
const STORY_LIMIT_FIELDS = ["maximumTriggerDepth", "maximumOperationsPerScene", "maximumAgentCallsPerTurn"];
const STORY_MECHANICAL_STATE_FIELDS = [
  "revision",
  "values",
  "characterLocations",
  "objectCustody",
  "knowledgeByCharacter",
  "relationships",
  "openThreads",
];
const STORY_STATE_ZONE_FIELDS = [
  "available",
  "active-scene",
  "world",
  "custody",
  "hidden-knowledge",
  "unresolved-threads",
  "resolved-history",
];

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isReference(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isPositiveInteger(value) {
  return Number.isSafeInteger(value) && value > 0;
}

function isScalar(value) {
  return value === null
    || typeof value === "string"
    || typeof value === "boolean"
    || (typeof value === "number" && Number.isFinite(value));
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTimestamp(value) {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function unknownFieldErrors(value, allowedFields, label) {
  if (!isRecord(value)) return [];
  const allowed = new Set(allowedFields);
  return Object.keys(value)
    .filter((field) => !allowed.has(field))
    .map((field) => `${label} contains unsupported field ${field}`);
}

function validateReferenceArray(value, label) {
  return Array.isArray(value) && value.every((item) => isReference(item))
    ? []
    : [`${label} must contain reference strings only`];
}

function validateReferenceMap(recordValue, label) {
  if (!isRecord(recordValue)) return [`mechanical state ${label} must be an object`];
  for (const [key, value] of Object.entries(recordValue)) {
    if (!isReference(key) || !isReference(value)) return [`mechanical state ${label} must map reference ids to reference ids`];
  }
  return [];
}

function validateMechanicalState(state) {
  const errors = [];
  if (!isRecord(state)) return ["mechanical state must be an object"];
  errors.push(...unknownFieldErrors(state, STORY_MECHANICAL_STATE_FIELDS, "mechanical state"));
  if (!isNonNegativeInteger(state.revision)) errors.push("mechanical state revision must be a non-negative safe integer");

  if (!isRecord(state.values)) {
    errors.push("mechanical state values must be an object");
  } else if (Object.entries(state.values).some(([ref, value]) => !isReference(ref) || !isScalar(value))) {
    errors.push("mechanical state values must map references to finite scalar values");
  }

  errors.push(...validateReferenceMap(state.characterLocations, "characterLocations"));
  errors.push(...validateReferenceMap(state.objectCustody, "objectCustody"));

  if (!isRecord(state.knowledgeByCharacter)) {
    errors.push("mechanical state knowledgeByCharacter must be an object");
  } else {
    for (const [characterId, knowledgeRefs] of Object.entries(state.knowledgeByCharacter)) {
      if (!isReference(characterId) || !Array.isArray(knowledgeRefs) || knowledgeRefs.some((ref) => !isReference(ref))) {
        errors.push("mechanical state knowledgeByCharacter must map character ids to reference arrays");
        break;
      }
    }
  }

  if (!isRecord(state.relationships)) {
    errors.push("mechanical state relationships must be an object");
  } else if (Object.entries(state.relationships).some(([relationshipId, value]) => !isReference(relationshipId) || typeof value !== "number" || !Number.isFinite(value))) {
    errors.push("mechanical state relationships must map relationship ids to finite numbers");
  }

  errors.push(...validateReferenceArray(state.openThreads, "mechanical state openThreads"));
  return errors;
}

function validateResolutionQueue(queue) {
  if (!isRecord(queue)) return ["session resolutionQueue is required for resumable idempotency"];
  const errors = [...unknownFieldErrors(queue, STORY_QUEUE_FIELDS, "resolutionQueue")];
  if (!isNonNegativeInteger(queue.nextSequence)) errors.push("resolutionQueue nextSequence must be a non-negative safe integer");
  errors.push(...validateReferenceArray(queue.queuedEventIds, "resolutionQueue queuedEventIds"));
  if (Array.isArray(queue.queuedEventIds) && queue.queuedEventIds.length > 0) {
    errors.push("resolutionQueue must be quiescent before persistence; queued events are not persisted by this Phase 2 slice");
  }
  errors.push(...validateReferenceArray(queue.processedIdempotencyKeys, "resolutionQueue processedIdempotencyKeys"));
  if (Array.isArray(queue.processedIdempotencyKeys)
    && new Set(queue.processedIdempotencyKeys).size !== queue.processedIdempotencyKeys.length) {
    errors.push("resolutionQueue processedIdempotencyKeys must not contain duplicates");
  }
  if (queue.triggerDepth !== 0) errors.push("resolutionQueue triggerDepth must be zero at a persisted checkpoint");

  if (!isRecord(queue.limits)) {
    errors.push("resolutionQueue limits must be an object");
  } else {
    errors.push(...unknownFieldErrors(queue.limits, STORY_LIMIT_FIELDS, "resolutionQueue limits"));
    if (!isPositiveInteger(queue.limits.maximumTriggerDepth)
      || !isPositiveInteger(queue.limits.maximumOperationsPerScene)
      || !isPositiveInteger(queue.limits.maximumAgentCallsPerTurn)) {
      errors.push("resolutionQueue limits must contain positive finite integer budgets");
    }
  }
  return errors;
}

function validateStateZoneReferences(stateZoneIndexRefs) {
  if (!isRecord(stateZoneIndexRefs)) return ["session stateZoneIndexRefs must remain reference-only metadata"];
  const errors = [...unknownFieldErrors(stateZoneIndexRefs, STORY_STATE_ZONE_FIELDS, "session stateZoneIndexRefs")];
  for (const field of STORY_STATE_ZONE_FIELDS) {
    if (!isReference(stateZoneIndexRefs[field])) errors.push(`session stateZoneIndexRefs.${field} must be a reference`);
  }
  return errors;
}

function validateRuntime(runtime) {
  const errors = [];
  if (!isRecord(runtime)) return ["session runtime must be an object"];
  errors.push(...unknownFieldErrors(runtime, STORY_RUNTIME_FIELDS, "session runtime"));
  if (!isRecord(runtime.session)) errors.push("session runtime must contain a session object");
  if (!Array.isArray(runtime.scenes) || runtime.scenes.length !== STORY_FIVE_SCENE_COUNT) {
    errors.push(`session runtime must contain exactly ${STORY_FIVE_SCENE_COUNT} scenes`);
  }
  if (errors.some((error) => error.includes("must contain a session object") || error.includes("must contain exactly"))) return errors;

  const session = runtime.session;
  errors.push(...unknownFieldErrors(session, STORY_SESSION_FIELDS, "session"));
  for (const field of ["id", "gameDefinitionId", "worldId", "worldRevisionRef", "ppfProjectRef", "acceptedEventLogRef", "latestCheckpointRef"]) {
    if (!isReference(session[field])) errors.push(`session ${field} must be a non-empty reference`);
  }
  if (session.schemaVersion !== 1) errors.push("session schemaVersion must equal 1");
  if (!STORY_SESSION_STATUSES.has(session.status)) errors.push("session status is unsupported");
  if (!isNonNegativeInteger(session.stateRevision)) errors.push("session stateRevision must be a non-negative safe integer");
  if (!Array.isArray(session.sceneIds) || session.sceneIds.length !== STORY_FIVE_SCENE_COUNT || session.sceneIds.some((id) => !isReference(id))) {
    errors.push(`session sceneIds must contain exactly ${STORY_FIVE_SCENE_COUNT} references`);
  }
  if (session.currentSceneId !== null && !isReference(session.currentSceneId)) {
    errors.push("session currentSceneId must be null or a non-empty reference");
  }
  if (isReference(session.currentSceneId) && Array.isArray(session.sceneIds) && !session.sceneIds.includes(session.currentSceneId)) {
    errors.push("session currentSceneId must reference one of the persisted scenes");
  }
  if (session.canonAdmissionRef !== null && !isReference(session.canonAdmissionRef)) {
    errors.push("session canonAdmissionRef must be null or a non-empty reference");
  }
  errors.push(...validateStateZoneReferences(session.stateZoneIndexRefs));
  errors.push(...validateResolutionQueue(session.resolutionQueue));

  const sceneIds = Array.isArray(session.sceneIds) ? session.sceneIds : [];
  runtime.scenes.forEach((scene, index) => {
    if (!isRecord(scene) || !isReference(scene.id) || scene.id !== sceneIds[index] || scene.ordinal !== index + 1) {
      errors.push("persisted scenes must retain stable ordered ids");
      return;
    }
    errors.push(...unknownFieldErrors(scene, STORY_SCENE_FIELDS, `persisted scene ${scene.id}`));
    if (!STORY_SCENE_STATUSES.has(scene.status)) errors.push(`persisted scene ${scene.id} has unsupported status`);
    if (!isReference(scene.locationId)) errors.push(`persisted scene ${scene.id} locationId must be a reference`);
    errors.push(...validateReferenceArray(scene.participantIds, `persisted scene ${scene.id} participantIds`));
    errors.push(...validateReferenceArray(scene.objectiveRefs, `persisted scene ${scene.id} objectiveRefs`));
    errors.push(...validateReferenceArray(scene.activeConflictIds, `persisted scene ${scene.id} activeConflictIds`));
    errors.push(...validateReferenceArray(scene.unresolvedThreadRefs, `persisted scene ${scene.id} unresolvedThreadRefs`));
    if (!isNonNegativeInteger(scene.operationsUsed)) errors.push(`persisted scene ${scene.id} operationsUsed must be a non-negative safe integer`);
    if (!isPositiveInteger(scene.narrativeBudget)) errors.push(`persisted scene ${scene.id} narrativeBudget must be a positive safe integer`);
    if (!isReference(scene.checkpointRef)) errors.push(`persisted scene ${scene.id} checkpointRef must be a reference`);
  });
  return errors;
}

export function validateStorySessionSnapshotInput({ runtime, state }) {
  const errors = [...validateRuntime(runtime), ...validateMechanicalState(state)];
  if (isRecord(runtime?.session) && isRecord(state) && runtime.session.stateRevision !== state.revision) {
    errors.push("session stateRevision must match mechanical state revision before persistence");
  }
  return { ok: errors.length === 0, errors };
}

export function createStorySessionSnapshot({ runtime, state, savedAt }) {
  const validation = validateStorySessionSnapshotInput({ runtime, state });
  if (!validation.ok) throw new Error(`STORY session snapshot is invalid: ${validation.errors.join("; ")}`);
  return {
    version: STORY_PROJECT_PERSISTENCE_VERSION,
    sessionId: runtime.session.id,
    worldId: runtime.session.worldId,
    gameDefinitionId: runtime.session.gameDefinitionId,
    worldRevisionRef: runtime.session.worldRevisionRef,
    ppfProjectRef: runtime.session.ppfProjectRef,
    savedAt: normalizeTimestamp(savedAt),
    runtime: jsonClone(runtime),
    mechanicalState: jsonClone(state),
  };
}

function validateCurrentExtensionStore(raw) {
  const errors = [...unknownFieldErrors(raw, STORY_EXTENSION_FIELDS, "STORY project extension")];
  if (!isRecord(raw.sessions)) errors.push("STORY project extension sessions must be an object");
  return errors;
}

function readExtensionStore(project) {
  const extensions = isRecord(project?.extensions) ? project.extensions : {};
  if (!Object.prototype.hasOwnProperty.call(extensions, STORY_PROJECT_EXTENSION_KEY)) {
    return { kind: "missing", extensions, store: null, errors: [] };
  }
  const raw = extensions[STORY_PROJECT_EXTENSION_KEY];
  if (!isRecord(raw)) return { kind: "invalid", extensions, store: raw, errors: ["STORY project extension must be an object"] };
  if (raw.version !== STORY_PROJECT_PERSISTENCE_VERSION) {
    return Number.isSafeInteger(raw.version)
      ? { kind: "incompatible", extensions, store: raw, errors: [] }
      : { kind: "invalid", extensions, store: raw, errors: ["STORY project extension version is invalid"] };
  }
  const errors = validateCurrentExtensionStore(raw);
  if (errors.length) return { kind: "invalid", extensions, store: raw, errors };
  return { kind: "ready", extensions, store: raw, errors: [] };
}

export function persistStorySessionSnapshot(project, input) {
  if (!isRecord(project) || !isReference(project.id)) throw new Error("PlotPickle project with an id is required for STORY persistence");
  const snapshot = createStorySessionSnapshot(input);
  const extensions = isRecord(project.extensions) ? project.extensions : {};
  const hasExisting = Object.prototype.hasOwnProperty.call(extensions, STORY_PROJECT_EXTENSION_KEY);
  const existingValue = extensions[STORY_PROJECT_EXTENSION_KEY];
  if (hasExisting && !isRecord(existingValue)) {
    throw new Error("Cannot persist STORY session into malformed project extension data");
  }
  if (isRecord(existingValue) && existingValue.version !== STORY_PROJECT_PERSISTENCE_VERSION) {
    if (Number.isSafeInteger(existingValue.version)) {
      throw new Error(`Cannot persist STORY session into incompatible project extension version ${String(existingValue.version)}`);
    }
    throw new Error("Cannot persist STORY session into malformed project extension data");
  }
  if (isRecord(existingValue)) {
    const extensionErrors = validateCurrentExtensionStore(existingValue);
    if (extensionErrors.length) {
      throw new Error(`Cannot persist STORY session into malformed project extension data: ${extensionErrors.join("; ")}`);
    }
  }
  const existing = isRecord(existingValue) ? existingValue : {};
  const sessions = isRecord(existing.sessions) ? existing.sessions : {};
  return {
    project: {
      ...project,
      extensions: {
        ...extensions,
        [STORY_PROJECT_EXTENSION_KEY]: {
          version: STORY_PROJECT_PERSISTENCE_VERSION,
          sessions: {
            ...sessions,
            [snapshot.sessionId]: snapshot,
          },
        },
      },
    },
    snapshot,
  };
}

function validateStoredSnapshot(raw, requestedSessionId) {
  if (!isRecord(raw)) return { ok: false, errors: ["stored STORY snapshot must be an object"] };
  const wrapperErrors = unknownFieldErrors(raw, STORY_SNAPSHOT_FIELDS, "stored STORY snapshot");
  if (wrapperErrors.length) return { ok: false, errors: wrapperErrors };
  if (raw.version !== STORY_PROJECT_PERSISTENCE_VERSION) return { ok: false, errors: ["stored STORY snapshot version is incompatible"] };
  if (raw.sessionId !== requestedSessionId) return { ok: false, errors: ["stored STORY snapshot session id does not match its index key"] };
  if (!isReference(raw.worldId) || !isReference(raw.gameDefinitionId) || !isReference(raw.worldRevisionRef) || !isReference(raw.ppfProjectRef)) {
    return { ok: false, errors: ["stored STORY snapshot identity references are invalid"] };
  }
  if (!isReference(raw.savedAt) || !Number.isFinite(Date.parse(raw.savedAt))) {
    return { ok: false, errors: ["stored STORY snapshot savedAt timestamp is invalid"] };
  }
  const validation = validateStorySessionSnapshotInput({ runtime: raw.runtime, state: raw.mechanicalState });
  if (!validation.ok) return validation;
  if (raw.runtime.session.id !== raw.sessionId
    || raw.runtime.session.worldId !== raw.worldId
    || raw.runtime.session.gameDefinitionId !== raw.gameDefinitionId
    || raw.runtime.session.worldRevisionRef !== raw.worldRevisionRef
    || raw.runtime.session.ppfProjectRef !== raw.ppfProjectRef) {
    return { ok: false, errors: ["stored STORY snapshot identity metadata does not match its runtime"] };
  }
  return { ok: true, errors: [] };
}

export function loadStorySessionSnapshot(project, sessionId) {
  if (!isReference(sessionId)) return { ok: false, reason: "invalid-session-id", snapshot: null, errors: ["session id is required"] };
  const extension = readExtensionStore(project);
  if (extension.kind === "missing") return { ok: false, reason: "not-found", snapshot: null, errors: [] };
  if (extension.kind === "invalid") return { ok: false, reason: "invalid-extension", snapshot: null, errors: extension.errors };
  if (extension.kind === "incompatible") return { ok: false, reason: "incompatible-version", snapshot: null, errors: [] };

  const sessions = extension.store.sessions;
  if (!Object.prototype.hasOwnProperty.call(sessions, sessionId)) {
    return { ok: false, reason: "not-found", snapshot: null, errors: [] };
  }
  const raw = sessions[sessionId];
  const validation = validateStoredSnapshot(raw, sessionId);
  if (!validation.ok) return { ok: false, reason: "invalid-snapshot", snapshot: null, errors: validation.errors };
  return { ok: true, reason: null, snapshot: jsonClone(raw), errors: [] };
}

export function resumeStorySessionFromProject(project, sessionId) {
  const loaded = loadStorySessionSnapshot(project, sessionId);
  if (!loaded.ok) return { ...loaded, runtime: null, state: null, savedAt: null };
  return {
    ok: true,
    reason: null,
    snapshot: loaded.snapshot,
    runtime: jsonClone(loaded.snapshot.runtime),
    state: jsonClone(loaded.snapshot.mechanicalState),
    savedAt: loaded.snapshot.savedAt,
    errors: [],
  };
}
