import {
  agentProfileById,
  resolveAgentProfileCapabilities,
  type AgentProfile,
} from "../../../lib/agents/agent-profiles";
import {
  CONTEXT_AUTHORITY,
  assembleContextPacket,
  type ContextItemInput,
  type ContextPacket,
} from "../../../lib/agents/context/context-engine";
import {
  createResponsibilityRun,
  type ResponsibilityRun,
} from "../../../lib/agents/responsibility/responsibility-runs";
import type {
  StoryAgentDefinition,
  StoryAgentInstance,
  StoryCharacterActivation,
  StoryCharacterDefinition,
  StoryCharacterState,
  StoryKnowledgeReference,
  StoryMemoryEventRecord,
  StoryReference,
  StoryRelationshipEdge,
  StoryScene,
} from "../contracts";

export const STORY_CHARACTER_AGENT_HOST_AUTHORITY_REF = "agent-contract:story-character/v1" as const;
export const STORY_CHARACTER_AGENT_PROFILE_REF_PREFIX = "agent-profile:" as const;
export const STORY_CHARACTER_AGENT_CONTEXT_BUDGET = 24_000 as const;

const STORY_AGENT_CONTEXT_AUTHORITY = CONTEXT_AUTHORITY.storyKnowledgeGraph;

export type StoryCharacterAutonomyMode = "manual" | "assisted" | "autonomous";

export type StoryCharacterNarrativeControls = {
  readonly wantRefs: readonly StoryReference[];
  readonly fearRefs: readonly StoryReference[];
  readonly unknownRefs: readonly StoryReference[];
  readonly relationshipRefs: readonly StoryReference[];
  readonly refusalRefs: readonly StoryReference[];
  readonly voiceRefs: readonly StoryReference[];
  readonly worldAbilityRefs: readonly StoryReference[];
  readonly autonomyMode: StoryCharacterAutonomyMode;
};

export type StoryCharacterAgentTurnInput = {
  readonly definition: StoryAgentDefinition;
  readonly character: StoryCharacterDefinition;
  readonly state: StoryCharacterState;
  readonly activation: StoryCharacterActivation;
  readonly scene: StoryScene;
  readonly sessionId: string;
  readonly memories: readonly StoryMemoryEventRecord[];
  readonly relationships: readonly StoryRelationshipEdge[];
  readonly knowledge: readonly StoryKnowledgeReference[];
  readonly narrativeControls?: Partial<StoryCharacterNarrativeControls>;
  readonly worldRuleRefs?: readonly StoryReference[];
  readonly hostGrantedCapabilities?: readonly string[];
  readonly taskId?: string;
};

export type StoryCharacterAgentTurn = {
  readonly profile: AgentProfile;
  readonly effectiveHostCapabilities: readonly string[];
  readonly gameActionPermissionRefs: readonly StoryReference[];
  readonly contextPacket: ContextPacket;
  readonly run: ResponsibilityRun;
  readonly activation: StoryCharacterActivation;
  readonly instance: StoryAgentInstance;
};

function isReference(value: unknown): value is string {
  return typeof value === "string" && Boolean(value.trim());
}

function uniqueReferences(values: readonly string[]) {
  return [...new Set(values.filter(isReference))].sort((left, right) => left.localeCompare(right));
}

function hostProfileId(approvedRoleTemplateRef: string) {
  if (!approvedRoleTemplateRef.startsWith(STORY_CHARACTER_AGENT_PROFILE_REF_PREFIX)) {
    throw new Error(
      `Executable STORY character agents require ${STORY_CHARACTER_AGENT_PROFILE_REF_PREFIX}<profile-id>; arbitrary role templates cannot create host authority.`,
    );
  }
  const profileId = approvedRoleTemplateRef.slice(STORY_CHARACTER_AGENT_PROFILE_REF_PREFIX.length).trim();
  if (!profileId) throw new Error("STORY character agent role template must identify an approved Agent Profile.");
  return profileId;
}

