import { randomUUID } from "node:crypto";
import type { AutonomousGuestAuthority } from "../../core/auth/autonomous-guest/guest-authority";
import {
  commitAutonomousGuestTaskTransition,
  readAutonomousGuestTaskLedger,
  type AutonomousGuestTask,
} from "./task-ledger";

const TERMINAL_STATES = new Set(["completed", "cancelled", "expired", "failed"]);
const MAX_LEASE_MS = 5 * 60 * 1000;
const MAX_RETRY_DELAY_MS = 60 * 60 * 1000;

export type AutonomousGuestTaskPolicySnapshot = Readonly<{
  guestEnabled: boolean;
  autonomousRunId: string;
  guestWorkspaceId: string;
  projectId: string;
  allowListedTaskKinds: readonly string[];
  currentRevision: string;
  satisfiedDependencyRefs: readonly string[];
  providerPolicyRef: string;
  providerAllowed: boolean;
  budgetAllowed: boolean;
  cancelled?: boolean;
}>;

type Eligibility = Readonly<{
  state: "pending" | "eligible" | "blocked" | "cancelled" | "expired";
  failureClass: string;
}>;

function findTask(tasks: readonly AutonomousGuestTask[], taskId: string) {
  const task = tasks.find((item) => item.taskId === taskId);
  if (!task) throw new Error("Autonomous Guest task does not exist in this Guest namespace.");
  return task;
}

function policyEligibility(task: AutonomousGuestTask, policy: AutonomousGuestTaskPolicySnapshot, at: Date): Eligibility {
  if (policy.cancelled) return { state: "cancelled", failureClass: "cancelled-by-policy" };
  if (task.expiresAt && new Date(task.expiresAt).getTime() <= at.getTime()) {
    return { state: "expired", failureClass: "task-expired" };
  }
  if (!policy.guestEnabled) return { state: "blocked", failureClass: "guest-autonomous-disabled" };
  if (policy.autonomousRunId !== task.autonomousRunId || policy.guestWorkspaceId !== task.guestWorkspaceId || policy.projectId !== task.projectId) {
    return { state: "blocked", failureClass: "guest-namespace-mismatch" };
  }
  if (!policy.allowListedTaskKinds.includes(task.taskKind)) return { state: "blocked", failureClass: "task-kind-not-allowed" };
  if (task.baseRevision && policy.currentRevision !== task.baseRevision) return { state: "blocked", failureClass: "stale-revision" };
  const satisfied = new Set(policy.satisfiedDependencyRefs);
  if (task.dependencyRefs.some((ref) => !satisfied.has(ref))) return { state: "blocked", failureClass: "prerequisite-not-ready" };
  if (task.providerPolicyRef && policy.providerPolicyRef !== task.providerPolicyRef) return { state: "blocked", failureClass: "provider-policy-changed" };
  if (!policy.providerAllowed) return { state: "blocked", failureClass: "provider-not-allowed" };
  if (!policy.budgetAllowed) return { state: "blocked", failureClass: "provider-budget-blocked" };
  if (new Date(task.notBefore).getTime() > at.getTime()) return { state: "pending", failureClass: "not-before" };
  return { state: "eligible", failureClass: "" };
}

export async function revalidateAutonomousGuestTask(
  authority: AutonomousGuestAuthority,
  taskId: string,
  policy: AutonomousGuestTaskPolicySnapshot,
  at = new Date(),
) {
  const tasks = await readAutonomousGuestTaskLedger(authority);
  const task = findTask(tasks, taskId);
  if (TERMINAL_STATES.has(task.state)) return task;
  if (task.state === "running") throw new Error("Running Autonomous Guest tasks must finish, fail or lose their lease before revalidation.");
  const eligibility = policyEligibility(task, policy, at);
  const preserveRetryWait = task.state === "retry-wait" && eligibility.state === "pending";
  const nextState = preserveRetryWait ? "retry-wait" : eligibility.state;
  const terminal = nextState === "cancelled" || nextState === "expired";
  return commitAutonomousGuestTaskTransition(authority, {
    taskId,
    expectedState: task.state,
    expectedAttempt: task.attempt,
    next: Object.freeze({
      ...task,
      state: nextState,
      completedAt: terminal ? at.toISOString() : "",
      lastFailureClass: eligibility.failureClass,
      leaseId: "",
      leaseExpiresAt: "",
    }),
  });
}

