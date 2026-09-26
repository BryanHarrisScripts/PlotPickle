import {
  FOUNDATIONS_MARKETING_REFERENCE_FRONTIER,
  FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW,
  type FoundationsVisualArtifact,
} from "../../core/contracts/build-progress";
import { applyStoryCommand } from "../../core/project/apply-command";
import type { LibraryPPFProject } from "../../core/storage/library-project";

export type LocalAssetIndexItem = {
  readonly fileName: string;
  readonly url: string;
  readonly mediaType: string;
  readonly bytes: number;
  readonly contentHash: string;
  readonly modifiedAt: string;
};

export type RecoveredStoryboardResource = {
  readonly kind: "storyboard-frame";
  readonly fileName: string;
  readonly assetUrl: string;
  readonly contentHash: string;
  readonly modifiedAt: string;
  readonly originProjectId: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly position: number;
};

export type RecoveredWorldMapPosterResource = {
  readonly kind: "worldmap-poster";
  readonly fileName: string;
  readonly assetUrl: string;
  readonly contentHash: string;
  readonly modifiedAt: string;
  readonly originProjectId: string;
};

export type RecoverableLocalResource = RecoveredStoryboardResource | RecoveredWorldMapPosterResource;

export type LocalResourceGroup = {
  readonly originProjectId: string;
  readonly exactProject: boolean;
  readonly selectedByDefault: boolean;
  readonly resources: readonly RecoverableLocalResource[];
};

export type LocalResourceInventory = {
  readonly storyboardResources: readonly RecoveredStoryboardResource[];
  readonly posterResources: readonly RecoveredWorldMapPosterResource[];
  readonly groups: readonly LocalResourceGroup[];
  readonly unclassifiedAssets: readonly LocalAssetIndexItem[];
};

export type LibraryLoadSessionBaseline = {
  readonly version: 1;
  readonly sessionId: string;
  readonly projectId: string;
  readonly sourceIdentity: string;
  readonly baseRevision: number;
  readonly startedAt: string;
};

export type RevisionReconciliationState = "same-base" | "requires-three-way";

const STORYBOARD_FILE = /^storyboard-(.+)-(\d{1,2})-([1-4])-(\d{1,2})-(\d{10,})-(\d{10,})\.webp$/iu;
const WORLDMAP_POSTER_FILE = /^worldmap-poster-(.+)-(\d{10,})\.(png|jpe?g|webp)$/iu;

function normalizedSourceIdentity(project: LibraryPPFProject) {
  const fixture = project.sourceEvidence?.referenceFixture;
  if (fixture && typeof fixture === "object" && "sourceId" in fixture && typeof fixture.sourceId === "string" && fixture.sourceId.trim()) {
    return `reference:${fixture.sourceId.trim()}`;
  }
  return `project:${project.id}`;
}

export function createLibraryLoadSessionBaseline(
  project: LibraryPPFProject,
  input: { readonly sessionId: string; readonly startedAt: string },
): LibraryLoadSessionBaseline {
  if (!input.sessionId.trim()) throw new Error("A Library Load Session requires a session ID.");
  if (!input.startedAt.trim()) throw new Error("A Library Load Session requires a start time.");
  return {
    version: 1,
    sessionId: input.sessionId.trim(),
    projectId: project.id,
    sourceIdentity: normalizedSourceIdentity(project),
    baseRevision: project.revision,
    startedAt: input.startedAt,
  };
}

export function revisionReconciliationState(
  baseline: LibraryLoadSessionBaseline,
  currentRevision: number,
): RevisionReconciliationState {
  return currentRevision === baseline.baseRevision ? "same-base" : "requires-three-way";
}

export function parseRecoverableStoryboardAsset(asset: LocalAssetIndexItem): RecoveredStoryboardResource | null {
  const match = STORYBOARD_FILE.exec(asset.fileName);
  if (!match) return null;
  const blockNumber = Number.parseInt(match[2], 10);
  const miniBlockNumber = Number.parseInt(match[3], 10);
  const position = Number.parseInt(match[4], 10);
  if (blockNumber < 1 || blockNumber > 24 || miniBlockNumber < 1 || miniBlockNumber > 4 || position < 1 || position > 25) return null;
  if (!asset.url.startsWith("/api/local-ai/assets/") || asset.mediaType !== "image/webp") return null;
  return {
    kind: "storyboard-frame",
    fileName: asset.fileName,
    assetUrl: asset.url,
    contentHash: asset.contentHash,
    modifiedAt: asset.modifiedAt,
    originProjectId: match[1],
    blockNumber,
    miniBlockNumber,
    position,
  };
}

