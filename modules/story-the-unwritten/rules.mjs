import { resolveStoryEventBatch } from "./resolution.mjs";

export const STORY_RULE_TRIGGERS = Object.freeze([
  "action-proposed",
  "action-accepted",
  "scene-started",
  "scene-ended",
  "state-changed",
  "knowledge-changed",
  "relationship-changed",
]);

const STORY_CONDITION_FIELDS = Object.freeze({
  "ref-exists": ["kind", "ref"],
  "ref-absent": ["kind", "ref"],
  "value-equals": ["kind", "ref", "value"],
  "value-at-least": ["kind", "ref", "value"],
  "actor-knows": ["kind", "actorId", "knowledgeRef"],
  "actor-present": ["kind", "actorId", "locationId"],
});

const STORY_OPERATION_FIELDS = Object.freeze({
  "set-value": ["kind", "ref", "value"],
  "adjust-number": ["kind", "ref", "delta"],
  "move-character": ["kind", "characterId", "locationId"],
  "transfer-object": ["kind", "objectId", "custodianRef"],
  "grant-knowledge": ["kind", "characterId", "knowledgeRef"],
  "revoke-knowledge": ["kind", "characterId", "knowledgeRef"],
  "adjust-relationship": ["kind", "relationshipId", "delta"],
  "open-thread": ["kind", "threadRef"],
  "resolve-thread": ["kind", "threadRef"],
  "emit-event": ["kind", "eventType", "subjectRefs"],
});

const STORY_RULE_FIELDS = Object.freeze([
  "id",
  "schemaVersion",
  "title",
  "priority",
  "when",
  "if",
  "cost",
  "do",
  "then",
  "enabled",
  "provenance",
]);

const STORY_PROVENANCE_FIELDS = Object.freeze([
  "authorship",
  "creatorRef",
  "sourceRefs",
  "admittedByRef",
  "admittedAt",
]);

