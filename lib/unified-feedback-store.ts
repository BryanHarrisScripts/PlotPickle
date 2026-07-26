import {
  cloneProject,
  type PlotPickleProject,
  type ReviewAnchor,
  type ReviewComment,
  type ReviewPriority,
  type ReviewThread,
  type ReviewThreadStatus,
} from "./project";
import {
  createUnifiedFeedbackModel,
  FEEDBACK_STATUSES,
  feedbackBadgeKey,
  type FeedbackAuthorRole,
  type FeedbackCategory,
  type FeedbackFilters,
  type FeedbackSection,
  type FeedbackSource,
  type FeedbackStatus,
  type FeedbackTargetKind,
  type FeedbackTargetReference,
  type UnifiedFeedbackModel,
  type UnifiedFeedbackRecord,
} from "./unified-feedback";

export const FEEDBACK_METADATA_PREFIX = "PLOTPICKLE_FEEDBACK_META ";

export type StoredFeedbackMetadata = {
  version: 1;
  target: FeedbackTargetReference;
  role: FeedbackAuthorRole;
  source: FeedbackSource;
  status: FeedbackStatus;
  category: FeedbackCategory;
  proposedChange: string;
  resolution: string;
  linkedRevisionId: string;
};

export type CreateFeedbackInput = {
  title: string;
  body: string;
  author: string;
  role: FeedbackAuthorRole;
  source: FeedbackSource;
  status?: FeedbackStatus;
  priority: ReviewPriority;
  category: FeedbackCategory;
  proposedChange?: string;
  target: FeedbackTargetReference;
  linkedRevisionId?: string;
};

export type UpdateFeedbackInput = Partial<Pick<StoredFeedbackMetadata,
  "role" | "source" | "status" | "category" | "proposedChange" | "resolution" | "linkedRevisionId"
>> & {
  title?: string;
  priority?: ReviewPriority;
};

export type FeedbackTargetOption = {
  kind: FeedbackTargetKind;
  target: FeedbackTargetReference;
};

