import { validateStoryEndConditionDefinition } from "../end-conditions.mjs";
import { validateStoryRuleDefinition } from "../rules.mjs";
import { validateStoryPieceForPersistence } from "../story-piece-persistence.mjs";

export const STORY_GAME_VALIDATOR_VERSION = "story-game-validator.v1";
export const STORY_PHASE3_PLAYABLE_PIECE_TYPES = Object.freeze([
  "character",
  "location",
  "object",
  "conflict",
  "secret",
  "story-technique",
]);

const SUPPORTED_PIECE_TYPES = new Set(STORY_PHASE3_PLAYABLE_PIECE_TYPES);
const SEVERITIES = new Set(["error", "warning", "note", "pass"]);
const TRIGGER_FOR_OPERATION = Object.freeze({
  "grant-knowledge": "knowledge-changed",
  "revoke-knowledge": "knowledge-changed",
  "adjust-relationship": "relationship-changed",
  "set-value": "state-changed",
  "adjust-number": "state-changed",
  "move-character": "state-changed",
  "transfer-object": "state-changed",
  "open-thread": "state-changed",
  "resolve-thread": "state-changed",
  "emit-event": "state-changed",
});

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isReference(value) {
  return typeof value === "string" && Boolean(value.trim());
}

function referenceArray(value) {
  return Array.isArray(value) && value.every(isReference);
}

function finding(code, severity, subjectRefs, message, evidenceRefs = [], suggestedRepair = null) {
  if (!SEVERITIES.has(severity)) throw new Error(`Unsupported STORY validator severity ${String(severity)}`);
  return Object.freeze({
    code,
    severity,
    subjectRefs: Object.freeze([...new Set(subjectRefs.filter(isReference))]),
    message,
    evidenceRefs: Object.freeze([...new Set(evidenceRefs.filter(isReference))]),
    suggestedRepair,
  });
}

function validateGameDefinition(game) {
  const errors = [];
  if (!isRecord(game)) return ["game definition must be an object"];
  for (const field of ["id", "worldId", "title"]) {
    if (!isReference(game[field])) errors.push(`game definition ${field} is required`);
  }
  if (game.schemaVersion !== 1) errors.push("game definition schemaVersion must equal 1");
  if (!Number.isSafeInteger(game.sceneCount) || game.sceneCount <= 0) errors.push("game definition sceneCount must be a positive safe integer");
  for (const field of ["startingPieceIds", "ruleIds", "endConditionRefs"]) {
    if (!referenceArray(game[field])) errors.push(`game definition ${field} must contain reference strings only`);
    else if (new Set(game[field]).size !== game[field].length) errors.push(`game definition ${field} must not contain duplicates`);
  }
  if (!isRecord(game.resolutionLimits)
    || !Number.isSafeInteger(game.resolutionLimits.maximumTriggerDepth)
    || game.resolutionLimits.maximumTriggerDepth <= 0
    || !Number.isSafeInteger(game.resolutionLimits.maximumOperationsPerScene)
    || game.resolutionLimits.maximumOperationsPerScene <= 0
    || !Number.isSafeInteger(game.resolutionLimits.maximumAgentCallsPerTurn)
    || game.resolutionLimits.maximumAgentCallsPerTurn <= 0) {
    errors.push("game definition resolutionLimits must contain positive safe integer budgets");
  }
  if (!isRecord(game.compatibility)
    || game.compatibility.storySchemaVersion !== 1
    || !isReference(game.compatibility.minimumEngineVersion)
    || !referenceArray(game.compatibility.featureIds)
    || !referenceArray(game.compatibility.requiredCapabilityRefs)) {
    errors.push("game definition compatibility is malformed");
  }
  return errors;
}

