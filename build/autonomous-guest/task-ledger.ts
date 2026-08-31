import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AutonomousGuestAuthority } from "../../core/auth/autonomous-guest/guest-authority";
import { persistentHome } from "../local-credentials";

const FORMAT = "plotpickle-autonomous-guest-task-ledger";
const VERSION = 1 as const;
const MAX_BYTES = 2 * 1024 * 1024;
const MAX_TASKS = 512;
const SAFE_TOKEN = /^[a-z0-9][a-z0-9._:/-]{1,239}$/i;

export const AUTONOMOUS_GUEST_TASK_STATES = [
  "pending",
  "eligible",
  "running",
  "completed",
  "blocked",
  "retry-wait",
  "cancelled",
  "expired",
  "failed",
] as const;

export type AutonomousGuestTaskState = (typeof AUTONOMOUS_GUEST_TASK_STATES)[number];

export type AutonomousGuestTask = Readonly<{
  taskId: string;
  autonomousRunId: string;
  guestWorkspaceId: string;
  projectId: string;
  taskKind: string;
  targetRoute: string;
  baseRevision: string;
  dependencyRefs: readonly string[];
  notBefore: string;
  priority: number;
  attempt: number;
  maxAttempts: number;
  providerPolicyRef: string;
  dedupeKey: string;
  state: AutonomousGuestTaskState;
  createdAt: string;
  startedAt: string;
  completedAt: string;
  lastFailureClass: string;
  resultRefs: readonly string[];
  parentTaskId: string;
  childTaskIds: readonly string[];
  leaseId: string;
  leaseExpiresAt: string;
}>;

export type EnqueueAutonomousGuestTaskInput = Readonly<{
  projectId: string;
  taskKind: string;
  targetRoute: string;
  baseRevision?: string;
  dependencyRefs?: readonly string[];
  notBefore?: string;
  priority?: number;
  maxAttempts?: number;
  providerPolicyRef?: string;
  dedupeKey: string;
  parentTaskId?: string;
}>;

type LedgerEnvelope = Readonly<{
  format: typeof FORMAT;
  version: typeof VERSION;
  workspaceId: string;
  autonomousRunId: string;
  savedAt: string;
  tasks: readonly AutonomousGuestTask[];
}>;

const TERMINAL_STATES = new Set<AutonomousGuestTaskState>(["completed", "cancelled", "expired", "failed"]);

function assertAuthority(authority: AutonomousGuestAuthority) {
  if (authority.authorityClass !== "delegated-guest-autonomous-operator" || authority.delegated !== true || authority.humanProfileId !== "") {
    throw new Error("Autonomous Guest tasks require delegated non-Human authority.");
  }
  if (!/^guest-auto-[a-f0-9]{24}$/i.test(authority.workspaceId)) {
    throw new Error("Autonomous Guest task workspace identity is invalid.");
  }
}

function safeToken(value: string, label: string, allowEmpty = false) {
  const normalized = String(value || "").trim();
  if (allowEmpty && normalized === "") return "";
  if (!SAFE_TOKEN.test(normalized)) throw new Error(`Autonomous Guest task ${label} is missing or invalid.`);
  return normalized;
}