function assertTurnBoundary(input: StoryCharacterAgentTurnInput) {
  if (!isReference(input.sessionId)) throw new Error("STORY character agent sessionId is required.");
  if (input.definition.hostAuthorityRef !== STORY_CHARACTER_AGENT_HOST_AUTHORITY_REF) {
    throw new Error("STORY character agent host authority reference is not approved for execution.");
  }
  if (input.definition.characterId !== input.character.id || input.state.characterId !== input.character.id) {
    throw new Error("STORY character agent definition, durable character and mutable state must identify the same character.");
  }
  if (input.definition.worldId !== input.character.worldId) {
    throw new Error("STORY character agent definition and character must belong to the same Story World.");
  }
  if (input.activation.characterId !== input.character.id || input.activation.tier !== "hot") {
    throw new Error("STORY character must be HOT before an Agent-active turn can be prepared.");
  }
  if (!isReference(input.activation.hydratedRef) || input.activation.activeSceneId !== input.scene.id) {
    throw new Error("HOT STORY character activation must reference the current hydrated scene.");
  }
  if (input.activation.inferenceRequestRef !== null || input.activation.budgetRef !== null) {
    throw new Error("HOT STORY character activation cannot already carry inference state.");
  }
  if (input.scene.status !== "active" || !input.scene.participantIds.includes(input.character.id)) {
    throw new Error("STORY character agent turns require the character to participate in the active scene.");
  }
}

function legalMemoryRefs(input: StoryCharacterAgentTurnInput) {
  return uniqueReferences(input.memories
    .filter((memory) => memory.characterId === input.character.id && memory.visibility === "remembered")
    .map((memory) => memory.eventRef));
}

function legalRelationshipRefs(input: StoryCharacterAgentTurnInput) {
  const permitted = new Set(input.state.relationshipEdgeRefs);
  return uniqueReferences(input.relationships
    .filter((relationship) => permitted.has(relationship.id))
    .filter((relationship) => relationship.fromCharacterId === input.character.id || relationship.toCharacterId === input.character.id)
    .map((relationship) => relationship.id));
}

function legalKnowledgeRefs(input: StoryCharacterAgentTurnInput) {
  const currentKnowledge = new Set(input.state.knowledgeRefs);
  return uniqueReferences(input.knowledge
    .filter((reference) => reference.partition === "agent-visible")
    .filter((reference) => reference.subjectRef === input.character.id)
    .filter((reference) => currentKnowledge.has(reference.ref))
    .map((reference) => reference.ref));
}

function narrativeControls(input: StoryCharacterAgentTurnInput): StoryCharacterNarrativeControls {
  const supplied = input.narrativeControls ?? {};
  const autonomyMode = supplied.autonomyMode ?? "manual";
  if (!(["manual", "assisted", "autonomous"] as const).includes(autonomyMode)) {
    throw new Error(`Unsupported STORY character autonomy mode ${String(autonomyMode)}.`);
  }
  return {
    wantRefs: uniqueReferences(supplied.wantRefs ?? []),
    fearRefs: uniqueReferences(supplied.fearRefs ?? []),
    unknownRefs: uniqueReferences(supplied.unknownRefs ?? []),
    relationshipRefs: uniqueReferences(supplied.relationshipRefs ?? []),
    refusalRefs: uniqueReferences(supplied.refusalRefs ?? []),
    voiceRefs: uniqueReferences(supplied.voiceRefs ?? []),
    worldAbilityRefs: uniqueReferences(supplied.worldAbilityRefs ?? []),
    autonomyMode,
  };
}

function storyContextItem(id: string, content: unknown, required = false): ContextItemInput {
  return {
    id,
    sourceType: "story-knowledge-graph",
    sourceId: id,
    content: JSON.stringify(content),
    trust: "approved",
    authority: STORY_AGENT_CONTEXT_AUTHORITY,
    allowedUse: "reference",
    required,
  };
}

