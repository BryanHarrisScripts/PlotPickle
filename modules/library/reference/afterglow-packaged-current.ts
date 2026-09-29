import manifest from "../../../data/afterglow-packaged-current/manifest.json";
import snapshot from "../../../data/afterglow-packaged-current/snapshot.json";
import { normalizeLibraryProject, type LibraryPPFProject } from "../../../core/storage/library-project";
import { createAfterglowV9FoundationsReference } from "./afterglow-v9-foundations";

export type AfterglowPackagedCurrentManifest = Readonly<{
  schemaVersion: number;
  status: string;
  assetRoot: string;
  source: Readonly<{
    referenceSourceId: string;
    projectId: string | null;
    revision: number | null;
    updatedAt: string | null;
  }>;
  snapshotSha256: string | null;
  assets: readonly Readonly<{
    sourceUrl: string;
    publicUrl: string;
    target: string;
    sha256: string;
  }>[];
}>;

export const AFTERGLOW_PACKAGED_CURRENT_MANIFEST = manifest as AfterglowPackagedCurrentManifest;

export function hasPromotedAfterglowPackagedSnapshot() {
  const candidate = snapshot as Readonly<{ status?: unknown; project?: unknown }>;
  return manifest.status === "promoted"
    && candidate.status === "promoted"
    && Boolean(candidate.project && typeof candidate.project === "object" && !Array.isArray(candidate.project));
}

/**
 * Canonical packaged example authority.
 *
 * The immutable v9/Foundations fixture remains the fallback/source-evidence authority.
 * A Human-approved promoted snapshot may replace the example state users open, but it
 * must retain v9 reference provenance and repository-backed asset URLs.
 */
export function createAfterglowPackagedCurrentReference(): LibraryPPFProject {
  if (!hasPromotedAfterglowPackagedSnapshot()) {
    return normalizeLibraryProject(createAfterglowV9FoundationsReference());
  }
  const candidate = snapshot as Readonly<{ project: unknown }>;
  return normalizeLibraryProject(candidate.project);
}