function safeTargetRoute(value: string) {
  const normalized = String(value || "").trim();
  if (!normalized.startsWith("/") || normalized.startsWith("//") || normalized.length > 512 || /[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new Error("Autonomous Guest task target route is missing or invalid.");
  }
  return normalized;
}

function safeRefs(values: readonly string[] | undefined, label: string) {
  const refs = [...(values || [])].map((value) => safeToken(value, label));
  if (refs.length > 64) throw new Error(`Autonomous Guest task ${label} exceeds its bounded size.`);
  return Object.freeze(refs);
}

function normalizedTimestamp(value: string | undefined, fallback: string) {
  if (!value) return fallback;
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error("Autonomous Guest task timestamp is invalid.");
  return date.toISOString();
}

function taskDirectory(authority: AutonomousGuestAuthority) {
  assertAuthority(authority);
  return path.join(persistentHome(), "autonomous-guest", authority.workspaceId);
}

function ledgerPath(authority: AutonomousGuestAuthority) {
  return path.join(taskDirectory(authority), "task-ledger.json");
}

function isTaskState(value: unknown): value is AutonomousGuestTaskState {
  return typeof value === "string" && (AUTONOMOUS_GUEST_TASK_STATES as readonly string[]).includes(value);
}

function parseTask(value: unknown, authority: AutonomousGuestAuthority): AutonomousGuestTask {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Autonomous Guest task ledger contains an invalid task.");
  const item = value as Partial<AutonomousGuestTask>;
  if (!isTaskState(item.state)) throw new Error("Autonomous Guest task ledger contains an invalid task state.");
  if (item.autonomousRunId !== authority.autonomousRunId || item.guestWorkspaceId !== authority.workspaceId) {
    throw new Error("Autonomous Guest task ledger contains a task outside this Guest namespace.");
  }
  const priority = Number(item.priority);
  const attempt = Number(item.attempt);
  const maxAttempts = Number(item.maxAttempts);
  if (!Number.isInteger(priority) || priority < -100 || priority > 100) throw new Error("Autonomous Guest task priority is invalid.");
  if (!Number.isInteger(attempt) || attempt < 0) throw new Error("Autonomous Guest task attempt count is invalid.");
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10 || attempt > maxAttempts) {
    throw new Error("Autonomous Guest task retry budget is invalid.");
  }
  return Object.freeze({
    taskId: safeToken(String(item.taskId || ""), "ID"),
    autonomousRunId: authority.autonomousRunId,
    guestWorkspaceId: authority.workspaceId,
    projectId: safeToken(String(item.projectId || ""), "project ID"),
    taskKind: safeToken(String(item.taskKind || ""), "kind"),
    targetRoute: safeTargetRoute(String(item.targetRoute || "")),
    baseRevision: safeToken(String(item.baseRevision || ""), "base revision", true),
    dependencyRefs: safeRefs(item.dependencyRefs, "dependency reference"),
    notBefore: normalizedTimestamp(String(item.notBefore || ""), new Date(0).toISOString()),
    priority,
    attempt,
    maxAttempts,
    providerPolicyRef: safeToken(String(item.providerPolicyRef || ""), "provider policy reference", true),
    dedupeKey: safeToken(String(item.dedupeKey || ""), "dedupe key"),
    state: item.state,
    createdAt: normalizedTimestamp(String(item.createdAt || ""), new Date(0).toISOString()),
    startedAt: item.startedAt ? normalizedTimestamp(item.startedAt, "") : "",
    completedAt: item.completedAt ? normalizedTimestamp(item.completedAt, "") : "",
    lastFailureClass: safeToken(String(item.lastFailureClass || ""), "failure class", true),
    resultRefs: safeRefs(item.resultRefs, "result reference"),
    parentTaskId: safeToken(String(item.parentTaskId || ""), "parent task ID", true),
    childTaskIds: safeRefs(item.childTaskIds, "child task ID"),
    leaseId: safeToken(String(item.leaseId || ""), "lease ID", true),
    leaseExpiresAt: item.leaseExpiresAt ? normalizedTimestamp(item.leaseExpiresAt, "") : "",
  });
}

async function writeLedger(authority: AutonomousGuestAuthority, tasks: readonly AutonomousGuestTask[]) {
  if (tasks.length > MAX_TASKS) throw new Error("Autonomous Guest task ledger exceeds its bounded task count.");
  const directory = taskDirectory(authority);
  const target = ledgerPath(authority);
  const source = `${JSON.stringify({
    format: FORMAT,
    version: VERSION,
    workspaceId: authority.workspaceId,
    autonomousRunId: authority.autonomousRunId,
    savedAt: new Date().toISOString(),
    tasks,
  } satisfies LedgerEnvelope, null, 2)}\n`;
  if (Buffer.byteLength(source, "utf8") > MAX_BYTES) throw new Error("Autonomous Guest task ledger exceeds its bounded size.");
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const temporary = `${target}.${process.pid}.${randomUUID()}.tmp`;
  await writeFile(temporary, source, { encoding: "utf8", mode: 0o600 });
  await rename(temporary, target);
}

