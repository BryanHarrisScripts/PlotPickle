import { CONTEXT_AUTHORITY, type ContextItemInput } from "../../agents/context/context-engine";
import {
  storyKnowledgeEvidenceForEntity,
  type StoryKnowledgeGraph,
  type StoryKnowledgeNode,
} from "./story-knowledge-graph";

function nodeSummary(node: StoryKnowledgeNode) {
  return {
    id: node.id,
    type: node.type,
    canonicalName: node.canonicalName,
    aliases: node.aliases,
    description: node.description,
  };
}

export function storyKnowledgeContextItems(input: {
  readonly graph: StoryKnowledgeGraph;
  readonly query: string;
  readonly maxItems?: number;
  readonly maxEdgesPerItem?: number;
}): readonly ContextItemInput[] {
  const maxItems = Math.max(1, Math.min(12, Math.floor(input.maxItems || 6)));
  const maxEdgesPerItem = Math.max(1, Math.min(16, Math.floor(input.maxEdgesPerItem || 8)));
  const slices = storyKnowledgeEvidenceForEntity(input.graph, input.query, maxEdgesPerItem).slice(0, maxItems);

  return slices.map((slice, index) => ({
    id: `story-knowledge:${input.graph.projectId}:${slice.node.id}:${index}`,
    sourceType: "story-knowledge-graph",
    sourceId: `story-knowledge-graph:${input.graph.projectId}`,
    trust: "unverified",
    authority: CONTEXT_AUTHORITY.storyKnowledgeGraph,
    allowedUse: "evidence",
    revision: input.graph.sourceRevision,
    observedAt: input.graph.generatedAt,
    required: false,
    content: JSON.stringify({
      derived: true,
      readOnly: true,
      absenceIsNotEvidenceOfAbsence: true,
      entity: nodeSummary(slice.node),
      relations: slice.edges.map((edge) => ({
        id: edge.id,
        sourceId: edge.sourceId,
        targetId: edge.targetId,
        predicate: edge.predicate,
        provenance: {
          sourceId: edge.provenance.sourceId,
          revision: edge.provenance.revision,
          evidenceId: edge.provenance.evidenceId,
          evidenceLocation: edge.provenance.evidenceLocation,
          extractor: edge.provenance.extractor,
        },
      })),
      neighbors: slice.neighboringNodes.map(nodeSummary),
    }),
  }));
}
