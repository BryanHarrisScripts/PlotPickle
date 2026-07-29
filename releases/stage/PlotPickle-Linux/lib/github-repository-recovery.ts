import type { PublicGitHubCommandEntry } from "./github-command-outbox";

export const GITHUB_REPOSITORY_RECOVERY_VERSION = 1 as const;
export const GITHUB_REPOSITORY_RECOVERY_BRANCH_LIMIT = 20;

export type GitHubRepositoryRecoveryState =
  | "disconnected"
  | "offline"
  | "authentication"
  | "repository-missing"
  | "repository-moved"
  | "branch-missing"
  | "project-mismatch"
  | "ready";

export type VerifiedRecoveryBranch = {
  name: string;
  commitSha: string;
  projectId: string;
};

export type GitHubConflictReviewCandidate = {
  id: string;
  commandType: PublicGitHubCommandEntry["type"];
  label: string;
  repository: string;
  branch: string;
  expectedCommit: string;
  reason: string;
  nextAction: string;
};

export type GitHubRepositoryRecoveryDiagnosis = {
  version: 1;
  connected: boolean;
  state: GitHubRepositoryRecoveryState;
  repository: string;
  resolvedRepository: string;
  branch: string;
  defaultBranch: string;
  moved: boolean;
  branchMissing: boolean;
  expectedProjectId: string;
  projectId: string;
  recoveryCommit: string;
  verifiedBranches: VerifiedRecoveryBranch[];
  canAdoptRepository: boolean;
  canRecreateBranch: boolean;
  message: string;
  conflicts: GitHubConflictReviewCandidate[];
};

function text(value: unknown, maximum = 500) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

export function safeRecoveryProjectId(value: unknown) {
  const projectId = text(value, 240);
  if (!projectId || /[\u0000-\u001f]/.test(projectId)) throw new Error("Choose the active PlotPickle project before recovering GitHub.");
  return projectId;
}

export function safeRecoveryRepository(value: unknown) {
  const repository = text(value, 240);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("Choose a valid GitHub owner/repository.");
  return repository;
}

export function safeRecoveryBranch(value: unknown) {
  const branch = text(value, 240);
  if (!branch || branch.startsWith("/") || branch.endsWith("/") || branch.includes("..") || /[~^:?*\\\s\u0000-\u001f]/.test(branch)) {
    throw new Error("Choose a valid GitHub branch.");
  }
  return branch;
}

export function repositoryMoved(configured: unknown, resolved: unknown) {
  return safeRecoveryRepository(configured).toLowerCase() !== safeRecoveryRepository(resolved).toLowerCase();
}

export function assertRecoveryProjectIdentity(expectedValue: unknown, actualValue: unknown) {
  const expected = safeRecoveryProjectId(expectedValue);
  const actual = safeRecoveryProjectId(actualValue);
  if (expected !== actual) throw new Error("The recovered repository or branch belongs to a different PlotPickle project.");
  return actual;
}

export function verifiedRecoveryBranches(value: unknown, expectedProjectIdValue: unknown) {
  const expectedProjectId = safeRecoveryProjectId(expectedProjectIdValue);
  if (!Array.isArray(value)) return [];
  const unique = new Map<string, VerifiedRecoveryBranch>();
  for (const item of value.slice(0, GITHUB_REPOSITORY_RECOVERY_BRANCH_LIMIT * 2)) {
    if (!item || typeof item !== "object") continue;
    const branch = item as Partial<VerifiedRecoveryBranch>;
    try {
      const name = safeRecoveryBranch(branch.name);
      const commitSha = text(branch.commitSha, 100);
      const projectId = safeRecoveryProjectId(branch.projectId);
      if (!/^[a-f0-9]{40}$/i.test(commitSha) || projectId !== expectedProjectId) continue;
      if (!unique.has(name.toLowerCase())) unique.set(name.toLowerCase(), { name, commitSha, projectId });
    } catch {
      // Invalid or wrong-project branches are deliberately omitted.
    }
  }
  return [...unique.values()].slice(0, GITHUB_REPOSITORY_RECOVERY_BRANCH_LIMIT);
}

