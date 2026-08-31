import type { AutonomousGuestAuthority } from "../../../core/auth/autonomous-guest/guest-authority";
import {
  AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID,
  autonomousGuestTaskScheduleId,
  autonomousGuestTaskWakePayload,
  wakeAutonomousGuestTask,
} from "../mastra-task-scheduler";
import { cancelAutonomousGuestTask } from "../task-lifecycle";
import { readAutonomousGuestTaskLedger, type AutonomousGuestTask } from "../task-ledger";
import {
  createAutonomousGuestStoredRoutePolicyResolver,
  readAutonomousGuestRunPolicy,
  writeAutonomousGuestRunPolicy,
} from "../policy/run-policy-store";
import {
  mutateAutonomousGuestScheduleFileState,
  readAutonomousGuestScheduleFileState,
} from "../storage/schedule-file-state";
import { nextAutonomousGuestBoundedCronFireAt } from "./bounded-cron";

const HISTORY_LIMIT = 12;
const ACTIVE_TASK_LIMIT = 24;
const SAFE_ACTIONS = new Set([
  "set-enabled",
  "schedule-cron",
  "run-now",
  "pause",
  "resume",
  "cancel",
]);
const TERMINAL_TASK_STATES = new Set(["completed", "cancelled", "expired", "failed"]);

type StoredGuestSchedule = Readonly<{
  id: string;
  target: Readonly<{
    type: "workflow";
    workflowId: string;
    inputData?: unknown;
  }>;
  cron: string;
  timezone?: string;
  status: "active" | "paused";
  nextFireAt: number;
  lastFireAt?: number;
  lastRunId?: string;
  createdAt: number;
  updatedAt: number;
}>;

export type AutonomousGuestSchedulerSettingsAction = Readonly<{
  action: string;
  enabled?: boolean;
  taskId?: string;
  cron?: string;
  timezone?: string;
}>;

function assertAuthority(authority: AutonomousGuestAuthority) {
  if (authority.authorityClass !== "delegated-guest-autonomous-operator" || authority.delegated !== true || authority.humanProfileId !== "") {
    throw new Error("Autonomous Guest scheduler Settings require delegated non-Human authority.");
  }
}

function parseSchedule(authority: AutonomousGuestAuthority, value: unknown): StoredGuestSchedule {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Autonomous Guest scheduler contains an invalid schedule.");
  const schedule = value as Partial<StoredGuestSchedule>;
  const id = String(schedule.id || "");
  const target = schedule.target;
  if (!id.startsWith(`plotpickle-guest-wake-${authority.workspaceId}-`) || !target || target.type !== "workflow" || target.workflowId !== AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID) {
    throw new Error("Autonomous Guest scheduler contains a schedule outside this Guest namespace.");
  }
  const payload = target.inputData;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new Error("Autonomous Guest scheduler wake payload is invalid.");
  const refs = payload as Record<string, unknown>;
  if (String(refs.autonomousRunId || "") !== authority.autonomousRunId || String(refs.guestWorkspaceId || "") !== authority.workspaceId) {
    throw new Error("Autonomous Guest scheduler wake payload is outside this Guest namespace.");
  }
  if (schedule.status !== "active" && schedule.status !== "paused") throw new Error("Autonomous Guest scheduler status is invalid.");
  if (!String(schedule.cron || "").trim() || String(schedule.cron).length > 160) throw new Error("Autonomous Guest scheduler cron is invalid.");
  for (const timestamp of [schedule.nextFireAt, schedule.createdAt, schedule.updatedAt]) {
    if (!Number.isFinite(timestamp) || Number(timestamp) < 0) throw new Error("Autonomous Guest scheduler timestamp is invalid.");
  }
  return Object.freeze({
    id,
    target: Object.freeze({ type: "workflow", workflowId: AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID, inputData: payload }),
    cron: String(schedule.cron),
    timezone: schedule.timezone ? String(schedule.timezone) : undefined,
    status: schedule.status,
    nextFireAt: Number(schedule.nextFireAt),
    lastFireAt: schedule.lastFireAt,
    lastRunId: schedule.lastRunId,
    createdAt: Number(schedule.createdAt),
    updatedAt: Number(schedule.updatedAt),
  });
}

function scheduleTaskId(schedule: StoredGuestSchedule) {
  const payload = schedule.target.inputData as Record<string, unknown>;
  return String(payload.taskId || "");
}

