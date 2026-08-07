import type { ConceptCanvasTargetKind, PlotPickleProject } from "./project";

export type CreativeCandidateMediaType = "text" | "image" | "video" | "audio";
export type CreativeCandidateStatus = "ready" | "failed" | "cancelled" | "shortlisted" | "rejected";
export type CreativeCandidateSourceKind = "generated" | "imported" | "manual";

export type CreativeCandidateTarget = {
  kind: ConceptCanvasTargetKind;
  id: string;
  label: string;
};

export type CreativeCandidateLineage = {
  parentCandidateId: string;
  retryOfCandidateId: string;
  derivedFromCandidateIds: string[];
};

export type CreativeCandidateSource = {
  kind: CreativeCandidateSourceKind;
  label: string;
  routeId: string;
};

export type CreativeCandidatePayload = {
  text: string;
  assetRef: string;
  previewRef: string;
};

export type CreativeExplorationCandidate = {
  id: string;
  mediaType: CreativeCandidateMediaType;
  status: CreativeCandidateStatus;
  canonStatus: "candidate";
  target: CreativeCandidateTarget;
  source: CreativeCandidateSource;
  lineage: CreativeCandidateLineage;
  payload: CreativeCandidatePayload;
  directionSummary: string;
  failureMessage: string;
  createdAt: string;
  updatedAt: string;
};

export type CreativeCandidateStore = {
  version: 1;
  candidates: CreativeExplorationCandidate[];
};

export type CreateCreativeCandidateInput = {
  id?: string;
  mediaType: CreativeCandidateMediaType;
  status?: CreativeCandidateStatus;
  target: CreativeCandidateTarget;
  source?: Partial<CreativeCandidateSource>;
  lineage?: Partial<CreativeCandidateLineage>;
  payload?: Partial<CreativeCandidatePayload>;
  directionSummary?: string;
  failureMessage?: string;
  createdAt?: string;
};

const EXTENSION_KEY = "creativeExploration";
const MEDIA_TYPES: CreativeCandidateMediaType[] = ["text", "image", "video", "audio"];
const STATUSES: CreativeCandidateStatus[] = ["ready", "failed", "cancelled", "shortlisted", "rejected"];
const SOURCE_KINDS: CreativeCandidateSourceKind[] = ["generated", "imported", "manual"];
const TARGET_KINDS: ConceptCanvasTargetKind[] = ["project", "character", "location", "block", "mini-block", "scene"];

function text(value: unknown) {
  return typeof value === "string" ? value : "";
}

function stringList(value: unknown) {
  return Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === "string" && Boolean(item)))] : [];
}

function objectValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function safeRouteId(value: unknown) {
  const route = text(value).trim();
  if (!route) return "";
  if (/https?:\/\/|api[_-]?key|token|secret|password|credential/i.test(route)) return "";
  return route.slice(0, 120);
}

export function normalizeCreativeCandidate(value: unknown, index = 0): CreativeExplorationCandidate | null {
  const candidate = objectValue(value);
  if (!Object.keys(candidate).length) return null;
  const target = objectValue(candidate.target);
  const source = objectValue(candidate.source);
  const lineage = objectValue(candidate.lineage);
  const payload = objectValue(candidate.payload);
  const createdAt = text(candidate.createdAt) || new Date().toISOString();
  const mediaType = MEDIA_TYPES.includes(candidate.mediaType as CreativeCandidateMediaType)
    ? candidate.mediaType as CreativeCandidateMediaType
    : "text";
  const status = STATUSES.includes(candidate.status as CreativeCandidateStatus)
    ? candidate.status as CreativeCandidateStatus
    : "ready";
  const targetKind = TARGET_KINDS.includes(target.kind as ConceptCanvasTargetKind)
    ? target.kind as ConceptCanvasTargetKind
    : "project";
  const sourceKind = SOURCE_KINDS.includes(source.kind as CreativeCandidateSourceKind)
    ? source.kind as CreativeCandidateSourceKind
    : "manual";

  return {
    id: text(candidate.id) || `creative-candidate-${index + 1}`,
    mediaType,
    status,
    canonStatus: "candidate",
    target: {
      kind: targetKind,
      id: text(target.id) || "project",
      label: text(target.label) || "Whole project",
    },
    source: {
      kind: sourceKind,
      label: text(source.label),
      routeId: safeRouteId(source.routeId),
    },
    lineage: {
      parentCandidateId: text(lineage.parentCandidateId),
      retryOfCandidateId: text(lineage.retryOfCandidateId),
      derivedFromCandidateIds: stringList(lineage.derivedFromCandidateIds),
    },
    payload: {
      text: text(payload.text),
      assetRef: text(payload.assetRef),
      previewRef: text(payload.previewRef),
    },
    directionSummary: text(candidate.directionSummary),
    failureMessage: status === "failed" ? text(candidate.failureMessage) : "",
    createdAt,
    updatedAt: text(candidate.updatedAt) || createdAt,
  };
}

