export const STORY_KNOWLEDGE_GRAPH_VERSION = 1 as const;

export const STORY_KNOWLEDGE_ENTITY_TYPES = [
  "CHARACTER",
  "LOCATION",
  "EVENT",
  "SCENE",
  "ARTIFACT",
  "ORGANIZATION",
] as const;

export type StoryKnowledgeEntityType = (typeof STORY_KNOWLEDGE_ENTITY_TYPES)[number];
export type StoryKnowledgeModelRoute = "deterministic" | "fast" | "quality";

export const STORY_KNOWLEDGE_MODEL_ROUTING = {
  extraction: { route: "fast", maxLocalConcurrency: 1 },
  resolution: { route: "quality", maxLocalConcurrency: 1 },
  synthesis: { route: "quality", maxLocalConcurrency: 1 },
} as const;

export type StoryKnowledgeExtractorIdentity = {
  readonly id: string;
  readonly version: string;
  readonly route: StoryKnowledgeModelRoute;
};

export type StoryKnowledgeProvenance = {
  readonly sourceId: string;
  readonly revision: string;
  readonly evidenceId: string;
  readonly evidenceLocation?: string;
  readonly excerpt?: string;
  readonly extractor: StoryKnowledgeExtractorIdentity;
};

export type StoryKnowledgeExtractedEntity = {
  readonly name: string;
  readonly type: StoryKnowledgeEntityType;
  readonly description: string;
  readonly provenance: StoryKnowledgeProvenance;
};

export type StoryKnowledgeExtractedRelation = {
  readonly source: string;
  readonly sourceType?: StoryKnowledgeEntityType;
  readonly predicate: string;
  readonly target: string;
  readonly targetType?: StoryKnowledgeEntityType;
  readonly provenance: StoryKnowledgeProvenance;
};

export type StoryKnowledgeExtractionBatch = {
  readonly sourceId: string;
  readonly revision: string;
  readonly entities: readonly StoryKnowledgeExtractedEntity[];
  readonly relations: readonly StoryKnowledgeExtractedRelation[];
};

export type StoryKnowledgeExtractor = {
  readonly id: string;
  readonly version: string;
  readonly route: StoryKnowledgeModelRoute;
  readonly extract: (input: {
    readonly sourceId: string;
    readonly revision: string;
    readonly text: string;
  }) => Promise<StoryKnowledgeExtractionBatch>;
};

export type StoryKnowledgeResolutionCluster = {
  readonly canonical: string;
  readonly aliases: readonly string[];
};

export type StoryKnowledgeNode = {
  readonly id: string;
  readonly type: StoryKnowledgeEntityType;
  readonly canonicalName: string;
  readonly aliases: readonly string[];
  readonly description: string;
  readonly provenance: readonly StoryKnowledgeProvenance[];
};

export type StoryKnowledgeEdge = {
  readonly id: string;
  readonly sourceId: string;
  readonly targetId: string;
  readonly predicate: string;
  readonly provenance: StoryKnowledgeProvenance;
};

export type StoryKnowledgeDroppedRelations = {
  readonly unresolvedSource: number;
  readonly unresolvedTarget: number;
  readonly selfLoop: number;
};

export type StoryKnowledgeGraphHealth = {
  readonly sourceEntityCount: number;
  readonly sourceRelationCount: number;
  readonly nodeCount: number;
  readonly edgeCount: number;
  readonly orphanCount: number;
  readonly resolverMergeCount: number;
  readonly droppedRelations: StoryKnowledgeDroppedRelations;
  readonly connectedComponents: number;
};

export type StoryKnowledgeGraph = {
  readonly version: typeof STORY_KNOWLEDGE_GRAPH_VERSION;
  readonly derived: true;
  readonly readOnly: true;
  readonly projectId: string;
  readonly sourceRevision: string;
  readonly generatedAt: string;
  readonly extractorVersion: string;
  readonly nodes: readonly StoryKnowledgeNode[];
  readonly edges: readonly StoryKnowledgeEdge[];
  readonly health: StoryKnowledgeGraphHealth;
};

