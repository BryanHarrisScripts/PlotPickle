import { createMiniBlockWallModel, DEFAULT_MINI_BLOCK_WALL_STATE } from "./mini-block-wall";
import type {
  PlotPickleProject,
  ReviewAnchor,
  ReviewPriority,
  ReviewThread,
  ReviewThreadStatus,
  RevisionSnapshot,
} from "./project";
import { savedSpecialistPasses, type SpecialistPassRecord } from "./specialist-labs";

export const FEEDBACK_SECTIONS = [
  "overview",
  "ai-review",
  "human-review",
  "writers-room",
  "shooting-script",
  "table-read",
] as const;

export type FeedbackSection = (typeof FEEDBACK_SECTIONS)[number];

export type FeedbackStatus =
  | "open"
  | "under-review"
  | "accepted"
  | "partially-accepted"
  | "rejected"
  | "resolved"
  | "deferred";

export const FEEDBACK_STATUSES: FeedbackStatus[] = [
  "open",
  "under-review",
  "accepted",
  "partially-accepted",
  "rejected",
  "resolved",
  "deferred",
];

export type FeedbackTargetKind =
  | "project"
  | "act"
  | "sequence"
  | "block"
  | "mini-block"
  | "character"
  | "relationship"
  | "world"
  | "treatment"
  | "screenplay"
  | "scene"
  | "dialogue-passage"
  | "action-passage"
  | "storyboard-frame"
  | "visual-identity"
  | "production-item";

export type FeedbackSource =
  | "human"
  | "ai"
  | "diagnostic"
  | "collaboration"
  | "screenplay-annotation"
  | "approval"
  | "writers-room"
  | "shooting-script"
  | "table-read";

export type FeedbackAuthorRole =
  | "writer"
  | "co-writer"
  | "reviewer"
  | "editor"
  | "director"
  | "producer"
  | "actor"
  | "designer"
  | "ai-assistant"
  | "system"
  | "other";

export type FeedbackCategory =
  | "story"
  | "structure"
  | "character"
  | "relationship"
  | "world"
  | "dialogue"
  | "action"
  | "continuity"
  | "visual"
  | "production"
  | "performance"
  | "rights"
  | "technical"
  | "other";

export type FeedbackTargetReference = {
  kind: FeedbackTargetKind;
  targetId: string;
  label: string;
  workspace: "dashboard" | "plan" | "build" | "write" | "storyboard" | "refine" | "feedback" | "reports";
  blockId: string;
  miniBlockId: string;
  sceneId: string;
  characterId: string;
  frameId: string;
  screenplayElementId: string;
  productionItemId: string;
};

export type FeedbackMessage = {
  id: string;
  author: string;
  role: FeedbackAuthorRole;
  source: FeedbackSource;
  body: string;
  createdAt: string;
};

export type UnifiedFeedbackRecord = {
  id: string;
  title: string;
  target: FeedbackTargetReference;
  author: string;
  role: FeedbackAuthorRole;
  source: FeedbackSource;
  body: string;
  status: FeedbackStatus;
  priority: ReviewPriority;
  category: FeedbackCategory;
  proposedChange: string;
  thread: FeedbackMessage[];
  resolution: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt: string;
  linkedRevisionId: string;
  originId: string;
  synthetic: boolean;
};

export type FeedbackFilters = {
  query?: string;
  statuses?: FeedbackStatus[];
  sources?: FeedbackSource[];
  priorities?: ReviewPriority[];
  categories?: FeedbackCategory[];
  targetKinds?: FeedbackTargetKind[];
  targetId?: string;
  includeResolved?: boolean;
};

export type FeedbackTargetResolution = {
  exists: boolean;
  label: string;
  workspace: FeedbackTargetReference["workspace"];
  blockNumber: number | null;
  miniBlockNumber: number | null;
  sceneNumber: number | null;
};

export type UnifiedFeedbackModel = {
  records: UnifiedFeedbackRecord[];
  visibleRecords: UnifiedFeedbackRecord[];
  counts: {
    total: number;
    active: number;
    resolved: number;
    ai: number;
    human: number;
    diagnostics: number;
  };
  byStatus: Record<FeedbackStatus, number>;
  bySection: Record<FeedbackSection, number>;
  badges: Map<string, number>;
};

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalized(value: string) {
  return value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
}

