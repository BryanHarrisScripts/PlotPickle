import type { PlotPickleProject } from "../../projects/project";
import {
  CREATIVE_TRANSACTION_CONTRACT_VERSION,
  creativeChangeSetFingerprint,
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
} from "../../creative-transactions/creative-transaction-contract";
import type { CreativeTransactionStore } from "../../creative-transactions/local-creative-transaction-provider";

export const GITHUB_CREATIVE_TRANSACTION_PROVIDER: CreativeTransactionProviderDescriptor = {
  id: "github-story-proposals",
  kind: "external",
  label: "GitHub Story Proposals",
  transport: "rest",
  capabilities: [
    "durable-revision",
    "diff",
    "verification",
    "human-review",
    "recovery",
    "reconcile",
    "artifact-storage",
    "collaboration",
    "remote",
  ],
  priority: 20,
};

export type GitHubStoryProposalState = "open" | "draft" | "approved" | "declined" | "merged" | "missing" | "unknown";

export type GitHubCreativeTransactionBinding = {
  version: 1;
  transactionId: string;
  changeSetFingerprint: string;
  proposalNumber: number;
  proposalUrl: string;
  baseRevision: string;
  headRevision: string;
  createdAt: string;
  updatedAt: string;
};

export interface GitHubCreativeTransactionBindingStore {
  load(transactionId: string): Promise<GitHubCreativeTransactionBinding | null>;
  save(binding: GitHubCreativeTransactionBinding): Promise<void>;
  remove(transactionId: string): Promise<void>;
}

export type GitHubCreativeTransactionProjectContext = {
  project: PlotPickleProject;
  expectedRemoteRevision: string;
  requestedAssets?: unknown;
  title?: string;
  note?: string;
};

export type GitHubStoryProposalReview = {
  proposalNumber: number;
  state: GitHubStoryProposalState;
  baseRevision: string;
  headRevision: string;
  proposalUrl: string;
  groupIds: string[];
};

export type GitHubStoryProposalSnapshot = {
  proposalNumber: number;
  state: GitHubStoryProposalState;
  baseRevision: string;
  headRevision: string;
  proposalUrl: string;
};

export interface GitHubCreativeTransactionBackend {
  stage(input: {
    project: PlotPickleProject;
    title: string;
    note: string;
    expectedBaseRevision: string;
    requestedAssets?: unknown;
  }): Promise<{
    proposalNumber: number;
    proposalUrl: string;
    baseRevision: string;
    headRevision: string;
  }>;
  review(proposalNumber: number): Promise<GitHubStoryProposalReview>;
  approve(input: { proposalNumber: number; selectedGroups: readonly string[]; expectedBaseRevision: string }): Promise<{ durableRevisionId: string }>;
  decline(input: { proposalNumber: number; note: string }): Promise<void>;
  snapshot(proposalNumber: number): Promise<GitHubStoryProposalSnapshot>;
}

type GatewayResponse = {
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
};

export type GitHubGatewayFetch = (input: string, init?: { method?: string; headers?: Record<string, string>; body?: string }) => Promise<GatewayResponse>;

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function text(value: unknown, maximum = 800) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function now(value?: string) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function safeId(value: string) {
  return text(value, 120).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "") || "change";
}

function transactionId(changeSet: CreativeChangeSet) {
  return `github-${safeId(changeSet.projectId)}-${safeId(changeSet.changeSetId)}`.slice(0, 220);
}

function assertState(record: CreativeTransactionRecord, allowed: readonly CreativeTransactionRecord["state"][], operation: string) {
  if (!allowed.includes(record.state)) throw new Error(`Creative Transaction ${operation} is not allowed while ${record.state}.`);
}

async function required(store: CreativeTransactionStore, id: string) {
  const record = await store.load(id);
  if (!record) throw new Error(`Creative Transaction ${id} was not found.`);
  return record;
}

async function requiredBinding(store: GitHubCreativeTransactionBindingStore, id: string) {
  const binding = await store.load(id);
  if (!binding) throw new Error(`GitHub transaction binding ${id} was not found. Reconcile before continuing.`);
  return binding;
}

async function save(store: CreativeTransactionStore, record: CreativeTransactionRecord) {
  await store.save(record);
  return clone(record);
}

