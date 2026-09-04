import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  STORY_CHARACTER_ACTIVATION_TIERS,
  STORY_CHARACTER_GRAPH_NODE_FIELDS,
  STORY_CONTRACT_SCHEMA_VERSION,
  STORY_SCENE_TRANSITIONS,
  STORY_VALIDATOR_SEVERITIES,
  storyValidationAllowsLaunch,
  validateStoryAgentDefinition,
  validateStoryCharacterGraphNode,
  validateStorySceneTransition,
} from "../modules/story-the-unwritten/contract-invariants.mjs";

const graphNode = {
  id: "character:elara",
  schemaVersion: 1,
  worldId: "world:unwritten",
  definitionRef: "story-character-definition:elara@1",
  stateRef: "story-character-state:elara@7",
  relationshipIndexRef: "story-relationships:elara@7",
  memoryIndexRef: "story-memories:elara@7",
  knowledgeIndexRef: "story-knowledge:elara@7",
  assetIndexRef: "story-assets:elara@1",
};

const agentDefinition = {
  id: "story-agent:elara",
  schemaVersion: 1,
  worldId: "world:unwritten",
  characterId: "character:elara",
  approvedRoleTemplateRef: "agent-role:bounded-character",
  hostAuthorityRef: "agent-contract:story-character/v1",
  personalityRefs: ["story-character-definition:elara@1"],
  goalRefs: ["story-objective:find-lost-road"],
  knowledgePolicyRef: "story-knowledge-policy:elara@7",
  memoryScopeRef: "story-memory-scope:elara@7",
  gameActionPermissionRefs: ["story-action-policy:character-default"],
  provenance: {
    authorship: "human",
    creatorRef: "profile:creator",
    sourceRefs: [],
    admittedByRef: "story-admission:elara",
    admittedAt: "2026-09-03T20:00:00.000Z",
  },
};

