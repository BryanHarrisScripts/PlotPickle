import {
  cloneProject,
  type Character,
  type PlotPickleProject,
  type ReviewWorkspace,
  type ScreenplayDocument,
  type ScreenplayDraftElement,
  type StoryBlock,
} from "./project";
import {
  addDynamicScene,
  assignMiniBlockToScene as assignMiniBlock,
  duplicateDynamicScene,
  moveDynamicScene,
  moveSceneBetweenBlocks as moveBetweenBlocks,
  removeDynamicScene,
  type MiniBlock,
  type SceneType,
  type ShortScene,
  type StoryScene,
} from "./structure";

export const PHASE_ONE_SCHEMA_VERSION = "1.7.0" as const;

export type StoryThreadKind = "main" | "subplot" | "relationship" | "mystery" | "theme" | "world";
export type StoryThreadStatus = "planned" | "active" | "paused" | "resolved" | "abandoned";
export type StoryThreadMilestoneKind = "setup" | "development" | "turn" | "reveal" | "payoff" | "resolution";

export type StoryThreadMilestone = {
  id: string;
  sceneId: string;
  blockNumber: number;
  kind: StoryThreadMilestoneKind;
  summary: string;
  resolved: boolean;
};

export type StoryThread = {
  id: string;
  name: string;
  kind: StoryThreadKind;
  status: StoryThreadStatus;
  summary: string;
  question: string;
  characterIds: string[];
  sceneIds: string[];
  introducedBlockNumber: number | null;
  resolvedBlockNumber: number | null;
  milestones: StoryThreadMilestone[];
  notes: string;
  createdAt: string;
  updatedAt: string;
};

export type ArcCheckpointKind = "opening" | "catalyst" | "threshold" | "midpoint" | "crisis" | "climax" | "ending" | "custom";

export type CharacterArcCheckpoint = {
  id: string;
  kind: ArcCheckpointKind;
  blockNumber: number | null;
  sceneId: string;
  belief: string;
  strategy: string;
  pressure: string;
  choice: string;
  consequence: string;
  evidence: string;
};

export type CharacterArcMatrix = {
  startingState: string;
  consciousWant: string;
  underlyingNeed: string;
  protectiveLie: string;
  emergingTruth: string;
  midpointShift: string;
  crisisChoice: string;
  climaxChoice: string;
  endingState: string;
  relationshipImpact: string;
  checkpoints: CharacterArcCheckpoint[];
};

export type RightsCollaborator = {
  id: string;
  name: string;
  role: string;
  contribution: string;
  ownershipShare: string;
  agreementReference: string;
  creditedAs: string;
  createdAt: string;
  updatedAt: string;
};

export type SourceAttribution = {
  id: string;
  title: string;
  creator: string;
  sourceType: "research" | "quotation" | "adaptation" | "public-domain" | "licensed-material" | "other";
  sourceUrl: string;
  licence: string;
  permissionReference: string;
  notes: string;
  attachedTo: string[];
  createdAt: string;
};

export type AiProvenanceRecord = {
  id: string;
  provider: string;
  model: string;
  operation: "brainstorm" | "rewrite" | "analysis" | "dialogue" | "image" | "audio" | "video" | "other";
  promptSummary: string;
  outputSummary: string;
  humanContribution: string;
  humanDecision: string;
  retained: boolean;
  attachedTo: string[];
  createdAt: string;
};

export type RightsAndProvenance = {
  projectOwner: string;
  copyrightNotice: string;
  rightsStatement: string;
  defaultCreativeLicence: string;
  sourceWorkTitle: string;
  sourceWorkAuthor: string;
  adaptationStatus: "original" | "adaptation" | "commissioned" | "collaboration" | "unknown";
  collaborators: RightsCollaborator[];
  attributions: SourceAttribution[];
  aiProvenance: AiProvenanceRecord[];
};

export type RevisionColour = "none" | "blue" | "pink" | "yellow" | "green" | "goldenrod" | "buff" | "salmon" | "cherry" | "tan" | "gray";

export type ExpandedScreenplayDraftElementType =
  | ScreenplayDraftElement["type"]
  | "section"
  | "synopsis"
  | "shot"
  | "lyrics"
  | "dual-dialogue"
  | "centered"
  | "page-break"
  | "title-page"
  | "note"
  | "boneyard";

