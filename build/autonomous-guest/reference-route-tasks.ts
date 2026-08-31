import type { AutonomousGuestAuthority } from "../../core/auth/autonomous-guest/guest-authority";
import {
  autonomousGuestRegisteredRouteIds,
  enqueueAutonomousGuestRouteTask,
} from "./recovery/route-task-policy";
import {
  readAutonomousGuestRunPolicy,
  resolveAutonomousGuestStoredRouteTaskPolicy,
  writeAutonomousGuestRunPolicy,
} from "./policy/run-policy-store";
import {
  acquireAutonomousGuestTaskLease,
  completeAutonomousGuestTask,
  failAutonomousGuestTask,
  revalidateAutonomousGuestTask,
} from "./task-lifecycle";
import { readAutonomousGuestTaskLedger, type AutonomousGuestTask } from "./task-ledger";

const PROVIDER_POLICY_REF = "reference-route-audit:no-provider";
const REFERENCE_DEDUPE_PREFIX = "reference-route-post-restart";
const MAX_REFERENCE_ROUTES = 24;
const SAFE_REF = /^[a-z0-9][a-z0-9._:/-]{0,239}$/i;
const TERMINAL_STATES = new Set(["completed", "cancelled", "expired", "failed"]);

export type InitializeAutonomousGuestReferenceTasksInput = Readonly<{
  projectId: string;
  currentRevision: string;
  routeIds: readonly string[];
  routeInputs?: Readonly<Record<string, string>>;
}>;

export type FinishAutonomousGuestReferenceTaskInput = Readonly<{
  routeId: string;
  taskId: string;
  leaseId: string;
  disposition: string;
  actionId?: string;
  revision?: string;
}>;

function safeRef(value: string, label: string) {
  const normalized = String(value || "").trim();
  if (!SAFE_REF.test(normalized)) throw new Error(`Autonomous Guest reference ${label} is missing or invalid.`);
  return normalized;
}

function revisionToken(value: string) {
  return `ppf:${safeRef(value, "PPF revision")}`;
}

function assertAuthority(authority: AutonomousGuestAuthority) {
  if (authority.authorityClass !== "delegated-guest-autonomous-operator" || authority.delegated !== true || authority.humanProfileId !== "") {
    throw new Error("Autonomous Guest reference tasks require delegated non-Human authority.");
  }
}

function referenceDedupeKey(authority: AutonomousGuestAuthority, revision: string, routeId: string) {
  return `${REFERENCE_DEDUPE_PREFIX}:${authority.autonomousRunId}:${revision}:${routeId}`;
}

function routeIdFromTask(task: AutonomousGuestTask) {
  return task.taskKind.startsWith("route:") ? task.taskKind.slice("route:".length) : "";
}

function latestReferenceTask(tasks: readonly AutonomousGuestTask[], authority: AutonomousGuestAuthority, routeId: string) {
  const matches = tasks
    .filter((task) => routeIdFromTask(task) === routeId
      && task.autonomousRunId === authority.autonomousRunId
      && task.guestWorkspaceId === authority.workspaceId
      && task.dedupeKey.startsWith(`${REFERENCE_DEDUPE_PREFIX}:${authority.autonomousRunId}:`))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  return matches.find((task) => !TERMINAL_STATES.has(task.state)) || matches[0] || null;
}

export async function initializeAutonomousGuestReferenceTasks(
  authority: AutonomousGuestAuthority,
  input: InitializeAutonomousGuestReferenceTasksInput,
) {
  assertAuthority(authority);
  const projectId = safeRef(input.projectId, "project ID");
  const currentRevision = revisionToken(input.currentRevision);
  const registered = new Set(autonomousGuestRegisteredRouteIds());
  const routeIds = [...new Set(input.routeIds.map((routeId) => safeRef(routeId, "route ID")))];
  if (!routeIds.length || routeIds.length > MAX_REFERENCE_ROUTES) throw new Error("Autonomous Guest reference route set is empty or too large.");
  if (routeIds.some((routeId) => !registered.has(routeId))) throw new Error("Autonomous Guest reference contains an unregistered route.");

  const tasks = [];
  for (const routeId of routeIds) {
    tasks.push(await enqueueAutonomousGuestRouteTask(authority, {
      projectId,
      routeId,
      routeInputs: input.routeInputs,
      baseRevision: currentRevision,
      providerPolicyRef: PROVIDER_POLICY_REF,
      maxAttempts: 2,
      dedupeKey: referenceDedupeKey(authority, currentRevision, routeId),
    }));
  }
  const satisfiedDependencyRefs = [...new Set(tasks.flatMap((task) => task.dependencyRefs))];
  await writeAutonomousGuestRunPolicy(authority, {
    enabled: true,
    autonomousRunId: authority.autonomousRunId,
    guestWorkspaceId: authority.workspaceId,
    projectId,
    currentRevision,
    allowedRouteIds: routeIds,
    satisfiedDependencyRefs,
    providerPolicyRef: PROVIDER_POLICY_REF,
    providerAllowed: true,
    budgetAllowed: true,
    cancelled: false,
  });

  const eligible = [];
  for (const task of tasks) {
    const policy = await resolveAutonomousGuestStoredRouteTaskPolicy(authority, task);
    eligible.push(await revalidateAutonomousGuestTask(authority, task.taskId, policy));
  }
  return Object.freeze({
    projectId,
    currentRevision,
    providerPolicyRef: PROVIDER_POLICY_REF,
    routeIds: Object.freeze(routeIds),
    tasks: Object.freeze(eligible.map((task) => Object.freeze({ taskId: task.taskId, routeId: routeIdFromTask(task), state: task.state, failureClass: task.lastFailureClass }))),
  });
}