function priorityForDiagnostic(kind: string): ReviewPriority {
  if (["overloaded-block", "missing-escalation", "setup-without-payoff", "payoff-without-setup"].includes(kind)) return "high";
  if (["empty-mini-block", "unlinked-scene", "missing-storyboard-frame"].includes(kind)) return "normal";
  return "low";
}

export function normalizeFeedbackStatus(status: ReviewThreadStatus | string): FeedbackStatus {
  if (status === "in-review") return "under-review";
  if (FEEDBACK_STATUSES.includes(status as FeedbackStatus)) return status as FeedbackStatus;
  return "open";
}

function targetCategory(kind: FeedbackTargetKind): FeedbackCategory {
  if (["act", "sequence", "block", "mini-block", "scene"].includes(kind)) return "structure";
  if (kind === "character") return "character";
  if (kind === "relationship") return "relationship";
  if (["world", "treatment"].includes(kind)) return "world";
  if (kind === "dialogue-passage") return "dialogue";
  if (kind === "action-passage") return "action";
  if (["storyboard-frame", "visual-identity"].includes(kind)) return "visual";
  if (kind === "production-item") return "production";
  if (["screenplay"].includes(kind)) return "story";
  return "other";
}

function legacyAnchorTarget(anchor: ReviewAnchor): FeedbackTargetReference {
  const kind: FeedbackTargetKind = anchor.kind === "story-field"
    ? "treatment"
    : anchor.kind === "screenplay-element"
      ? "screenplay"
      : anchor.kind;
  const workspace: FeedbackTargetReference["workspace"] = kind === "block" || kind === "mini-block"
    ? "build"
    : kind === "scene" || kind === "screenplay" || kind === "dialogue-passage" || kind === "action-passage"
      ? "write"
      : kind === "storyboard-frame" || kind === "visual-identity"
        ? "storyboard"
        : kind === "production-item"
          ? "refine"
          : kind === "character" || kind === "relationship" || kind === "world" || kind === "treatment"
            ? "plan"
            : "feedback";
  return {
    kind,
    targetId: anchor.targetId,
    label: anchor.label,
    workspace,
    blockId: kind === "block" ? anchor.targetId : "",
    miniBlockId: kind === "mini-block" ? anchor.targetId : "",
    sceneId: kind === "scene" ? anchor.targetId : "",
    characterId: kind === "character" ? anchor.targetId : "",
    frameId: kind === "storyboard-frame" ? anchor.targetId : "",
    screenplayElementId: kind === "screenplay" ? anchor.targetId : "",
    productionItemId: kind === "production-item" ? anchor.targetId : "",
  };
}

function sourceFromThread(thread: ReviewThread): FeedbackSource {
  const value = normalized(`${thread.title} ${thread.comments.map((comment) => comment.body).join(" ")}`);
  if (/\bai\b|assistant|model|generated proposal/.test(value)) return "ai";
  if (/diagnostic|warning|continuity check|missing escalation/.test(value)) return "diagnostic";
  if (/github|collaborator|pull request|proposal/.test(value)) return "collaboration";
  if (/table read|performance note|actor note/.test(value)) return "table-read";
  if (/shooting script|locked page|revision colour/.test(value)) return "shooting-script";
  if (/writers.? room|room note/.test(value)) return "writers-room";
  return "human";
}

function roleFromSource(source: FeedbackSource): FeedbackAuthorRole {
  if (source === "ai") return "ai-assistant";
  if (source === "diagnostic") return "system";
  if (source === "table-read") return "actor";
  if (source === "shooting-script") return "director";
  return "reviewer";
}

function extractPrefixedComment(thread: ReviewThread, prefix: string) {
  const normalizedPrefix = normalized(prefix);
  const comment = thread.comments.find((entry) => normalized(entry.body).startsWith(normalizedPrefix));
  if (!comment) return "";
  return comment.body.slice(comment.body.indexOf(":") + 1).trim();
}

function linkedRevision(project: PlotPickleProject, thread: ReviewThread) {
  const haystack = normalized(`${thread.title} ${thread.comments.map((comment) => comment.body).join(" ")}`);
  return project.revisions.find((revision) => haystack.includes(normalized(revision.id)) || haystack.includes(normalized(revision.label)))?.id ?? "";
}

