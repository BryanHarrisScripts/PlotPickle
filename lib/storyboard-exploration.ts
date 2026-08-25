import type { PlotPickleProject } from "./project";
import { buildVisualWritingSession, type VisualWritingTarget } from "./visual-writing-session";

export type StoryboardFrameSourceKind = "generated" | "manual-import";
export type StoryboardFrameStatus = "candidate" | "approved" | "rejected" | "superseded";

export type StoryboardSubjectBlocking = {
  subjectId: string;
  startPosition: string;
  facing: string;
  eyelineTargetId: string;
  movement: string;
  endPosition: string;
  screenDirection: string;
  axisState: string;
};

export type StoryboardAdvisoryOverride = {
  findingId: string;
  reason: string;
};

export type StoryboardAdvisoryCode =
  | "axis-crossing"
  | "eyeline-mismatch"
  | "screen-direction-mismatch"
  | "continuity-lock-conflict"
  | "generative-complexity";

export type StoryboardAdvisoryFinding = {
  id: string;
  code: StoryboardAdvisoryCode;
  frameId: string;
  shotId: string;
  relatedShotId: string;
  subjectId: string;
  message: string;
  overridden: boolean;
  overrideReason: string;
};

export type StoryboardContinuityConflictEvidence = {
  lockId: string;
  message: string;
};

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
  blocking: StoryboardSubjectBlocking[];
  advisoryOverrides: StoryboardAdvisoryOverride[];
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
const blockingStringFields = [
  "subjectId",
  "startPosition",
  "facing",
  "eyelineTargetId",
  "movement",
  "endPosition",
  "screenDirection",
  "axisState",
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

function normalizeBlocking(value: unknown): StoryboardSubjectBlocking[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const raw = record(entry);
    if (!Object.keys(raw).length) return [];
    return [{
      subjectId: text(raw.subjectId),
      startPosition: text(raw.startPosition),
      facing: text(raw.facing),
      eyelineTargetId: text(raw.eyelineTargetId),
      movement: text(raw.movement),
      endPosition: text(raw.endPosition),
      screenDirection: text(raw.screenDirection),
      axisState: text(raw.axisState),
    }];
  });
}

