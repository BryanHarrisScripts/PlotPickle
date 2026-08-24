import type {
  MemoryAuthority,
  MemoryScope,
  MemoryService,
  MemorySessionProof,
  MemorySource,
} from "./memory-service";
import * as core from "./memory-retrieval-core.mjs";

export type MemoryRetrievalQuery = Readonly<{
  text: string;
  projectId?: string | null;
  agentId?: string | null;
  scopes?: readonly MemoryScope[];
  maxResults?: number;
  maxCharacters?: number;
}>;

export type MemoryRetrievalItem = Readonly<{
  id: string;
  scope: MemoryScope;
  projectId: string | null;
  agentId: string | null;
  source: MemorySource;
  authority: MemoryAuthority;
  tags: readonly string[];
  updatedAt: string;
  excerpt: string;
  clipped: boolean;
  score: number;
  matchedTerms: readonly string[];
  matchedTags: readonly string[];
}>;

export type MemoryRetrievalResult = Readonly<{
  query: string;
  scopes: readonly MemoryScope[];
  maxResults: number;
  maxCharacters: number;
  usedCharacters: number;
  approximateTokens: number;
  matchedCount: number;
  droppedCount: number;
  items: readonly MemoryRetrievalItem[];
}>;

export const retrieveRelevantMemories = core.retrieveRelevantMemories as (
  memoryService: Pick<MemoryService, "listMemories">,
  proof: MemorySessionProof,
  query: MemoryRetrievalQuery,
) => Promise<MemoryRetrievalResult>;
