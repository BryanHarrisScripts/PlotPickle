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
} from "./creative-transaction-contract";

export type VersionedObjectBundleState =
  | "missing"
  | "staged"
  | "committed"
  | "rolled-back"
  | "changed"
  | "unavailable"
  | "unknown";

export type VersionedObjectBundleReceipt = {
  providerTransactionId: string;
  changeSetFingerprint: string;
};

export type VersionedObjectBundleInspection = {
  state: VersionedObjectBundleState;
  durableRevisionId: string;
  changeSetFingerprint: string;
  summary: string;
};

export interface VersionedObjectCreativeTransactionBridge {
  stageBundle(input: {
    changeSet: CreativeChangeSet;
    changeSetFingerprint: string;
    artifactRefs: readonly string[];
  }): Promise<VersionedObjectBundleReceipt>;
  inspectBundle(providerTransactionId: string): Promise<VersionedObjectBundleInspection>;
  commitBundle(input: {
    providerTransactionId: string;
    writerId: string;
    note: string;
    expectedFingerprint: string;
  }): Promise<{ durableRevisionId: string }>;
  discardBundle?(input: {
    providerTransactionId: string;
    writerId: string;
    note: string;
  }): Promise<void>;
  rollbackBundle?(input: {
    providerTransactionId: string;
    durableRevisionId: string;
    writerId: string;
    note: string;
    expectedFingerprint: string;
  }): Promise<{ durableRevisionId: string }>;
}

export interface VersionedObjectCreativeTransactionStore {
  load(transactionId: string): Promise<CreativeTransactionRecord | null>;
  save(record: CreativeTransactionRecord): Promise<void>;
}

export const VERSIONED_OBJECT_CREATIVE_TRANSACTION_PROVIDER: CreativeTransactionProviderDescriptor = {
  id: "versioned-object-store",
  kind: "external",
  label: "Versioned Object Store",
  transport: "sdk",
  capabilities: [
    "durable-revision",
    "diff",
    "verification",
    "human-review",
    "recovery",
    "reconcile",
    "artifact-storage",
    "remote",
  ],
  priority: 60,
};

function descriptorFor(bridge: VersionedObjectCreativeTransactionBridge): CreativeTransactionProviderDescriptor {
  return bridge.rollbackBundle
    ? {
      ...VERSIONED_OBJECT_CREATIVE_TRANSACTION_PROVIDER,
      capabilities: [...VERSIONED_OBJECT_CREATIVE_TRANSACTION_PROVIDER.capabilities, "rollback"],
    }
    : VERSIONED_OBJECT_CREATIVE_TRANSACTION_PROVIDER;
}

