import type { ResponsibilityRun } from "../agents/responsibility/responsibility-runs";
import { downstreamImpactIds } from "../preproduction/dependency-projection";
import type { CanonicalPreproductionProject } from "../preproduction/semantic-projection";
import type { StoryDependencySnapshot } from "../projects/story/story-dependencies";
import {
  CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES,
  createCreativeChangeSet,
  type CreativeChange,
  type CreativeChangeArea,
  type CreativeChangeSet,
  type CreativeContextProvenance,
  type CreativeVerificationEvidence,
  type CreativeVerificationRequirement,
} from "./creative-transaction-contract";

export const PREPRODUCTION_CREATIVE_TRANSACTION_REQUIREMENTS = {
  revisionCurrent: "preproduction.ppf-revision-current",
  impactCurrent: "preproduction.dependency-impact-current",
  stalenessCleared: "preproduction.affected-staleness-cleared",
} as const;

export type PreproductionCreativeChangeSeed = {
  readonly area: CreativeChangeArea;
  readonly targetIds: readonly string[];
  readonly summary: string;
  readonly beforeFingerprint: string;
  readonly afterFingerprint: string;
};

export type PreproductionCreativeTransactionInput = {
  readonly project: CanonicalPreproductionProject;
  readonly dependencySnapshot: StoryDependencySnapshot;
  readonly changeSetId: string;
  readonly changes: readonly PreproductionCreativeChangeSeed[];
  readonly responsibilityRun?: ResponsibilityRun | null;
  readonly additionalVerificationRequirements?: readonly CreativeVerificationRequirement[];
  readonly createdAt?: string;
};

export type PreproductionCreativeTransactionVerificationInput = {
  readonly project: Pick<CanonicalPreproductionProject, "id" | "revision">;
  readonly dependencySnapshot: StoryDependencySnapshot;
  readonly changeSet: CreativeChangeSet;
  readonly currentStaleIds?: readonly string[];
  readonly recordedAt?: string;
};

function boundedText(value: unknown, maximum = 800) {
  return String(value ?? "")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function stableIds(values: readonly string[]) {
  return [...new Set(values.map((value) => boundedText(value, 240)).filter(Boolean))].sort();
}

function timestamp(value?: string) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : new Date().toISOString();
}

