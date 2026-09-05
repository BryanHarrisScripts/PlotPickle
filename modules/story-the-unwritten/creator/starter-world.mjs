import {
  createCreatorStoryPiece,
  createGeneratedStoryRuleProposal,
  createHumanStoryRuleFromControls,
} from "./authoring.mjs";
import { validateCreatorGameForLaunch } from "./preflight.mjs";

const VISIBILITIES = new Set(["private", "unlisted", "public"]);
const PLAYABLE_TYPES = Object.freeze([
  "character",
  "location",
  "object",
  "conflict",
  "secret",
  "story-technique",
]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value, label) {
  if (typeof value !== "string") throw new Error(`${label} is required`);
  const normalized = value.trim();
  if (!normalized) throw new Error(`${label} is required`);
  return normalized;
}

function referenceArray(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string" || !entry.trim())) {
    throw new Error(`${label} must contain reference strings only`);
  }
  const normalized = value.map((entry) => entry.trim());
  if (new Set(normalized).size !== normalized.length) throw new Error(`${label} must not contain duplicates`);
  return normalized;
}

function cloneFrozen(value) {
  return Object.freeze(structuredClone(value));
}

function provenance(creatorRef) {
  return Object.freeze({
    authorship: "human",
    creatorRef: requiredString(creatorRef, "creatorRef"),
    sourceRefs: Object.freeze([]),
    admittedByRef: null,
    admittedAt: null,
  });
}

export function createCreatorStoryWorld({
  id,
  title,
  description = "",
  visibility = "private",
  ppfProjectRef,
  graphIndexRef,
  pieceIndexRef,
  ruleIndexRef,
  assetIndexRef,
  minimumEngineVersion = "1",
  featureIds = [],
  requiredCapabilityRefs = [],
  creatorRef,
} = {}) {
  if (!VISIBILITIES.has(visibility)) throw new Error(`Unsupported Story World visibility ${String(visibility)}`);
  const world = {
    id: requiredString(id, "Story World id"),
    schemaVersion: 1,
    title: requiredString(title, "Story World title"),
    description: typeof description === "string" ? description.trim() : "",
    visibility,
    ppfProjectRef: requiredString(ppfProjectRef, "Story World ppfProjectRef"),
    graphIndexRef: requiredString(graphIndexRef, "Story World graphIndexRef"),
    pieceIndexRef: requiredString(pieceIndexRef, "Story World pieceIndexRef"),
    ruleIndexRef: requiredString(ruleIndexRef, "Story World ruleIndexRef"),
    assetIndexRef: requiredString(assetIndexRef, "Story World assetIndexRef"),
    compatibility: {
      storySchemaVersion: 1,
      minimumEngineVersion: requiredString(minimumEngineVersion, "Story World minimumEngineVersion"),
      featureIds: referenceArray(featureIds, "Story World featureIds"),
      requiredCapabilityRefs: referenceArray(requiredCapabilityRefs, "Story World requiredCapabilityRefs"),
    },
    provenance: provenance(creatorRef),
  };
  return cloneFrozen(world);
}

export function createCreatorStoryGameDefinition({
  id,
  worldId,
  title,
  startingPieceIds,
  ruleIds,
  endConditionRefs,
  resolutionLimits = {
    maximumTriggerDepth: 4,
    maximumOperationsPerScene: 24,
    maximumAgentCallsPerTurn: 2,
  },
  minimumEngineVersion = "1",
  featureIds = [],
  requiredCapabilityRefs = [],
  creatorRef,
} = {}) {
  const game = {
    id: requiredString(id, "Story Game id"),
    schemaVersion: 1,
    worldId: requiredString(worldId, "Story Game worldId"),
    title: requiredString(title, "Story Game title"),
    sceneCount: 5,
    startingPieceIds: referenceArray(startingPieceIds, "Story Game startingPieceIds"),
    ruleIds: referenceArray(ruleIds, "Story Game ruleIds"),
    endConditionRefs: referenceArray(endConditionRefs, "Story Game endConditionRefs"),
    resolutionLimits: structuredClone(resolutionLimits),
    compatibility: {
      storySchemaVersion: 1,
      minimumEngineVersion: requiredString(minimumEngineVersion, "Story Game minimumEngineVersion"),
      featureIds: referenceArray(featureIds, "Story Game featureIds"),
      requiredCapabilityRefs: referenceArray(requiredCapabilityRefs, "Story Game requiredCapabilityRefs"),
    },
    provenance: provenance(creatorRef),
  };
  return cloneFrozen(game);
}

function starterPiece({ id, type, title, description, worldId, schools, tags, ruleIds = [], creatorRef, createdAt }) {
  return createCreatorStoryPiece({
    id,
    type,
    title,
    description,
    worldId,
    schools,
    tags,
    ruleIds,
    creatorRef,
    createdAt,
  });
}

