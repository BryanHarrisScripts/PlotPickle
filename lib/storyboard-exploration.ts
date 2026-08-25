import type { PlotPickleProject } from "./project";
import { buildVisualWritingSession, type VisualWritingTarget } from "./visual-writing-session";

export type StoryboardFrameSourceKind = "generated" | "manual-import";
export type StoryboardFrameStatus = "candidate" | "approved" | "rejected" | "superseded";

export type StoryboardStructuredShot = {
  shotId: string;
  narrativePurpose: string;
  shotSize: string;
  cameraAngle: string;
  cameraMovement: string;
  lensIntent: string;
  lightingIntent: string;
  continuityLockReferences: string[];
  notes: string;
};

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
  structuredShot: StoryboardStructuredShot;
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
const structuredShotStringFields = [
  "narrativePurpose",
  "shotSize",
  "cameraAngle",
  "cameraMovement",
  "lensIntent",
  "lightingIntent",
  "notes",
] as const;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function strings(value: unknown) { return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : []; }

function stableShotIdentityPart(value: string) {
  return value.trim().replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "unassigned";
}

export function storyboardShotIdForTarget(target: VisualWritingTarget, fallbackId = "") {
  return `storyboard-shot-${target.kind}-${stableShotIdentityPart(target.id || fallbackId || target.label)}`;
}

function normalizeStructuredShot(
  value: unknown,
  target: VisualWritingTarget,
  fallbackId: string,
  narrativePurpose: string,
): StoryboardStructuredShot {
  const raw = record(value);
  const hasStructuredShot = Object.keys(raw).length > 0;
  return {
    shotId: text(raw.shotId).trim() || storyboardShotIdForTarget(target, fallbackId),
    narrativePurpose: hasStructuredShot ? text(raw.narrativePurpose) : narrativePurpose,
    shotSize: text(raw.shotSize),
    cameraAngle: text(raw.cameraAngle),
    cameraMovement: text(raw.cameraMovement),
    lensIntent: text(raw.lensIntent),
    lightingIntent: text(raw.lightingIntent),
    continuityLockReferences: strings(raw.continuityLockReferences),
    notes: text(raw.notes),
  };
}

export function validateStoryboardStructuredShot(value: unknown) {
  const raw = record(value);
  const errors: string[] = [];
  if (typeof raw.shotId !== "string" || !raw.shotId.trim()) errors.push("shotId is required");
  for (const field of structuredShotStringFields) {
    if (typeof raw[field] !== "string") errors.push(`${field} must be a string`);
  }
  if (!Array.isArray(raw.continuityLockReferences) || raw.continuityLockReferences.some((item) => typeof item !== "string")) {
    errors.push("continuityLockReferences must be an array of strings");
  }
  return errors;
}

export function isValidStoryboardStructuredShot(value: unknown) {
  return validateStoryboardStructuredShot(value).length === 0;
}

function normalizeDirection(value: unknown, target: VisualWritingTarget, fallbackId: string): StoryboardFrameDirection {
  const direction = record(value);
  const directionTarget = record(direction.target);
  const storyPurpose = text(direction.storyPurpose);
  return {
    target: {
      kind: ["block", "mini-block", "scene"].includes(text(directionTarget.kind)) ? text(directionTarget.kind) as VisualWritingTarget["kind"] : target.kind,
      id: text(directionTarget.id) || target.id,
      label: text(directionTarget.label) || target.label,
    },
    storyPurpose,
    action: text(direction.action),
    emotionalTurn: text(direction.emotionalTurn),
    characterIds: strings(direction.characterIds),
    locationIds: strings(direction.locationIds),
    shot: text(direction.shot),
    staging: text(direction.staging),
    composition: text(direction.composition),
    camera: text(direction.camera),
    movement: text(direction.movement),
    structuredShot: normalizeStructuredShot(direction.structuredShot, target, fallbackId, storyPurpose),
    continuityNotes: strings(direction.continuityNotes),
    approvedCanonItemIds: strings(direction.approvedCanonItemIds),
  };
}

