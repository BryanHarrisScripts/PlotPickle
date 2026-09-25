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

export type OutlineAssessmentRunBlockSummary = Readonly<{
  blockNumber: number;
  structuralState: StoryStructuralFindingState;
  citedPassageCount: number;
  characterFindingCount: number;
  miniBlockStates: readonly ("supported" | "partial" | "unsupported")[];
  model: string;
}>;

/** A compact audit receipt for an assessment action. It never contains screenplay text or accepted-canon mutations. */
export type OutlineAssessmentRunReceipt = Readonly<{
  version: 1;
  id: string;
  scope: "block" | "act";
  actNumber: number | null;
  requestedBlockNumbers: readonly number[];
  completedBlockNumbers: readonly number[];
  changedBlockNumbers: readonly number[];
  status: "completed" | "partial" | "failed";
  assessedAt: string;
  acceptedStoryContentChanged: false;
  blockSummaries: readonly OutlineAssessmentRunBlockSummary[];
  error?: string;
}>;

const STRUCTURAL_STATES: readonly StoryStructuralFindingState[] = [
  "covered", "condensed-shared", "gap-underdeveloped", "unresolved",
];

const CHARACTER_STATES: readonly CharacterArcEvidenceState[] = [
  "not-present-no-evidence", "present-arc-neutral", "pressure-introduced",
  "belief-strategy-reinforced", "belief-strategy-challenged", "meaningful-choice",
  "consequence", "relationship-movement", "arc-transition", "unresolved-insufficient-evidence",
];

const MINI_STATES = ["supported", "partial", "unsupported"] as const;

function cleanRunText(value: unknown, limit: number) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, limit)
    : "";
}

function normalizeBlockNumbers(value: unknown, limit = 24) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value
    .map((item) => Number(item))
    .filter((item) => Number.isInteger(item) && item >= 1 && item <= 24))]
    .slice(0, limit);
}

export function normalizeOutlineAgentAssessments(value: unknown): readonly OutlineAgentAssessment[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is OutlineAgentAssessment => {
    if (!item || typeof item !== "object") return false;
    const a = item as Partial<OutlineAgentAssessment>;
    return a.version === 1 && Number.isInteger(a.blockNumber) && Number(a.blockNumber) >= 1 && Number(a.blockNumber) <= 24
      && typeof a.inputFingerprint === "string" && /^[a-f\d]{8}$/.test(a.inputFingerprint)
      && typeof a.assessedAt === "string" && typeof a.model === "string"
      && Boolean(a.structural && STRUCTURAL_STATES.includes(a.structural.state)
        && typeof a.structural.reason === "string" && a.structural.reason.length <= 900
        && Array.isArray(a.structural.passageIds) && a.structural.passageIds.every((id) => typeof id === "string"))
      && Array.isArray(a.characters) && a.characters.every((cell) => cell && typeof cell.characterId === "string"
        && CHARACTER_STATES.includes(cell.state) && typeof cell.reason === "string" && cell.reason.length <= 900
        && Array.isArray(cell.passageIds) && cell.passageIds.every((id) => typeof id === "string"))
      && Array.isArray(a.miniBlocks) && a.miniBlocks.length === 4
      && new Set(a.miniBlocks.map((mini) => mini?.ordinal)).size === 4 && a.miniBlocks.every((mini) => mini
        && Number.isInteger(mini.ordinal) && mini.ordinal >= 1 && mini.ordinal <= 4
        && MINI_STATES.includes(mini.state)
        && typeof mini.reason === "string" && mini.reason.length <= 900
        && typeof mini.storyboardCue === "string" && mini.storyboardCue.length <= 360
        && Array.isArray(mini.passageIds) && mini.passageIds.every((id) => typeof id === "string"));
  }).slice(-24);
}

