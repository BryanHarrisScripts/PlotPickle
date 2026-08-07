import type { CreativeExplorationCandidate } from "./creative-candidates";
import type { PlotPickleProject } from "./project";

export type CandidateComparisonDecision = "none" | "shortlisted" | "rejected";

export type CandidateComparisonAnnotation = {
  strengths: string;
  problems: string;
  reusableQualities: string;
};

export type CandidateComparisonRecord = {
  candidateId: string;
  rank: number | null;
  decision: CandidateComparisonDecision;
  annotation: CandidateComparisonAnnotation;
  updatedAt: string;
};

export type CandidateComparisonStore = {
  version: 1;
  records: CandidateComparisonRecord[];
};

const EXTENSION_KEY = "candidateComparison";

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function normalizeDecision(value: unknown): CandidateComparisonDecision {
  return value === "shortlisted" || value === "rejected" ? value : "none";
}

export function normalizeCandidateComparisonRecord(value: unknown): CandidateComparisonRecord | null {
  const record = objectValue(value);
  const candidateId = text(record.candidateId);
  if (!candidateId) return null;
  const annotation = objectValue(record.annotation);
  const numericRank = Number(record.rank);
  return {
    candidateId,
    rank: Number.isFinite(numericRank) && numericRank > 0 ? Math.floor(numericRank) : null,
    decision: normalizeDecision(record.decision),
    annotation: {
      strengths: text(annotation.strengths),
      problems: text(annotation.problems),
      reusableQualities: text(annotation.reusableQualities),
    },
    updatedAt: text(record.updatedAt) || new Date().toISOString(),
  };
}

export function readCandidateComparisonStore(project: PlotPickleProject): CandidateComparisonStore {
  const extensions = objectValue(project.extensions);
  const store = objectValue(extensions[EXTENSION_KEY]);
  const records = Array.isArray(store.records) ? store.records : [];
  return {
    version: 1,
    records: records.flatMap((record) => {
      const normalized = normalizeCandidateComparisonRecord(record);
      return normalized ? [normalized] : [];
    }),
  };
}

export function comparisonForCandidate(project: PlotPickleProject, candidateId: string): CandidateComparisonRecord {
  return readCandidateComparisonStore(project).records.find((record) => record.candidateId === candidateId) ?? {
    candidateId,
    rank: null,
    decision: "none",
    annotation: { strengths: "", problems: "", reusableQualities: "" },
    updatedAt: "",
  };
}

export function saveCandidateComparison(
  project: PlotPickleProject,
  record: CandidateComparisonRecord,
): PlotPickleProject {
  const store = readCandidateComparisonStore(project);
  const normalized = normalizeCandidateComparisonRecord({ ...record, updatedAt: new Date().toISOString() });
  if (!normalized) return project;
  const extensions = objectValue(project.extensions);
  const nextRecords = store.records.some((item) => item.candidateId === normalized.candidateId)
    ? store.records.map((item) => item.candidateId === normalized.candidateId ? normalized : item)
    : [...store.records, normalized];
  return {
    ...project,
    extensions: {
      ...extensions,
      [EXTENSION_KEY]: { version: 1, records: nextRecords },
    },
  };
}

export function setCandidateDecision(
  project: PlotPickleProject,
  candidate: CreativeExplorationCandidate,
  decision: CandidateComparisonDecision,
): PlotPickleProject {
  const current = comparisonForCandidate(project, candidate.id);
  return saveCandidateComparison(project, { ...current, decision });
}

export function restoreCandidate(project: PlotPickleProject, candidate: CreativeExplorationCandidate): PlotPickleProject {
  return setCandidateDecision(project, candidate, "none");
}

export function rankedCandidates(project: PlotPickleProject, candidates: CreativeExplorationCandidate[]) {
  return [...candidates].sort((left, right) => {
    const a = comparisonForCandidate(project, left.id).rank ?? Number.MAX_SAFE_INTEGER;
    const b = comparisonForCandidate(project, right.id).rank ?? Number.MAX_SAFE_INTEGER;
    return a - b;
  });
}
