import type { StoryboardEditorialShot } from "../../core/contracts/storyboard/editorial-shot";
import type { StoryNode, StoryEdge, StoryDependencySnapshot } from "../projects/story/story-dependencies";
import type {
  BeatSemanticProjection,
  CanonicalPreproductionProject,
  FrameSemanticProjection,
  PreproductionSemanticProjection,
  ProductionInstructionProjection,
} from "./semantic-projection";

export type PreproductionDependencyInput = {
  readonly project: CanonicalPreproductionProject;
  readonly semantics: PreproductionSemanticProjection;
  readonly beats?: readonly BeatSemanticProjection[];
  readonly editorialShots?: readonly StoryboardEditorialShot[];
  readonly frames?: readonly FrameSemanticProjection[];
  readonly productionInstruction?: ProductionInstructionProjection | null;
  readonly generatedAt?: string;
};

type AnchorAddress = {
  readonly blockId: string;
  readonly miniBlockId: string;
};

function addNode(nodes: StoryNode[], node: StoryNode) {
  if (!node.id || nodes.some((candidate) => candidate.id === node.id)) return;
  nodes.push(node);
}

function addEdge(
  edges: StoryEdge[],
  from: string,
  to: string,
  type: string,
  source: StoryEdge["source"] = "explicit",
  metadata?: Record<string, unknown>,
) {
  if (!from || !to) return;
  if (edges.some((edge) => edge.from === from && edge.to === to && edge.type === type)) return;
  edges.push({ id: `${from}::${type}::${to}`, from, to, type, source, ...(metadata ? { metadata } : {}) });
}

function sequenceId(sequenceNumber: number) {
  return `sequence-${String(sequenceNumber).padStart(2, "0")}`;
}

function actId(projectId: string, actNumber: number) {
  return `${projectId}:act:${actNumber}`;
}

function anchorAddress(project: CanonicalPreproductionProject, anchorRef: string): AnchorAddress | null {
  const match = /^storyboard-anchor:block:(block-\d{2}):mini-([1-4])$/.exec(anchorRef);
  if (!match) return null;
  const block = project.structure.blocks.find((candidate) => candidate.id === match[1]);
  const ordinal = Number(match[2]);
  const mini = block?.miniBlocks.find((candidate) => candidate.ordinal === ordinal);
  return block && mini ? { blockId: block.id, miniBlockId: mini.id } : null;
}

function indexEdges(edges: readonly StoryEdge[]) {
  const references: Record<string, string[]> = {};
  const reverseIndex: Record<string, string[]> = {};
  for (const edge of edges) {
    (references[edge.from] ??= []).push(edge.to);
    (reverseIndex[edge.to] ??= []).push(edge.from);
  }
  const sort = (record: Record<string, string[]>) => Object.fromEntries(
    Object.entries(record)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, values]) => [key, [...new Set(values)].sort()]),
  );
  return { references: sort(references), reverseIndex: sort(reverseIndex) };
}

function addAnchorDependent(
  input: PreproductionDependencyInput,
  nodes: StoryNode[],
  edges: StoryEdge[],
  anchorRef: string,
  node: StoryNode,
  edgeType: string,
) {
  addNode(nodes, node);
  const address = anchorAddress(input.project, anchorRef);
  if (address) addEdge(edges, address.miniBlockId, node.id, edgeType, "explicit", { anchorRef });
}

/**
 * Emits the existing StoryDependencySnapshot graph format for current PPF
 * pre-production semantics. This is a projection only; it owns no creative state.
 */
