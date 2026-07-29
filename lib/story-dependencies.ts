import type {
  PlotPickleProject,
  ProjectAssetReference,
  ScreenplayDraftElement,
  StoryBlock,
} from "./project";
import { projectAssetSourceRisks } from "./project-assets";

export const DEPENDENCY_FORMAT_VERSION = "2.0.0" as const;
export const PPF_RELATIONSHIP_INDEX_VERSION = DEPENDENCY_FORMAT_VERSION;

export type StoryNodeKind =
  | "project" | "story" | "act" | "character" | "location" | "relationship" | "thread"
  | "thread-milestone" | "arc-checkpoint" | "sequence" | "block" | "scene" | "mini-block"
  | "short-scene" | "screenplay-element" | "storyboard-frame" | "graphic-novel-panel"
  | "production-shot" | "production-cue" | "asset" | "asset-variation" | "revision"
  | "provenance" | "hook" | "turn" | "setup" | "payoff" | "objective" | "opposition"
  | "outcome" | "canon-fact";

export type StoryNode = {
  id: string;
  kind: StoryNodeKind;
  label: string;
  module: string;
  path: string;
  metadata?: Record<string, unknown>;
};

export type StoryEdge = {
  id: string;
  from: string;
  to: string;
  type: string;
  source: "explicit" | "derived";
  metadata?: Record<string, unknown>;
};

export type StoryConflict = {
  id: string;
  severity: "warning" | "critical";
  type: string;
  message: string;
  nodeIds: string[];
  suggestedAction: string;
};

export type HealthCheck = {
  id: string;
  status: "pass" | "warning" | "critical";
  label: string;
  message: string;
  nodeIds: string[];
};

export type StoryDependencySnapshot = {
  version: typeof DEPENDENCY_FORMAT_VERSION;
  generatedAt: string;
  projectId: string;
  graph: { nodes: StoryNode[]; edges: StoryEdge[] };
  references: Record<string, string[]>;
  reverseIndex: Record<string, string[]>;
  conflicts: StoryConflict[];
  health: { score: number; warnings: number; critical: number; checks: HealthCheck[] };
};

type IndexState = {
  nodes: StoryNode[];
  edges: StoryEdge[];
  idOwners: Map<string, string[]>;
};

function edgeId(from: string, type: string, to: string) {
  return `${from}::${type}::${to}`;
}

function addEdge(
  edges: StoryEdge[],
  from: string,
  to: string,
  type: string,
  source: "explicit" | "derived" = "explicit",
  metadata?: Record<string, unknown>,
) {
  if (!from || !to || edges.some((edge) => edge.from === from && edge.to === to && edge.type === type)) return;
  edges.push({ id: edgeId(from, type, to), from, to, type, source, ...(metadata ? { metadata } : {}) });
}

function addNode(nodes: StoryNode[], value: StoryNode) {
  if (!value.id || nodes.some((item) => item.id === value.id)) return;
  nodes.push(value);
}

function trackId(state: IndexState, id: string, ownerPath: string) {
  if (!id) return;
  state.idOwners.set(id, [...(state.idOwners.get(id) ?? []), ownerPath]);
}

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function compact(value: string, maximum = 100) {
  const normalized = value.replace(/\s+/g, " ").trim();
  return normalized.length > maximum ? `${normalized.slice(0, maximum - 1)}…` : normalized;
}

function logicNode(
  state: IndexState,
  ownerId: string,
  ownerPath: string,
  kind: Extract<StoryNodeKind, "hook" | "turn" | "setup" | "payoff" | "objective" | "opposition" | "outcome">,
  field: string,
  value: unknown,
) {
  const content = clean(value);
  if (!content) return "";
  const id = `${ownerId}:logic:${kind}:${field}`;
  addNode(state.nodes, {
    id,
    kind,
    label: compact(content),
    module: "story-logic",
    path: `${ownerPath}.${field}`,
    metadata: { ownerId, field, value: content },
  });
  addEdge(state.edges, ownerId, id, `has-${kind}`, "explicit", { ownerPath, field });
  return id;
}

function screenplayCharacterName(element: ScreenplayDraftElement) {
  return element.type === "character" ? element.text.replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase() : "";
}

function addAssetReference(state: IndexState, ownerId: string, reference?: ProjectAssetReference) {
  if (!reference) return;
  addEdge(state.edges, ownerId, reference.assetId, "uses-asset");
  addEdge(state.edges, ownerId, reference.variationId, "uses-asset-variation");
}

