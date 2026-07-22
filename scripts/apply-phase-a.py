from __future__ import annotations

from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(path: str, old: str, new: str) -> None:
    source = read(path)
    count = source.count(old)
    if count != 1:
        raise RuntimeError(f"Expected exactly one match in {path}, found {count}: {old[:120]!r}")
    write(path, source.replace(old, new, 1))


# ---------------------------------------------------------------------------
# Canonical project model: schema 1.7 is now the live application model.
# ---------------------------------------------------------------------------
replace_once(
    "lib/project.ts",
    '''export type ScreenplayDraftElementType =
  | "scene-heading"
  | "action"
  | "character"
  | "parenthetical"
  | "dialogue"
  | "transition";''',
    '''export type ScreenplayDraftElementType =
  | "scene-heading"
  | "action"
  | "character"
  | "parenthetical"
  | "dialogue"
  | "transition"
  | "section"
  | "synopsis"
  | "shot"
  | "lyrics"
  | "dual-dialogue"
  | "centered"
  | "page-break"
  | "title-page"
  | "note"
  | "boneyard";''',
)

replace_once(
    "lib/project.ts",
    '''export type ScreenplayDraftElement = {
  id: string;
  type: ScreenplayDraftElementType;
  text: string;
  blockNumber: number;
  miniBlockNumber: number;
  sceneNumber: number;
  sceneId?: string;
  createdAt: string;
  updatedAt: string;
};''',
    '''export type RevisionColour = "none" | "blue" | "pink" | "yellow" | "green" | "goldenrod" | "buff" | "salmon" | "cherry" | "tan" | "gray";

export type ScreenplayDraftElement = {
  id: string;
  type: ScreenplayDraftElementType;
  text: string;
  blockNumber: number;
  miniBlockNumber: number;
  sceneNumber: number;
  sceneId?: string;
  threadIds: string[];
  omitted: boolean;
  locked: boolean;
  revisionColour: RevisionColour;
  sourceAttributionIds: string[];
  aiProvenanceIds: string[];
  createdAt: string;
  updatedAt: string;
};''',
)

replace_once(
    "lib/project.ts",
    '''export type Character = {
  id: string;''',
    '''export type ArcCheckpointKind = "opening" | "catalyst" | "threshold" | "midpoint" | "crisis" | "climax" | "ending" | "custom";

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

export type Character = {
  id: string;''',
)

replace_once(
    "lib/project.ts",
    '''  image: string;
  relationships: Relationship[];
};''',
    '''  arcMatrix: CharacterArcMatrix;
  image: string;
  relationships: Relationship[];
};''',
)

replace_once(
    "lib/project.ts",
    '''export type ProjectDevelopment = {''',
    '''export type StoryThreadKind = "main" | "subplot" | "relationship" | "mystery" | "theme" | "world";
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

export type RevisionSnapshot = {
  id: string;
  label: string;
  notes: string;
  createdAt: string;
  schemaVersion: "1.7.0";
  contentHash: string;
  payload: Record<string, unknown>;
};

export type ProjectDevelopment = {''',
)

replace_once(
    "lib/project.ts",
    '''export type PlotPickleProject = {
  schemaVersion: "1.6.0";''',
    '''export type PlotPickleProject = {
  schemaVersion: "1.7.0";''',
)

replace_once(
    "lib/project.ts",
    '''  characters: Character[];
  blocks: StoryBlock[];
};''',
    '''  characters: Character[];
  blocks: StoryBlock[];
  storyThreads: StoryThread[];
  rights: RightsAndProvenance;
  revisions: RevisionSnapshot[];
};''',
)

replace_once(
    "lib/project.ts",
    '''export function createBlankDevelopment(): ProjectDevelopment {''',
    '''export function createBlankArcMatrix(character: Partial<Character> = {}): CharacterArcMatrix {
  return {
    startingState: typeof character.description === "string" ? character.description : "",
    consciousWant: typeof character.want === "string" ? character.want : "",
    underlyingNeed: typeof character.need === "string" ? character.need : "",
    protectiveLie: typeof character.ghost === "string" ? character.ghost : "",
    emergingTruth: typeof character.arc === "string" ? character.arc : "",
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

export function createBlankDevelopment(): ProjectDevelopment {''',
)

replace_once("lib/project.ts", '    schemaVersion: "1.6.0",', '    schemaVersion: "1.7.0",')

replace_once(
    "lib/project.ts",
    '''      visuals: createDefaultStoryboardFrames(index + 1),
    })),
  };
}''',
    '''      visuals: createDefaultStoryboardFrames(index + 1),
    })),
    storyThreads: [],
    rights: createBlankRightsAndProvenance("Untitled Story"),
    revisions: [],
  };
}''',
)

replace_once(
    "lib/project.ts",
    '''    candidate.schemaVersion === "1.6.0" &&''',
    '''    candidate.schemaVersion === "1.7.0" &&''',
)

replace_once(
    "lib/project.ts",
    '''    Array.isArray(candidate.blocks) &&
    candidate.blocks.length === 24 &&''',
    '''    Array.isArray(candidate.blocks) &&
    candidate.blocks.length === 24 &&
    Array.isArray(candidate.storyThreads) &&
    Boolean(candidate.rights) &&
    Array.isArray(candidate.revisions) &&''',
)

replace_once(
    "lib/project.ts",
    '''          const types: ScreenplayDraftElementType[] = ["scene-heading", "action", "character", "parenthetical", "dialogue", "transition"];''',
    '''          const types: ScreenplayDraftElementType[] = ["scene-heading", "action", "character", "parenthetical", "dialogue", "transition", "section", "synopsis", "shot", "lyrics", "dual-dialogue", "centered", "page-break", "title-page", "note", "boneyard"];''',
)

replace_once(
    "lib/project.ts",
    '''            sceneId: typeof draft.sceneId === "string" ? draft.sceneId : "",
            createdAt: typeof draft.createdAt === "string" ? draft.createdAt : now,''',
    '''            sceneId: typeof draft.sceneId === "string" ? draft.sceneId : "",
            threadIds: Array.isArray(draft.threadIds) ? draft.threadIds.filter((item): item is string => typeof item === "string") : [],
            omitted: Boolean(draft.omitted),
            locked: Boolean(draft.locked),
            revisionColour: (["none", "blue", "pink", "yellow", "green", "goldenrod", "buff", "salmon", "cherry", "tan", "gray"] as RevisionColour[]).includes(draft.revisionColour as RevisionColour) ? draft.revisionColour as RevisionColour : "none",
            sourceAttributionIds: Array.isArray(draft.sourceAttributionIds) ? draft.sourceAttributionIds.filter((item): item is string => typeof item === "string") : [],
            aiProvenanceIds: Array.isArray(draft.aiProvenanceIds) ? draft.aiProvenanceIds.filter((item): item is string => typeof item === "string") : [],
            createdAt: typeof draft.createdAt === "string" ? draft.createdAt : now,''',
)