export function parseRecoverableWorldMapPosterAsset(asset: LocalAssetIndexItem): RecoveredWorldMapPosterResource | null {
  const match = WORLDMAP_POSTER_FILE.exec(asset.fileName);
  if (!match) return null;
  if (!asset.url.startsWith("/api/local-ai/assets/") || !["image/png", "image/jpeg", "image/webp"].includes(asset.mediaType)) return null;
  return {
    kind: "worldmap-poster",
    fileName: asset.fileName,
    assetUrl: asset.url,
    contentHash: asset.contentHash,
    modifiedAt: asset.modifiedAt,
    originProjectId: match[1],
  };
}

export function inventoryLocalResources(
  project: LibraryPPFProject,
  assets: readonly LocalAssetIndexItem[],
): LocalResourceInventory {
  const storyboardResources: RecoveredStoryboardResource[] = [];
  const posterResources: RecoveredWorldMapPosterResource[] = [];
  const unclassifiedAssets: LocalAssetIndexItem[] = [];
  for (const asset of assets) {
    const storyboard = parseRecoverableStoryboardAsset(asset);
    if (storyboard) {
      storyboardResources.push(storyboard);
      continue;
    }
    const poster = parseRecoverableWorldMapPosterAsset(asset);
    if (poster) {
      posterResources.push(poster);
      continue;
    }
    unclassifiedAssets.push(asset);
  }

  const byNewest = <T extends { readonly modifiedAt: string; readonly fileName: string }>(left: T, right: T) => (
    right.modifiedAt.localeCompare(left.modifiedAt) || left.fileName.localeCompare(right.fileName)
  );
  storyboardResources.sort(byNewest);
  posterResources.sort(byNewest);

  const grouped = new Map<string, RecoverableLocalResource[]>();
  for (const resource of [...storyboardResources, ...posterResources]) {
    const existing = grouped.get(resource.originProjectId) ?? [];
    existing.push(resource);
    grouped.set(resource.originProjectId, existing);
  }
  const projectId = project.id.toLowerCase();
  const groups = [...grouped.entries()]
    .map(([originProjectId, resources]) => {
      const exactProject = originProjectId.toLowerCase() === projectId;
      return {
        originProjectId,
        exactProject,
        selectedByDefault: exactProject,
        resources: resources.sort(byNewest),
      } satisfies LocalResourceGroup;
    })
    .sort((left, right) => Number(right.exactProject) - Number(left.exactProject) || left.originProjectId.localeCompare(right.originProjectId));
  return { storyboardResources, posterResources, groups, unclassifiedAssets };
}

function recoveryArtifactId(resource: RecoverableLocalResource) {
  const hash = resource.contentHash.replace(/^sha256:/iu, "").replace(/[^a-f0-9]/giu, "").toLowerCase();
  const stable = hash.slice(0, 40) || resource.fileName.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 40);
  return `local-recovery-${stable}`;
}

function priorAcceptedStoryboardArtifact(
  resource: RecoveredStoryboardResource,
  sourceProjects: readonly LibraryPPFProject[],
) {
  const source = sourceProjects.find((candidate) => candidate.id === resource.originProjectId);
  if (!source) return null;
  const blockRef = String(resource.blockNumber).padStart(2, "0");
  const anchorKey = `storyboard-anchor:block:block-${blockRef}:mini-${resource.miniBlockNumber}`;
  const acceptedIds = new Set(source.build.foundations.acceptedVisualArtifactIds);
  return source.build.foundations.visualArtifacts.find((artifact) =>
    artifact.assetUrl === resource.assetUrl
    && artifact.workflow === "storyboard-frame-webp-v2"
    && artifact.frameNumber === resource.position
    && artifact.reviewState !== "rejected"
    && (artifact.sourceDecisionKeys ?? []).includes(anchorKey)
    && (artifact.reviewState === "accepted" || acceptedIds.has(artifact.id))
  ) ?? null;
}