function collectBlock(
  state: IndexState,
  project: PlotPickleProject,
  block: StoryBlock,
  sequenceId: string,
  previousBlockId: string,
) {
  const blockPath = `blocks[${block.number - 1}]`;
  trackId(state, block.id, blockPath);
  addNode(state.nodes, {
    id: block.id,
    kind: "block",
    label: `Block ${block.number}: ${block.title}`,
    module: "24-blocks",
    path: blockPath,
    metadata: { number: block.number, act: block.act, sequenceNumber: block.sequenceNumber },
  });
  addEdge(state.edges, sequenceId || project.id, block.id, "contains");
  if (previousBlockId) addEdge(state.edges, previousBlockId, block.id, "precedes", "derived", { order: block.number });
  for (const characterId of block.characterIds) addEdge(state.edges, characterId, block.id, "appears-in");
  for (const locationId of block.locationIds) addEdge(state.edges, locationId, block.id, "used-in");
  logicNode(state, block.id, blockPath, "objective", "goal", block.goal);
  logicNode(state, block.id, blockPath, "opposition", "conflict", block.conflict);
  logicNode(state, block.id, blockPath, "turn", "pickleTurn", block.pickleTurn || block.emotionalTurn);
  logicNode(state, block.id, blockPath, "outcome", "consequence", block.consequence);
  logicNode(state, block.id, blockPath, "setup", "setup", block.setup);
  logicNode(state, block.id, blockPath, "payoff", "payoff", block.payoff);

  const orderedScenes = [...block.scenes].sort((left, right) => left.order - right.order || left.number - right.number || left.id.localeCompare(right.id));
  orderedScenes.forEach((scene, sceneIndex) => {
    const scenePath = `${blockPath}.scenes[${block.scenes.indexOf(scene)}]`;
    trackId(state, scene.id, scenePath);
    addNode(state.nodes, {
      id: scene.id,
      kind: "scene",
      label: `Scene ${scene.number}: ${scene.title}`,
      module: "24-blocks",
      path: scenePath,
      metadata: {
        blockNumber: block.number,
        order: scene.order,
        status: scene.status,
        entryCondition: scene.entryCondition,
        exitCondition: scene.exitCondition,
      },
    });
    addEdge(state.edges, block.id, scene.id, "contains");
    if (sceneIndex) addEdge(state.edges, orderedScenes[sceneIndex - 1].id, scene.id, "precedes", "derived", { scope: block.id });
    for (const characterId of scene.characterIds) addEdge(state.edges, characterId, scene.id, "appears-in");
    for (const characterId of scene.charactersEntering) addEdge(state.edges, characterId, scene.id, "enters-in");
    for (const characterId of scene.charactersLeaving) addEdge(state.edges, characterId, scene.id, "leaves-in");
    for (const locationId of scene.locationIds) addEdge(state.edges, locationId, scene.id, "used-in");
    for (const threadId of scene.threadIds) addEdge(state.edges, threadId, scene.id, "developed-in");
    logicNode(state, scene.id, scenePath, "objective", "objective", scene.objective);
    logicNode(state, scene.id, scenePath, "opposition", "opposition", scene.opposition || scene.conflict);
    logicNode(state, scene.id, scenePath, "turn", "turn", scene.turn || scene.reversal);
    logicNode(state, scene.id, scenePath, "outcome", "outcome", scene.outcome || scene.resolution);

    const orderedMinis = [...scene.miniBlocks].sort((left, right) => left.number - right.number || left.id.localeCompare(right.id));
    orderedMinis.forEach((mini, miniIndex) => {
      const miniPath = `${scenePath}.miniBlocks[${scene.miniBlocks.indexOf(mini)}]`;
      trackId(state, mini.id, miniPath);
      addNode(state.nodes, {
        id: mini.id,
        kind: "mini-block",
        label: mini.label || `Mini-block ${mini.number}`,
        module: "96-blocks",
        path: miniPath,
        metadata: { blockNumber: block.number, sceneId: scene.id, number: mini.number },
      });
      addEdge(state.edges, scene.id, mini.id, "contains");
      if (miniIndex) addEdge(state.edges, orderedMinis[miniIndex - 1].id, mini.id, "precedes", "derived", { scope: scene.id });
      if (mini.characterId) addEdge(state.edges, mini.characterId, mini.id, "drives");
      logicNode(state, mini.id, miniPath, "objective", "objective", mini.objective);
      logicNode(state, mini.id, miniPath, "opposition", "resistance", mini.resistance);
      logicNode(state, mini.id, miniPath, "turn", "turn", mini.turn || mini.revelation);
      logicNode(state, mini.id, miniPath, "setup", "setup", mini.setup);
      logicNode(state, mini.id, miniPath, "payoff", "payoff", mini.payoff);
      mini.shortScenes.forEach((shortScene, shortIndex) => {
        const shortPath = `${miniPath}.shortScenes[${shortIndex}]`;
        trackId(state, shortScene.id, shortPath);
        addNode(state.nodes, {
          id: shortScene.id,
          kind: "short-scene",
          label: shortScene.title,
          module: "96-blocks",
          path: shortPath,
          metadata: { blockNumber: block.number, sceneId: scene.id, miniBlockId: mini.id },
        });
        addEdge(state.edges, mini.id, shortScene.id, "contains");
        for (const characterId of shortScene.charactersEntering) addEdge(state.edges, characterId, shortScene.id, "enters-in");
        for (const characterId of shortScene.charactersLeaving) addEdge(state.edges, characterId, shortScene.id, "leaves-in");
      });
    });
  });

  for (const frame of block.visuals) {
    const framePath = `${blockPath}.visuals[${block.visuals.indexOf(frame)}]`;
    trackId(state, frame.id, framePath);
    addNode(state.nodes, {
      id: frame.id,
      kind: "storyboard-frame",
      label: frame.caption || frame.alt || frame.id,
      module: "storyboard",
      path: framePath,
      metadata: { blockNumber: block.number, miniBlockNumber: frame.miniBlockNumber, continuity: frame.continuity },
    });
    addEdge(state.edges, block.id, frame.id, "visualized-by");
    const mini = block.scenes.flatMap((scene) => scene.miniBlocks).find((item) => item.number === frame.miniBlockNumber);
    if (mini) addEdge(state.edges, mini.id, frame.id, "visualized-by");
    addAssetReference(state, frame.id, frame.assetRef);
  }
}

