import type { LibraryPPFProject } from "../../core/storage/project-library-browser";
import type { ResponsibilityRun } from "../agents/responsibility/responsibility-runs";
import { attachResponsibilityChild } from "../agents/responsibility/responsibility-runs";
import {
  createPreproductionAssistanceRun,
  type PreproductionAssistanceRole,
} from "./assistance";

export const AGENTIC_STORY_TO_SCREEN_STAGES = [
  "outline",
  "storyboard",
  "previs",
  "scene-workspace",
  "production-candidate",
] as const;

export type AgenticStoryToScreenStageId = (typeof AGENTIC_STORY_TO_SCREEN_STAGES)[number];

export type AgenticStoryToScreenScope =
  | { readonly kind: "mini-block"; readonly blockNumber: number; readonly miniBlockNumber: number }
  | { readonly kind: "block"; readonly blockNumber: number }
  | { readonly kind: "sequence"; readonly sequenceNumber: number };

export type AgenticStoryToScreenStage = {
  readonly id: AgenticStoryToScreenStageId;
  readonly label: string;
  readonly role: PreproductionAssistanceRole;
  readonly run: ResponsibilityRun;
  readonly candidateOnly: true;
  readonly canonical: false;
  readonly approvalRequired: true;
};

export type AgenticStoryToScreenProjectionRequest = {
  readonly version: 1;
  readonly projectId: string;
  readonly canonicalRevision: number;
  readonly scope: AgenticStoryToScreenScope;
  readonly sourceRefs: readonly string[];
  readonly parentRun: ResponsibilityRun;
  readonly stages: readonly AgenticStoryToScreenStage[];
  readonly authority: {
    readonly canonicalStoryOwner: "ppf-human";
    readonly proposalOwner: "responsibility-runs";
    readonly revisionOwner: "creative-transaction-contract";
    readonly routingOwner: "story-mode-capability-resolution";
    readonly acceptanceOwner: "writer-approval";
  };
  readonly policy: {
    readonly cloudSpendAuthorized: false;
    readonly autoPromoteCandidates: false;
    readonly stopBetweenStagesAllowed: true;
    readonly manualWorkflowStillSupported: true;
  };
};

type ResolvedScope = {
  readonly label: string;
  readonly sourceRefs: readonly string[];
};

const STAGE_CONFIG: Readonly<Record<AgenticStoryToScreenStageId, {
  label: string;
  role: PreproductionAssistanceRole;
  goal: string;
}>> = {
  outline: {
    label: "Outline interpretation",
    role: "structure-review",
    goal: "Project the selected written story scope into a non-canonical Outline interpretation using only supplied source refs.",
  },
  storyboard: {
    label: "Storyboard candidates",
    role: "creative-coordination",
    goal: "Propose visual reference and Storyboard candidate intent for the selected story scope without changing accepted story or visual canon.",
  },
  previs: {
    label: "Previs candidates",
    role: "creative-coordination",
    goal: "Propose camera, blocking, motion and timing candidates from accepted upstream evidence without approving or persisting creative state.",
  },
  "scene-workspace": {
    label: "Scene Workspace synchronization",
    role: "continuity-review",
    goal: "Project Dialogue, Action, Shot and Audio synchronization as proposal evidence over existing Scene/Beat/Shot identities.",
  },
  "production-candidate": {
    label: "Production candidate",
    role: "creative-coordination",
    goal: "Prepare a provider-neutral production candidate from approved upstream intent only; do not select a provider, spend cloud budget, or promote generated output.",
  },
};

function stable(values: readonly string[]) {
  return [...new Set(values.filter(Boolean))].sort();
}

