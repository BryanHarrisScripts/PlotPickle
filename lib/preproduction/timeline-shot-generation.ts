export type TimelineVideoGenerationMode =
  | "text-to-video"
  | "image-to-video"
  | "first-last-frame"
  | "reference-to-video";

export type TimelineVideoWorkflowFamily =
  | TimelineVideoGenerationMode
  | "in-place-edit"
  | "";

export type TimelineShotGenerationReference = Readonly<{
  role: "source-image" | "last-frame" | "character" | "environment" | "production";
  id: string;
  assetUrl?: string;
}>;

export type TimelineShotGenerationPacketInput = Readonly<{
  projectId: string;
  canonicalRevision: number;
  placementId: string;
  anchorRef: string;
  blockNumber: number;
  miniBlockNumber: number;
  shotNumber: number;
  dramaticResponsibility: string;
  screenplay: string;
  progressionLabel: string;
  progressionDirection: string;
  previousShotContext?: string;
  nextShotContext?: string;
  narrativeIntention?: string;
  visualDirection?: string;
  characterFacts?: readonly string[];
  productionDirection?: readonly string[];
  continuityLocks?: readonly string[];
  references?: readonly TimelineShotGenerationReference[];
  sourceRefs?: readonly string[];
}>;

export type TimelineShotGenerationPacket = Readonly<{
  version: 1;
  providerNeutral: true;
  canonical: false;
  id: string;
  projectId: string;
  canonicalRevision: number;
  placementId: string;
  anchorRef: string;
  blockNumber: number;
  miniBlockNumber: number;
  shotNumber: number;
  intendedDurationSeconds: 3;
  dramaticResponsibility: string;
  screenplay: string;
  progression: Readonly<{
    label: string;
    direction: string;
    previous: string;
    next: string;
  }>;
  narrativeIntention: string;
  visualDirection: string;
  characterFacts: readonly string[];
  productionDirection: readonly string[];
  continuityLocks: readonly string[];
  references: readonly TimelineShotGenerationReference[];
  sourceRefs: readonly string[];
  sourceFingerprint: string;
}>;

export type TimelineVideoCapability = Readonly<{
  route: "comfyui-native" | "minimax" | "openai";
  locality: "local" | "cloud";
  ready: boolean;
  workflowFamily?: TimelineVideoWorkflowFamily;
  vramProfile?: string;
  performanceAcknowledged?: boolean;
}>;

export type TimelineGenerationStrategy = Readonly<{
  eligible: boolean;
  modality: TimelineVideoGenerationMode | null;
  reason: string;
  performanceAcknowledged: boolean;
  sourceAssetUrl: string;
  lastFrameAssetUrl: string;
  referenceAssetUrl: string;
}>;

function clean(value: string | undefined) {
  return typeof value === "string" ? value.replace(/\s+/gu, " ").trim() : "";
}

function stableStrings(values: readonly string[] | undefined) {
  return [...new Set((values ?? []).map(clean).filter(Boolean))].sort();
}

function stableReferences(values: readonly TimelineShotGenerationReference[] | undefined) {
  return [...(values ?? [])]
    .map((item) => ({
      role: item.role,
      id: clean(item.id),
      ...(clean(item.assetUrl) ? { assetUrl: clean(item.assetUrl) } : {}),
    }))
    .filter((item) => Boolean(item.id))
    .sort((left, right) => left.role.localeCompare(right.role) || left.id.localeCompare(right.id));
}

function packetId(input: TimelineShotGenerationPacketInput) {
  return `timeline-generation:${input.placementId}:shot-${String(input.shotNumber).padStart(2, "0")}`;
}

export function buildTimelineShotGenerationPacket(
  input: TimelineShotGenerationPacketInput,
): TimelineShotGenerationPacket {
  if (!input.projectId.trim() || !input.placementId.trim() || !input.anchorRef.trim()) {
    throw new Error("Timeline Shot Generation Packet requires project, placement and anchor identity.");
  }
  if (!Number.isInteger(input.shotNumber) || input.shotNumber < 1 || input.shotNumber > 25) {
    throw new Error("Timeline Shot Generation Packet requires Shot 1 through 25.");
  }

  const base = {
    version: 1 as const,
    providerNeutral: true as const,
    canonical: false as const,
    id: packetId(input),
    projectId: input.projectId,
    canonicalRevision: Math.max(0, Math.trunc(input.canonicalRevision)),
    placementId: input.placementId,
    anchorRef: input.anchorRef,
    blockNumber: input.blockNumber,
    miniBlockNumber: input.miniBlockNumber,
    shotNumber: input.shotNumber,
    intendedDurationSeconds: 3 as const,
    dramaticResponsibility: clean(input.dramaticResponsibility),
    screenplay: clean(input.screenplay),
    progression: {
      label: clean(input.progressionLabel),
      direction: clean(input.progressionDirection),
      previous: clean(input.previousShotContext),
      next: clean(input.nextShotContext),
    },
    narrativeIntention: clean(input.narrativeIntention),
    visualDirection: clean(input.visualDirection),
    characterFacts: stableStrings(input.characterFacts),
    productionDirection: stableStrings(input.productionDirection),
    continuityLocks: stableStrings(input.continuityLocks),
    references: stableReferences(input.references),
    sourceRefs: stableStrings(input.sourceRefs),
  };

  return {
    ...base,
    sourceFingerprint: JSON.stringify(base),
  };
}