replace_once(
    "lib/project.ts",
    '''export function normalizePlotPickleProject(value: unknown): PlotPickleProject | null {''',
    '''function stringArray(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string"))] : [];
}

function normalizeArcMatrix(value: unknown, character: Partial<Character>): CharacterArcMatrix {
  const defaults = createBlankArcMatrix(character);
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<CharacterArcMatrix>;
  const checkpointKinds: ArcCheckpointKind[] = ["opening", "catalyst", "threshold", "midpoint", "crisis", "climax", "ending", "custom"];
  return {
    ...defaults,
    ...candidate,
    checkpoints: Array.isArray(candidate.checkpoints) ? candidate.checkpoints.flatMap((item, index) => {
      if (!item || typeof item !== "object") return [];
      const checkpoint = item as Partial<CharacterArcCheckpoint>;
      return [{
        id: typeof checkpoint.id === "string" && checkpoint.id ? checkpoint.id : `arc-checkpoint-${index + 1}`,
        kind: checkpointKinds.includes(checkpoint.kind as ArcCheckpointKind) ? checkpoint.kind as ArcCheckpointKind : "custom",
        blockNumber: checkpoint.blockNumber === null ? null : Math.min(24, Math.max(1, Number(checkpoint.blockNumber) || 1)),
        sceneId: typeof checkpoint.sceneId === "string" ? checkpoint.sceneId : "",
        belief: typeof checkpoint.belief === "string" ? checkpoint.belief : "",
        strategy: typeof checkpoint.strategy === "string" ? checkpoint.strategy : "",
        pressure: typeof checkpoint.pressure === "string" ? checkpoint.pressure : "",
        choice: typeof checkpoint.choice === "string" ? checkpoint.choice : "",
        consequence: typeof checkpoint.consequence === "string" ? checkpoint.consequence : "",
        evidence: typeof checkpoint.evidence === "string" ? checkpoint.evidence : "",
      }];
    }) : [],
  };
}

function normalizeStoryThreads(value: unknown): StoryThread[] {
  if (!Array.isArray(value)) return [];
  const kinds: StoryThreadKind[] = ["main", "subplot", "relationship", "mystery", "theme", "world"];
  const statuses: StoryThreadStatus[] = ["planned", "active", "paused", "resolved", "abandoned"];
  const milestoneKinds: StoryThreadMilestoneKind[] = ["setup", "development", "turn", "reveal", "payoff", "resolution"];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const thread = item as Partial<StoryThread>;
    const now = new Date().toISOString();
    return [{
      id: typeof thread.id === "string" && thread.id ? thread.id : `thread-${index + 1}`,
      name: typeof thread.name === "string" ? thread.name : `Story Thread ${index + 1}`,
      kind: kinds.includes(thread.kind as StoryThreadKind) ? thread.kind as StoryThreadKind : "subplot",
      status: statuses.includes(thread.status as StoryThreadStatus) ? thread.status as StoryThreadStatus : "planned",
      summary: typeof thread.summary === "string" ? thread.summary : "",
      question: typeof thread.question === "string" ? thread.question : "",
      characterIds: stringArray(thread.characterIds),
      sceneIds: stringArray(thread.sceneIds),
      introducedBlockNumber: thread.introducedBlockNumber === null || thread.introducedBlockNumber === undefined ? null : Math.min(24, Math.max(1, Number(thread.introducedBlockNumber) || 1)),
      resolvedBlockNumber: thread.resolvedBlockNumber === null || thread.resolvedBlockNumber === undefined ? null : Math.min(24, Math.max(1, Number(thread.resolvedBlockNumber) || 1)),
      milestones: Array.isArray(thread.milestones) ? thread.milestones.flatMap((entry, milestoneIndex) => {
        if (!entry || typeof entry !== "object") return [];
        const milestone = entry as Partial<StoryThreadMilestone>;
        return [{
          id: typeof milestone.id === "string" && milestone.id ? milestone.id : `thread-milestone-${index + 1}-${milestoneIndex + 1}`,
          sceneId: typeof milestone.sceneId === "string" ? milestone.sceneId : "",
          blockNumber: Math.min(24, Math.max(1, Number(milestone.blockNumber) || 1)),
          kind: milestoneKinds.includes(milestone.kind as StoryThreadMilestoneKind) ? milestone.kind as StoryThreadMilestoneKind : "development",
          summary: typeof milestone.summary === "string" ? milestone.summary : "",
          resolved: Boolean(milestone.resolved),
        }];
      }) : [],
      notes: typeof thread.notes === "string" ? thread.notes : "",
      createdAt: typeof thread.createdAt === "string" ? thread.createdAt : now,
      updatedAt: typeof thread.updatedAt === "string" ? thread.updatedAt : now,
    }];
  });
}

function normalizeRights(value: unknown, projectTitle: string): RightsAndProvenance {
  const defaults = createBlankRightsAndProvenance(projectTitle);
  if (!value || typeof value !== "object") return defaults;
  const candidate = value as Partial<RightsAndProvenance>;
  const adaptations: RightsAndProvenance["adaptationStatus"][] = ["original", "adaptation", "commissioned", "collaboration", "unknown"];
  return {
    ...defaults,
    ...candidate,
    adaptationStatus: adaptations.includes(candidate.adaptationStatus as RightsAndProvenance["adaptationStatus"]) ? candidate.adaptationStatus as RightsAndProvenance["adaptationStatus"] : "unknown",
    collaborators: Array.isArray(candidate.collaborators) ? candidate.collaborators.filter((item): item is RightsCollaborator => Boolean(item && typeof item === "object")) : [],
    attributions: Array.isArray(candidate.attributions) ? candidate.attributions.filter((item): item is SourceAttribution => Boolean(item && typeof item === "object")) : [],
    aiProvenance: Array.isArray(candidate.aiProvenance) ? candidate.aiProvenance.filter((item): item is AiProvenanceRecord => Boolean(item && typeof item === "object")) : [],
  };
}

function normalizeRevisions(value: unknown): RevisionSnapshot[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item, index) => {
    if (!item || typeof item !== "object") return [];
    const revision = item as Partial<RevisionSnapshot>;
    return [{
      id: typeof revision.id === "string" && revision.id ? revision.id : `revision-${index + 1}`,
      label: typeof revision.label === "string" ? revision.label : `Revision ${index + 1}`,
      notes: typeof revision.notes === "string" ? revision.notes : "",
      createdAt: typeof revision.createdAt === "string" ? revision.createdAt : new Date().toISOString(),
      schemaVersion: "1.7.0",
      contentHash: typeof revision.contentHash === "string" ? revision.contentHash : "",
      payload: revision.payload && typeof revision.payload === "object" ? revision.payload as Record<string, unknown> : {},
    }];
  });
}

export function normalizePlotPickleProject(value: unknown): PlotPickleProject | null {''',
)

replace_once(
    "lib/project.ts",
    '''    blocks?: Array<Partial<StoryBlock>>;
  };''',
    '''    blocks?: Array<Partial<StoryBlock>>;
    storyThreads?: StoryThread[];
    rights?: RightsAndProvenance;
    revisions?: RevisionSnapshot[];
  };''',
)

replace_once(
    "lib/project.ts",
    '''    !["1.0.0", "1.1.0", "1.2.0", "1.3.0", "1.4.0", "1.5.0", "1.6.0"].includes(candidate.schemaVersion ?? "") ||''',
    '''    !["1.0.0", "1.1.0", "1.2.0", "1.3.0", "1.4.0", "1.5.0", "1.6.0", "1.7.0"].includes(candidate.schemaVersion ?? "") ||''',
)

replace_once("lib/project.ts", '    schemaVersion: "1.6.0",\n    id: candidate.id,', '    schemaVersion: "1.7.0",\n    id: candidate.id,')

replace_once(
    "lib/project.ts",
    '''    characters: candidate.characters.map((character) => ({ ...voiceprintDefaults, ...character })),''',
    '''    characters: candidate.characters.map((character) => ({ ...voiceprintDefaults, ...character, arcMatrix: normalizeArcMatrix(character.arcMatrix, character) })),''',
)

replace_once(
    "lib/project.ts",
    '''      visuals: normalizeStoryboardFrames(block.visuals, index + 1),
    })),
  };
}''',
    '''      visuals: normalizeStoryboardFrames(block.visuals, index + 1),
    })),
    storyThreads: normalizeStoryThreads(candidate.storyThreads),
    rights: normalizeRights(candidate.rights, candidate.metadata.title),
    revisions: normalizeRevisions(candidate.revisions),
  };
}''',
)

replace_once(
    "lib/project.ts",
    '''    ...createBlankVoiceprint(),
    image: "",''',
    '''    ...createBlankVoiceprint(),
    arcMatrix: createBlankArcMatrix(),
    image: "",''',
)

# Dynamic scenes carry thread and revision metadata in the canonical model.
replace_once(
    "lib/structure.ts",
    '''  pageEstimate: number;
  miniBlocks: MiniBlock[];
};''',
    '''  pageEstimate: number;
  order: number;
  threadIds: string[];
  status: "outline" | "draft" | "revised" | "locked" | "omitted";
  revisionColour: "none" | "blue" | "pink" | "yellow" | "green" | "goldenrod" | "buff" | "salmon" | "cherry" | "tan" | "gray";
  locked: boolean;
  miniBlocks: MiniBlock[];
};''',
)

replace_once(
    "lib/structure.ts",
    '''    pageEstimate: estimatedSeconds / 60,
    miniBlocks: [],''',
    '''    pageEstimate: estimatedSeconds / 60,
    order: number - 1,
    threadIds: [],
    status: "outline",
    revisionColour: "none",
    locked: false,
    miniBlocks: [],''',
)

