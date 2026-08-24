import { randomUUID } from "node:crypto";

export const MEMORY_RECORD_VERSION = 1;
export const MEMORY_AUTHORITY = "contextual";
export const MEMORY_SCOPES = Object.freeze(["human", "project", "agent"]);
export const MEMORY_SOURCES = Object.freeze(["human", "agent", "project"]);
export const MEMORY_STATUSES = Object.freeze(["active", "forgotten"]);

const MEMORY_SCOPE_SET = new Set(MEMORY_SCOPES);
const MEMORY_SOURCE_SET = new Set(MEMORY_SOURCES);
const MEMORY_STATUS_SET = new Set(MEMORY_STATUSES);
const HOST_OWNED_WRITE_FIELDS = Object.freeze([
  "profileId",
  "ownerProfileId",
  "authority",
  "status",
  "createdAt",
  "updatedAt",
]);
const MAX_MEMORY_CONTENT = 8_000;
const MAX_MEMORY_TAGS = 12;
const MAX_MEMORY_TAG_LENGTH = 64;

function memoryObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object.`);
  return value;
}

function memoryText(value, label, maximum = 256) {
  if (typeof value !== "string") throw new Error(`${label} must be a string.`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required.`);
  if (normalized.length > maximum) throw new Error(`${label} exceeds ${maximum} characters.`);
  return normalized;
}

function optionalMemoryText(value, label, maximum = 256) {
  if (value == null || value === "") return null;
  return memoryText(value, label, maximum);
}

