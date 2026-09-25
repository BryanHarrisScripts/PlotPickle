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

export type LibraryPPFProject = PPFProject & {
  readonly structure: StoryStructureV2;
  readonly sourceEvidence: ProjectSourceEvidence;
  readonly writing: BlockWritingState;
  readonly discovery: DiscoveryState;
  readonly worldMap: WorldMapState;
};

function objectRecord(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
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
  return { ...project, structure, sourceEvidence, writing, discovery, worldMap };
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