export type PhaseOneScreenplayDraftElement = Omit<ScreenplayDraftElement, "type"> & {
  type: ExpandedScreenplayDraftElementType;
  sceneId: string;
  threadIds: string[];
  omitted: boolean;
  locked: boolean;
  revisionColour: RevisionColour;
  sourceAttributionIds: string[];
  aiProvenanceIds: string[];
};

export type PhaseOneStoryScene = StoryScene & {
  order: number;
  threadIds: string[];
  status: "outline" | "draft" | "revised" | "locked" | "omitted";
  revisionColour: RevisionColour;
  locked: boolean;
};

export type PhaseOneStoryBlock = Omit<StoryBlock, "scenes"> & {
  scenes: PhaseOneStoryScene[];
};

export type PhaseOneCharacter = Character & {
  arcMatrix: CharacterArcMatrix;
};

export type PhaseOneScreenplayDocument = Omit<ScreenplayDocument, "draftElements"> & {
  draftElements: PhaseOneScreenplayDraftElement[];
};

export type RevisionSnapshotScene = {
  id: string;
  blockNumber: number;
  order: number;
  title: string;
  sceneType: SceneType;
  purpose: string;
  entryCondition: string;
  exitCondition: string;
  objective: string;
  opposition: string;
  action: string;
  reversal: string;
  outcome: string;
  charactersEntering: string[];
  charactersLeaving: string[];
  estimatedSeconds: number;
  pageEstimate: number;
  threadIds: string[];
  miniBlockIds: string[];
  shortScenes: ShortScene[];
};

export type RevisionSnapshotPayload = {
  projectTitle: string;
  story: PlotPickleProject["story"];
  blocks: Array<{
    id: string;
    number: number;
    title: string;
    summary: string;
    goal: string;
    conflict: string;
    choice: string;
    action: string;
    consequence: string;
  }>;
  scenes: RevisionSnapshotScene[];
  screenplayElements: PhaseOneScreenplayDraftElement[];
  characterArcs: Array<{ characterId: string; name: string; arcMatrix: CharacterArcMatrix }>;
  storyThreads: StoryThread[];
  review: ReviewWorkspace;
  production: PlotPickleProject["production"];
  collaboration: PlotPickleProject["collaboration"];
};

export type RevisionSnapshot = {
  id: string;
  label: string;
  notes: string;
  createdAt: string;
  schemaVersion: typeof PHASE_ONE_SCHEMA_VERSION;
  contentHash: string;
  payload: RevisionSnapshotPayload;
};

export type RevisionComparison = {
  leftSnapshotId: string;
  rightSnapshotId: string;
  changedStoryFields: string[];
  changedBlockIds: string[];
  addedSceneIds: string[];
  removedSceneIds: string[];
  changedSceneIds: string[];
  addedScreenplayElementIds: string[];
  removedScreenplayElementIds: string[];
  changedScreenplayElementIds: string[];
  changedCharacterIds: string[];
  changedThreadIds: string[];
  summary: string;
};

export type PhaseOneProject = Omit<PlotPickleProject, "schemaVersion" | "screenplay" | "characters" | "blocks" | "storyThreads" | "rights" | "revisions"> & {
  schemaVersion: typeof PHASE_ONE_SCHEMA_VERSION;
  screenplay: PhaseOneScreenplayDocument;
  characters: PhaseOneCharacter[];
  blocks: PhaseOneStoryBlock[];
  storyThreads: StoryThread[];
  rights: RightsAndProvenance;
  revisions: RevisionSnapshot[];
};

const expandedElementTypes: ExpandedScreenplayDraftElementType[] = [
  "scene-heading", "action", "character", "parenthetical", "dialogue", "transition", "section", "synopsis",
  "shot", "lyrics", "dual-dialogue", "centered", "page-break", "title-page", "note", "boneyard",
];

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function timestamp() {
  return new Date().toISOString();
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function clampBlockNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(Number(value))) return null;
  return Math.min(24, Math.max(1, Math.round(Number(value))));
}

function createBlankArcMatrix(character: Character): CharacterArcMatrix {
  return {
    startingState: character.description || "",
    consciousWant: character.want || "",
    underlyingNeed: character.need || "",
    protectiveLie: character.ghost || "",
    emergingTruth: character.arc || "",
    midpointShift: "",
    crisisChoice: "",
    climaxChoice: "",
    endingState: "",
    relationshipImpact: "",
    checkpoints: [],
  };
}