function memoryTimestamp(value, label) {
  const normalized = memoryText(value, label, 64);
  const parsed = Date.parse(normalized);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be an ISO timestamp.`);
  return new Date(parsed).toISOString();
}

function memoryTags(value) {
  if (value == null) return [];
  if (!Array.isArray(value)) throw new Error("Memory tags must be an array.");
  if (value.length > MAX_MEMORY_TAGS) throw new Error(`Memory tags exceed ${MAX_MEMORY_TAGS} entries.`);
  return [...new Set(value.map((tag) => memoryText(tag, "Memory tag", MAX_MEMORY_TAG_LENGTH).toLowerCase()))].sort();
}

function assertHostOwnedWriteFields(input) {
  for (const field of HOST_OWNED_WRITE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(input, field)) {
      throw new Error(`Memory field ${field} is host-owned and cannot be supplied by a caller.`);
    }
  }
}

function memoryScope(value) {
  const normalized = memoryText(value, "Memory scope", 32);
  if (!MEMORY_SCOPE_SET.has(normalized)) throw new Error(`Unsupported memory scope: ${normalized}.`);
  return normalized;
}

function memorySource(value) {
  const normalized = memoryText(value, "Memory source", 32);
  if (!MEMORY_SOURCE_SET.has(normalized)) throw new Error(`Unsupported memory source: ${normalized}.`);
  return normalized;
}

function memoryStatus(value) {
  const normalized = memoryText(value, "Memory status", 32);
  if (!MEMORY_STATUS_SET.has(normalized)) throw new Error(`Unsupported memory status: ${normalized}.`);
  return normalized;
}

function memoryProfile(authContext) {
  if (!authContext || typeof authContext !== "object") throw new Error("Memory requires an authenticated Human session.");
  return memoryText(authContext.profileId, "Authenticated Human profile", 160);
}

function sessionId(proof) {
  const candidate = memoryObject(proof, "Memory session proof");
  return memoryText(candidate.sessionId, "Memory session ID", 240);
}

function immutableRecord(record) {
  return Object.freeze({ ...record, tags: Object.freeze([...record.tags]) });
}

export function parseMemoryRecord(value) {
  const record = memoryObject(value, "Memory record");
  if (record.version !== MEMORY_RECORD_VERSION) throw new Error(`Memory record version must be ${MEMORY_RECORD_VERSION}.`);
  if (record.authority !== MEMORY_AUTHORITY) throw new Error("Memory authority must remain contextual; PPF is canonical.");
  const scope = memoryScope(record.scope);
  const projectId = optionalMemoryText(record.projectId, "Memory project ID", 200);
  const agentId = optionalMemoryText(record.agentId, "Memory agent ID", 200);
  if (scope === "project" && !projectId) throw new Error("Project memory requires an authoritative project ID.");
  if (scope === "agent" && !agentId) throw new Error("Agent memory requires an authoritative agent ID.");
  if (scope === "human" && (projectId || agentId)) throw new Error("Human memory cannot claim project or agent scope references.");
  if (scope === "project" && agentId) throw new Error("Project memory cannot claim an agent scope reference.");

  return immutableRecord({
    version: MEMORY_RECORD_VERSION,
    id: memoryText(record.id, "Memory ID", 240),
    scope,
    profileId: memoryText(record.profileId, "Memory profile ID", 160),
    projectId,
    agentId,
    content: memoryText(record.content, "Memory content", MAX_MEMORY_CONTENT),
    source: memorySource(record.source),
    authority: MEMORY_AUTHORITY,
    createdAt: memoryTimestamp(record.createdAt, "Memory createdAt"),
    updatedAt: memoryTimestamp(record.updatedAt, "Memory updatedAt"),
    tags: memoryTags(record.tags),
    status: memoryStatus(record.status),
  });
}

async function allowedBy(resolver, details, label) {
  if (typeof resolver !== "function") throw new Error(`${label} authorization is not configured on the host.`);
  if (await resolver(details) !== true) throw new Error(`${label} is outside the authenticated Human authority.`);
}

async function authorizeRecord(authContext, record, options) {
  if (record.profileId !== authContext.profileId) return false;
  if (record.projectId) {
    if (typeof options.authorizeProject !== "function") return false;
    if (await options.authorizeProject({ authContext, projectId: record.projectId }) !== true) return false;
  }
  if (record.agentId) {
    if (typeof options.authorizeAgent !== "function") return false;
    if (await options.authorizeAgent({ authContext, agentId: record.agentId, projectId: record.projectId }) !== true) return false;
  }
  return true;
}

async function authorizeWriteScope(authContext, input, options) {
  const scope = memoryScope(input.scope);
  const projectId = optionalMemoryText(input.projectId, "Memory project ID", 200);
  const agentId = optionalMemoryText(input.agentId, "Memory agent ID", 200);

  if (scope === "human") {
    if (projectId || agentId) throw new Error("Human memory cannot claim project or agent scope references.");
    return { scope, projectId: null, agentId: null };
  }
  if (scope === "project") {
    if (!projectId) throw new Error("Project memory requires a project ID.");
    if (agentId) throw new Error("Project memory cannot claim an agent scope reference.");
    await allowedBy(options.authorizeProject, { authContext, projectId }, "Project memory");
    return { scope, projectId, agentId: null };
  }
  if (!agentId) throw new Error("Agent memory requires an agent ID.");
  if (projectId) await allowedBy(options.authorizeProject, { authContext, projectId }, "Agent project memory");
  await allowedBy(options.authorizeAgent, { authContext, agentId, projectId }, "Agent memory");
  return { scope, projectId, agentId };
}

function activeProfileRecords(records, profileId) {
  return records.get(profileId) || new Map();
}

function memoryFilter(value) {
  if (value == null) return {};
  const input = memoryObject(value, "Memory query");
  if (Object.prototype.hasOwnProperty.call(input, "profileId") || Object.prototype.hasOwnProperty.call(input, "ownerProfileId")) {
    throw new Error("Memory profile authority is resolved from the authenticated session, not the query.");
  }
  return {
    scope: input.scope == null ? null : memoryScope(input.scope),
    projectId: optionalMemoryText(input.projectId, "Memory project ID", 200),
    agentId: optionalMemoryText(input.agentId, "Memory agent ID", 200),
    includeForgotten: input.includeForgotten === true,
  };
}

function matchesFilter(record, filter) {
  if (filter.scope && record.scope !== filter.scope) return false;
  if (filter.projectId && record.projectId !== filter.projectId) return false;
  if (filter.agentId && record.agentId !== filter.agentId) return false;
  if (!filter.includeForgotten && record.status !== "active") return false;
  return true;
}

export function resolveMemoryAgainstPpf({ ppfValue, memoryValue }) {
  const hasPpf = ppfValue !== undefined && ppfValue !== null && (!(typeof ppfValue === "string") || ppfValue.trim().length > 0);
  return Object.freeze({
    value: hasPpf ? ppfValue : memoryValue,
    authority: hasPpf ? "ppf" : "memory-context",
  });
}

export function createMemoryService(options = {}) {
  if (typeof options.resolveSession !== "function") throw new Error("Memory Service requires the host Auth session resolver.");
  const now = typeof options.now === "function" ? options.now : () => new Date().toISOString();
  const createId = typeof options.createId === "function" ? options.createId : () => `memory:${randomUUID()}`;
  const records = new Map();

  function resolveAuthority(proof) {
    const authoritative = options.resolveSession(sessionId(proof));
    return { ...authoritative, profileId: memoryProfile(authoritative) };
  }

  return Object.freeze({
    async saveMemory(proof, value) {
      const input = memoryObject(value, "Memory write");
      assertHostOwnedWriteFields(input);
      const authContext = resolveAuthority(proof);
      const scope = await authorizeWriteScope(authContext, input, options);
      const timestamp = memoryTimestamp(now(), "Memory host timestamp");
      const record = parseMemoryRecord({
        version: MEMORY_RECORD_VERSION,
        id: memoryText(createId(), "Memory ID", 240),
        scope: scope.scope,
        profileId: authContext.profileId,
        projectId: scope.projectId,
        agentId: scope.agentId,
        content: input.content,
        source: input.source,
        authority: MEMORY_AUTHORITY,
        createdAt: timestamp,
        updatedAt: timestamp,
        tags: input.tags,
        status: "active",
      });
      let profileRecords = records.get(authContext.profileId);
      if (!profileRecords) {
        profileRecords = new Map();
        records.set(authContext.profileId, profileRecords);
      }
      if (profileRecords.has(record.id)) throw new Error(`Memory ID already exists: ${record.id}.`);
      profileRecords.set(record.id, record);
      return record;
    },

    async listMemories(proof, query = {}) {
      const authContext = resolveAuthority(proof);
      const filter = memoryFilter(query);
      if (filter.projectId) await allowedBy(options.authorizeProject, { authContext, projectId: filter.projectId }, "Project memory query");
      if (filter.agentId) await allowedBy(options.authorizeAgent, { authContext, agentId: filter.agentId, projectId: filter.projectId }, "Agent memory query");
      const available = [];
      for (const record of activeProfileRecords(records, authContext.profileId).values()) {
        if (!matchesFilter(record, filter)) continue;
        if (await authorizeRecord(authContext, record, options)) available.push(record);
      }
      return Object.freeze(available.sort((left, right) => left.id.localeCompare(right.id)));
    },

    async forgetMemory(proof, memoryId) {
      const authContext = resolveAuthority(proof);
      const id = memoryText(memoryId, "Memory ID", 240);
      const profileRecords = activeProfileRecords(records, authContext.profileId);
      const current = profileRecords.get(id);
      if (!current || !(await authorizeRecord(authContext, current, options))) throw new Error("Memory was not found in the authenticated Human scope.");
      if (current.status === "forgotten") return current;
      const forgotten = parseMemoryRecord({
        ...current,
        updatedAt: memoryTimestamp(now(), "Memory host timestamp"),
        status: "forgotten",
      });
      profileRecords.set(id, forgotten);
      return forgotten;
    },
  });
}
