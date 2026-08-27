export type ImportedScreenplayEvidenceState = "none" | "suggested" | "reviewed";

export type ImportedScreenplayPassage = {
  readonly id: string;
  readonly type: string;
  readonly text: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly sceneNumber: number;
  readonly sceneId: string | null;
};

export type ImportedScreenplayProjectionReview = {
  readonly blockNumber: number;
  readonly state: "needs-review";
  readonly atRevision: number;
  readonly reasonRefs: readonly string[];
};

export type ImportedScreenplayEvidence = {
  readonly sourceFileName: string;
  readonly sourceFormat: string;
  readonly importedAt: string;
  readonly analysisStatus: ImportedScreenplayEvidenceState;
  readonly totalPassageCount: number;
  readonly storedPassageCount: number;
  readonly passagesTruncated: boolean;
  readonly passages: readonly ImportedScreenplayPassage[];
  readonly projectionReviews?: readonly ImportedScreenplayProjectionReview[];
};

export type ReferenceFixtureFieldKind = "observed" | "synthetic-reference";
export type ReferenceFixtureAcceptanceState = "reference-defined" | "proposed";

export type ReferenceFixtureFieldEvidence = {
  readonly key: string;
  readonly lessonId: string;
  readonly fieldId: string;
  readonly kind: ReferenceFixtureFieldKind;
  readonly acceptanceState: ReferenceFixtureAcceptanceState;
  readonly sourceRefs: readonly string[];
  readonly reason: string;
};

export type ReferenceFixtureEvidence = {
  readonly fixtureId: string;
  readonly fixtureVersion: number;
  readonly sourceId: string;
  readonly sourceVersion: string;
  readonly sourceSha: string;
  readonly sourceLabel: string;
  readonly frontier: string;
  readonly curriculumFingerprint: string;
  readonly createdAt: string;
  readonly fields: readonly ReferenceFixtureFieldEvidence[];
};

export type ProjectSourceEvidence = {
  readonly screenplay: ImportedScreenplayEvidence | null;
  readonly referenceFixture: ReferenceFixtureEvidence | null;
};

export function createEmptyProjectSourceEvidence(): ProjectSourceEvidence {
  return { screenplay: null, referenceFixture: null };
}

function cleanText(value: unknown, limit: number) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").replace(/\s+/g, " ").trim().slice(0, limit)
    : "";
}

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  if (!Number.isInteger(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, number));
}

function cleanStringArray(value: unknown, limit = 32) {
  return Array.isArray(value)
    ? [...new Set(value
      .map((item) => cleanText(item, 240))
      .filter(Boolean))].slice(0, limit)
    : [];
}

function normalizePassage(value: unknown): ImportedScreenplayPassage | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Partial<ImportedScreenplayPassage>;
  const id = cleanText(source.id, 240);
  const text = cleanText(source.text, 800);
  if (!id || !text) return null;
  return {
    id,
    type: cleanText(source.type, 80) || "action",
    text,
    blockNumber: boundedInteger(source.blockNumber, 1, 24),
    miniBlockNumber: boundedInteger(source.miniBlockNumber, 1, 4),
    sceneNumber: boundedInteger(source.sceneNumber, 0, 9999),
    sceneId: cleanText(source.sceneId, 240) || null,
  };
}

function normalizeProjectionReview(value: unknown): ImportedScreenplayProjectionReview | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Partial<ImportedScreenplayProjectionReview>;
  if (source.state !== "needs-review") return null;
  return {
    blockNumber: boundedInteger(source.blockNumber, 1, 24),
    state: "needs-review",
    atRevision: boundedInteger(source.atRevision, 0, 1000000),
    reasonRefs: cleanStringArray(source.reasonRefs, 64),
  };
}

function normalizeReferenceFixtureField(value: unknown): ReferenceFixtureFieldEvidence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Partial<ReferenceFixtureFieldEvidence>;
  const lessonId = cleanText(source.lessonId, 240);
  const fieldId = cleanText(source.fieldId, 120);
  const key = cleanText(source.key, 360) || (lessonId && fieldId ? `${lessonId}:${fieldId}` : "");
  const kind: ReferenceFixtureFieldKind | null = source.kind === "observed"
    ? "observed"
    : source.kind === "synthetic-reference"
      ? "synthetic-reference"
      : null;
  const acceptanceState: ReferenceFixtureAcceptanceState | null = source.acceptanceState === "reference-defined"
    ? "reference-defined"
    : source.acceptanceState === "proposed"
      ? "proposed"
      : null;
  if (!key || !lessonId || !fieldId || !kind || !acceptanceState) return null;
  return {
    key,
    lessonId,
    fieldId,
    kind,
    acceptanceState,
    sourceRefs: cleanStringArray(source.sourceRefs),
    reason: cleanText(source.reason, 1000),
  };
}

