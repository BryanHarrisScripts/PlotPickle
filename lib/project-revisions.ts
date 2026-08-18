import type { ContextReceipt } from "./context-engine";
import { cloneProject, type PlotPickleProject } from "./project";

export const PROJECT_REVISION_EXTENSION_KEY = "canonicalRevision" as const;
export const PROJECT_REVISION_VERSION = 1 as const;

export type CanonicalProposalKind = "story" | "field" | "screenplay" | "asset" | "other";
export type CanonicalProposalStatus = "pending" | "accepted" | "rejected" | "stale" | "rebased" | "superseded";
export type CanonicalProposalSourceKind = "plotpickle-agent" | "writer" | "system" | "buzz-peer" | "project-memory" | "external";

export type CanonicalGenerationProvenance = {
  capabilityRole: string;
  runtime: string;
  provider: string;
  model: string;
  routeId: string;
  promptFingerprint: string;
};

export type CanonicalContextProvenance = {
  taskId: string;
  profileId: string;
  generatedAt: string;
  sourceIds: string[];
  sourceRevisions: Array<{ sourceId: string; revision: string }>;
};

export type CanonicalProposalRecord = {
  id: string;
  kind: CanonicalProposalKind;
  status: CanonicalProposalStatus;
  baseRevision: number;
  targetIds: string[];
  profileId: string;
  skillUri: string;
  runId: string;
  sourceKind: CanonicalProposalSourceKind;
  contentFingerprint: string;
  safeSummary: string;
  generation: CanonicalGenerationProvenance | null;
  context: CanonicalContextProvenance | null;
  generatedAt: string;
  updatedAt: string;
  staleAt: string;
  rejectedAt: string;
  rebasedAt: string;
  rebasedFromRevision: number | null;
  appliedRevision: number | null;
};

export type CanonicalRevisionRecord = {
  id: string;
  revision: number;
  previousRevision: number;
  proposalId: string;
  targetIds: string[];
  writerId: string;
  acceptedAt: string;
  safeSummary: string;
};

export type CanonicalRevisionStore = {
  version: typeof PROJECT_REVISION_VERSION;
  currentRevision: number;
  proposals: CanonicalProposalRecord[];
  history: CanonicalRevisionRecord[];
};

export type WriterApproval = {
  kind: "writer";
  writerId: string;
  approvedAt?: string;
  note?: string;
};

export type CreateCanonicalProposalInput = {
  id?: string;
  kind: CanonicalProposalKind;
  targetIds: string[];
  profileId: string;
  skillUri?: string;
  runId?: string;
  sourceKind?: CanonicalProposalSourceKind;
  contentFingerprint: string;
  safeSummary?: string;
  generation?: Partial<CanonicalGenerationProvenance> | null;
  contextReceipt?: ContextReceipt | null;
  generatedAt?: string;
};

const PROPOSAL_KINDS = new Set<CanonicalProposalKind>(["story", "field", "screenplay", "asset", "other"]);
const PROPOSAL_STATUSES = new Set<CanonicalProposalStatus>(["pending", "accepted", "rejected", "stale", "rebased", "superseded"]);
const PROPOSAL_SOURCE_KINDS = new Set<CanonicalProposalSourceKind>(["plotpickle-agent", "writer", "system", "buzz-peer", "project-memory", "external"]);
const SENSITIVE_TEXT = /(?:api[_-]?key|authorization|bearer\s+|password|private[_-]?key|credential|\bnsec1|-----BEGIN [A-Z ]*PRIVATE KEY-----)/i;

