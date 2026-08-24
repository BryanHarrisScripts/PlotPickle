import type { MemoryService, MemorySessionProof } from "../../../core/memory/memory-service";
import {
  retrieveRelevantMemories,
  type MemoryRetrievalQuery,
  type MemoryRetrievalResult,
} from "../../../core/memory/memory-retrieval";
import { CONTEXT_AUTHORITY, type ContextItemInput } from "./context-engine";

export type MemoryContextResult = Readonly<{
  items: readonly ContextItemInput[];
  retrieval: MemoryRetrievalResult;
}>;

export async function retrieveMemoryContextItems(input: Readonly<{
  memoryService: Pick<MemoryService, "listMemories">;
  proof: MemorySessionProof;
  query: MemoryRetrievalQuery;
}>): Promise<MemoryContextResult> {
  const retrieval = await retrieveRelevantMemories(input.memoryService, input.proof, input.query);
  const items = retrieval.items.map((memory): ContextItemInput => ({
    id: `memory-context:${memory.id}`,
    sourceType: "project-memory",
    sourceId: memory.id,
    content: memory.excerpt,
    trust: "approved",
    authority: CONTEXT_AUTHORITY.approvedProjectMemory,
    allowedUse: "evidence",
    createdAt: memory.updatedAt,
    observedAt: memory.updatedAt,
  }));
  return Object.freeze({ items: Object.freeze(items), retrieval });
}