replace_once(
    "lib/structure.ts",
    '''    pageEstimate: Math.max(0, Number(value.pageEstimate) || estimatedSeconds / 60),
    miniBlocks: [],''',
    '''    pageEstimate: Math.max(0, Number(value.pageEstimate) || estimatedSeconds / 60),
    order: index,
    threadIds: strings(value.threadIds),
    status: (["outline", "draft", "revised", "locked", "omitted"] as StoryScene["status"][]).includes(value.status as StoryScene["status"]) ? value.status as StoryScene["status"] : "outline",
    revisionColour: (["none", "blue", "pink", "yellow", "green", "goldenrod", "buff", "salmon", "cherry", "tan", "gray"] as StoryScene["revisionColour"][]).includes(value.revisionColour as StoryScene["revisionColour"]) ? value.revisionColour as StoryScene["revisionColour"] : "none",
    locked: Boolean(value.locked),
    miniBlocks: [],''',
)

# Afterglow is upgraded at construction time and serves as the migration regression project.
replace_once(
    "data/afterglow.ts",
    '''import { createBlankProject, type Character, type PlotPickleProject } from "@/lib/project";''',
    '''import { createBlankArcMatrix, createBlankProject, type Character, type PlotPickleProject } from "@/lib/project";''',
)
replace_once("data/afterglow.ts", "const afterglowCharacters: Character[] = [", 'const afterglowCharacters: Array<Omit<Character, "arcMatrix">> = [')
replace_once(
    "data/afterglow.ts",
    '''    characters: afterglowCharacters,''',
    '''    characters: afterglowCharacters.map((character) => ({ ...character, arcMatrix: createBlankArcMatrix(character) })),''',
)

# Expanded screenplay creation and export.
replace_once(
    "lib/screenplay-draft.ts",
    '''const editableTypes: ScreenplayDraftElementType[] = [
  "scene-heading",
  "action",
  "character",
  "parenthetical",
  "dialogue",
  "transition",
];''',
    '''const editableTypes: ScreenplayDraftElementType[] = [
  "scene-heading", "action", "character", "parenthetical", "dialogue", "transition",
  "section", "synopsis", "shot", "lyrics", "dual-dialogue", "centered", "page-break", "title-page", "note", "boneyard",
];''',
)

replace_once(
    "lib/screenplay-draft.ts",
    '''  return { id: id(), type, text, blockNumber, miniBlockNumber, sceneNumber, sceneId, createdAt: now, updatedAt: now };''',
    '''  return { id: id(), type, text, blockNumber, miniBlockNumber, sceneNumber, sceneId, threadIds: [], omitted: false, locked: false, revisionColour: "none", sourceAttributionIds: [], aiProvenanceIds: [], createdAt: now, updatedAt: now };''',
)

replace_once(
    "lib/screenplay-draft.ts",
    '''  if (element.type === "action") return `!${text}`;
  return text;''',
    '''  if (element.omitted || element.type === "boneyard") return `/* ${text} */`;
  if (element.type === "action") return `!${text}`;
  if (element.type === "section") return `# ${text}`;
  if (element.type === "synopsis") return `= ${text}`;
  if (element.type === "shot") return `!! ${text.toUpperCase()}`;
  if (element.type === "lyrics") return text.split("\\n").map((line) => `~${line}`).join("\\n");
  if (element.type === "dual-dialogue") return `${text} ^`;
  if (element.type === "centered") return `>${text}<`;
  if (element.type === "page-break") return "===";
  if (element.type === "title-page") return `Title: ${text}`;
  if (element.type === "note") return `[[${text}]]`;
  return text;''',
)

replace_once(
    "lib/screenplay-draft.ts",
    '''  transition: "Transition",
};''',
    '''  transition: "Transition",
  section: "Action",
  synopsis: "Action",
  shot: "Shot",
  lyrics: "Lyrics",
  "dual-dialogue": "Dialogue",
  centered: "Action",
  "page-break": "New Page",
  "title-page": "Action",
  note: "Action",
  boneyard: "Action",
};''',
)

# Core model operations shared by Planner and Settings.
write(
    "lib/core-model.ts",
    '''import { cloneProject, normalizePlotPickleProject, type PlotPickleProject, type RevisionSnapshot, type StoryThread } from "./project";

function id(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ? `${prefix}-${globalThis.crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`).join(",")}}`;
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

export function createStoryThread(project: PlotPickleProject): PlotPickleProject {
  const now = new Date().toISOString();
  const thread: StoryThread = {
    id: id("thread"), name: "New Story Thread", kind: "subplot", status: "planned", summary: "", question: "",
    characterIds: [], sceneIds: [], introducedBlockNumber: null, resolvedBlockNumber: null, milestones: [], notes: "", createdAt: now, updatedAt: now,
  };
  return { ...project, storyThreads: [...project.storyThreads, thread] };
}

export function synchronizeThreadSceneLinks(project: PlotPickleProject): PlotPickleProject {
  const validThreadIds = new Set(project.storyThreads.map((thread) => thread.id));
  const sceneToThreads = new Map<string, string[]>();
  for (const thread of project.storyThreads) {
    for (const sceneId of thread.sceneIds) sceneToThreads.set(sceneId, [...new Set([...(sceneToThreads.get(sceneId) ?? []), thread.id])]);
  }
  return {
    ...project,
    blocks: project.blocks.map((block) => ({
      ...block,
      scenes: block.scenes.map((scene) => ({ ...scene, threadIds: [...new Set([...(scene.threadIds ?? []).filter((threadId) => validThreadIds.has(threadId)), ...(sceneToThreads.get(scene.id) ?? [])])] })),
    })),
  };
}

export function createRevisionSnapshot(project: PlotPickleProject, label: string, notes = ""): PlotPickleProject {
  const payload = cloneProject({ ...project, revisions: [] }) as unknown as Record<string, unknown>;
  const snapshot: RevisionSnapshot = {
    id: id("revision"), label: label.trim() || `Revision ${project.revisions.length + 1}`, notes: notes.trim(),
    createdAt: new Date().toISOString(), schemaVersion: "1.7.0", contentHash: contentHash(payload), payload,
  };
  return { ...project, revisions: [...project.revisions, snapshot] };
}

export function restoreRevisionSnapshot(project: PlotPickleProject, snapshot: RevisionSnapshot): PlotPickleProject {
  const normalized = normalizePlotPickleProject({ ...snapshot.payload, revisions: project.revisions });
  return normalized ?? project;
}

export function compareRevisionSnapshots(left?: RevisionSnapshot, right?: RevisionSnapshot) {
  if (!left || !right) return "Select two revision snapshots to compare.";
  if (left.contentHash === right.contentHash) return "The selected snapshots contain the same canonical project content.";
  const leftPayload = left.payload as Record<string, unknown>;
  const rightPayload = right.payload as Record<string, unknown>;
  const changed = [...new Set([...Object.keys(leftPayload), ...Object.keys(rightPayload)])].filter((key) => stableStringify(leftPayload[key]) !== stableStringify(rightPayload[key]));
  return `Changed project areas: ${changed.join(", ") || "content hash only"}.`;
}
''',
)