export type StoryKnowledgeGraphBuildInput = {
  readonly projectId: string;
  readonly sourceRevision: string;
  readonly extractorVersion: string;
  readonly generatedAt?: string;
  readonly batches: readonly StoryKnowledgeExtractionBatch[];
  readonly resolution?: Partial<Record<StoryKnowledgeEntityType, readonly StoryKnowledgeResolutionCluster[]>>;
};

export type StoryKnowledgeEvidenceSlice = {
  readonly node: StoryKnowledgeNode;
  readonly edges: readonly StoryKnowledgeEdge[];
  readonly neighboringNodes: readonly StoryKnowledgeNode[];
};

function clean(value: string) {
  const textValue = String(value || "");
  const withoutNulls = textValue.replace(/\u0000/g, "");
  const normalizedSpacing = withoutNulls.replace(/\s+/g, " ");
  return normalizedSpacing.trim();
}

export function normalizeStoryKnowledgeName(value: string) {
  return clean(value).toLocaleLowerCase().replace(/[’']/g, "'");
}

export function normalizeStoryKnowledgePredicate(value: string) {
  return clean(value).toLocaleLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ");
}

function slug(value: string) {
  const normalized = normalizeStoryKnowledgeName(value)
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return normalized || "unnamed";
}

function uniqueStrings(values: readonly string[]) {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values.map(clean).filter(Boolean)) {
    const key = normalizeStoryKnowledgeName(value);
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function uniqueProvenance(values: readonly StoryKnowledgeProvenance[]) {
  const seen = new Set<string>();
  const result: StoryKnowledgeProvenance[] = [];
  for (const value of values) {
    const key = `${value.sourceId}\u0000${value.revision}\u0000${value.evidenceId}\u0000${value.extractor.id}\u0000${value.extractor.version}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(value);
  }
  return result;
}

function nodeId(type: StoryKnowledgeEntityType, canonicalName: string) {
  return `${type.toLowerCase()}:${slug(canonicalName)}`;
}

function graphEdgeId(sourceId: string, predicate: string, targetId: string, provenance: StoryKnowledgeProvenance) {
  return `${sourceId}->${slug(predicate)}->${targetId}@${slug(provenance.sourceId)}:${slug(provenance.evidenceId)}`;
}

function connectedComponents(nodes: readonly StoryKnowledgeNode[], edges: readonly StoryKnowledgeEdge[]) {
  const adjacency = new Map(nodes.map((node) => [node.id, new Set<string>()]));
  for (const edge of edges) {
    adjacency.get(edge.sourceId)?.add(edge.targetId);
    adjacency.get(edge.targetId)?.add(edge.sourceId);
  }
  const visited = new Set<string>();
  let count = 0;
  for (const node of nodes) {
    if (visited.has(node.id)) continue;
    count += 1;
    const queue = [node.id];
    visited.add(node.id);
    while (queue.length) {
      const current = queue.shift()!;
      for (const next of adjacency.get(current) || []) {
        if (visited.has(next)) continue;
        visited.add(next);
        queue.push(next);
      }
    }
  }
  return count;
}

function endpointKey(name: string, type?: StoryKnowledgeEntityType) {
  return type ? `${type}:${normalizeStoryKnowledgeName(name)}` : normalizeStoryKnowledgeName(name);
}

export function buildStoryKnowledgeGraph(input: StoryKnowledgeGraphBuildInput): StoryKnowledgeGraph {
  const projectId = clean(input.projectId);
  const sourceRevision = clean(input.sourceRevision);
  if (!projectId) throw new Error("Story Knowledge Graph projectId is required.");
  if (!sourceRevision) throw new Error("Story Knowledge Graph sourceRevision is required.");

  const extractedEntities = input.batches.flatMap((batch) => batch.entities);
  const extractedRelations = input.batches.flatMap((batch) => batch.relations);
  const entitiesByType = new Map<StoryKnowledgeEntityType, StoryKnowledgeExtractedEntity[]>();
  for (const entity of extractedEntities) {
    if (!STORY_KNOWLEDGE_ENTITY_TYPES.includes(entity.type)) continue;
    if (!clean(entity.name)) continue;
    const list = entitiesByType.get(entity.type) || [];
    list.push(entity);
    entitiesByType.set(entity.type, list);
  }

  const nodes: StoryKnowledgeNode[] = [];
  const typedAliasToNode = new Map<string, string>();
  const untypedAliasToNodes = new Map<string, Set<string>>();
  let orphanCount = 0;
  let resolverMergeCount = 0;

  for (const type of STORY_KNOWLEDGE_ENTITY_TYPES) {
    const entities = entitiesByType.get(type) || [];
    if (!entities.length) continue;
    const rawNames = new Map<string, string>();
    for (const entity of entities) rawNames.set(normalizeStoryKnowledgeName(entity.name), clean(entity.name));

    const suppliedClusters = input.resolution?.[type];
    const clusters: Array<{ canonical: string; aliases: string[]; orphan: boolean }> = [];
    const covered = new Set<string>();

    if (suppliedClusters) {
      for (const supplied of suppliedClusters) {
        const canonical = clean(supplied.canonical);
        if (!canonical) continue;
        const aliases = uniqueStrings([canonical, ...supplied.aliases]);
        const presentAliases = aliases.filter((alias) => rawNames.has(normalizeStoryKnowledgeName(alias)));
        if (!presentAliases.length) continue;
        for (const alias of presentAliases) covered.add(normalizeStoryKnowledgeName(alias));
        clusters.push({ canonical, aliases: presentAliases, orphan: false });
        if (presentAliases.length > 1) resolverMergeCount += 1;
      }
      for (const [key, original] of rawNames) {
        if (covered.has(key)) continue;
        orphanCount += 1;
        clusters.push({ canonical: original, aliases: [original], orphan: true });
      }
    } else {
      for (const original of rawNames.values()) clusters.push({ canonical: original, aliases: [original], orphan: false });
    }

    for (const cluster of clusters) {
      const id = nodeId(type, cluster.canonical);
      const aliasKeys = new Set(cluster.aliases.map(normalizeStoryKnowledgeName));
      const members = entities.filter((entity) => aliasKeys.has(normalizeStoryKnowledgeName(entity.name)));
      const description = members
        .map((entity) => clean(entity.description))
        .filter(Boolean)
        .sort((left, right) => right.length - left.length)[0] || "";
      const provenance = uniqueProvenance(members.map((entity) => entity.provenance));
      const existing = nodes.find((node) => node.id === id);
      if (existing) {
        const replacement: StoryKnowledgeNode = {
          ...existing,
          aliases: uniqueStrings([...existing.aliases, ...cluster.aliases]),
          description: existing.description.length >= description.length ? existing.description : description,
          provenance: uniqueProvenance([...existing.provenance, ...provenance]),
        };
        nodes[nodes.indexOf(existing)] = replacement;
      } else {
        nodes.push({ id, type, canonicalName: cluster.canonical, aliases: uniqueStrings(cluster.aliases), description, provenance });
      }
      for (const alias of cluster.aliases) {
        const normalized = normalizeStoryKnowledgeName(alias);
        typedAliasToNode.set(endpointKey(alias, type), id);
        const set = untypedAliasToNodes.get(normalized) || new Set<string>();
        set.add(id);
        untypedAliasToNodes.set(normalized, set);
      }
    }
  }

  const resolveEndpoint = (name: string, type?: StoryKnowledgeEntityType) => {
    if (type) return typedAliasToNode.get(endpointKey(name, type)) || null;
    const candidates = [...(untypedAliasToNodes.get(normalizeStoryKnowledgeName(name)) || [])];
    return candidates.length === 1 ? candidates[0] : null;
  };

  const dropped = { unresolvedSource: 0, unresolvedTarget: 0, selfLoop: 0 };
  const edges: StoryKnowledgeEdge[] = [];
  const edgeIds = new Set<string>();
  for (const relation of extractedRelations) {
    const sourceId = resolveEndpoint(relation.source, relation.sourceType);
    if (!sourceId) {
      dropped.unresolvedSource += 1;
      continue;
    }
    const targetId = resolveEndpoint(relation.target, relation.targetType);
    if (!targetId) {
      dropped.unresolvedTarget += 1;
      continue;
    }
    if (sourceId === targetId) {
      dropped.selfLoop += 1;
      continue;
    }
    const predicate = clean(relation.predicate);
    if (!predicate) continue;
    const id = graphEdgeId(sourceId, predicate, targetId, relation.provenance);
    if (edgeIds.has(id)) continue;
    edgeIds.add(id);
    edges.push({ id, sourceId, targetId, predicate, provenance: relation.provenance });
  }

  const sortedNodes = [...nodes].sort((left, right) => left.id.localeCompare(right.id));
  const sortedEdges = [...edges].sort((left, right) => left.id.localeCompare(right.id));
  return {
    version: STORY_KNOWLEDGE_GRAPH_VERSION,
    derived: true,
    readOnly: true,
    projectId,
    sourceRevision,
    generatedAt: input.generatedAt || new Date().toISOString(),
    extractorVersion: clean(input.extractorVersion),
    nodes: sortedNodes,
    edges: sortedEdges,
    health: {
      sourceEntityCount: extractedEntities.length,
      sourceRelationCount: extractedRelations.length,
      nodeCount: sortedNodes.length,
      edgeCount: sortedEdges.length,
      orphanCount,
      resolverMergeCount,
      droppedRelations: dropped,
      connectedComponents: connectedComponents(sortedNodes, sortedEdges),
    },
  };
}

export function storyKnowledgeGraphIsStale(graph: StoryKnowledgeGraph, currentRevision: string) {
  return clean(graph.sourceRevision) !== clean(currentRevision);
}

export function storyKnowledgeEvidenceForEntity(
  graph: StoryKnowledgeGraph,
  query: string,
  maxEdges = 12,
): readonly StoryKnowledgeEvidenceSlice[] {
  const normalized = normalizeStoryKnowledgeName(query);
  if (!normalized) return [];
  const matches = graph.nodes.filter((node) =>
    [node.canonicalName, ...node.aliases].some((name) => normalizeStoryKnowledgeName(name).includes(normalized)),
  );
  return matches.map((node) => {
    const edges = graph.edges.filter((edge) => edge.sourceId === node.id || edge.targetId === node.id).slice(0, Math.max(1, Math.min(24, maxEdges)));
    const neighborIds = new Set(edges.map((edge) => edge.sourceId === node.id ? edge.targetId : edge.sourceId));
    return {
      node,
      edges,
      neighboringNodes: graph.nodes.filter((candidate) => neighborIds.has(candidate.id)),
    };
  });
}

function relationSemanticKey(graph: StoryKnowledgeGraph, edge: StoryKnowledgeEdge) {
  const source = graph.nodes.find((node) => node.id === edge.sourceId);
  const target = graph.nodes.find((node) => node.id === edge.targetId);
  return `${source?.type || "UNKNOWN"}:${normalizeStoryKnowledgeName(source?.canonicalName || edge.sourceId)}|${normalizeStoryKnowledgePredicate(edge.predicate)}|${target?.type || "UNKNOWN"}:${normalizeStoryKnowledgeName(target?.canonicalName || edge.targetId)}`;
}

export function diffStoryKnowledgeGraphs(previous: StoryKnowledgeGraph, next: StoryKnowledgeGraph) {
  const previousEntities = new Map(previous.nodes.map((node) => [`${node.type}:${normalizeStoryKnowledgeName(node.canonicalName)}`, node]));
  const nextEntities = new Map(next.nodes.map((node) => [`${node.type}:${normalizeStoryKnowledgeName(node.canonicalName)}`, node]));
  const previousRelations = new Map(previous.edges.map((edge) => [relationSemanticKey(previous, edge), edge]));
  const nextRelations = new Map(next.edges.map((edge) => [relationSemanticKey(next, edge), edge]));
  return {
    fromRevision: previous.sourceRevision,
    toRevision: next.sourceRevision,
    addedEntities: [...nextEntities.entries()].filter(([key]) => !previousEntities.has(key)).map(([, value]) => value),
    removedEntities: [...previousEntities.entries()].filter(([key]) => !nextEntities.has(key)).map(([, value]) => value),
    addedRelations: [...nextRelations.entries()].filter(([key]) => !previousRelations.has(key)).map(([, value]) => value),
    removedRelations: [...previousRelations.entries()].filter(([key]) => !nextRelations.has(key)).map(([, value]) => value),
  } as const;
}
