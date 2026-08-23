import {
  createGraphicNovelPlan,
  updateComicPitchPanel,
  withComicPitchDeck,
} from "./ai-pitch-deck";
import type {
  ComicPitchPanel,
  PlotPickleProject,
} from "./project";
import {
  registerProjectAssetSource,
  type ProjectAsset,
  type ProjectAssetReference,
  type ProjectAssetVariation,
} from "./project-assets";

export type LocalGraphicNovelAsset = {
  fileName: string;
  url: string;
  mediaType: "image/webp" | "image/png" | "image/jpeg";
  bytes: number;
  contentHash: string;
  modifiedAt: string;
};

export type GraphicNovelAssetOrigin = "original" | "local" | "repository";

export type GraphicNovelAssetVersion = {
  reference: ProjectAssetReference;
  source: string;
  label: string;
  origin: GraphicNovelAssetOrigin;
  selected: boolean;
  contentHash: string;
  bytes: number;
  generatedAt: string;
};

export type RepositoryAssetFile = {
  fileName: string;
  repositoryPath: string;
  contentHash: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeFileName(value: unknown) {
  return typeof value === "string" && /^[a-z0-9][a-z0-9._-]*\.(?:webp|png|jpe?g)$/i.test(value)
    ? value
    : "";
}

function mediaTypeFor(fileName: string): LocalGraphicNovelAsset["mediaType"] {
  if (fileName.toLowerCase().endsWith(".png")) return "image/png";
  if (/\.jpe?g$/i.test(fileName)) return "image/jpeg";
  return "image/webp";
}

export function normalizeLocalGraphicNovelAssets(value: unknown): LocalGraphicNovelAsset[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    const candidate = record(item);
    const fileName = safeFileName(candidate.fileName);
    const url = typeof candidate.url === "string" ? candidate.url : "";
    const hash = typeof candidate.contentHash === "string" ? candidate.contentHash.toLowerCase() : "";
    if (!fileName || url !== `/api/local-ai/assets/${fileName}` || !/^sha256:[a-f0-9]{64}$/.test(hash)) return [];
    return [{
      fileName,
      url,
      mediaType: mediaTypeFor(fileName),
      bytes: Math.max(0, Number(candidate.bytes) || 0),
      contentHash: hash,
      modifiedAt: typeof candidate.modifiedAt === "string" ? candidate.modifiedAt : "",
    }];
  }).sort((left, right) => right.modifiedAt.localeCompare(left.modifiedAt) || left.fileName.localeCompare(right.fileName));
}

export function graphicNovelPanelIdForLocalAsset(fileName: string, panelIds: string[]) {
  const stem = fileName.replace(/\.(?:webp|png|jpe?g)$/i, "").toLowerCase();
  return [...panelIds]
    .sort((left, right) => right.length - left.length)
    .find((panelId) => stem === panelId.toLowerCase() || stem.startsWith(`${panelId.toLowerCase()}-`)) || "";
}

function storyboardReference(project: PlotPickleProject, panel: ComicPitchPanel) {
  return project.blocks
    .find((block) => block.number === panel.blockNumber)
    ?.visuals.find((frame) => frame.miniBlockNumber === panel.miniBlockNumber)
    ?.assetRef;
}

function panelAssets(project: PlotPickleProject, panel: ComicPitchPanel): ProjectAsset[] {
  const assetIds = new Set([
    panel.assetRef?.assetId,
    storyboardReference(project, panel)?.assetId,
    ...project.assets.assets
      .filter((asset) => asset.targets.some((target) => target.kind === "graphic-novel-panel" && target.id === panel.id))
      .map((asset) => asset.id),
  ].filter((value): value is string => Boolean(value)));
  return project.assets.assets.filter((asset) => assetIds.has(asset.id));
}

function versionOrigin(variation: ProjectAssetVariation): GraphicNovelAssetOrigin {
  if (variation.extensions.origin === "repository" || variation.source.startsWith("/api/local-github/asset?")) return "repository";
  if (variation.extensions.origin === "local" || variation.source.startsWith("/api/local-ai/assets/")) return "local";
  return "original";
}

function versionLabel(origin: GraphicNovelAssetOrigin, index: number) {
  if (origin === "original") return index ? `Original ${index + 1}` : "Original";
  if (origin === "repository") return `Repository version ${index + 1}`;
  return `Local version ${index + 1}`;
}

export function graphicNovelAssetVersions(project: PlotPickleProject, panel: ComicPitchPanel): GraphicNovelAssetVersion[] {
  const counts: Record<GraphicNovelAssetOrigin, number> = { original: 0, local: 0, repository: 0 };
  const versions = panelAssets(project, panel).flatMap((asset) => asset.variations.map((variation) => {
    const origin = versionOrigin(variation);
    const index = counts[origin]++;
    return {
      reference: { assetId: asset.id, variationId: variation.id },
      source: variation.source || variation.portablePath,
      label: versionLabel(origin, index),
      origin,
      selected: panel.assetRef?.assetId === asset.id && panel.assetRef.variationId === variation.id,
      contentHash: variation.contentHash,
      bytes: variation.bytes,
      generatedAt: variation.generatedAt,
    };
  }));
  return versions.sort((left, right) => {
    const rank: Record<GraphicNovelAssetOrigin, number> = { original: 0, local: 1, repository: 2 };
    return rank[left.origin] - rank[right.origin] || right.generatedAt.localeCompare(left.generatedAt) || left.label.localeCompare(right.label);
  });
}