# User-facing Phase A studio.
write(
    "app/core-model-studio.tsx",
    '''"use client";

import { useMemo, useState } from "react";
import {
  createBlankArcMatrix,
  type AiProvenanceRecord,
  type CharacterArcCheckpoint,
  type PlotPickleProject,
  type RightsCollaborator,
  type SourceAttribution,
  type StoryThread,
  type StoryThreadMilestone,
} from "@/lib/project";
import { compareRevisionSnapshots, createRevisionSnapshot, createStoryThread, restoreRevisionSnapshot, synchronizeThreadSceneLinks } from "@/lib/core-model";
import styles from "./core-model-studio.module.css";

type Section = "threads" | "arcs" | "rights" | "revisions";
type Props = { project: PlotPickleProject; onChange: (project: PlotPickleProject) => void; compact?: boolean; initialSection?: Section };

const threadKinds: StoryThread["kind"][] = ["main", "subplot", "relationship", "mystery", "theme", "world"];
const threadStatuses: StoryThread["status"][] = ["planned", "active", "paused", "resolved", "abandoned"];
const milestoneKinds: StoryThreadMilestone["kind"][] = ["setup", "development", "turn", "reveal", "payoff", "resolution"];
const checkpointKinds: CharacterArcCheckpoint["kind"][] = ["opening", "catalyst", "threshold", "midpoint", "crisis", "climax", "ending", "custom"];
const sourceTypes: SourceAttribution["sourceType"][] = ["research", "quotation", "adaptation", "public-domain", "licensed-material", "other"];
const aiOperations: AiProvenanceRecord["operation"][] = ["brainstorm", "rewrite", "analysis", "dialogue", "image", "audio", "video", "other"];

function id(prefix: string) {
  return globalThis.crypto?.randomUUID?.() ? `${prefix}-${globalThis.crypto.randomUUID()}` : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function TextField({ label, value, onChange, rows = 3, placeholder = "" }: { label: string; value: string; onChange: (value: string) => void; rows?: number; placeholder?: string }) {
  return <label className={styles.field}><span>{label}</span>{rows === 1 ? <input value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} /> : <textarea rows={rows} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}</label>;
}

export default function CoreModelStudio({ project, onChange, compact = false, initialSection = "threads" }: Props) {
  const [section, setSection] = useState<Section>(initialSection);
  const [threadId, setThreadId] = useState(project.storyThreads[0]?.id ?? "");
  const [characterId, setCharacterId] = useState(project.characters[0]?.id ?? "");
  const [revisionLabel, setRevisionLabel] = useState("");
  const [revisionNotes, setRevisionNotes] = useState("");
  const [leftRevisionId, setLeftRevisionId] = useState(project.revisions[0]?.id ?? "");
  const [rightRevisionId, setRightRevisionId] = useState(project.revisions.at(-1)?.id ?? "");

  const thread = project.storyThreads.find((item) => item.id === threadId) ?? project.storyThreads[0];
  const character = project.characters.find((item) => item.id === characterId) ?? project.characters[0];
  const scenes = useMemo(() => project.blocks.flatMap((block) => block.scenes.map((scene) => ({ ...scene, blockNumber: block.number, blockTitle: block.title }))), [project.blocks]);
  const leftRevision = project.revisions.find((item) => item.id === leftRevisionId);
  const rightRevision = project.revisions.find((item) => item.id === rightRevisionId);

  function save(next: PlotPickleProject) {
    onChange(synchronizeThreadSceneLinks({ ...next, metadata: { ...next.metadata, updatedAt: new Date().toISOString() } }));
  }

  function addThread() {
    const next = createStoryThread(project);
    save(next);
    setThreadId(next.storyThreads.at(-1)?.id ?? "");
  }

  function updateThread(patch: Partial<StoryThread>) {
    if (!thread) return;
    save({ ...project, storyThreads: project.storyThreads.map((item) => item.id === thread.id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item) });
  }

  function toggleThreadReference(kind: "characterIds" | "sceneIds", value: string) {
    if (!thread) return;
    const current = thread[kind];
    updateThread({ [kind]: current.includes(value) ? current.filter((item) => item !== value) : [...current, value] });
  }

  function addMilestone() {
    if (!thread) return;
    const first = scenes[0];
    const milestone: StoryThreadMilestone = { id: id("thread-milestone"), sceneId: first?.id ?? "", blockNumber: first?.blockNumber ?? 1, kind: "development", summary: "", resolved: false };
    updateThread({ milestones: [...thread.milestones, milestone] });
  }

  function updateMilestone(milestoneId: string, patch: Partial<StoryThreadMilestone>) {
    if (!thread) return;
    updateThread({ milestones: thread.milestones.map((item) => item.id === milestoneId ? { ...item, ...patch } : item) });
  }

  function updateArc(key: keyof ReturnType<typeof createBlankArcMatrix>, value: string) {
    if (!character || key === "checkpoints") return;
    const matrix = character.arcMatrix ?? createBlankArcMatrix(character);
    save({ ...project, characters: project.characters.map((item) => item.id === character.id ? { ...item, arcMatrix: { ...matrix, [key]: value } } : item) });
  }

  function addCheckpoint() {
    if (!character) return;
    const matrix = character.arcMatrix ?? createBlankArcMatrix(character);
    const checkpoint: CharacterArcCheckpoint = { id: id("arc-checkpoint"), kind: "custom", blockNumber: 1, sceneId: "", belief: "", strategy: "", pressure: "", choice: "", consequence: "", evidence: "" };
    save({ ...project, characters: project.characters.map((item) => item.id === character.id ? { ...item, arcMatrix: { ...matrix, checkpoints: [...matrix.checkpoints, checkpoint] } } : item) });
  }

  function updateCheckpoint(checkpointId: string, patch: Partial<CharacterArcCheckpoint>) {
    if (!character) return;
    const matrix = character.arcMatrix ?? createBlankArcMatrix(character);
    save({ ...project, characters: project.characters.map((item) => item.id === character.id ? { ...item, arcMatrix: { ...matrix, checkpoints: matrix.checkpoints.map((checkpoint) => checkpoint.id === checkpointId ? { ...checkpoint, ...patch } : checkpoint) } } : item) });
  }

  function updateRights<K extends keyof PlotPickleProject["rights"]>(key: K, value: PlotPickleProject["rights"][K]) {
    save({ ...project, rights: { ...project.rights, [key]: value } });
  }

  function addCollaborator() {
    const now = new Date().toISOString();
    const collaborator: RightsCollaborator = { id: id("collaborator"), name: "", role: "", contribution: "", ownershipShare: "", agreementReference: "", creditedAs: "", createdAt: now, updatedAt: now };
    updateRights("collaborators", [...project.rights.collaborators, collaborator]);
  }

  function addAttribution() {
    const attribution: SourceAttribution = { id: id("attribution"), title: "", creator: "", sourceType: "research", sourceUrl: "", licence: "", permissionReference: "", notes: "", attachedTo: [], createdAt: new Date().toISOString() };
    updateRights("attributions", [...project.rights.attributions, attribution]);
  }

  function addAiRecord() {
    const record: AiProvenanceRecord = { id: id("ai-provenance"), provider: "", model: "", operation: "other", promptSummary: "", outputSummary: "", humanContribution: "", humanDecision: "", retained: false, attachedTo: [], createdAt: new Date().toISOString() };
    updateRights("aiProvenance", [...project.rights.aiProvenance, record]);
  }

  function createSnapshot() {
    const next = createRevisionSnapshot(project, revisionLabel, revisionNotes);
    save(next);
    const created = next.revisions.at(-1);
    setRevisionLabel("");
    setRevisionNotes("");
    if (created) {
      setLeftRevisionId(leftRevisionId || created.id);
      setRightRevisionId(created.id);
    }
  }

  return <div className={`${styles.studio} ${compact ? styles.compact : ""}`}>
    <header className={styles.header}><div><p>Phase A · Canonical project model</p><h2>Story Threads, Character Arcs, Rights and Revisions</h2><span>Every record is saved inside the active schema 1.7 project and travels with import and export.</span></div><strong>Schema {project.schemaVersion}</strong></header>
    <nav className={styles.tabs} aria-label="Core model sections">
      <button className={section === "threads" ? styles.active : ""} onClick={() => setSection("threads")}>Story Threads <small>{project.storyThreads.length}</small></button>
      <button className={section === "arcs" ? styles.active : ""} onClick={() => setSection("arcs")}>Arc Matrix <small>{project.characters.length}</small></button>
      <button className={section === "rights" ? styles.active : ""} onClick={() => setSection("rights")}>Rights & Provenance <small>{project.rights.attributions.length + project.rights.aiProvenance.length}</small></button>
      <button className={section === "revisions" ? styles.active : ""} onClick={() => setSection("revisions")}>Revisions <small>{project.revisions.length}</small></button>
    </nav>

    {section === "threads" ? <section className={styles.section}>
      <div className={styles.split}><aside className={styles.list}><button className={styles.add} onClick={addThread}>Add Story Thread</button>{project.storyThreads.map((item) => <button className={item.id === thread?.id ? styles.selected : ""} key={item.id} onClick={() => setThreadId(item.id)}><strong>{item.name}</strong><span>{item.kind} · {item.status}</span></button>)}{!project.storyThreads.length ? <p>No threads yet. Add the main plot, subplot, relationship, mystery, theme or world pressure.</p> : null}</aside>
      {thread ? <div className={styles.editor}><div className={styles.grid}><TextField label="Thread name" rows={1} value={thread.name} onChange={(name) => updateThread({ name })} /><label className={styles.field}><span>Kind</span><select value={thread.kind} onChange={(event) => updateThread({ kind: event.target.value as StoryThread["kind"] })}>{threadKinds.map((kind) => <option key={kind}>{kind}</option>)}</select></label><label className={styles.field}><span>Status</span><select value={thread.status} onChange={(event) => updateThread({ status: event.target.value as StoryThread["status"] })}>{threadStatuses.map((status) => <option key={status}>{status}</option>)}</select></label><TextField label="Dramatic question" value={thread.question} onChange={(question) => updateThread({ question })} /><TextField label="Summary" value={thread.summary} onChange={(summary) => updateThread({ summary })} /><TextField label="Notes" value={thread.notes} onChange={(notes) => updateThread({ notes })} /></div>
      <div className={styles.reference}><h3>Participating characters</h3>{project.characters.map((item) => <label key={item.id}><input type="checkbox" checked={thread.characterIds.includes(item.id)} onChange={() => toggleThreadReference("characterIds", item.id)} />{item.name}</label>)}</div>
      <div className={styles.reference}><h3>Linked scenes</h3><div className={styles.sceneList}>{scenes.map((item) => <label key={item.id}><input type="checkbox" checked={thread.sceneIds.includes(item.id)} onChange={() => toggleThreadReference("sceneIds", item.id)} /><span>Block {item.blockNumber} · Scene {item.number}</span><strong>{item.title}</strong></label>)}</div></div>
      <div className={styles.collection}><header><h3>Milestones</h3><button onClick={addMilestone}>Add milestone</button></header>{thread.milestones.map((milestone) => <article key={milestone.id}><label><span>Kind</span><select value={milestone.kind} onChange={(event) => updateMilestone(milestone.id, { kind: event.target.value as StoryThreadMilestone["kind"] })}>{milestoneKinds.map((kind) => <option key={kind}>{kind}</option>)}</select></label><label><span>Scene</span><select value={milestone.sceneId} onChange={(event) => { const selected = scenes.find((item) => item.id === event.target.value); updateMilestone(milestone.id, { sceneId: event.target.value, blockNumber: selected?.blockNumber ?? 1 }); }}>{scenes.map((item) => <option key={item.id} value={item.id}>B{item.blockNumber} · S{item.number} · {item.title}</option>)}</select></label><TextField label="Milestone summary" value={milestone.summary} onChange={(summary) => updateMilestone(milestone.id, { summary })} /><label className={styles.check}><input type="checkbox" checked={milestone.resolved} onChange={(event) => updateMilestone(milestone.id, { resolved: event.target.checked })} />Resolved</label><button className={styles.remove} onClick={() => updateThread({ milestones: thread.milestones.filter((item) => item.id !== milestone.id) })}>Remove</button></article>)}</div>
      <button className={styles.danger} onClick={() => { save({ ...project, storyThreads: project.storyThreads.filter((item) => item.id !== thread.id) }); setThreadId(""); }}>Delete thread</button></div> : null}</div>
    </section> : null}

    {section === "arcs" ? <section className={styles.section}>{character ? <><label className={styles.characterSelect}><span>Character</span><select value={character.id} onChange={(event) => setCharacterId(event.target.value)}>{project.characters.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label><div className={styles.grid}>{([ ["startingState", "Starting state"], ["consciousWant", "Conscious want"], ["underlyingNeed", "Underlying need"], ["protectiveLie", "Protective lie"], ["emergingTruth", "Emerging truth"], ["midpointShift", "Midpoint shift"], ["crisisChoice", "Crisis choice"], ["climaxChoice", "Climax choice"], ["endingState", "Ending state"], ["relationshipImpact", "Relationship impact"] ] as const).map(([key, label]) => <TextField key={key} label={label} value={(character.arcMatrix ?? createBlankArcMatrix(character))[key]} onChange={(value) => updateArc(key, value)} />)}</div><div className={styles.collection}><header><h3>Scene and block checkpoints</h3><button onClick={addCheckpoint}>Add checkpoint</button></header>{(character.arcMatrix ?? createBlankArcMatrix(character)).checkpoints.map((checkpoint) => <article key={checkpoint.id}><label><span>Kind</span><select value={checkpoint.kind} onChange={(event) => updateCheckpoint(checkpoint.id, { kind: event.target.value as CharacterArcCheckpoint["kind"] })}>{checkpointKinds.map((kind) => <option key={kind}>{kind}</option>)}</select></label><label><span>Block</span><input type="number" min="1" max="24" value={checkpoint.blockNumber ?? ""} onChange={(event) => updateCheckpoint(checkpoint.id, { blockNumber: event.target.value ? Number(event.target.value) : null })} /></label><label><span>Scene</span><select value={checkpoint.sceneId} onChange={(event) => updateCheckpoint(checkpoint.id, { sceneId: event.target.value })}><option value="">No scene selected</option>{scenes.map((item) => <option key={item.id} value={item.id}>B{item.blockNumber} · {item.title}</option>)}</select></label>{(["belief", "strategy", "pressure", "choice", "consequence", "evidence"] as const).map((key) => <TextField key={key} label={key[0].toUpperCase() + key.slice(1)} value={checkpoint[key]} onChange={(value) => updateCheckpoint(checkpoint.id, { [key]: value })} />)}<button className={styles.remove} onClick={() => { const matrix = character.arcMatrix ?? createBlankArcMatrix(character); save({ ...project, characters: project.characters.map((item) => item.id === character.id ? { ...item, arcMatrix: { ...matrix, checkpoints: matrix.checkpoints.filter((entry) => entry.id !== checkpoint.id) } } : item) }); }}>Remove</button></article>)}</div></> : <p>Add a character in Story Planner to begin an Arc Matrix.</p>}</section> : null}

    {section === "rights" ? <section className={styles.section}><div className={styles.grid}><TextField label="Project owner" rows={1} value={project.rights.projectOwner} onChange={(value) => updateRights("projectOwner", value)} /><TextField label="Copyright notice" rows={1} value={project.rights.copyrightNotice} onChange={(value) => updateRights("copyrightNotice", value)} /><TextField label="Rights statement" value={project.rights.rightsStatement} onChange={(value) => updateRights("rightsStatement", value)} /><TextField label="Default creative licence" rows={1} value={project.rights.defaultCreativeLicence} onChange={(value) => updateRights("defaultCreativeLicence", value)} /><TextField label="Source work title" rows={1} value={project.rights.sourceWorkTitle} onChange={(value) => updateRights("sourceWorkTitle", value)} /><TextField label="Source work author" rows={1} value={project.rights.sourceWorkAuthor} onChange={(value) => updateRights("sourceWorkAuthor", value)} /><label className={styles.field}><span>Adaptation status</span><select value={project.rights.adaptationStatus} onChange={(event) => updateRights("adaptationStatus", event.target.value as PlotPickleProject["rights"]["adaptationStatus"])}>{["original", "adaptation", "commissioned", "collaboration", "unknown"].map((item) => <option key={item}>{item}</option>)}</select></label></div>
    <div className={styles.collection}><header><h3>Collaborators</h3><button onClick={addCollaborator}>Add collaborator</button></header>{project.rights.collaborators.map((item) => <article key={item.id}>{(["name", "role", "contribution", "ownershipShare", "agreementReference", "creditedAs"] as const).map((key) => <TextField key={key} label={key.replace(/([A-Z])/g, " $1")} value={item[key]} onChange={(value) => updateRights("collaborators", project.rights.collaborators.map((entry) => entry.id === item.id ? { ...entry, [key]: value, updatedAt: new Date().toISOString() } : entry))} />)}<button className={styles.remove} onClick={() => updateRights("collaborators", project.rights.collaborators.filter((entry) => entry.id !== item.id))}>Remove</button></article>)}</div>
    <div className={styles.collection}><header><h3>Source attributions</h3><button onClick={addAttribution}>Add source</button></header>{project.rights.attributions.map((item) => <article key={item.id}><TextField label="Title" value={item.title} onChange={(value) => updateRights("attributions", project.rights.attributions.map((entry) => entry.id === item.id ? { ...entry, title: value } : entry))} /><TextField label="Creator" value={item.creator} onChange={(value) => updateRights("attributions", project.rights.attributions.map((entry) => entry.id === item.id ? { ...entry, creator: value } : entry))} /><label><span>Source type</span><select value={item.sourceType} onChange={(event) => updateRights("attributions", project.rights.attributions.map((entry) => entry.id === item.id ? { ...entry, sourceType: event.target.value as SourceAttribution["sourceType"] } : entry))}>{sourceTypes.map((type) => <option key={type}>{type}</option>)}</select></label>{(["sourceUrl", "licence", "permissionReference", "notes"] as const).map((key) => <TextField key={key} label={key.replace(/([A-Z])/g, " $1")} value={item[key]} onChange={(value) => updateRights("attributions", project.rights.attributions.map((entry) => entry.id === item.id ? { ...entry, [key]: value } : entry))} />)}<TextField label="Attached object IDs" value={item.attachedTo.join(", ")} onChange={(value) => updateRights("attributions", project.rights.attributions.map((entry) => entry.id === item.id ? { ...entry, attachedTo: value.split(",").map((part) => part.trim()).filter(Boolean) } : entry))} /><button className={styles.remove} onClick={() => updateRights("attributions", project.rights.attributions.filter((entry) => entry.id !== item.id))}>Remove</button></article>)}</div>
    <div className={styles.collection}><header><h3>AI provenance</h3><button onClick={addAiRecord}>Add AI record</button></header>{project.rights.aiProvenance.map((item) => <article key={item.id}><TextField label="Provider" value={item.provider} onChange={(value) => updateRights("aiProvenance", project.rights.aiProvenance.map((entry) => entry.id === item.id ? { ...entry, provider: value } : entry))} /><TextField label="Model" value={item.model} onChange={(value) => updateRights("aiProvenance", project.rights.aiProvenance.map((entry) => entry.id === item.id ? { ...entry, model: value } : entry))} /><label><span>Operation</span><select value={item.operation} onChange={(event) => updateRights("aiProvenance", project.rights.aiProvenance.map((entry) => entry.id === item.id ? { ...entry, operation: event.target.value as AiProvenanceRecord["operation"] } : entry))}>{aiOperations.map((operation) => <option key={operation}>{operation}</option>)}</select></label>{(["promptSummary", "outputSummary", "humanContribution", "humanDecision"] as const).map((key) => <TextField key={key} label={key.replace(/([A-Z])/g, " $1")} value={item[key]} onChange={(value) => updateRights("aiProvenance", project.rights.aiProvenance.map((entry) => entry.id === item.id ? { ...entry, [key]: value } : entry))} />)}<TextField label="Attached object IDs" value={item.attachedTo.join(", ")} onChange={(value) => updateRights("aiProvenance", project.rights.aiProvenance.map((entry) => entry.id === item.id ? { ...entry, attachedTo: value.split(",").map((part) => part.trim()).filter(Boolean) } : entry))} /><label className={styles.check}><input type="checkbox" checked={item.retained} onChange={(event) => updateRights("aiProvenance", project.rights.aiProvenance.map((entry) => entry.id === item.id ? { ...entry, retained: event.target.checked } : entry))} />Retained in project</label><button className={styles.remove} onClick={() => updateRights("aiProvenance", project.rights.aiProvenance.filter((entry) => entry.id !== item.id))}>Remove</button></article>)}</div></section> : null}

    {section === "revisions" ? <section className={styles.section}><div className={styles.snapshotCreate}><TextField label="Snapshot name" rows={1} value={revisionLabel} onChange={setRevisionLabel} placeholder="First complete draft" /><TextField label="Snapshot notes" value={revisionNotes} onChange={setRevisionNotes} /><button onClick={createSnapshot}>Capture revision snapshot</button></div><div className={styles.compare}><label><span>Earlier snapshot</span><select value={leftRevisionId} onChange={(event) => setLeftRevisionId(event.target.value)}><option value="">Select</option>{project.revisions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><label><span>Later snapshot</span><select value={rightRevisionId} onChange={(event) => setRightRevisionId(event.target.value)}><option value="">Select</option>{project.revisions.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label><p>{compareRevisionSnapshots(leftRevision, rightRevision)}</p></div><div className={styles.revisionList}>{[...project.revisions].reverse().map((item) => <article key={item.id}><div><strong>{item.label}</strong><span>{new Date(item.createdAt).toLocaleString()} · {item.contentHash}</span><p>{item.notes || "No notes."}</p></div><button onClick={() => { if (window.confirm(`Restore “${item.label}”? The current revision history will be retained.`)) save(restoreRevisionSnapshot(project, item)); }}>Restore</button><button className={styles.remove} onClick={() => save({ ...project, revisions: project.revisions.filter((entry) => entry.id !== item.id) })}>Delete</button></article>)}</div>{!project.revisions.length ? <p>No snapshots yet. Capture one before a major rewrite or AI-assisted pass.</p> : null}</section> : null}
  </div>;
}
''',
)

