export type StoryEvidenceMappingMethod =
  | "authored-label"
  | "historical-crosswalk"
  | "semantic-reviewed"
  | "page-progress-fallback";

export type StoryStructuralFindingState =
  | "covered"
  | "condensed-shared"
  | "gap-underdeveloped"
  | "unresolved";

export type StoryEvidenceSourceRole =
  | "baseline"
  | "later-partial"
  | "historical-comparison"
  | "working-current";

export type StoryEvidenceSourceMapping = {
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly sourceRole: StoryEvidenceSourceRole;
  readonly sourceRef: string;
  readonly mappingMethod: StoryEvidenceMappingMethod;
  readonly passageIds: readonly string[];
  readonly sceneNumbers: readonly number[];
  readonly sectionMarkerIds: readonly string[];
  readonly candidateOnly: boolean;
  readonly note: string;
};

export type StoryMiniBlockEvidenceCell = {
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly passageIds: readonly string[];
  readonly sceneNumbers: readonly number[];
  readonly hasObservedEvidence: boolean;
};

export type StoryStructuralFinding = {
  readonly state: StoryStructuralFindingState;
  readonly reason: string;
  readonly reviewedAt: string | null;
};

export type StoryBlockEvidenceCell = {
  readonly blockNumber: number;
  readonly title: string;
  readonly responsibility: string;
  readonly passageCount: number;
  readonly sceneCount: number;
  readonly wordCount: number;
  readonly sourceSharePercent: number;
  readonly miniBlocksWithEvidence: number;
  readonly miniBlocks: readonly StoryMiniBlockEvidenceCell[];
  readonly sourceMappings: readonly StoryEvidenceSourceMapping[];
  readonly structuralFinding: StoryStructuralFinding;
};

export type StoryEvidenceSourceTopology = {
  readonly sourceId: string;
  readonly label: string;
  readonly status: string;
  readonly scope: string;
  readonly sourcePath: string;
  readonly sourceSha: string;
  readonly immutable: boolean;
  readonly authoredSectionCount: number | "not-asserted";
  readonly authoredBlockCount: number | "not-asserted";
  readonly frontierBlocks: readonly number[];
};

export type StoryEvidenceSection = {
  readonly id: string;
  readonly sourceId: string;
  readonly title: string;
  readonly page: number;
  readonly projectedBlockNumber: number;
  readonly mappingMethod: StoryEvidenceMappingMethod;
};

export type StoryEvidenceMatrix = {
  readonly schemaVersion: 1;
  readonly fixtureId: string;
  readonly canonicalGrid: "24x96";
  readonly sourcePolicy: string;
  readonly sources: readonly StoryEvidenceSourceTopology[];
  readonly sourceSections: readonly StoryEvidenceSection[];
  readonly blocks: readonly StoryBlockEvidenceCell[];
};

function clean(value: unknown, limit = 1200) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, limit)
    : "";
}

function integer(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  if (!Number.isInteger(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, number));
}

function uniqueStrings(value: unknown, limit = 2500) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => clean(item, 240)).filter(Boolean))].slice(0, limit)
    : [];
}

function uniqueNumbers(value: unknown, limit = 9999) {
  return Array.isArray(value)
    ? [...new Set(value
      .map((item) => Number(item))
      .filter((item) => Number.isInteger(item) && item >= 0 && item <= 9999))]
      .slice(0, limit)
      .sort((left, right) => left - right)
    : [];
}

function mappingMethod(value: unknown): StoryEvidenceMappingMethod {
  return value === "authored-label"
    || value === "historical-crosswalk"
    || value === "semantic-reviewed"
    || value === "page-progress-fallback"
    ? value
    : "page-progress-fallback";
}

function sourceRole(value: unknown): StoryEvidenceSourceRole {
  return value === "later-partial"
    || value === "historical-comparison"
    || value === "working-current"
    ? value
    : "baseline";
}

function findingState(value: unknown): StoryStructuralFindingState {
  return value === "covered"
    || value === "condensed-shared"
    || value === "gap-underdeveloped"
    ? value
    : "unresolved";
}

function normalizeMiniBlock(value: unknown, blockNumber: number, fallbackOrdinal: number): StoryMiniBlockEvidenceCell {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<StoryMiniBlockEvidenceCell>
    : {};
  const miniBlockNumber = integer(source.miniBlockNumber ?? fallbackOrdinal, 1, 4);
  const passageIds = uniqueStrings(source.passageIds);
  const sceneNumbers = uniqueNumbers(source.sceneNumbers);
  return {
    blockNumber,
    miniBlockNumber,
    passageIds,
    sceneNumbers,
    hasObservedEvidence: Boolean(source.hasObservedEvidence) || passageIds.length > 0,
  };
}

function normalizeSourceMapping(value: unknown): StoryEvidenceSourceMapping | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Partial<StoryEvidenceSourceMapping>;
  const sourceId = clean(source.sourceId, 120);
  const sourceVersion = clean(source.sourceVersion, 80);
  const sourceRef = clean(source.sourceRef, 500);
  if (!sourceId || !sourceVersion || !sourceRef) return null;
  return {
    sourceId,
    sourceVersion,
    sourceRole: sourceRole(source.sourceRole),
    sourceRef,
    mappingMethod: mappingMethod(source.mappingMethod),
    passageIds: uniqueStrings(source.passageIds),
    sceneNumbers: uniqueNumbers(source.sceneNumbers),
    sectionMarkerIds: uniqueStrings(source.sectionMarkerIds, 256),
    candidateOnly: Boolean(source.candidateOnly),
    note: clean(source.note, 1200),
  };
}