function normalizeRunBlockSummary(value: unknown): OutlineAssessmentRunBlockSummary | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Partial<OutlineAssessmentRunBlockSummary>;
  const blockNumber = Number(source.blockNumber);
  const structuralState = source.structuralState;
  const miniBlockStates = Array.isArray(source.miniBlockStates) ? source.miniBlockStates : [];
  const citedPassageCount = Number(source.citedPassageCount);
  const characterFindingCount = Number(source.characterFindingCount);
  const model = cleanRunText(source.model, 120);
  if (!Number.isInteger(blockNumber) || blockNumber < 1 || blockNumber > 24
    || !structuralState || !STRUCTURAL_STATES.includes(structuralState)
    || !Number.isInteger(citedPassageCount) || citedPassageCount < 0 || citedPassageCount > 100000
    || !Number.isInteger(characterFindingCount) || characterFindingCount < 0 || characterFindingCount > 1000
    || miniBlockStates.length !== 4 || miniBlockStates.some((state) => !MINI_STATES.includes(state))
    || !model) return null;
  return {
    blockNumber,
    structuralState,
    citedPassageCount,
    characterFindingCount,
    miniBlockStates: miniBlockStates as OutlineAssessmentRunBlockSummary["miniBlockStates"],
    model,
  };
}

export function normalizeOutlineAssessmentRuns(value: unknown): readonly OutlineAssessmentRunReceipt[] {
  if (!Array.isArray(value)) return [];
  return value.map((item): OutlineAssessmentRunReceipt | null => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const source = item as Partial<OutlineAssessmentRunReceipt>;
    const id = cleanRunText(source.id, 120);
    const assessedAt = cleanRunText(source.assessedAt, 80);
    const requestedBlockNumbers = normalizeBlockNumbers(source.requestedBlockNumbers);
    const completedBlockNumbers = normalizeBlockNumbers(source.completedBlockNumbers);
    const changedBlockNumbers = normalizeBlockNumbers(source.changedBlockNumbers);
    const blockSummaries = Array.isArray(source.blockSummaries)
      ? source.blockSummaries.map(normalizeRunBlockSummary).filter((summary): summary is OutlineAssessmentRunBlockSummary => Boolean(summary))
      : [];
    const scope = source.scope === "block" || source.scope === "act" ? source.scope : null;
    const status = source.status === "completed" || source.status === "partial" || source.status === "failed" ? source.status : null;
    const actNumber = source.actNumber === null ? null : Number(source.actNumber);
    const error = cleanRunText(source.error, 500);
    if (source.version !== 1 || !id || !assessedAt || !scope || !status || source.acceptedStoryContentChanged !== false
      || !requestedBlockNumbers.length
      || completedBlockNumbers.some((blockNumber) => !requestedBlockNumbers.includes(blockNumber))
      || changedBlockNumbers.some((blockNumber) => !completedBlockNumbers.includes(blockNumber))
      || blockSummaries.length !== completedBlockNumbers.length
      || new Set(blockSummaries.map((summary) => summary.blockNumber)).size !== blockSummaries.length
      || blockSummaries.some((summary) => !completedBlockNumbers.includes(summary.blockNumber))) return null;
    if (scope === "block" && (requestedBlockNumbers.length !== 1 || actNumber !== null)) return null;
    if (scope === "act") {
      if (!Number.isInteger(actNumber) || Number(actNumber) < 1 || Number(actNumber) > 4 || requestedBlockNumbers.length !== 6) return null;
      const first = (Number(actNumber) - 1) * 6 + 1;
      if (requestedBlockNumbers.some((blockNumber) => blockNumber < first || blockNumber > first + 5)) return null;
    }
    if ((status === "completed" && completedBlockNumbers.length !== requestedBlockNumbers.length)
      || (status === "failed" && completedBlockNumbers.length !== 0)
      || (status === "partial" && (completedBlockNumbers.length === 0 || completedBlockNumbers.length === requestedBlockNumbers.length))) return null;
    return {
      version: 1,
      id,
      scope,
      actNumber: scope === "act" ? Number(actNumber) : null,
      requestedBlockNumbers,
      completedBlockNumbers,
      changedBlockNumbers,
      status,
      assessedAt,
      acceptedStoryContentChanged: false,
      blockSummaries,
      ...(error ? { error } : {}),
    };
  }).filter((item): item is OutlineAssessmentRunReceipt => Boolean(item)).slice(-40);
}
