import { createHash } from "node:crypto";

const DEFAULT_LIMITS = Object.freeze({
  maximumTriggerDepth: 8,
  maximumOperationsPerScene: 64,
  maximumAgentCallsPerTurn: 1,
});

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, stableValue(value[key])]));
}

function stableSerialize(value) {
  return JSON.stringify(stableValue(value));
}

function hashState(state) {
  return createHash("sha256").update(stableSerialize(state)).digest("hex");
}

function normalizePositiveInteger(value, fallback) {
  return Number.isSafeInteger(value) && value > 0 ? value : fallback;
}

export function normalizeStoryResolutionLimits(value = {}) {
  return Object.freeze({
    maximumTriggerDepth: normalizePositiveInteger(value.maximumTriggerDepth, DEFAULT_LIMITS.maximumTriggerDepth),
    maximumOperationsPerScene: normalizePositiveInteger(
      value.maximumOperationsPerScene,
      DEFAULT_LIMITS.maximumOperationsPerScene,
    ),
    maximumAgentCallsPerTurn: normalizePositiveInteger(
      value.maximumAgentCallsPerTurn,
      DEFAULT_LIMITS.maximumAgentCallsPerTurn,
    ),
  });
}

export function createStoryMechanicalState(overrides = {}) {
  return {
    revision: Number.isSafeInteger(overrides.revision) && overrides.revision >= 0 ? overrides.revision : 0,
    values: { ...(overrides.values || {}) },
    characterLocations: { ...(overrides.characterLocations || {}) },
    objectCustody: { ...(overrides.objectCustody || {}) },
    knowledgeByCharacter: Object.fromEntries(
      Object.entries(overrides.knowledgeByCharacter || {}).map(([id, refs]) => [id, [...new Set(refs)].sort()]),
    ),
    relationships: { ...(overrides.relationships || {}) },
    openThreads: [...new Set(overrides.openThreads || [])].sort(),
  };
}

function compareQueuedEvents(left, right) {
  return left.priority - right.priority
    || left.enqueueOrder - right.enqueueOrder
    || left.id.localeCompare(right.id);
}

function validateQueuedEvent(event, limits) {
  if (!isRecord(event)) return "event must be an object";
  for (const field of ["id", "idempotencyKey", "cycleKey"]) {
    if (typeof event[field] !== "string" || !event[field].trim()) return `${field} must be a non-empty string`;
  }
  if (!Number.isSafeInteger(event.priority)) return "priority must be an integer";
  if (!Number.isSafeInteger(event.enqueueOrder) || event.enqueueOrder < 0) {
    return "enqueueOrder must be a non-negative integer";
  }
  if (!Number.isSafeInteger(event.triggerDepth) || event.triggerDepth < 0) {
    return "triggerDepth must be a non-negative integer";
  }
  if (event.triggerDepth > limits.maximumTriggerDepth) return "maximum trigger depth exceeded";
  if (!Array.isArray(event.ancestryKeys) || event.ancestryKeys.some((key) => typeof key !== "string")) {
    return "ancestryKeys must contain strings only";
  }
  if (event.ancestryKeys.includes(event.cycleKey)) return "resolution cycle detected";
  if (!isRecord(event.operation) || typeof event.operation.kind !== "string") return "operation is required";
  return null;
}

function requiredReference(operation, field) {
  if (typeof operation[field] !== "string" || !operation[field].trim()) {
    throw new Error(`${operation.kind}.${field} must be a non-empty reference`);
  }
  return operation[field];
}

function applyOperation(state, operation) {
  switch (operation.kind) {
    case "set-value": {
      const ref = requiredReference(operation, "ref");
      if (!["string", "number", "boolean"].includes(typeof operation.value) && operation.value !== null) {
        throw new Error("set-value.value must be scalar or null");
      }
      state.values[ref] = operation.value;
      break;
    }
    case "adjust-number": {
      const ref = requiredReference(operation, "ref");
      if (!Number.isFinite(operation.delta)) throw new Error("adjust-number.delta must be finite");
      const current = state.values[ref] ?? 0;
      if (typeof current !== "number" || !Number.isFinite(current)) {
        throw new Error("adjust-number target must contain a finite number");
      }
      state.values[ref] = current + operation.delta;
      break;
    }
    case "move-character":
      state.characterLocations[requiredReference(operation, "characterId")] = requiredReference(operation, "locationId");
      break;
    case "transfer-object":
      state.objectCustody[requiredReference(operation, "objectId")] = requiredReference(operation, "custodianRef");
      break;
    case "grant-knowledge": {
      const characterId = requiredReference(operation, "characterId");
      const knowledgeRef = requiredReference(operation, "knowledgeRef");
      state.knowledgeByCharacter[characterId] = [...new Set([
        ...(state.knowledgeByCharacter[characterId] || []),
        knowledgeRef,
      ])].sort();
      break;
    }
    case "revoke-knowledge": {
      const characterId = requiredReference(operation, "characterId");
      const knowledgeRef = requiredReference(operation, "knowledgeRef");
      state.knowledgeByCharacter[characterId] = (state.knowledgeByCharacter[characterId] || [])
        .filter((ref) => ref !== knowledgeRef);
      break;
    }
    case "adjust-relationship": {
      const relationshipId = requiredReference(operation, "relationshipId");
      if (!Number.isFinite(operation.delta)) throw new Error("adjust-relationship.delta must be finite");
      const current = state.relationships[relationshipId] ?? 0;
      if (typeof current !== "number" || !Number.isFinite(current)) {
        throw new Error("relationship target must contain a finite number");
      }
      state.relationships[relationshipId] = current + operation.delta;
      break;
    }
    case "open-thread":
      state.openThreads = [...new Set([...state.openThreads, requiredReference(operation, "threadRef")])].sort();
      break;
    case "resolve-thread": {
      const threadRef = requiredReference(operation, "threadRef");
      state.openThreads = state.openThreads.filter((ref) => ref !== threadRef);
      break;
    }
    case "emit-event":
      requiredReference(operation, "eventType");
      if (!Array.isArray(operation.subjectRefs) || operation.subjectRefs.some((ref) => typeof ref !== "string")) {
        throw new Error("emit-event.subjectRefs must contain reference strings only");
      }
      break;
    default:
      throw new Error(`unsupported story operation: ${operation.kind}`);
  }
}

