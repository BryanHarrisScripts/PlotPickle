import {
  cloneProject,
  type ComicPitchDeck,
  type ComicPitchDialogue,
  type ComicPitchPanel,
  type PlotPickleProject,
} from "./project";

export const GRAPHIC_NOVEL_DIALOGUE_EXTENSION_KEY = "plotpickle.graphicNovelDialogue.v1";

export const GRAPHIC_NOVEL_BALLOON_KINDS = ["speech", "thought", "whisper", "shout"] as const;
export const GRAPHIC_NOVEL_CAPTION_PLACEMENTS = ["below", "top-left", "top-right", "bottom-overlay"] as const;

export type GraphicNovelBalloonKind = typeof GRAPHIC_NOVEL_BALLOON_KINDS[number];
export type GraphicNovelCaptionPlacement = typeof GRAPHIC_NOVEL_CAPTION_PLACEMENTS[number];

export type GraphicNovelBalloonDirection = {
  panelId: string;
  dialogueId: string;
  kind: GraphicNovelBalloonKind;
  emotionalDelivery: string;
  readingOrder: number;
  maxCharacters: number;
  originalText: string;
};

export type GraphicNovelCaptionDirection = {
  panelId: string;
  placement: GraphicNovelCaptionPlacement;
  readingOrder: number;
  maxCharacters: number;
  originalText: string;
};

