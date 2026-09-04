const STORY_KNOWLEDGE_PARTITIONS = new Set([
  "world-truth",
  "audience",
  "player",
  "character",
  "agent-visible",
  "creator-hidden",
]);

const STORY_KNOWLEDGE_CONTEXT_SCOPES = new Set(["audience", "player", "character", "agent"]);
const STORY_KNOWLEDGE_REFERENCE_FIELDS = new Set(["ref", "partition", "subjectRef"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isReference(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function unknownFields(value) {
  if (!isRecord(value)) return [];
  return Object.keys(value).filter((field) => !STORY_KNOWLEDGE_REFERENCE_FIELDS.has(field));
}

export function validateStoryKnowledgeReference(reference) {
  if (!isRecord(reference)) return { ok: false, errors: ["knowledge reference must be an object"] };
  const errors = [];
  const extraFields = unknownFields(reference);
  if (extraFields.length) {
    errors.push(`knowledge reference contains unsupported fields: ${extraFields.sort().join(", ")}`);
  }
  if (!isReference(reference.ref)) errors.push("knowledge reference ref is required");
  if (!STORY_KNOWLEDGE_PARTITIONS.has(reference.partition)) errors.push("knowledge reference partition is unsupported");
  if (!isReference(reference.subjectRef)) errors.push("knowledge reference subjectRef is required");
  return { ok: errors.length === 0, errors };
}

export function validateStoryKnowledgeReferenceSet(references) {
  if (!Array.isArray(references)) return { ok: false, errors: ["knowledge references must be an array"] };
  const errors = [];
  const seenRefs = new Set();
  for (const reference of references) {
    const validation = validateStoryKnowledgeReference(reference);
    if (!validation.ok) {
      errors.push(...validation.errors.map((error) => `${isReference(reference?.ref) ? reference.ref : "unknown"}: ${error}`));
      continue;
    }
    if (seenRefs.has(reference.ref)) errors.push(`knowledge reference ${reference.ref} is duplicated`);
    seenRefs.add(reference.ref);
  }
  return { ok: errors.length === 0, errors };
}

function referenceIsVisible(reference, scope, subjectRef) {
  if (scope === "audience") return reference.partition === "audience";
  if (scope === "player") return reference.partition === "player";
  if (scope === "character") {
    return reference.partition === "character" && reference.subjectRef === subjectRef;
  }
  if (scope === "agent") {
    return reference.partition === "agent-visible" && reference.subjectRef === subjectRef;
  }
  return false;
}

export function projectStoryKnowledgeRefs({ references, scope, subjectRef = null }) {
  const validation = validateStoryKnowledgeReferenceSet(references);
  if (!validation.ok) throw new Error(`Invalid STORY knowledge reference set: ${validation.errors.join("; ")}`);
  if (!STORY_KNOWLEDGE_CONTEXT_SCOPES.has(scope)) {
    throw new Error(`Unsupported STORY knowledge context scope ${String(scope)}`);
  }
  if ((scope === "character" || scope === "agent") && !isReference(subjectRef)) {
    throw new Error(`${scope} STORY knowledge context requires a subjectRef`);
  }
  if ((scope === "audience" || scope === "player") && subjectRef !== null) {
    throw new Error(`${scope} STORY knowledge context must not carry a subjectRef`);
  }

  return references
    .filter((reference) => referenceIsVisible(reference, scope, subjectRef))
    .map((reference) => reference.ref)
    .sort((left, right) => left.localeCompare(right));
}

export function serializeStoryKnowledgeContext(input) {
  const scope = input?.scope;
  const subjectRef = input?.subjectRef ?? null;
  const knowledgeRefs = projectStoryKnowledgeRefs({
    references: input?.references,
    scope,
    subjectRef,
  });
  return {
    scope,
    subjectRef: scope === "character" || scope === "agent" ? subjectRef : null,
    knowledgeRefs,
  };
}
