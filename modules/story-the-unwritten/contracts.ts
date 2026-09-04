/**
 * Module-owned contracts for Story: The Unwritten.
 *
 * STORY owns playable session mechanics. These records reference, rather than
 * duplicate, PlotPickle project/canon, agent, asset, and provider authorities.
 */

export const STORY_CONTRACT_SCHEMA_VERSION = 1 as const;

export type StoryId = string;
export type StoryReference = string;

export type StoryPieceType =
  | "character"
  | "desire"
  | "need"
  | "location"
  | "relationship"
  | "object"
  | "conflict"
  | "secret"
  | "event"
  | "world-rule"
  | "story-technique"
  | "agent-binding";

export type StorySchool = "character" | "plot" | "world" | "conflict" | "theme" | "style";
export type StoryVisibility = "private" | "unlisted" | "public";
export type StoryAuthorship = "human" | "generated-proposal" | "engine" | "imported";

export interface StoryProvenance {
  readonly authorship: StoryAuthorship;
  readonly creatorRef: StoryReference;
  readonly sourceRefs: readonly StoryReference[];
  readonly admittedByRef: StoryReference | null;
  readonly admittedAt: string | null;
}

export type StoryRuleTrigger =
  | "action-proposed"
  | "action-accepted"
  | "scene-started"
  | "scene-ended"
  | "state-changed"
  | "knowledge-changed"
  | "relationship-changed";

export type StoryCondition =
  | { readonly kind: "ref-exists"; readonly ref: StoryReference }
  | { readonly kind: "ref-absent"; readonly ref: StoryReference }
  | { readonly kind: "value-equals"; readonly ref: StoryReference; readonly value: string | number | boolean }
  | { readonly kind: "value-at-least"; readonly ref: StoryReference; readonly value: number }
  | { readonly kind: "actor-knows"; readonly actorId: StoryId; readonly knowledgeRef: StoryReference }
  | { readonly kind: "actor-present"; readonly actorId: StoryId; readonly locationId: StoryId };

export type StoryOperation =
  | { readonly kind: "set-value"; readonly ref: StoryReference; readonly value: string | number | boolean | null }
  | { readonly kind: "adjust-number"; readonly ref: StoryReference; readonly delta: number }
  | { readonly kind: "move-character"; readonly characterId: StoryId; readonly locationId: StoryId }
  | { readonly kind: "transfer-object"; readonly objectId: StoryId; readonly custodianRef: StoryReference }
  | { readonly kind: "grant-knowledge"; readonly characterId: StoryId; readonly knowledgeRef: StoryReference }
  | { readonly kind: "revoke-knowledge"; readonly characterId: StoryId; readonly knowledgeRef: StoryReference }
  | { readonly kind: "adjust-relationship"; readonly relationshipId: StoryId; readonly delta: number }
  | { readonly kind: "open-thread"; readonly threadRef: StoryReference }
  | { readonly kind: "resolve-thread"; readonly threadRef: StoryReference }
  | { readonly kind: "emit-event"; readonly eventType: string; readonly subjectRefs: readonly StoryReference[] };

export interface StoryRule {
  readonly id: StoryId;
  readonly schemaVersion: typeof STORY_CONTRACT_SCHEMA_VERSION;
  readonly title: string;
  readonly priority: number;
  readonly when: StoryRuleTrigger;
  readonly if: readonly StoryCondition[];
  readonly cost: readonly StoryOperation[];
  readonly do: readonly StoryOperation[];
  readonly then: readonly StoryOperation[];
  readonly enabled: boolean;
  readonly provenance: StoryProvenance;
}

export interface StoryAgentBinding {
  readonly storyAgentDefinitionId: StoryId;
  readonly characterId: StoryId;
  readonly approvedRoleTemplateRef: StoryReference;
  readonly hostAuthorityRef: StoryReference;
}

export interface StoryPiece {
  readonly id: StoryId;
  readonly schemaVersion: typeof STORY_CONTRACT_SCHEMA_VERSION;
  readonly type: StoryPieceType;
  readonly title: string;
  readonly description: string;
  readonly worldId: StoryId;
  readonly schools: readonly StorySchool[];
  readonly tags: readonly string[];
  readonly visibility: StoryVisibility;
  readonly stateRefs: readonly StoryReference[];
  readonly ruleIds: readonly StoryId[];
  readonly relationshipIds: readonly StoryId[];
  readonly assetRefs: readonly StoryReference[];
  readonly agentBinding: StoryAgentBinding | null;
  readonly curriculumRefs: readonly StoryReference[];
  readonly provenance: StoryProvenance;
  readonly createdAt: string;
  readonly updatedAt: string;
}