export async function readAutonomousGuestTaskLedger(authority: AutonomousGuestAuthority): Promise<readonly AutonomousGuestTask[]> {
  assertAuthority(authority);
  try {
    const source = await readFile(ledgerPath(authority), "utf8");
    if (Buffer.byteLength(source, "utf8") > MAX_BYTES) throw new Error("Autonomous Guest task ledger is unexpectedly large.");
    const parsed: unknown = JSON.parse(source);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Autonomous Guest task ledger is invalid.");
    const envelope = parsed as Partial<LedgerEnvelope>;
    if (envelope.format !== FORMAT || envelope.version !== VERSION || envelope.workspaceId !== authority.workspaceId || envelope.autonomousRunId !== authority.autonomousRunId) {
      throw new Error("Autonomous Guest task ledger does not match this Guest namespace.");
    }
    if (!Array.isArray(envelope.tasks) || envelope.tasks.length > MAX_TASKS) throw new Error("Autonomous Guest task ledger task collection is invalid.");
    return Object.freeze(envelope.tasks.map((task) => parseTask(task, authority)));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return Object.freeze([]);
    throw error;
  }
}

export async function enqueueAutonomousGuestTask(authority: AutonomousGuestAuthority, input: EnqueueAutonomousGuestTaskInput) {
  const tasks = await readAutonomousGuestTaskLedger(authority);
  const dedupeKey = safeToken(input.dedupeKey, "dedupe key");
  const duplicate = tasks.find((task) => task.dedupeKey === dedupeKey && !TERMINAL_STATES.has(task.state));
  if (duplicate) return duplicate;
  const now = new Date().toISOString();
  const maxAttempts = input.maxAttempts ?? 3;
  if (!Number.isInteger(maxAttempts) || maxAttempts < 1 || maxAttempts > 10) throw new Error("Autonomous Guest task retry budget must be between 1 and 10 attempts.");
  const priority = input.priority ?? 0;
  if (!Number.isInteger(priority) || priority < -100 || priority > 100) throw new Error("Autonomous Guest task priority must be between -100 and 100.");
  const task: AutonomousGuestTask = Object.freeze({
    taskId: `guest-task-${randomUUID()}`,
    autonomousRunId: authority.autonomousRunId,
    guestWorkspaceId: authority.workspaceId,
    projectId: safeToken(input.projectId, "project ID"),
    taskKind: safeToken(input.taskKind, "kind"),
    targetRoute: safeTargetRoute(input.targetRoute),
    baseRevision: safeToken(input.baseRevision || "", "base revision", true),
    dependencyRefs: safeRefs(input.dependencyRefs, "dependency reference"),
    notBefore: normalizedTimestamp(input.notBefore, now),
    priority,
    attempt: 0,
    maxAttempts,
    providerPolicyRef: safeToken(input.providerPolicyRef || "", "provider policy reference", true),
    dedupeKey,
    state: "pending",
    createdAt: now,
    startedAt: "",
    completedAt: "",
    lastFailureClass: "",
    resultRefs: Object.freeze([]),
    parentTaskId: safeToken(input.parentTaskId || "", "parent task ID", true),
    childTaskIds: Object.freeze([]),
    leaseId: "",
    leaseExpiresAt: "",
  });
  await writeLedger(authority, [...tasks, task]);
  return task;
}

export async function recoverAbandonedAutonomousGuestTasks(authority: AutonomousGuestAuthority, at = new Date()) {
  const tasks = await readAutonomousGuestTaskLedger(authority);
  const now = at.getTime();
  let changed = false;
  const recovered = tasks.map((task) => {
    if (task.state !== "running" || !task.leaseExpiresAt) return task;
    const leaseExpiry = new Date(task.leaseExpiresAt).getTime();
    if (!Number.isFinite(leaseExpiry) || leaseExpiry > now) return task;
    changed = true;
    const exhausted = task.attempt >= task.maxAttempts;
    return Object.freeze({
      ...task,
      state: exhausted ? "failed" as const : "retry-wait" as const,
      completedAt: exhausted ? at.toISOString() : "",
      lastFailureClass: "abandoned-process-lease",
      leaseId: "",
      leaseExpiresAt: "",
    });
  });
  if (changed) await writeLedger(authority, recovered);
  return Object.freeze(recovered);
}
