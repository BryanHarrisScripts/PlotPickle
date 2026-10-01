import type { CharacterTruthClaim } from "../../../core/contracts/character-truth-evidence";
import {
  WORLD_MAP_CHARACTER_MAX_VERSIONS,
  WORLD_MAP_CHARACTER_VIEWS,
  approvedWorldMapCharacterReferences,
  worldMapCharacterVisualPackage,
  worldMapCharacterVisualVersions,
  type WorldMapCharacterView,
  type WorldMapCharacterVisualReference,
  type WorldMapCharacterVisualVersion,
} from "../../../core/contracts/world-map";
import type { LibraryPPFProject } from "../../../core/storage/library-project";

export type MindMapCharacterRosterItem = Readonly<{
  id: string;
  name: string;
  claims: readonly CharacterTruthClaim[];
  visualVersions: readonly WorldMapCharacterVisualVersion[];
  references: readonly WorldMapCharacterVisualReference[];
  lockedVersionId: string | null;
  previewUrl: string | null;
}>;

function displayCharacterName(characterId: string) {
  const raw = characterId.replace(/^character:/u, "").replace(/[-_]+/gu, " ").trim();
  return raw
    ? raw.replace(/\b\w/gu, (letter) => letter.toUpperCase())
    : "Unknown Character";
}

function eligibleClaim(claim: CharacterTruthClaim) {
  return claim.reviewState !== "rejected"
    && claim.handling === "writer-reference"
    && claim.kind !== "sensitive-source";
}

export function mindMapCharacterRoster(project: LibraryPPFProject): readonly MindMapCharacterRosterItem[] {
  const evidence = project.sourceEvidence.characterTruth;
  if (!evidence) return [];

  const claimIds = evidence.claims
    .filter(eligibleClaim)
    .flatMap((claim) => claim.characterIds);
  const characterIds = [...new Set([
    ...evidence.principalCharacterIds,
    ...(evidence.principalCharacterIds.length ? [] : claimIds),
  ])];

  return characterIds.map((characterId) => {
    const claims = evidence.claims.filter((claim) => eligibleClaim(claim) && claim.characterIds.includes(characterId));
    const identity = claims.find((claim) => claim.kind === "identity");
    const visualPackage = worldMapCharacterVisualPackage(project.worldMap, characterId);
    const visualVersions = worldMapCharacterVisualVersions(project.worldMap, characterId);
    const references = visualVersions.flatMap((version) => version.references);
    const approved = approvedWorldMapCharacterReferences(project.worldMap, characterId);
    const previewUrl = approved[0] ?? visualVersions[0]?.references[0]?.assetUrl ?? null;

    return {
      id: characterId,
      name: identity?.summary || visualPackage?.characterName || displayCharacterName(characterId),
      claims,
      visualVersions,
      references,
      lockedVersionId: visualPackage?.lockedVersionId ?? null,
      previewUrl,
    };
  });
}


export type MindMapCharacterVisualGenerationPlan = Readonly<{
  versionId: string | null;
  existingReferences: readonly WorldMapCharacterVisualReference[];
  approvedReferenceImages: readonly string[];
  blockedReason: string | null;
}>;

export function mindMapCharacterVisualGenerationPlan(
  project: LibraryPPFProject,
  characterId: string,
  occurredAt: string,
): MindMapCharacterVisualGenerationPlan {
  const versions = worldMapCharacterVisualVersions(project.worldMap, characterId);
  const editable = versions.find((version) => !version.locked && !version.complete) ?? null;
  const approvedReferenceImages = approvedWorldMapCharacterReferences(project.worldMap, characterId);
  if (editable) {
    return {
      versionId: editable.id,
      existingReferences: editable.references,
      approvedReferenceImages,
      blockedReason: null,
    };
  }
  if (versions.length >= WORLD_MAP_CHARACTER_MAX_VERSIONS) {
    return {
      versionId: null,
      existingReferences: [],
      approvedReferenceImages,
      blockedReason: `The five-version limit is reached for this character. Lock or manage an existing version before generating another.`,
    };
  }
  const stamp = occurredAt.replace(/[^0-9]/gu, "").slice(0, 17) || "draft";
  return {
    versionId: `mind-map-${characterId}-${stamp}`,
    existingReferences: [],
    approvedReferenceImages,
    blockedReason: null,
  };
}

export function mindMapCharacterVisualPrompt(
  project: LibraryPPFProject,
  characterId: string,
  view: WorldMapCharacterView,
) {
  const character = mindMapCharacterRoster(project).find((item) => item.id === characterId);
  if (!character) return "";
  const viewDefinition = WORLD_MAP_CHARACTER_VIEWS.find((item) => item.id === view);
  if (!viewDefinition) return "";

  const approvedClaims = character.claims.filter((claim) => claim.reviewState === "human-approved");
  const truth = approvedClaims.length
    ? approvedClaims.map((claim) => `${claim.kind}: ${claim.summary}`).join(" ")
    : `identity: ${character.name}`;
  const worldContext = project.world.brief.content.trim().slice(0, 1800);
  return [
    `Character: ${character.name}.`,
    `Approved character truth: ${truth}`,
    worldContext ? `Approved project world context: ${worldContext}` : "",
    `Reference view: ${viewDefinition.label}. ${viewDefinition.directive}`,
    "Preserve approved identity references when supplied. Do not treat provider-invented physical details, wardrobe, props, age, ethnicity, or other traits as canon.",
    "Single character only, production-reference framing, neutral readable background, no text, no border, no watermark.",
  ].filter(Boolean).join(" ").slice(0, 30_000);
}