function stateHasRef(state, ref) {
  if (!isRecord(state) || !isReference(ref)) return false;
  if (Object.prototype.hasOwnProperty.call(state.values || {}, ref)) return true;
  if (Object.prototype.hasOwnProperty.call(state.characterLocations || {}, ref)) return true;
  if (Object.values(state.characterLocations || {}).includes(ref)) return true;
  if (Object.prototype.hasOwnProperty.call(state.objectCustody || {}, ref)) return true;
  if (Object.values(state.objectCustody || {}).includes(ref)) return true;
  if (Object.prototype.hasOwnProperty.call(state.knowledgeByCharacter || {}, ref)) return true;
  if (Object.values(state.knowledgeByCharacter || {}).some((refs) => Array.isArray(refs) && refs.includes(ref))) return true;
  if (Object.prototype.hasOwnProperty.call(state.relationships || {}, ref)) return true;
  return Array.isArray(state.openThreads) && state.openThreads.includes(ref);
}

function operationsOf(rule) {
  return ["cost", "do", "then"].flatMap((field) => Array.isArray(rule?.[field]) ? rule[field] : []);
}

function operationCanEstablish(operation, condition) {
  if (!isRecord(operation) || !isRecord(condition)) return false;
  if (condition.kind === "ref-exists") {
    return operation.ref === condition.ref
      || operation.threadRef === condition.ref
      || operation.characterId === condition.ref
      || operation.locationId === condition.ref
      || operation.objectId === condition.ref
      || operation.relationshipId === condition.ref
      || operation.knowledgeRef === condition.ref;
  }
  if (condition.kind === "ref-absent") {
    return operation.kind === "resolve-thread" && operation.threadRef === condition.ref;
  }
  if (condition.kind === "value-equals") {
    return (operation.kind === "set-value" && operation.ref === condition.ref && operation.value === condition.value)
      || (operation.kind === "adjust-number" && operation.ref === condition.ref && typeof condition.value === "number");
  }
  if (condition.kind === "value-at-least") {
    return (operation.kind === "set-value" && operation.ref === condition.ref && typeof operation.value === "number" && operation.value >= condition.value)
      || (operation.kind === "adjust-number" && operation.ref === condition.ref && operation.delta > 0);
  }
  if (condition.kind === "actor-knows") {
    return operation.kind === "grant-knowledge"
      && operation.characterId === condition.actorId
      && operation.knowledgeRef === condition.knowledgeRef;
  }
  if (condition.kind === "actor-present") {
    return operation.kind === "move-character"
      && operation.characterId === condition.actorId
      && operation.locationId === condition.locationId;
  }
  return false;
}

function conditionAlreadyTrue(state, condition) {
  if (!isRecord(condition) || !isRecord(state)) return false;
  if (condition.kind === "ref-exists") return stateHasRef(state, condition.ref);
  if (condition.kind === "ref-absent") return !stateHasRef(state, condition.ref);
  if (condition.kind === "value-equals") return state.values?.[condition.ref] === condition.value;
  if (condition.kind === "value-at-least") return typeof state.values?.[condition.ref] === "number" && state.values[condition.ref] >= condition.value;
  if (condition.kind === "actor-knows") return Array.isArray(state.knowledgeByCharacter?.[condition.actorId]) && state.knowledgeByCharacter[condition.actorId].includes(condition.knowledgeRef);
  if (condition.kind === "actor-present") return state.characterLocations?.[condition.actorId] === condition.locationId;
  return false;
}

function ruleTriggerGraph(rules) {
  const enabled = rules.filter((rule) => rule.enabled !== false);
  const byTrigger = new Map();
  for (const rule of enabled) {
    const bucket = byTrigger.get(rule.when) || [];
    bucket.push(rule.id);
    byTrigger.set(rule.when, bucket);
  }
  const graph = new Map(enabled.map((rule) => [rule.id, new Set()]));
  for (const rule of enabled) {
    for (const operation of operationsOf(rule)) {
      const trigger = TRIGGER_FOR_OPERATION[operation.kind];
      for (const target of byTrigger.get(trigger) || []) graph.get(rule.id)?.add(target);
    }
  }
  return graph;
}