export function createFiveSceneCreatorStarterCollection({
  worldId,
  gameDefinitionId,
  ppfProjectRef,
  creatorRef,
  createdAt,
  checkedRevisionRef = "story:creator:starter-working",
} = {}) {
  const normalizedWorldId = requiredString(worldId, "worldId");
  const normalizedCreatorRef = requiredString(creatorRef, "creatorRef");
  const ids = Object.freeze({
    character: `${normalizedWorldId}:piece:keeper`,
    location: `${normalizedWorldId}:piece:crossroads`,
    object: `${normalizedWorldId}:piece:key`,
    conflict: `${normalizedWorldId}:piece:sealed-gate`,
    secret: `${normalizedWorldId}:piece:gate-name`,
    technique: `${normalizedWorldId}:piece:choice-consequence`,
    rule: `${normalizedWorldId}:rule:open-gate`,
    ending: `${normalizedWorldId}:ending:gate-open`,
    gateState: `${normalizedWorldId}:state:gate-open`,
  });

  const world = createCreatorStoryWorld({
    id: normalizedWorldId,
    title: "The Lantern Workshop",
    description: "A small creator-owned STORY world built to prove five deterministic scenes with visible mechanics.",
    visibility: "private",
    ppfProjectRef,
    graphIndexRef: `${normalizedWorldId}:index:graph`,
    pieceIndexRef: `${normalizedWorldId}:index:pieces`,
    ruleIndexRef: `${normalizedWorldId}:index:rules`,
    assetIndexRef: `${normalizedWorldId}:index:assets`,
    creatorRef: normalizedCreatorRef,
  });

  const pieces = Object.freeze([
    starterPiece({
      id: ids.character,
      type: "character",
      title: "The Keeper",
      description: "A traveler deciding whether the sealed gate should open.",
      worldId: normalizedWorldId,
      schools: ["character"],
      tags: ["starter", "decision-maker"],
      ruleIds: [ids.rule],
      creatorRef: normalizedCreatorRef,
      createdAt,
    }),
    starterPiece({
      id: ids.location,
      type: "location",
      title: "Lantern Crossroads",
      description: "A fork in the road facing an old sealed gate.",
      worldId: normalizedWorldId,
      schools: ["world"],
      tags: ["starter", "crossroads"],
      creatorRef: normalizedCreatorRef,
      createdAt,
    }),
    starterPiece({
      id: ids.object,
      type: "object",
      title: "Brass Key",
      description: "The visible cost-free object that makes opening the gate possible.",
      worldId: normalizedWorldId,
      schools: ["plot"],
      tags: ["starter", "key"],
      creatorRef: normalizedCreatorRef,
      createdAt,
    }),
    starterPiece({
      id: ids.conflict,
      type: "conflict",
      title: "The Sealed Gate",
      description: "The immediate obstacle separating the Keeper from the road ahead.",
      worldId: normalizedWorldId,
      schools: ["conflict"],
      tags: ["starter", "obstacle"],
      creatorRef: normalizedCreatorRef,
      createdAt,
    }),
    starterPiece({
      id: ids.secret,
      type: "secret",
      title: "The Gate Has a Name",
      description: "A hidden story fact that can later become character knowledge without becoming host authority.",
      worldId: normalizedWorldId,
      schools: ["theme"],
      tags: ["starter", "secret"],
      creatorRef: normalizedCreatorRef,
      createdAt,
    }),
    starterPiece({
      id: ids.technique,
      type: "story-technique",
      title: "Choice Creates Consequence",
      description: "Make the player choose, then show the mechanical consequence instead of hiding it in prose.",
      worldId: normalizedWorldId,
      schools: ["style"],
      tags: ["starter", "technique"],
      creatorRef: normalizedCreatorRef,
      createdAt,
    }),
  ]);

  const rule = createHumanStoryRuleFromControls({
    id: ids.rule,
    title: "Open the gate when the Keeper has the key",
    priority: 10,
    when: "action-accepted",
    conditions: [{ kind: "ref-exists", ref: ids.object }],
    costs: [],
    effects: [{ kind: "set-value", ref: ids.gateState, value: true }],
    consequences: [],
    creatorRef: normalizedCreatorRef,
  });
  const rules = Object.freeze([rule]);

  const endConditions = Object.freeze([Object.freeze({
    ref: ids.ending,
    definition: Object.freeze({
      id: ids.ending,
      schemaVersion: 1,
      priority: 10,
      outcome: "victory",
      if: Object.freeze([{ kind: "value-equals", ref: ids.gateState, value: true }]),
      enabled: true,
    }),
  })]);

  const gameDefinition = createCreatorStoryGameDefinition({
    id: gameDefinitionId,
    worldId: normalizedWorldId,
    title: "The Lantern Workshop — Five Scene Starter",
    startingPieceIds: pieces.map((piece) => piece.id),
    ruleIds: [ids.rule],
    endConditionRefs: [ids.ending],
    creatorRef: normalizedCreatorRef,
  });

  const initialState = cloneFrozen({
    revision: 0,
    values: { [ids.gateState]: false },
    characterLocations: { [ids.character]: ids.location },
    objectCustody: { [ids.object]: ids.character },
    knowledgeByCharacter: { [ids.character]: [] },
    relationships: {},
    openThreads: [],
  });

  const validation = validateCreatorGameForLaunch({
    gameDefinition,
    pieces,
    rules,
    endConditions,
    initialState,
    hostCapabilityRefs: [],
    checkedRevisionRef: requiredString(checkedRevisionRef, "checkedRevisionRef"),
  });
  if (!validation.launchAllowed) {
    const blocking = validation.findings.filter((finding) => finding.severity === "error").map((finding) => finding.code);
    throw new Error(`Creator starter collection failed deterministic preflight: ${blocking.join(", ")}`);
  }

  return cloneFrozen({
    world,
    gameDefinition,
    pieces,
    rules,
    endConditions,
    initialState,
    validation,
  });
}