export function createBlankRightsAndProvenance(projectTitle = "Untitled Story"): RightsAndProvenance {
  const year = new Date().getFullYear();
  return {
    projectOwner: "",
    copyrightNotice: `Copyright ${year}. All rights reserved by the project owner.`,
    rightsStatement: `The writer retains the rights they hold in ${projectTitle} and its original creative material.`,
    defaultCreativeLicence: "All rights reserved",
    sourceWorkTitle: "",
    sourceWorkAuthor: "",
    adaptationStatus: "original",
    collaborators: [],
    attributions: [],
    aiProvenance: [],
  };
}

function enrichScene(scene: StoryScene, order: number): PhaseOneStoryScene {
  const candidate = scene as Partial<PhaseOneStoryScene>;
  return {
    ...scene,
    number: order + 1,
    order,
    threadIds: Array.isArray(candidate.threadIds) ? candidate.threadIds.filter((id): id is string => typeof id === "string") : [],
    status: ["outline", "draft", "revised", "locked", "omitted"].includes(candidate.status ?? "")
      ? candidate.status as PhaseOneStoryScene["status"]
      : "outline",
    revisionColour: candidate.revisionColour ?? "none",
    locked: Boolean(candidate.locked),
    miniBlocks: clone(scene.miniBlocks),
  };
}

function enrichElement(element: ScreenplayDraftElement): PhaseOneScreenplayDraftElement {
  const candidate = element as Partial<PhaseOneScreenplayDraftElement>;
  return {
    ...element,
    type: expandedElementTypes.includes(candidate.type as ExpandedScreenplayDraftElementType)
      ? candidate.type as ExpandedScreenplayDraftElementType
      : "action",
    sceneId: typeof candidate.sceneId === "string" ? candidate.sceneId : "",
    threadIds: Array.isArray(candidate.threadIds) ? candidate.threadIds.filter((id): id is string => typeof id === "string") : [],
    omitted: Boolean(candidate.omitted),
    locked: Boolean(candidate.locked),
    revisionColour: candidate.revisionColour ?? "none",
    sourceAttributionIds: Array.isArray(candidate.sourceAttributionIds) ? candidate.sourceAttributionIds.filter((id): id is string => typeof id === "string") : [],
    aiProvenanceIds: Array.isArray(candidate.aiProvenanceIds) ? candidate.aiProvenanceIds.filter((id): id is string => typeof id === "string") : [],
  };
}

export function upgradeProjectToPhaseOne(project: PlotPickleProject): PhaseOneProject {
  const base = cloneProject(project);
  return {
    ...base,
    schemaVersion: PHASE_ONE_SCHEMA_VERSION,
    screenplay: { ...base.screenplay, draftElements: base.screenplay.draftElements.map(enrichElement) },
    characters: base.characters.map((character) => ({ ...character, arcMatrix: createBlankArcMatrix(character) })),
    blocks: base.blocks.map((block) => ({ ...block, scenes: block.scenes.map(enrichScene) })),
    storyThreads: [],
    rights: createBlankRightsAndProvenance(base.metadata.title),
    revisions: [],
  };
}

export function isPhaseOneProject(value: unknown): value is PhaseOneProject {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<PhaseOneProject>;
  return candidate.schemaVersion === PHASE_ONE_SCHEMA_VERSION
    && Array.isArray(candidate.blocks)
    && candidate.blocks.length === 24
    && candidate.blocks.every((block) => Array.isArray(block.scenes) && block.scenes.length >= 1)
    && Array.isArray(candidate.storyThreads)
    && Boolean(candidate.rights)
    && Array.isArray(candidate.revisions)
    && Boolean(candidate.production);
}

function enrichScenes(scenes: StoryScene[]): PhaseOneStoryScene[] {
  return scenes.map((scene, index) => enrichScene(scene, index));
}

export function addSceneToBlock(block: PhaseOneStoryBlock, afterSceneId?: string): PhaseOneStoryBlock {
  return { ...block, scenes: enrichScenes(addDynamicScene(block.scenes, block.number, afterSceneId)) };
}

