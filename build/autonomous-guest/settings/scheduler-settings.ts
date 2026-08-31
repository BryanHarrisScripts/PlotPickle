import type { Schedule } from "@mastra/core/storage";
import type { AutonomousGuestAuthority } from "../../../core/auth/autonomous-guest/guest-authority";
import {
  cancelAutonomousGuestTask,
} from "../task-lifecycle";
import { readAutonomousGuestTaskLedger, type AutonomousGuestTask } from "../task-ledger";
import {
  cancelAutonomousGuestTaskSchedule,
  pauseAutonomousGuestTaskSchedule,
  resumeAutonomousGuestTaskSchedule,
  runAutonomousGuestTaskScheduleNow,
  scheduleAutonomousGuestTaskCron,
  AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID,
} from "../mastra-task-scheduler";
import { createAutonomousGuestSchedulerRuntime } from "../mastra-wake-runtime";
import {
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

function schedulerRuntime(authority: AutonomousGuestAuthority) {
  assertAuthority(authority);
  const runtime = createAutonomousGuestSchedulerRuntime();
  if (runtime.authority.autonomousRunId !== authority.autonomousRunId || runtime.authority.workspaceId !== authority.workspaceId) {
    throw new Error("Autonomous Guest scheduler Settings do not match the current Guest namespace.");
  }
  return runtime;
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

export async function readAutonomousGuestSchedulerSettings(authority: AutonomousGuestAuthority) {
  assertAuthority(authority);
  const runtime = schedulerRuntime(authority);
  const [tasks, policy, schedules] = await Promise.all([
    readAutonomousGuestTaskLedger(authority),
    readAutonomousGuestRunPolicy(authority),
    runtime.schedules.listSchedules({ workflowId: AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID }),
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
    .filter((task) => !["completed", "cancelled", "expired", "failed"].includes(task.state))
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
  const runtime = schedulerRuntime(authority);

  if (action === "schedule-cron") {
    const cron = String(input.cron || "").trim();
    const timezone = String(input.timezone || "").trim();
    if (!cron || cron.length > 160) throw new Error("Autonomous Guest scheduler cron is missing or too long.");
    if (timezone.length > 100) throw new Error("Autonomous Guest scheduler timezone is too long.");
    await scheduleAutonomousGuestTaskCron({ authority, schedules: runtime.mastra.schedules, taskId, cron, timezone: timezone || undefined });
  } else if (action === "run-now") {
    await runAutonomousGuestTaskScheduleNow({ authority, schedules: runtime.mastra.schedules, taskId });
  } else if (action === "pause") {
    await pauseAutonomousGuestTaskSchedule({ authority, schedules: runtime.mastra.schedules, taskId });
  } else if (action === "resume") {
    await resumeAutonomousGuestTaskSchedule({ authority, schedules: runtime.mastra.schedules, taskId });
  } else if (action === "cancel") {
    const schedules = await runtime.schedules.listSchedules({ workflowId: AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID });
    const hasSchedule = schedules.some((schedule) => scheduleTaskId(schedule) === taskId);
    if (hasSchedule) {
      await cancelAutonomousGuestTaskSchedule({ authority, schedules: runtime.mastra.schedules, taskId });
    } else {
      await cancelAutonomousGuestTask(authority, taskId);
    }
  }

  return readAutonomousGuestSchedulerSettings(authority);
}
