import { validateStoryRuleDefinition } from "../rules.mjs";
import { validateStoryPieceForPersistence } from "../story-piece-persistence.mjs";
import { STORY_PHASE3_PLAYABLE_PIECE_TYPES } from "./validator.mjs";

const PLAYABLE_TYPES = new Set(STORY_PHASE3_PLAYABLE_PIECE_TYPES);
const EDITABLE_PIECE_FIELDS = new Set([
  "title",
  "description",
  "schools",
  "tags",
  "visibility",
  "stateRefs",
  "ruleIds",
  "relationshipIds",
  "assetRefs",
  "curriculumRefs",
]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isReference(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function isoTimestamp(value, label) {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error(`${label} must be a valid timestamp`);
  }
  return new Date(Date.parse(value)).toISOString();
}

function referenceArray(value, label) {
  if (!Array.isArray(value) || value.some((entry) => !isReference(entry))) {
    throw new Error(`${label} must contain reference strings only`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${label} must not contain duplicates`);
  return [...value];
}

function textArray(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new Error(`${label} must contain non-empty strings only`);
  }
  if (new Set(value).size !== value.length) throw new Error(`${label} must not contain duplicates`);
  return value.map((entry) => entry.trim());
}

function requireReference(value, label) {
  if (!isReference(value)) throw new Error(`${label} is required`);
  return value.trim();
}

function creatorText({ value, label }) {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} is required`);
  return value.trim();
}

function provenance({ authorship, creatorRef, sourceRefs = [], admittedByRef = null, admittedAt = null }) {
  return {
    authorship,
    creatorRef: requireReference(creatorRef, "creatorRef"),
    sourceRefs: referenceArray(sourceRefs, "sourceRefs"),
    admittedByRef,
    admittedAt,
  };
}

export function createCreatorStoryPiece({
  id,
  type,
  title,
  description = "",
  worldId,
  schools = [],
  tags = [],
  visibility = "private",
  stateRefs = [],
  ruleIds = [],
  relationshipIds = [],
  assetRefs = [],
  curriculumRefs = [],
  creatorRef,
  createdAt,
  updatedAt = createdAt,
} = {}) {
  if (!PLAYABLE_TYPES.has(type)) {
    throw new Error(`Phase 3 creator controls do not support Story Piece type ${String(type)}`);
  }
  const piece = {
    id: requireReference(id, "Story Piece id"),
    schemaVersion: 1,
    type,
    title: creatorText({ value: title, label: "Story Piece title" }),
    description: typeof description === "string" ? description.trim() : "",
    worldId: requireReference(worldId, "Story Piece worldId"),
    schools: textArray(schools, "Story Piece schools"),
    tags: textArray(tags, "Story Piece tags"),
    visibility,
    stateRefs: referenceArray(stateRefs, "Story Piece stateRefs"),
    ruleIds: referenceArray(ruleIds, "Story Piece ruleIds"),
    relationshipIds: referenceArray(relationshipIds, "Story Piece relationshipIds"),
    assetRefs: referenceArray(assetRefs, "Story Piece assetRefs"),
    agentBinding: null,
    curriculumRefs: referenceArray(curriculumRefs, "Story Piece curriculumRefs"),
    provenance: provenance({ authorship: "human", creatorRef }),
    createdAt: isoTimestamp(createdAt, "Story Piece createdAt"),
    updatedAt: isoTimestamp(updatedAt, "Story Piece updatedAt"),
  };
  const validation = validateStoryPieceForPersistence(piece);
  if (!validation.ok) throw new Error(`Creator Story Piece is invalid: ${validation.errors.join("; ")}`);
  return Object.freeze(structuredClone(piece));
}

export function editCreatorStoryPiece(existing, changes = {}, { creatorRef, updatedAt } = {}) {
  const currentValidation = validateStoryPieceForPersistence(existing);
  if (!currentValidation.ok) throw new Error(`Cannot edit invalid Story Piece: ${currentValidation.errors.join("; ")}`);
  if (existing.provenance.authorship !== "human") {
    throw new Error("Phase 3 direct editing is limited to Human-authored Story Pieces; generated/imported data must use admission first");
  }
  requireReference(creatorRef, "creatorRef");
  if (!isRecord(changes)) throw new Error("Story Piece edits must be an object");
  const unsupported = Object.keys(changes).filter((field) => !EDITABLE_PIECE_FIELDS.has(field));
  if (unsupported.length) throw new Error(`Story Piece edits cannot change ${unsupported.sort().join(", ")}`);
  const next = createCreatorStoryPiece({
    ...existing,
    ...changes,
    creatorRef: existing.provenance.creatorRef,
    createdAt: existing.createdAt,
    updatedAt,
  });
  if (next.id !== existing.id || next.worldId !== existing.worldId || next.type !== existing.type) {
    throw new Error("Story Piece identity, world and type are immutable through creator editing");
  }
  return next;
}

function compileRuleControls({
  id,
  title,
  priority = 100,
  when,
  conditions = [],
  costs = [],
  effects = [],
  consequences = [],
  enabled = true,
  creatorRef,
  sourceRefs = [],
  authorship,
}) {
  const rule = {
    id: requireReference(id, "Story Rule id"),
    schemaVersion: 1,
    title: creatorText({ value: title, label: "Story Rule title" }),
    priority,
    when,
    if: structuredClone(conditions),
    cost: structuredClone(costs),
    do: structuredClone(effects),
    then: structuredClone(consequences),
    enabled,
    provenance: provenance({ authorship, creatorRef, sourceRefs }),
  };
  const validation = validateStoryRuleDefinition(rule);
  if (!validation.ok) throw new Error(`Creator Story Rule is invalid: ${validation.errors.join("; ")}`);
  return rule;
}

export function createHumanStoryRuleFromControls(input = {}) {
  return Object.freeze(structuredClone(compileRuleControls({ ...input, authorship: "human" })));
}

export function createGeneratedStoryRuleProposal(input = {}) {
  const rule = compileRuleControls({ ...input, authorship: "generated-proposal" });
  return Object.freeze({
    kind: "story-rule-proposal",
    authoritative: false,
    rule: Object.freeze(structuredClone(rule)),
  });
}

export function storyRuleIsAdmitted(rule) {
  const validation = validateStoryRuleDefinition(rule);
  if (!validation.ok) return false;
  const authorship = rule.provenance?.authorship;
  if (authorship === "human" || authorship === "engine") return true;
  if (authorship !== "generated-proposal" && authorship !== "imported") return false;
  return isReference(rule.provenance.admittedByRef)
    && typeof rule.provenance.admittedAt === "string"
    && Number.isFinite(Date.parse(rule.provenance.admittedAt));
}

export function admitGeneratedStoryRuleProposal({ proposal, approved, approvedByRef, approvedAt } = {}) {
  if (approved !== true) throw new Error("Generated Story Rule admission requires explicit Human approval");
  if (proposal?.kind !== "story-rule-proposal" || !isRecord(proposal.rule)) {
    throw new Error("A generated Story Rule proposal is required");
  }
  if (proposal.rule.provenance?.authorship !== "generated-proposal") {
    throw new Error("Only generated-proposal Story Rules use this admission boundary");
  }
  if (storyRuleIsAdmitted(proposal.rule)) throw new Error("Generated Story Rule proposal is already admitted");
  const admitted = {
    ...structuredClone(proposal.rule),
    provenance: {
      ...structuredClone(proposal.rule.provenance),
      admittedByRef: requireReference(approvedByRef, "approvedByRef"),
      admittedAt: isoTimestamp(approvedAt, "approvedAt"),
    },
  };
  const validation = validateStoryRuleDefinition(admitted);
  if (!validation.ok || !storyRuleIsAdmitted(admitted)) {
    throw new Error(`Admitted Story Rule is invalid: ${validation.errors.join("; ")}`);
  }
  return Object.freeze(structuredClone(admitted));
}

function describeCondition(condition) {
  switch (condition.kind) {
    case "ref-exists": return `${condition.ref} exists`;
    case "ref-absent": return `${condition.ref} is absent`;
    case "value-equals": return `${condition.ref} equals ${String(condition.value)}`;
    case "value-at-least": return `${condition.ref} is at least ${String(condition.value)}`;
    case "actor-knows": return `${condition.actorId} knows ${condition.knowledgeRef}`;
    case "actor-present": return `${condition.actorId} is present at ${condition.locationId}`;
    default: return "unsupported condition";
  }
}

function describeOperation(operation) {
  switch (operation.kind) {
    case "set-value": return `set ${operation.ref} to ${String(operation.value)}`;
    case "adjust-number": return `adjust ${operation.ref} by ${String(operation.delta)}`;
    case "move-character": return `move ${operation.characterId} to ${operation.locationId}`;
    case "transfer-object": return `give ${operation.objectId} to ${operation.custodianRef}`;
    case "grant-knowledge": return `let ${operation.characterId} know ${operation.knowledgeRef}`;
    case "revoke-knowledge": return `remove ${operation.knowledgeRef} from ${operation.characterId}`;
    case "adjust-relationship": return `adjust ${operation.relationshipId} by ${String(operation.delta)}`;
    case "open-thread": return `open story thread ${operation.threadRef}`;
    case "resolve-thread": return `resolve story thread ${operation.threadRef}`;
    case "emit-event": return `emit ${operation.eventType} for ${operation.subjectRefs.join(", ")}`;
    default: return "unsupported operation";
  }
}

export function describeStoryRuleMechanics(rule) {
  const validation = validateStoryRuleDefinition(rule);
  if (!validation.ok) throw new Error(`Cannot describe invalid Story Rule: ${validation.errors.join("; ")}`);
  return Object.freeze({
    ruleId: rule.id,
    title: rule.title,
    authoritative: storyRuleIsAdmitted(rule),
    rows: Object.freeze([
      Object.freeze({ stage: "WHEN", items: Object.freeze([rule.when]) }),
      Object.freeze({ stage: "IF", items: Object.freeze(rule.if.map(describeCondition)) }),
      Object.freeze({ stage: "COST", items: Object.freeze(rule.cost.map(describeOperation)) }),
      Object.freeze({ stage: "DO", items: Object.freeze(rule.do.map(describeOperation)) }),
      Object.freeze({ stage: "THEN", items: Object.freeze(rule.then.map(describeOperation)) }),
    ]),
  });
}
