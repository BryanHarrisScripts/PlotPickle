import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createStoryAgentActionProposal,
  resolveStoryAgentActionProposal,
  storyAgentPermissionForOperation,
} from "../modules/story-the-unwritten/agent/action-proposal.mjs";

function runtimeFixture() {
  return {
    session: {
      id: "session:agent-proof",
      status: "active",
      currentSceneId: "scene:1",
      stateRevision: 0,
      latestCheckpointRef: "story-checkpoint:initial",
      resolutionQueue: {
        nextSequence: 1,
        queuedEventIds: [],
        processedIdempotencyKeys: [],
        triggerDepth: 0,
        limits: {
          maximumTriggerDepth: 4,
          maximumOperationsPerScene: 12,
          maximumAgentCallsPerTurn: 1,
        },
      },
    },
    scenes: [{
      id: "scene:1",
      status: "active",
      participantIds: ["character:elara"],
      operationsUsed: 0,
      checkpointRef: "story-checkpoint:initial",
    }],
  };
}

function stateFixture() {
  return {
    revision: 0,
    values: {},
    characterLocations: {},
    objectCustody: {},
    knowledgeByCharacter: {},
    relationships: {},
    openThreads: [],
  };
}

test("#1675 Phase 4 character runtime reuses host Agent Profile, Context Engine and Responsibility Run boundaries", async () => {
  const source = await readFile(
    new URL("../modules/story-the-unwritten/agent/character-agent-runtime.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /from "\.\.\/\.\.\/\.\.\/lib\/agents\/agent-profiles"/);
  assert.match(source, /assembleContextPacket/);
  assert.match(source, /from "\.\.\/\.\.\/\.\.\/lib\/agents\/context\/context-engine"/);
  assert.match(source, /createResponsibilityRun/);
  assert.match(source, /from "\.\.\/\.\.\/\.\.\/lib\/agents\/responsibility\/responsibility-runs"/);
  assert.match(source, /STORY_CHARACTER_AGENT_PROFILE_REF_PREFIX = "agent-profile:"/);
  assert.match(source, /STORY_CHARACTER_AGENT_HOST_AUTHORITY_REF = "agent-contract:story-character\/v1"/);
  assert.match(source, /allowedConnectorIds: \[\]/);
  assert.match(source, /maxCloudCostUsd: 0/);
  assert.doesNotMatch(source, /provider-selection/);
  assert.doesNotMatch(source, /ppf-direct-write/);
});

test("#1675 Phase 4 character context filters remembered, current, agent-visible knowledge before host assembly", async () => {
  const source = await readFile(
    new URL("../modules/story-the-unwritten/agent/character-agent-runtime.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /memory\.visibility === "remembered"/);
  assert.match(source, /reference\.partition === "agent-visible"/);
  assert.match(source, /reference\.subjectRef === input\.character\.id/);
  assert.match(source, /currentKnowledge\.has\(reference\.ref\)/);
  assert.match(source, /permitted\.has\(relationship\.id\)/);
  assert.doesNotMatch(source, /visibility === "forgotten"/);
  assert.doesNotMatch(source, /visibility === "hidden"/);
});

test("#1675 Phase 4 narrative controls stay bounded story references instead of becoming host permissions", async () => {
  const source = await readFile(
    new URL("../modules/story-the-unwritten/agent/character-agent-runtime.ts", import.meta.url),
    "utf8",
  );

  for (const field of [
    "wantRefs",
    "fearRefs",
    "unknownRefs",
    "relationshipRefs",
    "refusalRefs",
    "voiceRefs",
    "worldAbilityRefs",
    "autonomyMode",
  ]) assert.match(source, new RegExp(`\\b${field}\\b`));

  assert.match(source, /"manual" \| "assisted" \| "autonomous"/);
  assert.match(source, /gameActionPermissionRefs/);
  assert.match(source, /Propose only\. Deterministic STORY code decides whether any game action is accepted\./);
});

test("#1675 Phase 4 requires HOT activation before inference and creates only transient AGENT-ACTIVE refs", async () => {
  const source = await readFile(
    new URL("../modules/story-the-unwritten/agent/character-agent-runtime.ts", import.meta.url),
    "utf8",
  );

  assert.match(source, /input\.activation\.tier !== "hot"/);
  assert.match(source, /tier: "agent-active"/);
  assert.match(source, /runtimeExecutionRef: run\.runId/);
  assert.match(source, /characterStateRef: `story-character-state:/);
  assert.doesNotMatch(source, /state\.[A-Za-z0-9_]+\s*=/);
});

test("#1675 Phase 4 agent proposals require an explicit operation permission", () => {
  const denied = createStoryAgentActionProposal({
    sessionId: "session:agent-proof",
    sceneId: "scene:1",
    characterId: "character:elara",
    proposalId: "proposal:1",
    operation: { kind: "set-value", ref: "story-value:door", value: true },
    gameActionPermissionRefs: [],
    proposedAt: "2026-09-05T12:00:00.000Z",
  });

  assert.equal(storyAgentPermissionForOperation("set-value"), "story-action:set-value");
  assert.equal(denied.ok, false);
  assert.equal(denied.failure.code, "story-agent-action-not-permitted");
});

test("#1675 Phase 4 permitted agent proposals still resolve only through deterministic STORY code", () => {
  const runtime = runtimeFixture();
  const state = stateFixture();
  const result = resolveStoryAgentActionProposal({
    runtime,
    state,
    characterId: "character:elara",
    proposalId: "proposal:accepted",
    operation: { kind: "set-value", ref: "story-value:door", value: true },
    gameActionPermissionRefs: ["story-action:set-value"],
    rules: [],
    proposedAt: "2026-09-05T12:00:00.000Z",
  });

  assert.equal(result.ok, true);
  assert.equal(result.status, "accepted");
  assert.equal(result.authority, "deterministic-story-engine");
  assert.equal(result.proposedBy, "character:elara");
  assert.equal(result.state.values["story-value:door"], true);
  assert.equal(result.state.revision, 1);
  assert.equal(state.revision, 0);
  assert.deepEqual(state.values, {});
});

test("#1675 Phase 4 dormant or off-scene characters cannot propose an action", () => {
  const runtime = runtimeFixture();
  const result = resolveStoryAgentActionProposal({
    runtime,
    state: stateFixture(),
    characterId: "character:not-present",
    proposalId: "proposal:off-scene",
    operation: { kind: "set-value", ref: "story-value:door", value: true },
    gameActionPermissionRefs: ["story-action:set-value"],
  });

  assert.equal(result.ok, false);
  assert.equal(result.failure.code, "story-agent-character-not-active");
});
