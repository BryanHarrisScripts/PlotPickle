const SHA = /^[a-f0-9]{40}$/i;
const SAFE_ID = /^[a-z0-9][a-z0-9._:-]{2,179}$/i;
const SAFE_REF = /^[a-z0-9][a-z0-9._:/@#-]{1,239}$/i;
const SAFE_PATH = /^(?!\/)(?!.*(?:^|\/)\.\.(?:\/|$))[a-z0-9._@/-]{1,240}$/i;
const SEMVER = /^(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)\.(?:0|[1-9]\d*)(?:-[0-9A-Za-z.-]+)?$/;
const FORBIDDEN_TEXT = /(?:hidden\s+(?:reasoning|chain)|chain[- ]of[- ]thought|private\s+key|password|passphrase|bearer\s+[a-z0-9._-]+|\bsk-[a-z0-9_-]{12,})/i;

const LIMITS = Object.freeze({
  attempts: 3,
  wallClockMs: 30 * 60 * 1000,
  actions: 128,
  requests: 64,
  tokens: 500_000,
  cloudCostUsd: 50,
  changedFiles: 12,
  diffLines: 1_200,
  childAgents: 2,
});

function boundedList(values, { label, pattern, maximum, allowEmpty = false }) {
  if (!Array.isArray(values) || (!allowEmpty && values.length === 0) || values.length > maximum) {
    throw new Error(`Maintainer task handoff requires bounded ${label}.`);
  }
  const normalized = [...new Set(values.map((value) => String(value || "").trim()))].sort();
  if ((!allowEmpty && normalized.length === 0) || normalized.some((value) => !pattern.test(value))) {
    throw new Error(`Maintainer task handoff contains invalid ${label}.`);
  }
  return Object.freeze(normalized);
}

function integerBudget(value, label, minimum, maximum) {
  const normalized = Number(value);
  if (!Number.isInteger(normalized) || normalized < minimum || normalized > maximum) {
    throw new Error(`Maintainer task handoff ${label} budget must be between ${minimum} and ${maximum}.`);
  }
  return normalized;
}

function pathAllowed(target, allowed) {
  return allowed.some((root) => target === root || target.startsWith(`${root.replace(/\/$/, "")}/`));
}

function normalizeUsageNumber(value, label, integer = true) {
  const normalized = Number(value ?? 0);
  if (!Number.isFinite(normalized) || normalized < 0 || (integer && !Number.isInteger(normalized))) {
    throw new Error(`Maintainer task usage ${label} is invalid.`);
  }
  return normalized;
}

export function createMaintainerTaskHandoff({
  harnessAuthority,
  taskId,
  requestedOutcome,
  exactStartingCommitSha,
  architectureSnapshot,
  permittedSkills = [],
  allowedFiles,
  allowedRoutes,
  allowedTools,
  allowedProviderIds = [],
  providerPolicyRef,
  credentialAccessRefs = [],
  budgets,
  childAgentDelegationAllowed = false,
  exclusions,
  requiredEvidence,
  resultFormatRef,
  stopConditions,
}) {
  if (
    harnessAuthority?.authorityClass !== "plotpickle-maintainer-harness-approver"
    || harnessAuthority.serverOwned !== true
    || harnessAuthority.humanProfileId !== ""
    || !SAFE_ID.test(String(harnessAuthority.approverId || ""))
  ) {
    throw new Error("Maintainer task handoff requires server-owned harness authority.");
  }

  const normalizedTaskId = String(taskId || "").trim();
  const outcome = String(requestedOutcome || "").replace(/\s+/g, " ").trim();
  const commit = String(exactStartingCommitSha || "").trim().toLowerCase();
  if (!SAFE_ID.test(normalizedTaskId) || outcome.length < 12 || outcome.length > 480 || FORBIDDEN_TEXT.test(outcome) || !SHA.test(commit)) {
    throw new Error("Maintainer task handoff requires a safe task id, bounded outcome and exact starting commit.");
  }
  if (
    architectureSnapshot?.state !== "verified"
    || architectureSnapshot.exactCommitSha !== commit
    || architectureSnapshot.operationalAuthorityGranted === true
    || architectureSnapshot.sourceMutationAllowed === true
    || !SAFE_ID.test(String(architectureSnapshot.snapshotId || ""))
  ) {
    throw new Error("Maintainer task handoff requires the verified non-operational exact-head architecture snapshot.");
  }

  if (!Array.isArray(permittedSkills) || permittedSkills.length > 16) {
    throw new Error("Maintainer task handoff permitted skills must be bounded.");
  }
  const skills = permittedSkills.map((entry) => {
    const skillId = String(entry?.skillId || "").trim();
    const version = String(entry?.version || "").trim();
    if (!SAFE_ID.test(skillId) || !SEMVER.test(version)) throw new Error("Maintainer task handoff contains an invalid skill version binding.");
    return Object.freeze({ skillId, version, key: `${skillId}@${version}` });
  });
  if (new Set(skills.map((entry) => entry.key)).size !== skills.length) {
    throw new Error("Maintainer task handoff contains duplicate skill version bindings.");
  }

  const files = boundedList(allowedFiles, { label: "allowed files", pattern: SAFE_PATH, maximum: 32 });
  const routes = boundedList(allowedRoutes, { label: "allowed routes", pattern: SAFE_REF, maximum: 24, allowEmpty: true });
  const tools = boundedList(allowedTools, { label: "allowed tools", pattern: SAFE_ID, maximum: 24 });
  const providers = boundedList(allowedProviderIds, { label: "provider ids", pattern: SAFE_ID, maximum: 12, allowEmpty: true });
  const credentialRefs = boundedList(credentialAccessRefs, { label: "credential references", pattern: SAFE_REF, maximum: 8, allowEmpty: true });
  const excluded = boundedList(exclusions, { label: "exclusions", pattern: SAFE_REF, maximum: 32 });
  const evidence = boundedList(requiredEvidence, { label: "required evidence", pattern: SAFE_REF, maximum: 32 });
  const stops = boundedList(stopConditions, { label: "stop conditions", pattern: SAFE_REF, maximum: 16 });
  const policyRef = String(providerPolicyRef || "").trim();
  const formatRef = String(resultFormatRef || "").trim();
  if (!SAFE_REF.test(policyRef) || !SAFE_REF.test(formatRef)) throw new Error("Maintainer task handoff requires provider policy and result format references.");

  const normalizedBudgets = Object.freeze({
    maximumAttempts: integerBudget(budgets?.maximumAttempts, "attempt", 1, LIMITS.attempts),
    maximumWallClockMs: integerBudget(budgets?.maximumWallClockMs, "wall-clock", 1_000, LIMITS.wallClockMs),
    maximumActions: integerBudget(budgets?.maximumActions, "action", 1, LIMITS.actions),
    maximumRequests: integerBudget(budgets?.maximumRequests, "request", 0, LIMITS.requests),
    maximumTokens: integerBudget(budgets?.maximumTokens, "token", 0, LIMITS.tokens),
    maximumCloudCostUsd: Number(budgets?.maximumCloudCostUsd),
    maximumChangedFiles: integerBudget(budgets?.maximumChangedFiles, "changed-file", 0, LIMITS.changedFiles),
    maximumDiffLines: integerBudget(budgets?.maximumDiffLines, "diff-line", 0, LIMITS.diffLines),
    maximumChildAgents: integerBudget(budgets?.maximumChildAgents, "child-agent", 0, LIMITS.childAgents),
  });
  if (!Number.isFinite(normalizedBudgets.maximumCloudCostUsd) || normalizedBudgets.maximumCloudCostUsd < 0 || normalizedBudgets.maximumCloudCostUsd > LIMITS.cloudCostUsd) {
    throw new Error(`Maintainer task handoff cloud-cost budget must be between 0 and ${LIMITS.cloudCostUsd}.`);
  }
  if (!childAgentDelegationAllowed && normalizedBudgets.maximumChildAgents !== 0) {
    throw new Error("Maintainer task handoff cannot budget child agents without explicit harness delegation.");
  }

  return Object.freeze({
    schemaVersion: 1,
    contract: "plotpickle-maintainer-bounded-task-handoff",
    taskId: normalizedTaskId,
    requestedOutcome: outcome,
    exactStartingCommitSha: commit,
    architectureSnapshotId: architectureSnapshot.snapshotId,
    architectureState: "verified",
    permittedSkills: Object.freeze(skills),
    allowedFiles: files,
    allowedRoutes: routes,
    allowedTools: tools,
    allowedProviderIds: providers,
    providerPolicyRef: policyRef,
    credentialAccessRefs: credentialRefs,
    budgets: normalizedBudgets,
    childAgentDelegationAllowed: childAgentDelegationAllowed === true,
    exclusions: excluded,
    requiredEvidence: evidence,
    resultFormatRef: formatRef,
    stopConditions: stops,
    harness: Object.freeze({
      authorityClass: harnessAuthority.authorityClass,
      serverOwned: true,
      approverId: harnessAuthority.approverId,
      humanProfileId: "",
    }),
    sourceEditingAuthorityGranted: false,
    separateCodingAuthorityRequiredForMutation: true,
    durableAdmissionAuthorityGranted: false,
    approvalAuthorityGranted: false,
    mergeAuthorityGranted: false,
    operationalAuthorityGranted: false,
    aiSelfCertified: false,
  });
}

export function evaluateMaintainerTaskBudget(handoff, usage = {}) {
  if (handoff?.contract !== "plotpickle-maintainer-bounded-task-handoff" || handoff?.harness?.serverOwned !== true) {
    throw new Error("Maintainer task budget evaluation requires a harness-owned bounded task handoff.");
  }
  const currentCommitSha = String(usage.currentCommitSha || "").trim().toLowerCase();
  if (!SHA.test(currentCommitSha)) throw new Error("Maintainer task budget evaluation requires an exact current commit SHA.");

  const counters = Object.freeze({
    attempts: normalizeUsageNumber(usage.attempts, "attempts"),
    elapsedMs: normalizeUsageNumber(usage.elapsedMs, "elapsed time"),
    actions: normalizeUsageNumber(usage.actions, "actions"),
    requests: normalizeUsageNumber(usage.requests, "requests"),
    tokens: normalizeUsageNumber(usage.tokens, "tokens"),
    cloudCostUsd: normalizeUsageNumber(usage.cloudCostUsd, "cloud cost", false),
    changedFiles: normalizeUsageNumber(usage.changedFiles, "changed files"),
    diffLines: normalizeUsageNumber(usage.diffLines, "diff lines"),
    childAgents: normalizeUsageNumber(usage.childAgents, "child agents"),
  });
  const usedTools = boundedList(usage.toolIds || [], { label: "used tools", pattern: SAFE_ID, maximum: 64, allowEmpty: true });
  const usedSkills = boundedList(usage.skillVersionKeys || [], { label: "used skill versions", pattern: SAFE_REF, maximum: 32, allowEmpty: true });
  const usedProviders = boundedList(usage.providerIds || [], { label: "used providers", pattern: SAFE_ID, maximum: 24, allowEmpty: true });
  const usedCredentialRefs = boundedList(usage.credentialRefs || [], { label: "used credential references", pattern: SAFE_REF, maximum: 16, allowEmpty: true });
  const touchedFiles = boundedList(usage.touchedFiles || [], { label: "touched files", pattern: SAFE_PATH, maximum: 64, allowEmpty: true });
  const touchedRoutes = boundedList(usage.routeIds || [], { label: "used routes", pattern: SAFE_REF, maximum: 48, allowEmpty: true });
  const violations = [];
  const budget = handoff.budgets;

  if (currentCommitSha !== handoff.exactStartingCommitSha) violations.push("exact-head-changed");
  if (counters.attempts > budget.maximumAttempts) violations.push("attempt-budget-exceeded");
  if (counters.elapsedMs > budget.maximumWallClockMs) violations.push("wall-clock-budget-exceeded");
  if (counters.actions > budget.maximumActions) violations.push("action-budget-exceeded");
  if (counters.requests > budget.maximumRequests) violations.push("request-budget-exceeded");
  if (counters.tokens > budget.maximumTokens) violations.push("token-budget-exceeded");
  if (counters.cloudCostUsd > budget.maximumCloudCostUsd) violations.push("cloud-cost-budget-exceeded");
  if (counters.changedFiles > budget.maximumChangedFiles) violations.push("changed-file-budget-exceeded");
  if (counters.diffLines > budget.maximumDiffLines) violations.push("diff-budget-exceeded");
  if (counters.childAgents > budget.maximumChildAgents) violations.push("child-agent-budget-exceeded");
  if (counters.changedFiles > 0 && usage.separateCodingAuthorityActive !== true) violations.push("source-editing-authority-missing");
  if (counters.childAgents > 0 && handoff.childAgentDelegationAllowed !== true) violations.push("child-agent-delegation-missing");
  if (usedTools.some((tool) => !handoff.allowedTools.includes(tool))) violations.push("tool-scope-exceeded");
  if (usedSkills.some((skill) => !handoff.permittedSkills.some((entry) => entry.key === skill))) violations.push("skill-scope-exceeded");
  if (usedProviders.some((provider) => !handoff.allowedProviderIds.includes(provider))) violations.push("provider-scope-exceeded");
  if (usedCredentialRefs.some((ref) => !handoff.credentialAccessRefs.includes(ref))) violations.push("credential-scope-exceeded");
  if (touchedFiles.some((file) => !pathAllowed(file, handoff.allowedFiles))) violations.push("file-scope-exceeded");
  if (touchedRoutes.some((route) => !handoff.allowedRoutes.includes(route))) violations.push("route-scope-exceeded");

  const uniqueViolations = Object.freeze([...new Set(violations)]);
  return Object.freeze({
    schemaVersion: 1,
    taskId: handoff.taskId,
    exactStartingCommitSha: handoff.exactStartingCommitSha,
    currentCommitSha,
    state: uniqueViolations.length ? "stopped" : "within-budget",
    stopRequired: uniqueViolations.length > 0,
    violations: uniqueViolations,
    usage: counters,
    learnerMayWaiveViolation: false,
    learnerMayExpandScope: false,
    learnerMayRaiseBudget: false,
    deterministicGateRequiredForSuccess: true,
    operationalAuthorityGranted: false,
    aiSelfCertified: false,
  });
}