export function restoreLocalStoryboardResources(
  project: LibraryPPFProject,
  resources: readonly RecoveredStoryboardResource[],
  sourceProjects: readonly LibraryPPFProject[] = [],
) {
  let current = project;
  let attachedCount = 0;
  let skippedCount = 0;
  let restoredLockedCount = 0;
  const existingUrls = new Set(project.build.foundations.visualArtifacts.map((artifact) => artifact.assetUrl));
  const existingIds = new Set(project.build.foundations.visualArtifacts.map((artifact) => artifact.id));

  for (const resource of resources) {
    const id = recoveryArtifactId(resource);
    const priorApproval = priorAcceptedStoryboardArtifact(resource, sourceProjects);
    const existingArtifact = current.build.foundations.visualArtifacts.find((artifact) =>
      artifact.assetUrl === resource.assetUrl || artifact.id === id
    );

    if (existingArtifact) {
      if (
        priorApproval
        && existingArtifact.workflow === "storyboard-frame-webp-v2"
        && existingArtifact.frameNumber === resource.position
        && existingArtifact.reviewState !== "rejected"
        && !current.build.foundations.acceptedVisualArtifactIds.includes(existingArtifact.id)
      ) {
        current = applyStoryCommand(current, {
          type: "foundations.visual.accept",
          artifactId: existingArtifact.id,
          occurredAt: resource.modifiedAt,
        }) as LibraryPPFProject;
        restoredLockedCount += 1;
      }
      skippedCount += 1;
      continue;
    }

    const blockRef = String(resource.blockNumber).padStart(2, "0");
    const artifact: FoundationsVisualArtifact = {
      id,
      assetUrl: resource.assetUrl,
      prompt: "Recovered local Storyboard resource. Original prompt metadata was unavailable in the loaded project.",
      createdAt: resource.modifiedAt,
      provider: "local recovery",
      model: "",
      frameNumber: resource.position,
      narrativeIntention: `Recovered local Storyboard frame · position ${String(resource.position).padStart(2, "0")}`,
      sourceDecisionKeys: [
        `storyboard-target:block:block-${blockRef}`,
        `storyboard-anchor:block:block-${blockRef}:mini-${resource.miniBlockNumber}`,
        `storyboard-position:${resource.position}`,
        `recovery-origin-project:${resource.originProjectId}`,
        `recovery-content-hash:${resource.contentHash}`,
        ...(priorApproval ? [
          `recovery-approved-artifact:${priorApproval.id}`,
          "recovery-approval-source:saved-library",
        ] : []),
      ],
      workflow: "storyboard-frame-webp-v2",
      reviewState: "draft",
      parentArtifactId: null,
    };
    current = applyStoryCommand(current, {
      type: "foundations.visual.store",
      artifact,
      occurredAt: resource.modifiedAt,
    }) as LibraryPPFProject;
    if (priorApproval) {
      current = applyStoryCommand(current, {
        type: "foundations.visual.accept",
        artifactId: id,
        occurredAt: resource.modifiedAt,
      }) as LibraryPPFProject;
      restoredLockedCount += 1;
    }
    existingUrls.add(resource.assetUrl);
    existingIds.add(id);
    attachedCount += 1;
  }

  return { project: current, attachedCount, skippedCount, restoredLockedCount };
}

export function restoreLocalWorldMapPosterResources(
  project: LibraryPPFProject,
  resources: readonly RecoveredWorldMapPosterResource[],
) {
  let current = project;
  let attachedCount = 0;
  let skippedCount = 0;
  const existingUrls = new Set(project.build.foundations.visualArtifacts.map((artifact) => artifact.assetUrl));
  const existingIds = new Set(project.build.foundations.visualArtifacts.map((artifact) => artifact.id));

  for (const resource of resources) {
    const id = recoveryArtifactId(resource);
    if (existingUrls.has(resource.assetUrl) || existingIds.has(id)) {
      skippedCount += 1;
      continue;
    }
    const artifact: FoundationsVisualArtifact = {
      id,
      assetUrl: resource.assetUrl,
      prompt: "Recovered local WorldMap poster. Original prompt metadata was unavailable in the loaded project. Credit identities remain unverified and must not be inferred.",
      createdAt: resource.modifiedAt,
      provider: "local recovery",
      model: "",
      narrativeIntention: "PPF Marketing Reference · recovered WorldMap poster",
      curriculumFrontier: FOUNDATIONS_MARKETING_REFERENCE_FRONTIER,
      sourceDecisionKeys: [
        "authority:marketing-reference",
        "surface:worldmap",
        `recovery-origin-project:${resource.originProjectId}`,
        `recovery-content-hash:${resource.contentHash}`,
      ],
      workflow: FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW,
      reviewState: "draft",
      parentArtifactId: null,
    };
    current = applyStoryCommand(current, {
      type: "foundations.visual.store",
      artifact,
      occurredAt: resource.modifiedAt,
    }) as LibraryPPFProject;
    existingUrls.add(resource.assetUrl);
    existingIds.add(id);
    attachedCount += 1;
  }

  return { project: current, attachedCount, skippedCount };
}
