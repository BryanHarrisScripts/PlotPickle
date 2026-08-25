import type { MemoryRetrievalResult } from "./memory-retrieval";
import type { MemoryService, MemorySessionProof } from "./memory-service";
import * as core from "./agent-memory-continuity-core.mjs";

export type SageMemoryCommand =
  | Readonly<{ action: "remember"; scope: "human" | "project"; content: string }>
  | Readonly<{ action: "forget"; mode: "latest" | "matching"; query: string }>;

export const parseSageMemoryCommand = core.parseSageMemoryCommand as (value: string) => SageMemoryCommand | null;

export const retrieveSageContinuity = core.retrieveSageContinuity as (
  memoryService: Pick<MemoryService, "listMemories">,
  proof: MemorySessionProof,
  input: Readonly<{ projectId: string; text: string }>,
) => Promise<MemoryRetrievalResult>;

export const retrieveAveryContinuity = core.retrieveAveryContinuity as (
  memoryService: Pick<MemoryService, "listMemories">,
  proof: MemorySessionProof,
  input: Readonly<{ projectId: string; text: string }>,
) => Promise<MemoryRetrievalResult>;