export function duplicateSceneInBlock(block: PhaseOneStoryBlock, sceneId: string): PhaseOneStoryBlock {
  return { ...block, scenes: enrichScenes(duplicateDynamicScene(block.scenes, sceneId, block.number)) };
}

export function removeSceneFromBlock(block: PhaseOneStoryBlock, sceneId: string): PhaseOneStoryBlock {
  const index = block.scenes.findIndex((scene) => scene.id === sceneId);
  if (index < 0 || block.scenes.length <= 1 || block.scenes[index].locked) return block; // locked scene cannot be removed
  return { ...block, scenes: enrichScenes(removeDynamicScene(block.scenes, sceneId)) };
}

export function moveSceneInBlock(block: PhaseOneStoryBlock, sceneId: string, direction: "up" | "down"): PhaseOneStoryBlock {
  const selected = block.scenes.find((scene) => scene.id === sceneId);
  if (!selected || selected.locked) return block;
  return { ...block, scenes: enrichScenes(moveDynamicScene(block.scenes, sceneId, direction)) };
}

export function reorderScenesInBlock(block: PhaseOneStoryBlock, orderedSceneIds: string[]): PhaseOneStoryBlock {
  const current = new Map(block.scenes.map((scene) => [scene.id, scene]));
  const ordered = orderedSceneIds.flatMap((id) => current.has(id) ? [current.get(id) as PhaseOneStoryScene] : []);
  const missing = block.scenes.filter((scene) => !orderedSceneIds.includes(scene.id));
  if (ordered.length === 0) return block;
  return { ...block, scenes: enrichScenes([...ordered, ...missing]) };
}

export function assignMiniBlockToScene(block: PhaseOneStoryBlock, miniBlockId: string, targetSceneId: string): PhaseOneStoryBlock {
  return { ...block, scenes: enrichScenes(assignMiniBlock(block.scenes, miniBlockId, targetSceneId)) };
}

export function moveSceneToBlock(project: PhaseOneProject, sceneId: string, targetBlockNumber: number, afterSceneId?: string): PhaseOneProject {
  const blocks = moveBetweenBlocks(project.blocks, sceneId, targetBlockNumber, afterSceneId);
  return { ...project, blocks: blocks.map((block) => ({ ...block, scenes: enrichScenes(block.scenes) })) };
}

export function createStoryThread(input: Partial<StoryThread> = {}): StoryThread {
  const now = timestamp();
  return {
    id: input.id || makeId("thread"),
    name: input.name || "New Story Thread",
    kind: input.kind || "subplot",
    status: input.status || "planned",
    summary: input.summary || "",
    question: input.question || "",
    characterIds: Array.isArray(input.characterIds) ? [...new Set(input.characterIds)] : [],
    sceneIds: Array.isArray(input.sceneIds) ? [...new Set(input.sceneIds)] : [],
    introducedBlockNumber: clampBlockNumber(input.introducedBlockNumber),
    resolvedBlockNumber: clampBlockNumber(input.resolvedBlockNumber),
    milestones: Array.isArray(input.milestones) ? clone(input.milestones) : [],
    notes: input.notes || "",
    createdAt: input.createdAt || now,
    updatedAt: input.updatedAt || now,
  };
}

export function addStoryThread(project: PhaseOneProject, input: Partial<StoryThread> = {}): PhaseOneProject {
  return { ...project, storyThreads: [...project.storyThreads, createStoryThread(input)] };
}

export function linkStoryThreadToScene(project: PhaseOneProject, threadId: string, sceneId: string): PhaseOneProject {
  if (!project.storyThreads.some((item) => item.id === threadId)) return project;
  const now = timestamp();
  return {
    ...project,
    storyThreads: project.storyThreads.map((thread) => thread.id === threadId
      ? { ...thread, sceneIds: [...new Set([...thread.sceneIds, sceneId])], updatedAt: now }
      : thread),
    blocks: project.blocks.map((block) => ({
      ...block,
      scenes: block.scenes.map((scene) => scene.id === sceneId
        ? { ...scene, threadIds: [...new Set([...scene.threadIds, threadId])] }
        : scene),
    })),
  };
}

