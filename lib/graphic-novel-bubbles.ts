import { cloneProject, type ComicPitchPanel, type PlotPickleProject } from "./project";

export const GRAPHIC_NOVEL_BUBBLE_LAYOUT_EXTENSION = "plotpickle.graphicNovelBubbleLayout.v1" as const;

export type GraphicNovelBubbleStyle = "speech" | "thought" | "caption";
export type GraphicNovelBubbleTail = "left" | "right" | "none";

export type GraphicNovelBubblePlacement = {
  x: number;
  y: number;
  width: number;
  style: GraphicNovelBubbleStyle;
  tail: GraphicNovelBubbleTail;
  hidden: boolean;
  updatedAt: string;
};

export type GraphicNovelBubbleLayout = {
  version: 1;
  panels: Record<string, Record<string, GraphicNovelBubblePlacement>>;
  updatedAt: string;
};

const STYLES: GraphicNovelBubbleStyle[] = ["speech", "thought", "caption"];
const TAILS: GraphicNovelBubbleTail[] = ["left", "right", "none"];

function number(value: unknown, fallback: number, minimum: number, maximum: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.round(parsed * 10) / 10));
}

function defaultPlacement(index: number, total: number): GraphicNovelBubblePlacement {
  const column = index % 2;
  const row = Math.floor(index / 2);
  const width = total <= 1 ? 42 : total === 2 ? 38 : 34;
  return {
    x: column ? 100 - width - 6 : 6,
    y: 6 + Math.min(row, 3) * 23,
    width,
    style: "speech",
    tail: column ? "right" : "left",
    hidden: false,
    updatedAt: "",
  };
}

function normalizePlacement(value: unknown, fallback: GraphicNovelBubblePlacement): GraphicNovelBubblePlacement {
  if (!value || typeof value !== "object") return fallback;
  const candidate = value as Partial<GraphicNovelBubblePlacement>;
  const width = number(candidate.width, fallback.width, 18, 72);
  return {
    x: number(candidate.x, fallback.x, 0, 100 - width),
    y: number(candidate.y, fallback.y, 0, 88),
    width,
    style: STYLES.includes(candidate.style as GraphicNovelBubbleStyle) ? candidate.style as GraphicNovelBubbleStyle : fallback.style,
    tail: TAILS.includes(candidate.tail as GraphicNovelBubbleTail) ? candidate.tail as GraphicNovelBubbleTail : fallback.tail,
    hidden: Boolean(candidate.hidden),
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : fallback.updatedAt,
  };
}

export function emptyGraphicNovelBubbleLayout(): GraphicNovelBubbleLayout {
  return { version: 1, panels: {}, updatedAt: "" };
}

export function getGraphicNovelBubbleLayout(project: PlotPickleProject): GraphicNovelBubbleLayout {
  const stored = project.extensions?.[GRAPHIC_NOVEL_BUBBLE_LAYOUT_EXTENSION];
  if (!stored || typeof stored !== "object") return emptyGraphicNovelBubbleLayout();
  const candidate = stored as Partial<GraphicNovelBubbleLayout>;
  const panels: GraphicNovelBubbleLayout["panels"] = {};
  if (candidate.panels && typeof candidate.panels === "object") {
    for (const [panelId, dialogue] of Object.entries(candidate.panels)) {
      if (!dialogue || typeof dialogue !== "object") continue;
      panels[panelId] = {};
      let index = 0;
      for (const [dialogueId, placement] of Object.entries(dialogue)) {
        panels[panelId][dialogueId] = normalizePlacement(placement, defaultPlacement(index, Object.keys(dialogue).length));
        index += 1;
      }
    }
  }
  return {
    version: 1,
    panels,
    updatedAt: typeof candidate.updatedAt === "string" ? candidate.updatedAt : "",
  };
}

export function graphicNovelBubblePlacement(
  project: PlotPickleProject,
  panel: Pick<ComicPitchPanel, "id" | "dialogue">,
  dialogueId: string,
  index: number,
): GraphicNovelBubblePlacement {
  const fallback = defaultPlacement(index, panel.dialogue.length);
  return normalizePlacement(getGraphicNovelBubbleLayout(project).panels[panel.id]?.[dialogueId], fallback);
}

export function withGraphicNovelBubblePlacement(
  project: PlotPickleProject,
  panelId: string,
  dialogueId: string,
  patch: Partial<GraphicNovelBubblePlacement>,
): PlotPickleProject {
  const next = cloneProject(project);
  const layout = getGraphicNovelBubbleLayout(project);
  const now = new Date().toISOString();
  const current = normalizePlacement(layout.panels[panelId]?.[dialogueId], defaultPlacement(0, 1));
  const normalized = normalizePlacement({ ...current, ...patch, updatedAt: now }, current);
  const stored: GraphicNovelBubbleLayout = {
    version: 1,
    panels: {
      ...layout.panels,
      [panelId]: {
        ...layout.panels[panelId],
        [dialogueId]: normalized,
      },
    },
    updatedAt: now,
  };
  next.extensions = {
    ...next.extensions,
    [GRAPHIC_NOVEL_BUBBLE_LAYOUT_EXTENSION]: stored,
  };
  next.metadata.updatedAt = now;
  next.review.pitchPackage.updatedAt = now;
  return next;
}

export function resetGraphicNovelPanelBubbleLayout(project: PlotPickleProject, panelId: string): PlotPickleProject {
  const next = cloneProject(project);
  const layout = getGraphicNovelBubbleLayout(project);
  const panels = { ...layout.panels };
  delete panels[panelId];
  const now = new Date().toISOString();
  next.extensions = {
    ...next.extensions,
    [GRAPHIC_NOVEL_BUBBLE_LAYOUT_EXTENSION]: {
      version: 1,
      panels,
      updatedAt: now,
    } satisfies GraphicNovelBubbleLayout,
  };
  next.metadata.updatedAt = now;
  next.review.pitchPackage.updatedAt = now;
  return next;
}
