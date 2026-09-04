export const STORY_CONTRACT_SCHEMA_VERSION = 1;

export const STORY_CHARACTER_ACTIVATION_TIERS = Object.freeze([
  "cold",
  "warm",
  "hot",
  "agent-active",
]);

export const STORY_CHARACTER_ACTIVATION_TRANSITIONS = Object.freeze({
  cold: Object.freeze(["warm"]),
  warm: Object.freeze(["cold", "hot"]),
  hot: Object.freeze(["cold", "warm", "agent-active"]),
  "agent-active": Object.freeze(["cold", "warm", "hot"]),
});

export const STORY_SCENE_TRANSITIONS = Object.freeze({
  ready: Object.freeze(["active"]),
  active: Object.freeze(["resolving", "failed"]),
  resolving: Object.freeze(["active", "resolved", "failed"]),
  resolved: Object.freeze([]),
  failed: Object.freeze([]),
});

export const STORY_VALIDATOR_SEVERITIES = Object.freeze(["error", "warning", "note", "pass"]);

export const STORY_CHARACTER_GRAPH_NODE_FIELDS = Object.freeze([
  "id",
  "schemaVersion",
  "worldId",
  "definitionRef",
  "stateRef",
  "relationshipIndexRef",
  "memoryIndexRef",
  "knowledgeIndexRef",
  "assetIndexRef",
]);

const STORY_CHARACTER_ACTIVATION_FIELDS = Object.freeze([
  "characterId",
  "tier",
  "hydratedRef",
  "activeSceneId",
  "inferenceRequestRef",
  "budgetRef",
]);

const STORY_AGENT_DEFINITION_FIELDS = Object.freeze([
  "id",
  "schemaVersion",
  "worldId",
  "characterId",
  "approvedRoleTemplateRef",
  "hostAuthorityRef",
  "personalityRefs",
  "goalRefs",
  "knowledgePolicyRef",
  "memoryScopeRef",
  "gameActionPermissionRefs",
  "provenance",
]);

