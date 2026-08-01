import type { PlotPickleProject } from "./project";

export const PROJECT_ASSET_IDENTITY_VERSION = "1.0.0" as const; // compatibility-safe optional module

export type ProjectAssetKind = "image" | "video" | "audio" | "document" | "other";
export type ProjectAssetApproval = "unreviewed" | "approved" | "rejected";
export type ProjectAssetTargetKind =
  | "graphic-novel-panel"
  | "storyboard-frame"
  | "production-shot"
  | "animatic"
  | "report"
  | "other";

export type ProjectAssetReference = {
  assetId: string;
  variationId: string;
};

export type ProjectAssetTarget = {
  kind: ProjectAssetTargetKind;
  id: string;
};

export type ProjectAssetVariation = {
  id: string;
  source: string;
  portablePath: string;
  sourceFingerprint: string;
  contentHash: string;
  mediaType: string;
  bytes: number;
  provider: string;
  model: string;
  prompt: string;
  generatedAt: string;
  provenanceIds: string[];
  approval: ProjectAssetApproval;
  extensions: Record<string, unknown>;
};

export type ProjectAsset = {
  id: string;
  kind: ProjectAssetKind;
  label: string;
  targets: ProjectAssetTarget[];
  variations: ProjectAssetVariation[];
  approvedVariationId: string;
  createdAt: string;
  updatedAt: string;
  extensions: Record<string, unknown>;
};

export type ProjectAssetRegistry = {
  version: typeof PROJECT_ASSET_IDENTITY_VERSION;
  assets: ProjectAsset[];
  extensions: Record<string, unknown>;
};

export type RegisterAssetInput = {
  target: ProjectAssetTarget;
  source: string;
  kind?: ProjectAssetKind;
  label?: string;
  preferredReference?: ProjectAssetReference;
  mediaType?: string;
  contentHash?: string;
  bytes?: number;
  portablePath?: string;
  variationExtensions?: Record<string, unknown>;
  provider?: string;
  model?: string;
  prompt?: string;
  generatedAt?: string;
  provenanceIds?: string[];
  approval?: ProjectAssetApproval;
  updatedAt?: string;
};

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function strings(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item)))] : [];
}

function targetKey(target: ProjectAssetTarget) {
  return `${target.kind}:${target.id}`;
}

function sortedTargets(targets: ProjectAssetTarget[]) {
  const unique = new Map(targets.filter((target) => target.id).map((target) => [targetKey(target), target]));
  return [...unique.values()].sort((left, right) => targetKey(left).localeCompare(targetKey(right)));
}

function sortedVariations(variations: ProjectAssetVariation[]) {
  return [...variations].sort((left, right) => left.id.localeCompare(right.id));
}