write(
    "app/core-model-studio.module.css",
    '''.studio{display:grid;gap:1rem}.header{display:flex;justify-content:space-between;gap:1rem;padding:1.1rem;border:1px solid var(--border,#cbd5e1);border-radius:16px;background:rgba(255,255,255,.72)}.header p,.header span{margin:0;color:#52616b}.header h2{margin:.2rem 0}.header>strong{white-space:nowrap}.tabs{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:.5rem}.tabs button{display:flex;justify-content:space-between;gap:.5rem;padding:.8rem;border:1px solid #cbd5e1;border-radius:12px;background:#fff}.tabs button.active{border-color:#276a6d;background:#e9f7f5}.tabs small{opacity:.7}.section{display:grid;gap:1rem}.split{display:grid;grid-template-columns:240px minmax(0,1fr);gap:1rem}.list{display:grid;align-content:start;gap:.45rem}.list>button{display:grid;text-align:left;gap:.2rem;padding:.7rem;border:1px solid #cbd5e1;border-radius:10px;background:#fff}.list .selected{border-color:#276a6d;background:#e9f7f5}.list span{font-size:.8rem;color:#52616b}.add,.collection header button,.snapshotCreate button{background:#205f62!important;color:#fff!important}.editor{display:grid;gap:1rem}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.75rem}.field{display:grid;gap:.35rem}.field span,.collection label>span,.compare label>span{font-size:.78rem;font-weight:700;text-transform:capitalize}.field input,.field textarea,.field select,.collection input,.collection textarea,.collection select,.compare select,.characterSelect select{width:100%;box-sizing:border-box;padding:.65rem;border:1px solid #bcc8cf;border-radius:8px;background:#fff}.reference{padding:.85rem;border:1px solid #d4dde2;border-radius:12px}.reference h3{margin-top:0}.reference>label{display:inline-flex;gap:.35rem;margin:.25rem .7rem .25rem 0}.sceneList{max-height:300px;overflow:auto;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.3rem}.sceneList label{display:grid;grid-template-columns:auto 1fr;column-gap:.35rem;padding:.45rem;border:1px solid #e1e8ec;border-radius:8px}.sceneList strong{grid-column:2;font-size:.8rem}.collection{display:grid;gap:.65rem}.collection header{display:flex;align-items:center;justify-content:space-between}.collection article{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:.65rem;padding:.8rem;border:1px solid #d4dde2;border-radius:12px;background:rgba(255,255,255,.65)}.collection article>label{display:grid;gap:.3rem}.collection .field{margin:0}.check{display:flex!important;align-items:center;gap:.4rem}.remove,.danger{border-color:#b45353!important;color:#8d2929!important;background:#fff!important}.danger{justify-self:start;padding:.6rem}.characterSelect{display:flex;align-items:center;gap:.7rem}.snapshotCreate{display:grid;grid-template-columns:1fr 2fr auto;gap:.7rem;align-items:end}.snapshotCreate button{padding:.72rem;border-radius:9px}.compare{display:grid;grid-template-columns:1fr 1fr;gap:.7rem;padding:.85rem;border:1px solid #d4dde2;border-radius:12px}.compare label{display:grid;gap:.3rem}.compare p{grid-column:1/-1;margin:0}.revisionList{display:grid;gap:.6rem}.revisionList article{display:flex;align-items:center;gap:.6rem;padding:.8rem;border:1px solid #d4dde2;border-radius:12px}.revisionList article>div{flex:1}.revisionList span{display:block;font-size:.75rem;color:#52616b}.revisionList p{margin:.25rem 0 0}.compact .header{display:none}@media(max-width:900px){.tabs{grid-template-columns:repeat(2,1fr)}.split{grid-template-columns:1fr}.grid,.collection article,.sceneList,.snapshotCreate,.compare{grid-template-columns:1fr}.compare p{grid-column:auto}.revisionList article{align-items:flex-start;flex-wrap:wrap}}''',
)