function normalizeReferenceFixture(value: unknown): ReferenceFixtureEvidence | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = value as Partial<ReferenceFixtureEvidence>;
  const fixtureId = cleanText(source.fixtureId, 240);
  const sourceId = cleanText(source.sourceId, 240);
  const sourceVersion = cleanText(source.sourceVersion, 80);
  const sourceSha = cleanText(source.sourceSha, 160);
  const sourceLabel = cleanText(source.sourceLabel, 500);
  const frontier = cleanText(source.frontier, 120);
  const curriculumFingerprint = cleanText(source.curriculumFingerprint, 240);
  const createdAt = cleanText(source.createdAt, 80);
  if (!fixtureId || !sourceId || !sourceVersion || !sourceSha || !sourceLabel || !frontier || !curriculumFingerprint) return null;
  const fields = Array.isArray(source.fields)
    ? source.fields
      .map(normalizeReferenceFixtureField)
      .filter((field): field is ReferenceFixtureFieldEvidence => Boolean(field))
      .filter((field, index, all) => all.findIndex((candidate) => candidate.key === field.key) === index)
      .slice(0, 500)
    : [];
  return {
    fixtureId,
    fixtureVersion: boundedInteger(source.fixtureVersion, 1, 100000),
    sourceId,
    sourceVersion,
    sourceSha,
    sourceLabel,
    frontier,
    curriculumFingerprint,
    createdAt,
    fields,
  };
}

export function normalizeProjectSourceEvidence(value: unknown): ProjectSourceEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createEmptyProjectSourceEvidence();
  const source = value as { readonly screenplay?: unknown; readonly referenceFixture?: unknown };
  const referenceFixture = normalizeReferenceFixture(source.referenceFixture);
  if (!source.screenplay || typeof source.screenplay !== "object" || Array.isArray(source.screenplay)) {
    return { screenplay: null, referenceFixture };
  }
  const screenplay = source.screenplay as Partial<ImportedScreenplayEvidence>;
  const passages = Array.isArray(screenplay.passages)
    ? screenplay.passages
      .map(normalizePassage)
      .filter((item): item is ImportedScreenplayPassage => Boolean(item))
      .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
      .slice(0, 2500)
    : [];
  const projectionReviews = Array.isArray(screenplay.projectionReviews)
    ? screenplay.projectionReviews
      .map(normalizeProjectionReview)
      .filter((item): item is ImportedScreenplayProjectionReview => Boolean(item))
      .filter((item, index, all) => all.findLastIndex((candidate) => candidate.blockNumber === item.blockNumber) === index)
      .sort((left, right) => left.blockNumber - right.blockNumber)
      .slice(0, 24)
    : [];
  const analysisStatus: ImportedScreenplayEvidenceState = screenplay.analysisStatus === "reviewed"
    ? "reviewed"
    : screenplay.analysisStatus === "suggested"
      ? "suggested"
      : "none";
  const totalPassageCount = Math.max(passages.length, boundedInteger(screenplay.totalPassageCount, 0, 100000));
  return {
    screenplay: {
      sourceFileName: cleanText(screenplay.sourceFileName, 500) || "Imported screenplay",
      sourceFormat: cleanText(screenplay.sourceFormat, 80) || "screenplay",
      importedAt: cleanText(screenplay.importedAt, 80),
      analysisStatus,
      totalPassageCount,
      storedPassageCount: passages.length,
      passagesTruncated: Boolean(screenplay.passagesTruncated) || totalPassageCount > passages.length,
      passages,
      projectionReviews,
    },
    referenceFixture,
  };
}

function projectionBlockNumber(value: string) {
  const ref = cleanText(value, 240);
  const ppfMatch = /^ppf:(?:build:block:|structure:block[-:])(\d{1,2})(?::|$)/i.exec(ref);
  const blockMatch = /^block-(\d{1,2})(?::|$)/i.exec(ref);
  const number = Number(ppfMatch?.[1] ?? blockMatch?.[1] ?? "");
  return Number.isInteger(number) && number >= 1 && number <= 24 ? number : 0;
}

/**
 * Mark only dependency-backed screenplay Block projections for Human review.
 * Source passages remain immutable evidence; this records projection provenance
 * inside the same PPF rather than rewriting text or creating a second script store.
 */
export function markImportedScreenplayProjectionStale(
  value: unknown,
  affectedRefs: readonly string[],
  atRevision: number,
): ProjectSourceEvidence {
  const evidence = normalizeProjectSourceEvidence(value);
  if (!evidence.screenplay) return evidence;
  const refs = cleanStringArray(affectedRefs, 128);
  const affectedBlocks = [...new Set(refs.map(projectionBlockNumber).filter(Boolean))];
  if (!affectedBlocks.length) return evidence;
  const existing = evidence.screenplay.projectionReviews ?? [];
  const retained = existing.filter((review) => !affectedBlocks.includes(review.blockNumber));
  const reviews = affectedBlocks.map((blockNumber): ImportedScreenplayProjectionReview => ({
    blockNumber,
    state: "needs-review",
    atRevision: boundedInteger(atRevision, 0, 1000000),
    reasonRefs: refs.filter((ref) => projectionBlockNumber(ref) === blockNumber),
  }));
  return {
    ...evidence,
    screenplay: {
      ...evidence.screenplay,
      projectionReviews: [...retained, ...reviews].sort((left, right) => left.blockNumber - right.blockNumber),
    },
  };
}
