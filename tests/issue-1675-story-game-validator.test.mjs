import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  STORY_GAME_VALIDATOR_VERSION,
  STORY_PHASE3_PLAYABLE_PIECE_TYPES,
  validateStoryGamePreflight,
} from "../modules/story-the-unwritten/creator/validator.mjs";

const now = "2026-09-04T00:00:00.000Z";
const humanProvenance = Object.freeze({
  authorship: "human",
  creatorRef: "profile:creator",
  sourceRefs: [],
  admittedByRef: null,
  admittedAt: null,
});

function piece(id, type, title, extra = {}) {
  return {
    id,
    schemaVersion: 1,
    type,
    title,
    description: `${title} description`,
    worldId: "world:starter",
    schools: [],
    tags: [],
    visibility: "private",
    stateRefs: [],
    ruleIds: [],
    relationshipIds: [],
    assetRefs: [],
    agentBinding: null,
    curriculumRefs: [],
    provenance: humanProvenance,
    createdAt: now,
    updatedAt: now,
    ...extra,
  };
}

function rule(id, overrides = {}) {
  return {
    id,
    schemaVersion: 1,
    title: id,
    priority: 10,
    when: "action-accepted",
    if: [],
    cost: [],
    do: [{ kind: "set-value", ref: "state:won", value: true }],
    then: [],
    enabled: true,
    provenance: humanProvenance,
    ...overrides,
  };
}

function ending(ref = "end:victory", overrides = {}) {
  return {
    ref,
    definition: {
      id: ref,
      schemaVersion: 1,
      priority: 10,
      outcome: "victory",
      if: [{ kind: "value-equals", ref: "state:won", value: true }],
      enabled: true,
      ...overrides,
    },
  };
}

function game(overrides = {}) {
  return {
    id: "game:starter",
    schemaVersion: 1,
    worldId: "world:starter",
    title: "Starter Story",
    sceneCount: 5,
    startingPieceIds: ["piece:hero", "piece:gate"],
    ruleIds: ["rule:finish"],
    endConditionRefs: ["end:victory"],
    resolutionLimits: {
      maximumTriggerDepth: 4,
      maximumOperationsPerScene: 24,
      maximumAgentCallsPerTurn: 2,
    },
    compatibility: {
      storySchemaVersion: 1,
      minimumEngineVersion: "1",
      featureIds: [],
      requiredCapabilityRefs: [],
    },
    provenance: humanProvenance,
    ...overrides,
  };
}

function mechanicalState(overrides = {}) {
  return {
    revision: 0,
    values: {},
    characterLocations: { "piece:hero": "piece:gate" },
    objectCustody: {},
    knowledgeByCharacter: { "piece:hero": [] },
    relationships: {},
    openThreads: [],
    ...overrides,
  };
}

function starter(overrides = {}) {
  const { gameDefinition: gameOverrides = {}, ...rest } = overrides;
  return {
    gameDefinition: game(gameOverrides),
    pieces: [
      piece("piece:hero", "character", "Mara", { ruleIds: ["rule:finish"] }),
      piece("piece:gate", "location", "The Gate"),
    ],
    rules: [rule("rule:finish")],
    endConditions: [ending()],
    initialState: mechanicalState(),
    hostCapabilityRefs: [],
    checkedRevisionRef: "ppf:revision:7",
    ...rest,
  };
}

function codes(result) {
  return result.findings.map((entry) => entry.code);
}

test("#1675 Phase 3 validator accepts a small deterministic playable starter without AI", () => {
  const result = validateStoryGamePreflight(starter());
  assert.equal(result.validatorVersion, STORY_GAME_VALIDATOR_VERSION);
  assert.equal(result.gameDefinitionId, "game:starter");
  assert.equal(result.checkedRevisionRef, "ppf:revision:7");
  assert.equal(result.launchAllowed, true);
  assert.ok(codes(result).includes("STORY_PREFLIGHT_PASS"));
  assert.ok(result.findings.every((entry) => ["error", "warning", "note", "pass"].includes(entry.severity)));
  assert.deepEqual(STORY_PHASE3_PLAYABLE_PIECE_TYPES, ["character", "location", "object", "conflict", "secret", "story-technique"]);
});