export function buildStoryboardFrameDirection(project: PlotPickleProject, target: VisualWritingTarget): StoryboardFrameDirection {
  const session = buildVisualWritingSession(project, target);
  const { context } = session;
  const storyPurpose = context.miniBlock?.purpose || context.scene?.purpose || context.block?.purpose || "";
  return {
    target,
    storyPurpose,
    action: context.miniBlock?.action || context.scene?.action || context.block?.action || "",
    emotionalTurn: context.miniBlock?.turn || context.scene?.turn || context.block?.emotionalTurn || "",
    characterIds: context.characters.map((character) => character.id),
    locationIds: context.locations.map((location) => location.id),
    shot: "",
    staging: "",
    composition: "",
    camera: "",
    movement: "",
    structuredShot: {
      shotId: storyboardShotIdForTarget(target),
      narrativePurpose: storyPurpose,
      shotSize: "",
      cameraAngle: "",
      cameraMovement: "",
      lensIntent: "",
      lightingIntent: "",
      continuityLockReferences: context.continuityLocks.map((lock) => lock.id),
      notes: "",
    },
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
    const targetValue = record(candidate.target);
    const target: VisualWritingTarget = {
      kind: ["block", "mini-block", "scene"].includes(text(targetValue.kind)) ? text(targetValue.kind) as VisualWritingTarget["kind"] : "scene",
      id: text(targetValue.id),
      label: text(targetValue.label),
    };
    const createdAt = text(candidate.createdAt) || new Date().toISOString();
    const sourceKind: StoryboardFrameSourceKind = candidate.sourceKind === "manual-import" ? "manual-import" : "generated";
    const status: StoryboardFrameStatus = ["candidate", "approved", "rejected", "superseded"].includes(text(candidate.status))
      ? text(candidate.status) as StoryboardFrameStatus
      : "candidate";
    const id = text(candidate.id) || `storyboard-frame-${index + 1}`;
    return [{
      id,
      target,
      sourceKind,
      sourceLabel: text(candidate.sourceLabel),
      assetRef: text(candidate.assetRef),
      direction: normalizeDirection(candidate.direction, target, id),
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

function appendStoryboardFrame(project: PlotPickleProject, store: StoryboardExplorationStore, frame: StoryboardFrameCandidate) {
  return writeStore(project, { version: 1, frames: [...store.frames, frame] });
}

export function addStoryboardFrameCandidate(project: PlotPickleProject, frame: StoryboardFrameCandidate) {
  const store = readStoryboardExplorationStore(project);
  const normalizedFrame = { ...frame, direction: normalizeDirection(frame.direction, frame.target, frame.id) };
  const errors = validateStoryboardStructuredShot(normalizedFrame.direction.structuredShot);
  if (errors.length) throw new Error(`Invalid Storyboard structured shot: ${errors.join("; ")}`);
  return appendStoryboardFrame(project, store, normalizedFrame);
}

export function editStoryboardStructuredShot(
  project: PlotPickleProject,
  frameId: string,
  patch: Partial<Omit<StoryboardStructuredShot, "shotId">>,
  updatedAt = new Date().toISOString(),
) {
  const store = readStoryboardExplorationStore(project);
  const frames = store.frames.map((frame) => {
    if (frame.id !== frameId) return frame;
    const structuredShot: StoryboardStructuredShot = {
      ...frame.direction.structuredShot,
      ...patch,
      shotId: frame.direction.structuredShot.shotId,
      continuityLockReferences: patch.continuityLockReferences
        ? [...patch.continuityLockReferences]
        : frame.direction.structuredShot.continuityLockReferences,
    };
    const errors = validateStoryboardStructuredShot(structuredShot);
    if (errors.length) throw new Error(`Invalid Storyboard structured shot: ${errors.join("; ")}`);
    return {
      ...frame,
      direction: { ...frame.direction, structuredShot },
      updatedAt,
    };
  });
  return writeStore(project, { version: 1, frames });
}

export function storyboardShotSummary(direction: StoryboardFrameDirection) {
  const { structuredShot } = direction;
  const parts = [
    structuredShot.shotSize,
    structuredShot.cameraAngle,
    structuredShot.cameraMovement,
    structuredShot.lensIntent ? `Lens: ${structuredShot.lensIntent}` : "",
    structuredShot.lightingIntent ? `Light: ${structuredShot.lightingIntent}` : "",
  ].map((value) => value.trim()).filter(Boolean);
  return parts.join(" · ") || direction.shot || direction.camera || direction.movement || direction.staging || "Storyboard frame";
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
