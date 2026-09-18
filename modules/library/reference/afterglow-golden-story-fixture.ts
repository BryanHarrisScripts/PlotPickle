import { legacyStoryBeatPattern } from "../../../adapters/curriculum/current-catalog";
import {
  afterglowSourceUsePolicy,
  afterglowVersions,
} from "../../../data/afterglow-reconciliation";
import { createAfterglowProject as createCompleteAfterglowProject } from "../../../data/afterglow-complete";
import { AFTERGLOW_V9_EXPLICIT_SECTION_COUNT } from "../../../data/afterglow-reference-identity";
import type { ImportedScreenplayEvidence } from "../../../core/contracts/imported-screenplay-evidence";
import type {
  StoryBlockEvidenceCell,
  StoryEvidenceMatrix,
  StoryEvidenceSourceMapping,
  StoryEvidenceSourceTopology,
} from "../../../core/contracts/story-evidence-matrix";

export const AFTERGLOW_GOLDEN_STORY_FIXTURE_ID = "afterglow-v8-v9-v10-24x96-evidence-matrix" as const;

function words(text: string) {
  return text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
}

function uniqueNumbers(values: readonly number[]) {
  return [...new Set(values)].sort((left, right) => left - right);
}

function responsibilityFor(blockNumber: number) {
  const guidance = legacyStoryBeatPattern[blockNumber - 1] ?? "";
  return guidance.replace(/^Block\s+\d+\s+—\s+/u, "").trim();
}

function sourceTopology(screenplay: ImportedScreenplayEvidence): readonly StoryEvidenceSourceTopology[] {
  const sectionCount = screenplay.sectionMarkers?.length ?? 0;
  return afterglowVersions.map((version) => ({
    sourceId: version.id,
    label: version.label,
    status: version.status,
    scope: version.scope,
    sourcePath: version.sourcePath,
    sourceSha: version.sourceSha,
    immutable: version.immutable,
    authoredSectionCount: version.id === "v9" ? sectionCount : "not-asserted",
    authoredBlockCount: "not-asserted",
    frontierBlocks: version.id === "v10"
      ? [...afterglowSourceUsePolicy.laterPartialRewrite.coveredBlocks]
      : Array.from({ length: 24 }, (_, index) => index + 1),
  }));
}

function baselineMapping(
  screenplay: ImportedScreenplayEvidence,
  blockNumber: number,
): StoryEvidenceSourceMapping {
  const passages = screenplay.passages.filter((passage) => passage.blockNumber === blockNumber);
  const markers = (screenplay.sectionMarkers ?? []).filter((marker) => marker.blockNumber === blockNumber);
  return {
    sourceId: "v9",
    sourceVersion: "v9",
    sourceRole: "baseline",
    sourceRef: `${screenplay.sourceFileName}#projected-block-${String(blockNumber).padStart(2, "0")}`,
    mappingMethod: "page-progress-fallback",
    passageIds: passages.map((passage) => passage.id),
    sceneNumbers: uniqueNumbers(passages.map((passage) => passage.sceneNumber)),
    sectionMarkerIds: markers.map((marker) => marker.id),
    candidateOnly: false,
    note: "Observed v9 screenplay passages are projected onto the 24-Block grid by page progress. This is evidence placement, not proof of an authored v9 Block boundary or of structural completeness.",
  };
}

function comparisonMappings(blockNumber: number): StoryEvidenceSourceMapping[] {
  const mappings: StoryEvidenceSourceMapping[] = [];
  if (blockNumber <= 8) {
    mappings.push({
      sourceId: "v10",
      sourceVersion: "v10",
      sourceRole: "later-partial",
      sourceRef: `data/afterglow-v10-screenplay-source.txt#block-${blockNumber}`,
      mappingMethod: "historical-crosswalk",
      passageIds: [],
      sceneNumbers: [],
      sectionMarkerIds: [],
      candidateOnly: true,
      note: "Later v10 rewrite evidence exists for Blocks 1–8 and is available for Human comparison. It is not auto-applied over the v9 baseline.",
    });
  }
  mappings.push({
    sourceId: "v8",
    sourceVersion: "v8",
    sourceRole: "historical-comparison",
    sourceRef: "AfterGlow v8 Twitter Rewrite Bryan E. Harris 2023 Github.fdx",
    mappingMethod: "historical-crosswalk",
    passageIds: [],
    sceneNumbers: [],
    sectionMarkerIds: [],
    candidateOnly: true,
    note: "v8 is an earlier complete comparison source for gap recovery. This reference does not claim that v8 contains 24 explicit authored Block markers or that this Block is covered until Human review establishes a crosswalk.",
  });
  return mappings;
}

