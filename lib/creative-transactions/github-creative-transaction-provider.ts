import {
  CREATIVE_TRANSACTION_CONTRACT_VERSION,
  creativeTransactionVerificationComplete,
  providerSupportsCapabilities,
  type CreativeChange,
  type CreativeChangeSet,
  type CreativeReviewDecision,
  type CreativeTransactionProvider,
  type CreativeTransactionProviderDescriptor,
  type CreativeTransactionReconciliation,
  type CreativeTransactionRecord,
  type CreativeVerificationEvidence,
} from "./creative-transaction-contract";

export type GitHubProposalState = "missing" | "open" | "approved" | "declined" | "committed" | "changed" | "unavailable" | "unknown";

export type GitHubProposalReceipt = {
  providerTransactionId: string;
  reviewRef: string;
  baseRevisionId: string;
  proposedRevisionId: string;
};

export type GitHubProposalInspection = {
  state: GitHubProposalState;
  durableRevisionId: string;
  summary: string;
};

export interface GitHubCreativeTransactionBridge {
  createProposal(input: { changeSet: CreativeChangeSet; artifactRefs: readonly string[] }): Promise<GitHubProposalReceipt>;
  inspectProposal(providerTransactionId: string): Promise<GitHubProposalInspection>;
  commitApprovedProposal(input: { providerTransactionId: string; writerId: string; note: string }): Promise<{ durableRevisionId: string }>;
  declineProposal(input: { providerTransactionId: string; writerId: string; note: string }): Promise<void>;
  requestRevision?(input: { providerTransactionId: string; writerId: string; note: string }): Promise<void>;
  rollbackCommittedProposal?(input: { providerTransactionId: string; durableRevisionId: string; writerId: string; note: string }): Promise<{ durableRevisionId: string }>;
}

export interface GitHubCreativeTransactionStore {
  load(transactionId: string): Promise<CreativeTransactionRecord | null>;
  save(record: CreativeTransactionRecord): Promise<void>;
}

export const GITHUB_CREATIVE_TRANSACTION_PROVIDER: CreativeTransactionProviderDescriptor = {
  id: "github-story-proposals",
  kind: "external",
  label: "GitHub Story Proposals",
  transport: "rest",
  capabilities: ["durable-revision", "diff", "verification", "human-review", "recovery", "reconcile", "artifact-storage", "collaboration", "remote"],
  priority: 50,
};

function descriptorFor(bridge: GitHubCreativeTransactionBridge): CreativeTransactionProviderDescriptor {
  return bridge.rollbackCommittedProposal
    ? { ...GITHUB_CREATIVE_TRANSACTION_PROVIDER, capabilities: [...GITHUB_CREATIVE_TRANSACTION_PROVIDER.capabilities, "rollback"] }
    : GITHUB_CREATIVE_TRANSACTION_PROVIDER;
}

