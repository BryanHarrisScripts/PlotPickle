import {
  assembleContextPacket,
  type ContextItemInput,
  type ContextPacket,
  type ContextReceipt,
} from "./context-engine";
import {
  contextStrategyForTask as coreContextStrategyForTask,
  selectAdaptiveContextCandidates as coreSelectAdaptiveContextCandidates,
} from "./adaptive-context-strategy-core.mjs";

export const CONTEXT_STRATEGIES = [
  "general",
  "continuity",
  "scene-rewrite",
  "structure-review",
  "visual-continuity",
] as const;

export type ContextStrategyId = (typeof CONTEXT_STRATEGIES)[number];

export type AdaptiveContextReceipt = ContextReceipt & {
  readonly strategyId: ContextStrategyId;
  readonly strategyVersion: 1;
  readonly strategyCandidateCount: number;
};

export type AdaptiveContextPacket = Omit<ContextPacket, "receipt"> & {
  readonly receipt: AdaptiveContextReceipt;
};

/**
 * Selects a bounded set of optional sources before the protected Context Engine
 * applies trust, authority ceilings, allowed-use normalization and the host budget.
 * Required items and writer/PPF/schema evidence are never removed by a strategy.
 */
export function selectAdaptiveContextCandidates(input: {
  readonly strategyId: ContextStrategyId;
  readonly budgetCharacters: number;
  readonly items: readonly ContextItemInput[];
}): ContextItemInput[] {
  return coreSelectAdaptiveContextCandidates(input) as ContextItemInput[];
}

export function assembleAdaptiveContextPacket(input: {
  readonly strategyId: ContextStrategyId;
  readonly profileId: string;
  readonly taskId: string;
  readonly goal: string;
  readonly budgetCharacters: number;
  readonly expectedOutputSchema?: string;
  readonly items: readonly ContextItemInput[];
}): AdaptiveContextPacket {
  const candidates = selectAdaptiveContextCandidates(input);
  const packet = assembleContextPacket({
    profileId: input.profileId,
    taskId: input.taskId,
    goal: input.goal,
    budgetCharacters: input.budgetCharacters,
    expectedOutputSchema: input.expectedOutputSchema,
    items: candidates,
  });
  return {
    ...packet,
    receipt: {
      ...packet.receipt,
      strategyId: input.strategyId,
      strategyVersion: 1,
      strategyCandidateCount: candidates.length,
    },
  };
}

export function contextStrategyForTask(text: string): ContextStrategyId {
  return coreContextStrategyForTask(text) as ContextStrategyId;
}