# Story Planner integration.
replace_once(
    "app/page.tsx",
    '''import VisualStoryboard from "./visual-storyboard";''',
    '''import VisualStoryboard from "./visual-storyboard";
import CoreModelStudio from "./core-model-studio";''',
)
replace_once(
    "app/page.tsx",
    '''type StorySection = "overview" | "storySetup" | "pitch" | "world" | "characters" | "ghost" | "catalyst" | "foundations" | "pickle" | "dialogue" | "structureMap" | "blocks" | "storyboard" | "notes";''',
    '''type StorySection = "overview" | "storySetup" | "pitch" | "world" | "characters" | "ghost" | "catalyst" | "foundations" | "pickle" | "dialogue" | "coreModel" | "structureMap" | "blocks" | "storyboard" | "notes";''',
)
replace_once(
    "app/page.tsx",
    '''  { id: "dialogue", code: "DL", label: "Dialogue", group: "Foundation" },
  { id: "structureMap",''',
    '''  { id: "dialogue", code: "DL", label: "Dialogue", group: "Foundation" },
  { id: "coreModel", code: "CM", label: "Core Model", group: "Foundation" },
  { id: "structureMap",''',
)
replace_once(
    "app/page.tsx",
    '''  structureMap: {
    title: "See the complete hierarchy without leaving the story columns.",''',
    '''  coreModel: {
    title: "Track the story beneath every draft.",
    description: "Connect subplots, character-change evidence, ownership, sources, AI-assisted work and named revisions to the same canonical project.",
    questions: ["Which story thread is still unresolved?", "Where is each character's change visible?", "Can every source, collaborator and retained AI contribution be accounted for?"],
    deliverable: "A portable schema 1.7 project with complete threads, arcs, rights, provenance and revision history.",
    connection: "The Writer, Structure Engine, Reports and Settings read these same records.",
  },
  structureMap: {
    title: "See the complete hierarchy without leaving the story columns.",''',
)
replace_once(
    "app/page.tsx",
    '''              {activeSection === "dialogue" ? (
                <DialogueEditor project={project} selected={selectedCharacter} select={setSelectedCharacterId} updateCharacter={updateCharacter} updateDevelopment={updateDevelopment} />
              ) : null}
              {activeSection === "blocks" ? (''',
    '''              {activeSection === "dialogue" ? (
                <DialogueEditor project={project} selected={selectedCharacter} select={setSelectedCharacterId} updateCharacter={updateCharacter} updateDevelopment={updateDevelopment} />
              ) : null}
              {activeSection === "coreModel" ? (
                <div className="editor-page"><CoreModelStudio project={project} onChange={commit} /></div>
              ) : null}
              {activeSection === "blocks" ? (''',
)
replace_once(
    "app/page.tsx",
    '''          <SettingsPanel project={project} />''',
    '''          <SettingsPanel project={project} onProjectChange={commit} />''',
)

