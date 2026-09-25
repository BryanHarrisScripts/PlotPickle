export const WORLD_MAP_VERSION = 1 as const;

export const WORLD_MAP_CHARACTER_VIEWS = [
  { id: "front-full-body", label: "Front full-body", directive: "Front-facing full-body neutral production-reference pose." },
  { id: "back-full-body", label: "Back full-body", directive: "Back-facing full-body neutral production-reference pose." },
  { id: "left-profile", label: "Left profile", directive: "Left-side profile with the full silhouette readable." },
  { id: "right-profile", label: "Right profile", directive: "Right-side profile with the full silhouette readable." },
  { id: "left-three-quarter", label: "Left 45°", directive: "Three-quarter view turned about 45 degrees to the character's left." },
  { id: "right-three-quarter", label: "Right 45°", directive: "Three-quarter view turned about 45 degrees to the character's right." },
  { id: "neutral-stance", label: "Neutral stance", directive: "Full-body neutral stance with natural posture and hands visible." },
  { id: "secondary-stance", label: "Secondary stance", directive: "Full-body alternate performance-neutral stance showing body language without changing identity." },
] as const;

export type WorldMapCharacterView = (typeof WORLD_MAP_CHARACTER_VIEWS)[number]["id"];
export type WorldMapVisualReviewState = "draft" | "approved";

export type WorldMapCharacterVisualReference = Readonly<{
  id: string;
  characterId: string;
  characterName: string;
  view: WorldMapCharacterView;
  assetUrl: string;
  prompt: string;
  provider: string;
  model: string;
  createdAt: string;
  reviewState: WorldMapVisualReviewState;
}>;

export type WorldMapCharacterVisualPackage = Readonly<{
  characterId: string;
  characterName: string;
  references: readonly WorldMapCharacterVisualReference[];
  approvedAt: string | null;
  updatedAt: string;
}>;

export type WorldMapState = Readonly<{
  version: typeof WORLD_MAP_VERSION;
  characterVisuals: readonly WorldMapCharacterVisualPackage[];
}>;

const VIEW_IDS = new Set<WorldMapCharacterView>(WORLD_MAP_CHARACTER_VIEWS.map((item) => item.id));

function clean(value: unknown, maximum: number) {
  return typeof value === "string" ? value.replace(/\u0000/gu, "").trim().slice(0, maximum) : "";
}

function record(value: unknown): Readonly<Record<string, unknown>> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Readonly<Record<string, unknown>> : {};
}

function normalizeReference(value: unknown): WorldMapCharacterVisualReference | null {
  const source = record(value);
  const id = clean(source.id, 180);
  const characterId = clean(source.characterId, 160);
  const characterName = clean(source.characterName, 300);
  const assetUrl = clean(source.assetUrl, 2_000);
  const prompt = clean(source.prompt, 30_000);
  const provider = clean(source.provider, 120);
  const model = clean(source.model, 180);
  const createdAt = clean(source.createdAt, 80);
  const view = clean(source.view, 80) as WorldMapCharacterView;
  if (!id || !characterId || !characterName || !assetUrl || !prompt || !VIEW_IDS.has(view)) return null;
  if (!assetUrl.startsWith("/api/local-ai/assets/") && !assetUrl.startsWith("/assets/library/examples/")) return null;
  return {
    id,
    characterId,
    characterName,
    view,
    assetUrl,
    prompt,
    provider,
    model,
    createdAt: createdAt || new Date().toISOString(),
    reviewState: source.reviewState === "approved" ? "approved" : "draft",
  };
}

function normalizePackage(value: unknown): WorldMapCharacterVisualPackage | null {
  const source = record(value);
  const characterId = clean(source.characterId, 160);
  const characterName = clean(source.characterName, 300);
  if (!characterId || !characterName) return null;
  const references = Array.isArray(source.references)
    ? source.references
      .map(normalizeReference)
      .filter((item): item is WorldMapCharacterVisualReference => Boolean(item))
      .filter((item) => item.characterId === characterId)
      .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
      .slice(-WORLD_MAP_CHARACTER_VIEWS.length * 2)
    : [];
  return {
    characterId,
    characterName,
    references,
    approvedAt: clean(source.approvedAt, 80) || null,
    updatedAt: clean(source.updatedAt, 80) || new Date().toISOString(),
  };
}

export function createEmptyWorldMapState(): WorldMapState {
  return { version: WORLD_MAP_VERSION, characterVisuals: [] };
}

export function normalizeWorldMapState(value: unknown): WorldMapState {
  const source = record(value);
  const characterVisuals = Array.isArray(source.characterVisuals)
    ? source.characterVisuals
      .map(normalizePackage)
      .filter((item): item is WorldMapCharacterVisualPackage => Boolean(item))
      .filter((item, index, all) => all.findLastIndex((candidate) => candidate.characterId === item.characterId) === index)
      .slice(0, 48)
    : [];
  return { version: WORLD_MAP_VERSION, characterVisuals };
}

export function worldMapCharacterVisualPackage(state: WorldMapState, characterId: string) {
  return state.characterVisuals.find((item) => item.characterId === characterId) ?? null;
}

export function approvedWorldMapCharacterReferences(state: WorldMapState, characterId: string) {
  const approved = worldMapCharacterVisualPackage(state, characterId)?.references
    .filter((reference) => reference.reviewState === "approved") ?? [];
  return WORLD_MAP_CHARACTER_VIEWS
    .map((view) => [...approved].reverse().find((reference) => reference.view === view.id)?.assetUrl ?? "")
    .filter(Boolean);
}

export function upsertWorldMapCharacterVisualPackage(
  state: WorldMapState,
  value: WorldMapCharacterVisualPackage,
): WorldMapState {
  return normalizeWorldMapState({
    version: WORLD_MAP_VERSION,
    characterVisuals: [
      ...state.characterVisuals.filter((item) => item.characterId !== value.characterId),
      value,
    ],
  });
}

export function approveWorldMapCharacterVisualPackage(
  state: WorldMapState,
  characterId: string,
  approvedAt: string,
): WorldMapState {
  const current = worldMapCharacterVisualPackage(state, characterId);
  if (!current || !current.references.length) return state;
  const references = WORLD_MAP_CHARACTER_VIEWS.flatMap((view) => {
    const candidates = current.references.filter((reference) => reference.view === view.id);
    const selected = [...candidates].reverse().find((reference) => reference.reviewState === "draft")
      ?? [...candidates].reverse().find((reference) => reference.reviewState === "approved");
    return selected ? [{ ...selected, reviewState: "approved" as const }] : [];
  });
  return upsertWorldMapCharacterVisualPackage(state, {
    ...current,
    references,
    approvedAt,
    updatedAt: approvedAt,
  });
}