function findCycles(graph, maximumDepth) {
  const cycles = [];
  const seenCycles = new Set();
  function visit(start, node, path) {
    if (path.length > maximumDepth + 1) {
      const signature = `depth:${start}:${path.join(">")}`;
      if (!seenCycles.has(signature)) {
        seenCycles.add(signature);
        cycles.push({ kind: "depth", path: [...path] });
      }
      return;
    }
    for (const next of graph.get(node) || []) {
      const index = path.indexOf(next);
      if (index >= 0) {
        const cycle = [...path.slice(index), next];
        const canonical = [...new Set(cycle)].sort().join("|");
        if (!seenCycles.has(canonical)) {
          seenCycles.add(canonical);
          cycles.push({ kind: "cycle", path: cycle });
        }
        continue;
      }
      visit(start, next, [...path, next]);
    }
  }
  for (const node of graph.keys()) visit(node, node, [node]);
  return cycles;
}

function costFindings(rules, initialState) {
  const findings = [];
  const positiveSources = new Set();
  for (const rule of rules) {
    for (const operation of operationsOf(rule)) {
      if (operation.kind === "adjust-number" && operation.delta > 0) positiveSources.add(operation.ref);
      if (operation.kind === "set-value" && typeof operation.value === "number" && operation.value > 0) positiveSources.add(operation.ref);
    }
  }
  for (const rule of rules) {
    for (const operation of Array.isArray(rule.cost) ? rule.cost : []) {
      if (operation.kind !== "adjust-number" || operation.delta >= 0) continue;
      const current = initialState?.values?.[operation.ref];
      if (typeof current === "number" && current + operation.delta >= 0) continue;
      if (positiveSources.has(operation.ref)) continue;
      findings.push(finding(
        "STORY_COST_NO_SOURCE",
        "error",
        [rule.id, operation.ref],
        `Rule ${rule.id} spends ${operation.ref}, but the validator found no starting balance or rule that can create that resource.`,
        [rule.id],
        "Give the resource a valid starting source or add a deterministic rule that can create it before this cost is required.",
      ));
    }
  }
  return findings;
}

function endConditionFindings(endConditions, rules, initialState) {
  const findings = [];
  const allOperations = rules.flatMap(operationsOf);
  for (const endCondition of endConditions) {
    const unreachable = (endCondition.if || []).filter((condition) => {
      if (conditionAlreadyTrue(initialState, condition)) return false;
      return !allOperations.some((operation) => operationCanEstablish(operation, condition));
    });
    if (unreachable.length) {
      findings.push(finding(
        "STORY_END_CONDITION_UNREACHABLE",
        "error",
        [endCondition.id],
        `End condition ${endCondition.id} contains ${unreachable.length} requirement(s) that no starting state or enabled rule can establish.`,
        [endCondition.id],
        "Add a deterministic path that can establish every required condition, or revise the ending requirement.",
      ));
    }
  }
  return findings;
}

function pieceReferenceFindings(game, piecesById, rulesById, endConditionsByRef) {
  const findings = [];
  for (const pieceId of game.startingPieceIds || []) {
    if (!piecesById.has(pieceId)) findings.push(finding(
      "STORY_STARTING_PIECE_MISSING",
      "error",
      [game.id, pieceId],
      `Starting Story Piece ${pieceId} does not exist.`,
      [game.id],
      "Create or select the missing Story Piece before launch.",
    ));
  }
  for (const ruleId of game.ruleIds || []) {
    if (!rulesById.has(ruleId)) findings.push(finding(
      "STORY_RULE_MISSING",
      "error",
      [game.id, ruleId],
      `Game rule ${ruleId} does not exist.`,
      [game.id],
      "Create the rule or remove the missing rule reference.",
    ));
  }
  for (const endRef of game.endConditionRefs || []) {
    if (!endConditionsByRef.has(endRef)) findings.push(finding(
      "STORY_END_CONDITION_MISSING",
      "error",
      [game.id, endRef],
      `End condition ${endRef} does not exist.`,
      [game.id],
      "Create the ending or remove the missing end-condition reference.",
    ));
  }
  return findings;
}

