import { validateStoryAgentDefinition } from "../contract-invariants.mjs";

export const STORY_CHARACTER_AGENT_HOST_AUTHORITY_REF = "agent-contract:story-character/v1";
export const STORY_CHARACTER_AGENT_PROFILE_REF_PREFIX = "agent-profile:";
export const STORY_CHARACTER_AUTONOMY_MODES = Object.freeze(["manual", "assisted", "autonomous"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredReference(value, label) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function referenceList(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new Error(`${label} must contain reference strings only`);
  }
  const normalized = value.map((entry) => entry.trim());
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} must not contain duplicates`);
  return normalized;
}

function provenance({ creatorRef, sourceRefs = [], admittedByRef = null, admittedAt = null, authorship = "human" }) {
  const normalized = {
    authorship,
    creatorRef: requiredReference(creatorRef, "Story Agent creatorRef"),
    sourceRefs: referenceList(sourceRefs, "Story Agent sourceRefs"),
    admittedByRef,
    admittedAt,
  };
  if ((normalized.admittedByRef === null) !== (normalized.admittedAt === null)) {
    throw new Error("Story Agent admission reference and timestamp must be set together");
  }
  if (normalized.admittedByRef !== null) requiredReference(normalized.admittedByRef, "Story Agent admittedByRef");
  if (normalized.admittedAt !== null && !Number.isFinite(Date.parse(normalized.admittedAt))) {
    throw new Error("Story Agent admittedAt must be a valid timestamp");
  }
  return normalized;
}

export function createStoryAgentDefinition({
  id,
  worldId,
  characterId,
  approvedProfileId,
  personalityRefs = [],
  goalRefs = [],
  knowledgePolicyRef,
  memoryScopeRef,
  gameActionPermissionRefs = [],
  creatorRef,
  sourceRefs = [],
  authorship = "human",
  admittedByRef = null,
  admittedAt = null,
} = {}) {
  const profileId = requiredReference(approvedProfileId, "approvedProfileId");
  const definition = {
    id: requiredReference(id, "Story Agent id"),
    schemaVersion: 1,
    worldId: requiredReference(worldId, "Story Agent worldId"),
    characterId: requiredReference(characterId, "Story Agent characterId"),
    approvedRoleTemplateRef: `${STORY_CHARACTER_AGENT_PROFILE_REF_PREFIX}${profileId}`,
    hostAuthorityRef: STORY_CHARACTER_AGENT_HOST_AUTHORITY_REF,
    personalityRefs: referenceList(personalityRefs, "Story Agent personalityRefs"),
    goalRefs: referenceList(goalRefs, "Story Agent goalRefs"),
    knowledgePolicyRef: requiredReference(knowledgePolicyRef, "Story Agent knowledgePolicyRef"),
    memoryScopeRef: requiredReference(memoryScopeRef, "Story Agent memoryScopeRef"),
    gameActionPermissionRefs: referenceList(gameActionPermissionRefs, "Story Agent gameActionPermissionRefs"),
    provenance: provenance({ creatorRef, sourceRefs, authorship, admittedByRef, admittedAt }),
  };
  const validation = validateStoryAgentDefinition(definition);
  if (!validation.ok) throw new Error(`Story Agent Definition is invalid: ${validation.errors.join("; ")}`);
  return Object.freeze(structuredClone(definition));
}

export function attachStoryAgentDefinitionsToWorldBundle(bundle, definitions = []) {
  if (!isRecord(bundle) || !isRecord(bundle.world) || typeof bundle.world.id !== "string") {
    throw new Error("A Story World bundle is required before attaching Story Agent Definitions");
  }
  if (!Array.isArray(definitions)) throw new Error("Story Agent Definitions must be an array");
  const seen = new Set();
  const accepted = definitions.map((definition) => {
    const validation = validateStoryAgentDefinition(definition);
    if (!validation.ok) throw new Error(`Story Agent Definition is invalid: ${validation.errors.join("; ")}`);
    if (definition.worldId !== bundle.world.id) throw new Error(`Story Agent ${definition.id} belongs to another Story World`);
    if (seen.has(definition.id)) throw new Error(`Duplicate Story Agent Definition ${definition.id}`);
    seen.add(definition.id);
    return structuredClone(definition);
  });
  return Object.freeze(structuredClone({
    ...bundle,
    storyAgentDefinitions: accepted,
  }));
}

export function loadStoryAgentDefinitionsFromWorldBundle(bundle) {
  if (!isRecord(bundle) || !isRecord(bundle.world) || typeof bundle.world.id !== "string") {
    return { ok: false, reason: "invalid-world-bundle", definitions: [], errors: ["Story World bundle is required"] };
  }
  const raw = bundle.storyAgentDefinitions ?? [];
  if (!Array.isArray(raw)) {
    return { ok: false, reason: "invalid-agent-definitions", definitions: [], errors: ["storyAgentDefinitions must be an array"] };
  }
  const definitions = [];
  const errors = [];
  const seen = new Set();
  for (const definition of raw) {
    const validation = validateStoryAgentDefinition(definition);
    if (!validation.ok) {
      errors.push(...validation.errors.map((error) => `Story Agent Definition: ${error}`));
      continue;
    }
    if (definition.worldId !== bundle.world.id) errors.push(`Story Agent ${definition.id} belongs to another Story World`);
    if (seen.has(definition.id)) errors.push(`Duplicate Story Agent Definition ${definition.id}`);
    seen.add(definition.id);
    definitions.push(structuredClone(definition));
  }
  return errors.length
    ? { ok: false, reason: "invalid-agent-definitions", definitions: [], errors }
    : { ok: true, reason: null, definitions, errors: [] };
}

export function createStoryAgentContinuityRef({ definition, characterState }) {
  const validation = validateStoryAgentDefinition(definition);
  if (!validation.ok) throw new Error(`Story Agent Definition is invalid: ${validation.errors.join("; ")}`);
  if (!isRecord(characterState)
    || characterState.characterId !== definition.characterId
    || !Number.isSafeInteger(characterState.revision)
    || characterState.revision < 0) {
    throw new Error("Story Agent continuity requires a matching revisioned character state");
  }
  return Object.freeze({
    definitionId: definition.id,
    characterId: definition.characterId,
    characterStateRef: `story-character-state:${definition.characterId}@${characterState.revision}`,
    approvedRoleTemplateRef: definition.approvedRoleTemplateRef,
    hostAuthorityRef: definition.hostAuthorityRef,
    runtimeExecutionRef: null,
    contextEnvelopeRef: null,
    activationTier: "cold",
  });
}