export function stableAssetFingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a-${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

function sourceMediaType(source: string) {
  const dataType = /^data:([^;,]+)/i.exec(source)?.[1];
  if (dataType) return dataType.toLowerCase();
  const clean = source.split(/[?#]/, 1)[0].toLowerCase();
  if (clean.endsWith(".webp")) return "image/webp";
  if (clean.endsWith(".png")) return "image/png";
  if (clean.endsWith(".jpg") || clean.endsWith(".jpeg")) return "image/jpeg";
  if (clean.endsWith(".svg")) return "image/svg+xml";
  if (clean.endsWith(".mp4")) return "video/mp4";
  if (clean.endsWith(".webm")) return "video/webm";
  if (clean.endsWith(".wav")) return "audio/wav";
  if (clean.endsWith(".mp3")) return "audio/mpeg";
  if (clean.endsWith(".pdf")) return "application/pdf";
  return "application/octet-stream";
}

function extensionFor(mediaType: string) {
  if (mediaType === "image/webp") return "webp";
  if (mediaType === "image/png") return "png";
  if (mediaType === "image/jpeg") return "jpg";
  if (mediaType === "image/svg+xml") return "svg";
  if (mediaType === "video/mp4") return "mp4";
  if (mediaType === "video/webm") return "webm";
  if (mediaType === "audio/wav") return "wav";
  if (mediaType === "audio/mpeg") return "mp3";
  if (mediaType === "application/pdf") return "pdf";
  return "bin";
}

export function portableAssetPath(source: string, fingerprint = stableAssetFingerprint(source)) {
  const localAsset = /^\/api\/local-ai\/assets\/([a-z0-9-]+\.(?:webp|png|jpe?g))$/i.exec(source)?.[1];
  if (localAsset) return `assets/${localAsset}`;
  if (/^assets\/[a-z0-9._/-]+$/i.test(source) && !source.includes("..")) return source;
  if (source.startsWith("data:")) return `assets/embedded-${fingerprint.slice("fnv1a-".length)}.${extensionFor(sourceMediaType(source))}`;
  return "";
}

export function normalizeProjectAssetReference(value: unknown): ProjectAssetReference | undefined {
  const candidate = record(value);
  const assetId = text(candidate.assetId).trim();
  const variationId = text(candidate.variationId).trim();
  return assetId && variationId ? { assetId, variationId } : undefined;
}

export function createEmptyProjectAssetRegistry(): ProjectAssetRegistry {
  return { version: PROJECT_ASSET_IDENTITY_VERSION, assets: [], extensions: {} };
}

function normalizeTarget(value: unknown): ProjectAssetTarget | null {
  const candidate = record(value);
  const kinds: ProjectAssetTargetKind[] = ["graphic-novel-panel", "storyboard-frame", "production-shot", "animatic", "report", "other"];
  const kind = kinds.includes(candidate.kind as ProjectAssetTargetKind) ? candidate.kind as ProjectAssetTargetKind : "other";
  const id = text(candidate.id).trim();
  return id ? { kind, id } : null;
}

function normalizeVariation(value: unknown, index: number): ProjectAssetVariation | null {
  const candidate = record(value);
  const source = text(candidate.source).trim();
  const portablePath = text(candidate.portablePath).trim();
  const fingerprintSource = source || portablePath;
  const sourceFingerprint = text(candidate.sourceFingerprint).trim() || (fingerprintSource ? stableAssetFingerprint(fingerprintSource) : "");
  const id = text(candidate.id).trim() || (sourceFingerprint ? `variation-${sourceFingerprint.slice("fnv1a-".length)}` : `variation-${index + 1}`);
  if (!fingerprintSource) return null;
  const approvals: ProjectAssetApproval[] = ["unreviewed", "approved", "rejected"];
  return {
    id,
    source,
    portablePath: portablePath || portableAssetPath(source, sourceFingerprint),
    sourceFingerprint,
    contentHash: text(candidate.contentHash).trim(),
    mediaType: text(candidate.mediaType).trim() || sourceMediaType(source),
    bytes: Math.max(0, Number(candidate.bytes) || 0),
    provider: text(candidate.provider),
    model: text(candidate.model),
    prompt: text(candidate.prompt),
    generatedAt: text(candidate.generatedAt),
    provenanceIds: strings(candidate.provenanceIds),
    approval: approvals.includes(candidate.approval as ProjectAssetApproval) ? candidate.approval as ProjectAssetApproval : "unreviewed",
    extensions: record(candidate.extensions),
  };
}

export function normalizeProjectAssetRegistry(value: unknown): ProjectAssetRegistry {
  const candidate = record(value);
  const assets = Array.isArray(candidate.assets) ? candidate.assets.flatMap((value, index) => {
    const item = record(value);
    const id = text(item.id).trim();
    if (!id) return [];
    const kinds: ProjectAssetKind[] = ["image", "video", "audio", "document", "other"];
    const variations = Array.isArray(item.variations)
      ? item.variations.flatMap((variation, variationIndex) => normalizeVariation(variation, variationIndex) ?? [])
      : [];
    const approvedVariationId = text(item.approvedVariationId).trim();
    return [{
      id,
      kind: kinds.includes(item.kind as ProjectAssetKind) ? item.kind as ProjectAssetKind : "other",
      label: text(item.label) || `Project asset ${index + 1}`,
      targets: sortedTargets(Array.isArray(item.targets) ? item.targets.flatMap((target) => normalizeTarget(target) ?? []) : []),
      variations: sortedVariations(variations),
      approvedVariationId: variations.some((variation) => variation.id === approvedVariationId) ? approvedVariationId : "",
      createdAt: text(item.createdAt),
      updatedAt: text(item.updatedAt),
      extensions: record(item.extensions),
    } satisfies ProjectAsset];
  }) : [];
  return {
    version: PROJECT_ASSET_IDENTITY_VERSION,
    assets: assets.sort((left, right) => left.id.localeCompare(right.id)),
    extensions: record(candidate.extensions),
  };
}

function variationFor(registry: ProjectAssetRegistry, reference?: ProjectAssetReference) {
  if (!reference) return null;
  const asset = registry.assets.find((item) => item.id === reference.assetId);
  const variation = asset?.variations.find((item) => item.id === reference.variationId);
  return asset && variation ? { asset, variation } : null;
}

export function resolveProjectAssetSource(
  registry: ProjectAssetRegistry,
  reference: ProjectAssetReference | undefined,
  legacySource = "",
) {
  const variation = variationFor(registry, reference)?.variation;
  return variation?.source || variation?.portablePath || legacySource;
}

export function detachProjectAssetTarget(
  value: ProjectAssetRegistry,
  target: ProjectAssetTarget,
): ProjectAssetRegistry {
  const registry = normalizeProjectAssetRegistry(value);
  return {
    ...registry,
    assets: registry.assets.map((asset) => ({
      ...asset,
      targets: asset.targets.filter((candidate) => targetKey(candidate) !== targetKey(target)),
    })),
  };
}

export function attachProjectAssetProvenance(
  value: ProjectAssetRegistry,
  references: Array<ProjectAssetReference | undefined>,
  provenanceId: string,
): ProjectAssetRegistry {
  const registry = normalizeProjectAssetRegistry(value);
  const keys = new Set(references.filter(Boolean).map((reference) => `${reference!.assetId}:${reference!.variationId}`));
  if (!provenanceId || !keys.size) return registry;
  return {
    ...registry,
    assets: registry.assets.map((asset) => ({
      ...asset,
      variations: asset.variations.map((variation) => keys.has(`${asset.id}:${variation.id}`) ? {
        ...variation,
        provenanceIds: [...new Set([...variation.provenanceIds, provenanceId])].sort(),
      } : variation),
    })),
  };
}

function uniqueAssetId(registry: ProjectAssetRegistry, input: RegisterAssetInput, fingerprint: string) {
  const preferred = input.preferredReference?.assetId;
  if (preferred && registry.assets.some((asset) => asset.id === preferred)) return preferred;
  const base = `asset-${stableAssetFingerprint(targetKey(input.target)).slice("fnv1a-".length)}`;
  const existing = registry.assets.find((asset) => asset.id === base);
  if (!existing || existing.targets.some((target) => targetKey(target) === targetKey(input.target))) return base;
  return `asset-${stableAssetFingerprint(`${targetKey(input.target)}:${fingerprint}`).slice("fnv1a-".length)}`;
}

export function registerProjectAssetSource(
  value: ProjectAssetRegistry,
  input: RegisterAssetInput,
): { registry: ProjectAssetRegistry; reference?: ProjectAssetReference } {
  const source = input.source.trim();
  if (!source || !input.target.id) return { registry: normalizeProjectAssetRegistry(value) };
  const registry = normalizeProjectAssetRegistry(value);
  const fingerprint = stableAssetFingerprint(source);
  const exact = registry.assets.flatMap((asset) => asset.variations.map((variation) => ({ asset, variation })))
    .find(({ variation }) => variation.source === source);
  const updatedAt = input.updatedAt || input.generatedAt || "";
  if (exact) {
    const assets = registry.assets.map((asset) => asset.id === exact.asset.id ? {
      ...asset,
      targets: sortedTargets([...asset.targets, input.target]),
      variations: asset.variations.map((variation) => variation.id === exact.variation.id ? {
        ...variation,
        portablePath: input.portablePath || variation.portablePath,
        contentHash: input.contentHash || variation.contentHash,
        mediaType: input.mediaType || variation.mediaType,
        bytes: input.bytes === undefined ? variation.bytes : Math.max(0, Number(input.bytes) || 0),
        generatedAt: input.generatedAt || variation.generatedAt,
        extensions: { ...variation.extensions, ...record(input.variationExtensions) },
      } : variation),
      updatedAt: updatedAt || asset.updatedAt,
    } : asset);
    return {
      registry: { ...registry, assets },
      reference: { assetId: exact.asset.id, variationId: exact.variation.id },
    };
  }

  const assetId = uniqueAssetId(registry, input, fingerprint);
  const variationId = `variation-${stableAssetFingerprint(`${assetId}:${source}`).slice("fnv1a-".length)}`;
  const variation: ProjectAssetVariation = {
    id: variationId,
    source,
    portablePath: input.portablePath || portableAssetPath(source, fingerprint),
    sourceFingerprint: fingerprint,
    contentHash: input.contentHash || "",
    mediaType: input.mediaType || sourceMediaType(source),
    bytes: Math.max(0, Number(input.bytes) || 0),
    provider: input.provider || "",
    model: input.model || "",
    prompt: input.prompt || "",
    generatedAt: input.generatedAt || "",
    provenanceIds: [...new Set(input.provenanceIds ?? [])].sort(),
    approval: input.approval || "unreviewed",
    extensions: record(input.variationExtensions),
  };
  const existing = registry.assets.find((asset) => asset.id === assetId);
  const asset: ProjectAsset = existing ? {
    ...existing,
    targets: sortedTargets([...existing.targets, input.target]),
    variations: sortedVariations([...existing.variations, variation]),
    approvedVariationId: variation.approval === "approved" ? variation.id : existing.approvedVariationId,
    updatedAt: updatedAt || existing.updatedAt,
  } : {
    id: assetId,
    kind: input.kind || "image",
    label: input.label || input.target.id,
    targets: [input.target],
    variations: [variation],
    approvedVariationId: variation.approval === "approved" ? variation.id : "",
    createdAt: updatedAt,
    updatedAt,
    extensions: {},
  };
  return {
    registry: {
      ...registry,
      assets: [...registry.assets.filter((item) => item.id !== assetId), asset].sort((left, right) => left.id.localeCompare(right.id)),
    },
    reference: { assetId, variationId },
  };
}

function approveReference(registry: ProjectAssetRegistry, reference: ProjectAssetReference | undefined) {
  if (!reference) return registry;
  return {
    ...registry,
    assets: registry.assets.map((asset) => asset.id === reference.assetId ? {
      ...asset,
      approvedVariationId: asset.variations.some((variation) => variation.id === reference.variationId) ? reference.variationId : asset.approvedVariationId,
      variations: asset.variations.map((variation) => variation.id === reference.variationId ? { ...variation, approval: "approved" as const } : variation),
    } : asset),
  };
}

export function migrateLegacyAssetReferences(project: PlotPickleProject): PlotPickleProject {
  let assets = normalizeProjectAssetRegistry(project.assets);
  const updatedAt = project.metadata.updatedAt || project.metadata.createdAt;

  const blocks = project.blocks.map((block) => ({
    ...block,
    visuals: block.visuals.map((frame) => {
      const resolved = resolveProjectAssetSource(assets, frame.assetRef, "");
      const source = frame.src.trim() || resolved;
      if (!source) return frame.assetRef ? { ...frame, assetRef: undefined } : frame;
      const registered = registerProjectAssetSource(assets, {
        target: { kind: "storyboard-frame", id: frame.id },
        source,
        label: frame.caption || frame.alt || `Storyboard frame ${block.number}.${frame.miniBlockNumber}`,
        preferredReference: frame.assetRef,
        prompt: frame.prompt,
        updatedAt,
      });
      assets = registered.registry;
      return { ...frame, src: source, assetRef: registered.reference };
    }),
  }));
  const frameReferenceById = new Map(blocks.flatMap((block) => block.visuals.flatMap((frame) => frame.assetRef
    ? [[frame.id, frame.assetRef] as const]
    : [])));
  const referenceByPosition = new Map(blocks.flatMap((block) => block.visuals.flatMap((frame) => frame.assetRef
    ? [[`${block.number}:${frame.miniBlockNumber}`, frame.assetRef] as const]
    : [])));

  const comicDeck = project.review.pitchPackage.comicDeck;
  const nextDeck = comicDeck ? {
    ...comicDeck,
    panels: comicDeck.panels.map((panel) => {
      const resolved = resolveProjectAssetSource(assets, panel.assetRef, "");
      const source = panel.imageSrc.trim() || resolved;
      if (!source) return panel.assetRef ? { ...panel, assetRef: undefined } : panel;
      const registered = registerProjectAssetSource(assets, {
        target: { kind: "graphic-novel-panel", id: panel.id },
        source,
        label: panel.title,
        preferredReference: panel.assetRef ?? referenceByPosition.get(`${panel.blockNumber}:${panel.miniBlockNumber}`),
        provider: panel.provider,
        model: panel.model,
        prompt: panel.revisedPrompt || panel.prompt,
        generatedAt: panel.generatedAt,
        updatedAt: panel.generatedAt || updatedAt,
      });
      assets = registered.registry;
      if (registered.reference) referenceByPosition.set(`${panel.blockNumber}:${panel.miniBlockNumber}`, registered.reference);
      return { ...panel, imageSrc: source, assetRef: registered.reference };
    }),
  } : comicDeck;

  const shots = project.production.shots.map((shot) => {
    const resolved = resolveProjectAssetSource(assets, shot.assetRef, "");
    const source = shot.keyframeSrc.trim() || resolved;
    if (!source) return shot.assetRef ? { ...shot, assetRef: undefined } : shot;
    const registered = registerProjectAssetSource(assets, {
      target: { kind: "production-shot", id: shot.id },
      source,
      label: shot.keyframeAlt || shot.purpose || `Production shot ${shot.shotNumber}`,
      preferredReference: shot.assetRef
        ?? frameReferenceById.get(shot.frameId)
        ?? referenceByPosition.get(`${shot.blockNumber}:${shot.miniBlockNumber}`),
      approval: shot.status === "approved" || shot.status === "captured" ? "approved" : "unreviewed",
      updatedAt: shot.updatedAt || updatedAt,
    });
    assets = registered.registry;
    if (shot.status === "approved" || shot.status === "captured") assets = approveReference(assets, registered.reference);
    return { ...shot, keyframeSrc: source, assetRef: registered.reference };
  });

  const activeTargets = new Set([
    ...blocks.flatMap((block) => block.visuals.flatMap((frame) => frame.assetRef
      ? [`storyboard-frame:${frame.id}`]
      : [])),
    ...(nextDeck?.panels.flatMap((panel) => panel.assetRef
      ? [`graphic-novel-panel:${panel.id}`]
      : []) ?? []),
    ...shots.flatMap((shot) => shot.assetRef
      ? [`production-shot:${shot.id}`]
      : []),
  ]);
  assets = {
    ...assets,
    assets: assets.assets.map((asset) => ({
      ...asset,
      targets: asset.targets.filter((target) => ![
        "storyboard-frame",
        "graphic-novel-panel",
        "production-shot",
      ].includes(target.kind) || activeTargets.has(targetKey(target))),
    })),
  };

  return {
    ...project,
    assets,
    blocks,
    review: {
      ...project.review,
      pitchPackage: {
        ...project.review.pitchPackage,
        ...(nextDeck ? { comicDeck: nextDeck } : {}),
      },
    },
    production: { ...project.production, shots },
  };
}

export function projectAssetReferenceCount(project: PlotPickleProject, assetId: string) {
  const references = [
    ...project.blocks.flatMap((block) => block.visuals.map((frame) => frame.assetRef)),
    ...(project.review.pitchPackage.comicDeck?.panels.map((panel) => panel.assetRef) ?? []),
    ...project.production.shots.map((shot) => shot.assetRef),
  ];
  return references.filter((reference) => reference?.assetId === assetId).length;
}

export function projectAssetSourceRisk(source: string): "machine-path" | "credential" | null {
  const credential = /(?:api[_-]?key|access[_-]?token|refresh[_-]?token|client[_-]?secret|signature|sig|x-amz-credential|x-amz-security-token|x-goog-credential)=|(?:bearer\s+[a-z0-9._~-]{12,}|sk-[a-z0-9_-]{12,})/i;
  const machinePath = /^(?:file:\/\/|[a-z]:[\\/]|\\\\|\/(?:users|home|private|root|var|tmp|etc|opt|mnt|volumes|workspace)\/)/i;
  if (credential.test(source)) return "credential";
  if (machinePath.test(source)) return "machine-path";
  return null;
}

export function projectAssetSourceRisks(registry: ProjectAssetRegistry) {
  const findings: Array<{ assetId: string; variationId: string; type: "machine-path" | "credential"; source: string }> = [];
  for (const asset of registry.assets) {
    for (const variation of asset.variations) {
      const source = variation.source || variation.portablePath;
      const type = projectAssetSourceRisk(source);
      if (type) findings.push({ assetId: asset.id, variationId: variation.id, type, source });
    }
  }
  return findings;
}

export function portableAssetManifestEntries(project: PlotPickleProject) {
  return project.assets.assets.flatMap((asset) => asset.variations.flatMap((variation) => {
    if (!variation.portablePath) return [];
    const hash = variation.contentHash.replace(/^sha256:/i, "");
    return [{
      id: `${asset.id}:${variation.id}`,
      path: variation.portablePath,
      mediaType: variation.mediaType,
      sha256: /^[a-f0-9]{64}$/i.test(hash) ? hash.toLowerCase() : "",
      bytes: variation.bytes,
      source: variation.source,
    }];
  }));
}
