import type { SequenceDirectorDraft, SequenceDirectorSurface } from "../../core/contracts/sequence-director";
import { agentProfileById } from "../agents/agent-profiles";
import {
  createResponsibilityRun,
  type ResponsibilityRun,
} from "../agents/responsibility/responsibility-runs";

export const PREPRODUCTION_ASSISTANCE_ROLES = [
  "craft-guidance",
  "structure-review",
  "continuity-review",
  "creative-coordination",
  "story-review",
] as const;

export type PreproductionAssistanceRole = (typeof PREPRODUCTION_ASSISTANCE_ROLES)[number];

const PROFILE_BY_ROLE: Readonly<Record<PreproductionAssistanceRole, string>> = {
  "craft-guidance": "sage-brinewick",
  "structure-review": "elowen-mapweaver",
  "continuity-review": "mira-threadmere",
  "creative-coordination": "quillan-reedcloak",
  "story-review": "critics-circle",
};

export type PreproductionAssistanceAuthority = {
  readonly canonicalAuthority: "ppf-human";
  readonly proposalOnly: true;
  readonly directPpfWrite: false;
  readonly providerSelectionOwner: "existing-runtime-capability-resolution";
  readonly transactionOwner: "creative-transaction-contract";
};

export type PreproductionAssistanceEnvelope = {
  readonly role: PreproductionAssistanceRole;
  readonly profileId: string;
  readonly profileName: string;
  readonly profileResponsibility: string;
  readonly sourceIds: readonly string[];
  readonly run: ResponsibilityRun;
  readonly authority: PreproductionAssistanceAuthority;
};

export type SequenceDirectorAssistanceEnvelope = PreproductionAssistanceEnvelope & {
  readonly surface: SequenceDirectorSurface;
  readonly anchorRef: string;
  readonly beatIds: readonly string[];
  readonly referenceIds: readonly string[];
  readonly draftStatus: SequenceDirectorDraft["status"];
  readonly sequenceDirectorAuthority: "sequence-director-contract";
};

const AUTHORITY: PreproductionAssistanceAuthority = {
  canonicalAuthority: "ppf-human",
  proposalOnly: true,
  directPpfWrite: false,
  providerSelectionOwner: "existing-runtime-capability-resolution",
  transactionOwner: "creative-transaction-contract",
};

function boundedText(value: unknown, maximum: number) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function stableSourceIds(values: readonly string[]) {
  return [...new Set(values.map((value) => boundedText(value, 240)).filter(Boolean))].slice(0, 256);
}

function profileFor(role: PreproductionAssistanceRole) {
  const profileId = PROFILE_BY_ROLE[role];
  const profile = agentProfileById(profileId);
  if (!profile) throw new Error(`Missing existing Agent Profile ${profileId} for PRE-PRODUCTION ${role}.`);
  return profile;
}

/**
 * Wrap existing Agent Profiles in the existing Responsibility Run contract for
 * bounded PRE-PRODUCTION assistance. This adapter never executes a provider,
 * writes PPF or promotes an artifact to canon.
 */
export function createPreproductionAssistanceRun(input: {
  readonly role: PreproductionAssistanceRole;
  readonly goal: string;
  readonly taskId: string;
  readonly sourceIds: readonly string[];
  readonly createdAt?: string;
}): PreproductionAssistanceEnvelope {
  const goal = boundedText(input.goal, 2_000);
  const taskId = boundedText(input.taskId, 180);
  const sourceIds = stableSourceIds(input.sourceIds);
  if (!goal) throw new Error("PRE-PRODUCTION assistance requires a bounded goal.");
  if (!taskId) throw new Error("PRE-PRODUCTION assistance requires a stable task id.");
  if (!sourceIds.length) throw new Error("PRE-PRODUCTION assistance requires at least one stable production source ref.");

  const profile = profileFor(input.role);
  const createdAt = input.createdAt || new Date().toISOString();
  const run = createResponsibilityRun({
    kind: "creative-proposal",
    goal,
    profileId: profile.id,
    skillUris: profile.skillUris,
    allowedScopes: [],
    allowedConnectorIds: [],
    context: {
      taskId,
      sourceIds: [...sourceIds],
      receiptGeneratedAt: createdAt,
    },
    verificationMode: "writer-approval",
    limits: {
      maxAttempts: 3,
      timeoutMs: 15 * 60_000,
      maxParallelChildren: 2,
      maxContextCharacters: 48_000,
      maxTokens: profile.requestedCapabilityRole === "deep" ? 32_000 : 16_000,
      maxToolCalls: 24,
      maxCloudCostUsd: 0,
    },
    createdAt,
  });

  return {
    role: input.role,
    profileId: profile.id,
    profileName: profile.displayName,
    profileResponsibility: profile.responsibility,
    sourceIds,
    run,
    authority: AUTHORITY,
  };
}

/**
 * Sequence Director remains the semantic PLAN → STORYBOARD → PREVIS contract.
 * Quillan coordinates any model-assisted proposal around it; the draft itself
 * is not mutated or approved here and the Responsibility Run remains proposal-only.
 */
export function createSequenceDirectorAssistanceRun(input: {
  readonly draft: SequenceDirectorDraft;
  readonly surface: SequenceDirectorSurface;
  readonly goal: string;
  readonly taskId: string;
  readonly additionalSourceIds?: readonly string[];
  readonly createdAt?: string;
}): SequenceDirectorAssistanceEnvelope {
  const draft = input.draft;
  const beatIds = stableSourceIds(draft.beats.map((beat) => beat.id));
  const referenceIds = stableSourceIds(draft.references.flatMap((reference) => [reference.id, reference.assetId]));
  const sourceIds = stableSourceIds([
    draft.anchorRef,
    ...beatIds,
    ...referenceIds,
    ...(input.additionalSourceIds || []),
  ]);
  const base = createPreproductionAssistanceRun({
    role: "creative-coordination",
    goal: boundedText(`Sequence Director ${input.surface} proposal: ${input.goal}`, 2_000),
    taskId: input.taskId,
    sourceIds,
    createdAt: input.createdAt,
  });

  return {
    ...base,
    surface: input.surface,
    anchorRef: draft.anchorRef,
    beatIds,
    referenceIds,
    draftStatus: draft.status,
    sequenceDirectorAuthority: "sequence-director-contract",
  };
}

export function preproductionAssistanceProfileId(role: PreproductionAssistanceRole) {
  return PROFILE_BY_ROLE[role];
}

export function preproductionAssistanceAuthority(): PreproductionAssistanceAuthority {
  return AUTHORITY;
}
