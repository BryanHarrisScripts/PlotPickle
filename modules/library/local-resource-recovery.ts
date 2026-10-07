import {
  FOUNDATIONS_MARKETING_REFERENCE_FRONTIER,
  FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW,
  type FoundationsVisualArtifact,
} from "../../core/contracts/build-progress";
import { applyStoryCommand } from "../../core/project/apply-command";
import {
  lockWorldMapCharacterVisualVersion,
  saveWorldMapCharacterVisualVersion,
  worldMapCharacterVisualVersions,
  type WorldMapCharacterView,
  type WorldMapCharacterVisualReference,
} from "../../core/contracts/world-map";
import type { LibraryPPFProject } from "../../core/storage/library-project";
import packagedAfterglowManifest from "../../data/afterglow-packaged-current/manifest.json";

export type LocalAssetIndexItem = {
  readonly fileName: string;
  readonly url: string;
  readonly mediaType: string;
  readonly bytes: number;
  readonly contentHash: string;
  readonly modifiedAt: string;
};

const PACKAGED_AFTERGLOW_CONTENT_HASHES = new Set(
  Array.isArray(packagedAfterglowManifest.assets)
    ? packagedAfterglowManifest.assets
      .map((item) => item && typeof item === "object" && "contentHash" in item ? String(item.contentHash || "") : "")
      .filter(Boolean)
    : [],
);

export function isAlreadyPackagedAfterglowAsset(asset: LocalAssetIndexItem) {
  return Boolean(asset.contentHash && PACKAGED_AFTERGLOW_CONTENT_HASHES.has(asset.contentHash));
}


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

export type RecoveredWorldMapCharacterResource = {
  readonly kind: "worldmap-character";
  readonly fileName: string;
  readonly assetUrl: string;
  readonly contentHash: string;
  readonly modifiedAt: string;
  readonly originProjectId: string;
  readonly referenceId: string;
  readonly characterId: string;
  readonly characterName: string;
  readonly versionId: string;
  readonly view: WorldMapCharacterView;
  readonly prompt: string;
  readonly provider: string;
  readonly model: string;
  readonly createdAt: string;
  readonly locked: boolean;
};

export type RecoverableLocalResource =
  | RecoveredStoryboardResource
  | RecoveredWorldMapPosterResource
  | RecoveredWorldMapCharacterResource;

export type LocalResourceGroup = {
  readonly originProjectId: string;
  readonly exactProject: boolean;
  readonly selectedByDefault: boolean;
  readonly resources: readonly RecoverableLocalResource[];
};