function resolveScope(project: LibraryPPFProject, scope: AgenticStoryToScreenScope): ResolvedScope {
  const revisionRef = `ppf-project:${project.id}:revision:${project.revision}`;

  if (scope.kind === "mini-block") {
    const block = project.structure.blocks.find((candidate) => candidate.number === scope.blockNumber);
    const mini = block?.miniBlocks.find((candidate) => candidate.ordinal === scope.miniBlockNumber);
    if (!block || !mini) throw new Error(`Agentic projection scope ${scope.blockNumber}.${scope.miniBlockNumber} was not found.`);
    return {
      label: `Block ${scope.blockNumber} · Mini-Block ${scope.miniBlockNumber}`,
      sourceRefs: stable([
        revisionRef,
        block.id,
        mini.id,
        `ppf:structure:block:${scope.blockNumber}`,
        `ppf:structure:block:${scope.blockNumber}:mini:${scope.miniBlockNumber}`,
        `storyboard-anchor:block:${block.id}:mini-${scope.miniBlockNumber}`,
      ]),
    };
  }

  if (scope.kind === "block") {
    const block = project.structure.blocks.find((candidate) => candidate.number === scope.blockNumber);
    if (!block) throw new Error(`Agentic projection Block ${scope.blockNumber} was not found.`);
    return {
      label: `Block ${scope.blockNumber}`,
      sourceRefs: stable([
        revisionRef,
        block.id,
        `ppf:structure:block:${scope.blockNumber}`,
        ...block.miniBlocks.flatMap((mini) => [
          mini.id,
          `ppf:structure:block:${scope.blockNumber}:mini:${mini.ordinal}`,
          `storyboard-anchor:block:${block.id}:mini-${mini.ordinal}`,
        ]),
      ]),
    };
  }

  const blocks = project.structure.blocks.filter((block) => block.sequenceNumber === scope.sequenceNumber);
  if (!blocks.length) throw new Error(`Agentic projection Sequence ${scope.sequenceNumber} was not found.`);
  return {
    label: `Sequence ${scope.sequenceNumber}`,
    sourceRefs: stable([
      revisionRef,
      `sequence-${String(scope.sequenceNumber).padStart(2, "0")}`,
      ...blocks.flatMap((block) => [
        block.id,
        `ppf:structure:block:${block.number}`,
        ...block.miniBlocks.flatMap((mini) => [
          mini.id,
          `ppf:structure:block:${block.number}:mini:${mini.ordinal}`,
          `storyboard-anchor:block:${block.id}:mini-${mini.ordinal}`,
        ]),
      ]),
    ]),
  };
}

/**
 * Creates the bounded, proposal-only Responsibility Run graph for the Human's
 * one-click "Visualize this story scope" request.
 *
 * It intentionally performs no provider call, no persistence and no approval.
 * The existing Responsibility Run host executes each child within Story Mode,
 * consent and spend policy; every produced artifact remains canonical:false
 * until the separate Human approval / Creative Transaction boundary admits it.
 */
export function createAgenticStoryToScreenProjectionRequest(input: {
  readonly project: LibraryPPFProject;
  readonly scope: AgenticStoryToScreenScope;
  readonly requestedStages?: readonly AgenticStoryToScreenStageId[];
  readonly createdAt?: string;
}): AgenticStoryToScreenProjectionRequest {
  const resolved = resolveScope(input.project, input.scope);
  const requested = input.requestedStages?.length
    ? stable(input.requestedStages.filter((stage): stage is AgenticStoryToScreenStageId => (
      AGENTIC_STORY_TO_SCREEN_STAGES.includes(stage)
    ))) as AgenticStoryToScreenStageId[]
    : [...AGENTIC_STORY_TO_SCREEN_STAGES];
  const orderedStages = AGENTIC_STORY_TO_SCREEN_STAGES.filter((stage) => requested.includes(stage));
  if (!orderedStages.length) throw new Error("Agentic story-to-screen projection requires at least one stage.");

  const parentEnvelope = createPreproductionAssistanceRun({
    role: "creative-coordination",
    goal: `Coordinate a bounded story-to-screen candidate projection for ${resolved.label}. Keep the written story canonical and require Human approval between proposal and acceptance.`,
    taskId: `story-to-screen:${input.project.id}:${input.project.revision}:${input.scope.kind}`,
    sourceIds: resolved.sourceRefs,
    createdAt: input.createdAt,
    maxParallelChildren: orderedStages.length,
  });

  const stages = orderedStages.map((id, index): AgenticStoryToScreenStage => {
    const config = STAGE_CONFIG[id];
    const envelope = createPreproductionAssistanceRun({
      role: config.role,
      goal: `${config.goal} Scope: ${resolved.label}. Stage ${index + 1} of ${orderedStages.length}.`,
      taskId: `story-to-screen:${input.project.id}:${input.project.revision}:${id}`,
      sourceIds: resolved.sourceRefs,
      createdAt: input.createdAt,
    });
    return {
      id,
      label: config.label,
      role: config.role,
      run: { ...envelope.run, parentRunId: parentEnvelope.run.runId },
      candidateOnly: true,
      canonical: false,
      approvalRequired: true,
    };
  });

  const parentRun = stages.reduce(
    (run, stage) => attachResponsibilityChild(run, stage.run.runId, input.createdAt),
    parentEnvelope.run,
  );

  return {
    version: 1,
    projectId: input.project.id,
    canonicalRevision: input.project.revision,
    scope: input.scope,
    sourceRefs: resolved.sourceRefs,
    parentRun,
    stages,
    authority: {
      canonicalStoryOwner: "ppf-human",
      proposalOwner: "responsibility-runs",
      revisionOwner: "creative-transaction-contract",
      routingOwner: "story-mode-capability-resolution",
      acceptanceOwner: "writer-approval",
    },
    policy: {
      cloudSpendAuthorized: false,
      autoPromoteCandidates: false,
      stopBetweenStagesAllowed: true,
      manualWorkflowStillSupported: true,
    },
  };
}