export function buildPreproductionDependencySnapshot(input: PreproductionDependencyInput): StoryDependencySnapshot {
  const { project, semantics } = input;
  const nodes: StoryNode[] = [];
  const edges: StoryEdge[] = [];
  const storyId = semantics.story.id;

  addNode(nodes, {
    id: project.id,
    kind: "project",
    label: project.title,
    module: "project",
    path: "project",
  });
  addNode(nodes, {
    id: storyId,
    kind: "story",
    label: semantics.story.logline || semantics.story.title,
    module: "preproduction",
    path: "projection.story",
    metadata: { canonicalRevision: project.revision },
  });
  addEdge(edges, project.id, storyId, "defines");

  const seenActs = new Set<number>();
  const seenSequences = new Set<number>();
  for (const block of project.structure.blocks) {
    if (!seenActs.has(block.actNumber)) {
      const id = actId(project.id, block.actNumber);
      addNode(nodes, {
        id,
        kind: "act",
        label: `Act ${block.actNumber}`,
        module: "preproduction",
        path: `structure.act.${block.actNumber}`,
        metadata: { actNumber: block.actNumber },
      });
      addEdge(edges, storyId, id, "structured-as");
      seenActs.add(block.actNumber);
    }

    const seqId = sequenceId(block.sequenceNumber);
    if (!seenSequences.has(block.sequenceNumber)) {
      addNode(nodes, {
        id: seqId,
        kind: "sequence",
        label: `Sequence ${block.sequenceNumber}`,
        module: "preproduction",
        path: `structure.sequence.${block.sequenceNumber}`,
        metadata: { sequenceNumber: block.sequenceNumber, actNumber: block.actNumber },
      });
      addEdge(edges, actId(project.id, block.actNumber), seqId, "contains");
      seenSequences.add(block.sequenceNumber);
    }

    addNode(nodes, {
      id: block.id,
      kind: "block",
      label: block.title,
      module: "preproduction",
      path: `structure.block.${block.number}`,
      metadata: { number: block.number, actNumber: block.actNumber, sequenceNumber: block.sequenceNumber },
    });
    addEdge(edges, seqId, block.id, "contains");

    const planningLockId = `planning-lock:${block.id}`;
    addNode(nodes, {
      id: planningLockId,
      kind: "provenance",
      label: `Planning lock for ${block.title}`,
      module: "story-planning",
      path: `structure.block.${block.number}.planningLock`,
      metadata: { blockId: block.id, planningLockedAt: block.planningLockedAt },
    });
    addEdge(edges, block.id, planningLockId, "governs-planning-lock");

    for (const mini of block.miniBlocks) {
      addNode(nodes, {
        id: mini.id,
        kind: "mini-block",
        label: mini.title,
        module: "preproduction",
        path: `structure.block.${block.number}.mini.${mini.ordinal}`,
        metadata: { number: mini.number, ordinal: mini.ordinal, blockNumber: block.number },
      });
      addEdge(edges, block.id, mini.id, "contains");
    }
  }

  for (const scene of semantics.scenes) {
    addNode(nodes, {
      id: scene.id,
      kind: "scene",
      label: scene.title,
      module: "preproduction",
      path: scene.sourceRef,
      metadata: { blockId: scene.blockId, blockNumber: scene.blockNumber },
    });
    for (const miniBlockId of scene.relatedMiniBlockIds) addEdge(edges, miniBlockId, scene.id, "developed-as");
    for (const asset of scene.assetRefs) {
      addNode(nodes, {
        id: asset.id,
        kind: asset.kind,
        label: asset.id,
        module: "preproduction",
        path: `projection.asset.${asset.kind}.${asset.id}`,
      });
      addEdge(edges, asset.id, scene.id, asset.kind === "character" ? "appears-in" : "used-in");
    }
  }

  for (const beat of input.beats ?? []) {
    addAnchorDependent(input, nodes, edges, beat.anchorRef, {
      id: beat.id,
      kind: "production-cue",
      label: beat.label || beat.id,
      module: "sequence-director",
      path: `projection.beat.${beat.id}`,
      metadata: {
        semanticKind: "beat",
        order: beat.order,
        startSecond: beat.startSecond,
        endSecond: beat.endSecond,
      },
    }, "contains-beat");
  }

  for (const shot of input.editorialShots ?? []) {
    addAnchorDependent(input, nodes, edges, shot.anchorRef, {
      id: shot.shotId,
      kind: "storyboard-frame",
      label: shot.narrativePurpose || shot.shotId,
      module: "storyboard",
      path: `projection.storyboardShot.${shot.shotId}`,
      metadata: {
        semanticKind: "storyboard-shot",
        order: shot.order,
        shotSize: shot.shotSize,
        cameraAngle: shot.cameraAngle,
      },
    }, "visualized-by-shot");

    for (const directive of shot.informationDirectives) {
      addNode(nodes, {
        id: directive.sourceRef,
        kind: "provenance",
        label: directive.statement,
        module: "story-canon",
        path: `projection.informationSource.${directive.sourceRef}`,
        metadata: { sourceFingerprint: directive.sourceFingerprint },
      });
      addEdge(edges, directive.sourceRef, shot.shotId, "constrains-disclosure", "explicit", {
        directiveId: directive.id,
        mode: directive.mode,
      });
    }
  }

  for (const frame of input.frames ?? []) {
    addAnchorDependent(input, nodes, edges, frame.anchorRef, {
      id: frame.frameId,
      kind: "storyboard-frame",
      label: frame.narrativePurpose || frame.frameId,
      module: "storyboard",
      path: `projection.frame.${frame.frameId}`,
      metadata: {
        semanticKind: "frame",
        storyboardArtifactId: frame.storyboardArtifactId,
        storyboardDependencyKey: frame.storyboardDependencyKey,
      },
    }, "visualized-by-frame");
  }

  const frameByArtifact = new Map((input.frames ?? [])
    .filter((frame) => frame.storyboardArtifactId)
    .map((frame) => [frame.storyboardArtifactId, frame] as const));

  for (const shot of project.production.shots) {
    addAnchorDependent(input, nodes, edges, shot.anchorRef, {
      id: shot.id,
      kind: "production-shot",
      label: shot.visualIntent || shot.id,
      module: "previs",
      path: `production.shots.${shot.id}`,
      metadata: {
        order: shot.order,
        durationSeconds: shot.durationSeconds,
        reviewState: shot.reviewState,
        storyboardArtifactId: shot.storyboardArtifactId,
        storyboardDependencyKey: shot.storyboardDependencyKey,
      },
    }, "executed-as-shot");
    const frame = frameByArtifact.get(shot.storyboardArtifactId);
    if (frame) addEdge(edges, frame.frameId, shot.id, "carried-into-previs");
  }

  const instruction = input.productionInstruction;
  if (instruction) {
    const instructionId = `production-instruction:${instruction.projectId}:revision-${instruction.canonicalRevision}`;
    addNode(nodes, {
      id: instructionId,
      kind: "production-cue",
      label: "Provider-neutral production instruction",
      module: "preproduction",
      path: `projection.productionInstruction.revision.${instruction.canonicalRevision}`,
      metadata: { semanticKind: "production-instruction", providerNeutral: instruction.providerNeutral },
    });
    for (const frameId of instruction.storyboardFrameRefs) addEdge(edges, frameId, instructionId, "assembled-into");
    for (const shotId of instruction.productionShotRefs) addEdge(edges, shotId, instructionId, "assembled-into");
  }

  nodes.sort((left, right) => left.id.localeCompare(right.id));
  edges.sort((left, right) => left.id.localeCompare(right.id));
  const { references, reverseIndex } = indexEdges(edges);

  return {
    version: "2.0.0",
    generatedAt: input.generatedAt ?? "",
    projectId: project.id,
    graph: { nodes, edges },
    references,
    reverseIndex,
    conflicts: [],
    health: {
      score: 100,
      warnings: 0,
      critical: 0,
      checks: [],
    },
  };
}

