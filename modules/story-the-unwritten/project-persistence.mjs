import { STORY_FIVE_SCENE_COUNT } from "./session-machine.mjs";

export const STORY_PROJECT_EXTENSION_KEY = "storyTheUnwritten";
export const STORY_PROJECT_PERSISTENCE_VERSION = 1;

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isReference(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normalizeTimestamp(value) {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function validateMechanicalState(state) {
  const errors = [];
  if (!isRecord(state)) return ["mechanical state must be an object"];
  if (!isNonNegativeInteger(state.revision)) errors.push("mechanical state revision must be a non-negative safe integer");
  for (const field of ["values", "characterLocations", "objectCustody", "knowledgeByCharacter", "relationships"]) {
    if (!isRecord(state[field])) errors.push(`mechanical state ${field} must be an object`);
  }
  if (!Array.isArray(state.openThreads) || state.openThreads.some((ref) => !isReference(ref))) {
    errors.push("mechanical state openThreads must contain reference strings only");
  }
  if (isRecord(state.knowledgeByCharacter)) {
    for (const [characterId, knowledgeRefs] of Object.entries(state.knowledgeByCharacter)) {
      if (!isReference(characterId) || !Array.isArray(knowledgeRefs) || knowledgeRefs.some((ref) => !isReference(ref))) {
        errors.push("mechanical state knowledgeByCharacter must map character ids to reference arrays");
        break;
      }
    }
  }
  return errors;
}

function validateRuntime(runtime) {
  const errors = [];
  if (!isRecord(runtime)) return ["session runtime must be an object"];
  if (!isRecord(runtime.session)) errors.push("session runtime must contain a session object");
  if (!Array.isArray(runtime.scenes) || runtime.scenes.length !== STORY_FIVE_SCENE_COUNT) {
    errors.push(`session runtime must contain exactly ${STORY_FIVE_SCENE_COUNT} scenes`);
  }
  if (errors.length) return errors;

  const session = runtime.session;
  for (const field of ["id", "gameDefinitionId", "worldId", "worldRevisionRef", "ppfProjectRef", "acceptedEventLogRef", "latestCheckpointRef"]) {
    if (!isReference(session[field])) errors.push(`session ${field} must be a non-empty reference`);
  }
  if (session.schemaVersion !== 1) errors.push("session schemaVersion must equal 1");
  if (!isNonNegativeInteger(session.stateRevision)) errors.push("session stateRevision must be a non-negative safe integer");
  if (!Array.isArray(session.sceneIds) || session.sceneIds.length !== STORY_FIVE_SCENE_COUNT || session.sceneIds.some((id) => !isReference(id))) {
    errors.push(`session sceneIds must contain exactly ${STORY_FIVE_SCENE_COUNT} references`);
  }
  if (session.currentSceneId !== null && !isReference(session.currentSceneId)) {
    errors.push("session currentSceneId must be null or a non-empty reference");
  }
  if (session.canonAdmissionRef !== null && !isReference(session.canonAdmissionRef)) {
    errors.push("session canonAdmissionRef must be null or a non-empty reference");
  }
  if (!isRecord(session.stateZoneIndexRefs)) errors.push("session stateZoneIndexRefs must remain reference-only metadata");
  if (!isRecord(session.resolutionQueue)) errors.push("session resolutionQueue is required for resumable idempotency");

  const sceneIds = Array.isArray(session.sceneIds) ? session.sceneIds : [];
  runtime.scenes.forEach((scene, index) => {
    if (!isRecord(scene) || !isReference(scene.id) || scene.id !== sceneIds[index] || scene.ordinal !== index + 1) {
      errors.push("persisted scenes must retain stable ordered ids");
    }
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

function readExtensionStore(project) {
  const extensions = isRecord(project?.extensions) ? project.extensions : {};
  const raw = isRecord(extensions[STORY_PROJECT_EXTENSION_KEY]) ? extensions[STORY_PROJECT_EXTENSION_KEY] : null;
  if (!raw) return { kind: "missing", extensions, store: null };
  if (raw.version !== STORY_PROJECT_PERSISTENCE_VERSION) return { kind: "incompatible", extensions, store: raw };
  return { kind: "ready", extensions, store: raw };
}

export function persistStorySessionSnapshot(project, input) {
  if (!isRecord(project) || !isReference(project.id)) throw new Error("PlotPickle project with an id is required for STORY persistence");
  const snapshot = createStorySessionSnapshot(input);
  const extensions = isRecord(project.extensions) ? project.extensions : {};
  const existing = isRecord(extensions[STORY_PROJECT_EXTENSION_KEY]) ? extensions[STORY_PROJECT_EXTENSION_KEY] : {};
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
  if (raw.version !== STORY_PROJECT_PERSISTENCE_VERSION) return { ok: false, errors: ["stored STORY snapshot version is incompatible"] };
  if (raw.sessionId !== requestedSessionId) return { ok: false, errors: ["stored STORY snapshot session id does not match its index key"] };
  if (!isReference(raw.worldId) || !isReference(raw.gameDefinitionId) || !isReference(raw.worldRevisionRef) || !isReference(raw.ppfProjectRef)) {
    return { ok: false, errors: ["stored STORY snapshot identity references are invalid"] };
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
  if (extension.kind === "incompatible") return { ok: false, reason: "incompatible-version", snapshot: null, errors: [] };

  const sessions = isRecord(extension.store.sessions) ? extension.store.sessions : {};
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