function record(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function text(value: unknown, maximum = 240) {
  const normalized = typeof value === "string" ? value.replace(/\u0000/g, "").trim() : "";
  if (!normalized || SENSITIVE_TEXT.test(normalized)) return "";
  return normalized.slice(0, maximum);
}

function timestamp(value: unknown, fallback = new Date().toISOString()) {
  const candidate = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(candidate) ? new Date(candidate).toISOString() : fallback;
}

function integer(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function stringList(value: unknown) {
  return Array.isArray(value)
    ? [...new Set(value.flatMap((item) => {
      const safe = text(item, 200);
      return safe ? [safe] : [];
    }))]
    : [];
}

function safeFingerprint(value: unknown) {
  const candidate = text(value, 160);
  if (!candidate) return "";
  return /^[a-z0-9][a-z0-9:_-]{7,159}$/i.test(candidate) ? candidate : "";
}

function proposalId(now: string) {
  return `proposal-${now.replace(/[^0-9]/g, "")}-${Math.random().toString(36).slice(2, 8)}`;
}

function safeGeneration(value: unknown): CanonicalGenerationProvenance | null {
  const source = record(value);
  if (!Object.keys(source).length) return null;
  const promptFingerprint = safeFingerprint(source.promptFingerprint);
  return {
    capabilityRole: text(source.capabilityRole, 60),
    runtime: text(source.runtime, 100),
    provider: text(source.provider, 100),
    model: text(source.model, 120),
    routeId: text(source.routeId, 120),
    promptFingerprint,
  };
}

function safeContext(value: unknown): CanonicalContextProvenance | null {
  const source = record(value);
  if (!Object.keys(source).length) return null;
  const revisions = Array.isArray(source.sourceRevisions) ? source.sourceRevisions : [];
  return {
    taskId: text(source.taskId, 160),
    profileId: text(source.profileId, 160),
    generatedAt: timestamp(source.generatedAt),
    sourceIds: stringList(source.sourceIds),
    sourceRevisions: revisions.flatMap((entry) => {
      const item = record(entry);
      const sourceId = text(item.sourceId, 200);
      const revision = text(item.revision, 120);
      return sourceId && revision ? [{ sourceId, revision }] : [];
    }),
  };
}

export function contextProvenanceFromReceipt(receipt: ContextReceipt | null | undefined): CanonicalContextProvenance | null {
  if (!receipt) return null;
  return safeContext({
    taskId: receipt.taskId,
    profileId: receipt.profileId,
    generatedAt: receipt.generatedAt,
    sourceIds: receipt.sources.map((source) => source.id),
    sourceRevisions: receipt.sources.flatMap((source) => source.revision === undefined
      ? []
      : [{ sourceId: source.id, revision: String(source.revision) }]),
  });
}

function normalizeProposal(value: unknown, index: number): CanonicalProposalRecord | null {
  const source = record(value);
  const id = text(source.id, 180) || `proposal-${index + 1}`;
  if (!Object.keys(source).length) return null;
  const kind = PROPOSAL_KINDS.has(source.kind as CanonicalProposalKind) ? source.kind as CanonicalProposalKind : "other";
  const status = PROPOSAL_STATUSES.has(source.status as CanonicalProposalStatus) ? source.status as CanonicalProposalStatus : "pending";
  const sourceKind = PROPOSAL_SOURCE_KINDS.has(source.sourceKind as CanonicalProposalSourceKind)
    ? source.sourceKind as CanonicalProposalSourceKind
    : "external";
  const generatedAt = timestamp(source.generatedAt);
  return {
    id,
    kind,
    status,
    baseRevision: integer(source.baseRevision),
    targetIds: stringList(source.targetIds),
    profileId: text(source.profileId, 160),
    skillUri: text(source.skillUri, 200),
    runId: text(source.runId, 160),
    sourceKind,
    contentFingerprint: safeFingerprint(source.contentFingerprint),
    safeSummary: text(source.safeSummary, 500),
    generation: safeGeneration(source.generation),
    context: safeContext(source.context),
    generatedAt,
    updatedAt: timestamp(source.updatedAt, generatedAt),
    staleAt: text(source.staleAt, 40),
    rejectedAt: text(source.rejectedAt, 40),
    rebasedAt: text(source.rebasedAt, 40),
    rebasedFromRevision: source.rebasedFromRevision === null || source.rebasedFromRevision === undefined
      ? null
      : integer(source.rebasedFromRevision),
    appliedRevision: source.appliedRevision === null || source.appliedRevision === undefined
      ? null
      : integer(source.appliedRevision),
  };
}

function normalizeRevision(value: unknown, index: number): CanonicalRevisionRecord | null {
  const source = record(value);
  if (!Object.keys(source).length) return null;
  const revision = integer(source.revision, index + 1);
  return {
    id: text(source.id, 180) || `revision-${revision}`,
    revision,
    previousRevision: integer(source.previousRevision, Math.max(0, revision - 1)),
    proposalId: text(source.proposalId, 180),
    targetIds: stringList(source.targetIds),
    writerId: text(source.writerId, 160),
    acceptedAt: timestamp(source.acceptedAt),
    safeSummary: text(source.safeSummary, 500),
  };
}

export function readCanonicalRevisionStore(project: PlotPickleProject): CanonicalRevisionStore {
  const extensions = record(project.extensions);
  const source = record(extensions[PROJECT_REVISION_EXTENSION_KEY]);
  const proposals = Array.isArray(source.proposals) ? source.proposals : [];
  const history = Array.isArray(source.history) ? source.history : [];
  return {
    version: PROJECT_REVISION_VERSION,
    currentRevision: integer(source.currentRevision),
    proposals: proposals.flatMap((proposal, index) => {
      const normalized = normalizeProposal(proposal, index);
      return normalized ? [normalized] : [];
    }),
    history: history.flatMap((revision, index) => {
      const normalized = normalizeRevision(revision, index);
      return normalized ? [normalized] : [];
    }),
  };
}

export function currentProjectRevision(project: PlotPickleProject) {
  return readCanonicalRevisionStore(project).currentRevision;
}

function withRevisionStore(project: PlotPickleProject, store: CanonicalRevisionStore): PlotPickleProject {
  return {
    ...project,
    extensions: {
      ...(project.extensions ?? {}),
      [PROJECT_REVISION_EXTENSION_KEY]: store,
    },
  };
}

export function createCanonicalProposal(project: PlotPickleProject, input: CreateCanonicalProposalInput) {
  const current = readCanonicalRevisionStore(project);
  const generatedAt = timestamp(input.generatedAt);
  const fingerprint = safeFingerprint(input.contentFingerprint);
  if (!fingerprint) throw new Error("Canonical proposal contentFingerprint must be a safe opaque digest or fingerprint.");
  const profileId = text(input.profileId, 160);
  if (!profileId) throw new Error("Canonical proposal profileId is required.");
  const proposal: CanonicalProposalRecord = {
    id: text(input.id, 180) || proposalId(generatedAt),
    kind: input.kind,
    status: "pending",
    baseRevision: current.currentRevision,
    targetIds: stringList(input.targetIds),
    profileId,
    skillUri: text(input.skillUri, 200),
    runId: text(input.runId, 160),
    sourceKind: input.sourceKind ?? "plotpickle-agent",
    contentFingerprint: fingerprint,
    safeSummary: text(input.safeSummary, 500),
    generation: safeGeneration(input.generation),
    context: contextProvenanceFromReceipt(input.contextReceipt),
    generatedAt,
    updatedAt: generatedAt,
    staleAt: "",
    rejectedAt: "",
    rebasedAt: "",
    rebasedFromRevision: null,
    appliedRevision: null,
  };
  if (!PROPOSAL_SOURCE_KINDS.has(proposal.sourceKind)) throw new Error(`Unsupported canonical proposal source: ${proposal.sourceKind}.`);
  const next = {
    ...current,
    proposals: [...current.proposals.filter((candidate) => candidate.id !== proposal.id), proposal],
  };
  return { project: withRevisionStore(project, next), proposal };
}

export function canonicalProposalById(project: PlotPickleProject, id: string) {
  return readCanonicalRevisionStore(project).proposals.find((proposal) => proposal.id === id) ?? null;
}

export function canonicalProposalIsCurrent(project: PlotPickleProject, proposal: CanonicalProposalRecord) {
  return proposal.baseRevision === currentProjectRevision(project);
}

function explicitWriterApproval(approval: WriterApproval) {
  if (approval?.kind !== "writer" || !text(approval.writerId, 160)) throw new Error("Explicit writer approval is required for canonical mutation.");
  return {
    writerId: text(approval.writerId, 160),
    approvedAt: timestamp(approval.approvedAt),
    note: text(approval.note, 500),
  };
}

export function rejectCanonicalProposal(project: PlotPickleProject, proposalIdValue: string, approval: WriterApproval): PlotPickleProject {
  const writer = explicitWriterApproval(approval);
  const store = readCanonicalRevisionStore(project);
  const found = store.proposals.find((proposal) => proposal.id === proposalIdValue);
  if (!found) throw new Error(`Canonical proposal ${proposalIdValue} was not found.`);
  const proposals = store.proposals.map((proposal) => proposal.id === found.id ? {
    ...proposal,
    status: "rejected" as const,
    rejectedAt: writer.approvedAt,
    updatedAt: writer.approvedAt,
  } : proposal);
  return withRevisionStore(project, { ...store, proposals });
}

export function rebaseCanonicalProposal(project: PlotPickleProject, proposalIdValue: string, approval: WriterApproval): PlotPickleProject {
  const writer = explicitWriterApproval(approval);
  const store = readCanonicalRevisionStore(project);
  const found = store.proposals.find((proposal) => proposal.id === proposalIdValue);
  if (!found) throw new Error(`Canonical proposal ${proposalIdValue} was not found.`);
  if (found.status === "accepted" || found.status === "rejected" || found.status === "superseded") {
    throw new Error(`Canonical proposal ${proposalIdValue} cannot be rebased from ${found.status}.`);
  }
  const proposals = store.proposals.map((proposal) => proposal.id === found.id ? {
    ...proposal,
    baseRevision: store.currentRevision,
    status: "rebased" as const,
    rebasedFromRevision: found.baseRevision,
    rebasedAt: writer.approvedAt,
    updatedAt: writer.approvedAt,
  } : proposal);
  return withRevisionStore(project, { ...store, proposals });
}

export type ApplyCanonicalProposalResult =
  | { ok: true; project: PlotPickleProject; proposal: CanonicalProposalRecord; revision: CanonicalRevisionRecord }
  | { ok: false; project: PlotPickleProject; proposal: CanonicalProposalRecord; reason: "stale-revision" | "not-pending" };

export function applyWriterApprovedCanonicalProposal(input: {
  project: PlotPickleProject;
  proposalId: string;
  approvedProject: PlotPickleProject;
  approval: WriterApproval;
}): ApplyCanonicalProposalResult {
  const writer = explicitWriterApproval(input.approval);
  if (input.project.id !== input.approvedProject.id) throw new Error("Canonical proposal cannot apply to a different PlotPickle project.");

  const store = readCanonicalRevisionStore(input.project);
  const found = store.proposals.find((proposal) => proposal.id === input.proposalId);
  if (!found) throw new Error(`Canonical proposal ${input.proposalId} was not found.`);
  if (found.status !== "pending" && found.status !== "rebased") {
    return { ok: false, project: input.project, proposal: found, reason: "not-pending" };
  }
  if (found.baseRevision !== store.currentRevision) {
    const staleAt = writer.approvedAt;
    const stale = { ...found, status: "stale" as const, staleAt, updatedAt: staleAt };
    const staleStore = {
      ...store,
      proposals: store.proposals.map((proposal) => proposal.id === found.id ? stale : proposal),
    };
    return { ok: false, project: withRevisionStore(input.project, staleStore), proposal: stale, reason: "stale-revision" };
  }

  const nextRevision = store.currentRevision + 1;
  const accepted = {
    ...found,
    status: "accepted" as const,
    appliedRevision: nextRevision,
    updatedAt: writer.approvedAt,
  };
  const revision: CanonicalRevisionRecord = {
    id: `revision-${nextRevision}`,
    revision: nextRevision,
    previousRevision: store.currentRevision,
    proposalId: accepted.id,
    targetIds: accepted.targetIds,
    writerId: writer.writerId,
    acceptedAt: writer.approvedAt,
    safeSummary: writer.note || accepted.safeSummary,
  };
  const nextStore: CanonicalRevisionStore = {
    version: PROJECT_REVISION_VERSION,
    currentRevision: nextRevision,
    proposals: store.proposals.map((proposal) => proposal.id === accepted.id ? accepted : proposal),
    history: [...store.history, revision],
  };
  const approved = cloneProject(input.approvedProject);
  approved.metadata = { ...approved.metadata, updatedAt: writer.approvedAt };
  approved.extensions = {
    ...(input.project.extensions ?? {}),
    ...(approved.extensions ?? {}),
    [PROJECT_REVISION_EXTENSION_KEY]: nextStore,
  };
  return { ok: true, project: approved, proposal: accepted, revision };
}

export function markStaleCanonicalProposals(project: PlotPickleProject, at = new Date().toISOString()) {
  const store = readCanonicalRevisionStore(project);
  const staleAt = timestamp(at);
  const proposals = store.proposals.map((proposal) =>
    (proposal.status === "pending" || proposal.status === "rebased") && proposal.baseRevision !== store.currentRevision
      ? { ...proposal, status: "stale" as const, staleAt, updatedAt: staleAt }
      : proposal,
  );
  return withRevisionStore(project, { ...store, proposals });
}
