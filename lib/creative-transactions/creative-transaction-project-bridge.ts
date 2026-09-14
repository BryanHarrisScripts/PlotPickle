import type { ResponsibilityRun } from "../agents/responsibility/responsibility-runs";
import type { PlotPickleProject } from "../projects/project";
import {
  applyWriterApprovedCanonicalProposal,
  canonicalProposalById,
  createCanonicalProposal,
  currentProjectRevision,
  type CanonicalProposalKind,
  type WriterApproval,
} from "../projects/persistence/project-revisions";
import {
  CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES,
  createCreativeChangeSet,
  creativeChangeSetFingerprint,
  type CreativeChange,
  type CreativeChangeSet,
  type CreativeTransactionRecord,
  type CreativeVerificationRequirement,
} from "./creative-transaction-contract";

function canonicalKind(changeSet: CreativeChangeSet): CanonicalProposalKind {
  const areas = new Set(changeSet.changes.map((change) => change.area));
  if (areas.size === 1 && areas.has("story")) return "story";
  if (areas.size === 1 && areas.has("asset")) return "asset";
  if (areas.size === 1 && areas.has("screenplay")) return "screenplay";
  return "other";
}

export function creativeChangeSetFromResponsibilityRun(input: {
  project: PlotPickleProject;
  run: ResponsibilityRun;
  changeSetId: string;
  changes: readonly CreativeChange[];
  affectedIds?: readonly string[];
  verificationRequirements?: readonly CreativeVerificationRequirement[];
  createdAt?: string;
}) {
  if (input.run.kind !== "creative-proposal") {
    throw new Error("Only a creative-proposal Responsibility Run can seed a Creative Change Set.");
  }
  if (input.run.state === "failed" || input.run.state === "cancelled") {
    throw new Error(`Creative Change Set cannot be seeded from a ${input.run.state} Responsibility Run.`);
  }
  if (input.run.artifacts.some((artifact) => artifact.canonical !== false)) {
    throw new Error("Responsibility Run artifacts must remain non-canonical when entering a Creative Transaction.");
  }
  const context = input.run.context ? {
    taskId: input.run.context.taskId,
    profileId: input.run.profileId,
    sourceIds: input.run.context.sourceIds,
    sourceRevisions: [] as Array<{ sourceId: string; revision: string }>,
    generatedAt: input.run.context.receiptGeneratedAt,
  } : null;
  return createCreativeChangeSet({
    changeSetId: input.changeSetId,
    projectId: input.project.id,
    baseCanonicalRevision: currentProjectRevision(input.project),
    affectedIds: input.affectedIds,
    changes: input.changes,
    responsibilityRunIds: [input.run.runId],
    context,
    requiredCapabilities: CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES,
    verificationRequirements: input.verificationRequirements,
    createdAt: input.createdAt,
  });
}

export function createCanonicalProposalForCreativeTransaction(input: {
  project: PlotPickleProject;
  transaction: CreativeTransactionRecord;
  profileId: string;
  skillUri?: string;
  safeSummary?: string;
}) {
  const { transaction, project } = input;
  if (transaction.state !== "committed" || !transaction.durableRevisionId) {
    throw new Error("Only a durable committed Creative Transaction can propose PPF canon admission.");
  }
  if (transaction.changeSet.review.status !== "accepted" || !transaction.changeSet.review.writerId) {
    throw new Error("Creative Transaction requires explicit Human acceptance before PPF proposal creation.");
  }
  if (transaction.changeSet.baseCanonicalRevision !== currentProjectRevision(project)) {
    throw new Error("Creative Transaction is stale relative to the current PPF revision. Reconcile/rebase before canon admission.");
  }
  return createCanonicalProposal(project, {
    kind: canonicalKind(transaction.changeSet),
    targetIds: transaction.changeSet.affectedIds,
    profileId: input.profileId,
    skillUri: input.skillUri,
    runId: transaction.changeSet.responsibilityRunIds[0],
    sourceKind: "plotpickle-agent",
    contentFingerprint: creativeChangeSetFingerprint(transaction.changeSet),
    safeSummary: input.safeSummary || `Creative Transaction ${transaction.transactionId} committed as provider state ${transaction.durableRevisionId}; awaiting separate PPF writer approval.`,
    generation: transaction.changeSet.generation,
    generatedAt: transaction.changeSet.updatedAt,
  });
}

export function applyCommittedCreativeTransactionToCanon(input: {
  project: PlotPickleProject;
  approvedProject: PlotPickleProject;
  transaction: CreativeTransactionRecord;
  proposalId: string;
  approval: WriterApproval;
}) {
  if (input.transaction.state !== "committed" || !input.transaction.durableRevisionId) {
    throw new Error("PPF canon cannot apply from a Creative Transaction that is not durably committed.");
  }
  if (input.transaction.changeSet.review.status !== "accepted") {
    throw new Error("PPF canon cannot apply from a Creative Transaction without accepted Human review.");
  }
  const proposal = canonicalProposalById(input.project, input.proposalId);
  if (!proposal) throw new Error(`Canonical proposal ${input.proposalId} was not found.`);
  const expectedFingerprint = creativeChangeSetFingerprint(input.transaction.changeSet);
  if (proposal.contentFingerprint !== expectedFingerprint) {
    throw new Error("Canonical proposal fingerprint does not match the committed Creative Change Set.");
  }
  return applyWriterApprovedCanonicalProposal({
    project: input.project,
    proposalId: input.proposalId,
    approvedProject: input.approvedProject,
    approval: input.approval,
  });
}
