import type { PlotPickleProject, ScreenplayDraftElement, StoryBlock } from "./project";

export const DEPENDENCY_FORMAT_VERSION = "1.0.0" as const;

export type StoryNodeKind =
  | "project" | "story" | "character" | "location" | "relationship" | "thread"
  | "sequence" | "block" | "scene" | "mini-block" | "screenplay-element"
  | "storyboard-frame" | "production-shot" | "production-cue" | "canon-fact";

export type StoryNode = { id: string; kind: StoryNodeKind; label: string; module: string; path?: string; metadata?: Record<string, unknown> };
export type StoryEdge = { id: string; from: string; to: string; type: string; source: "explicit" | "derived"; metadata?: Record<string, unknown> };
export type StoryConflict = { id: string; severity: "warning" | "critical"; type: string; message: string; nodeIds: string[]; suggestedAction: string };
export type HealthCheck = { id: string; status: "pass" | "warning" | "critical"; label: string; message: string; nodeIds: string[] };

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

function edgeId(from: string, type: string, to: string) { return `${from}::${type}::${to}`; }
function addEdge(edges: StoryEdge[], from: string, to: string, type: string, source: "explicit" | "derived" = "explicit") {
  if (!from || !to || edges.some((edge) => edge.from === from && edge.to === to && edge.type === type)) return;
  edges.push({ id: edgeId(from, type, to), from, to, type, source });
}
function node(nodes: StoryNode[], value: StoryNode) { if (!nodes.some((item) => item.id === value.id)) nodes.push(value); }

function screenplayCharacterName(element: ScreenplayDraftElement) {
  return element.type === "character" ? element.text.replace(/\s*\(.*\)\s*$/, "").trim().toLowerCase() : "";
}

function collectBlock(nodes: StoryNode[], edges: StoryEdge[], project: PlotPickleProject, block: StoryBlock) {
  node(nodes, { id: block.id, kind: "block", label: `Block ${block.number}: ${block.title}`, module: "24-blocks", metadata: { number: block.number, act: block.act } });
  addEdge(edges, project.id, block.id, "contains");
  for (const characterId of block.characterIds) addEdge(edges, characterId, block.id, "appears-in");
  for (const locationId of block.locationIds) addEdge(edges, locationId, block.id, "used-in");
  for (const scene of block.scenes) {
    node(nodes, { id: scene.id, kind: "scene", label: `Scene ${scene.number}: ${scene.title}`, module: "24-blocks", metadata: { blockNumber: block.number, status: scene.status } });
    addEdge(edges, block.id, scene.id, "contains");
    for (const characterId of scene.characterIds) addEdge(edges, characterId, scene.id, "appears-in");
    for (const locationId of scene.locationIds) addEdge(edges, locationId, scene.id, "used-in");
    for (const threadId of scene.threadIds) addEdge(edges, threadId, scene.id, "developed-in");
    for (const mini of scene.miniBlocks) {
      node(nodes, { id: mini.id, kind: "mini-block", label: mini.label || `Mini-block ${mini.number}`, module: "96-blocks", metadata: { blockNumber: block.number, sceneId: scene.id } });
      addEdge(edges, scene.id, mini.id, "contains");
      if (mini.characterId) addEdge(edges, mini.characterId, mini.id, "drives");
    }
  }
  for (const frame of block.visuals) {
    node(nodes, { id: frame.id, kind: "storyboard-frame", label: frame.caption || frame.alt || frame.id, module: "storyboard", metadata: { blockNumber: block.number, miniBlockNumber: frame.miniBlockNumber } });
    addEdge(edges, block.id, frame.id, "visualized-by");
  }
}

