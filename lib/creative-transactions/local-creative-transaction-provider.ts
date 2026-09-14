import {
  CREATIVE_TRANSACTION_CONTRACT_VERSION,
  LOCAL_CREATIVE_TRANSACTION_PROVIDER,
  creativeChangeSetFingerprint,
  creativeTransactionVerificationComplete,
  providerSupportsCapabilities,
  type CreativeChange,
  type CreativeChangeSet,
  type CreativeReviewDecision,
  type CreativeTransactionProvider,
  type CreativeTransactionReconciliation,
  type CreativeTransactionRecord,
  type CreativeVerificationEvidence,
} from "./creative-transaction-contract";

export interface CreativeTransactionStore {
  load(transactionId: string): Promise<CreativeTransactionRecord | null>;
  save(record: CreativeTransactionRecord): Promise<void>;
  list(projectId?: string): Promise<readonly CreativeTransactionRecord[]>;
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

function localTransactionId(changeSet: CreativeChangeSet) {
  return `local-${changeSet.projectId}-${changeSet.changeSetId}`.slice(0, 220);
}

function durableRevisionId(record: CreativeTransactionRecord) {
  const basis = creativeChangeSetFingerprint(record.changeSet).replace(/^ctx:/, "");
  const review = record.review.decidedAt.replace(/[^0-9]/g, "").slice(0, 14) || "undated";
  return `local:${basis}:${review}`;
}

function assertState(record: CreativeTransactionRecord, allowed: readonly CreativeTransactionRecord["state"][], operation: string) {
  if (!allowed.includes(record.state)) throw new Error(`Creative Transaction ${operation} is not allowed while ${record.state}.`);
}

async function required(store: CreativeTransactionStore, transactionId: string) {
  const record = await store.load(transactionId);
  if (!record) throw new Error(`Creative Transaction ${transactionId} was not found.`);
  return record;
}

async function save(store: CreativeTransactionStore, record: CreativeTransactionRecord) {
  await store.save(record);
  return clone(record);
}

function reconciliation(record: CreativeTransactionRecord | null, transactionId: string): CreativeTransactionReconciliation {
  if (!record) {
    return {
      transactionId,
      providerId: LOCAL_CREATIVE_TRANSACTION_PROVIDER.id,
      state: "unknown",
      durableRevisionId: "",
      recoverable: false,
      evidenceComplete: false,
      authoritative: false,
      summary: "No durable local transaction record exists. PlotPickle will not infer success.",
    };
  }
  const evidenceComplete = creativeTransactionVerificationComplete(record.changeSet, record.verificationEvidence);
  return {
    transactionId: record.transactionId,
    providerId: record.providerId,
    state: record.state,
    durableRevisionId: record.durableRevisionId,
    recoverable: record.recoverable,
    evidenceComplete,
    authoritative: true,
    summary: record.state === "committed"
      ? "Durable local transaction record confirms the creative change was committed as provider state; PPF canon remains a separate writer-approved boundary."
      : `Durable local transaction record reports ${record.state}.`,
  };
}

export function createLocalCreativeTransactionProvider(store: CreativeTransactionStore): CreativeTransactionProvider {
  return {
    descriptor: LOCAL_CREATIVE_TRANSACTION_PROVIDER,

    async create(changeSet) {
      if (!providerSupportsCapabilities(LOCAL_CREATIVE_TRANSACTION_PROVIDER, changeSet.requiredCapabilities)) {
        throw new Error("PlotPickle Local does not satisfy the Creative Change Set capability requirements.");
      }
      const transactionId = localTransactionId(changeSet);
      const existing = await store.load(transactionId);
      if (existing) return clone(existing);
      const createdAt = now(changeSet.createdAt);
      const record: CreativeTransactionRecord = {
        version: CREATIVE_TRANSACTION_CONTRACT_VERSION,
        transactionId,
        providerId: LOCAL_CREATIVE_TRANSACTION_PROVIDER.id,
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
      };
      return save(store, record);
    },

    async stage(transactionId, artifactRefs) {
      const record = await required(store, transactionId);
      assertState(record, ["created", "revising"], "stage");
      const updatedAt = now();
      return save(store, {
        ...record,
        state: "staged",
        stagedArtifactRefs: unique(artifactRefs),
        verificationEvidence: [],
        review: { status: "pending", writerId: "", note: "", decidedAt: "" },
        error: "",
        updatedAt,
      });
    },

    async diff(transactionId): Promise<readonly CreativeChange[]> {
      const record = await required(store, transactionId);
      return clone(record.changeSet.changes);
    },

    async verify(transactionId, evidence) {
      const record = await required(store, transactionId);
      assertState(record, ["staged", "revising"], "verify");
      const normalized = evidence.map((item) => ({
        ...item,
        requirementId: text(item.requirementId, 160),
        evidenceRef: text(item.evidenceRef, 500),
        summary: text(item.summary, 800),
        recordedAt: now(item.recordedAt),
      })) satisfies CreativeVerificationEvidence[];
      const complete = creativeTransactionVerificationComplete(record.changeSet, normalized);
      const updatedAt = now();
      return save(store, {
        ...record,
        state: complete ? "verified" : "revising",
        verificationEvidence: normalized,
        error: complete ? "" : "Blocking verification is incomplete or failed; revise and verify again before review.",
        updatedAt,
      });
    },

    async requestReview(transactionId) {
      const record = await required(store, transactionId);
      assertState(record, ["verified"], "request review");
      if (!creativeTransactionVerificationComplete(record.changeSet, record.verificationEvidence)) {
        throw new Error("Creative Transaction cannot request review before blocking verification passes.");
      }
      return save(store, { ...record, state: "awaiting-review", updatedAt: now() });
    },

    async accept(transactionId, decision) {
      const record = await required(store, transactionId);
      assertState(record, ["awaiting-review"], "accept");
      const writerId = text(decision.writerId, 180);
      if (!writerId) throw new Error("Writer identity is required to accept a Creative Transaction.");
      const review: CreativeReviewDecision = {
        status: "accepted",
        writerId,
        note: text(decision.note, 800),
        decidedAt: now(decision.decidedAt),
      };
      return save(store, { ...record, state: "approved", review, updatedAt: review.decidedAt });
    },

    async reject(transactionId, decision) {
      const record = await required(store, transactionId);
      assertState(record, ["awaiting-review"], "reject");
      const writerId = text(decision.writerId, 180);
      if (!writerId) throw new Error("Writer identity is required to reject a Creative Transaction.");
      const review: CreativeReviewDecision = {
        status: "rejected",
        writerId,
        note: text(decision.note, 800),
        decidedAt: now(decision.decidedAt),
      };
      return save(store, { ...record, state: "rejected", review, updatedAt: review.decidedAt });
    },

    async revise(transactionId, decision) {
      const record = await required(store, transactionId);
      assertState(record, ["awaiting-review", "rejected"], "revise");
      const writerId = text(decision.writerId, 180);
      if (!writerId) throw new Error("Writer identity is required to request Creative Transaction revision.");
      const review: CreativeReviewDecision = {
        status: "revise",
        writerId,
        note: text(decision.note, 800),
        decidedAt: now(decision.decidedAt),
      };
      return save(store, { ...record, state: "revising", review, error: "", updatedAt: review.decidedAt });
    },

    async commit(transactionId) {
      const record = await required(store, transactionId);
      assertState(record, ["approved"], "commit");
      if (record.review.status !== "accepted" || !record.review.writerId) {
        throw new Error("Creative Transaction requires explicit writer acceptance before provider commit.");
      }
      if (!creativeTransactionVerificationComplete(record.changeSet, record.verificationEvidence)) {
        throw new Error("Creative Transaction cannot commit without complete blocking verification evidence.");
      }
      const committedAt = now();
      const next: CreativeTransactionRecord = {
        ...record,
        state: "committed",
        durableRevisionId: durableRevisionId(record),
        changeSet: {
          ...record.changeSet,
          verificationEvidence: clone(record.verificationEvidence),
          review: clone(record.review),
          transaction: {
            providerId: record.providerId,
            transactionId: record.transactionId,
            durableRevisionId: durableRevisionId(record),
          },
          updatedAt: committedAt,
          committedAt,
        },
        updatedAt: committedAt,
      };
      return save(store, next);
    },

    async status(transactionId) {
      const record = await store.load(transactionId);
      return record ? clone(record) : null;
    },

    async recover(transactionId) {
      return reconciliation(await store.load(transactionId), transactionId);
    },

    async reconcile(transactionId) {
      return reconciliation(await store.load(transactionId), transactionId);
    },

    async rollback(transactionId) {
      const record = await required(store, transactionId);
      assertState(record, ["committed"], "rollback");
      const updatedAt = now();
      return save(store, {
        ...record,
        state: "rolled-back",
        rollbackOfRevisionId: record.durableRevisionId,
        updatedAt,
      });
    },
  };
}

export class MemoryCreativeTransactionStore implements CreativeTransactionStore {
  private records = new Map<string, CreativeTransactionRecord>();

  async load(transactionId: string) {
    const record = this.records.get(transactionId);
    return record ? clone(record) : null;
  }

  async save(record: CreativeTransactionRecord) {
    this.records.set(record.transactionId, clone(record));
  }

  async list(projectId?: string) {
    return [...this.records.values()]
      .filter((record) => !projectId || record.changeSet.projectId === projectId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt))
      .map(clone);
  }
}
