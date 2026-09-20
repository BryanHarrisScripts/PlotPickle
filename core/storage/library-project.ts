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
import { normalizeFoundationProject, type PPFProject } from "../project/project";
import { createEmptyDiscoveryState, normalizeDiscoveryState, type DiscoveryState } from "../contracts/discovery";

export type LibraryPPFProject = PPFProject & {
  readonly structure: StoryStructureV2;
  readonly sourceEvidence: ProjectSourceEvidence;
  readonly writing: BlockWritingState;
  readonly discovery: DiscoveryState;
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
  return { ...project, structure, sourceEvidence, writing, discovery };
}