# Progress/navigation integration.
replace_once(
    "lib/project-progress.ts",
    '''  | "dialogue"
  | "structureMap"''',
    '''  | "dialogue"
  | "coreModel"
  | "structureMap"''',
)
replace_once(
    "lib/project-progress.ts",
    '''  "dialogue",
  "structureMap",''',
    '''  "dialogue",
  "coreModel",
  "structureMap",''',
)
replace_once(
    "lib/project-progress.ts",
    '''    dialogue: score([
      project.development.dialogue.principles,''',
    '''    dialogue: score([
      project.development.dialogue.principles,''',
)
replace_once(
    "lib/project-progress.ts",
    '''      project.characters.some((character) => isFilled(character.voice)),
    ]),
    structureMap:''',
    '''      project.characters.some((character) => isFilled(character.voice)),
    ]),
    coreModel: average([
      score([project.storyThreads.length]),
      average(project.characters.map((character) => score(Object.values(character.arcMatrix ?? {})))),
      score([project.rights.projectOwner, project.rights.rightsStatement, project.rights.defaultCreativeLicence]),
      score([project.revisions.length]),
    ]),
    structureMap:''',
)

# Settings integration.
replace_once(
    "app/settings-panel.tsx",
    '''import { ScreenplayReports, TerminologyIndex } from "./settings-project-tools";''',
    '''import { ScreenplayReports, TerminologyIndex } from "./settings-project-tools";
import CoreModelStudio from "./core-model-studio";''',
)
replace_once(
    "app/settings-panel.tsx",
    '''type SettingsSection = "reports" | "terminology" | "ai" | "music" | "plugins";''',
    '''type SettingsSection = "reports" | "terminology" | "core" | "ai" | "music" | "plugins";''',
)
replace_once(
    "app/settings-panel.tsx",
    '''export default function SettingsPanel({ project }: { project: PlotPickleProject }) {''',
    '''export default function SettingsPanel({ project, onProjectChange }: { project: PlotPickleProject; onProjectChange: (project: PlotPickleProject) => void }) {''',
)
replace_once(
    "app/settings-panel.tsx",
    '''          <button type="button" className={section === "terminology" ? styles.active : ""} onClick={() => setSection("terminology")}><b>Terminology Index</b><span>Screenplay terms in plain language</span></button>
          <button type="button" className={section === "ai" ? styles.active : ""}''',
    '''          <button type="button" className={section === "terminology" ? styles.active : ""} onClick={() => setSection("terminology")}><b>Terminology Index</b><span>Screenplay terms in plain language</span></button>
          <button type="button" className={section === "core" ? styles.active : ""} onClick={() => setSection("core")}><b>Core Model</b><span>Threads, arcs, rights, provenance, revisions</span></button>
          <button type="button" className={section === "ai" ? styles.active : ""}''',
)
replace_once(
    "app/settings-panel.tsx",
    '''          {section === "terminology" ? <TerminologyIndex /> : null}
          {section === "ai" ? (''',
    '''          {section === "terminology" ? <TerminologyIndex /> : null}
          {section === "core" ? <CoreModelStudio project={project} onChange={onProjectChange} compact /> : null}
          {section === "ai" ? (''',
)

# Writer integration: expanded elements plus thread, lock, omission and revision controls.
replace_once(
    "app/script-workspace.tsx",
    '''  transition: "Transition",
};''',
    '''  transition: "Transition",
  section: "Section",
  synopsis: "Synopsis",
  shot: "Shot",
  lyrics: "Lyrics",
  "dual-dialogue": "Dual dialogue",
  centered: "Centered text",
  "page-break": "Page break",
  "title-page": "Title page",
  note: "Note",
  boneyard: "Boneyard",
};''',
)
replace_once(
    "app/script-workspace.tsx",
    '''            </label>
          </div> : null}''',
    '''            </label>
            <label>Revision colour
              <select value={selected.revisionColour} onChange={(event) => updateElement(selected.id, { revisionColour: event.target.value as ScreenplayDraftElement["revisionColour"] })}>{["none", "blue", "pink", "yellow", "green", "goldenrod", "buff", "salmon", "cherry", "tan", "gray"].map((colour) => <option key={colour}>{colour}</option>)}</select>
            </label>
            <label><input type="checkbox" checked={selected.locked} onChange={(event) => updateElement(selected.id, { locked: event.target.checked })} /> Lock element</label>
            <label><input type="checkbox" checked={selected.omitted} onChange={(event) => updateElement(selected.id, { omitted: event.target.checked })} /> Omit without deleting</label>
            {project.storyThreads.length ? <fieldset><legend>Story Threads</legend>{project.storyThreads.map((thread) => <label key={thread.id}><input type="checkbox" checked={selected.threadIds.includes(thread.id)} onChange={() => updateElement(selected.id, { threadIds: selected.threadIds.includes(thread.id) ? selected.threadIds.filter((id) => id !== thread.id) : [...selected.threadIds, thread.id] })} /> {thread.name}</label>)}</fieldset> : null}
          </div> : null}''',
)

