const MEMORY_RETRIEVAL_SCOPES = Object.freeze(["human", "project", "agent"]);
const MEMORY_RETRIEVAL_SCOPE_SET = new Set(MEMORY_RETRIEVAL_SCOPES);
const MAX_QUERY_TERMS = 24;

function requiredQueryText(value) {
  if (typeof value !== "string" || !value.trim()) throw new Error("Memory retrieval text is required.");
  return value.trim().slice(0, 2_000);
}

function optionalId(value, label) {
  if (value == null || value === "") return null;
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} must be a string.`);
  return value.trim().slice(0, 200);
}

function boundedInteger(value, fallback, minimum, maximum) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(minimum, Math.min(maximum, Math.floor(numeric)));
}

function queryTerms(text) {
  return [...new Set(text.toLowerCase().match(/[\p{L}\p{N}][\p{L}\p{N}'-]*/gu) || [])]
    .filter((term) => term.length >= 2)
    .slice(0, MAX_QUERY_TERMS);
}

function requestedScopes(input, projectId, agentId) {
  if (input.scopes == null) {
    const defaults = ["human"];
    if (projectId) defaults.push("project");
    if (agentId) defaults.push("agent");
    return defaults;
  }
  if (!Array.isArray(input.scopes) || !input.scopes.length) throw new Error("Memory retrieval scopes must be a non-empty array.");
  const scopes = [...new Set(input.scopes.map((scope) => String(scope).trim()))];
  for (const scope of scopes) {
    if (!MEMORY_RETRIEVAL_SCOPE_SET.has(scope)) throw new Error(`Unsupported memory retrieval scope: ${scope}.`);
  }
  if (scopes.includes("project") && !projectId) throw new Error("Project memory retrieval requires a project ID.");
  if (scopes.includes("agent") && !agentId) throw new Error("Agent memory retrieval requires an agent ID.");
  return scopes;
}

function scopeWeight(scope) {
  if (scope === "agent") return 3;
  if (scope === "project") return 2;
  return 1;
}

function relevance(record, terms, phrase) {
  const content = record.content.toLowerCase();
  const tags = new Set(record.tags.map((tag) => tag.toLowerCase()));
  const matchedTerms = terms.filter((term) => content.includes(term));
  const matchedTags = terms.filter((term) => tags.has(term));
  const phraseMatch = phrase.length >= 4 && content.includes(phrase);
  const score = scopeWeight(record.scope) + matchedTerms.length * 6 + matchedTags.length * 12 + (phraseMatch ? 20 : 0);
  return { score, matchedTerms, matchedTags };
}

function excerpt(content, maximum) {
  if (content.length <= maximum) return { value: content, clipped: false };
  if (maximum <= 1) return { value: content.slice(0, maximum), clipped: true };
  return { value: `${content.slice(0, maximum - 1).trimEnd()}…`, clipped: true };
}

function immutableRetrievalItem(record, ranked, bounded) {
  return Object.freeze({
    id: record.id,
    scope: record.scope,
    projectId: record.projectId,
    agentId: record.agentId,
    source: record.source,
    authority: record.authority,
    tags: Object.freeze([...record.tags]),
    updatedAt: record.updatedAt,
    excerpt: bounded.value,
    clipped: bounded.clipped,
    score: ranked.score,
    matchedTerms: Object.freeze([...ranked.matchedTerms]),
    matchedTags: Object.freeze([...ranked.matchedTags]),
  });
}

export async function retrieveRelevantMemories(memoryService, proof, value = {}) {
  if (!memoryService || typeof memoryService.listMemories !== "function") {
    throw new Error("Memory retrieval requires the host-owned Memory Service.");
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Memory retrieval query must be an object.");
  if (Object.prototype.hasOwnProperty.call(value, "profileId") || Object.prototype.hasOwnProperty.call(value, "ownerProfileId")) {
    throw new Error("Memory retrieval profile authority comes from the authenticated session.");
  }

  const text = requiredQueryText(value.text);
  const phrase = text.toLowerCase();
  const terms = queryTerms(text);
  const projectId = optionalId(value.projectId, "Memory retrieval project ID");
  const agentId = optionalId(value.agentId, "Memory retrieval agent ID");
  const scopes = requestedScopes(value, projectId, agentId);
  const maxResults = boundedInteger(value.maxResults, 4, 1, 8);
  const maxCharacters = boundedInteger(value.maxCharacters, 2_400, 160, 8_000);
  const candidates = [];

  for (const scope of scopes) {
    if (scope === "human") {
      candidates.push(...await memoryService.listMemories(proof, { scope: "human" }));
      continue;
    }
    if (scope === "project") {
      candidates.push(...await memoryService.listMemories(proof, { scope: "project", projectId }));
      continue;
    }
    const agentRecords = await memoryService.listMemories(proof, {
      scope: "agent",
      agentId,
      ...(projectId ? { projectId } : {}),
    });
    candidates.push(...agentRecords.filter((record) => projectId ? record.projectId === projectId : record.projectId === null));
  }

  const ranked = candidates
    .filter((record) => record.status === "active")
    .map((record) => ({ record, ...relevance(record, terms, phrase) }))
    .filter((item) => item.score > scopeWeight(item.record.scope))
    .sort((left, right) => {
      if (left.score !== right.score) return right.score - left.score;
      const recency = Date.parse(right.record.updatedAt) - Date.parse(left.record.updatedAt);
      return recency || left.record.id.localeCompare(right.record.id);
    });

  const items = [];
  let usedCharacters = 0;
  for (const item of ranked) {
    if (items.length >= maxResults || usedCharacters >= maxCharacters) break;
    const remaining = maxCharacters - usedCharacters;
    if (remaining < 80) break;
    const bounded = excerpt(item.record.content, Math.min(1_200, remaining));
    items.push(immutableRetrievalItem(item.record, item, bounded));
    usedCharacters += bounded.value.length;
  }

  return Object.freeze({
    query: text,
    scopes: Object.freeze([...scopes]),
    maxResults,
    maxCharacters,
    usedCharacters,
    approximateTokens: Math.ceil(usedCharacters / 4),
    matchedCount: ranked.length,
    droppedCount: Math.max(0, ranked.length - items.length),
    items: Object.freeze(items),
  });
}
