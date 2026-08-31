import type { Mastra } from "@mastra/core/mastra";
import type { AutonomousGuestAuthority } from "../../core/auth/autonomous-guest/guest-authority";
import {
  readAutonomousGuestTaskLedger,
  type AutonomousGuestTask,
} from "./task-ledger";
import {
  cancelAutonomousGuestTask,
  revalidateAutonomousGuestTask,
  type AutonomousGuestTaskPolicySnapshot,
} from "./task-lifecycle";

export const AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID = "plotpickle-autonomous-guest-task-wake";

type MastraSchedules = Mastra["schedules"];

export type AutonomousGuestWakePayload = Readonly<{
  taskId: string;
  autonomousRunId: string;
  guestWorkspaceId: string;
}>;

export type AutonomousGuestTaskPolicyResolver = (
  task: AutonomousGuestTask,
) => Promise<AutonomousGuestTaskPolicySnapshot> | AutonomousGuestTaskPolicySnapshot;

function assertAuthority(authority: AutonomousGuestAuthority) {
  if (authority.authorityClass !== "delegated-guest-autonomous-operator" || authority.delegated !== true || authority.humanProfileId !== "") {
    throw new Error("Autonomous Guest scheduling requires delegated non-Human authority.");
  }
}

export function autonomousGuestTaskScheduleId(authority: AutonomousGuestAuthority, taskId: string) {
  assertAuthority(authority);
  if (!/^guest-task-[a-f0-9-]{36}$/i.test(taskId)) throw new Error("Autonomous Guest schedule task ID is invalid.");
  return `plotpickle-guest-wake-${authority.workspaceId}-${taskId}`;
}

export function autonomousGuestTaskWakePayload(task: AutonomousGuestTask): AutonomousGuestWakePayload {
  return Object.freeze({
    taskId: task.taskId,
    autonomousRunId: task.autonomousRunId,
    guestWorkspaceId: task.guestWorkspaceId,
  });
}

async function taskForAuthority(authority: AutonomousGuestAuthority, taskId: string) {
  assertAuthority(authority);
  const tasks = await readAutonomousGuestTaskLedger(authority);
  const task = tasks.find((item) => item.taskId === taskId);
  if (!task) throw new Error("Autonomous Guest scheduled task does not exist in this Guest namespace.");
  if (task.autonomousRunId !== authority.autonomousRunId || task.guestWorkspaceId !== authority.workspaceId) {
    throw new Error("Autonomous Guest scheduled task does not match this Guest namespace.");
  }
  return task;
}

export async function scheduleAutonomousGuestTaskCron(input: Readonly<{
  authority: AutonomousGuestAuthority;
  schedules: MastraSchedules;
  taskId: string;
  cron: string;
  timezone?: string;
}>) {
  const task = await taskForAuthority(input.authority, input.taskId);
  if (["completed", "cancelled", "expired", "failed"].includes(task.state)) {
    throw new Error("Terminal Autonomous Guest tasks cannot receive a new schedule.");
  }
  const id = autonomousGuestTaskScheduleId(input.authority, task.taskId);
  await input.schedules.create({
    id,
    workflowId: AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID,
    cron: input.cron,
    timezone: input.timezone,
    inputData: autonomousGuestTaskWakePayload(task),
  });
  return Object.freeze({
    scheduleId: id,
    workflowId: AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID,
    taskId: task.taskId,
  });
}

export async function runAutonomousGuestTaskScheduleNow(input: Readonly<{
  authority: AutonomousGuestAuthority;
  schedules: MastraSchedules;
  taskId: string;
}>) {
  await taskForAuthority(input.authority, input.taskId);
  await input.schedules.run(autonomousGuestTaskScheduleId(input.authority, input.taskId));
}

export async function pauseAutonomousGuestTaskSchedule(input: Readonly<{
  authority: AutonomousGuestAuthority;
  schedules: MastraSchedules;
  taskId: string;
}>) {
  await taskForAuthority(input.authority, input.taskId);
  await input.schedules.pause(autonomousGuestTaskScheduleId(input.authority, input.taskId));
}

export async function resumeAutonomousGuestTaskSchedule(input: Readonly<{
  authority: AutonomousGuestAuthority;
  schedules: MastraSchedules;
  taskId: string;
}>) {
  await taskForAuthority(input.authority, input.taskId);
  await input.schedules.resume(autonomousGuestTaskScheduleId(input.authority, input.taskId));
}

export async function cancelAutonomousGuestTaskSchedule(input: Readonly<{
  authority: AutonomousGuestAuthority;
  schedules: MastraSchedules;
  taskId: string;
  at?: Date;
}>) {
  await taskForAuthority(input.authority, input.taskId);
  const cancelled = await cancelAutonomousGuestTask(input.authority, input.taskId, input.at);
  await input.schedules.delete(autonomousGuestTaskScheduleId(input.authority, input.taskId));
  return cancelled;
}

export async function wakeAutonomousGuestTask(input: Readonly<{
  authority: AutonomousGuestAuthority;
  payload: AutonomousGuestWakePayload;
  resolvePolicy: AutonomousGuestTaskPolicyResolver;
  at?: Date;
}>) {
  const task = await taskForAuthority(input.authority, input.payload.taskId);
  if (input.payload.autonomousRunId !== task.autonomousRunId || input.payload.guestWorkspaceId !== task.guestWorkspaceId) {
    throw new Error("Autonomous Guest wake payload does not match the task namespace.");
  }
  const policy = await input.resolvePolicy(task);
  const revalidated = await revalidateAutonomousGuestTask(input.authority, task.taskId, policy, input.at);
  return Object.freeze({
    taskId: revalidated.taskId,
    state: revalidated.state,
    failureClass: revalidated.lastFailureClass,
    eligible: revalidated.state === "eligible",
  });
}