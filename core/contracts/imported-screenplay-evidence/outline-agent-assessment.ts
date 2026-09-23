import type { CharacterArcEvidenceState } from "../character-truth-evidence";
import type { StoryStructuralFindingState } from "../story-evidence-matrix";

/** Agent proposals are evidence-linked observations, never canon or Human-reviewed findings. */
export type OutlineAgentAssessment = Readonly<{
  version: 1;
  blockNumber: number;
  inputFingerprint: string;
  assessedAt: string;
  model: string;
  structural: Readonly<{ state: StoryStructuralFindingState; reason: string; passageIds: readonly string[] }>;
  characters: readonly Readonly<{ characterId: string; state: CharacterArcEvidenceState; reason: string; passageIds: readonly string[] }>[];
  miniBlocks: readonly Readonly<{ ordinal: number; state: "supported" | "partial" | "unsupported"; reason: string; passageIds: readonly string[]; storyboardCue: string }>[];
}>;

const CHARACTER_STATES: readonly CharacterArcEvidenceState[] = [
  "not-present-no-evidence", "present-arc-neutral", "pressure-introduced",
  "belief-strategy-reinforced", "belief-strategy-challenged", "meaningful-choice",
  "consequence", "relationship-movement", "arc-transition", "unresolved-insufficient-evidence",
];

export function normalizeOutlineAgentAssessments(value: unknown): readonly OutlineAgentAssessment[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is OutlineAgentAssessment => {
    if (!item || typeof item !== "object") return false;
    const a = item as Partial<OutlineAgentAssessment>;
    return a.version === 1 && Number.isInteger(a.blockNumber) && Number(a.blockNumber) >= 1 && Number(a.blockNumber) <= 24
      && typeof a.inputFingerprint === "string" && /^[a-f\d]{8}$/.test(a.inputFingerprint)
      && typeof a.assessedAt === "string" && typeof a.model === "string"
      && Boolean(a.structural && ["covered", "condensed-shared", "gap-underdeveloped", "unresolved"].includes(a.structural.state)
        && typeof a.structural.reason === "string" && a.structural.reason.length <= 900
        && Array.isArray(a.structural.passageIds) && a.structural.passageIds.every((id) => typeof id === "string"))
      && Array.isArray(a.characters) && a.characters.every((cell) => cell && typeof cell.characterId === "string"
        && CHARACTER_STATES.includes(cell.state) && typeof cell.reason === "string" && cell.reason.length <= 900
        && Array.isArray(cell.passageIds) && cell.passageIds.every((id) => typeof id === "string"))
      && Array.isArray(a.miniBlocks) && a.miniBlocks.length === 4
      && new Set(a.miniBlocks.map((mini) => mini?.ordinal)).size === 4 && a.miniBlocks.every((mini) => mini
        && Number.isInteger(mini.ordinal) && mini.ordinal >= 1 && mini.ordinal <= 4
        && ["supported", "partial", "unsupported"].includes(mini.state)
        && typeof mini.reason === "string" && mini.reason.length <= 900
        && typeof mini.storyboardCue === "string" && mini.storyboardCue.length <= 360
        && Array.isArray(mini.passageIds) && mini.passageIds.every((id) => typeof id === "string"));
  }).slice(-24);
}