function makeId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function timestamp() {
  return new Date().toISOString();
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function legacyStatus(status: FeedbackStatus): ReviewThreadStatus {
  if (status === "under-review") return "in-review";
  if (status === "deferred") return "deferred";
  if (["accepted", "partially-accepted", "rejected", "resolved"].includes(status)) return "resolved";
  return "open";
}

function legacyAnchor(target: FeedbackTargetReference): ReviewAnchor {
  if (target.kind === "block") return { kind: "block", targetId: target.targetId, label: target.label };
  if (target.kind === "scene") return { kind: "scene", targetId: target.targetId, label: target.label };
  if (["screenplay", "dialogue-passage", "action-passage"].includes(target.kind)) {
    return { kind: "screenplay-element", targetId: target.screenplayElementId || target.targetId, label: target.label };
  }
  if (target.kind === "character") return { kind: "character", targetId: target.targetId, label: target.label };
  if (["world", "treatment", "relationship", "visual-identity"].includes(target.kind)) {
    return { kind: "story-field", targetId: target.targetId, label: target.label };
  }
  return { kind: "project", targetId: target.targetId, label: target.label };
}

export function serializeFeedbackMetadata(metadata: StoredFeedbackMetadata) {
  return `${FEEDBACK_METADATA_PREFIX}${JSON.stringify(metadata)}`;
}

export function parseFeedbackMetadata(comment: Pick<ReviewComment, "body"> | undefined): StoredFeedbackMetadata | null {
  if (!comment?.body.startsWith(FEEDBACK_METADATA_PREFIX)) return null;
  try {
    const candidate = JSON.parse(comment.body.slice(FEEDBACK_METADATA_PREFIX.length)) as Partial<StoredFeedbackMetadata>;
    if (candidate.version !== 1 || !candidate.target || !candidate.role || !candidate.source || !candidate.status || !candidate.category) return null;
    if (!FEEDBACK_STATUSES.includes(candidate.status as FeedbackStatus)) return null;
    return {
      version: 1,
      target: candidate.target as FeedbackTargetReference,
      role: candidate.role as FeedbackAuthorRole,
      source: candidate.source as FeedbackSource,
      status: candidate.status as FeedbackStatus,
      category: candidate.category as FeedbackCategory,
      proposedChange: text(candidate.proposedChange),
      resolution: text(candidate.resolution),
      linkedRevisionId: text(candidate.linkedRevisionId),
    };
  } catch {
    return null;
  }
}

function metadataComment(thread: ReviewThread) {
  return thread.comments.find((comment) => comment.body.startsWith(FEEDBACK_METADATA_PREFIX));
}

function visibleComments(thread: ReviewThread) {
  return thread.comments.filter((comment) => !comment.body.startsWith(FEEDBACK_METADATA_PREFIX));
}

function defaultMetadata(record: UnifiedFeedbackRecord): StoredFeedbackMetadata {
  return {
    version: 1,
    target: record.target,
    role: record.role,
    source: record.source,
    status: record.status,
    category: record.category,
    proposedChange: record.proposedChange,
    resolution: record.resolution,
    linkedRevisionId: record.linkedRevisionId,
  };
}

function replaceMetadataComment(thread: ReviewThread, metadata: StoredFeedbackMetadata, now: string): ReviewComment[] {
  const current = metadataComment(thread);
  const replacement: ReviewComment = {
    id: current?.id || makeId("feedback-meta"),
    author: "PlotPickle",
    body: serializeFeedbackMetadata(metadata),
    createdAt: current?.createdAt || now,
  };
  return [replacement, ...visibleComments(thread)];
}

export function createFeedback(project: PlotPickleProject, input: CreateFeedbackInput): PlotPickleProject {
  if (!text(input.body)) return project;
  const next = cloneProject(project);
  const now = timestamp();
  const metadata: StoredFeedbackMetadata = {
    version: 1,
    target: input.target,
    role: input.role,
    source: input.source,
    status: input.status || "open",
    category: input.category,
    proposedChange: text(input.proposedChange),
    resolution: "",
    linkedRevisionId: text(input.linkedRevisionId),
  };
  const thread: ReviewThread = {
    id: makeId("feedback-thread"),
    title: text(input.title) || "Feedback note",
    anchor: legacyAnchor(input.target),
    status: legacyStatus(metadata.status),
    priority: input.priority,
    comments: [
      { id: makeId("feedback-meta"), author: "PlotPickle", body: serializeFeedbackMetadata(metadata), createdAt: now },
      { id: makeId("feedback-comment"), author: text(input.author) || "Local reviewer", body: text(input.body), createdAt: now },
    ],
    createdAt: now,
    updatedAt: now,
    resolvedAt: ["accepted", "partially-accepted", "rejected", "resolved"].includes(metadata.status) ? now : "",
  };
  next.review.threads.push(thread);
  next.metadata.updatedAt = now;
  return next;
}

export function updateFeedback(project: PlotPickleProject, recordId: string, patch: UpdateFeedbackInput): PlotPickleProject {
  const baseRecord = createUnifiedFeedbackModel(project).records.find((record) => record.id === recordId || record.originId === recordId);
  if (!baseRecord || baseRecord.synthetic) return project;
  const next = cloneProject(project);
  const now = timestamp();
  let changed = false;
  next.review.threads = next.review.threads.map((thread) => {
    if (thread.id !== baseRecord.originId) return thread;
    const current = parseFeedbackMetadata(metadataComment(thread)) || defaultMetadata(baseRecord);
    const metadata: StoredFeedbackMetadata = {
      ...current,
      role: patch.role ?? current.role,
      source: patch.source ?? current.source,
      status: patch.status ?? current.status,
      category: patch.category ?? current.category,
      proposedChange: patch.proposedChange === undefined ? current.proposedChange : text(patch.proposedChange),
      resolution: patch.resolution === undefined ? current.resolution : text(patch.resolution),
      linkedRevisionId: patch.linkedRevisionId === undefined ? current.linkedRevisionId : text(patch.linkedRevisionId),
    };
    const title = patch.title === undefined ? thread.title : text(patch.title) || thread.title;
    const priority = patch.priority ?? thread.priority;
    changed = true;
    return {
      ...thread,
      title,
      priority,
      anchor: legacyAnchor(metadata.target),
      status: legacyStatus(metadata.status),
      comments: replaceMetadataComment(thread, metadata, now),
      updatedAt: now,
      resolvedAt: ["accepted", "partially-accepted", "rejected", "resolved"].includes(metadata.status) ? thread.resolvedAt || now : "",
    };
  });
  if (!changed) return project;
  next.metadata.updatedAt = now;
  return next;
}

export function addFeedbackComment(project: PlotPickleProject, recordId: string, author: string, body: string): PlotPickleProject {
  const content = text(body);
  if (!content) return project;
  const baseRecord = createUnifiedFeedbackModel(project).records.find((record) => record.id === recordId || record.originId === recordId);
  if (!baseRecord || baseRecord.synthetic) return project;
  const next = cloneProject(project);
  const now = timestamp();
  next.review.threads = next.review.threads.map((thread) => thread.id === baseRecord.originId
    ? {
        ...thread,
        comments: [...thread.comments, { id: makeId("feedback-comment"), author: text(author) || "Local reviewer", body: content, createdAt: now }],
        updatedAt: now,
      }
    : thread);
  next.metadata.updatedAt = now;
  return next;
}

function overlayStoredMetadata(project: PlotPickleProject, record: UnifiedFeedbackRecord): UnifiedFeedbackRecord {
  if (record.synthetic) return record;
  const thread = project.review.threads.find((candidate) => candidate.id === record.originId);
  if (!thread) return record;
  const metadata = parseFeedbackMetadata(metadataComment(thread));
  if (!metadata) return record;
  const messages = visibleComments(thread).map((comment) => ({
    id: comment.id,
    author: comment.author,
    role: metadata.role,
    source: metadata.source,
    body: comment.body,
    createdAt: comment.createdAt,
  }));
  return {
    ...record,
    target: metadata.target,
    author: messages[0]?.author || record.author,
    role: metadata.role,
    source: metadata.source,
    body: messages[0]?.body || record.body,
    status: metadata.status,
    category: metadata.category,
    proposedChange: metadata.proposedChange,
    thread: messages,
    resolution: metadata.resolution,
    linkedRevisionId: metadata.linkedRevisionId,
  };
}

function recordMatches(record: UnifiedFeedbackRecord, filters: FeedbackFilters) {
  const query = text(filters.query).toLocaleLowerCase().replace(/\s+/g, " ");
  if (filters.includeResolved === false && ["accepted", "partially-accepted", "rejected", "resolved"].includes(record.status)) return false;
  if (filters.statuses?.length && !filters.statuses.includes(record.status)) return false;
  if (filters.sources?.length && !filters.sources.includes(record.source)) return false;
  if (filters.priorities?.length && !filters.priorities.includes(record.priority)) return false;
  if (filters.categories?.length && !filters.categories.includes(record.category)) return false;
  if (filters.targetKinds?.length && !filters.targetKinds.includes(record.target.kind)) return false;
  if (filters.targetId && ![record.target.targetId, record.target.blockId, record.target.miniBlockId, record.target.sceneId, record.target.characterId, record.target.frameId, record.target.screenplayElementId, record.target.productionItemId].includes(filters.targetId)) return false;
  if (!query) return true;
  return `${record.title} ${record.body} ${record.proposedChange} ${record.resolution} ${record.target.label} ${record.author}`.toLocaleLowerCase().replace(/\s+/g, " ").includes(query);
}

function summarize(records: UnifiedFeedbackRecord[], visibleRecords: UnifiedFeedbackRecord[]): UnifiedFeedbackModel {
  const byStatus = Object.fromEntries(FEEDBACK_STATUSES.map((status) => [status, records.filter((record) => record.status === status).length])) as UnifiedFeedbackModel["byStatus"];
  const bySection: Record<FeedbackSection, number> = {
    overview: records.length,
    "ai-review": records.filter((record) => ["ai", "diagnostic"].includes(record.source)).length,
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
      record.target.productionItemId ? `production-item:${record.target.productionItemId}` : "",
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

export function createStoredFeedbackModel(project: PlotPickleProject, filters: FeedbackFilters = {}): UnifiedFeedbackModel {
  const records = createUnifiedFeedbackModel(project).records.map((record) => overlayStoredMetadata(project, record));
  return summarize(records, records.filter((record) => recordMatches(record, filters)));
}

function target(
  kind: FeedbackTargetKind,
  targetId: string,
  label: string,
  workspace: FeedbackTargetReference["workspace"],
  details: Partial<Omit<FeedbackTargetReference, "kind" | "targetId" | "label" | "workspace">> = {},
): FeedbackTargetReference {
  return {
    kind,
    targetId,
    label,
    workspace,
    blockId: "",
    miniBlockId: "",
    sceneId: "",
    characterId: "",
    frameId: "",
    screenplayElementId: "",
    productionItemId: "",
    ...details,
  };
}

export function feedbackTargetOptions(project: PlotPickleProject): FeedbackTargetOption[] {
  const options: FeedbackTargetOption[] = [
    { kind: "project", target: target("project", project.id, project.metadata.title, "feedback") },
    ...[1, 2, 3, 4].map((act) => ({ kind: "act" as const, target: target("act", String(act), `Act ${act}`, "build") })),
    ...project.structure.sequences.map((sequence) => ({ kind: "sequence" as const, target: target("sequence", sequence.id, `Sequence ${sequence.number} · ${sequence.title}`, "build") })),
    ...project.blocks.map((block) => ({ kind: "block" as const, target: target("block", block.id, `Block ${block.number} · ${block.title}`, "build", { blockId: block.id }) })),
    ...project.blocks.flatMap((block) => block.scenes.flatMap((scene) => scene.miniBlocks.map((mini) => ({ kind: "mini-block" as const, target: target("mini-block", mini.id, `Block ${block.number} · ${mini.label || `Mini-block ${mini.number}`}`, "build", { blockId: block.id, miniBlockId: mini.id, sceneId: scene.id, characterId: mini.characterId }) })))),
    ...project.characters.map((character) => ({ kind: "character" as const, target: target("character", character.id, character.name || "Unnamed character", "plan", { characterId: character.id }) })),
    ...project.characters.flatMap((character) => character.relationships.map((relationship, index) => ({ kind: "relationship" as const, target: target("relationship", `${character.id}:relationship:${index}`, `${character.name} · ${relationship.label}`, "plan", { characterId: character.id }) }))),
    { kind: "world", target: target("world", `${project.id}:world`, "World and locations", "plan") },
    { kind: "treatment", target: target("treatment", `${project.id}:treatment`, "Treatment and story development", "plan") },
    { kind: "screenplay", target: target("screenplay", `${project.id}:screenplay`, "Whole screenplay", "write") },
    ...project.blocks.flatMap((block) => block.scenes.map((scene) => ({ kind: "scene" as const, target: target("scene", scene.id, `Scene ${scene.number} · ${scene.title}`, "write", { blockId: block.id, sceneId: scene.id }) }))),
    ...project.screenplay.draftElements.filter((element) => ["dialogue", "dual-dialogue"].includes(element.type)).map((element) => ({ kind: "dialogue-passage" as const, target: target("dialogue-passage", element.id, `Scene ${element.sceneNumber} · dialogue`, "write", { blockId: project.blocks.find((block) => block.number === element.blockNumber)?.id || "", sceneId: element.sceneId || "", screenplayElementId: element.id }) })),
    ...project.screenplay.draftElements.filter((element) => element.type === "action").map((element) => ({ kind: "action-passage" as const, target: target("action-passage", element.id, `Scene ${element.sceneNumber} · action`, "write", { blockId: project.blocks.find((block) => block.number === element.blockNumber)?.id || "", sceneId: element.sceneId || "", screenplayElementId: element.id }) })),
    ...project.blocks.flatMap((block) => block.visuals.map((frame) => ({ kind: "storyboard-frame" as const, target: target("storyboard-frame", frame.id, `Block ${block.number} · frame ${frame.miniBlockNumber}`, "storyboard", { blockId: block.id, frameId: frame.id }) }))),
    { kind: "visual-identity", target: target("visual-identity", `${project.id}:visual-identity`, "Project visual identity", "storyboard") },
    ...project.production.shots.map((shot) => ({ kind: "production-item" as const, target: target("production-item", shot.id, `Shot ${shot.shotNumber} · Block ${shot.blockNumber}`, "refine", { blockId: project.blocks.find((block) => block.number === shot.blockNumber)?.id || "", sceneId: shot.sceneId, frameId: shot.frameId, productionItemId: shot.id }) })),
    ...project.production.cues.map((cue) => ({ kind: "production-item" as const, target: target("production-item", cue.id, `Cue ${cue.cueNumber} · ${cue.title}`, "refine", { blockId: project.blocks.find((block) => block.number === cue.blockNumber)?.id || "", sceneId: cue.sceneId, productionItemId: cue.id }) })),
    ...project.production.breakdowns.map((breakdown) => ({ kind: "production-item" as const, target: target("production-item", breakdown.id, `Production breakdown · Block ${breakdown.blockNumber}`, "refine", { blockId: project.blocks.find((block) => block.number === breakdown.blockNumber)?.id || "", sceneId: breakdown.sceneId, productionItemId: breakdown.id }) })),
  ];
  return options;
}