export function validateStoryGamePreflight({
  gameDefinition,
  pieces = [],
  rules = [],
  endConditions = [],
  initialState = null,
  hostCapabilityRefs = [],
  checkedRevisionRef = "story:creator:working",
} = {}) {
  const findings = [];
  const gameErrors = validateGameDefinition(gameDefinition);
  if (gameErrors.length) {
    findings.push(finding(
      "STORY_GAME_DEFINITION_INVALID",
      "error",
      [gameDefinition?.id || "story:game:unknown"],
      `Game definition is invalid: ${gameErrors.join("; ")}`,
      [],
      "Fix the game definition before checking playability.",
    ));
    return Object.freeze({
      gameDefinitionId: gameDefinition?.id || "story:game:unknown",
      checkedRevisionRef,
      findings: Object.freeze(findings),
      launchAllowed: false,
      validatorVersion: STORY_GAME_VALIDATOR_VERSION,
    });
  }

  const piecesById = new Map();
  for (const piece of pieces) {
    const validation = validateStoryPieceForPersistence(piece);
    if (!validation.ok) {
      findings.push(finding(
        "STORY_PIECE_INVALID",
        "error",
        [piece?.id || gameDefinition.id],
        `Story Piece ${piece?.id || "unknown"} is invalid: ${validation.errors.join("; ")}`,
        [],
        "Repair and explicitly admit the Story Piece before launch.",
      ));
      continue;
    }
    if (piece.worldId !== gameDefinition.worldId) {
      findings.push(finding("STORY_PIECE_WRONG_WORLD", "error", [piece.id], `Story Piece ${piece.id} belongs to another world.`, [gameDefinition.worldId], "Use a Story Piece from this world."));
    }
    if (!SUPPORTED_PIECE_TYPES.has(piece.type)) {
      findings.push(finding("STORY_PIECE_TYPE_PHASE3_UNSUPPORTED", "error", [piece.id], `Story Piece ${piece.id} uses ${piece.type}, which is outside the initial Phase 3 playable set.`, [piece.id], "Use Character, Location, Object, Conflict, Secret or Story Technique for this first creator slice."));
    }
    piecesById.set(piece.id, piece);
  }

  const rulesById = new Map();
  for (const rule of rules) {
    const validation = validateStoryRuleDefinition(rule);
    if (!validation.ok) {
      findings.push(finding("STORY_RULE_INVALID", "error", [rule?.id || gameDefinition.id], `Rule ${rule?.id || "unknown"} is invalid: ${validation.errors.join("; ")}`, [], "Repair the visible WHEN / IF / COST / DO / THEN mechanics before launch."));
      continue;
    }
    rulesById.set(rule.id, rule);
  }

  const endConditionsByRef = new Map();
  for (const entry of endConditions) {
    const ref = entry?.ref || entry?.id;
    const definition = entry?.definition || entry;
    const validation = validateStoryEndConditionDefinition(definition);
    if (!isReference(ref) || !validation.ok) {
      findings.push(finding("STORY_END_CONDITION_INVALID", "error", [ref || gameDefinition.id], `End condition ${ref || "unknown"} is invalid${validation.errors.length ? `: ${validation.errors.join("; ")}` : "."}`, [], "Repair the deterministic ending definition before launch."));
      continue;
    }
    endConditionsByRef.set(ref, definition);
  }

  findings.push(...pieceReferenceFindings(gameDefinition, piecesById, rulesById, endConditionsByRef));

  const requiredCapabilities = gameDefinition.compatibility.requiredCapabilityRefs || [];
  const availableCapabilities = new Set(hostCapabilityRefs);
  for (const capabilityRef of requiredCapabilities) {
    if (!availableCapabilities.has(capabilityRef)) findings.push(finding(
      "STORY_REQUIRED_CAPABILITY_UNAVAILABLE",
      "error",
      [gameDefinition.id, capabilityRef],
      `This game requires ${capabilityRef}, but the current PlotPickle host has not approved it.`,
      [capabilityRef],
      "Remove the requirement or use an already-approved host capability. Imported game data cannot grant the capability itself.",
    ));
  }

  const selectedRules = (gameDefinition.ruleIds || []).map((id) => rulesById.get(id)).filter(Boolean);
  const selectedEndConditions = (gameDefinition.endConditionRefs || []).map((ref) => endConditionsByRef.get(ref)).filter(Boolean);

  findings.push(...costFindings(selectedRules, initialState));
  findings.push(...endConditionFindings(selectedEndConditions, selectedRules, initialState));

  const cycles = findCycles(ruleTriggerGraph(selectedRules), gameDefinition.resolutionLimits.maximumTriggerDepth);
  for (const cycle of cycles) {
    findings.push(finding(
      cycle.kind === "cycle" ? "STORY_RULE_TRIGGER_CYCLE" : "STORY_TRIGGER_DEPTH_EXCEEDED",
      "error",
      cycle.path,
      cycle.kind === "cycle"
        ? `Rules can re-trigger in a cycle: ${cycle.path.join(" → ")}.`
        : `A possible rule chain exceeds the configured trigger-depth budget of ${gameDefinition.resolutionLimits.maximumTriggerDepth}.`,
      cycle.path,
      "Break the circular trigger path or lower the number of chained mandatory effects.",
    ));
  }

  if (selectedRules.length === 0 && selectedEndConditions.length > 0
    && !selectedEndConditions.some((condition) => (condition.if || []).every((entry) => conditionAlreadyTrue(initialState, entry)))) {
    findings.push(finding(
      "STORY_OBVIOUS_DEAD_END",
      "error",
      [gameDefinition.id],
      "The game has declared endings but no enabled rule path that can change state toward them.",
      gameDefinition.endConditionRefs,
      "Add at least one deterministic rule path that changes state toward a declared ending.",
    ));
  }

  const startingCharacters = (gameDefinition.startingPieceIds || [])
    .map((id) => piecesById.get(id))
    .filter((piece) => piece?.type === "character");
  for (const character of startingCharacters) {
    if ((character.ruleIds || []).length === 0 && selectedRules.every((rule) => !operationsOf(rule).some((operation) => operation.characterId === character.id))) {
      findings.push(finding(
        "STORY_CHARACTER_NO_MECHANICAL_PATH",
        "warning",
        [character.id],
        `Character ${character.title} has no visible rule or operation path in the current game definition.`,
        [character.id],
        "Connect the character to at least one legal visible mechanic if they are intended to participate in play.",
      ));
    }
  }

  const agentBindings = [...piecesById.values()].filter((piece) => piece.agentBinding !== null).length;
  if (agentBindings > gameDefinition.resolutionLimits.maximumAgentCallsPerTurn) {
    findings.push(finding(
      "STORY_AGENT_FANOUT_OVER_BUDGET",
      "error",
      [gameDefinition.id],
      `The starting world exposes ${agentBindings} agent bindings but allows only ${gameDefinition.resolutionLimits.maximumAgentCallsPerTurn} agent calls per turn.`,
      [...piecesById.values()].filter((piece) => piece.agentBinding !== null).map((piece) => piece.id),
      "Reduce simultaneously active agent bindings or raise the host-approved per-turn budget deliberately.",
    ));
  }

  const hasError = findings.some((entry) => entry.severity === "error");
  if (!hasError) findings.push(finding(
    "STORY_PREFLIGHT_PASS",
    "pass",
    [gameDefinition.id],
    "Deterministic creator preflight found no blocking configuration error in the supported Phase 3 surface.",
    [gameDefinition.id],
    null,
  ));

  return Object.freeze({
    gameDefinitionId: gameDefinition.id,
    checkedRevisionRef,
    findings: Object.freeze(findings),
    launchAllowed: !hasError,
    validatorVersion: STORY_GAME_VALIDATOR_VERSION,
  });
}
