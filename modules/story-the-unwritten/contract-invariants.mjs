export const STORY_CONTRACT_SCHEMA_VERSION = 1;

export const STORY_CHARACTER_ACTIVATION_TIERS = Object.freeze([
  "cold",
  "warm",
  "hot",
  "agent-active",
]);

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