function now(value?: string) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function text(value: unknown, maximum = 500) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function unique(values: readonly string[], maximum = 512) {
  return [...new Set(values.map((value) => text(value, 500)).filter(Boolean))].slice(0, maximum);
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function transactionId(changeSet: CreativeChangeSet) {
  return `object-${changeSet.projectId}-${changeSet.changeSetId}`.slice(0, 220);
}

function externalTransactionId(record: CreativeTransactionRecord) {
  return record.changeSet.transaction?.providerId === VERSIONED_OBJECT_CREATIVE_TRANSACTION_PROVIDER.id
    ? text(record.changeSet.transaction.transactionId, 220)
    : "";
}

function withProviderTransaction(
  record: CreativeTransactionRecord,
  providerTransactionId: string,
  durableRevisionId = "",
): CreativeChangeSet {
  return {
    ...record.changeSet,
    transaction: {
      providerId: VERSIONED_OBJECT_CREATIVE_TRANSACTION_PROVIDER.id,
      transactionId: text(providerTransactionId, 220),
      durableRevisionId: text(durableRevisionId, 220),
    },
  };
}

function assertState(
  record: CreativeTransactionRecord,
  allowed: readonly CreativeTransactionRecord["state"][],
  operation: string,
) {
  if (!allowed.includes(record.state)) {
    throw new Error(`Creative Transaction ${operation} is not allowed while ${record.state}.`);
  }
}

async function required(store: VersionedObjectCreativeTransactionStore, id: string) {
  const record = await store.load(id);
  if (!record) throw new Error(`Creative Transaction ${id} was not found.`);
  return record;
}

async function save(store: VersionedObjectCreativeTransactionStore, record: CreativeTransactionRecord) {
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

function unknown(
  record: CreativeTransactionRecord,
  summary: string,
  authoritative = false,
): CreativeTransactionReconciliation {
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

function matchingFingerprint(record: CreativeTransactionRecord, inspection: VersionedObjectBundleInspection) {
  return text(inspection.changeSetFingerprint, 220) === creativeChangeSetFingerprint(record.changeSet);
}

async function reconcileRecord(
  bridge: VersionedObjectCreativeTransactionBridge,
  record: CreativeTransactionRecord,
): Promise<CreativeTransactionReconciliation> {
  const providerTransactionId = externalTransactionId(record);
  if (!providerTransactionId) {
    return unknown(record, "No external bundle identity has been established. PlotPickle will not infer provider success.");
  }

  let inspection: VersionedObjectBundleInspection;
  try {
    inspection = await bridge.inspectBundle(providerTransactionId);
  } catch (error) {
    return unknown(
      record,
      error instanceof Error
        ? `Versioned object provider state is unavailable: ${error.message}`
        : "Versioned object provider state is unavailable.",
    );
  }

  if (inspection.state === "unavailable" || inspection.state === "unknown") {
    return unknown(record, inspection.summary || "Versioned object provider state is ambiguous; PlotPickle will not infer success.");
  }
  if (inspection.state === "missing" || inspection.state === "changed" || !matchingFingerprint(record, inspection)) {
    return unknown(
      record,
      inspection.summary || "Versioned object provider state no longer matches the Creative Change Set. Review is required before recovery continues.",
      true,
    );
  }

  if (inspection.state === "rolled-back") {
    return {
      transactionId: record.transactionId,
      providerId: record.providerId,
      state: "rolled-back",
      durableRevisionId: text(inspection.durableRevisionId, 220),
      recoverable: false,
      evidenceComplete: creativeTransactionVerificationComplete(record.changeSet, record.verificationEvidence),
      authoritative: true,
      summary: inspection.summary || "Versioned object provider confirms rollback.",
    };
  }

  if (inspection.state === "committed") {
    const durableRevisionId = text(inspection.durableRevisionId, 220);
    return {
      transactionId: record.transactionId,
      providerId: record.providerId,
      state: "committed",
      durableRevisionId,
      recoverable: true,
      evidenceComplete: creativeTransactionVerificationComplete(record.changeSet, record.verificationEvidence),
      authoritative: Boolean(durableRevisionId),
      summary: inspection.summary || "Versioned object provider confirms committed durable state.",
    };
  }

  return {
    transactionId: record.transactionId,
    providerId: record.providerId,
    state: record.state === "approved" ? "approved" : "awaiting-review",
    durableRevisionId: record.durableRevisionId,
    recoverable: true,
    evidenceComplete: creativeTransactionVerificationComplete(record.changeSet, record.verificationEvidence),
    authoritative: true,
    summary: inspection.summary || "Versioned object provider confirms the staged bundle.",
  };
}

export class MemoryVersionedObjectCreativeTransactionStore implements VersionedObjectCreativeTransactionStore {
  private records = new Map<string, CreativeTransactionRecord>();

  async load(transactionId: string) {
    const record = this.records.get(transactionId);
    return record ? clone(record) : null;
  }

  async save(record: CreativeTransactionRecord) {
    this.records.set(record.transactionId, clone(record));
  }
}

export function createVersionedObjectCreativeTransactionProvider(
  store: VersionedObjectCreativeTransactionStore,
  bridge: VersionedObjectCreativeTransactionBridge,
): CreativeTransactionProvider {
  const descriptor = descriptorFor(bridge);

  return {
    descriptor,

    async create(changeSet) {
      if (!providerSupportsCapabilities(descriptor, changeSet.requiredCapabilities)) {
        throw new Error("Versioned Object Store does not satisfy the Creative Change Set capability requirements.");
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
      const fingerprint = creativeChangeSetFingerprint(record.changeSet);
      const receipt = await bridge.stageBundle({
        changeSet: clone(record.changeSet),
        changeSetFingerprint: fingerprint,
        artifactRefs: record.stagedArtifactRefs,
      });
      const providerTransactionId = text(receipt.providerTransactionId, 220);
      if (!providerTransactionId) throw new Error("Versioned Object Store did not return a provider transaction identity.");
      if (text(receipt.changeSetFingerprint, 220) !== fingerprint) {
        throw new Error("Versioned Object Store staged a bundle with a mismatched Creative Change Set fingerprint.");
      }
      return save(store, {
        ...record,
        state: "awaiting-review",
        changeSet: withProviderTransaction(record, providerTransactionId),
        updatedAt: now(),
      });
    },

    async accept(id, decision) {
      const record = await required(store, id);
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

    async reject(id, decision) {
      const record = await required(store, id);
      assertState(record, ["awaiting-review"], "reject");
      const writerId = text(decision.writerId, 180);
      if (!writerId) throw new Error("Writer identity is required to reject a Creative Transaction.");
      const providerTransactionId = externalTransactionId(record);
      if (providerTransactionId && bridge.discardBundle) {
        await bridge.discardBundle({
          providerTransactionId,
          writerId,
          note: text(decision.note, 800),
        });
      }
      const review: CreativeReviewDecision = {
        status: "rejected",
        writerId,
        note: text(decision.note, 800),
        decidedAt: now(decision.decidedAt),
      };
      return save(store, { ...record, state: "rejected", review, updatedAt: review.decidedAt });
    },

    async revise(id, decision) {
      const record = await required(store, id);
      assertState(record, ["awaiting-review", "rejected"], "revise");
      const writerId = text(decision.writerId, 180);
      if (!writerId) throw new Error("Writer identity is required to request Creative Transaction revision.");
      const providerTransactionId = externalTransactionId(record);
      if (providerTransactionId && bridge.discardBundle) {
        await bridge.discardBundle({
          providerTransactionId,
          writerId,
          note: text(decision.note, 800) || "Revision requested; replace this staged bundle with a revised transaction.",
        });
      }
      const review: CreativeReviewDecision = {
        status: "revise",
        writerId,
        note: text(decision.note, 800),
        decidedAt: now(decision.decidedAt),
      };
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
      if (record.review.status !== "accepted" || !record.review.writerId) {
        throw new Error("Creative Transaction requires explicit writer acceptance before provider commit.");
      }
      if (!creativeTransactionVerificationComplete(record.changeSet, record.verificationEvidence)) {
        throw new Error("Creative Transaction cannot commit without complete blocking verification evidence.");
      }
      const providerTransactionId = externalTransactionId(record);
      if (!providerTransactionId) throw new Error("Versioned Object Creative Transaction has no external bundle identity.");

      const inspection = await bridge.inspectBundle(providerTransactionId);
      if (["missing", "changed", "unavailable", "unknown", "rolled-back"].includes(inspection.state)) {
        throw new Error(`Versioned Object Creative Transaction cannot commit while provider state is ${inspection.state}. Reconcile and review before retrying.`);
      }
      if (!matchingFingerprint(record, inspection)) {
        throw new Error("Versioned Object Creative Transaction cannot commit because the remote bundle fingerprint changed.");
      }
      if (inspection.state === "committed") {
        throw new Error("Versioned Object Creative Transaction is already committed remotely. Reconcile before continuing.");
      }

      const fingerprint = creativeChangeSetFingerprint(record.changeSet);
      const committed = await bridge.commitBundle({
        providerTransactionId,
        writerId: record.review.writerId,
        note: record.review.note,
        expectedFingerprint: fingerprint,
      });
      const durableRevisionId = text(committed.durableRevisionId, 220);
      if (!durableRevisionId) throw new Error("Versioned Object Store did not confirm a durable provider revision.");
      const committedAt = now();
      const nextChangeSet: CreativeChangeSet = {
        ...withProviderTransaction(record, providerTransactionId, durableRevisionId),
        verificationEvidence: clone(record.verificationEvidence),
        review: clone(record.review),
        updatedAt: committedAt,
        committedAt,
      };
      return save(store, {
        ...record,
        state: "committed",
        durableRevisionId,
        changeSet: nextChangeSet,
        updatedAt: committedAt,
      });
    },

    async status(id) {
      const record = await store.load(id);
      return record ? clone(record) : null;
    },

    async recover(id) {
      const record = await store.load(id);
      if (!record) {
        return {
          transactionId: id,
          providerId: descriptor.id,
          state: "unknown",
          durableRevisionId: "",
          recoverable: false,
          evidenceComplete: false,
          authoritative: false,
          summary: "No durable PlotPickle transaction record exists. PlotPickle will not infer versioned-object provider success.",
        };
      }
      return reconcileRecord(bridge, record);
    },

    async reconcile(id) {
      const record = await store.load(id);
      if (!record) {
        return {
          transactionId: id,
          providerId: descriptor.id,
          state: "unknown",
          durableRevisionId: "",
          recoverable: false,
          evidenceComplete: false,
          authoritative: false,
          summary: "No durable PlotPickle transaction record exists. PlotPickle will not infer versioned-object provider success.",
        };
      }
      return reconcileRecord(bridge, record);
    },

    async rollback(id) {
      const record = await required(store, id);
      assertState(record, ["committed"], "rollback");
      if (!bridge.rollbackBundle) {
        throw new Error("Versioned Object Creative Transaction provider does not advertise a safe rollback capability for this bridge.");
      }
      const providerTransactionId = externalTransactionId(record);
      const result = await bridge.rollbackBundle({
        providerTransactionId,
        durableRevisionId: record.durableRevisionId,
        writerId: record.review.writerId,
        note: `Rollback of Creative Transaction ${record.transactionId}`,
        expectedFingerprint: creativeChangeSetFingerprint(record.changeSet),
      });
      if (!text(result.durableRevisionId, 220)) {
        throw new Error("Versioned Object rollback did not confirm a durable revision.");
      }
      return save(store, {
        ...record,
        state: "rolled-back",
        rollbackOfRevisionId: record.durableRevisionId,
        updatedAt: now(),
      });
    },
  };
}