function traverse(index: Readonly<Record<string, readonly string[]>>, startIds: readonly string[]) {
  const roots = new Set(startIds.filter(Boolean));
  const visited = new Set<string>(roots);
  const queue = [...roots];
  const result: string[] = [];
  while (queue.length) {
    const current = queue.shift()!;
    for (const next of index[current] ?? []) {
      if (visited.has(next)) continue;
      visited.add(next);
      result.push(next);
      queue.push(next);
    }
  }
  return result;
}

/** All downstream semantic elements affected by one or more changed upstream IDs. */
export function downstreamImpactIds(snapshot: StoryDependencySnapshot, changedIds: readonly string[]) {
  return traverse(snapshot.references, changedIds);
}

/** Stable upstream trace used to explain why a downstream element exists or is stale. */
export function upstreamTraceIds(snapshot: StoryDependencySnapshot, targetId: string) {
  return traverse(snapshot.reverseIndex, [targetId]);
}


/** Shortest deterministic dependency paths from changed roots to downstream refs. */
export function downstreamImpactPaths(
  snapshot: StoryDependencySnapshot,
  changedIds: readonly string[],
): Readonly<Record<string, readonly string[]>> {
  const roots = [...new Set(changedIds.filter(Boolean))].sort();
  const paths = new Map<string, string[]>();
  const queue = roots.map((id) => ({ id, path: [id] }));
  const visited = new Set(roots);

  while (queue.length) {
    const current = queue.shift()!;
    for (const next of [...(snapshot.references[current.id] ?? [])].sort()) {
      if (visited.has(next)) continue;
      visited.add(next);
      const path = [...current.path, next];
      paths.set(next, path);
      queue.push({ id: next, path });
    }
  }

  return Object.fromEntries([...paths.entries()].sort(([left], [right]) => left.localeCompare(right)));
}
