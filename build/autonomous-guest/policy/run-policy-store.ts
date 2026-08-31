import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AutonomousGuestAuthority } from "../../../core/auth/autonomous-guest/guest-authority";
import { persistentHome } from "../../local-credentials";
import type { AutonomousGuestTask } from "../task-ledger";
import type { AutonomousGuestTaskPolicySnapshot } from "../task-lifecycle";
import {
  autonomousGuestRegisteredRouteIds,
  resolveAutonomousGuestRouteTaskPolicy,
  type AutonomousGuestRunPolicy,
} from "../recovery/route-task-policy";

const FORMAT = "plotpickle-autonomous-guest-run-policy";
const VERSION = 1 as const;
const MAX_BYTES = 256 * 1024;
const SAFE_TOKEN = /^[a-z0-9][a-z0-9._:/-]{1,239}$/i;

type RunPolicyEnvelope = Readonly<{
  format: typeof FORMAT;
  version: typeof VERSION;
  workspaceId: string;
  autonomousRunId: string;
  savedAt: string;
  policy: AutonomousGuestRunPolicy;
}>;

function assertAuthority(authority: AutonomousGuestAuthority) {
  if (authority.authorityClass !== "delegated-guest-autonomous-operator" || authority.delegated !== true || authority.humanProfileId !== "") {
    throw new Error("Autonomous Guest run policy requires delegated non-Human authority.");
  }
}

function safeToken(value: string, label: string, allowEmpty = false) {
  const normalized = String(value || "").trim();
  if (allowEmpty && normalized === "") return "";
  if (!SAFE_TOKEN.test(normalized)) throw new Error(`Autonomous Guest run policy ${label} is missing or invalid.`);
  return normalized;
}

function safeRefs(values: readonly string[], label: string) {
  if (!Array.isArray(values) || values.length > 128) throw new Error(`Autonomous Guest run policy ${label} exceeds its bounded size.`);
  return Object.freeze([...new Set(values.map((value) => safeToken(value, label)))]);
}

function policyDirectory(authority: AutonomousGuestAuthority) {
  assertAuthority(authority);
  return path.join(persistentHome(), "autonomous-guest", authority.workspaceId);
}

function policyPath(authority: AutonomousGuestAuthority) {
  return path.join(policyDirectory(authority), "run-policy.json");
}

function validatePolicy(authority: AutonomousGuestAuthority, value: AutonomousGuestRunPolicy): AutonomousGuestRunPolicy {
  if (!value || typeof value !== "object") throw new Error("Autonomous Guest run policy is invalid.");
  if (value.autonomousRunId !== authority.autonomousRunId || value.guestWorkspaceId !== authority.workspaceId) {
    throw new Error("Autonomous Guest run policy is outside the current Guest namespace.");
  }
  const registeredRoutes = new Set(autonomousGuestRegisteredRouteIds());
  const allowedRouteIds = safeRefs(value.allowedRouteIds, "allowed route ID");
  if (allowedRouteIds.some((routeId) => !registeredRoutes.has(routeId))) {
    throw new Error("Autonomous Guest run policy contains an unregistered route.");
  }
  return Object.freeze({
    enabled: value.enabled === true,
    autonomousRunId: authority.autonomousRunId,
    guestWorkspaceId: authority.workspaceId,
    projectId: safeToken(value.projectId, "project ID"),
    currentRevision: safeToken(value.currentRevision, "current revision"),
    allowedRouteIds,
    satisfiedDependencyRefs: safeRefs(value.satisfiedDependencyRefs, "dependency reference"),
    providerPolicyRef: safeToken(value.providerPolicyRef, "provider policy reference", true),
    providerAllowed: value.providerAllowed === true,
    budgetAllowed: value.budgetAllowed === true,
    cancelled: value.cancelled === true,
  });
}

export async function writeAutonomousGuestRunPolicy(authority: AutonomousGuestAuthority, value: AutonomousGuestRunPolicy) {
  const policy = validatePolicy(authority, value);
  const directory = policyDirectory(authority);
  const target = policyPath(authority);
  const source = `${JSON.stringify({
    format: FORMAT,
    version: VERSION,
    workspaceId: authority.workspaceId,
    autonomousRunId: authority.autonomousRunId,
    savedAt: new Date().toISOString(),
    policy,
  } satisfies RunPolicyEnvelope, null, 2)}\n`;
  if (Buffer.byteLength(source, "utf8") > MAX_BYTES) throw new Error("Autonomous Guest run policy exceeds its bounded size.");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, source, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
  return policy;
}

export async function readAutonomousGuestRunPolicy(authority: AutonomousGuestAuthority): Promise<AutonomousGuestRunPolicy | null> {
  assertAuthority(authority);
  try {
    const source = await readFile(policyPath(authority), "utf8");
    if (Buffer.byteLength(source, "utf8") > MAX_BYTES) throw new Error("Autonomous Guest run policy is unexpectedly large.");
    const parsed: unknown = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Autonomous Guest run policy file is invalid.");
    const envelope = parsed as Partial<RunPolicyEnvelope>;
    if (envelope.format !== FORMAT || envelope.version !== VERSION || envelope.workspaceId !== authority.workspaceId || envelope.autonomousRunId !== authority.autonomousRunId || !envelope.policy) {
      throw new Error("Autonomous Guest run policy file does not match the current Guest namespace.");
    }
    return validatePolicy(authority, envelope.policy);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

function disabledPolicy(authority: AutonomousGuestAuthority, task: AutonomousGuestTask): AutonomousGuestTaskPolicySnapshot {
  return Object.freeze({
    guestEnabled: false,
    autonomousRunId: authority.autonomousRunId,
    guestWorkspaceId: authority.workspaceId,
    projectId: task.projectId,
    allowListedTaskKinds: Object.freeze([]),
    currentRevision: "",
    satisfiedDependencyRefs: Object.freeze([]),
    providerPolicyRef: "",
    providerAllowed: false,
    budgetAllowed: false,
    cancelled: false,
  });
}

export async function resolveAutonomousGuestStoredRouteTaskPolicy(authority: AutonomousGuestAuthority, task: AutonomousGuestTask) {
  const policy = await readAutonomousGuestRunPolicy(authority);
  return policy ? resolveAutonomousGuestRouteTaskPolicy(authority, task, policy) : disabledPolicy(authority, task);
}

export function createAutonomousGuestStoredRoutePolicyResolver(authority: AutonomousGuestAuthority) {
  return (task: AutonomousGuestTask) => resolveAutonomousGuestStoredRouteTaskPolicy(authority, task);
}
