import {
  STORY_PROJECT_EXTENSION_KEY,
  STORY_PROJECT_PERSISTENCE_VERSION,
  validateStoryProjectExtensionContainer,
} from "./project-persistence.mjs";

const STORY_PIECE_TYPES = new Set([
  "character",
  "desire",
  "need",
  "location",
  "relationship",
  "object",
  "conflict",
  "secret",
  "event",
  "world-rule",
  "story-technique",
  "agent-binding",
]);
const STORY_SCHOOLS = new Set(["character", "plot", "world", "conflict", "theme", "style"]);
const STORY_VISIBILITIES = new Set(["private", "unlisted", "public"]);
const STORY_AUTHORSHIP = new Set(["human", "generated-proposal", "engine", "imported"]);
const PIECE_FIELDS = [
  "id",
  "schemaVersion",
  "type",
  "title",
  "description",
  "worldId",
  "schools",
  "tags",
  "visibility",
  "stateRefs",
  "ruleIds",
  "relationshipIds",
  "assetRefs",
  "agentBinding",
  "curriculumRefs",
  "provenance",
  "createdAt",
  "updatedAt",
];
const PROVENANCE_FIELDS = ["authorship", "creatorRef", "sourceRefs", "admittedByRef", "admittedAt"];
const AGENT_BINDING_FIELDS = ["storyAgentDefinitionId", "characterId", "approvedRoleTemplateRef", "hostAuthorityRef"];

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isReference(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value));
}

function stablePieceJson(value) {
  if (Array.isArray(value)) return `[${value.map((item) => stablePieceJson(item)).join(",")}]`;
  if (isRecord(value)) {
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stablePieceJson(value[key])}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function collectPieceShapeErrors({ value, allowedFields, label }) {
  if (!isRecord(value)) return [];
  const allowed = new Set(allowedFields);
  const unsupported = Object.keys(value).filter((field) => !allowed.has(field));
  return unsupported.map((field) => `${label} contains unsupported field ${field}`);
}

function referenceListErrors({ value, label, unique = true }) {
  if (!Array.isArray(value) || value.some((entry) => !isReference(entry))) {
    return [`${label} must contain reference strings only`];
  }
  if (unique && new Set(value).size !== value.length) return [`${label} must not contain duplicates`];
  return [];
}

function textListErrors({ value, label }) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    return [`${label} must contain non-empty strings only`];
  }
  if (new Set(value).size !== value.length) return [`${label} must not contain duplicates`];
  return [];
}