function recordFromThread(project: PlotPickleProject, thread: ReviewThread): UnifiedFeedbackRecord {
  const source = sourceFromThread(thread);
  const role = roleFromSource(source);
  const target = legacyAnchorTarget(thread.anchor);
  const first = thread.comments[0];
  const last = thread.comments.at(-1);
  const status = normalizeFeedbackStatus(thread.status);
  const resolved = ["accepted", "partially-accepted", "rejected", "resolved"].includes(status);
  const messages = thread.comments.map((comment) => ({
    id: comment.id,
    author: comment.author || "Local reviewer",
    role,
    source,
    body: comment.body,
    createdAt: comment.createdAt,
  }));
  return {
    id: thread.id,
    title: thread.title,
    target,
    author: first?.author || "Local reviewer",
    role,
    source,
    body: first?.body || "",
    status,
    priority: thread.priority,
    category: targetCategory(target.kind),
    proposedChange: extractPrefixedComment(thread, "Proposed change:"),
    thread: messages,
    resolution: extractPrefixedComment(thread, "Resolution:") || (resolved ? last?.body || "Resolved." : ""),
    createdAt: thread.createdAt,
    updatedAt: thread.updatedAt,
    resolvedAt: thread.resolvedAt,
    linkedRevisionId: linkedRevision(project, thread),
    originId: thread.id,
    synthetic: false,
  };
}

function targetForSpecialistPass(project: PlotPickleProject, pass: SpecialistPassRecord): FeedbackTargetReference {
  const screenplay = project.screenplay.draftElements.find((element) => element.id === pass.target);
  if (screenplay) {
    const kind: FeedbackTargetKind = screenplay.type === "dialogue" || screenplay.type === "dual-dialogue"
      ? "dialogue-passage"
      : screenplay.type === "action"
        ? "action-passage"
        : "screenplay";
    return {
      kind,
      targetId: screenplay.id,
      label: `Scene ${screenplay.sceneNumber} · ${screenplay.type}`,
      workspace: "write",
      blockId: project.blocks.find((block) => block.number === screenplay.blockNumber)?.id ?? "",
      miniBlockId: "",
      sceneId: screenplay.sceneId || "",
      characterId: "",
      frameId: "",
      screenplayElementId: screenplay.id,
      productionItemId: "",
    };
  }
  const character = project.characters.find((candidate) => candidate.id === pass.target);
  if (character) return {
    kind: "character", targetId: character.id, label: character.name || "Character", workspace: "plan",
    blockId: "", miniBlockId: "", sceneId: "", characterId: character.id, frameId: "", screenplayElementId: "", productionItemId: "",
  };
  const frame = project.blocks.flatMap((block) => block.visuals.map((visual) => ({ block, visual }))).find(({ visual }) => visual.id === pass.target);
  if (frame) return {
    kind: "storyboard-frame", targetId: frame.visual.id, label: `Block ${frame.block.number} · storyboard frame`, workspace: "storyboard",
    blockId: frame.block.id, miniBlockId: "", sceneId: "", characterId: "", frameId: frame.visual.id, screenplayElementId: "", productionItemId: "",
  };
  const worldTarget = pass.target === "world.visualLanguage" || pass.lab === "visual";
  return {
    kind: worldTarget ? "visual-identity" : pass.lab === "research" ? "world" : "project",
    targetId: pass.target || project.id,
    label: pass.target || project.metadata.title,
    workspace: worldTarget ? "storyboard" : pass.lab === "research" ? "plan" : "feedback",
    blockId: "", miniBlockId: "", sceneId: "", characterId: "", frameId: "", screenplayElementId: "", productionItemId: "",
  };
}

function revisionForPass(project: PlotPickleProject, pass: SpecialistPassRecord): RevisionSnapshot | undefined {
  return project.revisions.find((revision) => {
    const candidate = revision.payload?._specialistPass;
    return Boolean(candidate && typeof candidate === "object" && (candidate as Partial<SpecialistPassRecord>).id === pass.id);
  });
}

