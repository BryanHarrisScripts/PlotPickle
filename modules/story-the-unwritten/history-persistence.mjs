import {
  STORY_PROJECT_EXTENSION_KEY,
  STORY_PROJECT_PERSISTENCE_VERSION,
  persistStorySessionSnapshot,
  validateStoryProjectExtensionContainer,
} from "./project-persistence.mjs";
import { validateStoryOperationDefinition } from "./rules.mjs";

export const STORY_SESSION_HISTORY_VERSION = 1;

const HISTORY_FIELDS = [
  "version",
  "sessionId",
  "acceptedEventLogRef",
  "acceptedActions",
  "actionOrder",
  "acceptedEvents",
  "eventOrder",
  "checkpoints",
  "checkpointOrder",
  "latestCheckpointRef",
];
const ACCEPTED_ACTION_FIELDS = [
  "id",
  "sessionId",
  "sceneId",
  "actorRef",
  "pieceId",
  "operation",
  "idempotencyKey",
  "acceptedEventIds",
  "stateRevisionBefore",
  "stateRevisionAfter",
  "checkpointRef",
];
const EVENT_FIELDS = [
  "id",
  "idempotencyKey",
  "cycleKey",
  "ancestryKeys",
  "priority",
  "enqueueOrder",
  "triggerDepth",
  "sequence",
  "causationRef",
  "actionId",
  "ruleId",
  "operation",
  "status",
  "stateRevisionBefore",
  "stateRevisionAfter",
];
const CHECKPOINT_FIELDS = ["revision", "stateHash", "processedIdempotencyKeys", "lastAcceptedEventId"];

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isReference(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function isNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0;
}

