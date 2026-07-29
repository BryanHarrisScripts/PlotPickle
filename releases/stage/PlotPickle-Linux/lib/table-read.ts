import type {
  Character,
  PlotPickleProject,
  ReviewThread,
  ScreenplayDraftElement,
} from "./project";
import { createFeedback } from "./unified-feedback-store";
import type { FeedbackTargetReference } from "./unified-feedback";

const PREFIX = "plotpickle:table-read:v1:";

export type TableReadScope = "scene" | "sequence" | "screenplay";

export type TableReadVoiceAssignment = {
  characterId: string;
  characterName: string;
  voiceURI: string;
  rate: number;
  pitch: number;
};

export type TableReadPronunciation = {
  id: string;
  phrase: string;
  replacement: string;
};

export type TableReadNote = {
  id: string;
  target: FeedbackTargetReference;
  author: string;
  body: string;
  createdAt: string;
};

export type TableReadSession = {
  id: string;
  title: string;
  scope: TableReadScope;
  startSceneId: string;
  sceneIds: string[];
  currentElementId: string;
  completedElementIds: string[];
  voiceAssignments: TableReadVoiceAssignment[];
  narratorVoiceURI: string;
  narratorRate: number;
  narratorPitch: number;
  pronunciations: TableReadPronunciation[];
  notes: TableReadNote[];
  summary: string;
  startedAt: string;
  endedAt: string;
  actualDurationSeconds: number;
  createdAt: string;
  updatedAt: string;
};

export type TableReadItem = {
  id: string;
  element: ScreenplayDraftElement;
  sceneId: string;
  sceneNumber: number;
  sceneLabel: string;
  speakerName: string;
  characterId: string;
  narrator: boolean;
  text: string;
  target: FeedbackTargetReference;
  estimatedSeconds: number;
};

export type ActorSideLine = {
  id: string;
  sceneId: string;
  sceneLabel: string;
  cue: string;
  line: string;
  target: FeedbackTargetReference;
};