function recordFromSpecialistPass(project: PlotPickleProject, pass: SpecialistPassRecord): UnifiedFeedbackRecord {
  const source: FeedbackSource = pass.generated ? "ai" : "approval";
  const revision = revisionForPass(project, pass);
  return {
    id: `specialist-feedback:${pass.id}`,
    title: pass.title,
    target: targetForSpecialistPass(project, pass),
    author: "Project writer",
    role: "writer",
    source,
    body: pass.summary,
    status: "accepted",
    priority: "normal",
    category: pass.lab === "dialogue" ? "dialogue" : pass.lab === "visual" ? "visual" : pass.lab === "research" ? "world" : "story",
    proposedChange: pass.after,
    thread: [{
      id: `${pass.id}:approval`,
      author: "Project writer",
      role: "writer",
      source,
      body: `Approved specialist pass. Before: ${pass.before}\n\nProposed change: ${pass.after}`,
      createdAt: pass.approvedAt,
    }],
    resolution: "Accepted and stored in revision history.",
    createdAt: pass.approvedAt,
    updatedAt: pass.approvedAt,
    resolvedAt: pass.approvedAt,
    linkedRevisionId: revision?.id ?? "",
    originId: pass.id,
    synthetic: true,
  };
}

function recordFromDiagnostic(project: PlotPickleProject, warning: ReturnType<typeof createMiniBlockWallModel>["warnings"][number], index: number): UnifiedFeedbackRecord {
  const block = project.blocks.find((candidate) => candidate.id === warning.blockId);
  const mini = block?.scenes.flatMap((scene) => scene.miniBlocks.map((miniBlock) => ({ scene, miniBlock }))).find(({ miniBlock }) => miniBlock.id === warning.miniBlockId);
  const unlinkedScene = warning.kind === "unlinked-scene"
    ? project.blocks.flatMap((candidate) => candidate.scenes.map((storyScene) => ({ block: candidate, scene: storyScene }))).find((entry) => entry.scene.id === warning.targetId)
    : undefined;
  const scene = unlinkedScene ?? (mini ? { block, scene: mini.scene } : undefined);
  const target: FeedbackTargetReference = warning.miniBlockId && mini
    ? {
        kind: "mini-block",
        targetId: mini.miniBlock.id,
        label: `Block ${block?.number ?? "?"} · ${mini.miniBlock.label || `Mini-block ${mini.miniBlock.number}`}`,
        workspace: "build",
        blockId: block?.id ?? "",
        miniBlockId: mini.miniBlock.id,
        sceneId: mini.scene.id,
        characterId: mini.miniBlock.characterId,
        frameId: "",
        screenplayElementId: "",
        productionItemId: "",
      }
    : scene
      ? {
          kind: "scene",
          targetId: scene.scene.id,
          label: `Block ${scene.block?.number ?? "?"} · ${scene.scene.title}`,
          workspace: "write",
          blockId: scene.block?.id ?? "",
          miniBlockId: "",
          sceneId: scene.scene.id,
          characterId: "",
          frameId: "",
          screenplayElementId: "",
          productionItemId: "",
        }
      : {
          kind: "block",
          targetId: block?.id ?? project.id,
          label: block ? `Block ${block.number} · ${block.title}` : project.metadata.title,
          workspace: block ? "build" : "feedback",
          blockId: block?.id ?? "",
          miniBlockId: "",
          sceneId: "",
          characterId: "",
          frameId: "",
          screenplayElementId: "",
          productionItemId: "",
        };
  return {
    id: `diagnostic-feedback:${warning.kind}:${warning.targetId}:${index}`,
    title: warning.kind.replaceAll("-", " "),
    target,
    author: "PlotPickle diagnostics",
    role: "system",
    source: "diagnostic",
    body: warning.message,
    status: "open",
    priority: priorityForDiagnostic(warning.kind),
    category: warning.kind === "missing-storyboard-frame" ? "visual" : warning.kind === "unlinked-scene" ? "continuity" : "structure",
    proposedChange: "",
    thread: [],
    resolution: "",
    createdAt: project.metadata.updatedAt,
    updatedAt: project.metadata.updatedAt,
    resolvedAt: "",
    linkedRevisionId: "",
    originId: warning.targetId,
    synthetic: true,
  };
}

export function feedbackBadgeKey(target: Pick<FeedbackTargetReference, "kind" | "targetId">) {
  return `${target.kind}:${target.targetId}`;
}