function isInteger(value) {
  return Number.isSafeInteger(value);
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableSerialize(value) {
  return JSON.stringify(stableValue(value));
}

function sameRecord(left, right) {
  return stableSerialize(left) === stableSerialize(right);
}

function unknownFieldErrors(value, allowedFields, label) {
  if (!isRecord(value)) return [];
  const allowed = new Set(allowedFields);
  return Object.keys(value)
    .filter((field) => !allowed.has(field))
    .map((field) => `${label} contains unsupported field ${field}`);
}

function validateReferenceArray(value, label, { unique = false, sorted = false } = {}) {
  const errors = [];
  if (!Array.isArray(value) || value.some((ref) => !isReference(ref))) {
    return [`${label} must contain non-empty references only`];
  }
  if (unique && new Set(value).size !== value.length) errors.push(`${label} must not contain duplicates`);
  if (sorted && stableSerialize(value) !== stableSerialize([...value].sort())) errors.push(`${label} must be sorted`);
  return errors;
}

function acceptedEventLogReference(sessionId) {
  return `story-session:${sessionId}:accepted-events`;
}

export function storyCheckpointReference(sessionId, checkpoint) {
  if (!isReference(sessionId) || !isRecord(checkpoint) || !isNonNegativeInteger(checkpoint.revision)
    || typeof checkpoint.stateHash !== "string") {
    throw new Error("session id and valid checkpoint are required");
  }
  return `story-checkpoint:${sessionId}:${checkpoint.revision}:${checkpoint.stateHash.slice(0, 16)}`;
}

function validateCheckpoint(checkpoint, sessionId) {
  if (!isRecord(checkpoint)) return { ok: false, errors: ["checkpoint must be an object"] };
  const errors = [...unknownFieldErrors(checkpoint, CHECKPOINT_FIELDS, "checkpoint")];
  if (!isNonNegativeInteger(checkpoint.revision)) errors.push("checkpoint revision must be a non-negative safe integer");
  if (typeof checkpoint.stateHash !== "string" || !/^[a-f0-9]{64}$/u.test(checkpoint.stateHash)) {
    errors.push("checkpoint stateHash must be a lowercase sha256 digest");
  }
  errors.push(...validateReferenceArray(checkpoint.processedIdempotencyKeys, "checkpoint processedIdempotencyKeys", {
    unique: true,
    sorted: true,
  }));
  if (checkpoint.lastAcceptedEventId !== null && !isReference(checkpoint.lastAcceptedEventId)) {
    errors.push("checkpoint lastAcceptedEventId must be null or a reference");
  }
  if (errors.length === 0 && sessionId) {
    try {
      storyCheckpointReference(sessionId, checkpoint);
    } catch (error) {
      errors.push(String(error?.message ?? error));
    }
  }
  return { ok: errors.length === 0, errors };
}

function validateAcceptedEvent(event) {
  if (!isRecord(event)) return { ok: false, errors: ["accepted event must be an object"] };
  const errors = [...unknownFieldErrors(event, EVENT_FIELDS, "accepted event")];
  for (const field of ["id", "idempotencyKey", "cycleKey", "causationRef", "actionId"]) {
    if (!isReference(event[field])) errors.push(`accepted event ${field} must be a non-empty reference`);
  }
  if (event.ruleId !== null && !isReference(event.ruleId)) errors.push("accepted event ruleId must be null or a reference");
  errors.push(...validateReferenceArray(event.ancestryKeys, "accepted event ancestryKeys"));
  if (!isInteger(event.priority)) errors.push("accepted event priority must be an integer");
  if (!isNonNegativeInteger(event.enqueueOrder)) errors.push("accepted event enqueueOrder must be a non-negative safe integer");
  if (!isNonNegativeInteger(event.triggerDepth)) errors.push("accepted event triggerDepth must be a non-negative safe integer");
  if (!Number.isSafeInteger(event.sequence) || event.sequence <= 0) errors.push("accepted event sequence must be a positive safe integer");
  if (!isNonNegativeInteger(event.stateRevisionBefore)) errors.push("accepted event stateRevisionBefore must be a non-negative safe integer");
  if (!Number.isSafeInteger(event.stateRevisionAfter) || event.stateRevisionAfter <= 0) {
    errors.push("accepted event stateRevisionAfter must be a positive safe integer");
  }
  if (event.status !== "accepted") errors.push("persisted event status must be accepted");
  const operationValidation = validateStoryOperationDefinition(event.operation);
  if (!operationValidation.ok) errors.push(...operationValidation.errors.map((error) => `accepted event operation: ${error}`));
  if (Number.isSafeInteger(event.sequence) && Number.isSafeInteger(event.stateRevisionBefore)
    && event.sequence !== event.stateRevisionBefore + 1) {
    errors.push("accepted event sequence must equal stateRevisionBefore + 1");
  }
  if (Number.isSafeInteger(event.sequence) && Number.isSafeInteger(event.stateRevisionAfter)
    && event.stateRevisionAfter !== event.sequence) {
    errors.push("accepted event stateRevisionAfter must equal sequence");
  }
  return { ok: errors.length === 0, errors };
}

function validateAcceptedActionRecord(action) {
  if (!isRecord(action)) return { ok: false, errors: ["accepted action record must be an object"] };
  const errors = [...unknownFieldErrors(action, ACCEPTED_ACTION_FIELDS, "accepted action record")];
  for (const field of ["id", "sessionId", "sceneId", "actorRef", "idempotencyKey", "checkpointRef"]) {
    if (!isReference(action[field])) errors.push(`accepted action ${field} must be a non-empty reference`);
  }
  if (action.pieceId !== null && !isReference(action.pieceId)) errors.push("accepted action pieceId must be null or a reference");
  errors.push(...validateReferenceArray(action.acceptedEventIds, "accepted action acceptedEventIds", { unique: true }));
  if (!Array.isArray(action.acceptedEventIds) || action.acceptedEventIds.length === 0) {
    errors.push("accepted action must reference at least one accepted event");
  }
  if (!isNonNegativeInteger(action.stateRevisionBefore)) errors.push("accepted action stateRevisionBefore must be non-negative");
  if (!Number.isSafeInteger(action.stateRevisionAfter) || action.stateRevisionAfter <= action.stateRevisionBefore) {
    errors.push("accepted action stateRevisionAfter must advance the revision");
  }
  const operationValidation = validateStoryOperationDefinition(action.operation);
  if (!operationValidation.ok) errors.push(...operationValidation.errors.map((error) => `accepted action operation: ${error}`));
  return { ok: errors.length === 0, errors };
}

function validateAcceptedTransactionInput({ action, result }) {
  const errors = [];
  if (!isRecord(action)) return { ok: false, errors: ["accepted transaction action must be an object"] };
  if (!result?.ok || result.status !== "accepted" || !isRecord(result.runtime?.session) || !isRecord(result.state)
    || !isRecord(result.acceptedEvent) || !isRecord(result.checkpoint)) {
    return { ok: false, errors: ["only a complete accepted STORY action result can be persisted"] };
  }
  for (const field of ["id", "sessionId", "sceneId", "actorRef", "idempotencyKey"]) {
    if (!isReference(action[field])) errors.push(`action ${field} must be a non-empty reference`);
  }
  if (action.pieceId !== null && !isReference(action.pieceId)) errors.push("action pieceId must be null or a reference");
  const operationValidation = validateStoryOperationDefinition(action.operation);
  if (!operationValidation.ok) errors.push(...operationValidation.errors.map((error) => `action operation: ${error}`));

  const session = result.runtime.session;
  if (action.sessionId !== session.id) errors.push("action sessionId must match accepted runtime session");
  if (session.acceptedEventLogRef !== acceptedEventLogReference(session.id)) errors.push("session acceptedEventLogRef is not the canonical STORY log reference");
  if (result.state.revision !== session.stateRevision) errors.push("accepted runtime and state revisions must match");

  const events = [result.acceptedEvent, ...(Array.isArray(result.acceptedRuleEvents) ? result.acceptedRuleEvents : [])];
  for (const [index, event] of events.entries()) {
    const validation = validateAcceptedEvent(event);
    if (!validation.ok) errors.push(...validation.errors.map((error) => `event ${index}: ${error}`));
    if (event?.actionId !== action.id) errors.push(`event ${index} actionId must match accepted action`);
    if (index === 0) {
      if (event?.ruleId !== null) errors.push("direct accepted event must not have a ruleId");
      if (event?.causationRef !== action.id) errors.push("direct accepted event causationRef must equal action id");
      if (!sameRecord(event?.operation, action.operation)) errors.push("direct accepted event operation must equal action operation");
    }
    if (index > 0 && Number.isSafeInteger(events[index - 1]?.sequence)
      && event?.sequence !== events[index - 1].sequence + 1) {
      errors.push("accepted events must have contiguous deterministic sequences");
    }
  }

  const checkpointValidation = validateCheckpoint(result.checkpoint, session.id);
  if (!checkpointValidation.ok) errors.push(...checkpointValidation.errors);
  const firstEvent = events[0];
  const lastEvent = events.at(-1);
  if (firstEvent && lastEvent) {
    if (result.checkpoint.revision !== lastEvent.stateRevisionAfter) errors.push("checkpoint revision must equal last accepted event revision");
    if (result.checkpoint.lastAcceptedEventId !== lastEvent.id) errors.push("checkpoint lastAcceptedEventId must equal the last accepted event");
    if (session.stateRevision !== lastEvent.stateRevisionAfter) errors.push("session stateRevision must equal last accepted event revision");
    if (session.latestCheckpointRef !== storyCheckpointReference(session.id, result.checkpoint)) {
      errors.push("session latestCheckpointRef must address the accepted checkpoint");
    }
    if (stableSerialize(session.resolutionQueue?.processedIdempotencyKeys || [])
      !== stableSerialize(result.checkpoint.processedIdempotencyKeys)) {
      errors.push("session processed idempotency keys must match checkpoint");
    }
    if (!result.checkpoint.processedIdempotencyKeys.includes(action.idempotencyKey)) {
      errors.push("checkpoint must include the accepted action idempotency key");
    }
  }
  return { ok: errors.length === 0, errors, events };
}

function emptyHistory(sessionId, acceptedEventLogRef) {
  return {
    version: STORY_SESSION_HISTORY_VERSION,
    sessionId,
    acceptedEventLogRef,
    acceptedActions: {},
    actionOrder: [],
    acceptedEvents: {},
    eventOrder: [],
    checkpoints: {},
    checkpointOrder: [],
    latestCheckpointRef: null,
  };
}

function currentExtension(project) {
  if (!isRecord(project) || !isReference(project.id)) throw new Error("PlotPickle project with an id is required for STORY history persistence");
  const extensions = isRecord(project.extensions) ? project.extensions : {};
  if (!Object.prototype.hasOwnProperty.call(extensions, STORY_PROJECT_EXTENSION_KEY)) {
    return {
      extensions,
      store: { version: STORY_PROJECT_PERSISTENCE_VERSION, sessions: {}, sessionHistories: {} },
    };
  }
  const store = extensions[STORY_PROJECT_EXTENSION_KEY];
  if (!isRecord(store) || store.version !== STORY_PROJECT_PERSISTENCE_VERSION) {
    throw new Error("Cannot use incompatible or malformed STORY project extension for history persistence");
  }
  const validation = validateStoryProjectExtensionContainer(store);
  if (!validation.ok) throw new Error(`Cannot use malformed STORY project extension: ${validation.errors.join("; ")}`);
  return { extensions, store };
}

function validateHistory(history, sessionId) {
  if (!isRecord(history)) return { ok: false, errors: ["session history must be an object"] };
  const errors = [...unknownFieldErrors(history, HISTORY_FIELDS, "session history")];
  if (history.version !== STORY_SESSION_HISTORY_VERSION) errors.push("session history version is incompatible");
  if (history.sessionId !== sessionId) errors.push("session history id does not match its index key");
  if (history.acceptedEventLogRef !== acceptedEventLogReference(sessionId)) errors.push("session history acceptedEventLogRef is invalid");
  for (const field of ["acceptedActions", "acceptedEvents", "checkpoints"]) {
    if (!isRecord(history[field])) errors.push(`session history ${field} must be an object`);
  }
  errors.push(...validateReferenceArray(history.actionOrder, "session history actionOrder", { unique: true }));
  errors.push(...validateReferenceArray(history.eventOrder, "session history eventOrder", { unique: true }));
  errors.push(...validateReferenceArray(history.checkpointOrder, "session history checkpointOrder", { unique: true }));
  if (history.latestCheckpointRef !== null && !isReference(history.latestCheckpointRef)) errors.push("session history latestCheckpointRef must be null or a reference");
  if (errors.length) return { ok: false, errors };

  let previousRevision = 0;
  let expectedEventOffset = 0;
  const seenIdempotencyKeys = new Set();
  for (const [actionIndex, actionId] of history.actionOrder.entries()) {
    const record = history.acceptedActions[actionId];
    const validation = validateAcceptedActionRecord(record);
    if (!validation.ok) {
      errors.push(`accepted action ${actionId} is invalid: ${validation.errors.join("; ")}`);
      continue;
    }
    if (record.id !== actionId || record.sessionId !== sessionId) errors.push(`accepted action ${actionId} is indexed incorrectly`);
    if (record.stateRevisionBefore !== previousRevision) errors.push(`accepted action ${actionId} does not continue the previous revision`);
    if (seenIdempotencyKeys.has(record.idempotencyKey)) errors.push(`accepted action ${actionId} reuses a persisted idempotency key`);
    seenIdempotencyKeys.add(record.idempotencyKey);
    const eventSlice = history.eventOrder.slice(expectedEventOffset, expectedEventOffset + record.acceptedEventIds.length);
    if (!sameRecord(eventSlice, record.acceptedEventIds)) errors.push(`accepted action ${actionId} event order is not contiguous`);
    for (const [index, eventId] of record.acceptedEventIds.entries()) {
      const event = history.acceptedEvents[eventId];
      const eventValidation = validateAcceptedEvent(event);
      if (!eventValidation.ok) {
        errors.push(`accepted event ${eventId} is invalid: ${eventValidation.errors.join("; ")}`);
        continue;
      }
      if (event.id !== eventId || event.actionId !== actionId) errors.push(`accepted event ${eventId} is indexed incorrectly`);
      const expectedSequence = record.stateRevisionBefore + index + 1;
      if (event.sequence !== expectedSequence) errors.push(`accepted event ${eventId} has a non-contiguous sequence`);
    }
    const lastEventId = record.acceptedEventIds.at(-1);
    const lastEvent = history.acceptedEvents[lastEventId];
    if (lastEvent?.stateRevisionAfter !== record.stateRevisionAfter) errors.push(`accepted action ${actionId} revision does not match its final event`);
    if (!Object.prototype.hasOwnProperty.call(history.checkpoints, record.checkpointRef)) {
      errors.push(`accepted action ${actionId} checkpoint is missing`);
    } else {
      const checkpoint = history.checkpoints[record.checkpointRef];
      const checkpointValidation = validateCheckpoint(checkpoint, sessionId);
      if (!checkpointValidation.ok) {
        errors.push(`accepted action ${actionId} checkpoint is invalid: ${checkpointValidation.errors.join("; ")}`);
      } else {
        if (record.checkpointRef !== storyCheckpointReference(sessionId, checkpoint)) {
          errors.push(`accepted action ${actionId} checkpoint reference is incorrect`);
        }
        if (checkpoint.revision !== record.stateRevisionAfter) {
          errors.push(`accepted action ${actionId} checkpoint revision does not match action revision`);
        }
        if (checkpoint.lastAcceptedEventId !== lastEventId) {
          errors.push(`accepted action ${actionId} checkpoint does not reference its final accepted event`);
        }
        if (!checkpoint.processedIdempotencyKeys.includes(record.idempotencyKey)) {
          errors.push(`accepted action ${actionId} checkpoint is missing its idempotency key`);
        }
      }
    }
    if (history.checkpointOrder[actionIndex] !== record.checkpointRef) {
      errors.push(`accepted action ${actionId} checkpoint order is not aligned with action order`);
    }
    previousRevision = record.stateRevisionAfter;
    expectedEventOffset += record.acceptedEventIds.length;
  }

  if (expectedEventOffset !== history.eventOrder.length) errors.push("session history contains events not owned by an accepted action");
  if (Object.keys(history.acceptedActions).length !== history.actionOrder.length) errors.push("session history acceptedActions contains unindexed records");
  if (Object.keys(history.acceptedEvents).length !== history.eventOrder.length) errors.push("session history acceptedEvents contains unindexed records");
  if (Object.keys(history.checkpoints).length !== history.checkpointOrder.length) errors.push("session history checkpoints contains unindexed records");
  if (history.checkpointOrder.length !== history.actionOrder.length) errors.push("session history must contain exactly one checkpoint per accepted action");

  let lastCheckpoint = null;
  for (const checkpointRef of history.checkpointOrder) {
    const checkpoint = history.checkpoints[checkpointRef];
    const validation = validateCheckpoint(checkpoint, sessionId);
    if (!validation.ok) {
      errors.push(`checkpoint ${checkpointRef} is invalid: ${validation.errors.join("; ")}`);
      continue;
    }
    if (checkpointRef !== storyCheckpointReference(sessionId, checkpoint)) errors.push(`checkpoint ${checkpointRef} has the wrong reference`);
    if (lastCheckpoint && checkpoint.revision <= lastCheckpoint.revision) errors.push("checkpoint revisions must increase monotonically");
    lastCheckpoint = checkpoint;
  }
  const expectedLatest = history.checkpointOrder.at(-1) ?? null;
  if (history.latestCheckpointRef !== expectedLatest) errors.push("session history latestCheckpointRef must equal the last checkpoint in order");
  if (lastCheckpoint && lastCheckpoint.revision !== previousRevision) errors.push("latest checkpoint revision must equal accepted history revision");
  return { ok: errors.length === 0, errors };
}

function acceptedActionRecord(action, events, checkpointRef) {
  const firstEvent = events[0];
  const lastEvent = events.at(-1);
  return {
    id: action.id,
    sessionId: action.sessionId,
    sceneId: action.sceneId,
    actorRef: action.actorRef,
    pieceId: action.pieceId,
    operation: jsonClone(action.operation),
    idempotencyKey: action.idempotencyKey,
    acceptedEventIds: events.map((event) => event.id),
    stateRevisionBefore: firstEvent.stateRevisionBefore,
    stateRevisionAfter: lastEvent.stateRevisionAfter,
    checkpointRef,
  };
}

function appendAcceptedHistory(project, action, result, events) {
  const { extensions, store } = currentExtension(project);
  const histories = isRecord(store.sessionHistories) ? store.sessionHistories : {};
  const sessionId = result.runtime.session.id;
  const existingHistory = Object.prototype.hasOwnProperty.call(histories, sessionId)
    ? histories[sessionId]
    : emptyHistory(sessionId, result.runtime.session.acceptedEventLogRef);
  const historyValidation = validateHistory(existingHistory, sessionId);
  if (!historyValidation.ok) throw new Error(`Cannot append to invalid STORY session history: ${historyValidation.errors.join("; ")}`);

  const checkpointRef = result.runtime.session.latestCheckpointRef;
  const record = acceptedActionRecord(action, events, checkpointRef);
  const existingAction = existingHistory.acceptedActions[action.id];
  if (existingAction !== undefined) {
    if (!sameRecord(existingAction, record)) throw new Error(`accepted action ${action.id} already exists with different content`);
    for (const event of events) {
      if (!sameRecord(existingHistory.acceptedEvents[event.id], event)) throw new Error(`accepted event ${event.id} conflicts with persisted history`);
    }
    if (!sameRecord(existingHistory.checkpoints[checkpointRef], result.checkpoint)) throw new Error(`checkpoint ${checkpointRef} conflicts with persisted history`);
    return { project, history: jsonClone(existingHistory), actionRecord: jsonClone(existingAction), status: "duplicate" };
  }
  if (existingHistory.actionOrder.some((id) => existingHistory.acceptedActions[id]?.idempotencyKey === action.idempotencyKey)) {
    throw new Error(`accepted action idempotency key ${action.idempotencyKey} is already owned by another action`);
  }

  const previousRevision = existingHistory.actionOrder.length === 0
    ? 0
    : existingHistory.acceptedActions[existingHistory.actionOrder.at(-1)].stateRevisionAfter;
  if (record.stateRevisionBefore !== previousRevision) {
    throw new Error(`accepted action ${action.id} starts at revision ${record.stateRevisionBefore}; persisted history ends at ${previousRevision}`);
  }
  for (const event of events) {
    if (Object.prototype.hasOwnProperty.call(existingHistory.acceptedEvents, event.id)) {
      throw new Error(`accepted event ${event.id} already exists outside this action`);
    }
  }
  if (Object.prototype.hasOwnProperty.call(existingHistory.checkpoints, checkpointRef)) {
    throw new Error(`checkpoint ${checkpointRef} already exists outside this action`);
  }

  const nextHistory = {
    ...existingHistory,
    acceptedActions: { ...existingHistory.acceptedActions, [action.id]: record },
    actionOrder: [...existingHistory.actionOrder, action.id],
    acceptedEvents: Object.fromEntries([
      ...Object.entries(existingHistory.acceptedEvents),
      ...events.map((event) => [event.id, jsonClone(event)]),
    ]),
    eventOrder: [...existingHistory.eventOrder, ...events.map((event) => event.id)],
    checkpoints: { ...existingHistory.checkpoints, [checkpointRef]: jsonClone(result.checkpoint) },
    checkpointOrder: [...existingHistory.checkpointOrder, checkpointRef],
    latestCheckpointRef: checkpointRef,
  };
  const nextValidation = validateHistory(nextHistory, sessionId);
  if (!nextValidation.ok) throw new Error(`Accepted STORY history failed validation: ${nextValidation.errors.join("; ")}`);
  return {
    project: {
      ...project,
      extensions: {
        ...extensions,
        [STORY_PROJECT_EXTENSION_KEY]: {
          ...store,
          sessionHistories: { ...histories, [sessionId]: nextHistory },
        },
      },
    },
    history: jsonClone(nextHistory),
    actionRecord: jsonClone(record),
    status: "stored",
  };
}

export function persistAcceptedStoryTransaction(project, { action, result, savedAt }) {
  const validation = validateAcceptedTransactionInput({ action, result });
  if (!validation.ok) throw new Error(`Cannot persist accepted STORY transaction: ${validation.errors.join("; ")}`);
  const historyResult = appendAcceptedHistory(project, action, result, validation.events);
  if (historyResult.status === "duplicate") {
    return { ...historyResult, snapshot: null };
  }
  const snapshotResult = persistStorySessionSnapshot(historyResult.project, {
    runtime: result.runtime,
    state: result.state,
    savedAt,
  });
  return {
    project: snapshotResult.project,
    history: historyResult.history,
    actionRecord: historyResult.actionRecord,
    snapshot: snapshotResult.snapshot,
    status: "stored",
  };
}

export function readStorySessionHistory(project, sessionId) {
  if (!isReference(sessionId)) return { ok: false, reason: "invalid-session-id", history: null, errors: ["session id is required"] };
  let store;
  try {
    ({ store } = currentExtension(project));
  } catch (error) {
    return { ok: false, reason: "invalid-extension", history: null, errors: [String(error?.message ?? error)] };
  }
  const histories = isRecord(store.sessionHistories) ? store.sessionHistories : {};
  if (!Object.prototype.hasOwnProperty.call(histories, sessionId)) {
    return { ok: false, reason: "not-found", history: null, errors: [] };
  }
  const history = histories[sessionId];
  const validation = validateHistory(history, sessionId);
  if (!validation.ok) return { ok: false, reason: "invalid-history", history: null, errors: validation.errors };

  const snapshot = isRecord(store.sessions) ? store.sessions[sessionId] : null;
  if (snapshot !== undefined && snapshot !== null) {
    if (!isRecord(snapshot?.runtime?.session) || !isRecord(snapshot.mechanicalState)) {
      return { ok: false, reason: "invalid-history", history: null, errors: ["session history has an invalid linked session snapshot"] };
    }
    if (snapshot.runtime.session.acceptedEventLogRef !== history.acceptedEventLogRef) {
      return { ok: false, reason: "invalid-history", history: null, errors: ["session snapshot acceptedEventLogRef does not match durable history"] };
    }
    if (snapshot.runtime.session.latestCheckpointRef !== history.latestCheckpointRef) {
      return { ok: false, reason: "invalid-history", history: null, errors: ["session snapshot latestCheckpointRef does not match durable history"] };
    }
    const latest = history.latestCheckpointRef ? history.checkpoints[history.latestCheckpointRef] : null;
    if (latest && (snapshot.runtime.session.stateRevision !== latest.revision || snapshot.mechanicalState.revision !== latest.revision)) {
      return { ok: false, reason: "invalid-history", history: null, errors: ["session snapshot revision does not match durable history checkpoint"] };
    }
    if (latest && stableSerialize(snapshot.runtime.session.resolutionQueue?.processedIdempotencyKeys || [])
      !== stableSerialize(latest.processedIdempotencyKeys)) {
      return { ok: false, reason: "invalid-history", history: null, errors: ["session snapshot idempotency state does not match durable history checkpoint"] };
    }
  }
  return { ok: true, reason: null, history: jsonClone(history), errors: [] };
}