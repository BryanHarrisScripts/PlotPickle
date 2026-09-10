import { validateStorySceneTransition } from "./contract-invariants.mjs";
import { evaluateStoryCondition, validateStoryConditionDefinition } from "./rules.mjs";

export const STORY_END_OUTCOMES = Object.freeze(["victory", "loss", "ending"]);

const END_CONDITION_FIELDS = Object.freeze([
  "id",
  "schemaVersion",
  "priority",
  "outcome",
  "if",
  "enabled",
]);

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

export function validateStoryEndConditionDefinition(condition) {
  if (!isRecord(condition)) return { ok: false, errors: ["end condition must be an object"] };
  const errors = [];
  for (const field of unknownFields(condition, END_CONDITION_FIELDS)) {
    errors.push(`end condition contains unsupported field ${field}`);
  }
  if (!isReference(condition.id)) errors.push("end condition id must be a non-empty reference");
  if (condition.schemaVersion !== 1) errors.push("end condition schemaVersion must equal 1");
  if (!Number.isSafeInteger(condition.priority)) errors.push("end condition priority must be a safe integer");
  if (!STORY_END_OUTCOMES.includes(condition.outcome)) errors.push("end condition outcome must be victory, loss or ending");
  if (typeof condition.enabled !== "boolean") errors.push("end condition enabled must be boolean");
  if (!Array.isArray(condition.if)) {
    errors.push("end condition if must be an array");
  } else {
    condition.if.forEach((entry, index) => {
      const validation = validateStoryConditionDefinition(entry);
      for (const error of validation.errors) errors.push(`end condition if[${index}]: ${error}`);
    });
  }
  return { ok: errors.length === 0, errors };
}

function endFailure(code, message, extra = {}) {
  return {
    ok: false,
    status: "invalid",
    match: null,
    failure: { code, message, ...extra },
  };
}

export function evaluateStoryEndConditions({ endConditionRefs, definitionsByRef, state }) {
  if (!Array.isArray(endConditionRefs) || endConditionRefs.some((ref) => !isReference(ref))) {
    return endFailure("invalid-end-condition-refs", "endConditionRefs must contain reference strings only");
  }
  if (new Set(endConditionRefs).size !== endConditionRefs.length) {
    return endFailure("duplicate-end-condition-ref", "endConditionRefs must not contain duplicates");
  }
  if (!isRecord(definitionsByRef)) {
    return endFailure("invalid-end-condition-registry", "definitionsByRef must be an object keyed by reference");
  }
  if (!validateMechanicalState(state)) {
    return endFailure("invalid-state", "mechanical state is malformed");
  }

  const resolved = [];
  for (const ref of endConditionRefs) {
    if (!Object.prototype.hasOwnProperty.call(definitionsByRef, ref)) {
      return endFailure("missing-end-condition", `missing end condition definition for ${ref}`, { endConditionRef: ref });
    }
    const definition = definitionsByRef[ref];
    const validation = validateStoryEndConditionDefinition(definition);
    if (!validation.ok) {
      return endFailure("invalid-end-condition", `end condition ${ref} is invalid`, {
        endConditionRef: ref,
        errors: validation.errors,
      });
    }
    resolved.push({ ref, definition });
  }

  const matches = resolved
    .filter(({ definition }) => definition.enabled && definition.if.every((condition) => evaluateStoryCondition(state, condition)))
    .sort((left, right) => left.definition.priority - right.definition.priority || left.ref.localeCompare(right.ref));

  if (matches.length === 0) {
    return { ok: true, status: "ongoing", match: null, failure: null };
  }

  const selected = matches[0];
  return {
    ok: true,
    status: "matched",
    match: {
      endConditionRef: selected.ref,
      endConditionId: selected.definition.id,
      outcome: selected.definition.outcome,
      priority: selected.definition.priority,
    },
    failure: null,
  };
}

function applyFailure(code, message, runtime, evaluation) {
  return {
    ok: false,
    status: "illegal",
    runtime,
    evaluation,
    failure: { code, message },
  };
}

export function applyStoryEndCondition({ runtime, evaluation }) {
  if (!runtime?.session || !Array.isArray(runtime.scenes)) {
    return applyFailure("invalid-session-runtime", "session runtime is required", runtime, evaluation);
  }
  if (!evaluation?.ok) {
    return applyFailure("invalid-end-condition-evaluation", "a successful end-condition evaluation is required", runtime, evaluation);
  }
  if (evaluation.status === "ongoing") {
    return { ok: true, status: "ongoing", runtime, evaluation, failure: null };
  }
  if (evaluation.status !== "matched" || !evaluation.match || !STORY_END_OUTCOMES.includes(evaluation.match.outcome)) {
    return applyFailure("invalid-end-condition-evaluation", "end-condition evaluation must be ongoing or matched", runtime, evaluation);
  }
  if (runtime.session.status !== "active" || !isReference(runtime.session.currentSceneId)) {
    return applyFailure("session-not-active", "an end condition can only finish an active session", runtime, evaluation);
  }

  const scene = runtime.scenes.find((candidate) => candidate.id === runtime.session.currentSceneId);
  if (!scene || scene.status !== "resolving") {
    return applyFailure(
      "scene-not-resolving",
      "an end condition can only commit at a resolving scene boundary",
      runtime,
      evaluation,
    );
  }

  const targetSceneStatus = evaluation.match.outcome === "loss" ? "failed" : "resolved";
  const transition = validateStorySceneTransition(scene.status, targetSceneStatus);
  if (!transition.ok) {
    return applyFailure("illegal-scene-transition", "current scene cannot commit the selected end condition", runtime, evaluation);
  }

  const next = structuredClone(runtime);
  const nextScene = next.scenes.find((candidate) => candidate.id === next.session.currentSceneId);
  nextScene.status = targetSceneStatus;
  if (evaluation.match.outcome === "loss") {
    next.session.status = "failed";
  } else {
    next.session.status = "completed";
    next.session.currentSceneId = null;
  }

  return {
    ok: true,
    status: "ended",
    runtime: next,
    evaluation,
    failure: null,
  };
}

export function resolveStorySessionEnd({ runtime, state, endConditionRefs, definitionsByRef }) {
  const evaluation = evaluateStoryEndConditions({ endConditionRefs, definitionsByRef, state });
  if (!evaluation.ok) {
    return {
      ok: false,
      status: "invalid",
      runtime,
      evaluation,
      failure: evaluation.failure,
    };
  }
  return applyStoryEndCondition({ runtime, evaluation });
}
