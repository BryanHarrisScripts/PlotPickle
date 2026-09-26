export const WORLD_MAP_VERSION = 1 as const;
export const WORLD_MAP_CHARACTER_MAX_VERSIONS = 5 as const;

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
  versionId: string;
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
  lockedVersionId: string | null;
  approvedAt: string | null;
  updatedAt: string;
}>;

export type WorldMapCharacterVisualVersion = Readonly<{
  id: string;
  references: readonly WorldMapCharacterVisualReference[];
  createdAt: string;
  locked: boolean;
  complete: boolean;
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

function normalizedVersionId(source: Readonly<Record<string, unknown>>, characterId: string) {
  const explicit = clean(source.versionId, 180);
  if (explicit) return explicit;
  return source.reviewState === "approved"
    ? `legacy-locked-${characterId}`
    : `legacy-saved-${characterId}`;
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
    versionId: normalizedVersionId(source, characterId),
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

function versionOrder(references: readonly WorldMapCharacterVisualReference[]) {
  const timestamps = new Map<string, string>();
  for (const reference of references) {
    const previous = timestamps.get(reference.versionId) ?? "";
    if (reference.createdAt > previous) timestamps.set(reference.versionId, reference.createdAt);
  }
  return [...timestamps.entries()]
    .sort((left, right) => right[1].localeCompare(left[1]))
    .map(([versionId]) => versionId);
}

function normalizePackage(value: unknown): WorldMapCharacterVisualPackage | null {
  const source = record(value);
  const characterId = clean(source.characterId, 160);
  const characterName = clean(source.characterName, 300);
  if (!characterId || !characterName) return null;
  const normalizedReferences = Array.isArray(source.references)
    ? source.references
      .map(normalizeReference)
      .filter((item): item is WorldMapCharacterVisualReference => Boolean(item))
      .filter((item) => item.characterId === characterId)
      .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
    : [];
  const retainedVersionIds = versionOrder(normalizedReferences).slice(0, WORLD_MAP_CHARACTER_MAX_VERSIONS);
  const references = normalizedReferences.filter((reference) => retainedVersionIds.includes(reference.versionId));
  const explicitLockedVersionId = clean(source.lockedVersionId, 180);
  const approvedLegacyVersionId = references.find((reference) => reference.reviewState === "approved")?.versionId ?? "";
  const lockedVersionId = retainedVersionIds.includes(explicitLockedVersionId)
    ? explicitLockedVersionId
    : retainedVersionIds.includes(approvedLegacyVersionId)
      ? approvedLegacyVersionId
      : null;
  const normalizedLockReferences = references.map((reference) => ({
    ...reference,
    reviewState: lockedVersionId && reference.versionId === lockedVersionId ? "approved" as const : "draft" as const,
  }));
  return {
    characterId,
    characterName,
    references: normalizedLockReferences,
    lockedVersionId,
    approvedAt: lockedVersionId ? clean(source.approvedAt, 80) || null : null,
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

export function worldMapCharacterVisualVersions(state: WorldMapState, characterId: string): readonly WorldMapCharacterVisualVersion[] {
  const current = worldMapCharacterVisualPackage(state, characterId);
  if (!current) return [];
  return versionOrder(current.references).map((versionId) => {
    const references = current.references
      .filter((reference) => reference.versionId === versionId)
      .slice()
      .sort((left, right) => (
        WORLD_MAP_CHARACTER_VIEWS.findIndex((view) => view.id === left.view)
        - WORLD_MAP_CHARACTER_VIEWS.findIndex((view) => view.id === right.view)
      ));
    return {
      id: versionId,
      references,
      createdAt: references.reduce((latest, reference) => reference.createdAt > latest ? reference.createdAt : latest, ""),
      locked: current.lockedVersionId === versionId,
      complete: WORLD_MAP_CHARACTER_VIEWS.every((view) => references.some((reference) => reference.view === view.id)),
    };
  }).slice(0, WORLD_MAP_CHARACTER_MAX_VERSIONS);
}

export function approvedWorldMapCharacterReferences(state: WorldMapState, characterId: string) {
  const current = worldMapCharacterVisualPackage(state, characterId);
  if (!current?.lockedVersionId) return [];
  const locked = current.references.filter((reference) => (
    reference.versionId === current.lockedVersionId && reference.reviewState === "approved"
  ));
  return WORLD_MAP_CHARACTER_VIEWS
    .map((view) => locked.find((reference) => reference.view === view.id)?.assetUrl ?? "")
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

export function saveWorldMapCharacterVisualVersion(
  state: WorldMapState,
  input: Readonly<{
    characterId: string;
    characterName: string;
    versionId: string;
    references: readonly WorldMapCharacterVisualReference[];
    savedAt: string;
  }>,
): WorldMapState {
  const current = worldMapCharacterVisualPackage(state, input.characterId);
  const existingVersions = current ? worldMapCharacterVisualVersions(state, input.characterId) : [];
  const alreadySaved = existingVersions.some((version) => version.id === input.versionId);
  if (!alreadySaved && existingVersions.length >= WORLD_MAP_CHARACTER_MAX_VERSIONS) return state;
  const references = input.references
    .filter((reference) => reference.characterId === input.characterId)
    .map((reference) => ({ ...reference, versionId: input.versionId, reviewState: "draft" as const }));
  if (!references.length) return state;
  return upsertWorldMapCharacterVisualPackage(state, {
    characterId: input.characterId,
    characterName: input.characterName,
    references: [
      ...(current?.references.filter((reference) => reference.versionId !== input.versionId) ?? []),
      ...references,
    ],
    lockedVersionId: current?.lockedVersionId ?? null,
    approvedAt: current?.approvedAt ?? null,
    updatedAt: input.savedAt,
  });
}

export function lockWorldMapCharacterVisualVersion(
  state: WorldMapState,
  characterId: string,
  versionId: string,
  lockedAt: string,
): WorldMapState {
  const current = worldMapCharacterVisualPackage(state, characterId);
  if (!current) return state;
  const target = worldMapCharacterVisualVersions(state, characterId).find((version) => version.id === versionId);
  if (!target?.complete) return state;
  return upsertWorldMapCharacterVisualPackage(state, {
    ...current,
    references: current.references.map((reference) => ({
      ...reference,
      reviewState: reference.versionId === versionId ? "approved" as const : "draft" as const,
    })),
    lockedVersionId: versionId,
    approvedAt: lockedAt,
    updatedAt: lockedAt,
  });
}

/** Legacy compatibility alias. New WorldMap UI must use explicit Save then Lock. */
export function approveWorldMapCharacterVisualPackage(
  state: WorldMapState,
  characterId: string,
  approvedAt: string,
): WorldMapState {
  const target = worldMapCharacterVisualVersions(state, characterId).find((version) => version.complete);
  return target ? lockWorldMapCharacterVisualVersion(state, characterId, target.id, approvedAt) : state;
}