function makeId(prefix: string) {
  return `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

function cleanSpeaker(value: string) {
  return value.trim().replace(/\s*\(.*\)\s*$/, "").replace(/\s+/g, " ");
}

function characterForSpeaker(characters: Character[], speaker: string) {
  const normalized = cleanSpeaker(speaker).toLocaleLowerCase();
  return characters.find((character) => cleanSpeaker(character.name).toLocaleLowerCase() === normalized);
}

function words(value: string) {
  return value.trim() ? value.trim().split(/\s+/).length : 0;
}

function targetForElement(project: PlotPickleProject, element: ScreenplayDraftElement, sceneLabel: string): FeedbackTargetReference {
  const dialogue = element.type === "dialogue" || element.type === "dual-dialogue";
  const action = element.type === "action";
  return {
    kind: dialogue ? "dialogue-passage" : action ? "action-passage" : "screenplay",
    targetId: element.id,
    label: `${sceneLabel} · ${dialogue ? "dialogue" : action ? "action" : element.type}`,
    workspace: "write",
    blockId: project.blocks.find((block) => block.number === element.blockNumber)?.id || "",
    miniBlockId: "",
    sceneId: element.sceneId || "",
    characterId: "",
    frameId: "",
    screenplayElementId: element.id,
    productionItemId: "",
  };
}

export function tableReadItems(project: PlotPickleProject): TableReadItem[] {
  let speaker = "";
  const readableTypes = new Set([
    "scene-heading",
    "action",
    "parenthetical",
    "dialogue",
    "dual-dialogue",
    "transition",
    "lyrics",
  ]);
  return project.screenplay.draftElements.flatMap((element) => {
    if (element.type === "character") {
      speaker = cleanSpeaker(element.text);
      return [];
    }
    if (!readableTypes.has(element.type) || element.omitted || !element.text.trim()) return [];
    const dialogue = element.type === "dialogue" || element.type === "dual-dialogue" || element.type === "lyrics";
    const character = dialogue ? characterForSpeaker(project.characters, speaker) : undefined;
    const scene = project.blocks
      .flatMap((block) => block.scenes)
      .find((candidate) => candidate.id === element.sceneId)
      ?? project.blocks
        .find((block) => block.number === element.blockNumber)
        ?.scenes.find((candidate) => candidate.number === element.sceneNumber);
    const sceneId = element.sceneId || scene?.id || `scene-${element.sceneNumber}`;
    const sceneLabel = `Scene ${element.sceneNumber}${scene?.title ? ` · ${scene.title}` : ""}`;
    const narrator = !dialogue;
    const estimatedSeconds = Math.max(1, Math.ceil((words(element.text) / (narrator ? 175 : 150)) * 60 + (narrator ? 0.8 : 0.5)));
    return [{
      id: element.id,
      element,
      sceneId,
      sceneNumber: element.sceneNumber,
      sceneLabel,
      speakerName: dialogue ? speaker || "Unassigned speaker" : "Narrator",
      characterId: character?.id || "",
      narrator,
      text: element.text,
      target: targetForElement(project, { ...element, sceneId }, sceneLabel),
      estimatedSeconds,
    }];
  });
}

export function tableReadSceneOptions(project: PlotPickleProject) {
  const items = tableReadItems(project);
  const seen = new Set<string>();
  return items.flatMap((item) => {
    if (seen.has(item.sceneId)) return [];
    seen.add(item.sceneId);
    return [{ id: item.sceneId, number: item.sceneNumber, label: item.sceneLabel }];
  });
}

export function itemsForTableReadScope(
  project: PlotPickleProject,
  scope: TableReadScope,
  startSceneId: string,
) {
  const items = tableReadItems(project);
  if (scope === "screenplay") return items;
  if (scope === "scene") return items.filter((item) => item.sceneId === startSceneId);
  const start = items.find((item) => item.sceneId === startSceneId);
  if (!start) return [];
  const sequenceNumber = project.blocks.find((block) => block.number === start.element.blockNumber)?.sequenceNumber;
  const blockNumbers = new Set(project.blocks.filter((block) => block.sequenceNumber === sequenceNumber).map((block) => block.number));
  return items.filter((item) => blockNumbers.has(item.element.blockNumber));
}

export function estimatedTableReadSeconds(items: TableReadItem[]) {
  return items.reduce((total, item) => total + item.estimatedSeconds, 0);
}

export function formatTableReadDuration(seconds: number) {
  const safe = Math.max(0, Math.round(seconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const remainder = safe % 60;
  return hours ? `${hours}h ${minutes}m` : minutes ? `${minutes}m ${remainder}s` : `${remainder}s`;
}

export function actorSides(project: PlotPickleProject, characterId: string): ActorSideLine[] {
  const items = tableReadItems(project);
  let previousDialogue = "";
  return items.flatMap((item) => {
    if (item.narrator) return [];
    const cue = previousDialogue;
    previousDialogue = `${item.speakerName}: ${item.text}`;
    if (item.characterId !== characterId) return [];
    return [{ id: item.id, sceneId: item.sceneId, sceneLabel: item.sceneLabel, cue, line: item.text, target: item.target }];
  });
}

function escapePattern(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function applyTableReadPronunciations(text: string, rules: TableReadPronunciation[]) {
  return rules.reduce((value, rule) => {
    if (!rule.phrase.trim() || !rule.replacement.trim()) return value;
    return value.replace(new RegExp(escapePattern(rule.phrase.trim()), "gi"), rule.replacement.trim());
  }, text);
}

function encode(session: TableReadSession) {
  return `${PREFIX}${JSON.stringify(session)}`;
}

function decode(thread: ReviewThread): TableReadSession | null {
  const comment = thread.comments.find((item) => item.body.startsWith(PREFIX));
  if (!comment) return null;
  try {
    const value = JSON.parse(comment.body.slice(PREFIX.length)) as TableReadSession;
    return value?.id && value?.title ? value : null;
  } catch {
    return null;
  }
}

export function tableReadSessions(project: PlotPickleProject) {
  return project.review.threads
    .map((thread) => ({ thread, session: decode(thread) }))
    .filter((item): item is { thread: ReviewThread; session: TableReadSession } => Boolean(item.session))
    .sort((left, right) => right.session.createdAt.localeCompare(left.session.createdAt));
}

export function createTableReadSession(
  project: PlotPickleProject,
  input: { title: string; scope: TableReadScope; startSceneId: string },
) {
  const now = new Date().toISOString();
  const scopedItems = itemsForTableReadScope(project, input.scope, input.startSceneId);
  const session: TableReadSession = {
    id: makeId("table-read"),
    title: input.title.trim() || "Table Read session",
    scope: input.scope,
    startSceneId: input.startSceneId,
    sceneIds: [...new Set(scopedItems.map((item) => item.sceneId))],
    currentElementId: scopedItems[0]?.id || "",
    completedElementIds: [],
    voiceAssignments: project.characters.map((character) => ({
      characterId: character.id,
      characterName: character.name,
      voiceURI: "",
      rate: 1,
      pitch: 1,
    })),
    narratorVoiceURI: "",
    narratorRate: 1,
    narratorPitch: 1,
    pronunciations: [],
    notes: [],
    summary: "",
    startedAt: "",
    endedAt: "",
    actualDurationSeconds: 0,
    createdAt: now,
    updatedAt: now,
  };
  const thread: ReviewThread = {
    id: session.id,
    title: session.title,
    anchor: { kind: "screenplay-element", targetId: session.currentElementId || project.id, label: "Table Read session" },
    status: "open",
    priority: "normal",
    labels: ["table-read", "session"],
    comments: [{ id: makeId("table-read-record"), author: "PlotPickle", body: encode(session), createdAt: now }],
    createdAt: now,
    updatedAt: now,
  };
  return { ...project, review: { ...project.review, threads: [...project.review.threads, thread] } };
}

export function updateTableReadSession(
  project: PlotPickleProject,
  sessionId: string,
  updater: (session: TableReadSession) => TableReadSession,
) {
  const now = new Date().toISOString();
  return {
    ...project,
    metadata: { ...project.metadata, updatedAt: now },
    review: {
      ...project.review,
      threads: project.review.threads.map((thread) => {
        const session = thread.id === sessionId ? decode(thread) : null;
        if (!session) return thread;
        const next = { ...updater(session), id: session.id, createdAt: session.createdAt, updatedAt: now };
        return {
          ...thread,
          title: next.title,
          anchor: { ...thread.anchor, targetId: next.currentElementId || thread.anchor.targetId },
          updatedAt: now,
          comments: [
            ...thread.comments.filter((comment) => !comment.body.startsWith(PREFIX)),
            { id: makeId("table-read-record"), author: "PlotPickle", body: encode(next), createdAt: now },
          ],
        };
      }),
    },
  };
}

export function recordTableReadNote(
  project: PlotPickleProject,
  sessionId: string,
  target: FeedbackTargetReference,
  author: string,
  body: string,
) {
  const content = body.trim();
  if (!content) return project;
  const note: TableReadNote = {
    id: makeId("table-read-note"),
    target,
    author: author.trim() || "Reader",
    body: content,
    createdAt: new Date().toISOString(),
  };
  const updated = updateTableReadSession(project, sessionId, (session) => ({ ...session, notes: [...session.notes, note] }));
  return createFeedback(updated, {
    title: `Table Read: ${target.label}`,
    body: content,
    author: note.author,
    role: "actor",
    source: "table-read",
    status: "open",
    priority: "normal",
    category: "performance",
    target,
  });
}

export function finishTableReadSession(project: PlotPickleProject, sessionId: string, actualDurationSeconds: number) {
  return updateTableReadSession(project, sessionId, (session) => {
    const endedAt = new Date().toISOString();
    const completed = new Set(session.completedElementIds);
    const summary = session.summary.trim() || [
      `${session.title} covered ${completed.size} screenplay elements across ${session.sceneIds.length} scene${session.sceneIds.length === 1 ? "" : "s"}.`,
      `${session.notes.length} anchored rehearsal note${session.notes.length === 1 ? "" : "s"} recorded.`,
    ].join(" ");
    return { ...session, endedAt, actualDurationSeconds: Math.max(0, Math.round(actualDurationSeconds)), summary };
  });
}

export function tableReadSessionReport(project: PlotPickleProject, session: TableReadSession) {
  const items = itemsForTableReadScope(project, session.scope, session.startSceneId);
  const completed = new Set(session.completedElementIds);
  return {
    lineCount: items.length,
    sceneCount: new Set(items.map((item) => item.sceneId)).size,
    estimatedSeconds: estimatedTableReadSeconds(items),
    actualDurationSeconds: session.actualDurationSeconds,
    completedCount: items.filter((item) => completed.has(item.id)).length,
    noteCount: session.notes.length,
  };
}