export type GraphicNovelDialogueState = {
  version: 1;
  balloons: Record<string, GraphicNovelBalloonDirection>;
  captions: Record<string, GraphicNovelCaptionDirection>;
  updatedAt: string;
};

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function text(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function integer(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = Math.round(Number(value));
  return Number.isFinite(parsed) ? Math.min(maximum, Math.max(minimum, parsed)) : fallback;
}

function oneOf<T extends readonly string[]>(value: unknown, values: T, fallback: T[number]): T[number] {
  return values.includes(value as T[number]) ? value as T[number] : fallback;
}

export function createGraphicNovelDialogueState(now = new Date().toISOString()): GraphicNovelDialogueState {
  return { version: 1, balloons: {}, captions: {}, updatedAt: now };
}

export function getGraphicNovelDialogueState(project: PlotPickleProject): GraphicNovelDialogueState {
  const candidate = record(project.extensions?.[GRAPHIC_NOVEL_DIALOGUE_EXTENSION_KEY]);
  if (!candidate) return createGraphicNovelDialogueState(project.metadata.updatedAt);
  const balloonsSource = record(candidate.balloons) ?? {};
  const captionsSource = record(candidate.captions) ?? {};
  const balloons = Object.fromEntries(Object.entries(balloonsSource).flatMap(([key, value]) => {
    const item = record(value);
    if (!item) return [];
    const dialogueId = text(item.dialogueId, key);
    if (!dialogueId) return [];
    return [[dialogueId, {
      panelId: text(item.panelId),
      dialogueId,
      kind: oneOf(item.kind, GRAPHIC_NOVEL_BALLOON_KINDS, "speech"),
      emotionalDelivery: text(item.emotionalDelivery),
      readingOrder: integer(item.readingOrder, 1, 1, 20),
      maxCharacters: integer(item.maxCharacters, 120, 20, 280),
      originalText: text(item.originalText),
    } satisfies GraphicNovelBalloonDirection]];
  }));
  const captions = Object.fromEntries(Object.entries(captionsSource).flatMap(([key, value]) => {
    const item = record(value);
    if (!item) return [];
    const panelId = text(item.panelId, key);
    if (!panelId) return [];
    return [[panelId, {
      panelId,
      placement: oneOf(item.placement, GRAPHIC_NOVEL_CAPTION_PLACEMENTS, "below"),
      readingOrder: integer(item.readingOrder, 4, 1, 20),
      maxCharacters: integer(item.maxCharacters, 180, 40, 500),
      originalText: text(item.originalText),
    } satisfies GraphicNovelCaptionDirection]];
  }));
  return {
    version: 1,
    balloons,
    captions,
    updatedAt: text(candidate.updatedAt, project.metadata.updatedAt),
  };
}

export function withGraphicNovelDialogueState(project: PlotPickleProject, state: GraphicNovelDialogueState): PlotPickleProject {
  const next = cloneProject(project);
  next.extensions = {
    ...(next.extensions ?? {}),
    [GRAPHIC_NOVEL_DIALOGUE_EXTENSION_KEY]: {
      ...state,
      version: 1,
      updatedAt: state.updatedAt || new Date().toISOString(),
    },
  };
  return next;
}

function sourceDialogue(project: PlotPickleProject, dialogue: ComicPitchDialogue) {
  if (!dialogue.sourceElementId) return "";
  return project.screenplay.draftElements.find((item) => item.id === dialogue.sourceElementId)?.text.trim() ?? "";
}

export function graphicNovelBalloon(
  project: PlotPickleProject,
  panel: ComicPitchPanel,
  dialogue: ComicPitchDialogue,
  index: number,
): GraphicNovelBalloonDirection {
  const stored = getGraphicNovelDialogueState(project).balloons[dialogue.id];
  return {
    panelId: panel.id,
    dialogueId: dialogue.id,
    kind: stored?.kind ?? "speech",
    emotionalDelivery: stored?.emotionalDelivery ?? "",
    readingOrder: stored?.readingOrder ?? index + 1,
    maxCharacters: stored?.maxCharacters ?? 120,
    originalText: stored?.originalText || sourceDialogue(project, dialogue) || dialogue.text,
  };
}

export function graphicNovelCaption(project: PlotPickleProject, panel: ComicPitchPanel): GraphicNovelCaptionDirection {
  const stored = getGraphicNovelDialogueState(project).captions[panel.id];
  return {
    panelId: panel.id,
    placement: stored?.placement ?? "below",
    readingOrder: stored?.readingOrder ?? panel.dialogue.length + 1,
    maxCharacters: stored?.maxCharacters ?? 180,
    originalText: stored?.originalText || panel.narration,
  };
}

export function updateGraphicNovelBalloon(project: PlotPickleProject, direction: GraphicNovelBalloonDirection): PlotPickleProject {
  const state = getGraphicNovelDialogueState(project);
  return withGraphicNovelDialogueState(project, {
    ...state,
    balloons: { ...state.balloons, [direction.dialogueId]: direction },
    updatedAt: new Date().toISOString(),
  });
}

export function removeGraphicNovelBalloon(project: PlotPickleProject, dialogueId: string): PlotPickleProject {
  const state = getGraphicNovelDialogueState(project);
  const balloons = { ...state.balloons };
  delete balloons[dialogueId];
  return withGraphicNovelDialogueState(project, { ...state, balloons, updatedAt: new Date().toISOString() });
}

export function updateGraphicNovelCaption(project: PlotPickleProject, direction: GraphicNovelCaptionDirection): PlotPickleProject {
  const state = getGraphicNovelDialogueState(project);
  return withGraphicNovelDialogueState(project, {
    ...state,
    captions: { ...state.captions, [direction.panelId]: direction },
    updatedAt: new Date().toISOString(),
  });
}

export function shortenGraphicNovelDialogue(value: string, maximum: number) {
  const normalized = value.trim().replace(/\s+/g, " ");
  const safeMaximum = Math.min(500, Math.max(20, Math.round(maximum) || 120));
  if (normalized.length <= safeMaximum) return normalized;
  const window = normalized.slice(0, safeMaximum - 1);
  const punctuation = Math.max(window.lastIndexOf("."), window.lastIndexOf("!"), window.lastIndexOf("?"), window.lastIndexOf(";"));
  const word = window.lastIndexOf(" ");
  const cut = punctuation >= Math.floor(safeMaximum * 0.55) ? punctuation + 1 : word >= Math.floor(safeMaximum * 0.55) ? word : safeMaximum - 1;
  return `${window.slice(0, cut).trim().replace(/[,:;-]+$/, "")}…`;
}

export function graphicNovelDialogueIssues(project: PlotPickleProject, panel: ComicPitchPanel) {
  const issues: string[] = [];
  if (!panel.imageSrc) issues.push("Image unresolved");
  panel.dialogue.forEach((dialogue, index) => {
    const direction = graphicNovelBalloon(project, panel, dialogue, index);
    if (!dialogue.text.trim()) issues.push(`Balloon ${index + 1} is empty`);
    else if (dialogue.text.trim().length > direction.maxCharacters) issues.push(`Balloon ${index + 1} is ${dialogue.text.trim().length - direction.maxCharacters} characters over`);
  });
  const caption = graphicNovelCaption(project, panel);
  if (!panel.narration.trim()) issues.push("Narration is empty");
  else if (panel.narration.trim().length > caption.maxCharacters) issues.push(`Narration is ${panel.narration.trim().length - caption.maxCharacters} characters over`);
  return issues;
}

export function graphicNovelDialogueSummary(project: PlotPickleProject, deck: ComicPitchDeck) {
  const unresolvedPanels = deck.panels.filter((panel) => graphicNovelDialogueIssues(project, panel).length).length;
  return {
    panelCount: deck.panels.length,
    balloonCount: deck.panels.reduce((total, panel) => total + panel.dialogue.length, 0),
    unresolvedPanels,
    readyPanels: deck.panels.length - unresolvedPanels,
  };
}