function taskTimestamp(task: AutonomousGuestTask) {
  return Date.parse(task.completedAt || task.startedAt || task.createdAt) || 0;
}

function taskSummary(task: AutonomousGuestTask, schedule?: StoredGuestSchedule) {
  return Object.freeze({
    taskId: task.taskId,
    taskKind: task.taskKind,
    state: task.state,
    notBefore: task.notBefore,
    expiresAt: task.expiresAt,
    attempt: task.attempt,
    maxAttempts: task.maxAttempts,
    lastFailureClass: task.lastFailureClass,
    schedule: schedule ? Object.freeze({
      status: schedule.status,
      nextFireAt: schedule.nextFireAt,
      cron: schedule.cron,
      timezone: schedule.timezone || "",
    }) : null,
  });
}

async function requiredTask(authority: AutonomousGuestAuthority, taskId: string) {
  const tasks = await readAutonomousGuestTaskLedger(authority);
  const task = tasks.find((item) => item.taskId === taskId);
  if (!task) throw new Error("Autonomous Guest scheduler task does not exist in this Guest namespace.");
  return task;
}

async function schedulesForAuthority(authority: AutonomousGuestAuthority) {
  const state = await readAutonomousGuestScheduleFileState(authority);
  return state.schedules.map((schedule) => parseSchedule(authority, schedule));
}

async function requiredSchedule(authority: AutonomousGuestAuthority, taskId: string) {
  const id = autonomousGuestTaskScheduleId(authority, taskId);
  const schedule = (await schedulesForAuthority(authority)).find((item) => item.id === id);
  if (!schedule) throw new Error("Autonomous Guest scheduler task does not have a schedule.");
  return schedule;
}

export async function readAutonomousGuestSchedulerSettings(authority: AutonomousGuestAuthority) {
  assertAuthority(authority);
  const [tasks, policy, schedules] = await Promise.all([
    readAutonomousGuestTaskLedger(authority),
    readAutonomousGuestRunPolicy(authority),
    schedulesForAuthority(authority),
  ]);
  const scheduleByTask = new Map(schedules.map((schedule) => [scheduleTaskId(schedule), schedule]));
  const counts = Object.freeze({
    pending: tasks.filter((task) => task.state === "pending").length,
    eligible: tasks.filter((task) => task.state === "eligible").length,
    running: tasks.filter((task) => task.state === "running").length,
    blocked: tasks.filter((task) => task.state === "blocked").length,
    retryWait: tasks.filter((task) => task.state === "retry-wait").length,
  });
  const nextRunAt = schedules
    .filter((schedule) => schedule.status === "active")
    .reduce<number | null>((current, schedule) => current == null || schedule.nextFireAt < current ? schedule.nextFireAt : current, null);
  const activeTasks = tasks
    .filter((task) => !TERMINAL_TASK_STATES.has(task.state))
    .sort((left, right) => right.priority - left.priority || Date.parse(left.notBefore) - Date.parse(right.notBefore))
    .slice(0, ACTIVE_TASK_LIMIT)
    .map((task) => taskSummary(task, scheduleByTask.get(task.taskId)));
  const history = tasks
    .filter((task) => ["completed", "cancelled", "expired", "failed", "blocked", "retry-wait"].includes(task.state))
    .sort((left, right) => taskTimestamp(right) - taskTimestamp(left))
    .slice(0, HISTORY_LIMIT)
    .map((task) => taskSummary(task, scheduleByTask.get(task.taskId)));

  return Object.freeze({
    available: true,
    enabled: policy?.enabled === true && policy.cancelled !== true,
    policyPresent: Boolean(policy),
    projectId: policy?.projectId || "",
    currentRevision: policy?.currentRevision || "",
    nextRunAt,
    counts,
    activeTasks: Object.freeze(activeTasks),
    history: Object.freeze(history),
  });
}

export function unavailableAutonomousGuestSchedulerSettings() {
  return Object.freeze({
    available: false,
    enabled: false,
    policyPresent: false,
    projectId: "",
    currentRevision: "",
    nextRunAt: null,
    counts: Object.freeze({ pending: 0, eligible: 0, running: 0, blocked: 0, retryWait: 0 }),
    activeTasks: Object.freeze([]),
    history: Object.freeze([]),
  });
}

