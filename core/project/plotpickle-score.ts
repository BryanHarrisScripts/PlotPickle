import type { ProjectSourceEvidence } from "../contracts/imported-screenplay-evidence";
import {
  MINI_BLOCKS_PER_BLOCK,
  STORY_BLOCK_COUNT,
  STORY_MINI_BLOCK_COUNT,
  type StoryStructureV2,
} from "./story-structure-v2";

export const PLOTPICKLE_SCORE_VERSION = 1 as const;
export const PLOTPICKLE_SCORE_MINIMUM_UNITS = 8 as const;
export const PLOTPICKLE_SCORE_RATED_COVERAGE = 0.6 as const;

export type PlotPickleScoreRatingState = "unrated" | "provisional" | "rated";
export type PlotPickleScoreEvidenceBasis = "imported-screenplay" | "native-structure" | "none";

export type PlotPickleScoreMetrics = Readonly<{
  alignment: number;
  verbosity: number;
  erosion: number;
  progression: number;
  coverage: number;
}>;

export type PlotPickleScoreResult = Readonly<{
  version: typeof PLOTPICKLE_SCORE_VERSION;
  score: number | null;
  displayScore: string;
  ratingState: PlotPickleScoreRatingState;
  metrics: PlotPickleScoreMetrics;
  evidence: Readonly<{
    basis: PlotPickleScoreEvidenceBasis;
    populatedUnits: number;
    totalUnits: typeof STORY_MINI_BLOCK_COUNT;
    importedPassages: number;
    importedAnalysisStatus: "none" | "suggested" | "reviewed";
  }>;
}>;

export type PlotPickleScoreInput = Readonly<{
  structure: StoryStructureV2;
  sourceEvidence: ProjectSourceEvidence;
}>;

type EvidenceUnit = {
  number: number;
  blockNumber: number;
  ordinal: number;
  text: string;
  wordCount: number;
  passageTypes: readonly string[];
};

function clamp01(value: number) {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function cleanText(value: string) {
  return value.normalize("NFKC").replace(/\s+/gu, " ").trim();
}

function fingerprint(value: string) {
  return cleanText(value)
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/gu, " ")
    .trim();
}

