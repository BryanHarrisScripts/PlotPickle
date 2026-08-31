import type { Schedule } from "@mastra/core/storage";
import type { AutonomousGuestAuthority } from "../../../core/auth/autonomous-guest/guest-authority";
import type { AutonomousGuestFileSchedulesStorage } from "../mastra-file-schedules-storage";
import { AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID } from "../mastra-task-scheduler";
import type { AutonomousGuestTask } from "../task-ledger";
import {
  recoverAutonomousGuestSchedulerAfterRestart,
  type AutonomousGuestRecoveryPolicyResolver,
} from "./restart-recovery";

const TERMINAL_STATES = new Set(["completed", "cancelled", "expired", "failed"]);

function scheduleTaskId(authority: AutonomousGuestAuthority, schedule: Schedule) {
  if (schedule.target.type !== "workflow" || schedule.target.workflowId !== AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID) {
    throw new Error("Autonomous Guest restart encountered a schedule outside the PlotPickle wake workflow.");
  }
  const payload = schedule.target.inputData;
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    throw new Error("Autonomous Guest restart encountered an invalid wake payload.");
  }
  const candidate = payload as Record<string, unknown>;
  const taskId = String(candidate.taskId || "");
  if (!/^guest-task-[a-f0-9-]{36}$/i.test(taskId)) {
    throw new Error("Autonomous Guest restart encountered an invalid scheduled task ID.");
  }
  if (String(candidate.autonomousRunId || "") !== authority.autonomousRunId || String(candidate.guestWorkspaceId || "") !== authority.workspaceId) {
    throw new Error("Autonomous Guest restart encountered a schedule outside the current Guest namespace.");
  }
  return taskId;
}

export async function reconcileAutonomousGuestSchedulesAfterRestart(input: Readonly<{
  authority: AutonomousGuestAuthority;
  schedules: Pick<AutonomousGuestFileSchedulesStorage, "listSchedules" | "deleteSchedule">;
  tasks: readonly AutonomousGuestTask[];
}>) {
  const taskById = new Map(input.tasks.map((task) => [task.taskId, task]));
  const schedules = await input.schedules.listSchedules({ workflowId: AUTONOMOUS_GUEST_WAKE_WORKFLOW_ID });
  const removedScheduleIds: string[] = [];
  const preservedScheduleIds: string[] = [];

  for (const schedule of schedules) {
    const taskId = scheduleTaskId(input.authority, schedule);
    const task = taskById.get(taskId);
    if (!task || TERMINAL_STATES.has(task.state)) {
      await input.schedules.deleteSchedule(schedule.id);
      removedScheduleIds.push(schedule.id);
      continue;
    }
    preservedScheduleIds.push(schedule.id);
  }

  return Object.freeze({
    removedScheduleIds: Object.freeze(removedScheduleIds),
    preservedScheduleIds: Object.freeze(preservedScheduleIds),
  });
}

export async function recoverAndReconcileAutonomousGuestSchedulerAfterRestart(input: Readonly<{
  authority: AutonomousGuestAuthority;
  schedules: Pick<AutonomousGuestFileSchedulesStorage, "listSchedules" | "deleteSchedule">;
  resolvePolicy: AutonomousGuestRecoveryPolicyResolver;
  at?: Date;
}>) {
  const recovery = await recoverAutonomousGuestSchedulerAfterRestart({
    authority: input.authority,
    resolvePolicy: input.resolvePolicy,
    at: input.at,
  });
  const schedules = await reconcileAutonomousGuestSchedulesAfterRestart({
    authority: input.authority,
    schedules: input.schedules,
    tasks: recovery.tasks,
  });
  return Object.freeze({ recovery, schedules });
}
