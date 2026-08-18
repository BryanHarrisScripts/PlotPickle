import { cloneProject, type PlotPickleProject } from "./project";

export const PPF_REVISION_EXTENSION_KEY = "plotpickleCanonicalRevision" as const;
export const PPF_REVISION_HISTORY_LIMIT = 250;

export type CanonicalRevisionId = string;
export type CreativeProposalStatus = "open" | "accepted" | "rejected" | "stale" | "rebased";
export type CreativeProposalOrigin = "writer" | "agent" | "system" | "federated" | "memory" | "writer-adopted";
export type CreativeProposalKind = "story" | "asset" | "foundations" | "screenplay" | "structure" | "visual" | "other";

export type CreativeGenerationProvenance = {
  readonly modelRole?: "fast" | "quality" | "deep" | "vision" | "repair";
  readonly provider?: string;
  readonly model?: string;
  readonly route?: string;
  readonly requestFingerprint?: string;
};

export type CreativeProposalRecord = {
  readonly id: string;
  readonly kind: CreativeProposalKind;
  readonly baseRevision: CanonicalRevisionId;
  readonly targetIds: readonly string[];
  readonly proposingProfileId: string;
  readonly skillUri?: string;
  readonly runId: string;
  readonly generation?: CreativeGenerationProvenance;
  readonly contextSourceIds: readonly string[];
  readonly generatedAt: string;
  readonly status: CreativeProposalStatus;
  readonly origin: CreativeProposalOrigin;
  readonly rebasedFromRevision?: CanonicalRevisionId;
};

export type CanonicalMutationHistoryEntry = {
  readonly revision: CanonicalRevisionId;
  readonly previousRevision: CanonicalRevisionId;
  readonly acceptedAt: string;
  readonly acceptedBy: "writer";
  readonly proposalId: string;
  readonly kind: CreativeProposalKind;
  readonly targetIds: readonly string[];
  readonly proposingProfileId: string;
  readonly skillUri?: string;
  readonly runId: string;
  readonly generation?: CreativeGenerationProvenance;
  readonly contextSourceIds: readonly string[];
};

export type CanonicalRevisionState = {
  readonly version: 1;
  readonly revisionNumber: number;
  readonly revision: CanonicalRevisionId;
  readonly updatedAt: string;
  readonly history: readonly CanonicalMutationHistoryEntry[];
};

export type CreativeAssetProvenance = {
  readonly proposalId: string;
  readonly generatingProfileId: string;
  readonly runId: string;
  readonly route: string;
  readonly modelRole?: CreativeGenerationProvenance["modelRole"];
  readonly provider?: string;
  readonly model?: string;
  readonly requestFingerprint?: string;
  readonly sourcePpfRevision: CanonicalRevisionId;
  readonly contextSourceIds: readonly string[];
  readonly acceptanceState: "candidate" | "accepted" | "rejected" | "stale";
};

function clean(value: unknown, maximum = 300) {
  return typeof value === "string" ? value.replace(/[\u0000\r]/g, "").trim().slice(0, maximum) : "";
}

function cleanList(values: readonly string[] | undefined, maximumItems = 100) {
  if (!Array.isArray(values)) return [];
  return [...new Set(values.map((value) => clean(value, 240)).filter(Boolean))].slice(0, maximumItems);
}

function safeGeneration(value: CreativeGenerationProvenance | undefined): CreativeGenerationProvenance | undefined {
  if (!value) return undefined;
  const provider = clean(value.provider, 120);
  const model = clean(value.model, 160);
  const route = clean(value.route, 160);
  const requestFingerprint = clean(value.requestFingerprint, 160);
  const safe: CreativeGenerationProvenance = {
    ...(value.modelRole ? { modelRole: value.modelRole } : {}),
    ...(provider ? { provider } : {}),
    ...(model ? { model } : {}),
    ...(route ? { route } : {}),
    ...(requestFingerprint ? { requestFingerprint } : {}),
  };
  return Object.keys(safe).length ? safe : undefined;
}

