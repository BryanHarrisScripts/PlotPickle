export const BLOCK_WRITING_VERSION = 1 as const;

export type BlockWritingAddress = {
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
};

export type BlockWritingEntry = BlockWritingAddress & {
  readonly id: string;
  readonly text: string;
  readonly updatedAt: string | null;
};

export type BlockWritingState = {
  readonly version: typeof BLOCK_WRITING_VERSION;
  readonly entries: readonly BlockWritingEntry[];
};

export function createEmptyBlockWritingState(): BlockWritingState {
  return { version: BLOCK_WRITING_VERSION, entries: [] };
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

function integer(value: unknown, minimum: number, maximum: number) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isInteger(number) && number >= minimum && number <= maximum ? number : 0;
}

function writingId(blockNumber: number, miniBlockNumber: number) {
  return `write:block-${String(blockNumber).padStart(2, "0")}:mini-${miniBlockNumber}`;
}

function normalizeEntry(value: unknown): BlockWritingEntry | null {
  const source = record(value);
  const blockNumber = integer(source.blockNumber, 1, 24);
  const miniBlockNumber = integer(source.miniBlockNumber, 1, 4);
  if (!blockNumber || !miniBlockNumber) return null;
  const text = typeof source.text === "string" ? source.text.slice(0, 250_000) : "";
  if (!text.trim()) return null;
  return {
    id: writingId(blockNumber, miniBlockNumber),
    blockNumber,
    miniBlockNumber,
    text,
    updatedAt: typeof source.updatedAt === "string" && source.updatedAt.trim() ? source.updatedAt : null,
  };
}

export function normalizeBlockWritingState(value: unknown): BlockWritingState {
  const source = record(value);
  const entries = Array.isArray(source.entries)
    ? source.entries
      .map(normalizeEntry)
      .filter((entry): entry is BlockWritingEntry => Boolean(entry))
      .filter((entry, index, all) => all.findLastIndex((candidate) => (
        candidate.blockNumber === entry.blockNumber && candidate.miniBlockNumber === entry.miniBlockNumber
      )) === index)
      .sort((left, right) => (
        left.blockNumber - right.blockNumber || left.miniBlockNumber - right.miniBlockNumber
      ))
    : [];
  return { version: BLOCK_WRITING_VERSION, entries };
}

export function blockWritingEntry(state: BlockWritingState, address: BlockWritingAddress) {
  return state.entries.find((entry) => (
    entry.blockNumber === address.blockNumber && entry.miniBlockNumber === address.miniBlockNumber
  )) ?? null;
}

export function updateBlockWritingEntry(
  state: BlockWritingState,
  address: BlockWritingAddress,
  text: string,
  updatedAt: string,
): BlockWritingState {
  const blockNumber = integer(address.blockNumber, 1, 24);
  const miniBlockNumber = integer(address.miniBlockNumber, 1, 4);
  if (!blockNumber || !miniBlockNumber) return normalizeBlockWritingState(state);
  const retained = state.entries.filter((entry) => !(
    entry.blockNumber === blockNumber && entry.miniBlockNumber === miniBlockNumber
  ));
  const cleanText = text.slice(0, 250_000);
  const next = cleanText.trim()
    ? [...retained, {
      id: writingId(blockNumber, miniBlockNumber),
      blockNumber,
      miniBlockNumber,
      text: cleanText,
      updatedAt,
    }]
    : retained;
  return normalizeBlockWritingState({ version: BLOCK_WRITING_VERSION, entries: next });
}