export function readCreativeCandidateStore(project: PlotPickleProject): CreativeCandidateStore {
  const extensions = objectValue(project.extensions);
  const rawStore = objectValue(extensions[EXTENSION_KEY]);
  const rawCandidates = Array.isArray(rawStore.candidates) ? rawStore.candidates : [];
  return {
    version: 1,
    candidates: rawCandidates.flatMap((candidate, index) => {
      const normalized = normalizeCreativeCandidate(candidate, index);
      return normalized ? [normalized] : [];
    }),
  };
}

export function createCreativeCandidate(input: CreateCreativeCandidateInput): CreativeExplorationCandidate {
  const now = input.createdAt || new Date().toISOString();
  const id = input.id || `creative-candidate-${now.replace(/[^0-9]/g, "")}-${Math.random().toString(36).slice(2, 8)}`;
  return normalizeCreativeCandidate({
    id,
    mediaType: input.mediaType,
    status: input.status || "ready",
    canonStatus: "candidate",
    target: input.target,
    source: {
      kind: input.source?.kind || "manual",
      label: input.source?.label || "",
      routeId: input.source?.routeId || "",
    },
    lineage: {
      parentCandidateId: input.lineage?.parentCandidateId || "",
      retryOfCandidateId: input.lineage?.retryOfCandidateId || "",
      derivedFromCandidateIds: input.lineage?.derivedFromCandidateIds || [],
    },
    payload: {
      text: input.payload?.text || "",
      assetRef: input.payload?.assetRef || "",
      previewRef: input.payload?.previewRef || "",
    },
    directionSummary: input.directionSummary || "",
    failureMessage: input.failureMessage || "",
    createdAt: now,
    updatedAt: now,
  }) as CreativeExplorationCandidate;
}

export function appendCreativeCandidate(project: PlotPickleProject, candidate: CreativeExplorationCandidate): PlotPickleProject {
  const current = readCreativeCandidateStore(project);
  const normalized = normalizeCreativeCandidate(candidate, current.candidates.length);
  if (!normalized) return project;
  const extensions = objectValue(project.extensions);
  return {
    ...project,
    extensions: {
      ...extensions,
      [EXTENSION_KEY]: {
        version: 1,
        candidates: [...current.candidates, normalized],
      },
    },
  };
}

export function updateCreativeCandidateStatus(
  project: PlotPickleProject,
  candidateId: string,
  status: CreativeCandidateStatus,
  failureMessage = "",
  updatedAt = new Date().toISOString(),
): PlotPickleProject {
  const current = readCreativeCandidateStore(project);
  const extensions = objectValue(project.extensions);
  return {
    ...project,
    extensions: {
      ...extensions,
      [EXTENSION_KEY]: {
        version: 1,
        candidates: current.candidates.map((candidate) => candidate.id === candidateId ? {
          ...candidate,
          status,
          canonStatus: "candidate" as const,
          failureMessage: status === "failed" ? failureMessage : "",
          updatedAt,
        } : candidate),
      },
    },
  };
}

export function createRetryCandidate(
  sourceCandidate: CreativeExplorationCandidate,
  input: Omit<CreateCreativeCandidateInput, "mediaType" | "target" | "lineage"> = {},
): CreativeExplorationCandidate {
  return createCreativeCandidate({
    ...input,
    mediaType: sourceCandidate.mediaType,
    target: sourceCandidate.target,
    source: input.source || sourceCandidate.source,
    lineage: {
      parentCandidateId: sourceCandidate.id,
      retryOfCandidateId: sourceCandidate.id,
      derivedFromCandidateIds: [sourceCandidate.id],
    },
  });
}

export function candidatesForTarget(project: PlotPickleProject, target: CreativeCandidateTarget) {
  return readCreativeCandidateStore(project).candidates.filter((candidate) =>
    candidate.target.kind === target.kind && candidate.target.id === target.id,
  );
}