function wordTokens(value: string) {
  return cleanText(value).toLocaleLowerCase().match(/[\p{L}\p{N}]+(?:['’\-][\p{L}\p{N}]+)*/gu) ?? [];
}

function tokenSet(value: string) {
  return new Set(wordTokens(value));
}

function similarity(left: string, right: string) {
  const leftFingerprint = fingerprint(left);
  const rightFingerprint = fingerprint(right);
  if (!leftFingerprint || !rightFingerprint) return 0;
  if (leftFingerprint === rightFingerprint) return 1;
  const leftTokens = tokenSet(leftFingerprint);
  const rightTokens = tokenSet(rightFingerprint);
  if (leftTokens.size < 6 || rightTokens.size < 6) return 0;
  let intersection = 0;
  leftTokens.forEach((token) => {
    if (rightTokens.has(token)) intersection += 1;
  });
  const union = new Set([...leftTokens, ...rightTokens]).size;
  return union ? intersection / union : 0;
}

function importedEvidence(sourceEvidence: ProjectSourceEvidence): EvidenceUnit[] {
  const screenplay = sourceEvidence.screenplay;
  if (!screenplay?.passages.length) return [];
  const grouped = new Map<number, { blockNumber: number; ordinal: number; texts: string[]; types: Set<string> }>();
  screenplay.passages.forEach((passage) => {
    const ordinal = Math.max(1, Math.min(MINI_BLOCKS_PER_BLOCK, passage.miniBlockNumber));
    const blockNumber = Math.max(1, Math.min(STORY_BLOCK_COUNT, passage.blockNumber));
    const number = ((blockNumber - 1) * MINI_BLOCKS_PER_BLOCK) + ordinal;
    const existing = grouped.get(number) ?? { blockNumber, ordinal, texts: [], types: new Set<string>() };
    const text = cleanText(passage.text);
    if (text) existing.texts.push(text);
    if (passage.type.trim()) existing.types.add(passage.type.trim().toLocaleLowerCase());
    grouped.set(number, existing);
  });
  return [...grouped.entries()]
    .map(([number, value]) => {
      const text = cleanText(value.texts.join(" "));
      return {
        number,
        blockNumber: value.blockNumber,
        ordinal: value.ordinal,
        text,
        wordCount: wordTokens(text).length,
        passageTypes: [...value.types].sort(),
      };
    })
    .filter((unit) => Boolean(unit.text))
    .sort((left, right) => left.number - right.number);
}

function nativeEvidence(structure: StoryStructureV2): EvidenceUnit[] {
  return structure.blocks
    .flatMap((block) => block.miniBlocks.map((mini) => {
      const stage = mini.stages.storyboard.content.trim()
        ? "storyboard"
        : mini.stages.build.content.trim()
          ? "build"
          : mini.stages.plan.content.trim()
            ? "plan"
            : null;
      const text = stage ? cleanText(mini.stages[stage].content) : "";
      return {
        number: mini.number,
        blockNumber: block.number,
        ordinal: mini.ordinal,
        text,
        wordCount: wordTokens(text).length,
        passageTypes: stage ? [stage] : [],
      } satisfies EvidenceUnit;
    }))
    .filter((unit) => Boolean(unit.text))
    .sort((left, right) => left.number - right.number);
}

function distributionScore(counts: readonly number[]) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  if (!total || counts.length < 2) return total ? 1 : 0;
  const expected = 1 / counts.length;
  const variation = 0.5 * counts.reduce((sum, count) => sum + Math.abs((count / total) - expected), 0);
  const maximumVariation = 1 - expected;
  return clamp01(1 - (variation / maximumVariation));
}

function alignmentScore(units: readonly EvidenceUnit[]) {
  if (!units.length) return 0;
  const actCounts = [0, 0, 0, 0];
  const ordinalCounts = Array.from({ length: MINI_BLOCKS_PER_BLOCK }, () => 0);
  const blocks = new Set<number>();
  units.forEach((unit) => {
    actCounts[Math.min(3, Math.floor((unit.blockNumber - 1) / 6))] += 1;
    ordinalCounts[unit.ordinal - 1] += 1;
    blocks.add(unit.blockNumber);
  });
  const idealBlockSpread = Math.min(STORY_BLOCK_COUNT, units.length);
  const blockSpread = idealBlockSpread ? blocks.size / idealBlockSpread : 0;
  return clamp01((distributionScore(actCounts) + distributionScore(ordinalCounts) + blockSpread) / 3);
}

function verbosityScore(units: readonly EvidenceUnit[]) {
  if (!units.length) return 0;
  const previous: EvidenceUnit[] = [];
  let redundant = 0;
  units.forEach((unit) => {
    if (previous.some((candidate) => similarity(candidate.text, unit.text) >= 0.88)) redundant += 1;
    previous.push(unit);
  });
  return clamp01(redundant / units.length);
}

function median(values: readonly number[]) {
  if (!values.length) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

function erosionScore(units: readonly EvidenceUnit[]) {
  if (!units.length) return 0;
  const masses = units.map((unit) => {
    const diversity = Math.min(1.4, 1 + (Math.max(1, unit.passageTypes.length) - 1) * 0.08);
    return unit.wordCount * diversity;
  });
  const total = masses.reduce((sum, mass) => sum + mass, 0);
  if (!total) return 0;
  const mean = total / masses.length;
  const threshold = Math.max(120, median(masses) * 1.8, mean * 1.5);
  const overloaded = masses.reduce((sum, mass) => sum + (mass > threshold ? mass : 0), 0);
  return clamp01(overloaded / total);
}

function progressionScore(units: readonly EvidenceUnit[]) {
  if (units.length < 2) return 0;
  let progressed = 0;
  for (let index = 1; index < units.length; index += 1) {
    if (similarity(units[index - 1].text, units[index].text) < 0.8) progressed += 1;
  }
  return clamp01(progressed / (units.length - 1));
}

function headlineScore(metrics: PlotPickleScoreMetrics) {
  const product = metrics.alignment
    * (1 - metrics.verbosity)
    * (1 - metrics.erosion)
    * metrics.progression
    * metrics.coverage;
  return Math.round(100 * Math.pow(clamp01(product), 1 / 5));
}

export function calculatePlotPickleScore(input: PlotPickleScoreInput): PlotPickleScoreResult {
  const imported = importedEvidence(input.sourceEvidence);
  const native = nativeEvidence(input.structure);
  const basis: PlotPickleScoreEvidenceBasis = imported.length
    ? "imported-screenplay"
    : native.length
      ? "native-structure"
      : "none";
  const units = imported.length ? imported : native;
  const importedAnalysisStatus = input.sourceEvidence.screenplay?.analysisStatus ?? "none";
  const metrics: PlotPickleScoreMetrics = {
    alignment: alignmentScore(units),
    verbosity: verbosityScore(units),
    erosion: erosionScore(units),
    progression: progressionScore(units),
    coverage: clamp01(units.length / STORY_MINI_BLOCK_COUNT),
  };

  if (units.length < PLOTPICKLE_SCORE_MINIMUM_UNITS) {
    return {
      version: PLOTPICKLE_SCORE_VERSION,
      score: null,
      displayScore: "NR",
      ratingState: "unrated",
      metrics,
      evidence: {
        basis,
        populatedUnits: units.length,
        totalUnits: STORY_MINI_BLOCK_COUNT,
        importedPassages: imported.length ? input.sourceEvidence.screenplay?.passages.length ?? 0 : 0,
        importedAnalysisStatus,
      },
    };
  }

  const provisional = metrics.coverage < PLOTPICKLE_SCORE_RATED_COVERAGE
    || (basis === "imported-screenplay" && importedAnalysisStatus !== "reviewed");
  const score = headlineScore(metrics);
  return {
    version: PLOTPICKLE_SCORE_VERSION,
    score,
    displayScore: String(score),
    ratingState: provisional ? "provisional" : "rated",
    metrics,
    evidence: {
      basis,
      populatedUnits: units.length,
      totalUnits: STORY_MINI_BLOCK_COUNT,
      importedPassages: imported.length ? input.sourceEvidence.screenplay?.passages.length ?? 0 : 0,
      importedAnalysisStatus,
    },
  };
}

export function plotPickleScorePercent(value: number) {
  return Math.round(clamp01(value) * 100);
}