export async function acquireAutonomousGuestTaskLease(
  authority: AutonomousGuestAuthority,
  taskId: string,
  options: Readonly<{ at?: Date; leaseMs?: number }> = {},
) {
  const at = options.at ?? new Date();
  const leaseMs = options.leaseMs ?? 2 * 60 * 1000;
  if (!Number.isInteger(leaseMs) || leaseMs < 1_000 || leaseMs > MAX_LEASE_MS) {
    throw new Error("Autonomous Guest task lease must be between 1 second and 5 minutes.");
  }
  const tasks = await readAutonomousGuestTaskLedger(authority);
  const task = findTask(tasks, taskId);
  if (task.state !== "eligible") return null;
  if (new Date(task.notBefore).getTime() > at.getTime()) return null;
  if (task.expiresAt && new Date(task.expiresAt).getTime() <= at.getTime()) return null;
  if (task.attempt >= task.maxAttempts) return null;
  if (task.affectsCanon) {
    const canonBusy = tasks.some((item) => item.taskId !== task.taskId
      && item.projectId === task.projectId
      && item.affectsCanon
      && item.state === "running"
      && item.leaseExpiresAt
      && new Date(item.leaseExpiresAt).getTime() > at.getTime());
    if (canonBusy) return null;
  }
  const leaseId = `guest-lease-${randomUUID()}`;
  return commitAutonomousGuestTaskTransition(authority, {
    taskId,
    expectedState: task.state,
    expectedAttempt: task.attempt,
    next: Object.freeze({
      ...task,
      state: "running",
      attempt: task.attempt + 1,
      startedAt: at.toISOString(),
      completedAt: "",
      lastFailureClass: "",
      leaseId,
      leaseExpiresAt: new Date(at.getTime() + leaseMs).toISOString(),
    }),
  });
}

export async function completeAutonomousGuestTask(
  authority: AutonomousGuestAuthority,
  taskId: string,
  leaseId: string,
  resultRefs: readonly string[],
  at = new Date(),
) {
  const tasks = await readAutonomousGuestTaskLedger(authority);
  const task = findTask(tasks, taskId);
  if (task.state !== "running" || task.leaseId !== leaseId) throw new Error("Autonomous Guest task completion requires its current running lease.");
  return commitAutonomousGuestTaskTransition(authority, {
    taskId,
    expectedState: "running",
    expectedAttempt: task.attempt,
    expectedLeaseId: leaseId,
    next: Object.freeze({
      ...task,
      state: "completed",
      completedAt: at.toISOString(),
      lastFailureClass: "",
      resultRefs: Object.freeze([...resultRefs]),
      leaseId: "",
      leaseExpiresAt: "",
    }),
  });
}

export async function failAutonomousGuestTask(
  authority: AutonomousGuestAuthority,
  taskId: string,
  leaseId: string,
  input: Readonly<{ failureClass: string; retryable: boolean; retryDelayMs?: number; at?: Date }>,
) {
  const at = input.at ?? new Date();
  const retryDelayMs = input.retryDelayMs ?? 5_000;
  if (!Number.isInteger(retryDelayMs) || retryDelayMs < 1_000 || retryDelayMs > MAX_RETRY_DELAY_MS) {
    throw new Error("Autonomous Guest task retry delay must be between 1 second and 1 hour.");
  }
  const tasks = await readAutonomousGuestTaskLedger(authority);
  const task = findTask(tasks, taskId);
  if (task.state !== "running" || task.leaseId !== leaseId) throw new Error("Autonomous Guest task failure requires its current running lease.");
  const retry = input.retryable && task.attempt < task.maxAttempts && (!task.expiresAt || new Date(task.expiresAt).getTime() > at.getTime() + retryDelayMs);
  return commitAutonomousGuestTaskTransition(authority, {
    taskId,
    expectedState: "running",
    expectedAttempt: task.attempt,
    expectedLeaseId: leaseId,
    next: Object.freeze({
      ...task,
      state: retry ? "retry-wait" : "failed",
      notBefore: retry ? new Date(at.getTime() + retryDelayMs).toISOString() : task.notBefore,
      completedAt: retry ? "" : at.toISOString(),
      lastFailureClass: input.failureClass,
      leaseId: "",
      leaseExpiresAt: "",
    }),
  });
}

export async function cancelAutonomousGuestTask(authority: AutonomousGuestAuthority, taskId: string, at = new Date()) {
  const tasks = await readAutonomousGuestTaskLedger(authority);
  const task = findTask(tasks, taskId);
  if (TERMINAL_STATES.has(task.state)) return task;
  return commitAutonomousGuestTaskTransition(authority, {
    taskId,
    expectedState: task.state,
    expectedAttempt: task.attempt,
    expectedLeaseId: task.state === "running" ? task.leaseId : undefined,
    next: Object.freeze({
      ...task,
      state: "cancelled",
      completedAt: at.toISOString(),
      lastFailureClass: "cancelled-by-policy",
      leaseId: "",
      leaseExpiresAt: "",
    }),
  });
}

export async function listDueAutonomousGuestTasks(authority: AutonomousGuestAuthority, at = new Date()) {
  const now = at.getTime();
  const tasks = await readAutonomousGuestTaskLedger(authority);
  return Object.freeze(tasks
    .filter((task) => ["pending", "eligible", "retry-wait", "blocked"].includes(task.state))
    .filter((task) => new Date(task.notBefore).getTime() <= now)
    .filter((task) => !task.expiresAt || new Date(task.expiresAt).getTime() > now)
    .sort((left, right) => right.priority - left.priority || left.createdAt.localeCompare(right.createdAt)));
}
