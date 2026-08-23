import type { PlotPickleProject } from "./project";
import type { VisualWritingTarget } from "./visual-writing-session";
import { storyboardFramesForTarget } from "./storyboard-exploration";

export type GraphicNovelPanelStatus = "unresolved" | "shortlisted" | "approved" | "replaced";

export type GraphicNovelPanel = {
  id: string;
  pageId: string;
  order: number;
  target: VisualWritingTarget;
  sourceCandidateIds: string[];
  storyboardFrameId: string;
  dialogue: string;
  caption: string;
  framing: string;
  continuityNotes: string[];
  status: GraphicNovelPanelStatus;
  replacesPanelId: string;
  replacedByPanelId: string;
  createdAt: string;
  updatedAt: string;
};

export type GraphicNovelPage = {
  id: string;
  number: number;
  layout: "single" | "two" | "three" | "four" | "freeform";
  panelIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type GraphicNovelPackage = {
  version: 1;
  pages: GraphicNovelPage[];
  panels: GraphicNovelPanel[];
};

const EXTENSION_KEY = "graphicNovelComposition";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}
function text(value: unknown) { return typeof value === "string" ? value : ""; }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

export function readGraphicNovelPackage(project: PlotPickleProject): GraphicNovelPackage {
  const extensions = record(project.extensions);
  const raw = record(extensions[EXTENSION_KEY]);
  const pages = Array.isArray(raw.pages) ? raw.pages.flatMap((entry, index) => {
    const page = record(entry);
    if (!Object.keys(page).length) return [];
    const createdAt = text(page.createdAt) || new Date().toISOString();
    const layout = ["single", "two", "three", "four", "freeform"].includes(text(page.layout))
      ? text(page.layout) as GraphicNovelPage["layout"] : "four";
    return [{
      id: text(page.id) || `graphic-page-${index + 1}`,
      number: Math.max(1, Number(page.number) || index + 1),
      layout,
      panelIds: strings(page.panelIds),
      createdAt,
      updatedAt: text(page.updatedAt) || createdAt,
    }];
  }) : [];
  const panels = Array.isArray(raw.panels) ? raw.panels.flatMap((entry, index) => {
    const panel = record(entry);
    if (!Object.keys(panel).length) return [];
    const target = record(panel.target);
    const createdAt = text(panel.createdAt) || new Date().toISOString();
    const status = ["unresolved", "shortlisted", "approved", "replaced"].includes(text(panel.status))
      ? text(panel.status) as GraphicNovelPanelStatus : "unresolved";
    return [{
      id: text(panel.id) || `graphic-panel-${index + 1}`,
      pageId: text(panel.pageId),
      order: Math.max(1, Number(panel.order) || index + 1),
      target: {
        kind: ["block", "mini-block", "scene"].includes(text(target.kind)) ? text(target.kind) as VisualWritingTarget["kind"] : "scene",
        id: text(target.id),
        label: text(target.label),
      },
      sourceCandidateIds: strings(panel.sourceCandidateIds),
      storyboardFrameId: text(panel.storyboardFrameId),
      dialogue: text(panel.dialogue),
      caption: text(panel.caption),
      framing: text(panel.framing),
      continuityNotes: strings(panel.continuityNotes),
      status,
      replacesPanelId: text(panel.replacesPanelId),
      replacedByPanelId: text(panel.replacedByPanelId),
      createdAt,
      updatedAt: text(panel.updatedAt) || createdAt,
    }];
  }) : [];
  return { version: 1, pages, panels };
}

function writePackage(project: PlotPickleProject, value: GraphicNovelPackage): PlotPickleProject {
  return { ...project, extensions: { ...record(project.extensions), [EXTENSION_KEY]: value } };
}

export function addGraphicNovelPanel(project: PlotPickleProject, panel: GraphicNovelPanel) {
  const pkg = readGraphicNovelPackage(project);
  return writePackage(project, { ...pkg, panels: [...pkg.panels, panel] });
}

export function replaceGraphicNovelPanel(project: PlotPickleProject, priorPanelId: string, replacement: GraphicNovelPanel) {
  const pkg = readGraphicNovelPackage(project);
  return writePackage(project, {
    ...pkg,
    panels: [...pkg.panels.map((panel) => panel.id === priorPanelId ? {
      ...panel,
      status: "replaced" as const,
      replacedByPanelId: replacement.id,
      updatedAt: replacement.updatedAt,
    } : panel), { ...replacement, replacesPanelId: priorPanelId }],
  });
}

export function reflowGraphicNovelPage(project: PlotPickleProject, pageId: string, panelIds: string[], updatedAt = new Date().toISOString()) {
  const pkg = readGraphicNovelPackage(project);
  return writePackage(project, {
    ...pkg,
    pages: pkg.pages.map((page) => page.id === pageId ? { ...page, panelIds: [...panelIds], updatedAt } : page),
  });
}

export function approvedStoryboardSources(project: PlotPickleProject, target: VisualWritingTarget) {
  return storyboardFramesForTarget(project, target).filter((frame) => frame.status === "approved" || frame.status === "candidate");
}

export function buildGraphicNovelExport(project: PlotPickleProject) {
  const pkg = readGraphicNovelPackage(project);
  const currentPanels = pkg.panels.filter((panel) => panel.status !== "replaced");
  const approvedPanels = currentPanels.filter((panel) => panel.status === "approved");
  const unresolvedPanels = currentPanels.filter((panel) => panel.status !== "approved");
  return {
    version: 1,
    pages: pkg.pages.map((page) => ({ ...page, panelIds: page.panelIds.filter((id) => approvedPanels.some((panel) => panel.id === id)) })),
    panels: approvedPanels,
    unresolvedPanels: unresolvedPanels.map((panel) => ({ id: panel.id, target: panel.target, status: panel.status })),
    canonMutated: false,
  };
}