function normalizeBlock(value: unknown, fallbackNumber: number): StoryBlockEvidenceCell {
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value as Partial<StoryBlockEvidenceCell>
    : {};
  const blockNumber = integer(source.blockNumber ?? fallbackNumber, 1, 24);
  const sourceMappings = Array.isArray(source.sourceMappings)
    ? source.sourceMappings
      .map(normalizeSourceMapping)
      .filter((item): item is StoryEvidenceSourceMapping => Boolean(item))
    : [];
  const miniBlocks = Array.from({ length: 4 }, (_, index) => {
    const matching = Array.isArray(source.miniBlocks)
      ? source.miniBlocks.find((item) => (
        item && typeof item === "object" && !Array.isArray(item)
        && Number((item as Partial<StoryMiniBlockEvidenceCell>).miniBlockNumber) === index + 1
      ))
      : null;
    return normalizeMiniBlock(matching, blockNumber, index + 1);
  });
  const finding = source.structuralFinding && typeof source.structuralFinding === "object"
    ? source.structuralFinding as Partial<StoryStructuralFinding>
    : {};
  return {
    blockNumber,
    title: clean(source.title, 500) || `Block ${String(blockNumber).padStart(2, "0")}`,
    responsibility: clean(source.responsibility, 1600),
    passageCount: integer(source.passageCount, 0, 100000),
    sceneCount: integer(source.sceneCount, 0, 10000),
    wordCount: integer(source.wordCount, 0, 10000000),
    sourceSharePercent: Math.min(100, Math.max(0, Number(source.sourceSharePercent) || 0)),
    miniBlocksWithEvidence: miniBlocks.filter((mini) => mini.hasObservedEvidence).length,
    miniBlocks,
    sourceMappings,
    structuralFinding: {
      state: findingState(finding.state),
      reason: clean(finding.reason, 2000),
      reviewedAt: clean(finding.reviewedAt, 80) || null,
    },
  };
}

export function normalizeStoryEvidenceMatrix(value: unknown): StoryEvidenceMatrix | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Partial<StoryEvidenceMatrix>;
  const fixtureId = clean(source.fixtureId, 240);
  if (!fixtureId) return null;
  const sources = Array.isArray(source.sources)
    ? source.sources.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const candidate = item as Partial<StoryEvidenceSourceTopology>;
      const sourceId = clean(candidate.sourceId, 120);
      if (!sourceId) return [];
      return [{
        sourceId,
        label: clean(candidate.label, 500),
        status: clean(candidate.status, 120),
        scope: clean(candidate.scope, 1200),
        sourcePath: clean(candidate.sourcePath, 800),
        sourceSha: clean(candidate.sourceSha, 200),
        immutable: Boolean(candidate.immutable),
        authoredSectionCount: candidate.authoredSectionCount === "not-asserted"
          ? "not-asserted" as const
          : integer(candidate.authoredSectionCount, 0, 1000),
        authoredBlockCount: candidate.authoredBlockCount === "not-asserted"
          ? "not-asserted" as const
          : integer(candidate.authoredBlockCount, 0, 1000),
        frontierBlocks: uniqueNumbers(candidate.frontierBlocks, 24).filter((number) => number >= 1 && number <= 24),
      }];
    })
    : [];
  const sourceSections = Array.isArray(source.sourceSections)
    ? source.sourceSections.flatMap((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return [];
      const candidate = item as Partial<StoryEvidenceSection>;
      const id = clean(candidate.id, 240);
      const sourceId = clean(candidate.sourceId, 120);
      const title = clean(candidate.title, 500);
      if (!id || !sourceId || !title) return [];
      return [{
        id,
        sourceId,
        title,
        page: integer(candidate.page, 1, 10000),
        projectedBlockNumber: integer(candidate.projectedBlockNumber, 1, 24),
        mappingMethod: mappingMethod(candidate.mappingMethod),
      }];
    })
    : [];
  const blocks = Array.from({ length: 24 }, (_, index) => {
    const matching = Array.isArray(source.blocks)
      ? source.blocks.find((item) => (
        item && typeof item === "object" && !Array.isArray(item)
        && Number((item as Partial<StoryBlockEvidenceCell>).blockNumber) === index + 1
      ))
      : null;
    return normalizeBlock(matching, index + 1);
  });
  return {
    schemaVersion: 1,
    fixtureId,
    canonicalGrid: "24x96",
    sourcePolicy: clean(source.sourcePolicy, 3000),
    sources,
    sourceSections,
    blocks,
  };
}

export function reviewStoryEvidenceBlock(
  matrix: StoryEvidenceMatrix,
  blockNumber: number,
  state: StoryStructuralFindingState,
  reason: string,
  reviewedAt: string,
): StoryEvidenceMatrix {
  const normalized = normalizeStoryEvidenceMatrix(matrix);
  if (!normalized) return matrix;
  const target = integer(blockNumber, 1, 24);
  return {
    ...normalized,
    blocks: normalized.blocks.map((block) => block.blockNumber !== target ? block : {
      ...block,
      structuralFinding: {
        state: findingState(state),
        reason: clean(reason, 2000),
        reviewedAt: clean(reviewedAt, 80) || null,
      },
    }),
  };
}