function characterContextItems(input: StoryCharacterAgentTurnInput): ContextItemInput[] {
  const narrative = narrativeControls(input);
  const memoryRefs = legalMemoryRefs(input);
  const relationshipRefs = legalRelationshipRefs(input);
  const knowledgeRefs = legalKnowledgeRefs(input);

  return [
    storyContextItem(`story-character:${input.character.id}:identity`, {
      characterId: input.character.id,
      name: input.character.name,
      role: input.character.role,
      identityRefs: uniqueReferences(input.character.identityRefs),
      traitRefs: uniqueReferences(input.character.traitRefs),
      personalityRefs: uniqueReferences(input.definition.personalityRefs),
      goalRefs: uniqueReferences(input.definition.goalRefs),
      narrative,
    }, true),
    storyContextItem(`story-character:${input.character.id}:state@${input.state.revision}`, {
      revision: input.state.revision,
      locationId: input.state.locationId,
      conditionRefs: uniqueReferences(input.state.conditionRefs),
      objectiveRefs: uniqueReferences(input.state.objectiveRefs),
      inventoryRefs: uniqueReferences(input.state.inventoryRefs),
      rememberedEventRefs: memoryRefs,
      relationshipRefs,
      agentVisibleKnowledgeRefs: knowledgeRefs,
    }, true),
    storyContextItem(`story-scene:${input.scene.id}`, {
      sceneId: input.scene.id,
      ordinal: input.scene.ordinal,
      locationId: input.scene.locationId,
      participantIds: uniqueReferences(input.scene.participantIds),
      objectiveRefs: uniqueReferences(input.scene.objectiveRefs),
      activeConflictIds: uniqueReferences(input.scene.activeConflictIds),
      unresolvedThreadRefs: uniqueReferences(input.scene.unresolvedThreadRefs),
      worldRuleRefs: uniqueReferences(input.worldRuleRefs ?? []),
    }, true),
    storyContextItem(`story-character:${input.character.id}:permissions`, {
      gameActionPermissionRefs: uniqueReferences(input.definition.gameActionPermissionRefs),
      knowledgePolicyRef: input.definition.knowledgePolicyRef,
      memoryScopeRef: input.definition.memoryScopeRef,
      rule: "Propose only. Deterministic STORY code decides whether any game action is accepted.",
    }, true),
  ];
}

export function prepareStoryCharacterAgentTurn(input: StoryCharacterAgentTurnInput): StoryCharacterAgentTurn {
  assertTurnBoundary(input);

  const profileId = hostProfileId(input.definition.approvedRoleTemplateRef);
  const profile = agentProfileById(profileId);
  if (!profile) throw new Error(`Unknown approved STORY character Agent Profile: ${profileId}.`);

  const effectiveHostCapabilities = resolveAgentProfileCapabilities({
    profileId: profile.id,
    hostGrantedCapabilities: input.hostGrantedCapabilities ?? [],
  });
  const taskId = input.taskId?.trim() || `story-character:${input.sessionId}:${input.scene.id}:${input.character.id}`;
  const goal = `Propose one bounded in-world action as ${input.character.name}. Use only the supplied STORY character and active-scene context. Do not mutate STORY state, PPF canon, project data, credentials, providers, connectors, or source code.`;
  const contextPacket = assembleContextPacket({
    profileId: profile.id,
    taskId,
    goal,
    budgetCharacters: STORY_CHARACTER_AGENT_CONTEXT_BUDGET,
    expectedOutputSchema: "one non-authoritative STORY action proposal constrained by gameActionPermissionRefs",
    items: characterContextItems(input),
  });
  const run = createResponsibilityRun({
    kind: "creative-proposal",
    goal,
    profileId: profile.id,
    skillUris: profile.skillUris,
    allowedScopes: [],
    allowedConnectorIds: [],
    context: {
      taskId: contextPacket.taskId,
      sourceIds: contextPacket.receipt.sources.map((source) => source.id),
      receiptGeneratedAt: contextPacket.receipt.generatedAt,
    },
    verificationMode: "deterministic",
    limits: {
      maxAttempts: 1,
      timeoutMs: 5 * 60_000,
      maxParallelChildren: 0,
      maxContextCharacters: STORY_CHARACTER_AGENT_CONTEXT_BUDGET,
      maxTokens: 4_000,
      maxToolCalls: 1,
      maxCloudCostUsd: 0,
    },
  });
  const inferenceRequestRef = `story-inference:${run.runId}`;
  const budgetRef = `story-budget:${run.runId}`;
  const activation: StoryCharacterActivation = {
    characterId: input.character.id,
    tier: "agent-active",
    hydratedRef: input.activation.hydratedRef,
    activeSceneId: input.scene.id,
    inferenceRequestRef,
    budgetRef,
  };
  const instance: StoryAgentInstance = {
    id: `story-agent-instance:${input.definition.id}:${input.sessionId}`,
    definitionId: input.definition.id,
    sessionId: input.sessionId,
    characterStateRef: `story-character-state:${input.character.id}@${input.state.revision}`,
    activationTier: "agent-active",
    contextEnvelopeRef: contextPacket.taskId,
    runtimeExecutionRef: run.runId,
  };

  return {
    profile,
    effectiveHostCapabilities,
    gameActionPermissionRefs: uniqueReferences(input.definition.gameActionPermissionRefs),
    contextPacket,
    run,
    activation,
    instance,
  };
}
