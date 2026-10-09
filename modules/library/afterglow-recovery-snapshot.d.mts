import type {LibraryPPFProject} from "../../core/storage/library-project";
import type {MindMapCharacterRosterItem} from "../learn/model/mind-map-character-roster";

export const AFTERGLOW_REFERENCE_SOURCE: "afterglow-v9-complete-baseline";
export function isAfterglowRecoverySnapshot(project: unknown): project is LibraryPPFProject;
export type AfterglowRecoverySnapshotSummary=Readonly<{
  characterNames: readonly string[];
  characterCount: number;
  characterImageReferences: number;
  lockedCharacterVersions: number;
  storyboardImages: number;
  lockedStoryboardImages: number;
  approvedNarrationCount: number;
  mediaBytesVerified: false;
  readOnly: true;
}>;
export function summarizeAfterglowRecoverySnapshot(input: Readonly<{
  project: LibraryPPFProject;
  characters: readonly MindMapCharacterRosterItem[];
}>): AfterglowRecoverySnapshotSummary;