export async function claimAutonomousGuestReferenceRouteTask(authority: AutonomousGuestAuthority, routeIdValue: string) {
  assertAuthority(authority);
  const routeId = safeRef(routeIdValue, "route ID");
  const tasks = await readAutonomousGuestTaskLedger(authority);
  const task = latestReferenceTask(tasks, authority, routeId);
  if (!task) throw new Error("Autonomous Guest reference route has no durable task.");
  if (TERMINAL_STATES.has(task.state)) return Object.freeze({ taskId: task.taskId, routeId, state: task.state, leaseId: "", failureClass: task.lastFailureClass });
  const policy = await resolveAutonomousGuestStoredRouteTaskPolicy(authority, task);
  const revalidated = await revalidateAutonomousGuestTask(authority, task.taskId, policy);
  if (revalidated.state !== "eligible") return Object.freeze({ taskId: task.taskId, routeId, state: revalidated.state, leaseId: "", failureClass: revalidated.lastFailureClass });
  const leased = await acquireAutonomousGuestTaskLease(authority, task.taskId, { leaseMs: 5 * 60 * 1000 });
  if (!leased) throw new Error("Autonomous Guest reference route could not acquire its bounded task lease.");
  return Object.freeze({ taskId: leased.taskId, routeId, state: leased.state, leaseId: leased.leaseId, failureClass: "" });
}

export async function finishAutonomousGuestReferenceRouteTask(
  authority: AutonomousGuestAuthority,
  input: FinishAutonomousGuestReferenceTaskInput,
) {
  assertAuthority(authority);
  const routeId = safeRef(input.routeId, "route ID");
  const taskId = safeRef(input.taskId, "task ID");
  const leaseId = safeRef(input.leaseId, "lease ID");
  const tasks = await readAutonomousGuestTaskLedger(authority);
  const task = tasks.find((item) => item.taskId === taskId);
  if (!task || routeIdFromTask(task) !== routeId) throw new Error("Autonomous Guest reference completion does not match its route task.");

  if (input.disposition === "operated") {
    const resultRefs = [`route:${routeId}`, "disposition:operated"];
    if (input.actionId) resultRefs.push(`action:${safeRef(input.actionId, "action ID")}`);
    if (input.revision) resultRefs.push(`revision:${safeRef(input.revision, "result revision")}`);
    return completeAutonomousGuestTask(authority, taskId, leaseId, resultRefs);
  }
  const failureClass = input.disposition === "skipped-prerequisite" ? "route-prerequisite-regressed" : "route-operation-not-completed";
  return failAutonomousGuestTask(authority, taskId, leaseId, { failureClass, retryable: false });
}

export async function readAutonomousGuestReferenceTaskStatus(authority: AutonomousGuestAuthority) {
  assertAuthority(authority);
  const [tasks, policy] = await Promise.all([
    readAutonomousGuestTaskLedger(authority),
    readAutonomousGuestRunPolicy(authority),
  ]);
  const latestByRoute = new Map<string, AutonomousGuestTask>();
  for (const task of tasks
    .filter((item) => item.dedupeKey.startsWith(`${REFERENCE_DEDUPE_PREFIX}:${authority.autonomousRunId}:`))
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt))) {
    const routeId = routeIdFromTask(task);
    if (routeId && !latestByRoute.has(routeId)) latestByRoute.set(routeId, task);
  }
  const current = [...latestByRoute.entries()].map(([routeId, task]) => Object.freeze({
    routeId,
    taskId: task.taskId,
    state: task.state,
    attempt: task.attempt,
    failureClass: task.lastFailureClass,
    resultRefs: Object.freeze([...task.resultRefs]),
  }));
  return Object.freeze({
    policyPresent: Boolean(policy),
    enabled: policy?.enabled === true && policy.cancelled !== true,
    currentRevision: policy?.currentRevision || "",
    tasks: Object.freeze(current),
    allOperated: current.length > 0 && current.every((task) => task.state === "completed" && task.resultRefs.includes("disposition:operated")),
  });
}
