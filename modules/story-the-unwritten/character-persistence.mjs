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
const RELATIONSHIP_STORE_FIELDS = ["records", "byCharacter"];

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

function validateUniqueReferenceArray(value, label) {
  const errors = validateReferenceArray(value, label);
  if (!errors.length && new Set(value).size !== value.length) errors.push(`${label} must not contain duplicates`);
  return errors;
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
  errors.push(...validateUniqueReferenceArray(state.relationshipEdgeRefs, "character state relationshipEdgeRefs"));
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

function emptyRelationshipStore() {
  return { records: {}, byCharacter: {} };
}

function validateRelationshipStore(value) {
  if (!isRecord(value)) return { ok: false, errors: ["relationshipEdges store must be an object"] };
  const errors = [...unknownFieldErrors(value, RELATIONSHIP_STORE_FIELDS, "relationshipEdges store")];
  if (!isRecord(value.records)) errors.push("relationshipEdges records must be an object");
  if (!isRecord(value.byCharacter)) {
    errors.push("relationshipEdges byCharacter index must be an object");
  } else {
    for (const [characterId, edgeRefs] of Object.entries(value.byCharacter)) {
      if (!isReference(characterId)) {
        errors.push("relationshipEdges byCharacter index keys must be character references");
        continue;
      }
      errors.push(...validateUniqueReferenceArray(edgeRefs, `relationshipEdges index for ${characterId}`));
    }
  }
  return { ok: errors.length === 0, errors };
}

function emptyStoryExtension() {
  return {
    version: STORY_PROJECT_PERSISTENCE_VERSION,
    sessions: {},
    characterDefinitions: {},
    characterStates: {},
    memoryEvents: {},
    relationshipEdges: emptyRelationshipStore(),
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
  const relationshipEdges = Object.prototype.hasOwnProperty.call(raw, "relationshipEdges") ? raw.relationshipEdges : emptyRelationshipStore();
  const relationshipValidation = validateRelationshipStore(relationshipEdges);
  if (!relationshipValidation.ok) throw new Error(`Cannot use malformed STORY relationship store: ${relationshipValidation.errors.join("; ")}`);
  return {
    extensions,
    store: {
      ...raw,
      characterDefinitions: isRecord(raw.characterDefinitions) ? raw.characterDefinitions : {},
      characterStates: isRecord(raw.characterStates) ? raw.characterStates : {},
      memoryEvents: isRecord(raw.memoryEvents) ? raw.memoryEvents : {},
      relationshipEdges,
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

function persistDirectRecord(project, { storeName, key, record, validation, conflictLabel }) {
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
  return persistDirectRecord(project, {
    storeName: "characterDefinitions",
    key: definition?.id,
    record: definition,
    validation: validateStoryCharacterDefinition(definition),
    conflictLabel: "character definition",
  });
}

export function persistStoryCharacterState(project, state) {
  const validation = validateStoryCharacterState(state);
  if (!validation.ok) throw new Error(`Invalid character state: ${validation.errors.join("; ")}`);
  const { extensions, store } = currentExtension(project);
  const existingBucket = store.characterStates[state.characterId];
  if (existingBucket !== undefined && !isRecord(existingBucket)) {
    throw new Error(`character state bucket ${state.characterId} is malformed`);
  }
  const bucket = existingBucket ?? {};
  const revisionKey = String(state.revision);
  const existing = bucket[revisionKey];
  if (existing !== undefined && !sameRecord(existing, state)) {
    throw new Error(`character state ${storyCharacterStateKey(state.characterId, state.revision)} already exists with different content`);
  }
  return {
    project: withStoryExtension(project, extensions, {
      ...store,
      characterStates: {
        ...store.characterStates,
        [state.characterId]: {
          ...bucket,
          [revisionKey]: jsonClone(state),
        },
      },
    }),
    record: jsonClone(state),
    status: existing === undefined ? "stored" : "duplicate",
  };
}

export function appendStoryMemoryEvent(project, memoryEvent) {
  const validation = validateStoryMemoryEventRecord(memoryEvent);
  if (!validation.ok) throw new Error(`Invalid memory event: ${validation.errors.join("; ")}`);
  const { extensions, store } = currentExtension(project);
  const existingBucket = store.memoryEvents[memoryEvent.characterId];
  if (existingBucket !== undefined && !isRecord(existingBucket)) {
    throw new Error(`memory event bucket ${memoryEvent.characterId} is malformed`);
  }
  const bucket = existingBucket ?? {};
  const existing = bucket[memoryEvent.id];
  if (existing !== undefined && !sameRecord(existing, memoryEvent)) {
    throw new Error(`memory event ${memoryEvent.id} already exists with different content`);
  }
  return {
    project: withStoryExtension(project, extensions, {
      ...store,
      memoryEvents: {
        ...store.memoryEvents,
        [memoryEvent.characterId]: {
          ...bucket,
          [memoryEvent.id]: jsonClone(memoryEvent),
        },
      },
    }),
    record: jsonClone(memoryEvent),
    status: existing === undefined ? "stored" : "duplicate",
  };
}

function relationshipIndexFor(store, characterId) {
  const refs = store.relationshipEdges.byCharacter[characterId];
  if (refs === undefined) return [];
  const errors = validateUniqueReferenceArray(refs, `relationshipEdges index for ${characterId}`);
  if (errors.length) throw new Error(`Cannot use malformed STORY relationship store: ${errors.join("; ")}`);
  return refs;
}

function addRelationshipRef(index, characterId, edgeId) {
  return {
    ...index,
    [characterId]: [...new Set([...(index[characterId] ?? []), edgeId])].sort(),
  };
}

export function persistStoryRelationshipEdge(project, edge, options = {}) {
  const validation = validateStoryRelationshipEdge(edge);
  if (!validation.ok) throw new Error(`Invalid relationship edge: ${validation.errors.join("; ")}`);
  const { extensions, store } = currentExtension(project);
  const existing = store.relationshipEdges.records[edge.id];
  if (existing === undefined) {
    if (options.expectedUpdatedByEventId !== undefined && options.expectedUpdatedByEventId !== null) {
      throw new Error(`relationship edge ${edge.id} does not exist for compare-and-swap update`);
    }
  } else {
    const fromIndex = relationshipIndexFor(store, existing.fromCharacterId);
    const toIndex = relationshipIndexFor(store, existing.toCharacterId);
    if (!fromIndex.includes(edge.id) || !toIndex.includes(edge.id)) {
      throw new Error(`relationship edge ${edge.id} has a corrupted character index`);
    }
    if (sameRecord(existing, edge)) return { project, record: jsonClone(edge), status: "duplicate" };
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

  let byCharacter = store.relationshipEdges.byCharacter;
  byCharacter = addRelationshipRef(byCharacter, edge.fromCharacterId, edge.id);
  byCharacter = addRelationshipRef(byCharacter, edge.toCharacterId, edge.id);
  return {
    project: withStoryExtension(project, extensions, {
      ...store,
      relationshipEdges: {
        records: {
          ...store.relationshipEdges.records,
          [edge.id]: jsonClone(edge),
        },
        byCharacter,
      },
    }),
    record: jsonClone(edge),
    status: existing === undefined ? "stored" : "updated",
  };
}

function emptyBundle(reason = null, errors = []) {
  return {
    ok: reason === null,
    reason,
    definition: null,
    states: [],
    currentState: null,
    memoryEvents: [],
    relationshipEdges: [],
    errors,
  };
}

export function readStoryCharacterBundle(project, characterId) {
  if (!isReference(characterId)) return emptyBundle("invalid-character-id", ["character id is required"]);
  let store;
  try {
    ({ store } = currentExtension(project));
  } catch (error) {
    return emptyBundle("invalid-extension", [String(error?.message ?? error)]);
  }

  const errors = [];
  let definition = null;
  const rawDefinition = store.characterDefinitions[characterId];
  if (rawDefinition !== undefined) {
    const validation = validateStoryCharacterDefinition(rawDefinition);
    if (!validation.ok) errors.push(`character definition ${characterId} is invalid: ${validation.errors.join("; ")}`);
    else if (rawDefinition.id !== characterId) errors.push(`character definition ${characterId} is indexed under the wrong key`);
    else definition = jsonClone(rawDefinition);
  }

  const rawStates = store.characterStates[characterId];
  const states = [];
  if (rawStates !== undefined && !isRecord(rawStates)) {
    errors.push(`character state bucket ${characterId} is malformed`);
  } else if (isRecord(rawStates)) {
    for (const [revisionKey, rawState] of Object.entries(rawStates)) {
      const validation = validateStoryCharacterState(rawState);
      if (!validation.ok) {
        errors.push(`character state ${characterId}@${revisionKey} is invalid: ${validation.errors.join("; ")}`);
        continue;
      }
      if (rawState.characterId !== characterId || String(rawState.revision) !== revisionKey) {
        errors.push(`character state ${characterId}@${revisionKey} is indexed under the wrong character or revision`);
        continue;
      }
      states.push(jsonClone(rawState));
    }
  }
  states.sort((left, right) => left.revision - right.revision);

  const rawMemories = store.memoryEvents[characterId];
  const memoryEvents = [];
  if (rawMemories !== undefined && !isRecord(rawMemories)) {
    errors.push(`memory event bucket ${characterId} is malformed`);
  } else if (isRecord(rawMemories)) {
    for (const [memoryId, rawMemory] of Object.entries(rawMemories)) {
      const validation = validateStoryMemoryEventRecord(rawMemory);
      if (!validation.ok) {
        errors.push(`memory event ${memoryId} is invalid: ${validation.errors.join("; ")}`);
        continue;
      }
      if (rawMemory.id !== memoryId || rawMemory.characterId !== characterId) {
        errors.push(`memory event ${memoryId} is indexed under the wrong character or id`);
        continue;
      }
      memoryEvents.push(jsonClone(rawMemory));
    }
  }
  memoryEvents.sort((left, right) => left.recordedAt.localeCompare(right.recordedAt) || left.id.localeCompare(right.id));

  const relationshipEdges = [];
  let relationshipRefs = [];
  try {
    relationshipRefs = relationshipIndexFor(store, characterId);
  } catch (error) {
    errors.push(String(error?.message ?? error));
  }
  for (const edgeId of relationshipRefs) {
    const rawEdge = store.relationshipEdges.records[edgeId];
    if (rawEdge === undefined) {
      errors.push(`relationship edge ${edgeId} is indexed for ${characterId} but missing`);
      continue;
    }
    const validation = validateStoryRelationshipEdge(rawEdge);
    if (!validation.ok) {
      errors.push(`relationship edge ${edgeId} is invalid: ${validation.errors.join("; ")}`);
      continue;
    }
    if (rawEdge.id !== edgeId || (rawEdge.fromCharacterId !== characterId && rawEdge.toCharacterId !== characterId)) {
      errors.push(`relationship edge ${edgeId} is indexed under the wrong character or id`);
      continue;
    }
    relationshipEdges.push(jsonClone(rawEdge));
  }
  relationshipEdges.sort((left, right) => left.id.localeCompare(right.id));

  const loadedRelationshipIds = new Set(relationshipEdges.map((edge) => edge.id));
  for (const state of states) {
    for (const edgeRef of state.relationshipEdgeRefs) {
      if (!loadedRelationshipIds.has(edgeRef)) {
        errors.push(`character state ${storyCharacterStateKey(characterId, state.revision)} references missing relationship edge ${edgeRef}`);
      }
    }
  }

  if (errors.length) return emptyBundle("invalid-character-store", errors);
  return {
    ok: true,
    reason: null,
    definition,
    states,
    currentState: states.at(-1) ?? null,
    memoryEvents,
    relationshipEdges,
    errors: [],
  };
}