# Structure integration: live thread coverage and selected scene assignments.
replace_once(
    "app/structure/page.tsx",
    '''          <div><strong>{allScenes.length}</strong><span>scenes</span></div>
          <div><strong>{allMinis.length}</strong><span>mini-blocks</span></div>''',
    '''          <div><strong>{allScenes.length}</strong><span>scenes</span></div>
          <div><strong>{project.storyThreads.length}</strong><span>story threads</span></div>
          <div><strong>{allMinis.length}</strong><span>mini-blocks</span></div>''',
)
replace_once(
    "app/structure/page.tsx",
    '''        <section className={styles.templateNote}>
          <div><span>Starting template</span><strong>48 scenes</strong></div>
          <p>A feature often lands around forty to sixty scenes. PlotPickle keeps two scenes per block only as the initial distribution; each block may contain one or more scenes, and each mini-block may hold multiple short scenes.</p>
        </section>''',
    '''        <section className={styles.templateNote}>
          <div><span>Starting template</span><strong>48 scenes</strong></div>
          <p>A feature often lands around forty to sixty scenes. PlotPickle keeps two scenes per block only as the initial distribution; each block may contain one or more scenes, and each mini-block may hold multiple short scenes.</p>
        </section>

        <section className={styles.templateNote}>
          <div><span>Selected scene threads</span><strong>{scene.threadIds.length}</strong></div>
          <p>{project.storyThreads.length ? "Assign structural scenes to the main plot, subplots, relationships, mysteries, thematic arguments or world pressures." : "Create Story Threads in Story Planner → Core Model, then return here to see their structural coverage."}</p>
          {project.storyThreads.length ? <div>{project.storyThreads.map((thread) => <label key={thread.id} style={{ marginRight: "1rem" }}><input type="checkbox" checked={scene.threadIds.includes(thread.id)} onChange={() => updateBlockScenes((current) => current.map((item) => item.id === scene.id ? { ...item, threadIds: item.threadIds.includes(thread.id) ? item.threadIds.filter((id) => id !== thread.id) : [...item.threadIds, thread.id] } : item), "Scene thread assignments updated.")} /> {thread.name}</label>)}</div> : null}
        </section>''',
)

# Reports integration.
replace_once(
    "app/settings-project-tools.tsx",
    '''      <div className={styles.reportSummary}>
        <article><span>Speaking characters</span><strong>{report.summary.charactersWithDialogue}</strong></article>''',
    '''      <div className={styles.reportSummary}>
        <article><span>Story threads</span><strong>{project.storyThreads.length}</strong></article>
        <article><span>Arc checkpoints</span><strong>{project.characters.reduce((total, character) => total + (character.arcMatrix?.checkpoints.length ?? 0), 0)}</strong></article>
        <article><span>Sources & AI records</span><strong>{project.rights.attributions.length + project.rights.aiProvenance.length}</strong></article>
        <article><span>Revision snapshots</span><strong>{project.revisions.length}</strong></article>
        <article><span>Speaking characters</span><strong>{report.summary.charactersWithDialogue}</strong></article>''',
)

# Canonical schema and release metadata.
shutil.copyfile(ROOT / "schema/plotpickle-project-v1.7.schema.json", ROOT / "schema/plotpickle-project.schema.json")

replace_once("package.json", '  "version": "0.12.0",', '  "version": "0.13.0",')
replace_once("README.md", 'Current application version: `0.12.0`', 'Current application version: `0.13.0`')
replace_once("README.md", 'Current released project schema: `1.6.0`\n\nPhase 1 development schema: `1.7.0`', 'Current released project schema: `1.7.0`')
replace_once("README.md", 'Released projects use schema `1.6.0`. Phase 1 development uses schema `1.7.0`.', 'Released projects use canonical schema `1.7.0`. Imports from schemas 1.0 through 1.6 are upgraded non-destructively.')
replace_once("README.md", 'The original `schema/plotpickle-project.schema.json` remains available for current 1.6 exports during the UI transition. The Phase 1 schema is `schema/plotpickle-project-v1.7.schema.json`. Once the six UI surfaces use the migration adapter, schema 1.7 can become the default export without breaking existing saved projects.', 'Schema 1.7 is now the canonical export and application model. `schema/plotpickle-project-v1.7.schema.json` remains as the Phase A reference copy; `schema/plotpickle-project.schema.json` is the released source of truth.') if 'The original `schema/plotpickle-project.schema.json` remains available for current 1.6 exports during the UI transition.' in read('README.md') else None

# Documentation and test contract.
write(
    "docs/phase-a-core-model-013.md",
    '''# Phase A — Activate the core model (PlotPickle 0.13)

PlotPickle 0.13 promotes schema 1.7 from a development adapter to the canonical project model.

## Completed

- schema 1.7 is used by blank projects, imports, exports, Afterglow and the Structure Engine;
- schemas 1.0 through 1.6 are upgraded non-destructively during normalization;
- all expanded screenplay element types are editable and export through Fountain and Final Draft mappings;
- Story Threads include characters, scenes and milestones, with reciprocal scene links;
- every character has an Arc Matrix and scene/block checkpoints;
- Rights & Provenance records ownership, collaborators, sources and retained AI operations;
- named revision snapshots include deterministic hashes, comparison and restoration;
- Story Planner, Writer, Structure, Settings and Reports use the same records;
- the canonical schema file and the Phase A reference schema are synchronized.

## Compatibility

API keys and provider secrets remain outside project data. Existing project files from schemas 1.0–1.6 open as 1.7 projects without discarding story, screenplay, character, scene, mini-block, note or visual content.

## Superseded branches

The useful concepts in draft PR #1 and PR #3 are tracked separately. Their old schema/runtime branches are not merged into 0.13 because they predate the current application architecture. Act I Launch, Opening Move, Scene Pulse and disk-backed release packaging will be ported from fresh current-main branches.
''',
)

write(
    "tests/phase-a-core-model.test.mjs",
    '''import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("schema 1.7 is the canonical released schema", async () => {
  const canonical = JSON.parse(await source("schema/plotpickle-project.schema.json"));
  const phase = JSON.parse(await source("schema/plotpickle-project-v1.7.schema.json"));
  assert.equal(canonical.properties.schemaVersion.const, "1.7.0");
  assert.deepEqual(canonical, phase);
});

test("blank, imported and Afterglow projects use the Phase A model", async () => {
  const project = await source("lib/project.ts");
  const afterglow = await source("data/afterglow.ts");
  assert.match(project, /schemaVersion: "1\.7\.0"/);
  assert.match(project, /"1\.6\.0", "1\.7\.0"/);
  assert.match(project, /storyThreads: \[\]/);
  assert.match(project, /rights: createBlankRightsAndProvenance/);
  assert.match(project, /revisions: \[\]/);
  assert.match(afterglow, /createBlankArcMatrix\(character\)/);
});

test("all Phase A interfaces are connected", async () => {
  const studio = await source("app/core-model-studio.tsx");
  const page = await source("app/page.tsx");
  const writer = await source("app/script-workspace.tsx");
  const structure = await source("app/structure/page.tsx");
  const settings = await source("app/settings-panel.tsx");
  const reports = await source("app/settings-project-tools.tsx");
  for (const phrase of ["Story Threads", "Arc Matrix", "Rights & Provenance", "Revisions", "Capture revision snapshot", "AI provenance"]) assert.ok(studio.includes(phrase), phrase);
  assert.match(page, /activeSection === "coreModel"/);
  assert.match(writer, /Dual dialogue/);
  assert.match(writer, /Story Threads/);
  assert.match(structure, /Selected scene threads/);
  assert.match(settings, /Core Model/);
  assert.match(reports, /Revision snapshots/);
});

test("expanded screenplay elements export through Fountain and FDX", async () => {
  const project = await source("lib/project.ts");
  const draft = await source("lib/screenplay-draft.ts");
  for (const type of ["section", "synopsis", "shot", "lyrics", "dual-dialogue", "centered", "page-break", "title-page", "note", "boneyard"]) {
    assert.ok(project.includes(`| "${type}"`), type);
    assert.ok(draft.includes(type), type);
  }
});
''',
)

replace_once(
    "package.json",
    '''tests/phase-two-dynamic-scenes.test.mjs",''',
    '''tests/phase-two-dynamic-scenes.test.mjs tests/phase-a-core-model.test.mjs",''',
)

# Update old documentation language now that the transition is complete.
phase_doc = read("docs/phase-1-core-schema.md")
phase_doc = phase_doc.replace("The original `schema/plotpickle-project.schema.json` remains available for current 1.6 exports during the UI transition. The Phase 1 schema is `schema/plotpickle-project-v1.7.schema.json`. Once the six UI surfaces use the migration adapter, schema 1.7 can become the default export without breaking existing saved projects.", "Schema 1.7 is the canonical application and export model as of PlotPickle 0.13. Imports from schemas 1.0 through 1.6 are normalized into the same model before any workspace edits or exports them.")
write("docs/phase-1-core-schema.md", phase_doc)

# Remove the transient automation after it has applied the source migration.
for transient in [ROOT / "scripts/apply-phase-a.py", ROOT / ".github/workflows/apply-phase-a.yml"]:
    if transient.exists():
        transient.unlink()
