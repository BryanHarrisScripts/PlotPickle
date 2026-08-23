import type { PlotPickleProject } from "./project";
import { buildVisualWritingSession, type VisualWritingTarget } from "./visual-writing-session";

export type StoryboardFrameSourceKind = "generated" | "manual-import";
export type StoryboardFrameStatus = "candidate" | "approved" | "rejected" | "superseded";

export type StoryboardFrameDirection = {
  target: VisualWritingTarget;
  storyPurpose: string;
  action: string;
  emotionalTurn: string;
  characterIds: string[];
  locationIds: string[];
  shot: string;
  staging: string;
  composition: string;
  camera: string;
  movement: string;
  continuityNotes: string[];
  approvedCanonItemIds: string[];
};

export type StoryboardFrameCandidate = {
  id: string;
  target: VisualWritingTarget;
  sourceKind: StoryboardFrameSourceKind;
  sourceLabel: string;
  assetRef: string;
  direction: StoryboardFrameDirection;
  status: StoryboardFrameStatus;
  supersedesCandidateId: string;
  supersededByCandidateId: string;
  createdAt: string;
  updatedAt: string;
};

export type StoryboardExplorationStore = {
  version: 1;
  frames: StoryboardFrameCandidate[];
};

const EXTENSION_KEY = "storyboardExploration";

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

export function buildStoryboardFrameDirection(project: PlotPickleProject, target: VisualWritingTarget): StoryboardFrameDirection {
  const session = buildVisualWritingSession(project, target);
  const { context } = session;
  return {
    target,
    storyPurpose: context.miniBlock?.purpose || context.scene?.purpose || context.block?.purpose || "",
    action: context.miniBlock?.action || context.scene?.action || context.block?.action || "",
    emotionalTurn: context.miniBlock?.turn || context.scene?.turn || context.block?.emotionalTurn || "",
    characterIds: context.characters.map((character) => character.id),
    locationIds: context.locations.map((location) => location.id),
    shot: "",
    staging: "",
    composition: "",
    camera: "",
    movement: "",
    continuityNotes: context.continuityLocks.map((lock) => `${lock.kind}: ${lock.effectiveValue}`),
    approvedCanonItemIds: session.approvedCanon.map((item) => item.id),
  };
}

export function readStoryboardExplorationStore(project: PlotPickleProject): StoryboardExplorationStore {
  const extensions = record(project.extensions);
  const raw = record(extensions[EXTENSION_KEY]);
  const frames = Array.isArray(raw.frames) ? raw.frames.flatMap((entry, index) => {
    const candidate = record(entry);
    if (!Object.keys(candidate).length) return [];
    const target = record(candidate.target);
    const direction = record(candidate.direction);
    const createdAt = text(candidate.createdAt) || new Date().toISOString();
    const sourceKind: StoryboardFrameSourceKind = candidate.sourceKind === "manual-import" ? "manual-import" : "generated";
    const status: StoryboardFrameStatus = ["candidate", "approved", "rejected", "superseded"].includes(text(candidate.status))
      ? text(candidate.status) as StoryboardFrameStatus
      : "candidate";
    return [{
      id: text(candidate.id) || `storyboard-frame-${index + 1}`,
      target: {
        kind: ["block", "mini-block", "scene"].includes(text(target.kind)) ? text(target.kind) as VisualWritingTarget["kind"] : "scene",
        id: text(target.id),
        label: text(target.label),
      },
      sourceKind,
      sourceLabel: text(candidate.sourceLabel),
      assetRef: text(candidate.assetRef),
      direction: {
        target: {
          kind: ["block", "mini-block", "scene"].includes(text(record(direction.target).kind)) ? text(record(direction.target).kind) as VisualWritingTarget["kind"] : "scene",
          id: text(record(direction.target).id),
          label: text(record(direction.target).label),
        },
        storyPurpose: text(direction.storyPurpose),
        action: text(direction.action),
        emotionalTurn: text(direction.emotionalTurn),
        characterIds: strings(direction.characterIds),
        locationIds: strings(direction.locationIds),
        shot: text(direction.shot),
        staging: text(direction.staging),
        composition: text(direction.composition),
        camera: text(direction.camera),
        movement: text(direction.movement),
        continuityNotes: strings(direction.continuityNotes),
        approvedCanonItemIds: strings(direction.approvedCanonItemIds),
      },
      status,
      supersedesCandidateId: text(candidate.supersedesCandidateId),
      supersededByCandidateId: text(candidate.supersededByCandidateId),
      createdAt,
      updatedAt: text(candidate.updatedAt) || createdAt,
    }];
  }) : [];
  return { version: 1, frames };
}

function writeStore(project: PlotPickleProject, store: StoryboardExplorationStore): PlotPickleProject {
  return {
    ...project,
    extensions: {
      ...record(project.extensions),
      [EXTENSION_KEY]: store,
    },
  };
}

export function addStoryboardFrameCandidate(project: PlotPickleProject, frame: StoryboardFrameCandidate) {
  const store = readStoryboardExplorationStore(project);
  return writeStore(project, { version: 1, frames: [...store.frames, frame] });
}

export function storyboardFramesForTarget(project: PlotPickleProject, target: VisualWritingTarget) {
  return readStoryboardExplorationStore(project).frames.filter((frame) => frame.target.kind === target.kind && frame.target.id === target.id);
}

export function storyboardApprovalWarnings(project: PlotPickleProject, target: VisualWritingTarget) {
  return buildVisualWritingSession(project, target).context.continuityWarnings;
}

export function approveStoryboardFrame(project: PlotPickleProject, target: VisualWritingTarget, frameId: string, updatedAt = new Date().toISOString()) {
  const warnings = storyboardApprovalWarnings(project, target);
  if (warnings.length) return { project, approved: false, warnings };
  const store = readStoryboardExplorationStore(project);
  const currentApproved = store.frames.find((frame) => frame.target.kind === target.kind && frame.target.id === target.id && frame.status === "approved");
  const frames = store.frames.map((frame) => {
    if (frame.id === frameId) return { ...frame, status: "approved" as const, supersedesCandidateId: currentApproved?.id || "", updatedAt };
    if (currentApproved && frame.id === currentApproved.id) return { ...frame, status: "superseded" as const, supersededByCandidateId: frameId, updatedAt };
    return frame;
  });
  return { project: writeStore(project, { version: 1, frames }), approved: true, warnings: [] as string[] };
}