/** Durable identity and authored characterization; mutable play state lives elsewhere. */
export interface StoryCharacterDefinition {
  readonly id: StoryId;
  readonly schemaVersion: typeof STORY_CONTRACT_SCHEMA_VERSION;
  readonly worldId: StoryId;
  readonly name: string;
  readonly role: string;
  readonly identityRefs: readonly StoryReference[];
  readonly traitRefs: readonly StoryReference[];
  readonly provenance: StoryProvenance;
}

/** Mutable, revision-addressed state for one character. */
export interface StoryCharacterState {
  readonly characterId: StoryId;
  readonly revision: number;
  readonly locationId: StoryId | null;
  readonly conditionRefs: readonly StoryReference[];
  readonly objectiveRefs: readonly StoryReference[];
  readonly inventoryRefs: readonly StoryReference[];
  readonly knowledgeRefs: readonly StoryReference[];
  readonly relationshipEdgeRefs: readonly StoryReference[];
  readonly memoryCursor: StoryReference | null;
  readonly updatedByEventId: StoryId;
}

/**
 * Deliberately small graph/index record. It must never contain biography,
 * memories, relationship objects, assets, dialogue, prompts, or live agents.
 */
export interface StoryCharacterGraphNode {
  readonly id: StoryId;
  readonly schemaVersion: typeof STORY_CONTRACT_SCHEMA_VERSION;
  readonly worldId: StoryId;
  readonly definitionRef: StoryReference;
  readonly stateRef: StoryReference;
  readonly relationshipIndexRef: StoryReference;
  readonly memoryIndexRef: StoryReference;
  readonly knowledgeIndexRef: StoryReference;
  readonly assetIndexRef: StoryReference;
}

export interface StoryMemoryEventRecord {
  readonly id: StoryId;
  readonly characterId: StoryId;
  readonly eventRef: StoryReference;
  readonly visibility: "remembered" | "forgotten" | "hidden";
  readonly recordedAt: string;
}

export interface StoryRelationshipEdge {
  readonly id: StoryId;
  readonly fromCharacterId: StoryId;
  readonly toCharacterId: StoryId;
  readonly kind: string;
  readonly value: number;
  readonly historyIndexRef: StoryReference;
  readonly updatedByEventId: StoryId;
}

export interface StoryKnowledgeReference {
  readonly ref: StoryReference;
  readonly partition: StoryKnowledgePartition;
  readonly subjectRef: StoryReference;
}

export interface StoryAssetReference {
  readonly ref: StoryReference;
  readonly kind: "image" | "audio" | "video" | "document" | "other";
  readonly approved: boolean;
}

export type StoryCharacterActivationTier = "cold" | "warm" | "hot" | "agent-active";

export interface StoryCharacterActivation {
  readonly characterId: StoryId;
  readonly tier: StoryCharacterActivationTier;
  readonly hydratedRef: StoryReference | null;
  readonly activeSceneId: StoryId | null;
  readonly inferenceRequestRef: StoryReference | null;
  readonly budgetRef: StoryReference | null;
}

export type StoryKnowledgePartition =
  | "world-truth"
  | "audience"
  | "player"
  | "character"
  | "agent-visible"
  | "creator-hidden";

export type StoryStateZone =
  | "available"
  | "active-scene"
  | "world"
  | "custody"
  | "hidden-knowledge"
  | "unresolved-threads"
  | "resolved-history";

export type StorySceneStatus = "ready" | "active" | "resolving" | "resolved" | "failed";

export interface StoryScene {
  readonly id: StoryId;
  readonly ordinal: number;
  readonly status: StorySceneStatus;
  readonly participantIds: readonly StoryId[];
  readonly locationId: StoryId;
  readonly objectiveRefs: readonly StoryReference[];
  readonly activeConflictIds: readonly StoryId[];
  readonly unresolvedThreadRefs: readonly StoryReference[];
  readonly narrativeBudget: number;
  readonly operationsUsed: number;
  readonly checkpointRef: StoryReference;
}

export interface StoryAction {
  readonly id: StoryId;
  readonly sessionId: StoryId;
  readonly sceneId: StoryId;
  readonly actorRef: StoryReference;
  readonly pieceId: StoryId | null;
  readonly operation: StoryOperation;
  readonly idempotencyKey: string;
  readonly proposedAt: string;
}

export interface StoryEvent {
  readonly id: StoryId;
  readonly sequence: number;
  readonly causationRef: StoryReference;
  readonly actionId: StoryId;
  readonly ruleId: StoryId | null;
  readonly operation: StoryOperation;
  readonly status: "queued" | "accepted" | "rejected";
  readonly stateRevisionBefore: number;
  readonly stateRevisionAfter: number | null;
}