export function conflictReviewCandidates(entries: PublicGitHubCommandEntry[]) {
  return entries.flatMap((entry): GitHubConflictReviewCandidate[] => {
    if (entry.state !== "needs-review" || entry.failureClass !== "review-required") return [];
    return [{
      id: entry.id,
      commandType: entry.type,
      label: entry.label,
      repository: entry.repository,
      branch: entry.branch,
      expectedCommit: entry.baseCommit,
      reason: text(entry.lastError, 700) || "The approved GitHub state changed after this command was prepared.",
      nextAction: "Refresh the approved story and open the originating workflow for a human comparison. PlotPickle will not choose local or remote content automatically.",
    }];
  }).sort((left, right) => left.label.localeCompare(right.label));
}

export function buildRepositoryRecoveryDiagnosis(input: {
  connected: boolean;
  state?: GitHubRepositoryRecoveryState;
  repository?: unknown;
  resolvedRepository?: unknown;
  branch?: unknown;
  defaultBranch?: unknown;
  expectedProjectId?: unknown;
  projectId?: unknown;
  branchMissing?: boolean;
  recoveryCommit?: unknown;
  verifiedBranches?: unknown;
  message?: unknown;
  conflicts?: PublicGitHubCommandEntry[];
}): GitHubRepositoryRecoveryDiagnosis {
  const conflicts = conflictReviewCandidates(input.conflicts ?? []);
  if (!input.connected) {
    return {
      version: 1,
      connected: false,
      state: "disconnected",
      repository: "",
      resolvedRepository: "",
      branch: "",
      defaultBranch: "",
      moved: false,
      branchMissing: false,
      expectedProjectId: text(input.expectedProjectId, 240),
      projectId: "",
      recoveryCommit: "",
      verifiedBranches: [],
      canAdoptRepository: false,
      canRecreateBranch: false,
      message: text(input.message, 700) || "GitHub is not connected on this computer.",
      conflicts,
    };
  }

  const repository = safeRecoveryRepository(input.repository);
  const resolvedRepository = safeRecoveryRepository(input.resolvedRepository ?? repository);
  const branch = safeRecoveryBranch(input.branch);
  const defaultBranch = safeRecoveryBranch(input.defaultBranch ?? branch);
  const expectedProjectId = safeRecoveryProjectId(input.expectedProjectId);
  const projectId = text(input.projectId, 240);
  const moved = repositoryMoved(repository, resolvedRepository);
  const branchMissing = input.branchMissing === true;
  const branches = verifiedRecoveryBranches(input.verifiedBranches, expectedProjectId);
  const recoveryCommit = text(input.recoveryCommit, 100);
  const identityMatches = Boolean(projectId) && projectId === expectedProjectId;
  const verifiedRecoverySource = identityMatches || branches.length > 0 || (/^[a-f0-9]{40}$/i.test(recoveryCommit) && Boolean(expectedProjectId));
  let state = input.state ?? "ready";
  if (projectId && !identityMatches) state = "project-mismatch";
  else if (branchMissing) state = "branch-missing";
  else if (moved) state = "repository-moved";

  return {
    version: 1,
    connected: true,
    state,
    repository,
    resolvedRepository,
    branch,
    defaultBranch,
    moved,
    branchMissing,
    expectedProjectId,
    projectId,
    recoveryCommit: /^[a-f0-9]{40}$/i.test(recoveryCommit) ? recoveryCommit : "",
    verifiedBranches: branches,
    canAdoptRepository: moved && state !== "project-mismatch" && verifiedRecoverySource,
    canRecreateBranch: branchMissing && /^[a-f0-9]{40}$/i.test(recoveryCommit) && verifiedRecoverySource,
    message: text(input.message, 700) || (state === "ready"
      ? "The configured repository and approved branch match this PlotPickle project."
      : "GitHub recovery needs a deliberate Project Lead action."),
    conflicts,
  };
}