export type LocalResourceInventory = {
  readonly storyboardResources: readonly RecoveredStoryboardResource[];
  readonly posterResources: readonly RecoveredWorldMapPosterResource[];
  readonly characterResources: readonly RecoveredWorldMapCharacterResource[];
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
const STORYBOARD_LOCAL_SAVE_MARKER = "storyboard-local-save:v1";

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

function orderedCharacterMetadataSources(
  preferredProjectId: string,
  sourceProjects: readonly LibraryPPFProject[],
) {
  return [...sourceProjects]
    .filter((source, index, all) => all.findIndex((candidate) => candidate.id === source.id) === index)
    .sort((left, right) => (
      Number(right.id === preferredProjectId) - Number(left.id === preferredProjectId)
      || right.updatedAt.localeCompare(left.updatedAt)
      || left.id.localeCompare(right.id)
    ));
}

export function parseRecoverableWorldMapCharacterAsset(
  asset: LocalAssetIndexItem,
  sourceProjects: readonly LibraryPPFProject[],
  preferredProjectId = "",
): RecoveredWorldMapCharacterResource | null {
  if (!asset.url.startsWith("/api/local-ai/assets/") || !["image/png", "image/jpeg", "image/webp"].includes(asset.mediaType)) return null;

  // Character asset stems are intentionally bounded by the image gateway, so the
  // filename alone cannot safely recover character/version/view identity. Require
  // an exact saved Library reference instead of guessing provenance from a truncated name.
  for (const source of orderedCharacterMetadataSources(preferredProjectId, sourceProjects)) {
    for (const characterPackage of source.worldMap.characterVisuals) {
      const reference = characterPackage.references.find((candidate) => candidate.assetUrl === asset.url);
      if (!reference) continue;
      return {
        kind: "worldmap-character",
        fileName: asset.fileName,
        assetUrl: asset.url,
        contentHash: asset.contentHash,
        modifiedAt: asset.modifiedAt,
        originProjectId: source.id,
        referenceId: reference.id,
        characterId: reference.characterId,
        characterName: reference.characterName,
        versionId: reference.versionId,
        view: reference.view,
        prompt: reference.prompt,
        provider: reference.provider,
        model: reference.model,
        createdAt: reference.createdAt,
        locked: characterPackage.lockedVersionId === reference.versionId,
      };
    }
  }
  return null;
}

export function inventoryLocalResources(
  project: LibraryPPFProject,
  assets: readonly LocalAssetIndexItem[],
  sourceProjects: readonly LibraryPPFProject[] = [],
): LocalResourceInventory {
  const storyboardResources: RecoveredStoryboardResource[] = [];
  const posterResources: RecoveredWorldMapPosterResource[] = [];
  const characterResources: RecoveredWorldMapCharacterResource[] = [];
  const unclassifiedAssets: LocalAssetIndexItem[] = [];
  const characterMetadataSources = [
    project,
    ...sourceProjects.filter((source) => source.id !== project.id),
  ];

  for (const asset of assets) {
    if (isAlreadyPackagedAfterglowAsset(asset)) continue;
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
    const character = parseRecoverableWorldMapCharacterAsset(asset, characterMetadataSources, project.id);
    if (character) {
      characterResources.push(character);
      continue;
    }
    unclassifiedAssets.push(asset);
  }

  const byNewest = <T extends { readonly modifiedAt: string; readonly fileName: string }>(left: T, right: T) => (
    right.modifiedAt.localeCompare(left.modifiedAt) || left.fileName.localeCompare(right.fileName)
  );
  storyboardResources.sort(byNewest);
  posterResources.sort(byNewest);
  characterResources.sort(byNewest);

  const grouped = new Map<string, RecoverableLocalResource[]>();
  for (const resource of [...storyboardResources, ...posterResources, ...characterResources]) {
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
  return { storyboardResources, posterResources, characterResources, groups, unclassifiedAssets };
}

function recoveryArtifactId(resource: RecoverableLocalResource) {
  const hash = resource.contentHash.replace(/^sha256:/iu, "").replace(/[^a-f0-9]/giu, "").toLowerCase();
  const stable = hash.slice(0, 40) || resource.fileName.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "").slice(0, 40);
  return `local-recovery-${stable}`;
}

type PriorStoryboardApproval = Readonly<{
  artifact: FoundationsVisualArtifact;
  projectId: string;
}>;

function orderedStoryboardSources(resource: RecoveredStoryboardResource, sourceProjects: readonly LibraryPPFProject[]) {
  return [...sourceProjects]
    .filter((source, index, all) => all.findIndex((candidate) => candidate.id === source.id) === index)
    .sort((left, right) =>
      right.updatedAt.localeCompare(left.updatedAt)
      || Number(right.id === resource.originProjectId) - Number(left.id === resource.originProjectId)
      || left.id.localeCompare(right.id)
    );
}

function priorStoryboardArtifact(
  resource: RecoveredStoryboardResource,
  sourceProjects: readonly LibraryPPFProject[],
): PriorStoryboardApproval | null {
  const blockRef = String(resource.blockNumber).padStart(2, "0");
  const anchorKey = `storyboard-anchor:block:block-${blockRef}:mini-${resource.miniBlockNumber}`;
  const originKey = `recovery-origin-project:${resource.originProjectId}`;
  const contentHashKey = `recovery-content-hash:${resource.contentHash}`;

  for (const source of orderedStoryboardSources(resource, sourceProjects)) {
    const directOrigin = source.id === resource.originProjectId;
    const artifact = source.build.foundations.visualArtifacts.find((candidate) => {
      const decisionKeys = candidate.sourceDecisionKeys ?? [];
      const provenanceMatches = directOrigin || (decisionKeys.includes(originKey) && decisionKeys.includes(contentHashKey));
      return provenanceMatches
        && candidate.assetUrl === resource.assetUrl
        && candidate.workflow === "storyboard-frame-webp-v2"
        && candidate.frameNumber === resource.position
        && candidate.reviewState !== "rejected"
        && decisionKeys.includes(anchorKey);
    });
    if (artifact) return { artifact, projectId: source.id };
  }
  return null;
}

function priorDeletedStoryboardArtifact(
  resource: RecoveredStoryboardResource,
  sourceProjects: readonly LibraryPPFProject[],
): PriorStoryboardApproval | null {
  const blockRef = String(resource.blockNumber).padStart(2, "0");
  const anchorKey = `storyboard-anchor:block:block-${blockRef}:mini-${resource.miniBlockNumber}`;
  const originKey = `recovery-origin-project:${resource.originProjectId}`;
  const contentHashKey = `recovery-content-hash:${resource.contentHash}`;

  for (const source of orderedStoryboardSources(resource, sourceProjects)) {
    const directOrigin = source.id === resource.originProjectId;
    const artifact = source.build.foundations.visualArtifacts.find((candidate) => {
      const decisionKeys = candidate.sourceDecisionKeys ?? [];
      const provenanceMatches = directOrigin || (decisionKeys.includes(originKey) && decisionKeys.includes(contentHashKey));
      return provenanceMatches
        && candidate.assetUrl === resource.assetUrl
        && candidate.workflow === "storyboard-frame-webp-v2"
        && candidate.frameNumber === resource.position
        && decisionKeys.includes(anchorKey);
    });
    if (!artifact) continue;
    const decisionKeys = artifact.sourceDecisionKeys ?? [];
    return artifact.reviewState === "rejected" && decisionKeys.includes("storyboard-deleted:v1")
      ? { artifact, projectId: source.id }
      : null;
  }
  return null;
}

function priorAcceptedStoryboardArtifact(
  resource: RecoveredStoryboardResource,
  sourceProjects: readonly LibraryPPFProject[],
): PriorStoryboardApproval | null {
  const blockRef = String(resource.blockNumber).padStart(2, "0");
  const anchorKey = `storyboard-anchor:block:block-${blockRef}:mini-${resource.miniBlockNumber}`;
  const originKey = `recovery-origin-project:${resource.originProjectId}`;
  const contentHashKey = `recovery-content-hash:${resource.contentHash}`;
  const orderedSources = orderedStoryboardSources(resource, sourceProjects);

  for (const source of orderedSources) {
    const acceptedIds = new Set(source.build.foundations.acceptedVisualArtifactIds);
    const directOrigin = source.id === resource.originProjectId;
    const artifact = source.build.foundations.visualArtifacts.find((candidate) => {
      const decisionKeys = candidate.sourceDecisionKeys ?? [];
      const provenanceMatches = directOrigin || (decisionKeys.includes(originKey) && decisionKeys.includes(contentHashKey));
      return provenanceMatches
        && candidate.assetUrl === resource.assetUrl
        && candidate.workflow === "storyboard-frame-webp-v2"
        && candidate.frameNumber === resource.position
        && candidate.reviewState !== "rejected"
        && decisionKeys.includes(anchorKey);
    });
    if (!artifact) continue;
    return artifact.reviewState === "accepted" || acceptedIds.has(artifact.id)
      ? { artifact, projectId: source.id }
      : null;
  }
  return null;
}

function preservedStoryboardDecisionKeys(
  resource: RecoveredStoryboardResource,
  priorArtifact: PriorStoryboardApproval | null,
  priorApproval: PriorStoryboardApproval | null,
) {
  const blockRef = String(resource.blockNumber).padStart(2, "0");
  const priorKeys = priorArtifact?.artifact.sourceDecisionKeys ?? [];
  return [...new Set([
    ...priorKeys,
    `storyboard-target:block:block-${blockRef}`,
    `storyboard-anchor:block:block-${blockRef}:mini-${resource.miniBlockNumber}`,
    `storyboard-position:${resource.position}`,
    `recovery-origin-project:${resource.originProjectId}`,
    `recovery-content-hash:${resource.contentHash}`,
    ...(priorKeys.includes(STORYBOARD_LOCAL_SAVE_MARKER) ? [STORYBOARD_LOCAL_SAVE_MARKER] : []),
    ...(priorApproval ? [
      `recovery-approved-artifact:${priorApproval.artifact.id}`,
      `recovery-approved-project:${priorApproval.projectId}`,
      "recovery-approval-source:saved-library",
    ] : []),
  ])];
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
  let restoredSavedCount = 0;
  for (const resource of resources) {
    const id = recoveryArtifactId(resource);
    const existingArtifact = current.build.foundations.visualArtifacts.find((artifact) =>
      artifact.assetUrl === resource.assetUrl || artifact.id === id
    );

    if (existingArtifact) {
      // The active Library snapshot is the Human's latest story-state authority.
      // Recovery may add provenance for the same local file, but historical
      // snapshots must never downgrade current Save, Lock/Unlock, prompt, or
      // other artifact metadata.
      if (existingArtifact.reviewState === "rejected") {
        skippedCount += 1;
        continue;
      }
      const currentArtifact = { artifact: existingArtifact, projectId: current.id } satisfies PriorStoryboardApproval;
      const currentlyAccepted = existingArtifact.reviewState === "accepted"
        || current.build.foundations.acceptedVisualArtifactIds.includes(existingArtifact.id);
      const currentApproval = currentlyAccepted ? currentArtifact : null;
      const decisionKeys = preservedStoryboardDecisionKeys(resource, currentArtifact, currentApproval);
      const shouldRefreshMetadata = decisionKeys.some(
        (key) => !(existingArtifact.sourceDecisionKeys ?? []).includes(key),
      );
      if (shouldRefreshMetadata) {
        current = applyStoryCommand(current, {
          type: "foundations.visual.store",
          artifact: {
            ...existingArtifact,
            sourceDecisionKeys: decisionKeys,
          },
          occurredAt: resource.modifiedAt,
        }) as LibraryPPFProject;
      }
      if (
        currentApproval
        && existingArtifact.workflow === "storyboard-frame-webp-v2"
        && existingArtifact.frameNumber === resource.position
        && (
          existingArtifact.reviewState !== "accepted"
          || !current.build.foundations.acceptedVisualArtifactIds.includes(existingArtifact.id)
        )
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

    // No current artifact exists for this local media. Historical Library
    // snapshots are fallback evidence only, ordered newest-first.
    const priorDeletedArtifact = priorDeletedStoryboardArtifact(resource, sourceProjects);
    if (priorDeletedArtifact) {
      skippedCount += 1;
      continue;
    }
    const priorArtifact = priorStoryboardArtifact(resource, sourceProjects);
    const priorApproval = priorAcceptedStoryboardArtifact(resource, sourceProjects);
    const priorSaved = Boolean(priorArtifact?.artifact.sourceDecisionKeys?.includes(STORYBOARD_LOCAL_SAVE_MARKER));
    const artifact: FoundationsVisualArtifact = {
      id,
      assetUrl: resource.assetUrl,
      prompt: priorArtifact?.artifact.prompt || "Recovered local Storyboard resource. Original prompt metadata was unavailable in the loaded project.",
      createdAt: resource.modifiedAt,
      provider: priorArtifact?.artifact.provider || "local recovery",
      model: priorArtifact?.artifact.model || "",
      frameNumber: resource.position,
      narrativeIntention: priorArtifact?.artifact.narrativeIntention || `Recovered local Storyboard frame · position ${String(resource.position).padStart(2, "0")}`,
      sourceDecisionKeys: preservedStoryboardDecisionKeys(resource, priorArtifact, priorApproval),
      workflow: "storyboard-frame-webp-v2",
      reviewState: "draft",
      parentArtifactId: priorArtifact?.artifact.id ?? null,
    };
    current = applyStoryCommand(current, {
      type: "foundations.visual.store",
      artifact,
      occurredAt: resource.modifiedAt,
    }) as LibraryPPFProject;
    if (priorSaved) restoredSavedCount += 1;
    if (priorApproval) {
      current = applyStoryCommand(current, {
        type: "foundations.visual.accept",
        artifactId: id,
        occurredAt: resource.modifiedAt,
      }) as LibraryPPFProject;
      restoredLockedCount += 1;
    }
    attachedCount += 1;
  }

  return { project: current, attachedCount, skippedCount, restoredLockedCount, restoredSavedCount };
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

function characterRecoveryGroupKey(resource: RecoveredWorldMapCharacterResource) {
  return `${resource.originProjectId}::${resource.characterId}::${resource.versionId}`;
}

export function restoreLocalWorldMapCharacterResources(
  project: LibraryPPFProject,
  resources: readonly RecoveredWorldMapCharacterResource[],
) {
  let current = project;
  let attachedVersionCount = 0;
  let skippedVersionCount = 0;
  let restoredLockedCount = 0;
  const groups = new Map<string, RecoveredWorldMapCharacterResource[]>();

  for (const resource of resources) {
    const key = characterRecoveryGroupKey(resource);
    const group = groups.get(key) ?? [];
    group.push(resource);
    groups.set(key, group);
  }

  for (const group of groups.values()) {
    const first = group[0];
    if (!first) continue;
    const occurredAt = group.reduce(
      (latest, item) => item.modifiedAt > latest ? item.modifiedAt : latest,
      first.modifiedAt,
    );
    const references: WorldMapCharacterVisualReference[] = group.map((resource) => ({
      id: resource.referenceId,
      versionId: resource.versionId,
      characterId: resource.characterId,
      characterName: resource.characterName,
      view: resource.view,
      assetUrl: resource.assetUrl,
      prompt: resource.prompt || "Recovered saved World Map character reference.",
      provider: resource.provider || "local recovery",
      model: resource.model,
      createdAt: resource.createdAt || resource.modifiedAt,
      reviewState: "draft",
    }));

    const before = worldMapCharacterVisualVersions(current.worldMap, first.characterId)
      .find((version) => version.id === first.versionId);
    const beforeUrls = new Set(before?.references.map((reference) => reference.assetUrl) ?? []);
    const addsAsset = references.some((reference) => !beforeUrls.has(reference.assetUrl));

    let worldMap = saveWorldMapCharacterVisualVersion(current.worldMap, {
      characterId: first.characterId,
      characterName: first.characterName,
      versionId: first.versionId,
      references,
      savedAt: occurredAt,
    });

    const recoveredVersion = worldMapCharacterVisualVersions(worldMap, first.characterId)
      .find((version) => version.id === first.versionId);
    const lockProven = group.every((resource) => resource.locked);
    if (lockProven && recoveredVersion?.complete && !recoveredVersion.locked) {
      worldMap = lockWorldMapCharacterVisualVersion(worldMap, first.characterId, first.versionId, occurredAt);
      restoredLockedCount += 1;
    }

    if (!addsAsset && before) {
      skippedVersionCount += 1;
      if (worldMap !== current.worldMap) {
        current = { ...current, worldMap, revision: current.revision + 1, updatedAt: occurredAt };
      }
      continue;
    }

    current = { ...current, worldMap, revision: current.revision + 1, updatedAt: occurredAt };
    attachedVersionCount += 1;
  }

  return { project: current, attachedVersionCount, skippedVersionCount, restoredLockedCount };
}
