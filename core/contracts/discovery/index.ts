export const DISCOVERY_VERSION = 1 as const;

export const DISCOVERY_LANES = [
  { id: "story-plot", label: "Story / Plot" },
  { id: "character", label: "Character" },
  { id: "scene-dialogue", label: "Scene / Dialogue" },
  { id: "world-research", label: "World / Research" },
  { id: "theme-motif", label: "Theme / Motif" },
  { id: "visual-mood", label: "Visual / Mood" },
] as const;

export type DiscoveryLaneId = (typeof DISCOVERY_LANES)[number]["id"];
export type DiscoveryAct = 1 | 2 | 3 | 4;
export type DiscoveryCardKind = "text" | "visual";
export type DiscoverySourceState = "project" | "new-local";

export type DiscoveryPlacement = {
  readonly act: DiscoveryAct;
  readonly lane: DiscoveryLaneId;
  readonly reason: string;
  readonly evidenceRefs: readonly string[];
  readonly classifierId: string;
  readonly classifierVersion: string;
  readonly pinnedAt: string;
};

export type DiscoveryCard = {
  readonly id: string;
  readonly kind: DiscoveryCardKind;
  readonly content: string;
  readonly assetRef: string;
  readonly sourceState: DiscoverySourceState;
  readonly sourceRef: string | null;
  readonly createdAt: string;
  readonly placement: DiscoveryPlacement | null;
};

export type DiscoveryState = {
  readonly version: typeof DISCOVERY_VERSION;
  readonly cards: readonly DiscoveryCard[];
};

const LANE_IDS = new Set<DiscoveryLaneId>(DISCOVERY_LANES.map((lane) => lane.id));

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Readonly<Record<string, unknown>>
    : {};
}

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function cleanEvidenceRefs(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      .map((item) => item.trim().slice(0, 240)))].slice(0, 12)
    : [];
}

export function isDiscoveryLane(value: unknown): value is DiscoveryLaneId {
  return typeof value === "string" && LANE_IDS.has(value as DiscoveryLaneId);
}

export function isDiscoveryAct(value: unknown): value is DiscoveryAct {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

export function createEmptyDiscoveryState(): DiscoveryState {
  return { version: DISCOVERY_VERSION, cards: [] };
}

export function normalizeDiscoveryPlacement(value: unknown): DiscoveryPlacement | null {
  const source = record(value);
  if (!isDiscoveryAct(source.act) || !isDiscoveryLane(source.lane)) return null;
  const reason = cleanText(source.reason, 800);
  if (!reason) return null;
  return {
    act: source.act,
    lane: source.lane,
    reason,
    evidenceRefs: cleanEvidenceRefs(source.evidenceRefs),
    classifierId: cleanText(source.classifierId, 120) || "discovery-mapper",
    classifierVersion: cleanText(source.classifierVersion, 80) || "1",
    pinnedAt: cleanText(source.pinnedAt, 80) || new Date().toISOString(),
  };
}

export function normalizeDiscoveryState(value: unknown): DiscoveryState {
  const source = record(value);
  const cards = Array.isArray(source.cards) ? source.cards : [];
  const normalized: DiscoveryCard[] = [];
  for (const raw of cards.slice(0, 500)) {
    const card = record(raw);
    const id = cleanText(card.id, 160);
    const content = cleanText(card.content, 12_000);
    if (!id || !content) continue;
    const kind: DiscoveryCardKind = card.kind === "visual" ? "visual" : "text";
    const sourceState: DiscoverySourceState = card.sourceState === "project" ? "project" : "new-local";
    normalized.push({
      id,
      kind,
      content,
      assetRef: cleanText(card.assetRef, 2_000),
      sourceState,
      sourceRef: cleanText(card.sourceRef, 240) || null,
      createdAt: cleanText(card.createdAt, 80) || new Date().toISOString(),
      placement: normalizeDiscoveryPlacement(card.placement),
    });
  }
  return { version: DISCOVERY_VERSION, cards: normalized };
}

export function discoveryActForBlock(blockNumber: number): DiscoveryAct {
  if (!Number.isInteger(blockNumber) || blockNumber < 1 || blockNumber > 24) {
    throw new Error("Discovery can derive an Act only from PlotPickle Block 01-24.");
  }
  if (blockNumber <= 6) return 1;
  if (blockNumber <= 12) return 2;
  if (blockNumber <= 18) return 3;
  return 4;
}

export function normalizeDiscoveryMapperResult(value: unknown) {
  const source = record(value);
  if (!isDiscoveryAct(source.act) || !isDiscoveryLane(source.lane)) return null;
  const reason = cleanText(source.reason, 800);
  if (!reason) return null;
  return {
    act: source.act,
    lane: source.lane,
    reason,
    evidenceRefs: cleanEvidenceRefs(source.evidenceRefs),
  } as const;
}