function sortedRecord(record: Record<string, string[]>) {
  return Object.fromEntries(Object.entries(record)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, values]) => [key, [...new Set(values)].sort()]));
}

function addConflict(conflicts: StoryConflict[], conflict: StoryConflict) {
  if (!conflicts.some((item) => item.id === conflict.id)) conflicts.push(conflict);
}

export function buildStoryDependencies(
  project: PlotPickleProject,
  generatedAt = project.metadata.updatedAt || project.metadata.createdAt || "",
): StoryDependencySnapshot {
  const state: IndexState = { nodes: [], edges: [], idOwners: new Map() };
  const { nodes, edges } = state;
  trackId(state, project.id, "project.id");
  addNode(nodes, { id: project.id, kind: "project", label: project.metadata.title, module: "project", path: "project" });
  const storyId = `${project.id}:story`;
  addNode(nodes, { id: storyId, kind: "story", label: project.story.logline || project.metadata.title, module: "story", path: "story" });
  addEdge(edges, project.id, storyId, "defines");
  logicNode(state, storyId, "story", "hook", "hook", project.story.hook);
  logicNode(state, storyId, "story", "outcome", "ending", project.story.ending);

  const actIds = new Map<number, string>();
  for (let act = 1; act <= 4; act += 1) {
    const id = `${project.id}:act:${act}`;
    actIds.set(act, id);
    addNode(nodes, { id, kind: "act", label: `Act ${act}`, module: "24-blocks", path: `structure.acts[${act - 1}]`, metadata: { act } });
    addEdge(edges, storyId, id, "structured-as");
  }

  const characterByName = new Map<string, string>();
  for (const [index, character] of project.characters.entries()) {
    const path = `characters[${index}]`;
    trackId(state, character.id, path);
    addNode(nodes, { id: character.id, kind: "character", label: character.name, module: "characters", path, metadata: { role: character.role } });
    addEdge(edges, project.id, character.id, "contains");
    characterByName.set(character.name.trim().toLowerCase(), character.id);
    for (const [relationshipIndex, relationship] of character.relationships.entries()) {
      const id = `relationship:${character.id}:${relationship.characterId}:${relationshipIndex + 1}`;
      addNode(nodes, {
        id,
        kind: "relationship",
        label: relationship.label,
        module: "characters",
        path: `${path}.relationships[${relationshipIndex}]`,
        metadata: { description: relationship.description },
      });
      addEdge(edges, character.id, id, "has-relationship");
      addEdge(edges, id, relationship.characterId, "targets");
    }
    for (const [checkpointIndex, checkpoint] of character.arcMatrix.checkpoints.entries()) {
      const checkpointPath = `${path}.arcMatrix.checkpoints[${checkpointIndex}]`;
      trackId(state, checkpoint.id, checkpointPath);
      addNode(nodes, {
        id: checkpoint.id,
        kind: "arc-checkpoint",
        label: `${character.name}: ${checkpoint.kind}`,
        module: "characters",
        path: checkpointPath,
        metadata: { characterId: character.id, kind: checkpoint.kind, blockNumber: checkpoint.blockNumber },
      });
      addEdge(edges, character.id, checkpoint.id, "has-arc-checkpoint");
      if (checkpoint.sceneId) addEdge(edges, checkpoint.id, checkpoint.sceneId, "evidenced-in");
    }
  }

  for (const [index, location] of project.world.locations.entries()) {
    const path = `world.locations[${index}]`;
    trackId(state, location.id, path);
    addNode(nodes, { id: location.id, kind: "location", label: location.name, module: "world", path });
    addEdge(edges, project.id, location.id, "contains");
  }

  for (const [index, thread] of project.storyThreads.entries()) {
    const path = `storyThreads[${index}]`;
    trackId(state, thread.id, path);
    addNode(nodes, { id: thread.id, kind: "thread", label: thread.name, module: "story", path, metadata: { kind: thread.kind, status: thread.status } });
    addEdge(edges, storyId, thread.id, "contains");
    for (const characterId of thread.characterIds) addEdge(edges, characterId, thread.id, "participates-in");
    for (const sceneId of thread.sceneIds) addEdge(edges, thread.id, sceneId, "developed-in");
    thread.milestones.forEach((milestone, milestoneIndex) => {
      const milestonePath = `${path}.milestones[${milestoneIndex}]`;
      trackId(state, milestone.id, milestonePath);
      addNode(nodes, {
        id: milestone.id,
        kind: "thread-milestone",
        label: milestone.summary || `${thread.name}: ${milestone.kind}`,
        module: "story",
        path: milestonePath,
        metadata: { kind: milestone.kind, blockNumber: milestone.blockNumber, resolved: milestone.resolved },
      });
      addEdge(edges, thread.id, milestone.id, "contains");
      if (milestone.sceneId) addEdge(edges, milestone.id, milestone.sceneId, "evidenced-in");
    });
  }

  const sequenceIdByNumber = new Map<number, string>();
  for (const [index, sequence] of project.structure.sequences.entries()) {
    const path = `structure.sequences[${index}]`;
    trackId(state, sequence.id, path);
    sequenceIdByNumber.set(sequence.number, sequence.id);
    addNode(nodes, {
      id: sequence.id,
      kind: "sequence",
      label: `Sequence ${sequence.number}: ${sequence.title}`,
      module: "24-blocks",
      path,
      metadata: { number: sequence.number, act: sequence.act, blockNumbers: sequence.blockNumbers },
    });
    addEdge(edges, actIds.get(sequence.act) || storyId, sequence.id, "contains");
    logicNode(state, sequence.id, path, "hook", "promise", sequence.promise);
    logicNode(state, sequence.id, path, "turn", "turningPoint", sequence.turningPoint);
    logicNode(state, sequence.id, path, "outcome", "result", sequence.result);
  }

  let previousBlockId = "";
  for (const block of [...project.blocks].sort((left, right) => left.number - right.number || left.id.localeCompare(right.id))) {
    collectBlock(state, project, block, sequenceIdByNumber.get(block.sequenceNumber) || "", previousBlockId);
    previousBlockId = block.id;
  }

  let currentCharacterId = "";
  for (const [index, element] of project.screenplay.draftElements.entries()) {
    const path = `screenplay.draftElements[${index}]`;
    trackId(state, element.id, path);
    addNode(nodes, {
      id: element.id,
      kind: "screenplay-element",
      label: element.text.slice(0, 100) || element.type,
      module: "screenplay",
      path,
      metadata: { type: element.type, sceneId: element.sceneId, blockNumber: element.blockNumber, miniBlockNumber: element.miniBlockNumber },
    });
    if (element.sceneId) addEdge(edges, element.sceneId, element.id, "written-as");
    const spokenName = screenplayCharacterName(element);
    if (spokenName) currentCharacterId = characterByName.get(spokenName) ?? "";
    else if (element.type === "dialogue" && currentCharacterId) addEdge(edges, currentCharacterId, element.id, "speaks", "derived");
    else if (!["parenthetical", "dialogue"].includes(element.type)) currentCharacterId = "";
    for (const threadId of element.threadIds ?? []) addEdge(edges, threadId, element.id, "referenced-by");
    for (const provenanceId of element.aiProvenanceIds ?? []) addEdge(edges, element.id, provenanceId, "has-provenance");
  }

  const blockIdByNumber = new Map(project.blocks.map((block) => [block.number, block.id]));
  for (const [index, shot] of project.production.shots.entries()) {
    const path = `production.shots[${index}]`;
    trackId(state, shot.id, path);
    addNode(nodes, {
      id: shot.id,
      kind: "production-shot",
      label: shot.purpose || shot.shotSize || shot.id,
      module: "production",
      path,
      metadata: { status: shot.status, blockNumber: shot.blockNumber, miniBlockNumber: shot.miniBlockNumber, continuity: shot.continuity },
    });
    if (shot.sceneId) addEdge(edges, shot.sceneId, shot.id, "covered-by");
    const blockId = blockIdByNumber.get(shot.blockNumber);
    if (blockId) addEdge(edges, blockId, shot.id, "covered-by");
    if (shot.frameId) addEdge(edges, shot.frameId, shot.id, "realized-as");
    for (const elementId of shot.screenplayElementIds) addEdge(edges, elementId, shot.id, "covered-by");
    addAssetReference(state, shot.id, shot.assetRef);
  }

  for (const [index, cue] of project.production.cues.entries()) {
    const path = `production.cues[${index}]`;
    trackId(state, cue.id, path);
    addNode(nodes, { id: cue.id, kind: "production-cue", label: cue.title || cue.purpose || cue.id, module: "production", path, metadata: { status: cue.status, type: cue.type } });
    if (cue.sceneId) addEdge(edges, cue.sceneId, cue.id, "scored-by");
    const blockId = blockIdByNumber.get(cue.blockNumber);
    if (blockId) addEdge(edges, blockId, cue.id, "scored-by");
  }

  const panels = project.review.pitchPackage.comicDeck?.panels ?? [];
  for (const [index, panel] of panels.entries()) {
    const path = `review.pitchPackage.comicDeck.panels[${index}]`;
    trackId(state, panel.id, path);
    addNode(nodes, {
      id: panel.id,
      kind: "graphic-novel-panel",
      label: panel.title,
      module: "graphic-novel",
      path,
      metadata: { pageNumber: panel.pageNumber, panelNumber: panel.panelNumber, status: panel.status },
    });
    const blockId = blockIdByNumber.get(panel.blockNumber);
    if (blockId) addEdge(edges, blockId, panel.id, "visualized-by");
    for (const characterId of panel.characterIds) addEdge(edges, characterId, panel.id, "appears-in");
    for (const locationId of panel.locationIds) addEdge(edges, locationId, panel.id, "used-in");
    addAssetReference(state, panel.id, panel.assetRef);
  }

  for (const [index, asset] of project.assets.assets.entries()) {
    const path = `assets.assets[${index}]`;
    trackId(state, asset.id, path);
    addNode(nodes, {
      id: asset.id,
      kind: "asset",
      label: asset.label,
      module: "assets",
      path,
      metadata: { kind: asset.kind, approvedVariationId: asset.approvedVariationId },
    });
    addEdge(edges, project.id, asset.id, "owns-asset");
    for (const target of asset.targets) addEdge(edges, target.id, asset.id, "uses-asset");
    for (const [variationIndex, variation] of asset.variations.entries()) {
      const variationPath = `${path}.variations[${variationIndex}]`;
      trackId(state, variation.id, variationPath);
      addNode(nodes, {
        id: variation.id,
        kind: "asset-variation",
        label: `${asset.label} variation ${variationIndex + 1}`,
        module: "assets",
        path: variationPath,
        metadata: {
          assetId: asset.id,
          approval: variation.approval,
          mediaType: variation.mediaType,
          portablePath: variation.portablePath,
          sourceFingerprint: variation.sourceFingerprint,
        },
      });
      addEdge(edges, asset.id, variation.id, "contains");
      for (const provenanceId of variation.provenanceIds) addEdge(edges, variation.id, provenanceId, "has-provenance");
    }
  }

  for (const [index, revision] of project.revisions.entries()) {
    const path = `revisions[${index}]`;
    trackId(state, revision.id, path);
    addNode(nodes, { id: revision.id, kind: "revision", label: revision.label, module: "revisions", path, metadata: { contentHash: revision.contentHash, createdAt: revision.createdAt } });
    addEdge(edges, project.id, revision.id, "has-revision");
  }

  for (const [index, provenance] of project.rights.aiProvenance.entries()) {
    const path = `rights.aiProvenance[${index}]`;
    trackId(state, provenance.id, path);
    addNode(nodes, {
      id: provenance.id,
      kind: "provenance",
      label: provenance.outputSummary || provenance.operation,
      module: "rights",
      path,
      metadata: { provider: provenance.provider, model: provenance.model, operation: provenance.operation, retained: provenance.retained },
    });
    addEdge(edges, project.id, provenance.id, "has-provenance");
    for (const [attachmentIndex, targetId] of provenance.attachedTo.entries()) {
      if (!nodes.some((node) => node.id === targetId)) addNode(nodes, {
        id: targetId,
        kind: "canon-fact",
        label: targetId,
        module: "rights",
        path: `${path}.attachedTo[${attachmentIndex}]`,
        metadata: { provenanceAttachment: true, legacyLabel: true },
      });
      addEdge(edges, provenance.id, targetId, "documents");
    }
  }

  nodes.sort((left, right) => left.id.localeCompare(right.id));
  edges.sort((left, right) => left.id.localeCompare(right.id));
  const nodeIds = new Set(nodes.map((item) => item.id));
  const references: Record<string, string[]> = {};
  const reverseIndex: Record<string, string[]> = {};
  for (const edge of edges) {
    (references[edge.from] ??= []).push(edge.to);
    (reverseIndex[edge.to] ??= []).push(edge.from);
  }

  const conflicts: StoryConflict[] = [];
  const checks: HealthCheck[] = [];
  const addCheck = (check: HealthCheck) => checks.push(check);

  for (const [id, owners] of [...state.idOwners.entries()].sort(([left], [right]) => left.localeCompare(right))) {
    if (owners.length < 2) continue;
    addConflict(conflicts, {
      id: `duplicate-id:${id}`,
      severity: "critical",
      type: "duplicate-stable-id",
      message: `Stable ID "${id}" is owned by ${owners.length} canonical records.`,
      nodeIds: [id],
      suggestedAction: "Assign a unique stable ID to each canonical record before publishing or rendering.",
    });
  }

  const unresolvedEdges = edges.filter((edge) => !nodeIds.has(edge.from) || !nodeIds.has(edge.to));
  for (const edge of unresolvedEdges) {
    const missing = [edge.from, edge.to].filter((id) => !nodeIds.has(id));
    addConflict(conflicts, {
      id: `broken-reference:${edge.id}`,
      severity: "critical",
      type: "broken-reference",
      message: `Relationship "${edge.type}" contains an unresolved stable reference.`,
      nodeIds: [...new Set([edge.from, edge.to])],
      suggestedAction: `Replace or remove the missing reference${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}.`,
    });
  }

  const characterIds = new Set(project.characters.map((character) => character.id));
  const locationIds = new Set(project.world.locations.map((location) => location.id));
  for (const block of project.blocks) {
    const referencedCharacters = [
      ...block.characterIds,
      ...block.scenes.flatMap((scene) => [
        ...scene.characterIds,
        ...scene.charactersEntering,
        ...scene.charactersLeaving,
        ...scene.miniBlocks.flatMap((mini) => [
          mini.characterId,
          ...mini.shortScenes.flatMap((shortScene) => [...shortScene.charactersEntering, ...shortScene.charactersLeaving]),
        ]),
      ]),
    ].filter(Boolean);
    const referencedLocations = [
      ...block.locationIds,
      ...block.scenes.flatMap((scene) => scene.locationIds),
    ].filter(Boolean);
    const missingCharacters = [...new Set(referencedCharacters.filter((id) => !characterIds.has(id)))];
    const missingLocations = [...new Set(referencedLocations.filter((id) => !locationIds.has(id)))];
    if (missingCharacters.length) addConflict(conflicts, {
      id: `missing-character:${block.id}`,
      severity: "critical",
      type: "broken-reference",
      message: `Block ${block.number} references missing character identities.`,
      nodeIds: [block.id, ...missingCharacters],
      suggestedAction: "Replace or remove the missing character references before rendering or publishing.",
    });
    if (missingLocations.length) addConflict(conflicts, {
      id: `missing-location:${block.id}`,
      severity: "warning",
      type: "broken-reference",
      message: `Block ${block.number} references missing locations.`,
      nodeIds: [block.id, ...missingLocations],
      suggestedAction: "Replace or remove the missing location references before rendering or publishing.",
    });
  }

  const sourceOwners = new Map<string, string[]>();
  for (const asset of project.assets.assets) {
    for (const variation of asset.variations) {
      if (!variation.sourceFingerprint) continue;
      sourceOwners.set(variation.sourceFingerprint, [...(sourceOwners.get(variation.sourceFingerprint) ?? []), asset.id]);
    }
  }
  for (const [fingerprint, owners] of sourceOwners) {
    const uniqueOwners = [...new Set(owners)];
    if (uniqueOwners.length < 2) continue;
    addConflict(conflicts, {
      id: `duplicate-asset:${fingerprint}`,
      severity: "warning",
      type: "duplicate-asset-record",
      message: "The same retained source is represented by more than one project asset.",
      nodeIds: uniqueOwners,
      suggestedAction: "Merge the duplicate records and keep the current view references attached to one asset identity.",
    });
  }

  for (const risk of projectAssetSourceRisks(project.assets)) {
    addConflict(conflicts, {
      id: `unsafe-asset-source:${risk.assetId}:${risk.variationId}`,
      severity: "critical",
      type: risk.type === "credential" ? "credential-in-portable-data" : "machine-specific-path",
      message: risk.type === "credential"
        ? "An asset source appears to contain a credential."
        : "An asset source contains an absolute machine-specific path.",
      nodeIds: [risk.assetId, risk.variationId],
      suggestedAction: risk.type === "credential"
        ? "Remove the credential immediately and store it only in protected local connection storage."
        : "Copy or relink the file through a project-relative asset path.",
    });
  }

  for (const block of project.blocks) {
    const blockSetups = [block.setup, ...block.scenes.flatMap((scene) => scene.miniBlocks.map((mini) => mini.setup))].filter((value) => clean(value));
    const blockPayoffs = [block.payoff, ...block.scenes.flatMap((scene) => scene.miniBlocks.map((mini) => mini.payoff))].filter((value) => clean(value));
    if (blockSetups.length && !blockPayoffs.length) addConflict(conflicts, {
      id: `setup-without-payoff:${block.id}`,
      severity: "warning",
      type: "setup-payoff-gap",
      message: `Block ${block.number} contains setup evidence but no linked payoff evidence.`,
      nodeIds: [block.id],
      suggestedAction: "Add the intended payoff or identify the later Block, scene, mini-block or thread milestone that delivers it.",
    });
    const hasStoryMaterial = Boolean(clean(block.summary) || block.scenes.some((scene) => clean(scene.action) || clean(scene.outcome)));
    const hasTurn = Boolean(clean(block.pickleTurn) || clean(block.emotionalTurn)
      || block.scenes.some((scene) => clean(scene.turn) || scene.miniBlocks.some((mini) => clean(mini.turn))));
    if (hasStoryMaterial && !hasTurn) addConflict(conflicts, {
      id: `missing-turn:${block.id}`,
      severity: "warning",
      type: "hook-turn-gap",
      message: `Block ${block.number} contains story material without a visible turn.`,
      nodeIds: [block.id],
      suggestedAction: "Identify the decision, reversal, revelation or consequence that changes the movie's direction.",
    });

    const sceneOrders = new Map<number, string[]>();
    for (const scene of block.scenes) sceneOrders.set(scene.order, [...(sceneOrders.get(scene.order) ?? []), scene.id]);
    for (const [order, sceneIds] of sceneOrders) if (sceneIds.length > 1) addConflict(conflicts, {
      id: `contradictory-order:${block.id}:${order}`,
      severity: "warning",
      type: "contradictory-chronology",
      message: `Block ${block.number} contains multiple scenes at presentation order ${order}.`,
      nodeIds: [block.id, ...sceneIds],
      suggestedAction: "Assign an unambiguous presentation order while preserving any separate story chronology.",
    });

    for (const scene of block.scenes) {
      const both = scene.charactersEntering.filter((id) => scene.charactersLeaving.includes(id));
      if (both.length && !clean(scene.action) && !clean(scene.outcome)) addConflict(conflicts, {
        id: `continuity-link:${scene.id}`,
        severity: "warning",
        type: "contradictory-continuity-link",
        message: `Scene ${scene.number} has characters entering and leaving without action or outcome evidence.`,
        nodeIds: [scene.id, ...both],
        suggestedAction: "Clarify the visible continuity event or remove the contradictory entrance/exit link.",
      });
    }
  }

  for (const block of project.blocks) {
    for (const frame of block.visuals) {
      if ((frame.assetRef || frame.src) && (!clean(frame.prompt) || !clean(frame.continuity))) addConflict(conflicts, {
        id: `render-context:${frame.id}`,
        severity: "warning",
        type: "render-context-gap",
        message: `Storyboard frame ${block.number}.${frame.miniBlockNumber} has an image without complete prompt and continuity context.`,
        nodeIds: [frame.id, ...(frame.assetRef ? [frame.assetRef.assetId, frame.assetRef.variationId] : [])],
        suggestedAction: "Record the approved prompt and continuity constraints before re-rendering or sharing this target.",
      });
    }
  }
  for (const panel of panels) {
    if ((panel.assetRef || panel.imageSrc) && (!clean(panel.prompt) || (!panel.characterIds.length && !panel.locationIds.length))) addConflict(conflicts, {
      id: `render-context:${panel.id}`,
      severity: "warning",
      type: "render-context-gap",
      message: `Graphic Novel panel ${panel.pageNumber}.${panel.panelNumber} lacks enough approved render context.`,
      nodeIds: [panel.id, ...(panel.assetRef ? [panel.assetRef.assetId, panel.assetRef.variationId] : [])],
      suggestedAction: "Attach the relevant character or location locks and retain the approved prompt.",
    });
  }

  const unresolvedThreads = project.storyThreads.filter((thread) => thread.status === "active" && thread.resolvedBlockNumber == null);
  if (unresolvedThreads.length) addConflict(conflicts, {
    id: "unresolved-threads",
    severity: "warning",
    type: "unresolved-thread",
    message: `${unresolvedThreads.length} active story thread(s) have no resolution block.`,
    nodeIds: unresolvedThreads.map((item) => item.id),
    suggestedAction: "Assign a resolution milestone or mark the thread intentionally open.",
  });

  addCheck({
    id: "catalyst",
    status: project.story.catalyst.trim() ? "pass" : "warning",
    label: "Catalyst",
    message: project.story.catalyst.trim() ? "Catalyst is defined." : "The story catalyst is empty.",
    nodeIds: [storyId],
  });
  addCheck({
    id: "hook",
    status: project.story.hook.trim() ? "pass" : "warning",
    label: "Opening hook",
    message: project.story.hook.trim() ? "The opening hook is defined." : "The opening hook is empty.",
    nodeIds: [storyId],
  });
  const ghostDefined = project.development.ghost.centralWound.trim() || project.characters.some((character) => character.ghost.trim());
  addCheck({
    id: "ghost",
    status: ghostDefined ? "pass" : "warning",
    label: "Ghost",
    message: ghostDefined ? "A central wound or character ghost is defined." : "No central wound or character ghost is defined.",
    nodeIds: project.characters.map((item) => item.id),
  });
  const emptyBlocks = project.blocks.filter((block) => !block.summary.trim() && block.scenes.length === 0);
  addCheck({
    id: "empty-blocks",
    status: emptyBlocks.length ? "warning" : "pass",
    label: "Block coverage",
    message: emptyBlocks.length ? `${emptyBlocks.length} block(s) have no summary or scenes.` : "All blocks contain story material.",
    nodeIds: emptyBlocks.map((item) => item.id),
  });
  const unusedCharacters = project.characters.filter((character) => !(references[character.id]?.length));
  addCheck({
    id: "unused-characters",
    status: unusedCharacters.length ? "warning" : "pass",
    label: "Character usage",
    message: unusedCharacters.length ? `${unusedCharacters.length} character(s) are not connected to story material.` : "All characters are connected.",
    nodeIds: unusedCharacters.map((item) => item.id),
  });
  const orphanFrames = nodes.filter((item) => item.kind === "storyboard-frame" && !(reverseIndex[item.id]?.length));
  addCheck({
    id: "orphan-frames",
    status: orphanFrames.length ? "warning" : "pass",
    label: "Storyboard links",
    message: orphanFrames.length ? `${orphanFrames.length} storyboard frame(s) are orphaned.` : "All storyboard frames are linked.",
    nodeIds: orphanFrames.map((item) => item.id),
  });
  addCheck({
    id: "shared-assets",
    status: conflicts.some((item) => item.type === "duplicate-asset-record" || item.type === "broken-reference") ? "warning" : "pass",
    label: "Shared asset identity",
    message: conflicts.some((item) => item.type === "duplicate-asset-record" || item.type === "broken-reference")
      ? "Some visual references need asset-identity repair."
      : "Visual workspaces resolve through shared project asset identities.",
    nodeIds: project.assets.assets.map((asset) => asset.id),
  });
  for (const conflict of conflicts) addCheck({
    id: `conflict:${conflict.id}`,
    status: conflict.severity,
    label: conflict.type,
    message: conflict.message,
    nodeIds: conflict.nodeIds,
  });

  conflicts.sort((left, right) => left.id.localeCompare(right.id));
  checks.sort((left, right) => left.id.localeCompare(right.id));
  const critical = checks.filter((item) => item.status === "critical").length;
  const warnings = checks.filter((item) => item.status === "warning").length;
  const score = Math.max(0, Math.round(100 - critical * 20 - warnings * 5));
  return {
    version: DEPENDENCY_FORMAT_VERSION,
    generatedAt,
    projectId: project.id,
    graph: { nodes, edges },
    references: sortedRecord(references),
    reverseIndex: sortedRecord(reverseIndex),
    conflicts,
    health: { score, warnings, critical, checks },
  };
}

export const buildPpfRelationshipIndex = buildStoryDependencies;

export function relationshipIndexFingerprint(snapshot: StoryDependencySnapshot) {
  const source = JSON.stringify({
    version: snapshot.version,
    projectId: snapshot.projectId,
    graph: snapshot.graph,
    references: snapshot.references,
    reverseIndex: snapshot.reverseIndex,
    conflicts: snapshot.conflicts,
    health: snapshot.health,
  });
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function impactForNode(snapshot: StoryDependencySnapshot, nodeId: string) {
  const outgoing = snapshot.references[nodeId] ?? [];
  const incoming = snapshot.reverseIndex[nodeId] ?? [];
  const affected = [...new Set([...outgoing, ...incoming])];
  return {
    nodeId,
    directlyAffected: affected,
    count: affected.length,
    nodes: snapshot.graph.nodes.filter((item) => affected.includes(item.id)),
  };
}
