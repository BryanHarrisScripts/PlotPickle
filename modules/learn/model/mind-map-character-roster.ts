import type {
  CharacterTruthClaim,
  CharacterTruthEvidence,
} from "../../../core/contracts/character-truth-evidence";
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

function characterSlug(value: string) {
  return value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/gu, "-")
    .replace(/^-+|-+$/gu, "")
    .slice(0, 80) || "character";
}

function nextCharacterId(evidence: CharacterTruthEvidence | null | undefined, name: string) {
  const used = new Set([
    ...(evidence?.principalCharacterIds ?? []),
    ...(evidence?.claims.flatMap((claim) => claim.characterIds) ?? []),
  ]);
  const base = characterSlug(name);
  if (!used.has(base)) return base;
  for (let index = 2; index <= 999; index += 1) {
    const candidate = `${base}-${index}`;
    if (!used.has(candidate)) return candidate;
  }
  throw new Error("This project has too many characters with the same name.");
}

export function createMindMapCharacter(
  project: LibraryPPFProject,
  rawName: string,
  occurredAt = new Date().toISOString(),
) {
  const name = rawName.replace(/\s+/gu, " ").trim().slice(0, 160);
  if (!name) throw new Error("Enter a character name first.");

  const existing = project.sourceEvidence.characterTruth ?? null;
  const characterId = nextCharacterId(existing, name);
  const identityClaim: CharacterTruthClaim = {
    id: `mind-map-character:${characterId}:identity`,
    characterIds: [characterId],
    kind: "identity",
    summary: name,
    sourceId: `project:${project.id}:mind-map`,
    sourceRef: `mind-map:character:${characterId}`,
    sourceVersion: `revision:${project.revision + 1}`,
    reviewState: "human-approved",
    targetArcField: null,
    handling: "writer-reference",
    canonEffect: "none",
    note: "Created by the Human in Mind Map.",
  };
  const characterTruth: CharacterTruthEvidence = existing
    ? {
        ...existing,
        claims: [...existing.claims, identityClaim],
        principalCharacterIds: [...existing.principalCharacterIds, characterId],
      }
    : {
        schemaVersion: 1,
        fixtureId: `project:${project.id}:character-truth`,
        sources: [],
        claims: [identityClaim],
        principalCharacterIds: [characterId],
        arcCells: [],
        checkpoints: [],
        governingRule: "Characters created by the Human in Mind Map remain project-owned Character Truth. Generated visual candidates never change Character Truth automatically.",
      };

  return {
    characterId,
    project: {
      ...project,
      revision: project.revision + 1,
      updatedAt: occurredAt,
      sourceEvidence: {
        ...project.sourceEvidence,
        characterTruth,
      },
    } satisfies LibraryPPFProject,
  };
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
