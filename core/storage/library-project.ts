import {
  createEmptyProjectSourceEvidence,
  normalizeProjectSourceEvidence,
  type ProjectSourceEvidence,
} from "../contracts/imported-screenplay-evidence";
import {
  createEmptyBlockWritingState,
  normalizeBlockWritingState,
  type BlockWritingState,
} from "../contracts/block-writing";
import {
  createEmptyStoryStructureV2,
  normalizeStoryStructureV2,
  type StoryStructureV2,
} from "../project/story-structure-v2";
import { normalizeFoundationProject, PPF_FOUNDATION_VERSION, type PPFProject } from "../project/project";
import { createEmptyWorldMapState, normalizeWorldMapState, type WorldMapState } from "../contracts/world-map";
import { createEmptyDiscoveryState, normalizeDiscoveryState, type DiscoveryState } from "../contracts/discovery";
export const STORY_DEVELOPMENT_VERSION = 1 as const;

export type StoryDevelopmentAcceptedSource = "human" | "agent-proposal";

export type StoryDevelopmentFieldState = {
  readonly value: string;
  readonly acceptedSource: StoryDevelopmentAcceptedSource | null;
  readonly proposal: string;
  readonly proposalSourceRef: string | null;
  readonly proposalGeneratedAt: string | null;
  readonly updatedAt: string | null;
};

export type StoryDevelopmentState = {
  readonly version: typeof STORY_DEVELOPMENT_VERSION;
  readonly fields: Readonly<Record<string, StoryDevelopmentFieldState>>;
};

export function createEmptyStoryDevelopmentFieldState(): StoryDevelopmentFieldState {
  return {
    value: "",
    acceptedSource: null,
    proposal: "",
    proposalSourceRef: null,
    proposalGeneratedAt: null,
    updatedAt: null,
  };
}

export function createEmptyStoryDevelopmentState(): StoryDevelopmentState {
  return { version: STORY_DEVELOPMENT_VERSION, fields: {} };
}

export type LibraryPPFProject = PPFProject & {
  readonly structure: StoryStructureV2;
  readonly sourceEvidence: ProjectSourceEvidence;
  readonly writing: BlockWritingState;
  readonly discovery: DiscoveryState;
  readonly worldMap: WorldMapState;
  readonly storyDevelopment: StoryDevelopmentState;
};

function objectRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

function cleanStoryDevelopmentText(value: unknown, limit = 12_000) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").trim().slice(0, limit)
    : "";
}

export function normalizeStoryDevelopmentState(value: unknown): StoryDevelopmentState {
  const source = objectRecord(value);
  const rawFields = objectRecord(source.fields);
  const fields: Record<string, StoryDevelopmentFieldState> = {};

  for (const [rawKey, rawValue] of Object.entries(rawFields).slice(0, 2_000)) {
    const key = cleanStoryDevelopmentText(rawKey, 360);
    if (!key) continue;
    const field = objectRecord(rawValue);
    const acceptedSource: StoryDevelopmentAcceptedSource | null = field.acceptedSource === "human"
      ? "human"
      : field.acceptedSource === "agent-proposal"
        ? "agent-proposal"
        : null;
    fields[key] = {
      value: cleanStoryDevelopmentText(field.value),
      acceptedSource,
      proposal: cleanStoryDevelopmentText(field.proposal),
      proposalSourceRef: cleanStoryDevelopmentText(field.proposalSourceRef, 320) || null,
      proposalGeneratedAt: cleanStoryDevelopmentText(field.proposalGeneratedAt, 80) || null,
      updatedAt: cleanStoryDevelopmentText(field.updatedAt, 80) || null,
    };
  }

  return { version: STORY_DEVELOPMENT_VERSION, fields };
}

export function storyDevelopmentFieldState(
  state: StoryDevelopmentState,
  canonicalId: string,
): StoryDevelopmentFieldState {
  return state.fields[canonicalId] ?? createEmptyStoryDevelopmentFieldState();
}

/**
 * Canonical normalizer for the current profile-owned Library PPF shape.
 *
 * This is intentionally server-safe so the authenticated profile-private disk
 * authority and the browser Library hydrate/save path preserve the same story
 * fields. Do not move browser/session concerns into this module.
 */
export function normalizeLibraryProject(value: unknown): LibraryPPFProject {
  const source = objectRecord(value);
  const project = normalizeFoundationProject(value);
  const structure = source.structure === undefined
    ? createEmptyStoryStructureV2()
    : normalizeStoryStructureV2(source.structure);
  const sourceEvidence = source.sourceEvidence === undefined
    ? createEmptyProjectSourceEvidence()
    : normalizeProjectSourceEvidence(source.sourceEvidence);
  const writing = source.writing === undefined
    ? createEmptyBlockWritingState()
    : normalizeBlockWritingState(source.writing);
  const discovery = source.discovery === undefined
    ? createEmptyDiscoveryState()
    : normalizeDiscoveryState(source.discovery);
  const worldMap = source.worldMap === undefined
    ? createEmptyWorldMapState()
    : normalizeWorldMapState(source.worldMap);
  const storyDevelopment = source.storyDevelopment === undefined
    ? createEmptyStoryDevelopmentState()
    : normalizeStoryDevelopmentState(source.storyDevelopment);
  return { ...project, structure, sourceEvidence, writing, discovery, worldMap, storyDevelopment };
}

export function libraryBackupFileName(title: string) {
  const stem = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80) || "untitled-story";
  return `${stem}.ppf.json`;
}

export function serializeLibraryBackup(project: LibraryPPFProject) {
  return `${JSON.stringify(project, null, 2)}\n`;
}

export function parseLibraryBackup(text: string): LibraryPPFProject {
  const value: unknown = JSON.parse(text);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("This is not a PlotPickle Library backup.");
  const source = value as Record<string, unknown>;
  if (source.format !== PPF_FOUNDATION_VERSION || typeof source.id !== "string" || !source.id.trim()
    || typeof source.title !== "string" || !source.title.trim()
    || !source.structure || typeof source.structure !== "object" || Array.isArray(source.structure)
    || !source.foundations || typeof source.foundations !== "object" || Array.isArray(source.foundations)
    || !source.world || typeof source.world !== "object" || Array.isArray(source.world)
    || !source.build || typeof source.build !== "object" || Array.isArray(source.build)) {
    throw new Error("This is not a supported PlotPickle Library .ppf.json backup.");
  }
  return normalizeLibraryProject(value);
}