export function buildStoryDependencies(project: PlotPickleProject, generatedAt = new Date().toISOString()): StoryDependencySnapshot {
  const nodes: StoryNode[] = [];
  const edges: StoryEdge[] = [];
  node(nodes, { id: project.id, kind: "project", label: project.metadata.title, module: "project" });
  node(nodes, { id: `${project.id}:story`, kind: "story", label: project.story.logline || project.metadata.title, module: "story" });
  addEdge(edges, project.id, `${project.id}:story`, "defines");

  const characterByName = new Map<string, string>();
  for (const character of project.characters) {
    node(nodes, { id: character.id, kind: "character", label: character.name, module: "characters", metadata: { role: character.role } });
    addEdge(edges, project.id, character.id, "contains");
    characterByName.set(character.name.trim().toLowerCase(), character.id);
    for (const relationship of character.relationships) {
      const id = `relationship:${character.id}:${relationship.characterId}:${relationship.label}`;
      node(nodes, { id, kind: "relationship", label: relationship.label, module: "characters", metadata: { description: relationship.description } });
      addEdge(edges, character.id, id, "has-relationship");
      addEdge(edges, id, relationship.characterId, "targets");
    }
  }
  for (const location of project.world.locations) {
    node(nodes, { id: location.id, kind: "location", label: location.name, module: "world" });
    addEdge(edges, project.id, location.id, "contains");
  }
  for (const thread of project.storyThreads) {
    node(nodes, { id: thread.id, kind: "thread", label: thread.name, module: "story", metadata: { kind: thread.kind, status: thread.status } });
    addEdge(edges, `${project.id}:story`, thread.id, "contains");
    for (const characterId of thread.characterIds) addEdge(edges, characterId, thread.id, "participates-in");
  }
  for (const sequence of project.structure.sequences) {
    node(nodes, { id: sequence.id, kind: "sequence", label: `Sequence ${sequence.number}: ${sequence.title}`, module: "24-blocks", metadata: { act: sequence.act } });
    addEdge(edges, `${project.id}:story`, sequence.id, "structured-as");
  }
  for (const block of project.blocks) collectBlock(nodes, edges, project, block);

  let currentCharacterId = "";
  for (const element of project.screenplay.draftElements) {
    node(nodes, { id: element.id, kind: "screenplay-element", label: element.text.slice(0, 100) || element.type, module: "screenplay", metadata: { type: element.type, sceneId: element.sceneId, blockNumber: element.blockNumber } });
    if (element.sceneId) addEdge(edges, element.sceneId, element.id, "written-as");
    const spokenName = screenplayCharacterName(element);
    if (spokenName) currentCharacterId = characterByName.get(spokenName) ?? "";
    else if (element.type === "dialogue" && currentCharacterId) addEdge(edges, currentCharacterId, element.id, "speaks", "derived");
    else if (!["parenthetical", "dialogue"].includes(element.type)) currentCharacterId = "";
    for (const threadId of element.threadIds) addEdge(edges, threadId, element.id, "referenced-by");
  }

  for (const shot of project.production.shots) {
    node(nodes, { id: shot.id, kind: "production-shot", label: shot.description || shot.shotType || shot.id, module: "production" });
    if (shot.sceneId) addEdge(edges, shot.sceneId, shot.id, "covered-by");
    if (shot.blockId) addEdge(edges, shot.blockId, shot.id, "covered-by");
    if (shot.storyboardFrameId) addEdge(edges, shot.storyboardFrameId, shot.id, "realized-as");
  }
  for (const cue of project.production.cues) {
    node(nodes, { id: cue.id, kind: "production-cue", label: cue.label || cue.description || cue.id, module: "production" });
    if (cue.sceneId) addEdge(edges, cue.sceneId, cue.id, "scored-by");
    if (cue.blockId) addEdge(edges, cue.blockId, cue.id, "scored-by");
  }

  const references: Record<string, string[]> = {};
  const reverseIndex: Record<string, string[]> = {};
  for (const edge of edges) {
    (references[edge.from] ??= []).push(edge.to);
    (reverseIndex[edge.to] ??= []).push(edge.from);
  }

  const conflicts: StoryConflict[] = [];
  const checks: HealthCheck[] = [];
  const addCheck = (check: HealthCheck) => { checks.push(check); };
  const characterIds = new Set(project.characters.map((item) => item.id));
  const locationIds = new Set(project.world.locations.map((item) => item.id));
  for (const block of project.blocks) {
    const missingCharacters = block.characterIds.filter((id) => !characterIds.has(id));
    const missingLocations = block.locationIds.filter((id) => !locationIds.has(id));
    if (missingCharacters.length) conflicts.push({ id: `missing-character:${block.id}`, severity: "critical", type: "broken-reference", message: `Block ${block.number} references missing characters.`, nodeIds: [block.id, ...missingCharacters], suggestedAction: "Replace or remove the missing character references." });
    if (missingLocations.length) conflicts.push({ id: `missing-location:${block.id}`, severity: "warning", type: "broken-reference", message: `Block ${block.number} references missing locations.`, nodeIds: [block.id, ...missingLocations], suggestedAction: "Replace or remove the missing location references." });
  }
  const unresolvedThreads = project.storyThreads.filter((thread) => thread.status === "active" && thread.resolvedBlockNumber == null);
  if (unresolvedThreads.length) conflicts.push({ id: "unresolved-threads", severity: "warning", type: "unresolved-thread", message: `${unresolvedThreads.length} active story thread(s) have no resolution block.`, nodeIds: unresolvedThreads.map((item) => item.id), suggestedAction: "Assign a resolution milestone or mark the thread intentionally open." });

  addCheck({ id: "catalyst", status: project.story.catalyst.trim() ? "pass" : "warning", label: "Catalyst", message: project.story.catalyst.trim() ? "Catalyst is defined." : "The story catalyst is empty.", nodeIds: [`${project.id}:story`] });
  const ghostDefined = project.development.ghost.centralWound.trim() || project.characters.some((character) => character.ghost.trim());
  addCheck({ id: "ghost", status: ghostDefined ? "pass" : "warning", label: "Ghost", message: ghostDefined ? "A central wound or character ghost is defined." : "No central wound or character ghost is defined.", nodeIds: project.characters.map((item) => item.id) });
  const emptyBlocks = project.blocks.filter((block) => !block.summary.trim() && block.scenes.length === 0);
  addCheck({ id: "empty-blocks", status: emptyBlocks.length ? "warning" : "pass", label: "Block coverage", message: emptyBlocks.length ? `${emptyBlocks.length} block(s) have no summary or scenes.` : "All blocks contain story material.", nodeIds: emptyBlocks.map((item) => item.id) });
  const unusedCharacters = project.characters.filter((character) => !(references[character.id]?.length));
  addCheck({ id: "unused-characters", status: unusedCharacters.length ? "warning" : "pass", label: "Character usage", message: unusedCharacters.length ? `${unusedCharacters.length} character(s) are not connected to story material.` : "All characters are connected.", nodeIds: unusedCharacters.map((item) => item.id) });
  const orphanFrames = nodes.filter((item) => item.kind === "storyboard-frame" && !(reverseIndex[item.id]?.length));
  addCheck({ id: "orphan-frames", status: orphanFrames.length ? "warning" : "pass", label: "Storyboard links", message: orphanFrames.length ? `${orphanFrames.length} storyboard frame(s) are orphaned.` : "All storyboard frames are linked.", nodeIds: orphanFrames.map((item) => item.id) });
  for (const conflict of conflicts) addCheck({ id: `conflict:${conflict.id}`, status: conflict.severity, label: conflict.type, message: conflict.message, nodeIds: conflict.nodeIds });

  const critical = checks.filter((item) => item.status === "critical").length;
  const warnings = checks.filter((item) => item.status === "warning").length;
  const score = Math.max(0, Math.round(100 - critical * 20 - warnings * 5));
  return { version: DEPENDENCY_FORMAT_VERSION, generatedAt, projectId: project.id, graph: { nodes, edges }, references, reverseIndex, conflicts, health: { score, warnings, critical, checks } };
}

export function impactForNode(snapshot: StoryDependencySnapshot, nodeId: string) {
  const outgoing = snapshot.references[nodeId] ?? [];
  const incoming = snapshot.reverseIndex[nodeId] ?? [];
  const affected = [...new Set([...outgoing, ...incoming])];
  return { nodeId, directlyAffected: affected, count: affected.length, nodes: snapshot.graph.nodes.filter((node) => affected.includes(node.id)) };
}
