import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  attachStoryAgentDefinitionsToWorldBundle,
  createStoryAgentContinuityRef,
  createStoryAgentDefinition,
  loadStoryAgentDefinitionsFromWorldBundle,
} from "../modules/story-the-unwritten/agent/creator-definition.mjs";
import {
  persistStoryCharacterDefinition,
  persistStoryCharacterState,
  readStoryCharacterBundle,
} from "../modules/story-the-unwritten/character-persistence.mjs";

const characterId = "character:keeper";
const worldId = "world:lantern";

function provenance() {
  return {
    authorship: "human",
    creatorRef: "profile:creator",
    sourceRefs: [],
    admittedByRef: null,
    admittedAt: null,
  };
}

function characterDefinition() {
  return {
    id: characterId,
    schemaVersion: 1,
    worldId,
    name: "The Keeper",
    role: "guardian of the sealed road",
    identityRefs: ["identity:keeper"],
    traitRefs: ["trait:patient", "trait:protective"],
    provenance: provenance(),
  };
}

function characterState(revision = 4) {
  return {
    characterId,
    revision,
    locationId: "location:crossroads",
    conditionRefs: [],
    objectiveRefs: ["objective:protect-road"],
    inventoryRefs: ["object:brass-key"],
    knowledgeRefs: ["knowledge:gate-name"],
    relationshipEdgeRefs: [],
    memoryCursor: "memory:keeper:4",
    updatedByEventId: `event:keeper:${revision}`,
  };
}

function agentDefinition() {
  return createStoryAgentDefinition({
    id: "story-agent:keeper",
    worldId,
    characterId,
    approvedProfileId: "master-oaken-vague",
    personalityRefs: ["trait:patient", "trait:protective"],
    goalRefs: ["objective:protect-road"],
    knowledgePolicyRef: "story-knowledge-policy:keeper",
    memoryScopeRef: "story-memory-scope:keeper",
    gameActionPermissionRefs: ["story-action:set-value", "story-action:move-character"],
    creatorRef: "profile:creator",
  });
}

test("#1675 Phase 4 reference character binds to an existing approved PlotPickle Agent Profile", async () => {
  const registry = JSON.parse(await readFile(new URL("../config/agent-profiles.json", import.meta.url), "utf8"));
  const definition = agentDefinition();
  assert.ok(registry.profiles.some((profile) => profile.id === "master-oaken-vague"));
  assert.equal(definition.approvedRoleTemplateRef, "agent-profile:master-oaken-vague");
  assert.equal(definition.hostAuthorityRef, "agent-contract:story-character/v1");
});

test("#1675 Phase 4 user-created Story Agent Definition is portable data, not host authority", () => {
  const definition = agentDefinition();
  const bundle = attachStoryAgentDefinitionsToWorldBundle({
    world: { id: worldId },
    gameDefinition: { id: "game:lantern", worldId },
    pieces: [],
  }, [definition]);
  const reopened = JSON.parse(JSON.stringify(bundle));
  const loaded = loadStoryAgentDefinitionsFromWorldBundle(reopened);

  assert.equal(loaded.ok, true);
  assert.deepEqual(loaded.definitions, [definition]);
  assert.equal("tools" in loaded.definitions[0], false);
  assert.equal("connectors" in loaded.definitions[0], false);
  assert.equal("credentials" in loaded.definitions[0], false);
  assert.equal("runtime" in loaded.definitions[0], false);
});

test("#1675 Phase 4 imported Story Agent data cannot smuggle host capabilities", () => {
  const definition = agentDefinition();
  const poisoned = {
    world: { id: worldId },
    storyAgentDefinitions: [{
      ...definition,
      tools: ["shell"],
      connectors: ["private-drive"],
      providerAuthority: "unbounded",
    }],
  };
  const loaded = loadStoryAgentDefinitionsFromWorldBundle(poisoned);

  assert.equal(loaded.ok, false);
  assert.equal(loaded.reason, "invalid-agent-definitions");
  assert.ok(loaded.errors.some((error) => error.includes("tools")));
  assert.ok(loaded.errors.some((error) => error.includes("connectors")));
  assert.ok(loaded.errors.some((error) => error.includes("providerAuthority")));
});

test("#1675 Phase 4 cooling persists character truth while runtime/context refs disappear", () => {
  let project = { id: "project:continuity", extensions: {} };
  project = persistStoryCharacterDefinition(project, characterDefinition()).project;
  project = persistStoryCharacterState(project, characterState(4)).project;

  const reopenedProject = JSON.parse(JSON.stringify(project));
  const bundle = readStoryCharacterBundle(reopenedProject, characterId);
  assert.equal(bundle.ok, true);
  assert.equal(bundle.currentState.revision, 4);
  assert.equal(bundle.currentState.locationId, "location:crossroads");
  assert.deepEqual(bundle.currentState.objectiveRefs, ["objective:protect-road"]);

  const continuity = createStoryAgentContinuityRef({
    definition: agentDefinition(),
    characterState: bundle.currentState,
  });
  assert.deepEqual(continuity, {
    definitionId: "story-agent:keeper",
    characterId,
    characterStateRef: "story-character-state:character:keeper@4",
    approvedRoleTemplateRef: "agent-profile:master-oaken-vague",
    hostAuthorityRef: "agent-contract:story-character/v1",
    runtimeExecutionRef: null,
    contextEnvelopeRef: null,
    activationTier: "cold",
  });
});

test("#1675 Phase 4 later character state revisions replace continuity input without changing agent authority", () => {
  let project = { id: "project:continuity", extensions: {} };
  project = persistStoryCharacterDefinition(project, characterDefinition()).project;
  project = persistStoryCharacterState(project, characterState(4)).project;
  project = persistStoryCharacterState(project, {
    ...characterState(5),
    locationId: "location:beyond-gate",
    objectiveRefs: ["objective:find-road"],
  }).project;

  const reopened = readStoryCharacterBundle(JSON.parse(JSON.stringify(project)), characterId);
  const continuity = createStoryAgentContinuityRef({ definition: agentDefinition(), characterState: reopened.currentState });

  assert.equal(reopened.currentState.revision, 5);
  assert.equal(reopened.currentState.locationId, "location:beyond-gate");
  assert.equal(continuity.characterStateRef, "story-character-state:character:keeper@5");
  assert.equal(continuity.approvedRoleTemplateRef, "agent-profile:master-oaken-vague");
  assert.equal(continuity.runtimeExecutionRef, null);
  assert.equal(continuity.contextEnvelopeRef, null);
});
