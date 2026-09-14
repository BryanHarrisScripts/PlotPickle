export const CREATIVE_TRANSACTION_CONTRACT_VERSION = 1 as const;

export const CREATIVE_TRANSACTION_CAPABILITIES = [
  "durable-revision",
  "atomic-commit",
  "diff",
  "verification",
  "human-review",
  "rollback",
  "recovery",
  "reconcile",
  "artifact-storage",
  "collaboration",
  "remote",
  "offline",
] as const;

export type CreativeTransactionCapability = (typeof CREATIVE_TRANSACTION_CAPABILITIES)[number];

export const CREATIVE_TRANSACTION_STATES = [
  "created",
  "staged",
  "verified",
  "awaiting-review",
  "approved",
  "revising",
  "rejected",
  "committed",
  "failed",
  "rolled-back",
  "unknown",
] as const;

export type CreativeTransactionState = (typeof CREATIVE_TRANSACTION_STATES)[number];

export type CreativeChangeArea = "story" | "storyboard" | "previs" | "render-plan" | "continuity" | "asset" | "screenplay" | "other";

export type CreativeChange = {
  area: CreativeChangeArea;
  targetIds: string[];
  summary: string;
  beforeFingerprint: string;
  afterFingerprint: string;
};

export type CreativeGenerationProvenance = {
  capabilityRole: string;
  runtime: string;
  provider: string;
  model: string;
  routeId: string;
  promptFingerprint: string;
};

export type CreativeContextProvenance = {
  taskId: string;
  profileId: string;
  sourceIds: string[];
  sourceRevisions: Array<{ sourceId: string; revision: string }>;
  generatedAt: string;
};

export type CreativeVerificationRequirement = {
  id: string;
  label: string;
  authority: "plotpickle" | "provider" | "human";
  blocking: boolean;
};

export type CreativeVerificationEvidence = {
  requirementId: string;
  authority: "plotpickle" | "provider" | "human";
  result: "PASS" | "FAIL" | "OBSERVATION";
  evidenceRef: string;
  summary: string;
  recordedAt: string;
};

export type CreativeReviewDecision = {
  status: "pending" | "accepted" | "rejected" | "revise";
  writerId: string;
  note: string;
  decidedAt: string;
};

export type CreativeTransactionProviderRef = {
  providerId: string;
  transactionId: string;
  durableRevisionId: string;
};

export type CreativeChangeSet = {
  version: typeof CREATIVE_TRANSACTION_CONTRACT_VERSION;
  changeSetId: string;
  projectId: string;
  baseCanonicalRevision: number;
  proposedCanonicalRevision: number;
  affectedIds: string[];
  changes: CreativeChange[];
  responsibilityRunIds: string[];
  generation: CreativeGenerationProvenance | null;
  context: CreativeContextProvenance | null;
  requiredCapabilities: CreativeTransactionCapability[];
  verificationRequirements: CreativeVerificationRequirement[];
  verificationEvidence: CreativeVerificationEvidence[];
  review: CreativeReviewDecision;
  transaction: CreativeTransactionProviderRef | null;
  createdAt: string;
  updatedAt: string;
  committedAt: string;
};

export type CreativeTransactionProviderDescriptor = {
  id: string;
  kind: "local" | "external";
  label: string;
  transport: "local" | "filesystem" | "git" | "rest" | "graphql" | "mcp" | "cli" | "sdk" | "other";
  capabilities: CreativeTransactionCapability[];
  priority: number;
};

export type CreativeTransactionRecord = {
  version: typeof CREATIVE_TRANSACTION_CONTRACT_VERSION;
  transactionId: string;
  providerId: string;
  changeSet: CreativeChangeSet;
  state: CreativeTransactionState;
  stagedArtifactRefs: string[];
  verificationEvidence: CreativeVerificationEvidence[];
  review: CreativeReviewDecision;
  durableRevisionId: string;
  recoverable: boolean;
  rollbackOfRevisionId: string;
  error: string;
  createdAt: string;
  updatedAt: string;
};

export type CreativeTransactionReconciliation = {
  transactionId: string;
  providerId: string;
  state: CreativeTransactionState;
  durableRevisionId: string;
  recoverable: boolean;
  evidenceComplete: boolean;
  authoritative: boolean;
  summary: string;
};

