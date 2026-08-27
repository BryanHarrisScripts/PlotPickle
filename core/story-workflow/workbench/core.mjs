export const STORY_WORKBENCH_VERSION = 1;
export const STORY_WORKBENCH_AXIS_STATUSES = ["PASS", "FINDINGS", "NOT APPLICABLE"];

const MATERIAL_RESPONSE_CLASSES = new Set(["accept-proposal", "select-alternative", "modify-proposal", "freeform-decision"]);
const NO_CHANGE_RESPONSE_CLASSES = new Set(["reject-proposal", "keep-current"]);
const OPEN_DECISION_STATUSES = new Set(["new", "reviewing", "deferred"]);

function text(value, maximum = 4_000) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function strings(value, maximum = 128, itemMaximum = 360) {
  return [...new Set((Array.isArray(value) ? value : []).map((item) => text(item, itemMaximum)).filter(Boolean))].slice(0, maximum);
}

function integer(value, fallback = -1) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  if (!value || typeof value !== "object") return JSON.stringify(value);
  return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, child]) => `${JSON.stringify(key)}:${stable(child)}`).join(",")}}`;
}

function hashText(value) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function axis(id, status, summary, blocking = false) {
  return { id, status, summary: text(summary, 1_200), blocking: Boolean(blocking) };
}

export function normalizeStoryChangePackage(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("Story Workbench requires a structured Story Change Package.");
  const projectId = text(input.projectId, 240);
  const decisionId = text(input.decisionId, 180);
  const responseId = text(input.responseId, 180);
  const responseClass = text(input.responseClass, 80);
  const baseRevision = integer(input.baseRevision);
  if (!projectId || !decisionId || !responseId || baseRevision < 0) throw new Error("Story Change Package requires project, Decision, response and base revision identity.");
  if (!MATERIAL_RESPONSE_CLASSES.has(responseClass) && !NO_CHANGE_RESPONSE_CLASSES.has(responseClass)) {
    throw new Error(`Story Decision response ${responseClass || "missing"} is not ready for Workbench completion.`);
  }
  const targetRef = text(input.operation?.targetRef, 360);
  const value = text(input.operation?.value, 8_000);
  const requiresCanonApply = MATERIAL_RESPONSE_CLASSES.has(responseClass);
  if (requiresCanonApply && (!targetRef || !value)) throw new Error("A material Story Change Package requires one explicit target and proposed value.");
  const createdAt = text(input.createdAt, 60) || new Date().toISOString();
  return {
    schemaVersion: STORY_WORKBENCH_VERSION,
    packageId: text(input.packageId, 180) || `story-change-${hashText(stable({ projectId, decisionId, responseId, baseRevision, targetRef, value }))}`,
    projectId,
    decisionId,
    responseId,
    responseClass,
    baseRevision,
    targetRefs: strings(input.targetRefs),
    operation: requiresCanonApply ? {
      kind: "set",
      targetRef,
      beforeValue: text(input.operation?.beforeValue, 8_000),
      value,
      author: input.operation?.author === "human" ? "human" : "agent-proposed",
    } : null,
    curriculumRefs: strings(input.curriculumRefs, 64, 360),
    evidenceRefs: strings(input.evidenceRefs),
    predictedImpactRefs: strings(input.predictedImpactRefs),
    provenance: {
      humanProfileId: text(input.provenance?.humanProfileId, 180),
      runRefs: strings(input.provenance?.runRefs, 64, 180),
      councilResultId: text(input.provenance?.councilResultId, 180),
      rationale: text(input.provenance?.rationale, 2_000),
    },
    requiresCanonApply,
    createdAt,
  };
}

export function reviewStoryChangePackage(input) {
  const storyPackage = normalizeStoryChangePackage(input.package);
  const currentRevision = integer(input.currentRevision);
  const projectMatches = Boolean(input.projectMatches);
  const targetOwned = storyPackage.requiresCanonApply ? Boolean(input.targetOwned) : true;
  const frontierEditable = storyPackage.requiresCanonApply ? Boolean(input.frontierEditable) : true;
  const derivedTarget = Boolean(input.derivedTarget);
  const importedEvidenceTarget = Boolean(input.importedEvidenceTarget);
  const lockedPrerequisite = Boolean(input.lockedPrerequisite);
  const exactRevision = currentRevision === storyPackage.baseRevision;

  const axes = [
    axis("canon-authority", projectMatches && exactRevision && !derivedTarget && !importedEvidenceTarget ? "PASS" : "FINDINGS",
      !projectMatches ? "The active project does not match this Story Decision."
        : !exactRevision ? `This package was reviewed at revision ${storyPackage.baseRevision}; the active story is revision ${currentRevision}. Recompute before applying.`
          : derivedTarget ? "Derived graph/index data is read-only evidence and cannot be targeted as canon."
            : importedEvidenceTarget ? "Imported screenplay/source evidence cannot be overwritten as project canon."
              : storyPackage.requiresCanonApply ? "The Human response targets the active canonical PPF through the Story Command boundary." : "The Human chose to keep/reject the proposed change; no canonical mutation is required.", true),
    axis("curriculum-spec", targetOwned && frontierEditable && !lockedPrerequisite ? "PASS" : "FINDINGS",
      !targetOwned ? "The requested target is not a current canonical curriculum field."
        : lockedPrerequisite ? "The target belongs to a Locked prerequisite/frontier and cannot be changed through Workbench."
          : !frontierEditable ? "The target exists but its current PLAN frontier is not editable yet."
            : "The target is owned by an available current curriculum frontier.", true),
    axis("continuity-consistency", "NOT APPLICABLE",
      "No deterministic continuity contradiction is asserted from this field edit alone. Dependency-backed downstream checks remain visible for targeted re-evaluation."),
    axis("structural-impact", input.structuralImpact ? "FINDINGS" : "NOT APPLICABLE",
      input.structuralImpact ? "The Decision references structural placement outside this bounded field operation. Workbench will not infer a Block/scene move from a global choice." : "This package does not claim to establish or move exact Block/scene placement.", Boolean(input.structuralImpact)),
    axis("visual-script-impact", input.visualScriptImpact ? "FINDINGS" : "NOT APPLICABLE",
      input.visualScriptImpact ? "Existing visual/script projections are dependency evidence that may become stale; they are not regenerated automatically." : "No visual/script projection is directly evidenced as affected by this package."),
  ];
  const blockingFindings = axes.filter((item) => item.status === "FINDINGS" && item.blocking);
  return {
    package: storyPackage,
    axes,
    canComplete: blockingFindings.length === 0,
    canApply: storyPackage.requiresCanonApply && blockingFindings.length === 0,
    requiresCanonApply: storyPackage.requiresCanonApply,
    blockingFindingCount: blockingFindings.length,
  };
}

export function storyWorkbenchImpactMap(input) {
  const storyPackage = normalizeStoryChangePackage(input.package);
  const directChangedRefs = storyPackage.operation ? [storyPackage.operation.targetRef] : [];
  const dependencyEvidenceRefs = strings(input.dependencyEvidenceRefs ?? storyPackage.predictedImpactRefs);
  const explainableRefs = [...new Set([...directChangedRefs, ...dependencyEvidenceRefs])];
  const staleProjectionRefs = explainableRefs.filter((ref) => /(?:visual|storyboard|frame|shot|screenplay|script|draft)/i.test(ref));
  return {
    directChangedRefs,
    dependencyEvidenceRefs,
    explainableRefs,
    staleProjectionRefs,
    unaffectedByDefault: true,
  };
}

function intersects(left, right) {
  const set = new Set(strings(right));
  return strings(left).some((value) => set.has(value));
}

export function storyDecisionReconciliationPlan(records, input) {
  const projectId = text(input.projectId, 240);
  const currentRevision = String(integer(input.currentRevision, 0));
  const sourceDecisionIds = new Set(strings(input.sourceDecisionIds, 64, 180));
  const satisfiedDecisionIds = new Set(strings(input.satisfiedDecisionIds, 64, 180));
  const affectedRefs = strings(input.affectedRefs);
  const staleDecisionIds = [];
  const withdrawDecisionIds = [];
  for (const record of Array.isArray(records) ? records : []) {
    const decisionId = text(record?.decisionId, 180);
    if (!decisionId || text(record?.projectId, 240) !== projectId || sourceDecisionIds.has(decisionId)) continue;
    if (!OPEN_DECISION_STATUSES.has(record?.status)) continue;
    if (satisfiedDecisionIds.has(decisionId)) {
      withdrawDecisionIds.push(decisionId);
      continue;
    }
    if (intersects(record?.targetRefs, affectedRefs) || intersects(record?.predictedImpactRefs, affectedRefs)) staleDecisionIds.push(decisionId);
  }
  return { currentRevision, staleDecisionIds, withdrawDecisionIds };
}

export function storyWorkbenchConvergenceTelemetry(input) {
  const integerValue = (value) => Math.max(0, Number.isFinite(Number(value)) ? Math.floor(Number(value)) : 0);
  return {
    openRequiredDecisions: integerValue(input.openRequiredDecisions),
    unresolvedHighMediumFindings: integerValue(input.unresolvedHighMediumFindings),
    missingCurrentFrontierRequirements: integerValue(input.missingCurrentFrontierRequirements),
    staleWorkOrProposals: integerValue(input.staleWorkOrProposals),
    specialistDisagreements: integerValue(input.specialistDisagreements),
    affectedWorkItemsRerun: integerValue(input.affectedWorkItemsRerun),
    newMaterialFindings: integerValue(input.newMaterialFindings),
    currentFrontierBlockers: strings(input.currentFrontierBlockers, 64, 360),
  };
}