export function addThreadMilestone(
  project: PhaseOneProject,
  threadId: string,
  sceneId: string,
  kind: StoryThreadMilestoneKind,
  summary = "",
): PhaseOneProject {
  const block = project.blocks.find((candidate) => candidate.scenes.some((scene) => scene.id === sceneId));
  if (!block) return project;
  const milestone: StoryThreadMilestone = {
    id: makeId("thread-milestone"),
    sceneId,
    blockNumber: block.number,
    kind,
    summary,
    resolved: kind === "resolution",
  };
  const linked = linkStoryThreadToScene(project, threadId, sceneId);
  return {
    ...linked,
    storyThreads: linked.storyThreads.map((thread) => thread.id === threadId
      ? {
          ...thread,
          status: kind === "resolution" ? "resolved" : "active",
          introducedBlockNumber: thread.introducedBlockNumber ?? block.number,
          resolvedBlockNumber: kind === "resolution" ? block.number : thread.resolvedBlockNumber,
          milestones: [...thread.milestones, milestone],
          updatedAt: timestamp(),
        }
      : thread),
  };
}

export function upsertCharacterArcCheckpoint(
  project: PhaseOneProject,
  characterId: string,
  checkpoint: Omit<CharacterArcCheckpoint, "id"> & { id?: string },
): PhaseOneProject {
  return {
    ...project,
    characters: project.characters.map((character) => {
      if (character.id !== characterId) return character;
      const id = checkpoint.id || makeId("arc-checkpoint");
      const nextCheckpoint: CharacterArcCheckpoint = { ...checkpoint, id, blockNumber: clampBlockNumber(checkpoint.blockNumber) };
      const exists = character.arcMatrix.checkpoints.some((item) => item.id === id);
      return {
        ...character,
        arcMatrix: {
          ...character.arcMatrix,
          checkpoints: exists
            ? character.arcMatrix.checkpoints.map((item) => item.id === id ? nextCheckpoint : item)
            : [...character.arcMatrix.checkpoints, nextCheckpoint],
        },
      };
    }),
  };
}

export function addSourceAttribution(project: PhaseOneProject, input: Omit<SourceAttribution, "id" | "createdAt">): PhaseOneProject {
  const record: SourceAttribution = { ...input, id: makeId("attribution"), createdAt: timestamp() };
  return { ...project, rights: { ...project.rights, attributions: [...project.rights.attributions, record] } };
}

export function addAiProvenance(project: PhaseOneProject, input: Omit<AiProvenanceRecord, "id" | "createdAt">): PhaseOneProject {
  const record: AiProvenanceRecord = { ...input, id: makeId("ai-provenance"), createdAt: timestamp() };
  return { ...project, rights: { ...project.rights, aiProvenance: [...project.rights.aiProvenance, record] } };
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value);
}