export interface CreativeTransactionProvider {
  readonly descriptor: CreativeTransactionProviderDescriptor;
  create(changeSet: CreativeChangeSet): Promise<CreativeTransactionRecord>;
  stage(transactionId: string, artifactRefs: readonly string[]): Promise<CreativeTransactionRecord>;
  diff(transactionId: string): Promise<readonly CreativeChange[]>;
  verify(transactionId: string, evidence: readonly CreativeVerificationEvidence[]): Promise<CreativeTransactionRecord>;
  requestReview(transactionId: string): Promise<CreativeTransactionRecord>;
  accept(transactionId: string, decision: Omit<CreativeReviewDecision, "status">): Promise<CreativeTransactionRecord>;
  reject(transactionId: string, decision: Omit<CreativeReviewDecision, "status">): Promise<CreativeTransactionRecord>;
  revise(transactionId: string, decision: Omit<CreativeReviewDecision, "status">): Promise<CreativeTransactionRecord>;
  commit(transactionId: string): Promise<CreativeTransactionRecord>;
  status(transactionId: string): Promise<CreativeTransactionRecord | null>;
  recover(transactionId: string): Promise<CreativeTransactionReconciliation>;
  reconcile(transactionId: string): Promise<CreativeTransactionReconciliation>;
  rollback(transactionId: string): Promise<CreativeTransactionRecord>;
}

function boundedText(value: unknown, maximum = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function unique(values: readonly string[], maximum = 256) {
  return [...new Set(values.map((value) => boundedText(value, 240)).filter(Boolean))].slice(0, maximum);
}

function timestamp(value: unknown, fallback = new Date().toISOString()) {
  const parsed = typeof value === "string" ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function integer(value: unknown, fallback = 0) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function ordered(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(ordered);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value as Record<string, unknown>)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([key, child]) => [key, ordered(child)]));
}

function hash(source: string) {
  let first = 2166136261;
  let second = 3335557771;
  for (let index = 0; index < source.length; index += 1) {
    const code = source.charCodeAt(index);
    first ^= code;
    first = Math.imul(first, 16777619);
    second ^= code + index;
    second = Math.imul(second, 2246822519);
  }
  return `${(first >>> 0).toString(16).padStart(8, "0")}${(second >>> 0).toString(16).padStart(8, "0")}`;
}

function normalizeChange(change: CreativeChange): CreativeChange {
  return {
    area: change.area,
    targetIds: unique(change.targetIds),
    summary: boundedText(change.summary, 800),
    beforeFingerprint: boundedText(change.beforeFingerprint, 160),
    afterFingerprint: boundedText(change.afterFingerprint, 160),
  };
}

function normalizeRequirement(requirement: CreativeVerificationRequirement): CreativeVerificationRequirement {
  return {
    id: boundedText(requirement.id, 160),
    label: boundedText(requirement.label, 240),
    authority: requirement.authority,
    blocking: Boolean(requirement.blocking),
  };
}

export function createCreativeChangeSet(input: {
  changeSetId: string;
  projectId: string;
  baseCanonicalRevision: number;
  affectedIds?: readonly string[];
  changes?: readonly CreativeChange[];
  responsibilityRunIds?: readonly string[];
  generation?: CreativeGenerationProvenance | null;
  context?: CreativeContextProvenance | null;
  requiredCapabilities?: readonly CreativeTransactionCapability[];
  verificationRequirements?: readonly CreativeVerificationRequirement[];
  createdAt?: string;
}): CreativeChangeSet {
  const changeSetId = boundedText(input.changeSetId, 180);
  const projectId = boundedText(input.projectId, 180);
  if (!changeSetId) throw new Error("Creative Change Set ID is required.");
  if (!projectId) throw new Error("Creative Change Set project ID is required.");
  const baseCanonicalRevision = integer(input.baseCanonicalRevision);
  const createdAt = timestamp(input.createdAt);
  return {
    version: CREATIVE_TRANSACTION_CONTRACT_VERSION,
    changeSetId,
    projectId,
    baseCanonicalRevision,
    proposedCanonicalRevision: baseCanonicalRevision + 1,
    affectedIds: unique(input.affectedIds ?? []),
    changes: (input.changes ?? []).map(normalizeChange),
    responsibilityRunIds: unique(input.responsibilityRunIds ?? [], 64),
    generation: input.generation ?? null,
    context: input.context ?? null,
    requiredCapabilities: [...new Set(input.requiredCapabilities ?? [])],
    verificationRequirements: (input.verificationRequirements ?? []).map(normalizeRequirement),
    verificationEvidence: [],
    review: { status: "pending", writerId: "", note: "", decidedAt: "" },
    transaction: null,
    createdAt,
    updatedAt: createdAt,
    committedAt: "",
  };
}

