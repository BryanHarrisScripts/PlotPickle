import type { AutonomousGuestAuthority } from "../../core/auth/autonomous-guest/guest-authority";
import {
  readAutonomousGuestTaskLedger,
  recoverAbandonedAutonomousGuestTasks,
  type AutonomousGuestTask,
} from "./task-ledger";
import {
  revalidateAutonomousGuestTask,
  type AutonomousGuestTaskPolicySnapshot,
} from "./task-lifecycle";

const TERMINAL_STATES = new Set(["completed", "cancelled", "expired", "failed"]);

export type AutonomousGuestRecoveryPolicyResolver = (
  task: AutonomousGuestTask,
) => Promise<AutonomousGuestTaskPolicySnapshot> | AutonomousGuestTaskPolicySnapshot;

export type AutonomousGuestRestartRecoveryEvidence = Readonly<{
  recoveredAt: string;
  autonomousRunId: string;
  guestWorkspaceId: string;
  abandonedLeaseTaskIds: readonly string[];
  revalidatedTaskIds: readonly string[];
  completedTaskIdsPreserved: readonly string[];
  activeLeaseTaskIdsPreserved: readonly string[];
  resultingStates: Readonly<Record<string, string>>;
}>;

export async function recoverAutonomousGuestSchedulerAfterRestart(input: Readonly<{
  authority: AutonomousGuestAuthority;
  resolvePolicy: AutonomousGuestRecoveryPolicyResolver;
  at?: Date;
}>) {
  const at = input.at ?? new Date();
  const before = await readAutonomousGuestTaskLedger(input.authority);
  const beforeById = new Map(before.map((task) => [task.taskId, task]));
  const abandonedLeaseTaskIds = before
    .filter((task) => task.state === "running" && task.leaseExpiresAt && new Date(task.leaseExpiresAt).getTime() <= at.getTime())
    .map((task) => task.taskId);
  const completedTaskIdsPreserved = before.filter((task) => task.state === "completed").map((task) => task.taskId);
  const activeLeaseTaskIdsPreserved = before
    .filter((task) => task.state === "running" && task.leaseExpiresAt && new Date(task.leaseExpiresAt).getTime() > at.getTime())
    .map((task) => task.taskId);

  await recoverAbandonedAutonomousGuestTasks(input.authority, at);
  const afterLeaseRecovery = await readAutonomousGuestTaskLedger(input.authority);
  const revalidatedTaskIds: string[] = [];

  for (const task of afterLeaseRecovery) {
    if (TERMINAL_STATES.has(task.state) || task.state === "running") continue;
    if (new Date(task.notBefore).getTime() > at.getTime()) continue;
    if (task.expiresAt && new Date(task.expiresAt).getTime() <= at.getTime()) continue;
    const policy = await input.resolvePolicy(task);
    await revalidateAutonomousGuestTask(input.authority, task.taskId, policy, at);
    revalidatedTaskIds.push(task.taskId);
  }

  const finalTasks = await readAutonomousGuestTaskLedger(input.authority);
  const finalById = new Map(finalTasks.map((task) => [task.taskId, task]));
  for (const taskId of completedTaskIdsPreserved) {
    const beforeTask = beforeById.get(taskId);
    const afterTask = finalById.get(taskId);
    if (!beforeTask || !afterTask || afterTask.state !== "completed" || afterTask.attempt !== beforeTask.attempt || afterTask.completedAt !== beforeTask.completedAt) {
      throw new Error("Completed Autonomous Guest task changed during restart recovery.");
    }
  }
  for (const taskId of activeLeaseTaskIdsPreserved) {
    const beforeTask = beforeById.get(taskId);
    const afterTask = finalById.get(taskId);
    if (!beforeTask || !afterTask || afterTask.state !== "running" || afterTask.leaseId !== beforeTask.leaseId || afterTask.attempt !== beforeTask.attempt) {
      throw new Error("Active Autonomous Guest task lease changed during restart recovery.");
    }
  }

  const evidence: AutonomousGuestRestartRecoveryEvidence = Object.freeze({
    recoveredAt: at.toISOString(),
    autonomousRunId: input.authority.autonomousRunId,
    guestWorkspaceId: input.authority.workspaceId,
    abandonedLeaseTaskIds: Object.freeze(abandonedLeaseTaskIds),
    revalidatedTaskIds: Object.freeze(revalidatedTaskIds),
    completedTaskIdsPreserved: Object.freeze(completedTaskIdsPreserved),
    activeLeaseTaskIdsPreserved: Object.freeze(activeLeaseTaskIdsPreserved),
    resultingStates: Object.freeze(Object.fromEntries(finalTasks.map((task) => [task.taskId, task.state]))),
  });

  return Object.freeze({ tasks: finalTasks, evidence });
}