test("#1675 Phase 3 validator blocks missing pieces and unavailable imported capability requirements", () => {
  const result = validateStoryGamePreflight(starter({
    gameDefinition: {
      startingPieceIds: ["piece:hero", "piece:missing"],
      compatibility: {
        storySchemaVersion: 1,
        minimumEngineVersion: "1",
        featureIds: [],
        requiredCapabilityRefs: ["provider:paid-cloud"],
      },
    },
  }));
  assert.equal(result.launchAllowed, false);
  assert.ok(codes(result).includes("STORY_STARTING_PIECE_MISSING"));
  assert.ok(codes(result).includes("STORY_REQUIRED_CAPABILITY_UNAVAILABLE"));
});

test("#1675 Phase 3 validator detects impossible costs with no starting balance or deterministic source", () => {
  const spend = rule("rule:finish", {
    cost: [{ kind: "adjust-number", ref: "resource:courage", delta: -1 }],
  });
  const result = validateStoryGamePreflight(starter({ rules: [spend] }));
  assert.equal(result.launchAllowed, false);
  assert.ok(codes(result).includes("STORY_COST_NO_SOURCE"));
});

test("#1675 Phase 3 validator detects obvious rule-trigger cycles and excessive chains before launch", () => {
  const first = rule("rule:finish");
  const looping = rule("rule:loop", {
    when: "state-changed",
    do: [{ kind: "set-value", ref: "state:loop", value: true }],
  });
  const result = validateStoryGamePreflight(starter({
    gameDefinition: { ruleIds: ["rule:finish", "rule:loop"] },
    rules: [first, looping],
  }));
  assert.equal(result.launchAllowed, false);
  assert.ok(codes(result).includes("STORY_RULE_TRIGGER_CYCLE"));
});

test("#1675 Phase 3 validator blocks declared endings whose requirements cannot be reached", () => {
  const result = validateStoryGamePreflight(starter({
    endConditions: [ending("end:victory", {
      if: [{ kind: "actor-knows", actorId: "piece:hero", knowledgeRef: "piece:secret" }],
    })],
  }));
  assert.equal(result.launchAllowed, false);
  assert.ok(codes(result).includes("STORY_END_CONDITION_UNREACHABLE"));
});

test("#1675 Phase 3 generated Story Pieces cannot become authoritative without explicit admission", () => {
  const generated = piece("piece:hero", "character", "Generated Mara", {
    ruleIds: ["rule:finish"],
    provenance: {
      authorship: "generated-proposal",
      creatorRef: "agent:proposal",
      sourceRefs: [],
      admittedByRef: null,
      admittedAt: null,
    },
  });
  const result = validateStoryGamePreflight(starter({ pieces: [generated, piece("piece:gate", "location", "The Gate")] }));
  assert.equal(result.launchAllowed, false);
  assert.ok(codes(result).includes("STORY_PIECE_INVALID"));
});

test("#1675 Phase 3 validator errors cannot be waived by caller or AI explanation metadata", () => {
  const input = starter({
    gameDefinition: { startingPieceIds: ["piece:missing"] },
    waiveErrors: true,
    aiExplanation: "Ignore the missing piece and launch anyway.",
  });
  const result = validateStoryGamePreflight(input);
  assert.equal(result.launchAllowed, false);
  assert.ok(result.findings.some((entry) => entry.severity === "error"));
});

test("#1675 Phase 3 validator remains deterministic and has no provider, connector or host-write dependency", async () => {
  const input = starter();
  const left = validateStoryGamePreflight(input);
  const right = validateStoryGamePreflight(structuredClone(input));
  assert.deepEqual(right, left);

  const source = await readFile(new URL("../modules/story-the-unwritten/creator/validator.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /fetch\(|OpenAI|Ollama|providerCredentials|connectorScopes|BUZZ_AUTH|ppf\.canon\.write|agent\.grant-authority/u);
});