export function resolveFeedbackTarget(project: PlotPickleProject, target: FeedbackTargetReference): FeedbackTargetResolution {
  if (target.kind === "project") return { exists: target.targetId === project.id || !target.targetId, label: project.metadata.title, workspace: "feedback", blockNumber: null, miniBlockNumber: null, sceneNumber: null };
  if (target.kind === "act") return { exists: [1, 2, 3, 4].includes(Number(target.targetId)), label: target.label, workspace: "build", blockNumber: null, miniBlockNumber: null, sceneNumber: null };
  if (target.kind === "sequence") return { exists: project.structure.sequences.some((sequence) => sequence.id === target.targetId || String(sequence.number) === target.targetId), label: target.label, workspace: "build", blockNumber: null, miniBlockNumber: null, sceneNumber: null };
  const block = project.blocks.find((candidate) => candidate.id === target.blockId || candidate.id === target.targetId);
  if (target.kind === "block") return { exists: Boolean(block), label: block ? `Block ${block.number} · ${block.title}` : target.label, workspace: "build", blockNumber: block?.number ?? null, miniBlockNumber: null, sceneNumber: null };
  const allScenes = project.blocks.flatMap((candidate) => candidate.scenes.map((scene) => ({ block: candidate, scene })));
  const scene = allScenes.find((entry) => entry.scene.id === target.sceneId || entry.scene.id === target.targetId);
  const allMinis = allScenes.flatMap((entry) => entry.scene.miniBlocks.map((miniBlock) => ({ ...entry, miniBlock })));
  const mini = allMinis.find((entry) => entry.miniBlock.id === target.miniBlockId || entry.miniBlock.id === target.targetId);
  if (target.kind === "mini-block") return { exists: Boolean(mini), label: mini ? `Block ${mini.block.number} · ${mini.miniBlock.label || `Mini-block ${mini.miniBlock.number}`}` : target.label, workspace: "build", blockNumber: mini?.block.number ?? null, miniBlockNumber: mini?.miniBlock.number ?? null, sceneNumber: mini?.scene.number ?? null };
  if (target.kind === "scene") return { exists: Boolean(scene), label: scene ? `Scene ${scene.scene.number} · ${scene.scene.title}` : target.label, workspace: "write", blockNumber: scene?.block.number ?? null, miniBlockNumber: null, sceneNumber: scene?.scene.number ?? null };
  const screenplay = project.screenplay.draftElements.find((element) => element.id === target.screenplayElementId || element.id === target.targetId);
  if (["screenplay", "dialogue-passage", "action-passage"].includes(target.kind)) return { exists: Boolean(screenplay), label: screenplay ? `Scene ${screenplay.sceneNumber} · ${screenplay.type}` : target.label, workspace: "write", blockNumber: screenplay?.blockNumber ?? null, miniBlockNumber: screenplay?.miniBlockNumber ?? null, sceneNumber: screenplay?.sceneNumber ?? null };
  const character = project.characters.find((candidate) => candidate.id === target.characterId || candidate.id === target.targetId);
  if (target.kind === "character") return { exists: Boolean(character), label: character?.name || target.label, workspace: "plan", blockNumber: null, miniBlockNumber: null, sceneNumber: null };
  const frame = project.blocks.flatMap((candidate) => candidate.visuals.map((visual) => ({ block: candidate, visual }))).find((entry) => entry.visual.id === target.frameId || entry.visual.id === target.targetId);
  if (target.kind === "storyboard-frame") return { exists: Boolean(frame), label: frame ? `Block ${frame.block.number} · storyboard frame` : target.label, workspace: "storyboard", blockNumber: frame?.block.number ?? null, miniBlockNumber: frame?.visual.miniBlockNumber ?? null, sceneNumber: null };
  const production = [
    ...project.production.shots.map((item) => ({ id: item.id, blockNumber: item.blockNumber })),
    ...project.production.cues.map((item) => ({ id: item.id, blockNumber: item.blockNumber })),
    ...project.production.breakdowns.map((item) => ({ id: item.id, blockNumber: item.blockNumber })),
  ].find((item) => item.id === target.productionItemId || item.id === target.targetId);
  if (target.kind === "production-item") return { exists: Boolean(production), label: target.label, workspace: "refine", blockNumber: production?.blockNumber ?? null, miniBlockNumber: null, sceneNumber: null };
  return { exists: Boolean(target.targetId), label: target.label, workspace: target.workspace, blockNumber: block?.number ?? null, miniBlockNumber: null, sceneNumber: scene?.scene.number ?? null };
}

