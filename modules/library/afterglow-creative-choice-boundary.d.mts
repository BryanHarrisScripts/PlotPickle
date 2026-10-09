import type {AfterglowConsolidationConflict} from "./afterglow-consolidation.mjs";
export type AfterglowCreativeChoice=AfterglowConsolidationConflict & Readonly<{creativeKind:"narration"|"answer"}>;
export function afterglowChoiceKind(conflict: AfterglowConsolidationConflict): "narration"|"answer"|"verification";
export function partitionAfterglowChoices(
  conflicts: readonly AfterglowConsolidationConflict[], recoveredPaths?: readonly string[],
): Readonly<{
  human: AfterglowCreativeChoice[];
  verification: AfterglowConsolidationConflict[];
  inRecovered: AfterglowConsolidationConflict[];
}>;
