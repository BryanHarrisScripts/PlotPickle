import routeRegistrySource from "../../config/uat-autopilot-registry.json";
import type { AutonomousGuestAuthority } from "../../core/auth/autonomous-guest/guest-authority";
import {
  enqueueAutonomousGuestTask,
  type AutonomousGuestTask,
} from "./task-ledger";
import type { AutonomousGuestTaskPolicySnapshot } from "./task-lifecycle";

const SAFE_ROUTE_INPUT = /^[a-z0-9._:/-]{1,180}$/i;

const routeRegistry = (routeRegistrySource.autonomousStoryRoutes || []) as Array<{
  id: string;
  route?: string;
  routeTemplate?: string;
  routeInputs?: string[];
  operation: "inspect" | "operate";
  prerequisites?: string[];
}>;

export type AutonomousGuestRunPolicy = Readonly<{
  enabled: boolean;
  autonomousRunId: string;
  guestWorkspaceId: string;
  projectId: string;
  currentRevision: string;
  allowedRouteIds: readonly string[];
  satisfiedDependencyRefs: readonly string[];
  providerPolicyRef: string;
  providerAllowed: boolean;
  budgetAllowed: boolean;
  cancelled?: boolean;
}>;

export type EnqueueAutonomousGuestRouteTaskInput = Readonly<{
  projectId: string;
  routeId: string;
  routeInputs?: Readonly<Record<string, string>>;
  baseRevision?: string;
  dependencyRefs?: readonly string[];
  notBefore?: string;
  expiresAt?: string;
  priority?: number;
  maxAttempts?: number;
  providerPolicyRef?: string;
  dedupeKey: string;
  parentTaskId?: string;
}>;

function routeById(routeId: string) {
  const route = routeRegistry.find((item) => item.id === routeId);
  if (!route) throw new Error("Autonomous Guest task route is not registered for autonomous operation.");
  return route;
}

function materializeRoute(route: ReturnType<typeof routeById>, inputs: Readonly<Record<string, string>> = {}) {
  if (route.route) return route.route;
  if (!route.routeTemplate) throw new Error("Autonomous Guest task route has no canonical route target.");
  let materialized = route.routeTemplate;
  for (const key of route.routeInputs || []) {
    const value = String(inputs[key] || "").trim();
    if (!SAFE_ROUTE_INPUT.test(value)) throw new Error(`Autonomous Guest task route input ${key} is missing or invalid.`);
    materialized = materialized.replaceAll(`{${key}}`, encodeURIComponent(value));
  }
  if (/\{[^}]+\}/.test(materialized)) throw new Error("Autonomous Guest task route is missing required route inputs.");
  return materialized;
}

function taskKind(routeId: string) {
  return `route:${routeId}`;
}

function routeIdFromTask(task: AutonomousGuestTask) {
  return task.taskKind.startsWith("route:") ? task.taskKind.slice("route:".length) : "";
}

function routeMatchesTask(route: ReturnType<typeof routeById>, task: AutonomousGuestTask) {
  if (route.route) return task.targetRoute === route.route;
  if (!route.routeTemplate) return false;
  const prefix = route.routeTemplate.split("{")[0];
  return Boolean(prefix) && task.targetRoute.startsWith(prefix) && !task.targetRoute.includes("{");
}

export async function enqueueAutonomousGuestRouteTask(
  authority: AutonomousGuestAuthority,
  input: EnqueueAutonomousGuestRouteTaskInput,
) {
  const route = routeById(input.routeId);
  const targetRoute = materializeRoute(route, input.routeInputs);
  const dependencies = [...new Set([...(route.prerequisites || []), ...(input.dependencyRefs || [])])];
  return enqueueAutonomousGuestTask(authority, {
    projectId: input.projectId,
    taskKind: taskKind(route.id),
    targetRoute,
    baseRevision: input.baseRevision,
    dependencyRefs: dependencies,
    notBefore: input.notBefore,
    expiresAt: input.expiresAt,
    priority: input.priority,
    maxAttempts: input.maxAttempts,
    affectsCanon: route.operation === "operate",
    providerPolicyRef: input.providerPolicyRef,
    dedupeKey: input.dedupeKey,
    parentTaskId: input.parentTaskId,
  });
}

export function resolveAutonomousGuestRouteTaskPolicy(
  authority: AutonomousGuestAuthority,
  task: AutonomousGuestTask,
  runPolicy: AutonomousGuestRunPolicy,
): AutonomousGuestTaskPolicySnapshot {
  const routeId = routeIdFromTask(task);
  const route = routeId ? routeRegistry.find((item) => item.id === routeId) : undefined;
  const namespaceMatches = runPolicy.autonomousRunId === authority.autonomousRunId
    && runPolicy.guestWorkspaceId === authority.workspaceId
    && task.autonomousRunId === authority.autonomousRunId
    && task.guestWorkspaceId === authority.workspaceId;
  const routeAllowed = Boolean(route
    && routeMatchesTask(route, task)
    && runPolicy.allowedRouteIds.includes(route.id));

  return Object.freeze({
    guestEnabled: runPolicy.enabled && namespaceMatches,
    autonomousRunId: runPolicy.autonomousRunId,
    guestWorkspaceId: runPolicy.guestWorkspaceId,
    projectId: runPolicy.projectId,
    allowListedTaskKinds: routeAllowed ? Object.freeze([taskKind(routeId)]) : Object.freeze([]),
    currentRevision: runPolicy.currentRevision,
    satisfiedDependencyRefs: Object.freeze([...runPolicy.satisfiedDependencyRefs]),
    providerPolicyRef: runPolicy.providerPolicyRef,
    providerAllowed: runPolicy.providerAllowed,
    budgetAllowed: runPolicy.budgetAllowed,
    cancelled: runPolicy.cancelled === true,
  });
}

export function autonomousGuestRegisteredRouteIds() {
  return Object.freeze(routeRegistry.map((route) => route.id));
}