export function createUnifiedFeedbackModel(project: PlotPickleProject, filters: FeedbackFilters = {}): UnifiedFeedbackModel {
  const threadRecords = project.review.threads.map((thread) => recordFromThread(project, thread));
  const passRecords = savedSpecialistPasses(project).map((pass) => recordFromSpecialistPass(project, pass));
  const diagnosticRecords = createMiniBlockWallModel(project, DEFAULT_MINI_BLOCK_WALL_STATE).warnings.map((warning, index) => recordFromDiagnostic(project, warning, index));
  const records = [...threadRecords, ...passRecords, ...diagnosticRecords]
    .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt) || left.id.localeCompare(right.id));
  const query = normalized(filters.query || "");
  const visibleRecords = records.filter((record) => {
    if (filters.includeResolved === false && ["accepted", "partially-accepted", "rejected", "resolved"].includes(record.status)) return false;
    if (filters.statuses?.length && !filters.statuses.includes(record.status)) return false;
    if (filters.sources?.length && !filters.sources.includes(record.source)) return false;
    if (filters.priorities?.length && !filters.priorities.includes(record.priority)) return false;
    if (filters.categories?.length && !filters.categories.includes(record.category)) return false;
    if (filters.targetKinds?.length && !filters.targetKinds.includes(record.target.kind)) return false;
    if (filters.targetId && record.target.targetId !== filters.targetId && record.target.blockId !== filters.targetId && record.target.sceneId !== filters.targetId && record.target.miniBlockId !== filters.targetId) return false;
    if (query) {
      const haystack = normalized(`${record.title} ${record.body} ${record.proposedChange} ${record.resolution} ${record.target.label} ${record.author}`);
      if (!haystack.includes(query)) return false;
    }
    return true;
  });
  const byStatus = Object.fromEntries(FEEDBACK_STATUSES.map((status) => [status, records.filter((record) => record.status === status).length])) as Record<FeedbackStatus, number>;
  const bySection: Record<FeedbackSection, number> = {
    overview: records.length,
    "ai-review": records.filter((record) => record.source === "ai" || record.source === "diagnostic").length,
    "human-review": records.filter((record) => ["human", "collaboration", "approval"].includes(record.source)).length,
    "writers-room": records.filter((record) => record.source === "writers-room").length,
    "shooting-script": records.filter((record) => record.source === "shooting-script" || record.target.kind === "production-item").length,
    "table-read": records.filter((record) => record.source === "table-read" || record.category === "performance").length,
  };
  const badges = new Map<string, number>();
  records.filter((record) => !["rejected", "resolved"].includes(record.status)).forEach((record) => {
    const keys = new Set([
      feedbackBadgeKey(record.target),
      record.target.blockId ? `block:${record.target.blockId}` : "",
      record.target.miniBlockId ? `mini-block:${record.target.miniBlockId}` : "",
      record.target.sceneId ? `scene:${record.target.sceneId}` : "",
      record.target.characterId ? `character:${record.target.characterId}` : "",
      record.target.frameId ? `storyboard-frame:${record.target.frameId}` : "",
      record.target.screenplayElementId ? `screenplay:${record.target.screenplayElementId}` : "",
    ].filter(Boolean));
    keys.forEach((key) => badges.set(key, (badges.get(key) ?? 0) + 1));
  });
  return {
    records,
    visibleRecords,
    counts: {
      total: records.length,
      active: records.filter((record) => !["accepted", "partially-accepted", "rejected", "resolved"].includes(record.status)).length,
      resolved: records.filter((record) => ["accepted", "partially-accepted", "rejected", "resolved"].includes(record.status)).length,
      ai: records.filter((record) => record.source === "ai").length,
      human: records.filter((record) => ["human", "collaboration", "approval"].includes(record.source)).length,
      diagnostics: records.filter((record) => record.source === "diagnostic").length,
    },
    byStatus,
    bySection,
    badges,
  };
}
