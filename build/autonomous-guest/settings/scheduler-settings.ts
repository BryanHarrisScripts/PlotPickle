import type { Schedule } from "@mastra/core/storage";
import { computeNextFireAt, validateCron } from "@mastra/core/workflows";
import type { AutonomousGuestAuthority } from "../../../core/auth/autonomous-guest/guest-authority";
import { AutonomousGuestFileSchedulesStorage } from "../mastra-file-schedules-storage";
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

function scheduleStore(authority: AutonomousGuestAuthority) {
  assertAuthority(authority);
  return new AutonomousGuestFileSchedulesStorage(authority);
}

function scheduleTaskId(schedule: Schedule) {
  if (schedule.target.type !== "workflow" || schedule.target.workflowId !== AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID) return "";
  const payload = schedule.target.inputData;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  return String((payload as Record<string, unknown>).taskId || "");
}

function taskTimestamp(task: AutonomousGuestTask) {
  return Date.parse(task.completedAt || task.startedAt || task.createdAt) || 0;
}

function taskSummary(task: AutonomousGuestTask, schedule?: Schedule) {
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

async function requiredSchedule(store: AutonomousGuestFileSchedulesStorage, authority: AutonomousGuestAuthority, taskId: string) {
  const schedule = await store.getSchedule(autonomousGuestTaskScheduleId(authority, taskId));
  if (!schedule) throw new Error("Autonomous Guest scheduler task does not have a schedule.");
  return schedule;
}

export async function readAutonomousGuestSchedulerSettings(authority: AutonomousGuestAuthority) {
  assertAuthority(authority);
  const schedulesStore = scheduleStore(authority);
  const [tasks, policy, schedules] = await Promise.all([
    readAutonomousGuestTaskLedger(authority),
    readAutonomousGuestRunPolicy(authority),
    schedulesStore.listSchedules({ workflowId: AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID }),
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
    .filter((schedule) => schedule.status === "active" && Number.isFinite(schedule.nextFireAt))
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
  const schedulesStore = scheduleStore(authority);
  const id = autonomousGuestTaskScheduleId(authority, taskId);

  if (action === "schedule-cron") {
    if (TERMINAL_TASK_STATES.has(task.state)) throw new Error("Terminal Autonomous Guest tasks cannot receive a new schedule.");
    const cron = String(input.cron || "").trim();
    const timezone = String(input.timezone || "").trim() || undefined;
    if (!cron || cron.length > 160) throw new Error("Autonomous Guest scheduler cron is missing or too long.");
    if ((timezone || "").length > 100) throw new Error("Autonomous Guest scheduler timezone is too long.");
    validateCron(cron, timezone);
    const now = Date.now();
    const nextFireAt = computeNextFireAt(cron, { timezone, after: now });
    const target = {
      type: "workflow" as const,
      workflowId: AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID,
      inputData: autonomousGuestTaskWakePayload(task),
    };
    const existing = await schedulesStore.getSchedule(id);
    if (existing) {
      await schedulesStore.updateSchedule(id, { cron, timezone, status: "active", nextFireAt, target });
    } else {
      await schedulesStore.createSchedule({
        id,
        target,
        cron,
        timezone,
        status: "active",
        nextFireAt,
        createdAt: now,
        updatedAt: now,
      });
    }
  } else if (action === "run-now") {
    await wakeAutonomousGuestTask({
      authority,
      payload: autonomousGuestTaskWakePayload(task),
      resolvePolicy: createAutonomousGuestStoredRoutePolicyResolver(authority),
    });
  } else if (action === "pause") {
    await requiredSchedule(schedulesStore, authority, taskId);
    await schedulesStore.updateSchedule(id, { status: "paused" });
  } else if (action === "resume") {
    const schedule = await requiredSchedule(schedulesStore, authority, taskId);
    const nextFireAt = computeNextFireAt(schedule.cron, { timezone: schedule.timezone, after: Date.now() });
    await schedulesStore.updateSchedule(id, { status: "active", nextFireAt });
  } else if (action === "cancel") {
    const schedule = await schedulesStore.getSchedule(id);
    await cancelAutonomousGuestTask(authority, taskId);
    if (schedule) await schedulesStore.deleteSchedule(id);
  }

  return readAutonomousGuestSchedulerSettings(authority);
}
