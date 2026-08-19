export const FOUNDATIONS_MARKETING_REFERENCE_RECIPE = "foundations-first-poster-v1" as const;
export const FOUNDATIONS_MARKETING_REFERENCE_FRONTIER = "Foundations" as const;

export interface MarketingReferenceArtifact {
  readonly id: string;
  readonly kind: "poster";
  readonly authority: "marketing-reference";
  readonly assetUrl: string;
  readonly prompt: string;
  readonly createdAt: string;
  readonly provider: string;
  readonly model: string;
  readonly sourceProjectRevision: number;
  readonly curriculumFrontier: typeof FOUNDATIONS_MARKETING_REFERENCE_FRONTIER;
  readonly directorId: "marquee-director";
  readonly recipeId: typeof FOUNDATIONS_MARKETING_REFERENCE_RECIPE;
  readonly sourceDecisionKeys: readonly string[];
  readonly sourceArtifactIds: readonly string[];
  readonly contentHash?: string;
}

export interface MarketingReferenceState {
  readonly currentReferenceId: string | null;
  readonly references: readonly MarketingReferenceArtifact[];
}

export function createEmptyMarketingReferenceState(): MarketingReferenceState {
  return {
    currentReferenceId: null,
    references: [],
  };
}

function cleanStringArray(value: unknown, limit = 120) {
  return Array.isArray(value)
    ? [...new Set(value
      .filter((item): item is string => typeof item === "string" && Boolean(item.trim()))
      .map((item) => item.trim().slice(0, 300)))]
      .slice(0, limit)
    : [];
}

function normalizeMarketingReference(value: unknown): MarketingReferenceArtifact | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Partial<MarketingReferenceArtifact>;
  if (typeof source.id !== "string" || !source.id.trim()) return null;
  if (typeof source.assetUrl !== "string" || !source.assetUrl.startsWith("/api/local-ai/assets/")) return null;
  if (typeof source.prompt !== "string" || !source.prompt.trim()) return null;
  if (source.kind !== "poster" || source.authority !== "marketing-reference") return null;
  if (source.curriculumFrontier !== FOUNDATIONS_MARKETING_REFERENCE_FRONTIER) return null;
  if (source.directorId !== "marquee-director") return null;
  if (source.recipeId !== FOUNDATIONS_MARKETING_REFERENCE_RECIPE) return null;
  const revision = typeof source.sourceProjectRevision === "number"
    && Number.isInteger(source.sourceProjectRevision)
    && source.sourceProjectRevision >= 0
    ? source.sourceProjectRevision
    : 0;
  return {
    id: source.id.trim(),
    kind: "poster",
    authority: "marketing-reference",
    assetUrl: source.assetUrl,
    prompt: source.prompt.slice(0, 30_000),
    createdAt: typeof source.createdAt === "string" && source.createdAt ? source.createdAt : new Date().toISOString(),
    provider: typeof source.provider === "string" ? source.provider.slice(0, 160) : "",
    model: typeof source.model === "string" ? source.model.slice(0, 240) : "",
    sourceProjectRevision: revision,
    curriculumFrontier: FOUNDATIONS_MARKETING_REFERENCE_FRONTIER,
    directorId: "marquee-director",
    recipeId: FOUNDATIONS_MARKETING_REFERENCE_RECIPE,
    sourceDecisionKeys: cleanStringArray(source.sourceDecisionKeys),
    sourceArtifactIds: cleanStringArray(source.sourceArtifactIds),
    ...(typeof source.contentHash === "string" && source.contentHash.trim()
      ? { contentHash: source.contentHash.trim().slice(0, 256) }
      : {}),
  };
}

export function normalizeMarketingReferenceState(value: unknown): MarketingReferenceState {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createEmptyMarketingReferenceState();
  const source = value as Partial<MarketingReferenceState>;
  const references = Array.isArray(source.references)
    ? source.references
      .map(normalizeMarketingReference)
      .filter((item): item is MarketingReferenceArtifact => Boolean(item))
      .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
      .slice(0, 50)
    : [];
  const knownIds = new Set(references.map((item) => item.id));
  const currentReferenceId = typeof source.currentReferenceId === "string"
    && knownIds.has(source.currentReferenceId)
    ? source.currentReferenceId
    : references[0]?.id ?? null;
  return {
    currentReferenceId,
    references,
  };
}

export function currentMarketingReference(state: MarketingReferenceState) {
  if (!state.currentReferenceId) return null;
  return state.references.find((item) => item.id === state.currentReferenceId) ?? null;
}