function extensionRecord(project: PlotPickleProject) {
  const extensions = project.extensions && typeof project.extensions === "object" ? project.extensions : {};
  const candidate = extensions[PPF_REVISION_EXTENSION_KEY];
  if (!candidate || typeof candidate !== "object") return null;
  return candidate as Partial<CanonicalRevisionState>;
}

export function canonicalRevisionId(projectId: string, revisionNumber: number): CanonicalRevisionId {
  const id = clean(projectId, 160) || "project";
  return `${id}:ppf:r${String(Math.max(1, Math.floor(revisionNumber))).padStart(6, "0")}`;
}

export function projectCanonicalRevisionState(project: PlotPickleProject): CanonicalRevisionState {
  const candidate = extensionRecord(project);
  const revisionNumber = Number.isFinite(candidate?.revisionNumber) && Number(candidate?.revisionNumber) >= 1
    ? Math.floor(Number(candidate?.revisionNumber))
    : 1;
  const expectedRevision = canonicalRevisionId(project.id, revisionNumber);
  const history = Array.isArray(candidate?.history)
    ? (candidate.history as CanonicalMutationHistoryEntry[]).slice(-PPF_REVISION_HISTORY_LIMIT)
    : [];
  return {
    version: 1,
    revisionNumber,
    revision: typeof candidate?.revision === "string" && candidate.revision === expectedRevision ? candidate.revision : expectedRevision,
    updatedAt: typeof candidate?.updatedAt === "string" && candidate.updatedAt ? candidate.updatedAt : project.metadata.updatedAt,
    history,
  };
}

export function projectCanonicalRevision(project: PlotPickleProject) {
  return projectCanonicalRevisionState(project).revision;
}

export function withCanonicalRevisionState(project: PlotPickleProject, state = projectCanonicalRevisionState(project)) {
  const next = cloneProject(project);
  next.extensions = {
    ...(next.extensions || {}),
    [PPF_REVISION_EXTENSION_KEY]: state,
  };
  return next;
}

export function createCreativeProposal(input: {
  readonly id: string;
  readonly kind: CreativeProposalKind;
  readonly project: PlotPickleProject;
  readonly targetIds: readonly string[];
  readonly proposingProfileId: string;
  readonly skillUri?: string;
  readonly runId: string;
  readonly generation?: CreativeGenerationProvenance;
  readonly contextSourceIds?: readonly string[];
  readonly generatedAt?: string;
  readonly origin?: CreativeProposalOrigin;
}): CreativeProposalRecord {
  const id = clean(input.id, 160);
  const proposingProfileId = clean(input.proposingProfileId, 160);
  const runId = clean(input.runId, 180);
  if (!id || !proposingProfileId || !runId) throw new Error("Creative proposals require an id, proposing profile and run id.");
  return {
    id,
    kind: input.kind,
    baseRevision: projectCanonicalRevision(input.project),
    targetIds: cleanList(input.targetIds),
    proposingProfileId,
    ...(input.skillUri ? { skillUri: clean(input.skillUri, 240) } : {}),
    runId,
    ...(safeGeneration(input.generation) ? { generation: safeGeneration(input.generation) } : {}),
    contextSourceIds: cleanList(input.contextSourceIds),
    generatedAt: input.generatedAt || new Date().toISOString(),
    status: "open",
    origin: input.origin || "agent",
  };
}

function nextRevisionState(project: PlotPickleProject, proposal: CreativeProposalRecord, acceptedAt: string): CanonicalRevisionState {
  const current = projectCanonicalRevisionState(project);
  const revisionNumber = current.revisionNumber + 1;
  const revision = canonicalRevisionId(project.id, revisionNumber);
  const entry: CanonicalMutationHistoryEntry = {
    revision,
    previousRevision: current.revision,
    acceptedAt,
    acceptedBy: "writer",
    proposalId: proposal.id,
    kind: proposal.kind,
    targetIds: cleanList(proposal.targetIds),
    proposingProfileId: clean(proposal.proposingProfileId, 160),
    ...(proposal.skillUri ? { skillUri: clean(proposal.skillUri, 240) } : {}),
    runId: clean(proposal.runId, 180),
    ...(safeGeneration(proposal.generation) ? { generation: safeGeneration(proposal.generation) } : {}),
    contextSourceIds: cleanList(proposal.contextSourceIds),
  };
  return {
    version: 1,
    revisionNumber,
    revision,
    updatedAt: acceptedAt,
    history: [...current.history, entry].slice(-PPF_REVISION_HISTORY_LIMIT),
  };
}

