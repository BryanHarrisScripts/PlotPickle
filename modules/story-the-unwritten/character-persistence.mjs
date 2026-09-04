import {
  STORY_PROJECT_EXTENSION_KEY,
  STORY_PROJECT_PERSISTENCE_VERSION,
  validateStoryProjectExtensionContainer,
} from "./project-persistence.mjs";

const STORY_CONTRACT_SCHEMA_VERSION = 1;
const STORY_AUTHORSHIP = new Set(["human", "generated-proposal", "engine", "imported"]);
const STORY_MEMORY_VISIBILITY = new Set(["remembered", "forgotten", "hidden"]);

const DEFINITION_FIELDS = ["id", "schemaVersion", "worldId", "name", "role", "identityRefs", "traitRefs", "provenance"];
const PROVENANCE_FIELDS = ["authorship", "creatorRef", "sourceRefs", "admittedByRef", "admittedAt"];
const STATE_FIELDS = [
  "characterId",
  "revision",
  "locationId",
  "conditionRefs",
  "objectiveRefs",
  "inventoryRefs",
  "knowledgeRefs",
  "relationshipEdgeRefs",
  "memoryCursor",
  "updatedByEventId",
];
const MEMORY_FIELDS = ["id", "characterId", "eventRef", "visibility", "recordedAt"];
const RELATIONSHIP_FIELDS = [
  "id",
  "fromCharacterId",
  "toCharacterId",
  "kind",
  "value",
  "historyIndexRef",
  "updatedByEventId",
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

function isFiniteNumber(value) {
  return typeof value === "number" && Number.isFinite(value);
}

function jsonClone(value) {
  return JSON.parse(JSON.stringify(value));
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stableJson(item)).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function sameRecord(left, right) {
  return stableJson(left) === stableJson(right);
}

function timestampIsValid(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function unknownFieldErrors(value, allowedFields, label) {
  if (!isRecord(value)) return [];
  const allowed = new Set(allowedFields);
  return Object.keys(value)
    .filter((field) => !allowed.has(field))
    .map((field) => `${label} contains unsupported field ${field}`);
}

function validateReferenceArray(value, label) {
  return Array.isArray(value) && value.every((ref) => isReference(ref))
    ? []
    : [`${label} must contain reference strings only`];
}

function validateNullableReference(value, label) {
  return value === null || isReference(value) ? [] : [`${label} must be null or a reference`];
}

function validateProvenance(provenance) {
  if (!isRecord(provenance)) return ["character definition provenance must be an object"];
  const errors = [...unknownFieldErrors(provenance, PROVENANCE_FIELDS, "character definition provenance")];
  if (!STORY_AUTHORSHIP.has(provenance.authorship)) errors.push("character definition provenance authorship is unsupported");
  if (!isReference(provenance.creatorRef)) errors.push("character definition provenance creatorRef is required");
  errors.push(...validateReferenceArray(provenance.sourceRefs, "character definition provenance sourceRefs"));
  errors.push(...validateNullableReference(provenance.admittedByRef, "character definition provenance admittedByRef"));
  if (provenance.admittedAt !== null && !timestampIsValid(provenance.admittedAt)) {
    errors.push("character definition provenance admittedAt must be null or a valid timestamp");
  }
  if ((provenance.admittedByRef === null) !== (provenance.admittedAt === null)) {
    errors.push("character definition provenance admission reference and timestamp must be set together");
  }
  return errors;
}

export function validateStoryCharacterDefinition(definition) {
  if (!isRecord(definition)) return { ok: false, errors: ["character definition must be an object"] };
  const errors = [...unknownFieldErrors(definition, DEFINITION_FIELDS, "character definition")];
  if (!isReference(definition.id)) errors.push("character definition id is required");
  if (definition.schemaVersion !== STORY_CONTRACT_SCHEMA_VERSION) errors.push("character definition schemaVersion must equal 1");
  if (!isReference(definition.worldId)) errors.push("character definition worldId is required");
  if (!isReference(definition.name)) errors.push("character definition name is required");
  if (!isReference(definition.role)) errors.push("character definition role is required");
  errors.push(...validateReferenceArray(definition.identityRefs, "character definition identityRefs"));
  errors.push(...validateReferenceArray(definition.traitRefs, "character definition traitRefs"));
  errors.push(...validateProvenance(definition.provenance));
  return { ok: errors.length === 0, errors };
}

export function validateStoryCharacterState(state) {
  if (!isRecord(state)) return { ok: false, errors: ["character state must be an object"] };
  const errors = [...unknownFieldErrors(state, STATE_FIELDS, "character state")];
  if (!isReference(state.characterId)) errors.push("character state characterId is required");
  if (!isNonNegativeInteger(state.revision)) errors.push("character state revision must be a non-negative safe integer");
  errors.push(...validateNullableReference(state.locationId, "character state locationId"));
  errors.push(...validateReferenceArray(state.conditionRefs, "character state conditionRefs"));
  errors.push(...validateReferenceArray(state.objectiveRefs, "character state objectiveRefs"));
  errors.push(...validateReferenceArray(state.inventoryRefs, "character state inventoryRefs"));
  errors.push(...validateReferenceArray(state.knowledgeRefs, "character state knowledgeRefs"));
  errors.push(...validateReferenceArray(state.relationshipEdgeRefs, "character state relationshipEdgeRefs"));
  errors.push(...validateNullableReference(state.memoryCursor, "character state memoryCursor"));
  if (!isReference(state.updatedByEventId)) errors.push("character state updatedByEventId is required");
  return { ok: errors.length === 0, errors };
}

export function validateStoryMemoryEventRecord(memoryEvent) {
  if (!isRecord(memoryEvent)) return { ok: false, errors: ["memory event must be an object"] };
  const errors = [...unknownFieldErrors(memoryEvent, MEMORY_FIELDS, "memory event")];
  if (!isReference(memoryEvent.id)) errors.push("memory event id is required");
  if (!isReference(memoryEvent.characterId)) errors.push("memory event characterId is required");
  if (!isReference(memoryEvent.eventRef)) errors.push("memory event eventRef is required");
  if (!STORY_MEMORY_VISIBILITY.has(memoryEvent.visibility)) errors.push("memory event visibility is unsupported");
  if (!timestampIsValid(memoryEvent.recordedAt)) errors.push("memory event recordedAt must be a valid timestamp");
  return { ok: errors.length === 0, errors };
}

export function validateStoryRelationshipEdge(edge) {
  if (!isRecord(edge)) return { ok: false, errors: ["relationship edge must be an object"] };
  const errors = [...unknownFieldErrors(edge, RELATIONSHIP_FIELDS, "relationship edge")];
  if (!isReference(edge.id)) errors.push("relationship edge id is required");
  if (!isReference(edge.fromCharacterId)) errors.push("relationship edge fromCharacterId is required");
  if (!isReference(edge.toCharacterId)) errors.push("relationship edge toCharacterId is required");
  if (edge.fromCharacterId === edge.toCharacterId) errors.push("relationship edge endpoints must be different characters");
  if (!isReference(edge.kind)) errors.push("relationship edge kind is required");
  if (!isFiniteNumber(edge.value)) errors.push("relationship edge value must be a finite number");
  if (!isReference(edge.historyIndexRef)) errors.push("relationship edge historyIndexRef is required");
  if (!isReference(edge.updatedByEventId)) errors.push("relationship edge updatedByEventId is required");
  return { ok: errors.length === 0, errors };
}

function emptyStoryExtension() {
  return {
    version: STORY_PROJECT_PERSISTENCE_VERSION,
    sessions: {},
    characterDefinitions: {},
    characterStates: {},
    memoryEvents: {},
    relationshipEdges: {},
  };
}

function currentExtension(project) {
  if (!isRecord(project) || !isReference(project.id)) throw new Error("PlotPickle project with an id is required for STORY persistence");
  const extensions = isRecord(project.extensions) ? project.extensions : {};
  if (!Object.prototype.hasOwnProperty.call(extensions, STORY_PROJECT_EXTENSION_KEY)) {
    return { extensions, store: emptyStoryExtension() };
  }
  const raw = extensions[STORY_PROJECT_EXTENSION_KEY];
  if (!isRecord(raw)) throw new Error("Cannot use malformed STORY project extension data");
  if (raw.version !== STORY_PROJECT_PERSISTENCE_VERSION) {
    if (Number.isSafeInteger(raw.version)) throw new Error(`Cannot use incompatible STORY project extension version ${String(raw.version)}`);
    throw new Error("Cannot use malformed STORY project extension data");
  }
  const validation = validateStoryProjectExtensionContainer(raw);
  if (!validation.ok) throw new Error(`Cannot use malformed STORY project extension data: ${validation.errors.join("; ")}`);
  return {
    extensions,
    store: {
      ...raw,
      characterDefinitions: isRecord(raw.characterDefinitions) ? raw.characterDefinitions : {},
      characterStates: isRecord(raw.characterStates) ? raw.characterStates : {},
      memoryEvents: isRecord(raw.memoryEvents) ? raw.memoryEvents : {},
      relationshipEdges: isRecord(raw.relationshipEdges) ? raw.relationshipEdges : {},
    },
  };
}

function withStoryExtension(project, extensions, store) {
  return {
    ...project,
    extensions: {
      ...extensions,
      [STORY_PROJECT_EXTENSION_KEY]: store,
    },
  };
}

function persistValidatedRecord(project, { storeName, key, record, validation, conflictLabel }) {
  if (!validation.ok) throw new Error(`Invalid ${conflictLabel}: ${validation.errors.join("; ")}`);
  const { extensions, store } = currentExtension(project);
  const recordStore = store[storeName];
  const existing = recordStore[key];
  if (existing !== undefined && !sameRecord(existing, record)) {
    throw new Error(`${conflictLabel} ${key} already exists with different content`);
  }
  return {
    project: withStoryExtension(project, extensions, {
      ...store,
      [storeName]: {
        ...recordStore,
        [key]: jsonClone(record),
      },
    }),
    record: jsonClone(record),
    status: existing === undefined ? "stored" : "duplicate",
  };
}

export function storyCharacterStateKey(characterId, revision) {
  if (!isReference(characterId) || !isNonNegativeInteger(revision)) throw new Error("Character id and non-negative revision are required");
  return `${characterId}@${revision}`;
}

export function persistStoryCharacterDefinition(project, definition) {
  return persistValidatedRecord(project, {
    storeName: "characterDefinitions",
    key: definition?.id,
    record: definition,
    validation: validateStoryCharacterDefinition(definition),
    conflictLabel: "character definition",
  });
}

export function persistStoryCharacterState(project, state) {
  const validation = validateStoryCharacterState(state);
  const key = validation.ok ? storyCharacterStateKey(state.characterId, state.revision) : "invalid";
  return persistValidatedRecord(project, {
    storeName: "characterStates",
    key,
    record: state,
    validation,
    conflictLabel: "character state",
  });
}

export function appendStoryMemoryEvent(project, memoryEvent) {
  return persistValidatedRecord(project, {
    storeName: "memoryEvents",
    key: memoryEvent?.id,
    record: memoryEvent,
    validation: validateStoryMemoryEventRecord(memoryEvent),
    conflictLabel: "memory event",
  });
}

export function persistStoryRelationshipEdge(project, edge, options = {}) {
  const validation = validateStoryRelationshipEdge(edge);
  if (!validation.ok) throw new Error(`Invalid relationship edge: ${validation.errors.join("; ")}`);
  const { extensions, store } = currentExtension(project);
  const existing = store.relationshipEdges[edge.id];
  if (existing === undefined) {
    if (options.expectedUpdatedByEventId !== undefined && options.expectedUpdatedByEventId !== null) {
      throw new Error(`relationship edge ${edge.id} does not exist for compare-and-swap update`);
    }
  } else if (sameRecord(existing, edge)) {
    return { project, record: jsonClone(edge), status: "duplicate" };
  } else {
    if (existing.fromCharacterId !== edge.fromCharacterId
      || existing.toCharacterId !== edge.toCharacterId
      || existing.kind !== edge.kind
      || existing.historyIndexRef !== edge.historyIndexRef) {
      throw new Error(`relationship edge ${edge.id} identity fields are immutable`);
    }
    if (!isReference(options.expectedUpdatedByEventId) || options.expectedUpdatedByEventId !== existing.updatedByEventId) {
      throw new Error(`relationship edge ${edge.id} update is stale or missing expectedUpdatedByEventId`);
    }
    if (edge.updatedByEventId === existing.updatedByEventId) {
      throw new Error(`relationship edge ${edge.id} update must reference a new event`);
    }
  }

  return {
    project: withStoryExtension(project, extensions, {
      ...store,
      relationshipEdges: {
        ...store.relationshipEdges,
        [edge.id]: jsonClone(edge),
      },
    }),
    record: jsonClone(edge),
    status: existing === undefined ? "stored" : "updated",
  };
}

function readStore(project, storeName) {
  try {
    const { store } = currentExtension(project);
    return { ok: true, reason: null, records: store[storeName], errors: [] };
  } catch (error) {
    return { ok: false, reason: "invalid-extension", records: {}, errors: [String(error?.message ?? error)] };
  }
}

function validateStoredRecordMap(records, validator, keyForRecord, label) {
  const output = [];
  const errors = [];
  for (const [key, raw] of Object.entries(records)) {
    const validation = validator(raw);
    if (!validation.ok) {
      errors.push(`${label} ${key} is invalid: ${validation.errors.join("; ")}`);
      continue;
    }
    const expectedKey = keyForRecord(raw);
    if (key !== expectedKey) {
      errors.push(`${label} ${key} is indexed under the wrong key; expected ${expectedKey}`);
      continue;
    }
    output.push(jsonClone(raw));
  }
  return { ok: errors.length === 0, records: output, errors };
}

export function readStoryCharacterBundle(project, characterId) {
  if (!isReference(characterId)) return { ok: false, reason: "invalid-character-id", definition: null, states: [], currentState: null, memoryEvents: [], relationshipEdges: [], errors: ["character id is required"] };
  const definitionStore = readStore(project, "characterDefinitions");
  const stateStore = readStore(project, "characterStates");
  const memoryStore = readStore(project, "memoryEvents");
  const relationshipStore = readStore(project, "relationshipEdges");
  const storeFailure = [definitionStore, stateStore, memoryStore, relationshipStore].find((result) => !result.ok);
  if (storeFailure) {
    return { ok: false, reason: storeFailure.reason, definition: null, states: [], currentState: null, memoryEvents: [], relationshipEdges: [], errors: storeFailure.errors };
  }

  const definitions = validateStoredRecordMap(definitionStore.records, validateStoryCharacterDefinition, (record) => record.id, "character definition");
  const states = validateStoredRecordMap(stateStore.records, validateStoryCharacterState, (record) => storyCharacterStateKey(record.characterId, record.revision), "character state");
  const memories = validateStoredRecordMap(memoryStore.records, validateStoryMemoryEventRecord, (record) => record.id, "memory event");
  const relationships = validateStoredRecordMap(relationshipStore.records, validateStoryRelationshipEdge, (record) => record.id, "relationship edge");
  const errors = [...definitions.errors, ...states.errors, ...memories.errors, ...relationships.errors];
  if (errors.length) {
    return { ok: false, reason: "invalid-character-store", definition: null, states: [], currentState: null, memoryEvents: [], relationshipEdges: [], errors };
  }

  const definition = definitions.records.find((record) => record.id === characterId) ?? null;
  const characterStates = states.records
    .filter((record) => record.characterId === characterId)
    .sort((left, right) => left.revision - right.revision);
  const memoryEvents = memories.records
    .filter((record) => record.characterId === characterId)
    .sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.id.localeCompare(right.id));
  const relationshipEdges = relationships.records
    .filter((record) => record.fromCharacterId === characterId || record.toCharacterId === characterId)
    .sort((left, right) => left.id.localeCompare(right.id));

  return {
    ok: true,
    reason: null,
    definition,
    states: characterStates,
    currentState: characterStates.at(-1) ?? null,
    memoryEvents,
    relationshipEdges,
    errors: [],
  };
}
