import {
  RENDER_CLIP_SECONDS,
  RENDER_CLIPS_PER_MINI_BLOCK,
  RENDER_MINI_BLOCK_SECONDS,
  renderClipSlotsForAnchor,
  type RenderClipSlot,
} from "../previs";

export type SequenceDirectorSurface = "plan" | "storyboard" | "previs";
export type SequenceDirectorStatus = "proposal" | "approved";
export type SequenceDirectorDensity = "low" | "medium" | "high" | "hold";
export type SequenceDirectorReferenceRole =
  | "character"
  | "location"
  | "prop"
  | "wardrobe"
  | "lighting"
  | "style"
  | "storyboard"
  | "continuity"
  | "other";

export interface SequenceDirectorReference {
  readonly id: string;
  readonly role: SequenceDirectorReferenceRole;
  readonly assetId: string;
  readonly label: string;
  readonly instruction: string;
}

export interface SequenceDirectorBeat {
  readonly id: string;
  readonly order: number;
  readonly label: string;
  readonly purpose: string;
  readonly visualAction: string;
  readonly cameraIntent: string;
  readonly continuityIn: string;
  readonly continuityOut: string;
  readonly soundIntent: string;
  readonly density: SequenceDirectorDensity;
  /** Human-authored Previs timing. PLAN/STORYBOARD may leave these null. */
  readonly startSecond: number | null;
  readonly endSecond: number | null;
}

export interface SequenceDirectorDraft {
  readonly version: 1;
  /** The Sequence Director is currently anchored to one canonical 96 Mini-Block address. */
  readonly anchorRef: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly title: string;
  readonly purpose: string;
  readonly rhythm: string;
  readonly motionFlow: string;
  readonly globalContinuity: readonly string[];
  readonly hardRules: readonly string[];
  readonly references: readonly SequenceDirectorReference[];
  readonly beats: readonly SequenceDirectorBeat[];
  readonly status: SequenceDirectorStatus;
}

export interface SequenceDirectorRenderPrompt {
  readonly slot: RenderClipSlot;
  readonly localStartSecond: number;
  readonly localEndSecond: number;
  readonly beatIds: readonly string[];
  readonly prompt: string;
}

export const SEQUENCE_DIRECTOR_RENDER_CLIP_SECONDS = RENDER_CLIP_SECONDS;
export const SEQUENCE_DIRECTOR_RENDER_CLIPS_PER_MINI_BLOCK = RENDER_CLIPS_PER_MINI_BLOCK;
export const SEQUENCE_DIRECTOR_MINI_BLOCK_SECONDS = RENDER_MINI_BLOCK_SECONDS;

export function sequenceDirectorAnchorRef(blockNumber: number, miniBlockNumber: number) {
  if (!Number.isInteger(blockNumber) || blockNumber < 1 || blockNumber > 24) return "";
  if (!Number.isInteger(miniBlockNumber) || miniBlockNumber < 1 || miniBlockNumber > 4) return "";
  return `storyboard-anchor:block:block-${String(blockNumber).padStart(2, "0")}:mini-${miniBlockNumber}`;
}

export function sequenceDirectorRenderSlots(blockNumber: number, miniBlockNumber: number) {
  return renderClipSlotsForAnchor(blockNumber, miniBlockNumber);
}

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function cleanStrings(value: unknown, maximumItems = 80, maximumText = 2_000) {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => cleanText(item, maximumText))
    .filter(Boolean)
    .filter((item, index, all) => all.indexOf(item) === index)
    .slice(0, maximumItems);
}

function normalizeReference(value: unknown): SequenceDirectorReference | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<SequenceDirectorReference>;
  const roles: SequenceDirectorReferenceRole[] = [
    "character", "location", "prop", "wardrobe", "lighting", "style", "storyboard", "continuity", "other",
  ];
  const id = cleanText(item.id, 160);
  const assetId = cleanText(item.assetId, 240);
  if (!id || !assetId) return null;
  return {
    id,
    role: roles.includes(item.role as SequenceDirectorReferenceRole) ? item.role as SequenceDirectorReferenceRole : "other",
    assetId,
    label: cleanText(item.label, 160),
    instruction: cleanText(item.instruction, 1_000),
  };
}

function normalizeBeat(value: unknown, fallbackOrder: number): SequenceDirectorBeat | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<SequenceDirectorBeat>;
  const id = cleanText(item.id, 160);
  if (!id) return null;
  const density: SequenceDirectorDensity = item.density === "medium" || item.density === "high" || item.density === "hold"
    ? item.density
    : "low";
  const order = typeof item.order === "number" && Number.isInteger(item.order) && item.order > 0
    ? Math.min(item.order, 999)
    : fallbackOrder;
  const startSecond = typeof item.startSecond === "number" && Number.isFinite(item.startSecond) && item.startSecond >= 0
    ? Math.min(Math.round(item.startSecond * 100) / 100, SEQUENCE_DIRECTOR_MINI_BLOCK_SECONDS)
    : null;
  const endSecond = typeof item.endSecond === "number" && Number.isFinite(item.endSecond) && item.endSecond > 0
    ? Math.min(Math.round(item.endSecond * 100) / 100, SEQUENCE_DIRECTOR_MINI_BLOCK_SECONDS)
    : null;
  return {
    id,
    order,
    label: cleanText(item.label, 160),
    purpose: cleanText(item.purpose, 1_000),
    visualAction: cleanText(item.visualAction, 2_000),
    cameraIntent: cleanText(item.cameraIntent, 1_000),
    continuityIn: cleanText(item.continuityIn, 1_000),
    continuityOut: cleanText(item.continuityOut, 1_000),
    soundIntent: cleanText(item.soundIntent, 1_000),
    density,
    startSecond,
    endSecond: startSecond !== null && endSecond !== null && endSecond > startSecond ? endSecond : null,
  };
}

export function normalizeSequenceDirectorDraft(value: unknown): SequenceDirectorDraft | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const item = value as Partial<SequenceDirectorDraft>;
  const blockNumber = Number(item.blockNumber);
  const miniBlockNumber = Number(item.miniBlockNumber);
  const anchorRef = sequenceDirectorAnchorRef(blockNumber, miniBlockNumber);
  if (!anchorRef) return null;
  const references = Array.isArray(item.references)
    ? item.references.map(normalizeReference).filter((reference): reference is SequenceDirectorReference => Boolean(reference)).slice(0, 50)
    : [];
  const beats = Array.isArray(item.beats)
    ? item.beats
      .map((beat, index) => normalizeBeat(beat, index + 1))
      .filter((beat): beat is SequenceDirectorBeat => Boolean(beat))
      .filter((beat, index, all) => all.findIndex((candidate) => candidate.id === beat.id) === index)
      .sort((left, right) => left.order - right.order)
      .slice(0, 100)
    : [];
  return {
    version: 1,
    anchorRef,
    blockNumber,
    miniBlockNumber,
    title: cleanText(item.title, 200),
    purpose: cleanText(item.purpose, 2_000),
    rhythm: cleanText(item.rhythm, 2_000),
    motionFlow: cleanText(item.motionFlow, 4_000),
    globalContinuity: cleanStrings(item.globalContinuity),
    hardRules: cleanStrings(item.hardRules),
    references,
    beats,
    status: item.status === "approved" ? "approved" : "proposal",
  };
}