function blockCell(
  screenplay: ImportedScreenplayEvidence,
  blockNumber: number,
  title: string,
): StoryBlockEvidenceCell {
  const passages = screenplay.passages.filter((passage) => passage.blockNumber === blockNumber);
  const sceneNumbers = uniqueNumbers(passages.map((passage) => passage.sceneNumber));
  const wordCount = passages.reduce((total, passage) => total + words(passage.text), 0);
  const miniBlocks = [1, 2, 3, 4].map((miniBlockNumber) => {
    const miniPassages = passages.filter((passage) => passage.miniBlockNumber === miniBlockNumber);
    return {
      blockNumber,
      miniBlockNumber,
      passageIds: miniPassages.map((passage) => passage.id),
      sceneNumbers: uniqueNumbers(miniPassages.map((passage) => passage.sceneNumber)),
      hasObservedEvidence: miniPassages.length > 0,
    };
  });
  const sourceSharePercent = screenplay.passages.length
    ? Number(((passages.length / screenplay.passages.length) * 100).toFixed(2))
    : 0;
  return {
    blockNumber,
    title,
    responsibility: responsibilityFor(blockNumber),
    passageCount: passages.length,
    sceneCount: sceneNumbers.length,
    wordCount,
    sourceSharePercent,
    miniBlocksWithEvidence: miniBlocks.filter((mini) => mini.hasObservedEvidence).length,
    miniBlocks,
    sourceMappings: [
      baselineMapping(screenplay, blockNumber),
      ...comparisonMappings(blockNumber),
    ],
    characterEvidenceRefs: [],
    structuralFinding: {
      state: "unresolved",
      reason: passages.length
        ? "Observed v9 passages are present, but source density does not establish whether this canonical Block responsibility is Covered, Condensed/Shared, or Gap/Underdeveloped. Human semantic review is required."
        : "No v9 passage is currently projected to this address. Treat the absence as explicit evidence only; Human review must inspect adjacent v9 movement plus v10/v8 comparison material before classifying a structural gap.",
      reviewedAt: null,
    },
  };
}

/**
 * Deterministic Afterglow source-evidence fixture.
 *
 * This fixture intentionally separates:
 * - the canonical PlotPickle 24/96 coordinates;
 * - v9's actual source topology (21 titled sections);
 * - page-progress fallback placement of v9 passages;
 * - v10's bounded later-rewrite frontier;
 * - v8's historical comparison role;
 * - Human structural judgment.
 *
 * It never promotes comparison sources, invents missing passages or decides that
 * a Block is creatively complete.
 */
export function createAfterglowGoldenStoryMatrix(
  screenplay: ImportedScreenplayEvidence,
): StoryEvidenceMatrix {
  const project = createCompleteAfterglowProject();
  const sections = screenplay.sectionMarkers ?? [];
  if (project.blocks.length !== 24) {
    throw new Error(`#2168 expected the canonical Afterglow projection to contain 24 Blocks, found ${project.blocks.length}.`);
  }
  if (sections.length !== AFTERGLOW_V9_EXPLICIT_SECTION_COUNT) {
    throw new Error(`#2168 expected the v9 source topology to contain ${AFTERGLOW_V9_EXPLICIT_SECTION_COUNT} explicit titled sections, found ${sections.length}. Review the source before accepting topology drift.`);
  }

  return {
    schemaVersion: 1,
    fixtureId: AFTERGLOW_GOLDEN_STORY_FIXTURE_ID,
    canonicalGrid: "24x96",
    sourcePolicy: afterglowSourceUsePolicy.rule,
    sources: sourceTopology(screenplay),
    sourceSections: sections.map((marker) => ({
      id: marker.id,
      sourceId: "v9",
      title: marker.title,
      page: marker.page,
      projectedBlockNumber: marker.blockNumber,
      mappingMethod: "page-progress-fallback",
    })),
    blocks: project.blocks.map((block) => blockCell(screenplay, block.number, block.title)),
  };
}