test("#1675 defines module-owned versioned STORY contracts without speculative core promotion", async () => {
  const source = await readFile(new URL("../modules/story-the-unwritten/contracts.ts", import.meta.url), "utf8");
  assert.equal(STORY_CONTRACT_SCHEMA_VERSION, 1);
  for (const contract of [
    "StoryPiece",
    "StoryWorld",
    "StoryRule",
    "StoryAction",
    "StoryEvent",
    "StorySession",
    "StoryGameDefinition",
    "StoryAgentBinding",
    "StoryAgentDefinition",
    "StoryAgentInstance",
  ]) assert.match(source, new RegExp(`export interface ${contract}\\b`));
  assert.doesNotMatch(source, /from ["']\.\.\/\.\.\/core/);
  assert.doesNotMatch(source, /from ["']\.\.\/wyrmwood/);
});

test("#1675 separates character definition, mutable state, indexes and runtime activation", async () => {
  const source = await readFile(new URL("../modules/story-the-unwritten/contracts.ts", import.meta.url), "utf8");
  for (const contract of [
    "StoryCharacterDefinition",
    "StoryCharacterState",
    "StoryCharacterGraphNode",
    "StoryMemoryEventRecord",
    "StoryRelationshipEdge",
    "StoryKnowledgeReference",
    "StoryAssetReference",
    "StoryCharacterActivation",
  ]) assert.match(source, new RegExp(`export interface ${contract}\\b`));
  assert.deepEqual(STORY_CHARACTER_ACTIVATION_TIERS, ["cold", "warm", "hot", "agent-active"]);
});

test("#1675 accepts a lightweight character graph node made only of identity and references", () => {
  assert.deepEqual(Object.keys(graphNode), STORY_CHARACTER_GRAPH_NODE_FIELDS);
  assert.deepEqual(validateStoryCharacterGraphNode(graphNode), { ok: true, errors: [] });
});

test("#1675 graph nodes cannot embed heavy character, relationship, memory, asset or agent data", () => {
  for (const [field, value] of Object.entries({
    biography: "A complete life story",
    memories: [{ event: "secret" }],
    relationships: [{ to: "character:mara", value: 10 }],
    assets: [{ bytes: "large-payload" }],
    dialogueHistory: ["Every line ever spoken"],
    promptContext: "private prompt",
    runtimeInstance: { model: "provider-specific-model" },
  })) {
    const result = validateStoryCharacterGraphNode({ ...graphNode, [field]: value });
    assert.equal(result.ok, false, field);
    assert.ok(result.errors.some((error) => error.includes(field)), field);
  }
});

test("#1675 requires every graph index reference and rejects incompatible schema versions", () => {
  const missingIndex = { ...graphNode, memoryIndexRef: "" };
  assert.equal(validateStoryCharacterGraphNode(missingIndex).ok, false);
  assert.equal(validateStoryCharacterGraphNode({ ...graphNode, schemaVersion: 2 }).ok, false);
});

test("#1675 keeps user-created Story Agents as bounded data referencing host authority", () => {
  assert.deepEqual(validateStoryAgentDefinition(agentDefinition), { ok: true, errors: [] });
  for (const [field, value] of Object.entries({
    tools: ["shell"],
    connectors: ["private-drive"],
    credentials: { token: "secret" },
    providerAuthority: "unbounded",
    sourceMutationAuthority: true,
    ppfWriteAuthority: true,
    skillInstallAuthority: true,
    runtimeInstance: { model: "resident-agent" },
  })) {
    const result = validateStoryAgentDefinition({ ...agentDefinition, [field]: value });
    assert.equal(result.ok, false, field);
    assert.ok(result.errors.some((error) => error.includes(field)), field);
  }
});

test("#1675 scene transitions are deterministic and terminal states cannot reopen themselves", () => {
  assert.deepEqual(STORY_SCENE_TRANSITIONS.ready, ["active"]);
  assert.equal(validateStorySceneTransition("active", "resolving").ok, true);
  assert.equal(validateStorySceneTransition("resolving", "active").ok, true);
  assert.deepEqual(validateStorySceneTransition("resolved", "active"), {
    ok: false,
    code: "invalid-scene-transition",
    allowed: [],
  });
  assert.equal(validateStorySceneTransition("unknown", "active").code, "unknown-scene-status");
});

test("#1675 deterministic validator errors block launch while warnings and notes remain visible", () => {
  assert.deepEqual(STORY_VALIDATOR_SEVERITIES, ["error", "warning", "note", "pass"]);
  assert.equal(storyValidationAllowsLaunch([{ severity: "warning" }, { severity: "note" }]), true);
  assert.equal(storyValidationAllowsLaunch([{ severity: "pass" }, { severity: "error" }]), false);
});

test("#1675 architecture ratification preserves STORY, Wyrmwood, BUZZ, PPF and agent boundaries", async () => {
  const architecture = await readFile(new URL("../docs/story-the-unwritten.md", import.meta.url), "utf8");
  assert.match(architecture, /STORY = the universal playable-story grammar and game engine/);
  assert.match(architecture, /BUZZ owns social discovery\/presence; STORY owns authoritative active game state/);
  assert.match(architecture, /Generated material is not durable canon until admitted/);
  assert.match(architecture, /Stored is not loaded\. Loaded is not active\. Active is not running inference\./);
  assert.match(architecture, /Do not begin by changing Wyrmwood\./);
});

test("#1675 registers deterministic test ownership for future STORY changes", async () => {
  const registry = JSON.parse(await readFile(new URL("../config/developer-diagnostics.json", import.meta.url), "utf8"));
  const area = registry.areas.find((candidate) => candidate.id === "story-the-unwritten");
  assert.ok(area);
  assert.ok(area.patterns.includes("modules/story-the-unwritten/**"));
  assert.ok(area.suites.includes("tests/issue-1675-story-contracts.test.mjs"));
  assert.deepEqual(area.contracts, ["story-the-unwritten.contracts"]);
  assert.ok(registry.contracts["story-the-unwritten.contracts"].owners.some(
    (owner) => owner.path === "modules/story-the-unwritten/contracts.ts",
  ));
});
