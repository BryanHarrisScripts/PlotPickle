import type { ConceptCanvasTargetKind, PlotPickleProject } from "./project";
import { assembleVisualStoryContext } from "./visual-context";
import { readCreativeCandidateStore } from "./creative-candidates";
import { approvedVisualCanon } from "./visual-canon";

export type VisualWritingTargetKind = Extract<ConceptCanvasTargetKind, "block" | "mini-block" | "scene">;

export type VisualWritingTarget = {
  kind: VisualWritingTargetKind;
  id: string;
  label: string;
};

export type VisualWritingSessionState = {
  id: string;
  target: VisualWritingTarget;
  textNotes: string;
  visualDirection: string;
  selectedCandidateIds: string[];
  approvedOutputIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type VisualWritingSession = {
  state: VisualWritingSessionState;
  context: ReturnType<typeof assembleVisualStoryContext>;
  candidates: ReturnType<typeof readCreativeCandidateStore>["candidates"];
  approvedCanon: ReturnType<typeof approvedVisualCanon>;
};

const EXTENSION_KEY = "visualWritingSessions";

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

function sessionKey(target: VisualWritingTarget) { return `${target.kind}:${target.id}`; }

export function readVisualWritingSessionState(project: PlotPickleProject, target: VisualWritingTarget): VisualWritingSessionState {
  const extensions = record(project.extensions);
  const store = record(extensions[EXTENSION_KEY]);
  const sessions = record(store.sessions);
  const raw = record(sessions[sessionKey(target)]);
  const now = new Date().toISOString();
  return {
    id: text(raw.id) || `visual-writing-${target.kind}-${target.id}`,
    target,
    textNotes: text(raw.textNotes),
    visualDirection: text(raw.visualDirection),
    selectedCandidateIds: strings(raw.selectedCandidateIds),
    approvedOutputIds: strings(raw.approvedOutputIds),
    createdAt: text(raw.createdAt) || now,
    updatedAt: text(raw.updatedAt) || text(raw.createdAt) || now,
  };
}

export function writeVisualWritingSessionState(project: PlotPickleProject, state: VisualWritingSessionState): PlotPickleProject {
  const extensions = record(project.extensions);
  const store = record(extensions[EXTENSION_KEY]);
  const sessions = record(store.sessions);
  return {
    ...project,
    extensions: {
      ...extensions,
      [EXTENSION_KEY]: {
        version: 1,
        ...store,
        sessions: {
          ...sessions,
          [sessionKey(state.target)]: state,
        },
      },
    },
  };
}

export function buildVisualWritingSession(project: PlotPickleProject, target: VisualWritingTarget): VisualWritingSession {
  const state = readVisualWritingSessionState(project, target);
  const context = assembleVisualStoryContext(project, target);
  const candidates = readCreativeCandidateStore(project).candidates.filter((candidate) =>
    candidate.target.kind === target.kind && candidate.target.id === target.id,
  );
  const approvedCanon = approvedVisualCanon(project).filter((item) =>
    item.target.kind === "project" || (item.target.kind === target.kind && item.target.id === target.id),
  );
  return { state, context, candidates, approvedCanon };
}

export function linkApprovedVisualOutput(
  project: PlotPickleProject,
  target: VisualWritingTarget,
  outputId: string,
  updatedAt = new Date().toISOString(),
) {
  const state = readVisualWritingSessionState(project, target);
  return writeVisualWritingSessionState(project, {
    ...state,
    approvedOutputIds: [...new Set([...state.approvedOutputIds, outputId])],
    updatedAt,
  });
}

export function resumeVisualWritingSession(project: PlotPickleProject, target: VisualWritingTarget) {
  return buildVisualWritingSession(project, target);
}