function contentHash(value: unknown) {
  const source = stableStringify(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

export function captureRevisionPayload(project: PhaseOneProject): RevisionSnapshotPayload {
  return clone({
    projectTitle: project.metadata.title,
    story: project.story,
    blocks: project.blocks.map((block) => ({
      id: block.id,
      number: block.number,
      title: block.title,
      summary: block.summary,
      goal: block.goal,
      conflict: block.conflict,
      choice: block.choice,
      action: block.action,
      consequence: block.consequence,
    })),
    scenes: project.blocks.flatMap((block) => block.scenes.map((scene) => ({
      id: scene.id,
      blockNumber: block.number,
      order: scene.order,
      title: scene.title,
      sceneType: scene.sceneType,
      purpose: scene.purpose,
      entryCondition: scene.entryCondition,
      exitCondition: scene.exitCondition,
      objective: scene.objective,
      opposition: scene.opposition,
      action: scene.action,
      reversal: scene.reversal,
      outcome: scene.outcome,
      charactersEntering: scene.charactersEntering,
      charactersLeaving: scene.charactersLeaving,
      estimatedSeconds: scene.estimatedSeconds,
      pageEstimate: scene.pageEstimate,
      threadIds: scene.threadIds,
      miniBlockIds: scene.miniBlocks.map((mini) => mini.id),
      shortScenes: scene.miniBlocks.flatMap((mini) => mini.shortScenes),
    }))),
    screenplayElements: project.screenplay.draftElements,
    characterArcs: project.characters.map((character) => ({ characterId: character.id, name: character.name, arcMatrix: character.arcMatrix })),
    storyThreads: project.storyThreads,
    review: project.review,
    production: project.production,
    collaboration: project.collaboration,
  });
}

export function createRevisionSnapshot(project: PhaseOneProject, label: string, notes = ""): PhaseOneProject {
  const payload = captureRevisionPayload(project);
  const snapshot: RevisionSnapshot = {
    id: makeId("revision"),
    label: label.trim() || `Revision ${project.revisions.length + 1}`,
    notes,
    createdAt: timestamp(),
    schemaVersion: PHASE_ONE_SCHEMA_VERSION,
    contentHash: contentHash(payload),
    payload,
  };
  return { ...project, revisions: [...project.revisions, snapshot] };
}

function idsChanged<T extends { id: string }>(left: T[], right: T[]) {
  const leftMap = new Map(left.map((item) => [item.id, item]));
  const rightMap = new Map(right.map((item) => [item.id, item]));
  const added = right.filter((item) => !leftMap.has(item.id)).map((item) => item.id);
  const removed = left.filter((item) => !rightMap.has(item.id)).map((item) => item.id);
  const changed = right
    .filter((item) => leftMap.has(item.id) && stableStringify(leftMap.get(item.id)) !== stableStringify(item))
    .map((item) => item.id);
  return { added, removed, changed };
}

export function compareRevisionSnapshots(left: RevisionSnapshot, right: RevisionSnapshot): RevisionComparison {
  const storyFields = Object.keys(right.payload.story).filter((key) => {
    const leftValue = left.payload.story[key as keyof PlotPickleProject["story"]];
    const rightValue = right.payload.story[key as keyof PlotPickleProject["story"]];
    return leftValue !== rightValue;
  });
  const blocks = idsChanged(left.payload.blocks, right.payload.blocks);
  const scenes = idsChanged(left.payload.scenes, right.payload.scenes);
  const elements = idsChanged(left.payload.screenplayElements, right.payload.screenplayElements);
  const leftCharacters = left.payload.characterArcs.map((item) => ({ id: item.characterId, ...item }));
  const rightCharacters = right.payload.characterArcs.map((item) => ({ id: item.characterId, ...item }));
  const characters = idsChanged(leftCharacters, rightCharacters);
  const threads = idsChanged(left.payload.storyThreads, right.payload.storyThreads);
  const totalChanges = storyFields.length + blocks.changed.length + scenes.added.length + scenes.removed.length
    + scenes.changed.length + elements.added.length + elements.removed.length + elements.changed.length
    + characters.changed.length + threads.added.length + threads.removed.length + threads.changed.length;

  return {
    leftSnapshotId: left.id,
    rightSnapshotId: right.id,
    changedStoryFields: storyFields,
    changedBlockIds: [...new Set([...blocks.added, ...blocks.removed, ...blocks.changed])],
    addedSceneIds: scenes.added,
    removedSceneIds: scenes.removed,
    changedSceneIds: scenes.changed,
    addedScreenplayElementIds: elements.added,
    removedScreenplayElementIds: elements.removed,
    changedScreenplayElementIds: elements.changed,
    changedCharacterIds: [...new Set([...characters.added, ...characters.removed, ...characters.changed])],
    changedThreadIds: [...new Set([...threads.added, ...threads.removed, ...threads.changed])],
    summary: totalChanges === 0
      ? "No material differences were found between these snapshots."
      : `${totalChanges} tracked changes across story, blocks, scenes, screenplay, character arcs, and story threads.`,
  };
}

export function phaseOneCoverage(project: PhaseOneProject) {
  const sceneCount = project.blocks.reduce((sum, block) => sum + block.scenes.length, 0);
  const shortSceneCount = project.blocks.flatMap((block) => block.scenes).flatMap((scene) => scene.miniBlocks)
    .reduce((sum, mini) => sum + mini.shortScenes.length, 0);
  const linkedThreadCount = project.storyThreads.filter((thread) => thread.sceneIds.length > 0).length;
  const arcCheckpointCount = project.characters.reduce((sum, character) => sum + character.arcMatrix.checkpoints.length, 0);
  return {
    sceneCount,
    shortSceneCount,
    storyThreadCount: project.storyThreads.length,
    linkedThreadCount,
    arcCheckpointCount,
    attributionCount: project.rights.attributions.length,
    aiProvenanceCount: project.rights.aiProvenance.length,
    revisionCount: project.revisions.length,
  };
}

export type { MiniBlock, SceneType, ShortScene, StoryScene };