export function applyRevisionAwareProposal(input: {
  readonly project: PlotPickleProject;
  readonly proposal: CreativeProposalRecord;
  readonly approvedBy: "writer";
  readonly mutate: (project: PlotPickleProject) => PlotPickleProject;
  readonly acceptedAt?: string;
}) {
  if (input.approvedBy !== "writer") throw new Error("Creative canon changes require explicit writer approval.");
  if (input.proposal.status !== "open" && input.proposal.status !== "rebased") {
    return { applied: false as const, reason: "proposal-not-open" as const, project: input.project, proposal: input.proposal };
  }
  if (input.proposal.origin === "federated" || input.proposal.origin === "memory") {
    return { applied: false as const, reason: "untrusted-origin-requires-writer-adoption" as const, project: input.project, proposal: input.proposal };
  }
  const currentRevision = projectCanonicalRevision(input.project);
  if (input.proposal.baseRevision !== currentRevision) {
    return {
      applied: false as const,
      reason: "stale-revision" as const,
      project: input.project,
      proposal: { ...input.proposal, status: "stale" as const },
      currentRevision,
    };
  }

  const acceptedAt = input.acceptedAt || new Date().toISOString();
  const candidate = input.mutate(cloneProject(input.project));
  const state = nextRevisionState(input.project, input.proposal, acceptedAt);
  const next = withCanonicalRevisionState(candidate, state);
  next.metadata = { ...next.metadata, updatedAt: acceptedAt };
  return {
    applied: true as const,
    reason: "accepted" as const,
    project: next,
    proposal: { ...input.proposal, status: "accepted" as const },
    previousRevision: input.proposal.baseRevision,
    revision: state.revision,
  };
}

export function rejectCreativeProposal(proposal: CreativeProposalRecord) {
  return { ...proposal, status: "rejected" as const };
}

export function rebaseCreativeProposal(input: {
  readonly proposal: CreativeProposalRecord;
  readonly project: PlotPickleProject;
  readonly writerConfirmed: boolean;
}) {
  if (!input.writerConfirmed) throw new Error("Rebasing a stale creative proposal requires an explicit writer decision.");
  const currentRevision = projectCanonicalRevision(input.project);
  return {
    ...input.proposal,
    baseRevision: currentRevision,
    rebasedFromRevision: input.proposal.baseRevision,
    status: "rebased" as const,
  };
}

export function adoptUntrustedSuggestionAsWriterProposal(proposal: CreativeProposalRecord, writerConfirmed: boolean) {
  if (!writerConfirmed) throw new Error("Federated or memory suggestions require explicit writer adoption before they can become a creative proposal.");
  return {
    ...proposal,
    origin: "writer-adopted" as const,
    status: "open" as const,
  };
}

export function assetProvenanceFromProposal(proposal: CreativeProposalRecord): CreativeAssetProvenance {
  const state = proposal.status === "accepted" ? "accepted" : proposal.status === "rejected" ? "rejected" : proposal.status === "stale" ? "stale" : "candidate";
  return {
    proposalId: proposal.id,
    generatingProfileId: proposal.proposingProfileId,
    runId: proposal.runId,
    route: proposal.generation?.route || "",
    ...(proposal.generation?.modelRole ? { modelRole: proposal.generation.modelRole } : {}),
    ...(proposal.generation?.provider ? { provider: proposal.generation.provider } : {}),
    ...(proposal.generation?.model ? { model: proposal.generation.model } : {}),
    ...(proposal.generation?.requestFingerprint ? { requestFingerprint: proposal.generation.requestFingerprint } : {}),
    sourcePpfRevision: proposal.baseRevision,
    contextSourceIds: cleanList(proposal.contextSourceIds),
    acceptanceState: state,
  };
}

export function revisionHistory(project: PlotPickleProject) {
  return projectCanonicalRevisionState(project).history;
}
