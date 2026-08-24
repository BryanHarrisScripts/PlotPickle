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

export type ImportedScreenplayEvidence = {
  readonly sourceFileName: string;
  readonly sourceFormat: string;
  readonly importedAt: string;
  readonly analysisStatus: ImportedScreenplayEvidenceState;
  readonly totalPassageCount: number;
  readonly storedPassageCount: number;
  readonly passagesTruncated: boolean;
  readonly passages: readonly ImportedScreenplayPassage[];
};

export type ProjectSourceEvidence = {
  readonly screenplay: ImportedScreenplayEvidence | null;
};

export function createEmptyProjectSourceEvidence(): ProjectSourceEvidence {
  return { screenplay: null };
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

export function normalizeProjectSourceEvidence(value: unknown): ProjectSourceEvidence {
  if (!value || typeof value !== "object" || Array.isArray(value)) return createEmptyProjectSourceEvidence();
  const source = value as { readonly screenplay?: unknown };
  if (!source.screenplay || typeof source.screenplay !== "object" || Array.isArray(source.screenplay)) {
    return createEmptyProjectSourceEvidence();
  }
  const screenplay = source.screenplay as Partial<ImportedScreenplayEvidence>;
  const passages = Array.isArray(screenplay.passages)
    ? screenplay.passages
      .map(normalizePassage)
      .filter((item): item is ImportedScreenplayPassage => Boolean(item))
      .filter((item, index, all) => all.findIndex((candidate) => candidate.id === item.id) === index)
      .slice(0, 2500)
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
    },
  };
}