function validTimestamp(value) {
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function validatePieceProvenance(provenance) {
  if (!isRecord(provenance)) return ["Story Piece provenance must be an object"];
  const errors = collectPieceShapeErrors({ value: provenance, allowedFields: PROVENANCE_FIELDS, label: "Story Piece provenance" });
  if (!STORY_AUTHORSHIP.has(provenance.authorship)) errors.push("Story Piece provenance authorship is unsupported");
  if (!isReference(provenance.creatorRef)) errors.push("Story Piece provenance creatorRef is required");
  errors.push(...referenceListErrors({ value: provenance.sourceRefs, label: "Story Piece provenance sourceRefs" }));
  if (provenance.admittedByRef !== null && !isReference(provenance.admittedByRef)) {
    errors.push("Story Piece provenance admittedByRef must be null or a reference");
  }
  if (provenance.admittedAt !== null && !validTimestamp(provenance.admittedAt)) {
    errors.push("Story Piece provenance admittedAt must be null or a valid timestamp");
  }
  if ((provenance.admittedByRef === null) !== (provenance.admittedAt === null)) {
    errors.push("Story Piece provenance admission reference and timestamp must be set together");
  }
  return errors;
}

function validateAgentBinding(binding) {
  if (binding === null) return [];
  if (!isRecord(binding)) return ["Story Piece agentBinding must be null or an object"];
  const errors = collectPieceShapeErrors({ value: binding, allowedFields: AGENT_BINDING_FIELDS, label: "Story Piece agentBinding" });
  for (const field of AGENT_BINDING_FIELDS) {
    if (!isReference(binding[field])) errors.push(`Story Piece agentBinding.${field} must be a reference`);
  }
  return errors;
}

export function validateStoryPieceForPersistence(piece, { requireAdmission = true } = {}) {
  if (!isRecord(piece)) return { ok: false, errors: ["Story Piece must be an object"] };
  const errors = collectPieceShapeErrors({ value: piece, allowedFields: PIECE_FIELDS, label: "Story Piece" });
  if (!isReference(piece.id)) errors.push("Story Piece id is required");
  if (piece.schemaVersion !== 1) errors.push("Story Piece schemaVersion must equal 1");
  if (!STORY_PIECE_TYPES.has(piece.type)) errors.push("Story Piece type is unsupported");
  if (typeof piece.title !== "string" || !piece.title.trim()) errors.push("Story Piece title is required");
  if (typeof piece.description !== "string") errors.push("Story Piece description must be a string");
  if (!isReference(piece.worldId)) errors.push("Story Piece worldId is required");
  if (!Array.isArray(piece.schools) || piece.schools.some((school) => !STORY_SCHOOLS.has(school))) {
    errors.push("Story Piece schools contain an unsupported school");
  } else if (new Set(piece.schools).size !== piece.schools.length) {
    errors.push("Story Piece schools must not contain duplicates");
  }
  errors.push(...textListErrors({ value: piece.tags, label: "Story Piece tags" }));
  if (!STORY_VISIBILITIES.has(piece.visibility)) errors.push("Story Piece visibility is unsupported");
  errors.push(...referenceListErrors({ value: piece.stateRefs, label: "Story Piece stateRefs" }));
  errors.push(...referenceListErrors({ value: piece.ruleIds, label: "Story Piece ruleIds" }));
  errors.push(...referenceListErrors({ value: piece.relationshipIds, label: "Story Piece relationshipIds" }));
  errors.push(...referenceListErrors({ value: piece.assetRefs, label: "Story Piece assetRefs" }));
  errors.push(...validateAgentBinding(piece.agentBinding));
  errors.push(...referenceListErrors({ value: piece.curriculumRefs, label: "Story Piece curriculumRefs" }));
  errors.push(...validatePieceProvenance(piece.provenance));
  if (!validTimestamp(piece.createdAt)) errors.push("Story Piece createdAt must be a valid timestamp");
  if (!validTimestamp(piece.updatedAt)) errors.push("Story Piece updatedAt must be a valid timestamp");
  if (validTimestamp(piece.createdAt) && validTimestamp(piece.updatedAt)
    && Date.parse(piece.updatedAt) < Date.parse(piece.createdAt)) {
    errors.push("Story Piece updatedAt cannot precede createdAt");
  }
  if (requireAdmission && ["generated-proposal", "imported"].includes(piece.provenance?.authorship)
    && (piece.provenance.admittedByRef === null || piece.provenance.admittedAt === null)) {
    errors.push(`${piece.provenance.authorship} Story Pieces require explicit admission before authoritative persistence`);
  }
  return { ok: errors.length === 0, errors };
}

function readPieceExtension(project) {
  if (!isRecord(project) || !isReference(project.id)) throw new Error("PlotPickle project with an id is required for Story Piece persistence");
  const extensions = isRecord(project.extensions) ? project.extensions : {};
  if (!Object.prototype.hasOwnProperty.call(extensions, STORY_PROJECT_EXTENSION_KEY)) {
    return {
      extensions,
      store: { version: STORY_PROJECT_PERSISTENCE_VERSION, sessions: {}, storyPieces: {} },
    };
  }
  const store = extensions[STORY_PROJECT_EXTENSION_KEY];
  if (!isRecord(store) || store.version !== STORY_PROJECT_PERSISTENCE_VERSION) {
    throw new Error("Cannot use incompatible or malformed STORY project extension for Story Piece persistence");
  }
  const containerValidation = validateStoryProjectExtensionContainer(store);
  if (!containerValidation.ok) {
    throw new Error(`Cannot use malformed STORY project extension: ${containerValidation.errors.join("; ")}`);
  }
  if (Object.prototype.hasOwnProperty.call(store, "storyPieces") && !isRecord(store.storyPieces)) {
    throw new Error("Cannot use malformed STORY storyPieces store");
  }
  return { extensions, store };
}

export function persistStoryPiece(project, piece) {
  const validation = validateStoryPieceForPersistence(piece);
  if (!validation.ok) throw new Error(`Cannot persist Story Piece: ${validation.errors.join("; ")}`);
  const { extensions, store } = readPieceExtension(project);
  const pieces = isRecord(store.storyPieces) ? store.storyPieces : {};
  const existing = pieces[piece.id];
  if (existing !== undefined) {
    const existingValidation = validateStoryPieceForPersistence(existing);
    if (!existingValidation.ok) {
      throw new Error(`Cannot overwrite invalid stored Story Piece ${piece.id}: ${existingValidation.errors.join("; ")}`);
    }
    if (stablePieceJson(existing) !== stablePieceJson(piece)) {
      throw new Error(`Story Piece ${piece.id} already exists with different authoritative content`);
    }
    return { status: "duplicate", project, piece: cloneJson(existing) };
  }
  const storedPiece = cloneJson(piece);
  return {
    status: "stored",
    project: {
      ...project,
      extensions: {
        ...extensions,
        [STORY_PROJECT_EXTENSION_KEY]: {
          ...store,
          version: STORY_PROJECT_PERSISTENCE_VERSION,
          sessions: isRecord(store.sessions) ? store.sessions : {},
          storyPieces: { ...pieces, [piece.id]: storedPiece },
        },
      },
    },
    piece: cloneJson(storedPiece),
  };
}

export function loadStoryPiece(project, pieceId) {
  if (!isReference(pieceId)) return { ok: false, reason: "invalid-piece-id", piece: null, errors: ["Story Piece id is required"] };
  let store;
  try {
    ({ store } = readPieceExtension(project));
  } catch (error) {
    return { ok: false, reason: "invalid-extension", piece: null, errors: [String(error?.message ?? error)] };
  }
  const pieces = isRecord(store.storyPieces) ? store.storyPieces : {};
  if (!Object.prototype.hasOwnProperty.call(pieces, pieceId)) {
    return { ok: false, reason: "not-found", piece: null, errors: [] };
  }
  const stored = pieces[pieceId];
  const validation = validateStoryPieceForPersistence(stored);
  if (!validation.ok || stored.id !== pieceId) {
    return {
      ok: false,
      reason: "invalid-piece",
      piece: null,
      errors: stored?.id !== pieceId ? [...validation.errors, "Story Piece id does not match its index key"] : validation.errors,
    };
  }
  return { ok: true, reason: null, piece: cloneJson(stored), errors: [] };
}