export function discoverLocalGraphicNovelVersions(project: PlotPickleProject, input: LocalGraphicNovelAsset[]) {
  const deck = project.review.pitchPackage.comicDeck ?? createGraphicNovelPlan(project);
  let next = withComicPitchDeck(project, deck);
  let matched = 0;
  const matchedFiles = new Set<string>();
  const panelIds = deck.panels.map((panel) => panel.id);

  for (const file of input) {
    const panelId = graphicNovelPanelIdForLocalAsset(file.fileName, panelIds);
    const panel = deck.panels.find((candidate) => candidate.id === panelId);
    if (!panel) continue;
    const preferredReference = panel.assetRef ?? storyboardReference(next, panel);
    const registered = registerProjectAssetSource(next.assets, {
      target: { kind: "graphic-novel-panel", id: panel.id },
      source: file.url,
      kind: "image",
      label: panel.title,
      preferredReference,
      mediaType: file.mediaType,
      contentHash: file.contentHash,
      bytes: file.bytes,
      generatedAt: file.modifiedAt,
      updatedAt: file.modifiedAt,
      variationExtensions: { origin: "local", localFileName: file.fileName },
    });
    next = { ...next, assets: registered.registry };
    matched += 1;
    matchedFiles.add(file.fileName);
  }

  return {
    project: next,
    matched,
    unmatched: input.length - matchedFiles.size,
  };
}

function variationFor(project: PlotPickleProject, reference: ProjectAssetReference) {
  const asset = project.assets.assets.find((candidate) => candidate.id === reference.assetId);
  const variation = asset?.variations.find((candidate) => candidate.id === reference.variationId);
  if (!asset || !variation) throw new Error("The selected image version is no longer available.");
  return { asset, variation };
}

export function selectGraphicNovelAssetVersion(
  project: PlotPickleProject,
  panelId: string,
  reference: ProjectAssetReference,
) {
  const deck = project.review.pitchPackage.comicDeck ?? createGraphicNovelPlan(project);
  const panel = deck.panels.find((candidate) => candidate.id === panelId);
  if (!panel) throw new Error("The selected Graphic Novel panel no longer exists.");
  const { variation } = variationFor(project, reference);
  const registered = registerProjectAssetSource(project.assets, {
    target: { kind: "graphic-novel-panel", id: panel.id },
    source: variation.source || variation.portablePath,
    label: panel.title,
    preferredReference: reference,
    mediaType: variation.mediaType,
    contentHash: variation.contentHash,
    bytes: variation.bytes,
    provider: variation.provider,
    model: variation.model,
    prompt: variation.prompt,
    generatedAt: variation.generatedAt,
    portablePath: variation.portablePath,
    variationExtensions: variation.extensions,
  });
  if (!registered.reference) throw new Error("The selected image version could not be attached.");
  const nextDeck = updateComicPitchPanel(deck, panel.id, {
    imageSrc: variation.source || variation.portablePath,
    assetRef: registered.reference,
    status: "complete",
    error: "",
    provider: variation.provider,
    model: variation.model,
    generatedAt: variation.generatedAt,
  });
  return withComicPitchDeck({ ...project, assets: registered.registry }, nextDeck);
}

export function prepareGraphicNovelRepositoryVersion(
  project: PlotPickleProject,
  panelId: string,
  reference: ProjectAssetReference,
): { project: PlotPickleProject; assetFile: RepositoryAssetFile; repositoryReference: ProjectAssetReference } {
  const deck = project.review.pitchPackage.comicDeck ?? createGraphicNovelPlan(project);
  const panel = deck.panels.find((candidate) => candidate.id === panelId);
  if (!panel) throw new Error("The selected Graphic Novel panel no longer exists.");
  const { variation } = variationFor(project, reference);
  const fileName = safeFileName(variation.extensions.localFileName)
    || safeFileName(variation.source.split("/").at(-1));
  const hash = variation.contentHash.replace(/^sha256:/i, "").toLowerCase();
  if (!fileName || !variation.source.startsWith("/api/local-ai/assets/")) {
    throw new Error("Only a local PlotPickle asset can be published as a repository version.");
  }
  if (!/^[a-f0-9]{64}$/.test(hash)) throw new Error("Scan the local asset again so PlotPickle can verify its SHA-256 hash.");
  const repositoryPath = `assets/${fileName}`;
  const repositorySource = `/api/local-github/asset?path=${encodeURIComponent(repositoryPath)}&fallback=${encodeURIComponent(fileName)}&sha256=${hash}`;
  const registered = registerProjectAssetSource(project.assets, {
    target: { kind: "graphic-novel-panel", id: panel.id },
    source: repositorySource,
    kind: "image",
    label: panel.title,
    preferredReference: reference,
    mediaType: variation.mediaType,
    contentHash: `sha256:${hash}`,
    bytes: variation.bytes,
    provider: variation.provider,
    model: variation.model,
    prompt: variation.prompt,
    generatedAt: variation.generatedAt,
    portablePath: repositoryPath,
    updatedAt: new Date().toISOString(),
    variationExtensions: {
      ...variation.extensions,
      origin: "repository",
      repositoryPath,
      localFileName: fileName,
    },
  });
  if (!registered.reference) throw new Error("The repository image version could not be prepared.");
  const nextDeck = updateComicPitchPanel(deck, panel.id, {
    imageSrc: repositorySource,
    assetRef: registered.reference,
    status: "complete",
    error: "",
  });
  return {
    project: withComicPitchDeck({ ...project, assets: registered.registry }, nextDeck),
    assetFile: { fileName, repositoryPath, contentHash: `sha256:${hash}` },
    repositoryReference: registered.reference,
  };
}