const HOST_AUTHORITY_FIELDS = new Set([
  "tools",
  "toolDefinitions",
  "connectors",
  "credentials",
  "secrets",
  "providerAuthority",
  "providerCredentials",
  "sourceMutationAuthority",
  "ppfWriteAuthority",
  "skillInstallAuthority",
  "skillActivationAuthority",
  "runtime",
  "runtimeInstance",
]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(record, field, errors) {
  if (typeof record[field] !== "string" || !record[field].trim()) {
    errors.push(`${field} must be a non-empty reference string`);
  }
}

function requireNull(record, field, tier, errors) {
  if (record[field] !== null) errors.push(`${field} must be null while character is ${tier}`);
}

function unknownFields(record, allowed) {
  const permitted = new Set(allowed);
  return Object.keys(record).filter((field) => !permitted.has(field));
}

function findAuthorityFields(value, path = "storyAgentDefinition", findings = []) {
  if (!isRecord(value) && !Array.isArray(value)) return findings;
  for (const [field, child] of Object.entries(value)) {
    const fieldPath = `${path}.${field}`;
    if (HOST_AUTHORITY_FIELDS.has(field)) findings.push(fieldPath);
    findAuthorityFields(child, fieldPath, findings);
  }
  return findings;
}

export function validateStoryCharacterGraphNode(value) {
  if (!isRecord(value)) {
    return { ok: false, errors: ["graph node must be an object"] };
  }
  const errors = [];
  for (const field of unknownFields(value, STORY_CHARACTER_GRAPH_NODE_FIELDS)) {
    errors.push(`graph node cannot embed ${field}; store a lightweight reference instead`);
  }
  for (const field of [
    "id",
    "worldId",
    "definitionRef",
    "stateRef",
    "relationshipIndexRef",
    "memoryIndexRef",
    "knowledgeIndexRef",
    "assetIndexRef",
  ]) requiredString(value, field, errors);
  if (value.schemaVersion !== STORY_CONTRACT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must equal ${STORY_CONTRACT_SCHEMA_VERSION}`);
  }
  return { ok: errors.length === 0, errors };
}

export function validateStoryCharacterActivation(value) {
  if (!isRecord(value)) {
    return { ok: false, errors: ["character activation must be an object"] };
  }
  const errors = [];
  for (const field of unknownFields(value, STORY_CHARACTER_ACTIVATION_FIELDS)) {
    errors.push(`character activation cannot embed ${field}; keep durable character state outside the runtime activation record`);
  }
  requiredString(value, "characterId", errors);
  if (!STORY_CHARACTER_ACTIVATION_TIERS.includes(value.tier)) {
    errors.push("tier must be a supported STORY character activation tier");
    return { ok: false, errors };
  }

  if (value.tier === "cold") {
    for (const field of ["hydratedRef", "activeSceneId", "inferenceRequestRef", "budgetRef"]) {
      requireNull(value, field, value.tier, errors);
    }
  }

  if (value.tier === "warm") {
    requiredString(value, "hydratedRef", errors);
    for (const field of ["activeSceneId", "inferenceRequestRef", "budgetRef"]) {
      requireNull(value, field, value.tier, errors);
    }
  }

  if (value.tier === "hot") {
    requiredString(value, "hydratedRef", errors);
    requiredString(value, "activeSceneId", errors);
    for (const field of ["inferenceRequestRef", "budgetRef"]) {
      requireNull(value, field, value.tier, errors);
    }
  }

  if (value.tier === "agent-active") {
    for (const field of ["hydratedRef", "activeSceneId", "inferenceRequestRef", "budgetRef"]) {
      requiredString(value, field, errors);
    }
  }

  return { ok: errors.length === 0, errors };
}

export function validateStoryCharacterActivationTransition(from, to) {
  const allowed = STORY_CHARACTER_ACTIVATION_TRANSITIONS[from];
  if (!allowed) return { ok: false, code: "unknown-activation-tier", allowed: [] };
  if (!allowed.includes(to)) return { ok: false, code: "invalid-activation-transition", allowed: [...allowed] };
  return { ok: true, code: "accepted", allowed: [...allowed] };
}

export function coolStoryCharacterActivation(value) {
  const validation = validateStoryCharacterActivation(value);
  if (!validation.ok) return { ok: false, errors: validation.errors, activation: null };
  return {
    ok: true,
    errors: [],
    activation: {
      characterId: value.characterId,
      tier: "cold",
      hydratedRef: null,
      activeSceneId: null,
      inferenceRequestRef: null,
      budgetRef: null,
    },
  };
}

export function validateStoryAgentDefinition(value) {
  if (!isRecord(value)) {
    return { ok: false, errors: ["story agent definition must be an object"] };
  }
  const errors = [];
  for (const field of unknownFields(value, STORY_AGENT_DEFINITION_FIELDS)) {
    errors.push(`story agent definition contains unsupported field ${field}`);
  }
  for (const fieldPath of findAuthorityFields(value)) {
    errors.push(`${fieldPath} cannot grant host authority`);
  }
  for (const field of [
    "id",
    "worldId",
    "characterId",
    "approvedRoleTemplateRef",
    "hostAuthorityRef",
    "knowledgePolicyRef",
    "memoryScopeRef",
  ]) requiredString(value, field, errors);
  if (value.schemaVersion !== STORY_CONTRACT_SCHEMA_VERSION) {
    errors.push(`schemaVersion must equal ${STORY_CONTRACT_SCHEMA_VERSION}`);
  }
  for (const field of ["personalityRefs", "goalRefs", "gameActionPermissionRefs"]) {
    if (!Array.isArray(value[field]) || value[field].some((item) => typeof item !== "string")) {
      errors.push(`${field} must contain reference strings only`);
    }
  }
  return { ok: errors.length === 0, errors };
}

export function validateStorySceneTransition(from, to) {
  const allowed = STORY_SCENE_TRANSITIONS[from];
  if (!allowed) return { ok: false, code: "unknown-scene-status", allowed: [] };
  if (!allowed.includes(to)) return { ok: false, code: "invalid-scene-transition", allowed: [...allowed] };
  return { ok: true, code: "accepted", allowed: [...allowed] };
}

export function storyValidationAllowsLaunch(findings) {
  return !findings.some((finding) => finding?.severity === "error");
}