export interface StoryResolutionLimits {
  readonly maximumTriggerDepth: number;
  readonly maximumOperationsPerScene: number;
  readonly maximumAgentCallsPerTurn: number;
}

export interface StoryResolutionQueue {
  readonly nextSequence: number;
  readonly queuedEventIds: readonly StoryId[];
  readonly processedIdempotencyKeys: readonly string[];
  readonly triggerDepth: number;
  readonly limits: StoryResolutionLimits;
}

export interface StorySession {
  readonly id: StoryId;
  readonly schemaVersion: typeof STORY_CONTRACT_SCHEMA_VERSION;
  readonly gameDefinitionId: StoryId;
  readonly worldId: StoryId;
  readonly worldRevisionRef: StoryReference;
  readonly ppfProjectRef: StoryReference;
  readonly status: "ready" | "active" | "paused" | "completed" | "failed";
  readonly currentSceneId: StoryId | null;
  readonly sceneIds: readonly StoryId[];
  readonly stateRevision: number;
  readonly stateZoneIndexRefs: Readonly<Record<StoryStateZone, StoryReference>>;
  readonly resolutionQueue: StoryResolutionQueue;
  readonly acceptedEventLogRef: StoryReference;
  readonly latestCheckpointRef: StoryReference;
  readonly canonAdmissionRef: StoryReference | null;
}

export interface StoryWorld {
  readonly id: StoryId;
  readonly schemaVersion: typeof STORY_CONTRACT_SCHEMA_VERSION;
  readonly title: string;
  readonly description: string;
  readonly visibility: StoryVisibility;
  readonly ppfProjectRef: StoryReference;
  readonly graphIndexRef: StoryReference;
  readonly pieceIndexRef: StoryReference;
  readonly ruleIndexRef: StoryReference;
  readonly assetIndexRef: StoryReference;
  readonly compatibility: StoryCompatibility;
  readonly provenance: StoryProvenance;
}

export interface StoryCompatibility {
  readonly storySchemaVersion: typeof STORY_CONTRACT_SCHEMA_VERSION;
  readonly minimumEngineVersion: string;
  readonly featureIds: readonly string[];
  readonly requiredCapabilityRefs: readonly StoryReference[];
}

export interface StoryAgentDefinition {
  readonly id: StoryId;
  readonly schemaVersion: typeof STORY_CONTRACT_SCHEMA_VERSION;
  readonly worldId: StoryId;
  readonly characterId: StoryId;
  readonly approvedRoleTemplateRef: StoryReference;
  readonly hostAuthorityRef: StoryReference;
  readonly personalityRefs: readonly StoryReference[];
  readonly goalRefs: readonly StoryReference[];
  readonly knowledgePolicyRef: StoryReference;
  readonly memoryScopeRef: StoryReference;
  readonly gameActionPermissionRefs: readonly StoryReference[];
  readonly provenance: StoryProvenance;
}

export interface StoryAgentInstance {
  readonly id: StoryId;
  readonly definitionId: StoryId;
  readonly sessionId: StoryId;
  readonly characterStateRef: StoryReference;
  readonly activationTier: StoryCharacterActivationTier;
  readonly contextEnvelopeRef: StoryReference | null;
  readonly runtimeExecutionRef: StoryReference | null;
}

export interface StoryGameDefinition {
  readonly id: StoryId;
  readonly schemaVersion: typeof STORY_CONTRACT_SCHEMA_VERSION;
  readonly worldId: StoryId;
  readonly title: string;
  readonly sceneCount: number;
  readonly startingPieceIds: readonly StoryId[];
  readonly ruleIds: readonly StoryId[];
  readonly endConditionRefs: readonly StoryReference[];
  readonly resolutionLimits: StoryResolutionLimits;
  readonly compatibility: StoryCompatibility;
  readonly provenance: StoryProvenance;
}

export type StoryValidatorSeverity = "error" | "warning" | "note" | "pass";

export interface StoryValidatorFinding {
  readonly code: string;
  readonly severity: StoryValidatorSeverity;
  readonly subjectRefs: readonly StoryReference[];
  readonly message: string;
  readonly evidenceRefs: readonly StoryReference[];
  readonly suggestedRepair: string | null;
}

export interface StoryGameValidationResult {
  readonly gameDefinitionId: StoryId;
  readonly checkedRevisionRef: StoryReference;
  readonly findings: readonly StoryValidatorFinding[];
  readonly launchAllowed: boolean;
  readonly validatorVersion: string;
}