const STORY_AUTHORSHIP = Object.freeze(["human", "generated-proposal", "engine", "imported"]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isReference(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function unknownFields(value, allowed) {
  if (!isRecord(value)) return [];
  const permitted = new Set(allowed);
  return Object.keys(value).filter((field) => !permitted.has(field));
}

function hasOwn(record, key) {
  return Object.prototype.hasOwnProperty.call(record || {}, key);
}

function validateScalar(value) {
  return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}

export function validateStoryConditionDefinition(condition) {
  if (!isRecord(condition)) return { ok: false, errors: ["condition must be an object"] };
  const fields = STORY_CONDITION_FIELDS[condition.kind];
  if (!fields) return { ok: false, errors: [`unsupported condition kind: ${String(condition.kind)}`] };
  const errors = [];
  for (const field of unknownFields(condition, fields)) errors.push(`condition ${condition.kind} contains unsupported field ${field}`);

  if (["ref-exists", "ref-absent", "value-equals", "value-at-least"].includes(condition.kind) && !isReference(condition.ref)) {
    errors.push(`${condition.kind}.ref must be a non-empty reference`);
  }
  if (condition.kind === "value-equals" && (!hasOwn(condition, "value") || !validateScalar(condition.value) || condition.value === null)) {
    errors.push("value-equals.value must be a string, number or boolean");
  }
  if (condition.kind === "value-at-least" && (!Number.isFinite(condition.value) || typeof condition.value !== "number")) {
    errors.push("value-at-least.value must be a finite number");
  }
  if (condition.kind === "actor-knows") {
    if (!isReference(condition.actorId)) errors.push("actor-knows.actorId must be a non-empty reference");
    if (!isReference(condition.knowledgeRef)) errors.push("actor-knows.knowledgeRef must be a non-empty reference");
  }
  if (condition.kind === "actor-present") {
    if (!isReference(condition.actorId)) errors.push("actor-present.actorId must be a non-empty reference");
    if (!isReference(condition.locationId)) errors.push("actor-present.locationId must be a non-empty reference");
  }
  return { ok: errors.length === 0, errors };
}

export function validateStoryOperationDefinition(operation) {
  if (!isRecord(operation)) return { ok: false, errors: ["operation must be an object"] };
  const fields = STORY_OPERATION_FIELDS[operation.kind];
  if (!fields) return { ok: false, errors: [`unsupported operation kind: ${String(operation.kind)}`] };
  const errors = [];
  for (const field of unknownFields(operation, fields)) errors.push(`operation ${operation.kind} contains unsupported field ${field}`);

  if (operation.kind === "set-value") {
    if (!isReference(operation.ref)) errors.push("set-value.ref must be a non-empty reference");
    if (!hasOwn(operation, "value") || !validateScalar(operation.value)) errors.push("set-value.value must be a scalar or null");
  }
  if (operation.kind === "adjust-number") {
    if (!isReference(operation.ref)) errors.push("adjust-number.ref must be a non-empty reference");
    if (typeof operation.delta !== "number" || !Number.isFinite(operation.delta)) errors.push("adjust-number.delta must be a finite number");
  }
  if (operation.kind === "move-character") {
    if (!isReference(operation.characterId)) errors.push("move-character.characterId must be a non-empty reference");
    if (!isReference(operation.locationId)) errors.push("move-character.locationId must be a non-empty reference");
  }
  if (operation.kind === "transfer-object") {
    if (!isReference(operation.objectId)) errors.push("transfer-object.objectId must be a non-empty reference");
    if (!isReference(operation.custodianRef)) errors.push("transfer-object.custodianRef must be a non-empty reference");
  }
  if (["grant-knowledge", "revoke-knowledge"].includes(operation.kind)) {
    if (!isReference(operation.characterId)) errors.push(`${operation.kind}.characterId must be a non-empty reference`);
    if (!isReference(operation.knowledgeRef)) errors.push(`${operation.kind}.knowledgeRef must be a non-empty reference`);
  }
  if (operation.kind === "adjust-relationship") {
    if (!isReference(operation.relationshipId)) errors.push("adjust-relationship.relationshipId must be a non-empty reference");
    if (typeof operation.delta !== "number" || !Number.isFinite(operation.delta)) errors.push("adjust-relationship.delta must be a finite number");
  }
  if (["open-thread", "resolve-thread"].includes(operation.kind) && !isReference(operation.threadRef)) {
    errors.push(`${operation.kind}.threadRef must be a non-empty reference`);
  }
  if (operation.kind === "emit-event") {
    if (!isReference(operation.eventType)) errors.push("emit-event.eventType must be a non-empty string");
    if (!Array.isArray(operation.subjectRefs) || operation.subjectRefs.some((ref) => !isReference(ref))) {
      errors.push("emit-event.subjectRefs must contain reference strings only");
    }
  }
  return { ok: errors.length === 0, errors };
}

function validateStoryProvenance(provenance) {
  if (!isRecord(provenance)) return ["provenance must be an object"];
  const errors = unknownFields(provenance, STORY_PROVENANCE_FIELDS).map((field) => `provenance contains unsupported field ${field}`);
  if (!STORY_AUTHORSHIP.includes(provenance.authorship)) errors.push("provenance.authorship is unsupported");
  if (!isReference(provenance.creatorRef)) errors.push("provenance.creatorRef must be a non-empty reference");
  if (!Array.isArray(provenance.sourceRefs) || provenance.sourceRefs.some((ref) => !isReference(ref))) {
    errors.push("provenance.sourceRefs must contain reference strings only");
  }
  if (provenance.admittedByRef !== null && !isReference(provenance.admittedByRef)) {
    errors.push("provenance.admittedByRef must be null or a non-empty reference");
  }
  if (provenance.admittedAt !== null && !isReference(provenance.admittedAt)) {
    errors.push("provenance.admittedAt must be null or a non-empty timestamp string");
  }
  return errors;
}

export function validateStoryRuleDefinition(rule) {
  if (!isRecord(rule)) return { ok: false, errors: ["rule must be an object"] };
  const errors = [];
  for (const field of unknownFields(rule, STORY_RULE_FIELDS)) errors.push(`rule contains unsupported field ${field}`);
  if (!isReference(rule.id)) errors.push("rule.id must be a non-empty reference");
  if (rule.schemaVersion !== 1) errors.push("rule.schemaVersion must equal 1");
  if (!isReference(rule.title)) errors.push("rule.title must be a non-empty string");
  if (!Number.isSafeInteger(rule.priority)) errors.push("rule.priority must be a safe integer");
  if (!STORY_RULE_TRIGGERS.includes(rule.when)) errors.push("rule.when must be a supported STORY trigger");
  if (typeof rule.enabled !== "boolean") errors.push("rule.enabled must be boolean");

  for (const field of ["if", "cost", "do", "then"]) {
    if (!Array.isArray(rule[field])) {
      errors.push(`rule.${field} must be an array`);
      continue;
    }
    rule[field].forEach((entry, index) => {
      const result = field === "if" ? validateStoryConditionDefinition(entry) : validateStoryOperationDefinition(entry);
      for (const error of result.errors) errors.push(`rule.${field}[${index}]: ${error}`);
    });
  }
  errors.push(...validateStoryProvenance(rule.provenance));
  return { ok: errors.length === 0, errors };
}

function stateContainsReference(state, ref) {
  if (hasOwn(state.values, ref)) return true;
  if (hasOwn(state.characterLocations, ref) || Object.values(state.characterLocations || {}).includes(ref)) return true;
  if (hasOwn(state.objectCustody, ref) || Object.values(state.objectCustody || {}).includes(ref)) return true;
  if (hasOwn(state.knowledgeByCharacter, ref)) return true;
  if (Object.values(state.knowledgeByCharacter || {}).some((refs) => Array.isArray(refs) && refs.includes(ref))) return true;
  if (hasOwn(state.relationships, ref)) return true;
  return Array.isArray(state.openThreads) && state.openThreads.includes(ref);
}

export function evaluateStoryCondition(state, condition) {
  const validation = validateStoryConditionDefinition(condition);
  if (!validation.ok) return false;
  switch (condition.kind) {
    case "ref-exists":
      return stateContainsReference(state, condition.ref);
    case "ref-absent":
      return !stateContainsReference(state, condition.ref);
    case "value-equals":
      return state.values?.[condition.ref] === condition.value;
    case "value-at-least":
      return typeof state.values?.[condition.ref] === "number" && state.values[condition.ref] >= condition.value;
    case "actor-knows":
      return Array.isArray(state.knowledgeByCharacter?.[condition.actorId])
        && state.knowledgeByCharacter[condition.actorId].includes(condition.knowledgeRef);
    case "actor-present":
      return state.characterLocations?.[condition.actorId] === condition.locationId;
    default:
      return false;
  }
}

function validateMechanicalState(state) {
  return isRecord(state)
    && Number.isSafeInteger(state.revision)
    && state.revision >= 0
    && isRecord(state.values)
    && isRecord(state.characterLocations)
    && isRecord(state.objectCustody)
    && isRecord(state.knowledgeByCharacter)
    && isRecord(state.relationships)
    && Array.isArray(state.openThreads);
}

export function deriveStoryRuleEvents({
  rules,
  trigger,
  state,
  causationRef,
  actionId = causationRef,
  nextSequence = 1,
  triggerDepth = 0,
  ancestryKeys = [],
}) {
  if (!Array.isArray(rules)) return { ok: false, events: [], matchedRuleIds: [], failure: { code: "invalid-rules", message: "rules must be an array" } };
  if (!STORY_RULE_TRIGGERS.includes(trigger)) return { ok: false, events: [], matchedRuleIds: [], failure: { code: "invalid-trigger", message: "trigger is not supported" } };
  if (!validateMechanicalState(state)) return { ok: false, events: [], matchedRuleIds: [], failure: { code: "invalid-state", message: "mechanical state is malformed" } };
  if (!isReference(causationRef) || !isReference(actionId)) return { ok: false, events: [], matchedRuleIds: [], failure: { code: "invalid-causation", message: "causationRef and actionId must be non-empty references" } };
  if (!Number.isSafeInteger(nextSequence) || nextSequence < 0) return { ok: false, events: [], matchedRuleIds: [], failure: { code: "invalid-sequence", message: "nextSequence must be a non-negative safe integer" } };
  if (!Number.isSafeInteger(triggerDepth) || triggerDepth < 0) return { ok: false, events: [], matchedRuleIds: [], failure: { code: "invalid-trigger-depth", message: "triggerDepth must be a non-negative safe integer" } };
  if (!Array.isArray(ancestryKeys) || ancestryKeys.some((key) => !isReference(key))) return { ok: false, events: [], matchedRuleIds: [], failure: { code: "invalid-ancestry", message: "ancestryKeys must contain non-empty strings" } };

  const validated = rules.map((rule) => ({ rule, validation: validateStoryRuleDefinition(rule) }));
  const invalid = validated.find(({ validation }) => !validation.ok);
  if (invalid) {
    return {
      ok: false,
      events: [],
      matchedRuleIds: [],
      failure: {
        code: "invalid-rule",
        message: `rule ${String(invalid.rule?.id || "unknown")} is invalid`,
        ruleId: invalid.rule?.id || null,
        errors: invalid.validation.errors,
      },
    };
  }

  const matchedRules = validated
    .map(({ rule }) => rule)
    .filter((rule) => rule.enabled && rule.when === trigger && rule.if.every((condition) => evaluateStoryCondition(state, condition)))
    .sort((left, right) => left.priority - right.priority || left.id.localeCompare(right.id));

  let enqueueOrder = nextSequence;
  const events = [];
  for (const rule of matchedRules) {
    for (const stage of ["cost", "do", "then"]) {
      rule[stage].forEach((operation, operationIndex) => {
        const identity = `${rule.id}:${trigger}:${causationRef}:${stage}:${operationIndex}`;
        events.push({
          id: `story-event:${identity}`,
          idempotencyKey: `story-rule:${identity}`,
          cycleKey: `story-rule:${rule.id}`,
          ancestryKeys: [...ancestryKeys],
          priority: rule.priority,
          enqueueOrder,
          triggerDepth,
          sequence: 0,
          causationRef,
          actionId,
          ruleId: rule.id,
          operation: structuredClone(operation),
          status: "queued",
          stateRevisionBefore: state.revision,
          stateRevisionAfter: null,
        });
        enqueueOrder += 1;
      });
    }
  }

  return {
    ok: true,
    events,
    matchedRuleIds: matchedRules.map((rule) => rule.id),
    nextSequence: enqueueOrder,
    failure: null,
  };
}

export function resolveStoryRuleTrigger({
  rules,
  trigger,
  state,
  causationRef,
  actionId = causationRef,
  nextSequence = 1,
  triggerDepth = 0,
  ancestryKeys = [],
  limits,
  processedIdempotencyKeys = [],
}) {
  const derived = deriveStoryRuleEvents({ rules, trigger, state, causationRef, actionId, nextSequence, triggerDepth, ancestryKeys });
  if (!derived.ok) return { ...derived, state, checkpoint: null, acceptedEvents: [] };
  if (derived.events.length === 0) {
    return {
      ok: true,
      state,
      checkpoint: null,
      acceptedEvents: [],
      events: [],
      matchedRuleIds: derived.matchedRuleIds,
      nextSequence: derived.nextSequence,
      failure: null,
    };
  }
  const resolution = resolveStoryEventBatch({ state, events: derived.events, limits, processedIdempotencyKeys });
  return {
    ...resolution,
    events: derived.events,
    matchedRuleIds: derived.matchedRuleIds,
    nextSequence: derived.nextSequence,
  };
}
