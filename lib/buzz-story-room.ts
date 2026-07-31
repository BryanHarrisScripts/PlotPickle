export const BUZZ_STORY_ROOM_VERSION = 1 as const;

export const BUZZ_STORY_ROOMS = [
  { id: "story", label: "Story Room", suffix: "story", description: "Premise, theme, plot direction and project-wide story decisions." },
  { id: "characters", label: "Characters", suffix: "characters", description: "Character wants, needs, arcs, relationships, voices and casting ideas." },
  { id: "structure", label: "Structure", suffix: "structure", description: "Acts, sequences, Blocks, scenes, Story Threads, pacing and turning points." },
  { id: "continuity", label: "Continuity", suffix: "continuity", description: "World rules, timeline, locations, props and facts that must remain consistent." },
  { id: "visual-development", label: "Visual Development", suffix: "visual-development", description: "Graphic Novel panels, Storyboard frames, composition, style and visual continuity." },
  { id: "production-notes", label: "Production Notes", suffix: "production-notes", description: "Shots, sound, practical requirements, schedules and production questions." },
] as const;

export type BuzzStoryRoomId = (typeof BUZZ_STORY_ROOMS)[number]["id"];
export type BuzzProposalStatus = "open" | "approved" | "declined" | "conflict";
export type BuzzTargetKind = "project" | "block" | "scene" | "character" | "location" | "story-thread" | "visual";

export type BuzzStoryField = {
  path: Array<string | number>;
  key: string;
  label: string;
  value: string;
};

export type BuzzStoryTarget = {
  id: string;
  kind: BuzzTargetKind;
  label: string;
  path: Array<string | number>;
  fields: BuzzStoryField[];
};

export type BuzzDiscussionReference = {
  relayUrl: string;
  community: string;
  roomId: BuzzStoryRoomId;
  roomName: string;
  channelId: string;
  messageId: string;
  messageUrl: string;
  excerpt: string;
  author: string;
  createdAt: string;
};

export type BuzzStoryProposal = {
  version: typeof BUZZ_STORY_ROOM_VERSION;
  id: string;
  projectId: string;
  projectTitle: string;
  title: string;
  rationale: string;
  roomId: BuzzStoryRoomId;
  targetKind: BuzzTargetKind;
  targetId: string;
  targetLabel: string;
  fieldPath: Array<string | number>;
  fieldLabel: string;
  originalValue: string;
  proposedValue: string;
  source: BuzzDiscussionReference;
  status: BuzzProposalStatus;
  createdAt: string;
  decidedAt: string;
  decidedBy: string;
  decisionNote: string;
};

export type BuzzProposalApplication = {
  ok: boolean;
  project: Record<string, unknown>;
  proposal: BuzzStoryProposal;
  message: string;
};

const BLOCK_FIELDS = [
  "title", "purpose", "summary", "goal", "conflict", "choice", "action", "consequence",
  "emotionalTurn", "audienceExpectation", "pickleTurn", "setup", "payoff", "scriptExcerpt",
  "storyboardDirection", "notes",
] as const;
const VISUAL_FIELDS = ["alt", "caption", "prompt", "shot", "continuity"] as const;
const CHARACTER_FIELDS = [
  "name", "role", "pronouns", "description", "want", "need", "ghost", "fatalFlaw", "strengths",
  "arc", "voice", "originEnvironment", "socialContext", "educationExpertise", "worldviewBoundaries",
  "rhythmSentenceShape", "vocabularyMetaphors", "verbalFingerprints", "emotionalAccess", "statusShift",
  "persuasionStrategy",
] as const;
const LOCATION_FIELDS = ["name", "description"] as const;
const THREAD_FIELDS = ["name", "summary", "question", "notes"] as const;
const PROJECT_SECTIONS = ["metadata", "story", "development", "world"] as const;
const EXCLUDED_PROJECT_KEYS = new Set(["id", "schemaVersion", "createdAt", "updatedAt", "image", "src", "imageSrc", "keyframeSrc"]);