function normalizedEvidence(evidence: readonly CreativeVerificationEvidence[]) {
  return evidence.map((item) => ({
    ...item,
    requirementId: text(item.requirementId, 160),
    evidenceRef: text(item.evidenceRef, 500),
    summary: text(item.summary, 800),
    recordedAt: now(item.recordedAt),
  })) satisfies CreativeVerificationEvidence[];
}

function parseObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown) {
  return typeof value === "string" ? value : "";
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : 0;
}

async function gatewayJson(fetcher: GitHubGatewayFetch, path: string, init?: { method?: string; body?: unknown }) {
  const response = await fetcher(path, {
    method: init?.method || "GET",
    headers: init?.body === undefined ? undefined : { "Content-Type": "application/json" },
    body: init?.body === undefined ? undefined : JSON.stringify(init.body),
  });
  const body = parseObject(await response.json());
  if (!response.ok || body.ok === false) {
    const error = new Error(stringValue(body.error) || stringValue(body.message) || `GitHub Story Proposal gateway returned ${response.status}.`) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return body;
}

/**
 * Thin transport over PlotPickle's existing /api/local-github Story Proposal service.
 * This intentionally does not call api.github.com. #150/#152 remain the Git/GitHub wheelhouse.
 */
export function createGitHubReviewGatewayBackend(fetcher: GitHubGatewayFetch, apiRoot = "/api/local-github"): GitHubCreativeTransactionBackend {
  const root = apiRoot.replace(/\/$/, "");
  return {
    async stage(input) {
      const body = await gatewayJson(fetcher, `${root}/submit-proposal`, {
        method: "POST",
        body: {
          project: input.project,
          title: input.title,
          note: input.note,
          expectedBaseRevision: input.expectedBaseRevision,
          requestedAssets: input.requestedAssets ?? [],
        },
      });
      const result = parseObject(body.proposal ?? body.result ?? body);
      const proposalNumber = numberValue(result.pullRequestNumber ?? result.proposalNumber);
      const baseRevision = stringValue(result.baseRevision);
      const headRevision = stringValue(result.commitSha ?? result.headRevision);
      if (!proposalNumber || !baseRevision || !headRevision) throw new Error("GitHub Story Proposal gateway did not return a complete staged proposal receipt.");
      return {
        proposalNumber,
        proposalUrl: stringValue(result.pullRequestUrl ?? result.proposalUrl),
        baseRevision,
        headRevision,
      };
    },

    async review(proposalNumber) {
      const body = await gatewayJson(fetcher, `${root}/proposal-review?number=${encodeURIComponent(String(proposalNumber))}`);
      const proposal = parseObject(body.proposal);
      const groups = Array.isArray(body.groups) ? body.groups : [];
      return {
        proposalNumber,
        state: storyProposalState(proposal.state),
        baseRevision: stringValue(body.baseCommit),
        headRevision: stringValue(body.headCommit),
        proposalUrl: stringValue(proposal.url),
        groupIds: groups.flatMap((group) => {
          const id = stringValue(parseObject(group).id);
          return id ? [id] : [];
        }),
      };
    },

    async approve(input) {
      const body = await gatewayJson(fetcher, `${root}/approve-proposal`, {
        method: "POST",
        body: {
          number: input.proposalNumber,
          selectedGroups: [...input.selectedGroups],
          expectedBaseCommit: input.expectedBaseRevision,
        },
      });
      const result = parseObject(body.result ?? body);
      const durableRevisionId = stringValue(result.remoteCommit);
      if (!durableRevisionId) throw new Error("GitHub Story Proposal approval did not return the durable approved revision.");
      return { durableRevisionId };
    },

    async decline(input) {
      await gatewayJson(fetcher, `${root}/decline-proposal`, {
        method: "POST",
        body: { number: input.proposalNumber, note: input.note },
      });
    },

    async snapshot(proposalNumber) {
      const body = await gatewayJson(fetcher, `${root}/proposals`);
      const proposals = Array.isArray(body.proposals) ? body.proposals : [];
      const item = proposals.map(parseObject).find((proposal) => numberValue(proposal.number) === proposalNumber);
      if (!item) return { proposalNumber, state: "missing", baseRevision: "", headRevision: "", proposalUrl: "" };
      const state = storyProposalState(item.state);
      if (state === "declined") {
        return { proposalNumber, state, baseRevision: "", headRevision: "", proposalUrl: stringValue(item.url) };
      }
      try {
        const review = await this.review(proposalNumber);
        return {
          proposalNumber,
          state,
          baseRevision: review.baseRevision,
          headRevision: review.headRevision,
          proposalUrl: review.proposalUrl || stringValue(item.url),
        };
      } catch {
        return { proposalNumber, state, baseRevision: "", headRevision: "", proposalUrl: stringValue(item.url) };
      }
    },
  };
}

function storyProposalState(value: unknown): GitHubStoryProposalState {
  const state = stringValue(value).toLowerCase();
  if (["open", "draft", "approved", "declined", "merged"].includes(state)) return state as GitHubStoryProposalState;
  return "unknown";
}

function reconciliationUnknown(transactionIdValue: string, summary: string, recoverable = true): CreativeTransactionReconciliation {
  return {
    transactionId: transactionIdValue,
    providerId: GITHUB_CREATIVE_TRANSACTION_PROVIDER.id,
    state: "unknown",
    durableRevisionId: "",
    recoverable,
    evidenceComplete: false,
    authoritative: false,
    summary,
  };
}

export function createGitHubCreativeTransactionProvider(input: {
  store: CreativeTransactionStore;
  bindings: GitHubCreativeTransactionBindingStore;
  backend: GitHubCreativeTransactionBackend;
  resolveProject(changeSet: CreativeChangeSet): Promise<GitHubCreativeTransactionProjectContext>;
}): CreativeTransactionProvider {
  const { store, bindings, backend, resolveProject } = input;

  async function reconcileRemote(id: string): Promise<CreativeTransactionReconciliation> {
    const record = await store.load(id);
    if (!record) return reconciliationUnknown(id, "No local Creative Transaction record exists. PlotPickle will not infer remote success.", false);
    const binding = await bindings.load(id);
    if (!binding) return reconciliationUnknown(id, "No durable GitHub proposal binding exists. PlotPickle will not infer remote success.");
    let snapshot: GitHubStoryProposalSnapshot;
    try {
      snapshot = await backend.snapshot(binding.proposalNumber);
    } catch (error) {
      return reconciliationUnknown(id, `GitHub state is unavailable: ${text((error as Error).message, 500)} PlotPickle will not infer success.`);
    }
    const evidenceComplete = creativeTransactionVerificationComplete(record.changeSet, record.verificationEvidence);
    if (record.state === "committed" && record.durableRevisionId) {
      return {
        transactionId: id,
        providerId: record.providerId,
        state: "committed",
        durableRevisionId: record.durableRevisionId,
        recoverable: true,
        evidenceComplete,
        authoritative: true,
        summary: "The local transaction receipt contains the durable GitHub revision returned by the existing Story Proposal approval path. PPF canon remains separate.",
      };
    }
    if (snapshot.state === "declined") {
      return {
        transactionId: id,
        providerId: record.providerId,
        state: "rejected",
        durableRevisionId: "",
        recoverable: true,
        evidenceComplete,
        authoritative: true,
        summary: "GitHub confirms the Story Proposal is declined.",
      };
    }
    if (snapshot.state === "approved" || snapshot.state === "merged") {
      return reconciliationUnknown(id, "GitHub reports a completed/merged proposal but PlotPickle does not hold the durable approved revision receipt. This is a provider-commit/acknowledgement gap and must be reviewed rather than guessed.");
    }
    if (snapshot.state === "missing" || snapshot.state === "unknown") {
      return reconciliationUnknown(id, "The bound GitHub Story Proposal cannot be confirmed. PlotPickle will not infer success.");
    }
    if (snapshot.baseRevision && snapshot.baseRevision !== binding.baseRevision) {
      return reconciliationUnknown(id, "The GitHub proposal base no longer matches the staged transaction binding. Refresh/review before continuing.");
    }
    if (snapshot.headRevision && snapshot.headRevision !== binding.headRevision) {
      return reconciliationUnknown(id, "The GitHub proposal head changed outside the staged transaction binding. Refresh/review before continuing.");
    }
    return {
      transactionId: id,
      providerId: record.providerId,
      state: record.state,
      durableRevisionId: "",
      recoverable: true,
      evidenceComplete,
      authoritative: true,
      summary: `GitHub confirms the bound Story Proposal is ${snapshot.state}; local Creative Transaction state remains ${record.state}.`,
    };
  }

  return {
    descriptor: GITHUB_CREATIVE_TRANSACTION_PROVIDER,

    async create(changeSet) {
      if (!providerSupportsCapabilities(GITHUB_CREATIVE_TRANSACTION_PROVIDER, changeSet.requiredCapabilities)) {
        throw new Error("GitHub Story Proposals do not satisfy the Creative Change Set capability requirements.");
      }
      const id = transactionId(changeSet);
      const existing = await store.load(id);
      if (existing) return clone(existing);
      const createdAt = now(changeSet.createdAt);
      return save(store, {
        version: CREATIVE_TRANSACTION_CONTRACT_VERSION,
        transactionId: id,
        providerId: GITHUB_CREATIVE_TRANSACTION_PROVIDER.id,
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
      const context = await resolveProject(record.changeSet);
      if (!context.expectedRemoteRevision) throw new Error("GitHub Creative Transaction requires the last approved remote revision before staging.");
      if (context.project.id !== record.changeSet.projectId) throw new Error("GitHub Creative Transaction project resolver returned a different project ID.");
      const receipt = await backend.stage({
        project: context.project,
        title: context.title || `Creative Change: ${record.changeSet.changeSetId}`,
        note: context.note || `PlotPickle Creative Change Set ${record.changeSet.changeSetId} (${creativeChangeSetFingerprint(record.changeSet)}).`,
        expectedBaseRevision: context.expectedRemoteRevision,
        requestedAssets: context.requestedAssets,
      });
      if (receipt.baseRevision !== context.expectedRemoteRevision) throw new Error("GitHub staged proposal base does not match the expected approved revision.");
      const updatedAt = now();
      await bindings.save({
        version: 1,
        transactionId: id,
        changeSetFingerprint: creativeChangeSetFingerprint(record.changeSet),
        proposalNumber: receipt.proposalNumber,
        proposalUrl: receipt.proposalUrl,
        baseRevision: receipt.baseRevision,
        headRevision: receipt.headRevision,
        createdAt: updatedAt,
        updatedAt,
      });
      return save(store, {
        ...record,
        state: "staged",
        stagedArtifactRefs: [...new Set(artifactRefs.map((item) => text(item, 500)).filter(Boolean))],
        verificationEvidence: [],
        review: { status: "pending", writerId: "", note: "", decidedAt: "" },
        error: "",
        updatedAt,
      });
    },

    async diff(id): Promise<readonly CreativeChange[]> {
      const record = await required(store, id);
      return clone(record.changeSet.changes);
    },

    async verify(id, evidence) {
      const record = await required(store, id);
      assertState(record, ["staged", "revising"], "verify");
      const binding = await requiredBinding(bindings, id);
      const review = await backend.review(binding.proposalNumber);
      if (review.state !== "open" && review.state !== "draft") {
        throw new Error(`GitHub Story Proposal cannot verify while ${review.state}.`);
      }
      if (review.baseRevision !== binding.baseRevision || review.headRevision !== binding.headRevision) {
        return save(store, { ...record, state: "revising", error: "GitHub Story Proposal changed outside this transaction. Restage/review before continuing.", updatedAt: now() });
      }
      const normalized = normalizedEvidence(evidence);
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
      await requiredBinding(bindings, id);
      return save(store, { ...record, state: "awaiting-review", updatedAt: now() });
    },

    async accept(id, decision) {
      const record = await required(store, id);
      assertState(record, ["awaiting-review"], "accept");
      const writerId = text(decision.writerId, 180);
      if (!writerId) throw new Error("Writer identity is required to accept a Creative Transaction.");
      const review: CreativeReviewDecision = { status: "accepted", writerId, note: text(decision.note), decidedAt: now(decision.decidedAt) };
      return save(store, { ...record, state: "approved", review, updatedAt: review.decidedAt });
    },

    async reject(id, decision) {
      const record = await required(store, id);
      assertState(record, ["awaiting-review"], "reject");
      const writerId = text(decision.writerId, 180);
      if (!writerId) throw new Error("Writer identity is required to reject a Creative Transaction.");
      const binding = await requiredBinding(bindings, id);
      const review: CreativeReviewDecision = { status: "rejected", writerId, note: text(decision.note), decidedAt: now(decision.decidedAt) };
      await backend.decline({ proposalNumber: binding.proposalNumber, note: review.note || "Writer rejected the Creative Change Set." });
      return save(store, { ...record, state: "rejected", review, updatedAt: review.decidedAt });
    },

    async revise(id, decision) {
      const record = await required(store, id);
      assertState(record, ["awaiting-review", "rejected"], "revise");
      const writerId = text(decision.writerId, 180);
      if (!writerId) throw new Error("Writer identity is required to request Creative Transaction revision.");
      const binding = await bindings.load(id);
      const review: CreativeReviewDecision = { status: "revise", writerId, note: text(decision.note), decidedAt: now(decision.decidedAt) };
      if (binding) {
        const snapshot = await backend.snapshot(binding.proposalNumber);
        if (snapshot.state === "open" || snapshot.state === "draft") {
          await backend.decline({ proposalNumber: binding.proposalNumber, note: review.note || "Writer requested a revised Creative Change Set." });
        }
        await bindings.remove(id);
      }
      return save(store, { ...record, state: "revising", review, error: "", updatedAt: review.decidedAt });
    },

    async commit(id) {
      const record = await required(store, id);
      assertState(record, ["approved"], "commit");
      if (record.review.status !== "accepted" || !record.review.writerId) throw new Error("Creative Transaction requires explicit writer acceptance before provider commit.");
      if (!creativeTransactionVerificationComplete(record.changeSet, record.verificationEvidence)) throw new Error("Creative Transaction cannot commit without complete blocking verification evidence.");
      const binding = await requiredBinding(bindings, id);
      const review = await backend.review(binding.proposalNumber);
      if (review.state !== "open" && review.state !== "draft") throw new Error(`GitHub Story Proposal cannot commit while ${review.state}.`);
      if (review.baseRevision !== binding.baseRevision || review.headRevision !== binding.headRevision) throw new Error("GitHub Story Proposal changed after verification. Refresh/reconcile before commit.");
      if (!review.groupIds.length) throw new Error("GitHub Story Proposal contains no semantic change groups to approve.");
      const approved = await backend.approve({ proposalNumber: binding.proposalNumber, selectedGroups: review.groupIds, expectedBaseRevision: binding.baseRevision });
      const committedAt = now();
      const next: CreativeTransactionRecord = {
        ...record,
        state: "committed",
        durableRevisionId: approved.durableRevisionId,
        changeSet: {
          ...record.changeSet,
          verificationEvidence: clone(record.verificationEvidence),
          review: clone(record.review),
          transaction: { providerId: record.providerId, transactionId: id, durableRevisionId: approved.durableRevisionId },
          updatedAt: committedAt,
          committedAt,
        },
        updatedAt: committedAt,
      };
      return save(store, next);
    },

    async status(id) {
      const record = await store.load(id);
      return record ? clone(record) : null;
    },

    async recover(id) {
      return reconcileRemote(id);
    },

    async reconcile(id) {
      return reconcileRemote(id);
    },

    async rollback() {
      throw new Error("GitHub Story Proposals do not advertise automatic rollback. Create a new reverse Creative Change Set and review it normally.");
    },
  };
}

export class MemoryGitHubCreativeTransactionBindingStore implements GitHubCreativeTransactionBindingStore {
  private bindings = new Map<string, GitHubCreativeTransactionBinding>();

  async load(id: string) {
    const binding = this.bindings.get(id);
    return binding ? clone(binding) : null;
  }

  async save(binding: GitHubCreativeTransactionBinding) {
    this.bindings.set(binding.transactionId, clone(binding));
  }

  async remove(id: string) {
    this.bindings.delete(id);
  }
}