function normalizeAdvisoryOverrides(value: unknown): StoryboardAdvisoryOverride[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((entry) => {
    const raw = record(entry);
    if (!Object.keys(raw).length) return [];
    return [{ findingId: text(raw.findingId), reason: text(raw.reason) }];
  });
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
    blocking: normalizeBlocking(raw.blocking),
    advisoryOverrides: normalizeAdvisoryOverrides(raw.advisoryOverrides),
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
  if (!Array.isArray(raw.blocking)) {
    errors.push("blocking must be an array");
  } else {
    raw.blocking.forEach((entry, index) => {
      const blocking = record(entry);
      for (const field of blockingStringFields) {
        if (typeof blocking[field] !== "string") errors.push(`blocking[${index}].${field} must be a string`);
      }
      if (typeof blocking.subjectId !== "string" || !blocking.subjectId.trim()) errors.push(`blocking[${index}].subjectId is required`);
    });
  }
  if (!Array.isArray(raw.advisoryOverrides)) {
    errors.push("advisoryOverrides must be an array");
  } else {
    raw.advisoryOverrides.forEach((entry, index) => {
      const override = record(entry);
      if (typeof override.findingId !== "string" || !override.findingId.trim()) errors.push(`advisoryOverrides[${index}].findingId is required`);
      if (typeof override.reason !== "string" || !override.reason.trim()) errors.push(`advisoryOverrides[${index}].reason is required`);
    });
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
      blocking: [],
      advisoryOverrides: [],
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
      blocking: patch.blocking ? patch.blocking.map((entry) => ({ ...entry })) : frame.direction.structuredShot.blocking,
      advisoryOverrides: patch.advisoryOverrides
        ? patch.advisoryOverrides.map((entry) => ({ ...entry }))
        : frame.direction.structuredShot.advisoryOverrides,
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

function normalized(value: string) {
  return value.trim().toLocaleLowerCase();
}

function motionClauseCount(value: string) {
  return value
    .split(/\b(?:and then|then|while|plus)\b|[,;/]/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .length;
}

function shortShot(frame: StoryboardFrameCandidate) {
  if (frame.target.kind === "mini-block") return true;
  return /\b(?:short|brief|quick|beat|moment|insert)\b/i.test(
    `${frame.direction.structuredShot.narrativePurpose} ${frame.direction.structuredShot.notes}`,
  );
}

function latestActiveFramePerShot(frames: StoryboardFrameCandidate[]) {
  const eligible = frames.filter((frame) => frame.status === "candidate" || frame.status === "approved");
  const latest = new Map<string, number>();
  eligible.forEach((frame, index) => latest.set(frame.direction.structuredShot.shotId, index));
  return eligible.filter((frame, index) => latest.get(frame.direction.structuredShot.shotId) === index);
}

function blockingBySubject(frame: StoryboardFrameCandidate) {
  return new Map(frame.direction.structuredShot.blocking.map((entry) => [entry.subjectId, entry]));
}

function relatedSubjects(left: StoryboardFrameCandidate, right: StoryboardFrameCandidate) {
  const leftSubjects = blockingBySubject(left);
  const shared = [...blockingBySubject(right).keys()].filter((subjectId) => leftSubjects.has(subjectId));
  if (!shared.length) return [];
  const leftLocations = new Set(left.direction.locationIds);
  const rightLocations = new Set(right.direction.locationIds);
  const sameLocation = !leftLocations.size || !rightLocations.size || [...leftLocations].some((id) => rightLocations.has(id));
  return sameLocation ? shared : [];
}

function findingId(code: StoryboardAdvisoryCode, shotId: string, relatedShotId = "", subjectId = "") {
  return [code, shotId, relatedShotId || "single", subjectId || "shot"].join(":");
}

function applyOverride(frame: StoryboardFrameCandidate, finding: Omit<StoryboardAdvisoryFinding, "overridden" | "overrideReason">): StoryboardAdvisoryFinding {
  const override = frame.direction.structuredShot.advisoryOverrides.find((entry) => entry.findingId === finding.id && entry.reason.trim());
  return { ...finding, overridden: Boolean(override), overrideReason: override?.reason || "" };
}

export function evaluateStoryboardAdvisories(
  frames: StoryboardFrameCandidate[],
  continuityConflicts: Record<string, StoryboardContinuityConflictEvidence[]> = {},
): StoryboardAdvisoryFinding[] {
  const sequence = latestActiveFramePerShot(frames);
  const findings: StoryboardAdvisoryFinding[] = [];

  for (const frame of sequence) {
    const shot = frame.direction.structuredShot;
    const cameraMotionCount = motionClauseCount(shot.cameraMovement);
    const subjectMotionCount = shot.blocking.reduce((count, entry) => count + motionClauseCount(entry.movement), 0);
    if (shortShot(frame) && cameraMotionCount + subjectMotionCount >= 3 && (cameraMotionCount >= 2 || subjectMotionCount >= 2)) {
      const id = findingId("generative-complexity", shot.shotId);
      findings.push(applyOverride(frame, {
        id,
        code: "generative-complexity",
        frameId: frame.id,
        shotId: shot.shotId,
        relatedShotId: "",
        subjectId: "",
        message: `Shot ${shot.shotId} is a short beat with ${cameraMotionCount} camera move clause(s) and ${subjectMotionCount} subject move clause(s). Consider simplifying or splitting unrelated motion.`,
      }));
    }

    for (const evidence of continuityConflicts[shot.shotId] ?? []) {
      if (!shot.continuityLockReferences.includes(evidence.lockId)) continue;
      const id = findingId("continuity-lock-conflict", shot.shotId, evidence.lockId);
      findings.push(applyOverride(frame, {
        id,
        code: "continuity-lock-conflict",
        frameId: frame.id,
        shotId: shot.shotId,
        relatedShotId: "",
        subjectId: "",
        message: `Shot ${shot.shotId} references continuity lock ${evidence.lockId}: ${evidence.message}`,
      }));
    }
  }

  for (let index = 1; index < sequence.length; index += 1) {
    const previous = sequence[index - 1];
    const current = sequence[index];
    const previousShot = previous.direction.structuredShot;
    const currentShot = current.direction.structuredShot;
    if (previousShot.shotId === currentShot.shotId) continue;
    const sharedSubjects = relatedSubjects(previous, current);
    if (!sharedSubjects.length) continue;
    const previousBlocking = blockingBySubject(previous);
    const currentBlocking = blockingBySubject(current);

    for (const subjectId of sharedSubjects) {
      const before = previousBlocking.get(subjectId);
      const after = currentBlocking.get(subjectId);
      if (!before || !after) continue;

      if (before.axisState.trim() && after.axisState.trim() && normalized(before.axisState) !== normalized(after.axisState)) {
        const id = findingId("axis-crossing", currentShot.shotId, previousShot.shotId, subjectId);
        findings.push(applyOverride(current, {
          id,
          code: "axis-crossing",
          frameId: current.id,
          shotId: currentShot.shotId,
          relatedShotId: previousShot.shotId,
          subjectId,
          message: `Shot ${currentShot.shotId} changes ${subjectId} from axis state “${before.axisState}” in ${previousShot.shotId} to “${after.axisState}”. Confirm the 180-degree crossing is intentional.`,
        }));
      }

      if (before.eyelineTargetId.trim() && after.eyelineTargetId.trim() && normalized(before.eyelineTargetId) !== normalized(after.eyelineTargetId)) {
        const id = findingId("eyeline-mismatch", currentShot.shotId, previousShot.shotId, subjectId);
        findings.push(applyOverride(current, {
          id,
          code: "eyeline-mismatch",
          frameId: current.id,
          shotId: currentShot.shotId,
          relatedShotId: previousShot.shotId,
          subjectId,
          message: `Shot ${currentShot.shotId} changes ${subjectId}’s eyeline target from “${before.eyelineTargetId}” in ${previousShot.shotId} to “${after.eyelineTargetId}”.`,
        }));
      }

      if (before.screenDirection.trim() && after.screenDirection.trim() && normalized(before.screenDirection) !== normalized(after.screenDirection)) {
        const id = findingId("screen-direction-mismatch", currentShot.shotId, previousShot.shotId, subjectId);
        findings.push(applyOverride(current, {
          id,
          code: "screen-direction-mismatch",
          frameId: current.id,
          shotId: currentShot.shotId,
          relatedShotId: previousShot.shotId,
          subjectId,
          message: `Shot ${currentShot.shotId} changes ${subjectId}’s screen direction from “${before.screenDirection}” in ${previousShot.shotId} to “${after.screenDirection}”.`,
        }));
      }
    }
  }

  return findings;
}

function continuityConflictEvidence(project: PlotPickleProject, frames: StoryboardFrameCandidate[]) {
  const evidence: Record<string, StoryboardContinuityConflictEvidence[]> = {};
  for (const frame of latestActiveFramePerShot(frames)) {
    const references = new Set(frame.direction.structuredShot.continuityLockReferences);
    if (!references.size) continue;
    const locks = buildVisualWritingSession(project, frame.target).context.continuityLocks;
    const conflicts = locks
      .filter((lock) => references.has(lock.id) && lock.warning.trim())
      .map((lock) => ({ lockId: lock.id, message: lock.warning }));
    if (conflicts.length) evidence[frame.direction.structuredShot.shotId] = conflicts;
  }
  return evidence;
}

export function storyboardAdvisoryFindings(project: PlotPickleProject) {
  const frames = readStoryboardExplorationStore(project).frames;
  return evaluateStoryboardAdvisories(frames, continuityConflictEvidence(project, frames));
}

export function storyboardAdvisoryFindingsForFrame(project: PlotPickleProject, frameId: string) {
  return storyboardAdvisoryFindings(project).filter((finding) => finding.frameId === frameId);
}

export function acknowledgeStoryboardAdvisory(
  project: PlotPickleProject,
  frameId: string,
  findingIdValue: string,
  reason: string,
  updatedAt = new Date().toISOString(),
) {
  const findingId = findingIdValue.trim();
  const overrideReason = reason.trim();
  if (!findingId) throw new Error("Storyboard advisory findingId is required");
  if (!overrideReason) throw new Error("Storyboard advisory override reason is required");
  const store = readStoryboardExplorationStore(project);
  let found = false;
  const frames = store.frames.map((frame) => {
    if (frame.id !== frameId) return frame;
    found = true;
    const existing = frame.direction.structuredShot.advisoryOverrides.filter((entry) => entry.findingId !== findingId);
    return {
      ...frame,
      direction: {
        ...frame.direction,
        structuredShot: {
          ...frame.direction.structuredShot,
          advisoryOverrides: [...existing, { findingId, reason: overrideReason }],
        },
      },
      updatedAt,
    };
  });
  if (!found) throw new Error(`Storyboard frame not found: ${frameId}`);
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