function reference(packet: TimelineShotGenerationPacket, role: TimelineShotGenerationReference["role"]) {
  return packet.references.find((item) => item.role === role && item.assetUrl);
}

export function resolveTimelineGenerationStrategy(
  capability: TimelineVideoCapability,
  packet: TimelineShotGenerationPacket,
): TimelineGenerationStrategy {
  const sourceImage = reference(packet, "source-image");
  const lastFrame = reference(packet, "last-frame");
  const explicitReference = packet.references.find((item) => (
    (item.role === "character" || item.role === "environment" || item.role === "production")
    && item.assetUrl
  ));
  const unavailable = (reason: string): TimelineGenerationStrategy => ({
    eligible: false,
    modality: null,
    reason,
    performanceAcknowledged: capability.performanceAcknowledged === true,
    sourceAssetUrl: sourceImage?.assetUrl ?? "",
    lastFrameAssetUrl: lastFrame?.assetUrl ?? "",
    referenceAssetUrl: explicitReference?.assetUrl ?? sourceImage?.assetUrl ?? "",
  });

  if (!capability.ready) return unavailable("The selected video route is not ready.");

  if (capability.route === "comfyui-native") {
    const family = capability.workflowFamily ?? "";
    if (family === "text-to-video") {
      return {
        ...unavailable(""),
        eligible: true,
        modality: "text-to-video",
        reason: "",
      };
    }
    if (family === "image-to-video") {
      if (!sourceImage) return unavailable("The active local H3 image-to-video workflow requires an approved source image for this Shot.");
      return {
        ...unavailable(""),
        eligible: true,
        modality: "image-to-video",
        reason: "",
      };
    }
    if (family === "first-last-frame") {
      if (!sourceImage || !lastFrame) return unavailable("The active local H3 first/last-frame workflow requires approved first and last frame images.");
      return {
        ...unavailable(""),
        eligible: true,
        modality: "first-last-frame",
        reason: "",
      };
    }
    if (family === "reference-to-video") {
      if (!explicitReference && !sourceImage) return unavailable("The active local H3 reference-to-video workflow requires an approved visual reference.");
      return {
        ...unavailable(""),
        eligible: true,
        modality: "reference-to-video",
        reason: "",
      };
    }
    if (family === "in-place-edit") {
      return unavailable("The active local H3 workflow edits an existing video and is not compatible with Timeline Shot generation.");
    }
    return unavailable("The active local H3 workflow family is unknown. Re-check H3 setup before generating.");
  }

  return {
    ...unavailable(""),
    eligible: true,
    modality: sourceImage ? "image-to-video" : "text-to-video",
    reason: "",
  };
}

export function serializeTimelineShotGenerationPacket(
  packet: TimelineShotGenerationPacket,
  strategy: TimelineGenerationStrategy,
) {
  const referenceSummary = packet.references.length
    ? packet.references.map((item) => `${item.role}:${item.id}`).join("; ")
    : "No approved visual reference is required by this strategy.";
  const lines = [
    `Create one coherent cinematic Shot for a 75-second Mini-Block. This is Shot ${String(packet.shotNumber).padStart(2, "0")} of 25 and its Timeline slot is approximately three seconds.`,
    `Generation strategy: ${strategy.modality ?? "unresolved"}.`,
    packet.dramaticResponsibility ? `Mini-Block dramatic responsibility: ${packet.dramaticResponsibility}` : "",
    packet.screenplay ? `Mapped screenplay evidence: ${packet.screenplay}` : "",
    packet.progression.label || packet.progression.direction
      ? `Shot progression: ${packet.progression.label}. ${packet.progression.direction}`
      : "",
    packet.progression.previous ? `Previous Shot handoff: ${packet.progression.previous}` : "",
    packet.progression.next ? `Next Shot handoff: ${packet.progression.next}` : "",
    packet.narrativeIntention ? `Approved visual narrative intention: ${packet.narrativeIntention}` : "",
    packet.visualDirection ? `Approved visual direction: ${packet.visualDirection}` : "",
    packet.characterFacts.length ? `Character truth: ${packet.characterFacts.join("; ")}` : "",
    packet.productionDirection.length ? `Production direction: ${packet.productionDirection.join("; ")}` : "",
    packet.continuityLocks.length ? `Continuity locks: ${packet.continuityLocks.join("; ")}` : "",
    `Approved reference bindings: ${referenceSummary}`,
    "Preserve known character identity, wardrobe, props, geography, screen direction and visual continuity. Do not invent unsupported canon.",
    "Add only story-grounded subject, environmental and camera motion. Do not add text, logos, new characters, dialogue audio, music or sound effects.",
    "Provider-native output may be longer than three seconds. Keep the useful story action inside the opening three seconds; Timeline owns final placement timing.",
  ].filter(Boolean);

  return lines.join("\n").slice(0, 7_000);
}