function now(value?: string) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function text(value: unknown, maximum = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function unique(values: readonly string[], maximum = 512) {
  return [...new Set(values.map((value) => text(value, 500)).filter(Boolean))].slice(0, maximum);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function transactionId(changeSet: CreativeChangeSet) {
  return `github-${changeSet.projectId}-${changeSet.changeSetId}`.slice(0, 220);
}

function externalTransactionId(record: CreativeTransactionRecord) {
  return record.changeSet.transaction?.providerId === GITHUB_CREATIVE_TRANSACTION_PROVIDER.id
    ? text(record.changeSet.transaction.transactionId, 220)
    : "";
}

function withProviderTransaction(record: CreativeTransactionRecord, providerTransactionId: string, durableRevisionId = "") {
  return {
    ...record.changeSet,
    transaction: {
      providerId: GITHUB_CREATIVE_TRANSACTION_PROVIDER.id,
      transactionId: text(providerTransactionId, 220),
      durableRevisionId: text(durableRevisionId, 220),
    },
  };
}

function assertState(record: CreativeTransactionRecord, allowed: readonly CreativeTransactionRecord["state"][], operation: string) {
  if (!allowed.includes(record.state)) throw new Error(`Creative Transaction ${operation} is not allowed while ${record.state}.`);
}

async function required(store: GitHubCreativeTransactionStore, id: string) {
  const record = await store.load(id);
  if (!record) throw new Error(`Creative Transaction ${id} was not found.`);
  return record;
}

async function save(store: GitHubCreativeTransactionStore, record: CreativeTransactionRecord) {
  await store.save(record);
  return clone(record);
}

function normalizeEvidence(evidence: readonly CreativeVerificationEvidence[]) {
  return evidence.map((item) => ({
    ...item,
    requirementId: text(item.requirementId, 160),
    evidenceRef: text(item.evidenceRef, 500),
    summary: text(item.summary, 800),
    recordedAt: now(item.recordedAt),
  })) satisfies CreativeVerificationEvidence[];
}

function unknown(record: CreativeTransactionRecord, summary: string, authoritative = false): CreativeTransactionReconciliation {
  return {
    transactionId: record.transactionId,
    providerId: record.providerId,
    state: "unknown",
    durableRevisionId: record.durableRevisionId,
    recoverable: true,
    evidenceComplete: creativeTransactionVerificationComplete(record.changeSet, record.verificationEvidence),
    authoritative,
    summary,
  };
}

async function reconcileRecord(bridge: GitHubCreativeTransactionBridge, record: CreativeTransactionRecord): Promise<CreativeTransactionReconciliation> {
  const providerId = externalTransactionId(record);
  if (!providerId) return unknown(record, "No external transaction identity has been established. PlotPickle will not infer provider success.");
  let inspection: GitHubProposalInspection;
  try {
    inspection = await bridge.inspectProposal(providerId);
  } catch (error) {
    return unknown(record, error instanceof Error ? `GitHub provider state is unavailable: ${error.message}` : "GitHub provider state is unavailable.");
  }
  if (inspection.state === "unavailable" || inspection.state === "unknown") {
    return unknown(record, inspection.summary || "GitHub provider state is ambiguous; PlotPickle will not infer success.");
  }
  if (inspection.state === "missing" || inspection.state === "changed") {
    return unknown(record, inspection.summary || "GitHub provider state no longer matches the transaction. Review is required before recovery continues.", true);
  }
  const state = inspection.state === "committed"
    ? "committed"
    : inspection.state === "declined"
      ? "rejected"
      : inspection.state === "approved"
        ? "approved"
        : "awaiting-review";
  const durableRevisionId = text(inspection.durableRevisionId, 220) || record.durableRevisionId;
  return {
    transactionId: record.transactionId,
    providerId: record.providerId,
    state,
    durableRevisionId,
    recoverable: state !== "rejected",
    evidenceComplete: creativeTransactionVerificationComplete(record.changeSet, record.verificationEvidence),
    authoritative: state !== "committed" || Boolean(durableRevisionId),
    summary: inspection.summary || `GitHub provider reports ${inspection.state}.`,
  };
}

export function createGitHubCreativeTransactionProvider(store: GitHubCreativeTransactionStore, bridge: GitHubCreativeTransactionBridge): CreativeTransactionProvider {
  const descriptor = descriptorFor(bridge);
  return {
    descriptor,

    async create(changeSet) {
      if (!providerSupportsCapabilities(descriptor, changeSet.requiredCapabilities)) {
        throw new Error("GitHub Story Proposals do not satisfy the Creative Change Set capability requirements.");
      }
      const id = transactionId(changeSet);
      const existing = await store.load(id);
      if (existing) return clone(existing);
      const createdAt = now(changeSet.createdAt);
      return save(store, {
        version: CREATIVE_TRANSACTION_CONTRACT_VERSION,
        transactionId: id,
        providerId: descriptor.id,
        changeSet: clone(changeSet),
        state: "created",
        stagedArtifactRefs: [],
        verificationEvidence: [],
        review: clone(changeSet.review),
        durableRevisionId: "",
        recoverable: true,
        rollbackOfRevisionId: "",
        error: "",
        createdAt,
        updatedAt: createdAt,
      });
    },

    async stage(id, artifactRefs) {
      const record = await required(store, id);
      assertState(record, ["created", "revising"], "stage");
      return save(store, {
        ...record,
        state: "staged",
        stagedArtifactRefs: unique(artifactRefs),
        verificationEvidence: [],
        review: { status: "pending", writerId: "", note: "", decidedAt: "" },
        changeSet: { ...record.changeSet, transaction: null },
        durableRevisionId: "",
        error: "",
        updatedAt: now(),
      });
    },

    async diff(id): Promise<readonly CreativeChange[]> {
      return clone((await required(store, id)).changeSet.changes);
    },

    async verify(id, evidence) {
      const record = await required(store, id);
      assertState(record, ["staged", "revising"], "verify");
      const normalized = normalizeEvidence(evidence);
      const complete = creativeTransactionVerificationComplete(record.changeSet, normalized);
      return save(store, {
        ...record,
        state: complete ? "verified" : "revising",
        verificationEvidence: normalized,
        error: complete ? "" : "Blocking verification is incomplete or failed; revise and verify again before review.",
        updatedAt: now(),
      });
    },

    async requestReview(id) {
      const record = await required(store, id);
      assertState(record, ["verified"], "request review");
      if (!creativeTransactionVerificationComplete(record.changeSet, record.verificationEvidence)) {
        throw new Error("Creative Transaction cannot request review before blocking verification passes.");
      }
      const receipt = await bridge.createProposal({ changeSet: clone(record.changeSet), artifactRefs: record.stagedArtifactRefs });
      const providerId = text(receipt.providerTransactionId, 220);
      if (!providerId) throw new Error("GitHub did not return a provider transaction identity.");
      return save(store, {
        ...record,
        state: "awaiting-review",
        changeSet: withProviderTransaction(record, providerId),
        updatedAt: now(),
      });
    },

    async accept(id, decision) {
      const record = await required(store, id);
      assertState(record, ["awaiting-review"], "accept");
      const writerId = text(decision.writerId, 180);
      if (!writerId) throw new Error("Writer identity is required to accept a Creative Transaction.");
      const review: CreativeReviewDecision = { status: "accepted", writerId, note: text(decision.note, 800), decidedAt: now(decision.decidedAt) };
      return save(store, { ...record, state: "approved", review, updatedAt: review.decidedAt });
    },

    async reject(id, decision) {
      const record = await required(store, id);
      assertState(record, ["awaiting-review"], "reject");
      const writerId = text(decision.writerId, 180);
      if (!writerId) throw new Error("Writer identity is required to reject a Creative Transaction.");
      const providerId = externalTransactionId(record);
      if (providerId) await bridge.declineProposal({ providerTransactionId: providerId, writerId, note: text(decision.note, 800) });
      const review: CreativeReviewDecision = { status: "rejected", writerId, note: text(decision.note, 800), decidedAt: now(decision.decidedAt) };
      return save(store, { ...record, state: "rejected", review, updatedAt: review.decidedAt });
    },

    async revise(id, decision) {
      const record = await required(store, id);
      assertState(record, ["awaiting-review", "rejected"], "revise");
      const writerId = text(decision.writerId, 180);
      if (!writerId) throw new Error("Writer identity is required to request Creative Transaction revision.");
      const providerId = externalTransactionId(record);
      if (providerId && bridge.requestRevision) {
        await bridge.requestRevision({ providerTransactionId: providerId, writerId, note: text(decision.note, 800) });
      } else if (providerId) {
        await bridge.declineProposal({ providerTransactionId: providerId, writerId, note: text(decision.note, 800) || "Revision requested; supersede this proposal with a revised transaction." });
      }
      const review: CreativeReviewDecision = { status: "revise", writerId, note: text(decision.note, 800), decidedAt: now(decision.decidedAt) };
      return save(store, {
        ...record,
        state: "revising",
        review,
        changeSet: { ...record.changeSet, transaction: null },
        durableRevisionId: "",
        error: "",
        updatedAt: review.decidedAt,
      });
    },

    async commit(id) {
      const record = await required(store, id);
      assertState(record, ["approved"], "commit");
      if (record.review.status !== "accepted" || !record.review.writerId) throw new Error("Creative Transaction requires explicit writer acceptance before provider commit.");
      if (!creativeTransactionVerificationComplete(record.changeSet, record.verificationEvidence)) throw new Error("Creative Transaction cannot commit without complete blocking verification evidence.");
      const providerId = externalTransactionId(record);
      if (!providerId) throw new Error("GitHub Creative Transaction has no external proposal identity.");
      const inspection = await bridge.inspectProposal(providerId);
      if (["missing", "changed", "unavailable", "unknown", "declined"].includes(inspection.state)) {
        throw new Error(`GitHub Creative Transaction cannot commit while provider state is ${inspection.state}. Reconcile and review before retrying.`);
      }
      const committed = await bridge.commitApprovedProposal({ providerTransactionId: providerId, writerId: record.review.writerId, note: record.review.note });
      const durableRevisionId = text(committed.durableRevisionId, 220);
      if (!durableRevisionId) throw new Error("GitHub did not confirm a durable provider revision.");
      const committedAt = now();
      const nextChangeSet = {
        ...withProviderTransaction(record, providerId, durableRevisionId),
        verificationEvidence: clone(record.verificationEvidence),
        review: clone(record.review),
        updatedAt: committedAt,
        committedAt,
      };
      return save(store, { ...record, state: "committed", durableRevisionId, changeSet: nextChangeSet, updatedAt: committedAt });
    },

    async status(id) {
      const record = await store.load(id);
      return record ? clone(record) : null;
    },

    async recover(id) {
      const record = await store.load(id);
      if (!record) return { transactionId: id, providerId: descriptor.id, state: "unknown", durableRevisionId: "", recoverable: false, evidenceComplete: false, authoritative: false, summary: "No durable PlotPickle transaction record exists. PlotPickle will not infer GitHub success." };
      return reconcileRecord(bridge, record);
    },

    async reconcile(id) {
      const record = await store.load(id);
      if (!record) return { transactionId: id, providerId: descriptor.id, state: "unknown", durableRevisionId: "", recoverable: false, evidenceComplete: false, authoritative: false, summary: "No durable PlotPickle transaction record exists. PlotPickle will not infer GitHub success." };
      return reconcileRecord(bridge, record);
    },

    async rollback(id) {
      const record = await required(store, id);
      assertState(record, ["committed"], "rollback");
      if (!bridge.rollbackCommittedProposal) throw new Error("GitHub Creative Transaction provider does not advertise a safe rollback capability for this bridge.");
      const providerId = externalTransactionId(record);
      const result = await bridge.rollbackCommittedProposal({
        providerTransactionId: providerId,
        durableRevisionId: record.durableRevisionId,
        writerId: record.review.writerId,
        note: `Rollback of Creative Transaction ${record.transactionId}`,
      });
      if (!text(result.durableRevisionId, 220)) throw new Error("GitHub rollback did not confirm a durable revision.");
      return save(store, { ...record, state: "rolled-back", rollbackOfRevisionId: record.durableRevisionId, updatedAt: now() });
    },
  };
}

export class MemoryGitHubCreativeTransactionStore implements GitHubCreativeTransactionStore {
  private records = new Map<string, CreativeTransactionRecord>();
  async load(id: string) { const record = this.records.get(id); return record ? clone(record) : null; }
  async save(record: CreativeTransactionRecord) { this.records.set(record.transactionId, clone(record)); }
}
