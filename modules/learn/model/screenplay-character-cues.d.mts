import type { ImportedScreenplayPassage } from "../../../core/contracts/imported-screenplay-evidence";
export type ScreenplayCastCandidate = Readonly<{
  name: string;
  normalizedName: string;
  occurrenceCount: number;
  passageIds: readonly string[];
  sceneNumbers: readonly number[];
  canonicalCharacterId: string | null;
}>;
export function discoverScreenplayCastCandidates(
  passages: readonly ImportedScreenplayPassage[],
  canonicalIds: ReadonlyMap<string, string>,
): readonly ScreenplayCastCandidate[];