function record(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function titleCase(value: string) {
  return value
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

function field(object: Record<string, unknown>, objectPath: Array<string | number>, key: string): BuzzStoryField | null {
  const value = object[key];
  if (typeof value !== "string") return null;
  return { path: [...objectPath, key], key, label: titleCase(key), value };
}

function fields(object: Record<string, unknown>, objectPath: Array<string | number>, keys: readonly string[]) {
  return keys.flatMap((key) => {
    const item = field(object, objectPath, key);
    return item ? [item] : [];
  });
}

function safeProjectFields(project: Record<string, unknown>) {
  const result: BuzzStoryField[] = [];
  for (const sectionName of PROJECT_SECTIONS) {
    const section = record(project[sectionName]);
    if (!section) continue;
    for (const [key, value] of Object.entries(section)) {
      if (EXCLUDED_PROJECT_KEYS.has(key) || typeof value !== "string") continue;
      result.push({
        path: [sectionName, key],
        key,
        label: `${titleCase(sectionName)} · ${titleCase(key)}`,
        value,
      });
    }
  }
  return result;
}

function stableId(value: unknown, fallback: string) {
  const object = record(value);
  return text(object?.id) || fallback;
}

function targetLabel(value: unknown, fallback: string) {
  const object = record(value);
  return text(object?.name) || text(object?.title) || text(object?.label) || fallback;
}

function sceneFields(scene: Record<string, unknown>, path: Array<string | number>) {
  return Object.entries(scene).flatMap(([key, value]) => {
    if (EXCLUDED_PROJECT_KEYS.has(key) || typeof value !== "string") return [];
    return [{ path: [...path, key], key, label: titleCase(key), value } satisfies BuzzStoryField];
  });
}

export function projectIdentity(project: unknown) {
  const item = record(project) ?? {};
  const metadata = record(item.metadata) ?? {};
  const id = text(metadata.id) || text(item.id) || "local-project";
  const title = text(metadata.title) || text(item.title) || "Untitled PlotPickle project";
  return { id, title };
}

export function buzzProjectSlug(project: unknown) {
  const { id, title } = projectIdentity(project);
  return `${title}-${id.slice(0, 8)}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 54) || "plotpickle-story";
}

export function buzzRoomName(project: unknown, roomId: BuzzStoryRoomId) {
  const definition = BUZZ_STORY_ROOMS.find((room) => room.id === roomId) ?? BUZZ_STORY_ROOMS[0];
  return `${buzzProjectSlug(project)}-${definition.suffix}`.slice(0, 72);
}

export function collectBuzzStoryTargets(project: unknown): BuzzStoryTarget[] {
  const root = record(project);
  if (!root) return [];
  const identity = projectIdentity(root);
  const targets: BuzzStoryTarget[] = [{
    id: identity.id,
    kind: "project",
    label: identity.title,
    path: [],
    fields: safeProjectFields(root),
  }];

  array(root.characters).forEach((value, index) => {
    const item = record(value);
    if (!item) return;
    const path: Array<string | number> = ["characters", index];
    targets.push({
      id: stableId(item, `character-${index + 1}`),
      kind: "character",
      label: targetLabel(item, `Character ${index + 1}`),
      path,
      fields: fields(item, path, CHARACTER_FIELDS),
    });
  });

  const world = record(root.world);
  const locations = array(world?.locations).length ? array(world?.locations) : array(root.locations);
  locations.forEach((value, index) => {
    const item = record(value);
    if (!item) return;
    const inWorld = array(world?.locations).length > 0;
    const path: Array<string | number> = inWorld ? ["world", "locations", index] : ["locations", index];
    targets.push({
      id: stableId(item, `location-${index + 1}`),
      kind: "location",
      label: targetLabel(item, `Location ${index + 1}`),
      path,
      fields: fields(item, path, LOCATION_FIELDS),
    });
  });

  array(root.blocks).forEach((value, blockIndex) => {
    const block = record(value);
    if (!block) return;
    const blockNumber = Number(block.number) || blockIndex + 1;
    const blockPath: Array<string | number> = ["blocks", blockIndex];
    targets.push({
      id: stableId(block, `block-${blockNumber}`),
      kind: "block",
      label: `Block ${blockNumber} · ${targetLabel(block, "Untitled")}`,
      path: blockPath,
      fields: fields(block, blockPath, BLOCK_FIELDS),
    });

    array(block.scenes).forEach((sceneValue, sceneIndex) => {
      const scene = record(sceneValue);
      if (!scene) return;
      const path: Array<string | number> = [...blockPath, "scenes", sceneIndex];
      targets.push({
        id: stableId(scene, `block-${blockNumber}-scene-${sceneIndex + 1}`),
        kind: "scene",
        label: `Block ${blockNumber} · Scene ${sceneIndex + 1} · ${targetLabel(scene, "Untitled")}`,
        path,
        fields: sceneFields(scene, path),
      });
    });

    array(block.visuals).forEach((visualValue, visualIndex) => {
      const visual = record(visualValue);
      if (!visual) return;
      const path: Array<string | number> = [...blockPath, "visuals", visualIndex];
      targets.push({
        id: stableId(visual, `block-${blockNumber}-visual-${visualIndex + 1}`),
        kind: "visual",
        label: `Block ${blockNumber} · Visual ${visualIndex + 1} · ${targetLabel(visual, "Frame")}`,
        path,
        fields: fields(visual, path, VISUAL_FIELDS),
      });
    });
  });

  array(root.storyThreads).forEach((value, index) => {
    const item = record(value);
    if (!item) return;
    const path: Array<string | number> = ["storyThreads", index];
    targets.push({
      id: stableId(item, `thread-${index + 1}`),
      kind: "story-thread",
      label: `Story Thread · ${targetLabel(item, `Thread ${index + 1}`)}`,
      path,
      fields: fields(item, path, THREAD_FIELDS),
    });
  });

  return targets.filter((target) => target.fields.length > 0);
}

function getAtPath(root: unknown, path: Array<string | number>) {
  let current: unknown = root;
  for (const segment of path) {
    if (typeof segment === "number") {
      if (!Array.isArray(current) || segment < 0 || segment >= current.length) return undefined;
      current = current[segment];
      continue;
    }
    const object = record(current);
    if (!object || !(segment in object)) return undefined;
    current = object[segment];
  }
  return current;
}

function setAtPath(root: Record<string, unknown>, path: Array<string | number>, value: string) {
  if (!path.length) return false;
  let current: unknown = root;
  for (let index = 0; index < path.length - 1; index += 1) {
    const segment = path[index];
    if (typeof segment === "number") {
      if (!Array.isArray(current) || segment < 0 || segment >= current.length) return false;
      current = current[segment];
    } else {
      const object = record(current);
      if (!object || !(segment in object)) return false;
      current = object[segment];
    }
  }
  const final = path[path.length - 1];
  if (typeof final === "number") {
    if (!Array.isArray(current) || typeof current[final] !== "string") return false;
    current[final] = value;
    return true;
  }
  const object = record(current);
  if (!object || typeof object[final] !== "string") return false;
  object[final] = value;
  return true;
}

function cloneProject(project: Record<string, unknown>) {
  return JSON.parse(JSON.stringify(project)) as Record<string, unknown>;
}

function decide(proposal: BuzzStoryProposal, status: BuzzProposalStatus, decidedBy: string, decisionNote: string) {
  return {
    ...proposal,
    status,
    decidedAt: new Date().toISOString(),
    decidedBy: decidedBy.trim() || "Project owner",
    decisionNote: decisionNote.trim(),
  };
}

export function applyBuzzStoryProposal(
  projectValue: unknown,
  proposal: BuzzStoryProposal,
  decidedBy: string,
  decisionNote = "",
): BuzzProposalApplication {
  const project = record(projectValue);
  if (!project) return { ok: false, project: {}, proposal: decide(proposal, "conflict", decidedBy, decisionNote), message: "The current PlotPickle project is unavailable." };
  const identity = projectIdentity(project);
  if (identity.id !== proposal.projectId) {
    return { ok: false, project, proposal: decide(proposal, "conflict", decidedBy, decisionNote), message: "This proposal belongs to a different PlotPickle project." };
  }
  const current = getAtPath(project, proposal.fieldPath);
  if (typeof current !== "string") {
    return { ok: false, project, proposal: decide(proposal, "conflict", decidedBy, decisionNote), message: "The proposed PPF field no longer exists." };
  }
  if (current !== proposal.originalValue) {
    return { ok: false, project, proposal: decide(proposal, "conflict", decidedBy, decisionNote), message: "The PPF field changed after this proposal was created. Review the current value before applying it." };
  }
  const next = cloneProject(project);
  if (!setAtPath(next, proposal.fieldPath, proposal.proposedValue)) {
    return { ok: false, project, proposal: decide(proposal, "conflict", decidedBy, decisionNote), message: "PlotPickle refused to write outside the approved story field." };
  }
  const metadata = record(next.metadata);
  if (metadata && typeof metadata.updatedAt === "string") metadata.updatedAt = new Date().toISOString();
  return {
    ok: true,
    project: next,
    proposal: decide(proposal, "approved", decidedBy, decisionNote),
    message: `Approved ${proposal.fieldLabel} for ${proposal.targetLabel}. The PPF project is now the authoritative record.`,
  };
}

export function declineBuzzStoryProposal(proposal: BuzzStoryProposal, decidedBy: string, decisionNote = "") {
  return decide(proposal, "declined", decidedBy, decisionNote);
}

export function validBuzzStoryProposal(value: unknown): value is BuzzStoryProposal {
  const item = record(value) as Partial<BuzzStoryProposal> | null;
  if (!item) return false;
  const roomIds = new Set<string>(BUZZ_STORY_ROOMS.map((room) => room.id));
  return item.version === BUZZ_STORY_ROOM_VERSION
    && typeof item.id === "string"
    && typeof item.projectId === "string"
    && typeof item.projectTitle === "string"
    && typeof item.title === "string"
    && roomIds.has(String(item.roomId))
    && Array.isArray(item.fieldPath)
    && item.fieldPath.every((part) => typeof part === "string" || (Number.isInteger(part) && Number(part) >= 0))
    && typeof item.originalValue === "string"
    && typeof item.proposedValue === "string"
    && ["open", "approved", "declined", "conflict"].includes(String(item.status));
}