function sameIds(left: readonly string[], right: readonly string[]) {
  const a = stableIds(left);
  const b = stableIds(right);
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

function graphNodeIds(snapshot: StoryDependencySnapshot) {
  return new Set(snapshot.graph.nodes.map((node) => node.id));
}

function normalizeChange(change: PreproductionCreativeChangeSeed): CreativeChange {
  const targetIds = stableIds(change.targetIds);
  const summary = boundedText(change.summary, 800);
  const beforeFingerprint = boundedText(change.beforeFingerprint, 160);
  const afterFingerprint = boundedText(change.afterFingerprint, 160);
  if (!targetIds.length) throw new Error("PRE-PRODUCTION Creative Change requires at least one stable target ref.");
  if (!summary) throw new Error("PRE-PRODUCTION Creative Change summary is required.");
  if (!beforeFingerprint || !afterFingerprint) {
    throw new Error("PRE-PRODUCTION Creative Change requires before and after fingerprints.");
  }
  return {
    area: change.area,
    targetIds,
    summary,
    beforeFingerprint,
    afterFingerprint,
  };
}

function validateResponsibilityRun(run: ResponsibilityRun) {
  if (run.kind !== "creative-proposal") {
    throw new Error("Only a creative-proposal Responsibility Run can seed a PRE-PRODUCTION Creative Change Set.");
  }
  if (run.state === "failed" || run.state === "cancelled") {
    throw new Error(`PRE-PRODUCTION Creative Change Set cannot be seeded from a ${run.state} Responsibility Run.`);
  }
  if (run.artifacts.some((artifact) => artifact.canonical !== false)) {
    throw new Error("Responsibility Run artifacts must remain non-canonical when entering a PRE-PRODUCTION Creative Transaction.");
  }
}

function contextFromRun(
  run: ResponsibilityRun | null | undefined,
  project: Pick<CanonicalPreproductionProject, "id" | "revision">,
  changeSetId: string,
  changedIds: readonly string[],
  createdAt: string,
): CreativeContextProvenance | null {
  if (!run) return null;
  validateResponsibilityRun(run);
  return {
    taskId: boundedText(run.context?.taskId || `preproduction-change:${changeSetId}`, 180),
    profileId: boundedText(run.profileId, 180),
    sourceIds: stableIds([...(run.context?.sourceIds ?? []), ...changedIds]),
    sourceRevisions: [{ sourceId: project.id, revision: String(project.revision) }],
    generatedAt: timestamp(run.context?.receiptGeneratedAt || createdAt),
  };
}

function verificationRequirements(additional: readonly CreativeVerificationRequirement[] = []) {
  const base: CreativeVerificationRequirement[] = [
    {
      id: PREPRODUCTION_CREATIVE_TRANSACTION_REQUIREMENTS.revisionCurrent,
      label: "Current PPF revision still matches the Creative Change Set base revision",
      authority: "plotpickle",
      blocking: true,
    },
    {
      id: PREPRODUCTION_CREATIVE_TRANSACTION_REQUIREMENTS.impactCurrent,
      label: "PRE-PRODUCTION dependency impact still matches the Creative Change Set affected scope",
      authority: "plotpickle",
      blocking: true,
    },
    {
      id: PREPRODUCTION_CREATIVE_TRANSACTION_REQUIREMENTS.stalenessCleared,
      label: "No affected PRE-PRODUCTION object remains stale",
      authority: "plotpickle",
      blocking: true,
    },
  ];
  const seen = new Set(base.map((requirement) => requirement.id));
  for (const requirement of additional) {
    const id = boundedText(requirement.id, 160);
    if (!id || seen.has(id)) continue;
    seen.add(id);
    base.push({ ...requirement, id });
  }
  return base;
}

function directChangeIds(changes: readonly CreativeChange[]) {
  return stableIds(changes.flatMap((change) => change.targetIds));
}

function derivedAffectedIds(snapshot: StoryDependencySnapshot, changedIds: readonly string[]) {
  return stableIds([...changedIds, ...downstreamImpactIds(snapshot, changedIds)]);
}

/**
 * Projects current #2092 stable identities and dependency impact into the
 * existing #2035 Creative Change Set contract. This bridge owns no provider,
 * canon, persistence or staleness authority.
 */
export function createPreproductionCreativeChangeSet(input: PreproductionCreativeTransactionInput): CreativeChangeSet {
  if (input.dependencySnapshot.projectId !== input.project.id) {
    throw new Error("PRE-PRODUCTION dependency snapshot belongs to a different project.");
  }
  const changes = input.changes.map(normalizeChange);
  if (!changes.length) throw new Error("PRE-PRODUCTION Creative Change Set requires at least one direct change.");

  const changedIds = directChangeIds(changes);
  const knownNodes = graphNodeIds(input.dependencySnapshot);
  const missing = changedIds.filter((id) => !knownNodes.has(id));
  if (missing.length) {
    throw new Error(`PRE-PRODUCTION Creative Change targets are missing from the dependency snapshot: ${missing.join(", ")}`);
  }

  const createdAt = timestamp(input.createdAt);
  const run = input.responsibilityRun ?? null;
  const context = contextFromRun(run, input.project, input.changeSetId, changedIds, createdAt);

  return createCreativeChangeSet({
    changeSetId: input.changeSetId,
    projectId: input.project.id,
    baseCanonicalRevision: input.project.revision,
    affectedIds: derivedAffectedIds(input.dependencySnapshot, changedIds),
    changes,
    responsibilityRunIds: run ? [run.runId] : [],
    context,
    requiredCapabilities: CANONICAL_CREATIVE_TRANSACTION_CAPABILITIES,
    verificationRequirements: verificationRequirements(input.additionalVerificationRequirements),
    createdAt,
  });
}

function evidence(
  requirementId: string,
  result: CreativeVerificationEvidence["result"],
  evidenceRef: string,
  summary: string,
  recordedAt: string,
): CreativeVerificationEvidence {
  return {
    requirementId,
    authority: "plotpickle",
    result,
    evidenceRef: boundedText(evidenceRef, 500),
    summary: boundedText(summary, 800),
    recordedAt,
  };
}

/**
 * Recomputes only the PRE-PRODUCTION facts #2092 owns and returns evidence for
 * the existing #2035 verifier. Caller-supplied stale IDs must come from current
 * Storyboard/Previs/dependency owners; this bridge does not infer staleness.
 */
export function verifyPreproductionCreativeChangeSet(
  input: PreproductionCreativeTransactionVerificationInput,
): readonly CreativeVerificationEvidence[] {
  const recordedAt = timestamp(input.recordedAt);
  const projectMatches = input.changeSet.projectId === input.project.id;
  const revisionMatches = projectMatches && input.changeSet.baseCanonicalRevision === input.project.revision;
  const revision = evidence(
    PREPRODUCTION_CREATIVE_TRANSACTION_REQUIREMENTS.revisionCurrent,
    revisionMatches ? "PASS" : "FAIL",
    `preproduction/revision/${input.project.id}/${input.project.revision}`,
    revisionMatches
      ? `PPF revision ${input.project.revision} still matches the Creative Change Set base revision.`
      : `Creative Change Set base revision ${input.changeSet.baseCanonicalRevision} does not match current PPF revision ${input.project.revision}.`,
    recordedAt,
  );

  const changedIds = directChangeIds(input.changeSet.changes);
  const knownNodes = graphNodeIds(input.dependencySnapshot);
  const directRefsKnown = changedIds.every((id) => knownNodes.has(id));
  const snapshotMatches = input.dependencySnapshot.projectId === input.project.id;
  const expectedAffected = snapshotMatches && directRefsKnown
    ? derivedAffectedIds(input.dependencySnapshot, changedIds)
    : [];
  const impactMatches = snapshotMatches && directRefsKnown && sameIds(expectedAffected, input.changeSet.affectedIds);
  const impact = evidence(
    PREPRODUCTION_CREATIVE_TRANSACTION_REQUIREMENTS.impactCurrent,
    impactMatches ? "PASS" : "FAIL",
    `preproduction/dependency-impact/${input.project.id}`,
    impactMatches
      ? `Dependency impact still resolves to ${expectedAffected.length} affected stable refs.`
      : "PRE-PRODUCTION dependency impact changed or one or more direct change refs no longer resolve; rebase/reconcile before review.",
    recordedAt,
  );

  const affected = new Set(input.changeSet.affectedIds);
  const staleAffected = stableIds(input.currentStaleIds ?? []).filter((id) => affected.has(id));
  const staleness = evidence(
    PREPRODUCTION_CREATIVE_TRANSACTION_REQUIREMENTS.stalenessCleared,
    staleAffected.length ? "FAIL" : "PASS",
    `preproduction/staleness/${input.project.id}`,
    staleAffected.length
      ? `Affected PRE-PRODUCTION refs still require revalidation: ${staleAffected.join(", ")}`
      : "No affected PRE-PRODUCTION ref is reported stale by its current authority.",
    recordedAt,
  );

  return [revision, impact, staleness];
}
