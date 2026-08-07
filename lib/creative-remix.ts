import type { CreativeExplorationCandidate } from "./creative-candidates";
import type { ProviderNeutralCreativeRequest } from "./creative-direction";

export type RemixQuality = {
  sourceCandidateId: string;
  quality: string;
  note: string;
};

export type CreativeRemixRecipe = {
  version: 1;
  target: CreativeExplorationCandidate["target"];
  mediaType: CreativeExplorationCandidate["mediaType"];
  selections: RemixQuality[];
  overallDirection: string;
};

export type ProviderNeutralRemixRequest = ProviderNeutralCreativeRequest & {
  remix: {
    sourceCandidateIds: string[];
    selections: RemixQuality[];
    flattenedDirection: string;
  };
};

function clean(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeRemixRecipe(
  value: unknown,
  fallback: CreativeExplorationCandidate,
): CreativeRemixRecipe {
  const candidate = value && typeof value === "object" && !Array.isArray(value) ? value as Partial<CreativeRemixRecipe> : {};
  const selections = Array.isArray(candidate.selections) ? candidate.selections.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const selection = item as Partial<RemixQuality>;
    const sourceCandidateId = clean(selection.sourceCandidateId);
    const quality = clean(selection.quality);
    if (!sourceCandidateId || !quality) return [];
    return [{
      sourceCandidateId,
      quality,
      note: clean(selection.note),
    }];
  }) : [];
  return {
    version: 1,
    target: candidate.target ?? fallback.target,
    mediaType: candidate.mediaType ?? fallback.mediaType,
    selections,
    overallDirection: clean(candidate.overallDirection),
  };
}

export function buildFlattenedRemixDirection(recipe: CreativeRemixRecipe) {
  const parts = recipe.selections.map((selection) => {
    const detail = selection.note ? `: ${selection.note}` : "";
    return `${selection.quality} from candidate ${selection.sourceCandidateId}${detail}`;
  });
  if (recipe.overallDirection) parts.push(`Overall direction: ${recipe.overallDirection}`);
  return parts.join(" · ");
}

export function buildProviderNeutralRemixRequest(
  recipe: CreativeRemixRecipe,
  candidates: CreativeExplorationCandidate[],
): ProviderNeutralRemixRequest {
  const sourceCandidateIds = [...new Set(recipe.selections.map((selection) => selection.sourceCandidateId))];
  const anchor = candidates.find((candidate) => sourceCandidateIds.includes(candidate.id)) ?? candidates[0];
  if (!anchor) throw new Error("At least one source candidate is required to remix.");
  const flattenedDirection = buildFlattenedRemixDirection(recipe);
  return {
    version: 1,
    sourceCandidateId: anchor.id,
    mediaType: recipe.mediaType,
    target: { ...recipe.target },
    direction: {
      keep: recipe.selections.map((selection) => `${selection.quality}${selection.note ? `: ${selection.note}` : ""}`),
      change: [],
      try: recipe.overallDirection ? [recipe.overallDirection] : [],
      dimensions: {
        subject: "",
        composition: "",
        mood: "",
        action: "",
        colour: "",
        camera: "",
        continuity: "",
      },
    },
    advanced: {
      prompt: "",
      visibleByDefault: false,
    },
    remix: {
      sourceCandidateIds,
      selections: recipe.selections.map((selection) => ({ ...selection })),
      flattenedDirection,
    },
  };
}

export function createRemixCandidateLineage(request: ProviderNeutralRemixRequest) {
  return {
    parentCandidateId: request.sourceCandidateId,
    retryOfCandidateId: "",
    derivedFromCandidateIds: [...request.remix.sourceCandidateIds],
  };
}
