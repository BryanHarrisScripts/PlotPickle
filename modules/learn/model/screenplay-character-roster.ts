import type { LibraryPPFProject } from "../../../core/storage/library-project";
import { mindMapCharacterRoster } from "./mind-map-character-roster";
import { discoverScreenplayCastCandidates, type ScreenplayCastCandidate } from "./screenplay-character-cues.mjs";

export type { ScreenplayCastCandidate } from "./screenplay-character-cues.mjs";

function key(name: string) {
  return name.trim().replace(/\s+/gu, " ").toLocaleLowerCase("en-US");
}

/**
 * Exact typed passage discovery, reconciled to existing accepted PPF identity.
 * This read-only projection cannot create or alter any Character Truth claim.
 */
export function screenplayCastCandidates(project: LibraryPPFProject): readonly ScreenplayCastCandidate[] {
  const screenplay = project.sourceEvidence.screenplay;
  if (!screenplay) return [];
  const canon = mindMapCharacterRoster(project);
  const canonicalIds = new Map(canon.map(item => [key(item.name), item.id] as const));
  for (const claim of project.sourceEvidence.characterTruth?.claims ?? []) {
    if (claim.kind !== "identity" || claim.reviewState === "rejected"
      || claim.handling !== "writer-reference" || !claim.characterIds[0]) continue;
    canonicalIds.set(key(claim.summary), claim.characterIds[0]);
  }
  return discoverScreenplayCastCandidates(screenplay.passages, canonicalIds);
}
