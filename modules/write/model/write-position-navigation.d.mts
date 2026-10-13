export type WriteStoryAddress = Readonly<{ blockNumber: number; miniBlockNumber: number }>;
export function moveWriteStoryPosition(input: Readonly<{
  locationHref: string;
  history: Pick<History, "replaceState" | "state">;
  blockNumber: number;
  miniBlockNumber: number;
  dirty: boolean;
  confirmDiscard: () => boolean;
}>): WriteStoryAddress | null;