function failure(code, message, originalState, failedEventId = null) {
  return {
    ok: false,
    state: originalState,
    acceptedEvents: [],
    skippedDuplicateEventIds: [],
    checkpoint: null,
    failure: { code, message, failedEventId },
  };
}

function validateMechanicalState(state) {
  if (!isRecord(state) || !Number.isSafeInteger(state.revision) || state.revision < 0) {
    return "mechanical state with a non-negative integer revision is required";
  }
  for (const field of ["values", "characterLocations", "objectCustody", "knowledgeByCharacter", "relationships"]) {
    if (!isRecord(state[field])) return `${field} must be an object`;
  }
  if (!Array.isArray(state.openThreads) || state.openThreads.some((ref) => typeof ref !== "string")) {
    return "openThreads must contain reference strings only";
  }
  if (Object.values(state.knowledgeByCharacter).some(
    (refs) => !Array.isArray(refs) || refs.some((ref) => typeof ref !== "string"),
  )) return "knowledgeByCharacter values must contain reference strings only";
  return null;
}

/**
 * Applies one already-derived event batch as an atomic deterministic transition.
 * Rule matching and AI proposals occur outside this function; neither can alter
 * ordering or partially commit a failed batch.
 */
export function resolveStoryEventBatch({ state, events, limits, processedIdempotencyKeys = [] }) {
  const originalState = state;
  const stateError = validateMechanicalState(state);
  if (stateError) return failure("invalid-state", stateError, originalState);
  if (!Array.isArray(events)) return failure("invalid-events", "events must be an array", originalState);

  const boundedLimits = normalizeStoryResolutionLimits(limits);
  const ordered = events.map((event) => ({ ...event })).sort(compareQueuedEvents);
  const processed = new Set(processedIdempotencyKeys);
  const pending = [];
  const skippedDuplicateEventIds = [];

  for (const event of ordered) {
    const validationError = validateQueuedEvent(event, boundedLimits);
    if (validationError) return failure("invalid-event", validationError, originalState, event?.id || null);
    if (processed.has(event.idempotencyKey)) {
      skippedDuplicateEventIds.push(event.id);
      continue;
    }
    processed.add(event.idempotencyKey);
    pending.push(event);
  }

  if (pending.length > boundedLimits.maximumOperationsPerScene) {
    return failure(
      "operation-budget-exceeded",
      `batch requires ${pending.length} operations; limit is ${boundedLimits.maximumOperationsPerScene}`,
      originalState,
    );
  }

  let nextState;
  try {
    nextState = createStoryMechanicalState(structuredClone(state));
    for (const event of pending) applyOperation(nextState, event.operation);
  } catch (error) {
    return failure("operation-rejected", error instanceof Error ? error.message : String(error), originalState);
  }
  nextState.revision = state.revision + pending.length;

  const acceptedEvents = pending.map((event, index) => ({
    ...event,
    sequence: state.revision + index + 1,
    stateRevisionBefore: state.revision + index,
    stateRevisionAfter: state.revision + index + 1,
    status: "accepted",
  }));
  const checkpoint = Object.freeze({
    revision: nextState.revision,
    stateHash: hashState(nextState),
    processedIdempotencyKeys: [...processed].sort(),
    lastAcceptedEventId: acceptedEvents.at(-1)?.id || null,
  });

  return {
    ok: true,
    state: nextState,
    acceptedEvents,
    skippedDuplicateEventIds,
    checkpoint,
    failure: null,
  };
}

export function verifyStoryResolutionReplay(expectedCheckpoint, resolution) {
  if (!resolution?.ok || !resolution.checkpoint) return false;
  return expectedCheckpoint?.revision === resolution.checkpoint.revision
    && expectedCheckpoint?.stateHash === resolution.checkpoint.stateHash
    && stableSerialize(expectedCheckpoint?.processedIdempotencyKeys || [])
      === stableSerialize(resolution.checkpoint.processedIdempotencyKeys);
}