export function loadCreatorStoryWorldBundle(bundle, {
  hostCapabilityRefs = [],
  checkedRevisionRef = "story:creator:loaded-working",
} = {}) {
  if (!isRecord(bundle) || !isRecord(bundle.world) || !isRecord(bundle.gameDefinition)) {
    throw new Error("Creator Story World bundle must contain world and gameDefinition records");
  }
  const worldId = requiredString(bundle.world.id, "Story World id");
  if (bundle.gameDefinition.worldId !== worldId) throw new Error("Story Game worldId must match the loaded Story World");
  const pieces = Array.isArray(bundle.pieces) ? bundle.pieces : [];
  const pieceIds = pieces.map((piece) => piece?.id).filter(Boolean);
  if (new Set(pieceIds).size !== pieceIds.length) throw new Error("Loaded Story World contains duplicate Story Piece ids");
  if (pieces.some((piece) => piece?.worldId !== worldId)) throw new Error("Loaded Story World contains Story Pieces from another world");

  const validation = validateCreatorGameForLaunch({
    gameDefinition: bundle.gameDefinition,
    pieces,
    rules: Array.isArray(bundle.rules) ? bundle.rules : [],
    endConditions: Array.isArray(bundle.endConditions) ? bundle.endConditions : [],
    initialState: bundle.initialState ?? null,
    hostCapabilityRefs: referenceArray(hostCapabilityRefs, "hostCapabilityRefs"),
    checkedRevisionRef: requiredString(checkedRevisionRef, "checkedRevisionRef"),
  });

  return cloneFrozen({
    ...bundle,
    validation,
  });
}

export function createNaturalLanguageMechanicsProposalRequest({
  requestId,
  worldId,
  creatorRef,
  prompt,
  targetPieceIds = [],
} = {}) {
  return cloneFrozen({
    kind: "story-mechanics-proposal-request",
    schemaVersion: 1,
    requestId: requiredString(requestId, "Mechanics proposal requestId"),
    worldId: requiredString(worldId, "Mechanics proposal worldId"),
    creatorRef: requiredString(creatorRef, "Mechanics proposal creatorRef"),
    prompt: requiredString(prompt, "Mechanics proposal prompt"),
    targetPieceIds: referenceArray(targetPieceIds, "Mechanics proposal targetPieceIds"),
    authoritative: false,
    allowedOutputContract: "story-rule-controls.v1",
  });
}

export function createGeneratedRuleFromMechanicsProposal({ request, agentRef, proposedRuleControls } = {}) {
  if (request?.kind !== "story-mechanics-proposal-request" || request?.authoritative !== false) {
    throw new Error("A non-authoritative Story mechanics proposal request is required");
  }
  if (!isRecord(proposedRuleControls)) throw new Error("Generated Story mechanics must use finite rule controls");
  return createGeneratedStoryRuleProposal({
    ...structuredClone(proposedRuleControls),
    creatorRef: requiredString(agentRef, "agentRef"),
    sourceRefs: [requiredString(request.requestId, "Mechanics proposal requestId")],
  });
}

export function createValidatorExplanationRequest({ requestId, validationResult } = {}) {
  if (!isRecord(validationResult)
    || typeof validationResult.launchAllowed !== "boolean"
    || !Array.isArray(validationResult.findings)
    || typeof validationResult.validatorVersion !== "string") {
    throw new Error("A deterministic Story Game validation result is required before explanation");
  }
  return cloneFrozen({
    kind: "story-validator-explanation-request",
    schemaVersion: 1,
    requestId: requiredString(requestId, "Validator explanation requestId"),
    authoritative: false,
    mayOverrideDeterministicResult: false,
    deterministicResult: validationResult,
  });
}

export function attachValidatorExplanation({ request, explanation } = {}) {
  if (request?.kind !== "story-validator-explanation-request" || request?.mayOverrideDeterministicResult !== false) {
    throw new Error("A deterministic validator explanation request is required");
  }
  const explanationText = requiredString(explanation, "Validator explanation");
  return cloneFrozen({
    deterministicResult: request.deterministicResult,
    explanation: explanationText,
    explanationAuthoritative: false,
    launchAllowed: request.deterministicResult.launchAllowed,
  });
}

export const STORY_CREATOR_STARTER_PLAYABLE_TYPES = PLAYABLE_TYPES;