export function creativeChangeSetFingerprint(changeSet: CreativeChangeSet) {
  const stable = JSON.stringify(ordered({
    version: changeSet.version,
    changeSetId: changeSet.changeSetId,
    projectId: changeSet.projectId,
    baseCanonicalRevision: changeSet.baseCanonicalRevision,
    proposedCanonicalRevision: changeSet.proposedCanonicalRevision,
    affectedIds: changeSet.affectedIds,
    changes: changeSet.changes,
    responsibilityRunIds: changeSet.responsibilityRunIds,
    generation: changeSet.generation,
    context: changeSet.context,
    verificationRequirements: changeSet.verificationRequirements,
  }));
  return `ctx:${hash(stable)}`;
}

export function providerSupportsCapabilities(provider: CreativeTransactionProviderDescriptor, required: readonly CreativeTransactionCapability[]) {
  const available = new Set(provider.capabilities);
  return required.every((capability) => available.has(capability));
}

export function resolveCreativeTransactionProvider(
  providers: readonly CreativeTransactionProviderDescriptor[],
  required: readonly CreativeTransactionCapability[],
  options: { preferredProviderId?: string; allowFallback?: boolean } = {},
) {
  const preferredProviderId = boundedText(options.preferredProviderId, 160);
  if (preferredProviderId) {
    const preferred = providers.find((provider) => provider.id === preferredProviderId);
    if (!preferred) throw new Error(`Creative Transaction provider ${preferredProviderId} is not configured.`);
    if (providerSupportsCapabilities(preferred, required)) return preferred;
    if (!options.allowFallback) throw new Error(`Creative Transaction provider ${preferredProviderId} does not satisfy the required capabilities. No silent fallback was used.`);
  }
  const candidates = providers
    .filter((provider) => providerSupportsCapabilities(provider, required))
    .sort((left, right) => {
      if (left.kind !== right.kind) return left.kind === "local" ? -1 : 1;
      if (left.priority !== right.priority) return left.priority - right.priority;
      return left.id.localeCompare(right.id);
    });
  if (!candidates.length) throw new Error("No Creative Transaction provider satisfies the required capabilities.");
  return candidates[0];
}

export function creativeTransactionVerificationComplete(changeSet: CreativeChangeSet, evidence: readonly CreativeVerificationEvidence[]) {
  const byRequirement = new Map(evidence.map((item) => [item.requirementId, item]));
  return changeSet.verificationRequirements.every((requirement) => {
    if (!requirement.blocking) return true;
    const item = byRequirement.get(requirement.id);
    return Boolean(item && item.authority === requirement.authority && item.result === "PASS");
  });
}

export function summarizeCreativeDiff(changeSet: CreativeChangeSet) {
  const grouped = new Map<CreativeChangeArea, { changes: number; targets: Set<string>; summaries: string[] }>();
  for (const change of changeSet.changes) {
    const entry = grouped.get(change.area) ?? { changes: 0, targets: new Set<string>(), summaries: [] };
    entry.changes += 1;
    change.targetIds.forEach((targetId) => entry.targets.add(targetId));
    if (change.summary) entry.summaries.push(change.summary);
    grouped.set(change.area, entry);
  }
  return [...grouped.entries()].map(([area, entry]) => ({ area, changeCount: entry.changes, targetCount: entry.targets.size, summaries: entry.summaries }));
}

export const LOCAL_CREATIVE_TRANSACTION_PROVIDER: CreativeTransactionProviderDescriptor = {
  id: "plotpickle-local",
  kind: "local",
  label: "PlotPickle Local",
  transport: "filesystem",
  capabilities: ["durable-revision", "atomic-commit", "diff", "verification", "human-review", "rollback", "recovery", "reconcile", "artifact-storage", "offline"],
  priority: 0,
};

export const CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES: CreativeTransactionCapability[] = ["durable-revision", "verification", "human-review", "recovery"];
