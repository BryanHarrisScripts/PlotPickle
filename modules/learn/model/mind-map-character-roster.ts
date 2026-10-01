import type { CharacterTruthClaim } from "../../../core/contracts/character-truth-evidence";
import {
  approvedWorldMapCharacterReferences,
  worldMapCharacterVisualPackage,
  worldMapCharacterVisualVersions,
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