export async function applyAutonomousGuestSchedulerSettingsAction(
  authority: AutonomousGuestAuthority,
  input: AutonomousGuestSchedulerSettingsAction,
) {
  assertAuthority(authority);
  const action = String(input.action || "");
  if (!SAFE_ACTIONS.has(action)) throw new Error("Autonomous Guest scheduler Settings action is not supported.");

  if (action === "set-enabled") {
    if (typeof input.enabled !== "boolean") throw new Error("Autonomous Guest scheduler enabled state is required.");
    const policy = await readAutonomousGuestRunPolicy(authority);
    if (!policy) throw new Error("Autonomous Guest scheduler cannot change state before a current run policy exists.");
    if (input.enabled && policy.cancelled) throw new Error("A cancelled Autonomous Guest run cannot be re-enabled from Settings.");
    await writeAutonomousGuestRunPolicy(authority, { ...policy, enabled: input.enabled });
    return readAutonomousGuestSchedulerSettings(authority);
  }

  const taskId = String(input.taskId || "");
  if (!/^guest-task-[a-f0-9-]{36}$/i.test(taskId)) throw new Error("Autonomous Guest scheduler task ID is invalid.");
  const task = await requiredTask(authority, taskId);
  const id = autonomousGuestTaskScheduleId(authority, taskId);

  if (action === "schedule-cron") {
    if (TERMINAL_TASK_STATES.has(task.state)) throw new Error("Terminal Autonomous Guest tasks cannot receive a new schedule.");
    const cron = String(input.cron || "").trim();
    const timezone = String(input.timezone || "").trim() || undefined;
    if (!cron || cron.length > 160) throw new Error("Autonomous Guest scheduler cron is missing or too long.");
    const now = Date.now();
    const nextFireAt = nextAutonomousGuestBoundedCronFireAt(cron, timezone, now);
    const schedule: StoredGuestSchedule = Object.freeze({
      id,
      target: Object.freeze({
        type: "workflow",
        workflowId: AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID,
        inputData: autonomousGuestTaskWakePayload(task),
      }),
      cron,
      timezone,
      status: "active",
      nextFireAt,
      createdAt: now,
      updatedAt: now,
    });
    await mutateAutonomousGuestScheduleFileState(authority, (state) => {
      const index = state.schedules.findIndex((item) => {
        try { return parseSchedule(authority, item).id === id; } catch { return false; }
      });
      if (index >= 0) {
        const existing = parseSchedule(authority, state.schedules[index]);
        state.schedules[index] = { ...schedule, createdAt: existing.createdAt };
      } else {
        state.schedules.push(schedule);
      }
    });
  } else if (action === "run-now") {
    await wakeAutonomousGuestTask({
      authority,
      payload: autonomousGuestTaskWakePayload(task),
      resolvePolicy: createAutonomousGuestStoredRoutePolicyResolver(authority),
    });
  } else if (action === "pause") {
    await requiredSchedule(authority, taskId);
    await mutateAutonomousGuestScheduleFileState(authority, (state) => {
      const index = state.schedules.findIndex((item) => parseSchedule(authority, item).id === id);
      if (index < 0) throw new Error("Autonomous Guest scheduler task does not have a schedule.");
      state.schedules[index] = { ...parseSchedule(authority, state.schedules[index]), status: "paused", updatedAt: Date.now() };
    });
  } else if (action === "resume") {
    const schedule = await requiredSchedule(authority, taskId);
    const nextFireAt = nextAutonomousGuestBoundedCronFireAt(schedule.cron, schedule.timezone, Date.now());
    await mutateAutonomousGuestScheduleFileState(authority, (state) => {
      const index = state.schedules.findIndex((item) => parseSchedule(authority, item).id === id);
      if (index < 0) throw new Error("Autonomous Guest scheduler task does not have a schedule.");
      state.schedules[index] = { ...parseSchedule(authority, state.schedules[index]), status: "active", nextFireAt, updatedAt: Date.now() };
    });
  } else if (action === "cancel") {
    await cancelAutonomousGuestTask(authority, taskId);
    await mutateAutonomousGuestScheduleFileState(authority, (state) => {
      state.schedules = state.schedules.filter((item) => parseSchedule(authority, item).id !== id);
      state.triggers = state.triggers.filter((item) => !(item && typeof item === "object" && String((item as Record<string, unknown>).scheduleId || "") === id));
    });
  }

  return readAutonomousGuestSchedulerSettings(authority);
}
