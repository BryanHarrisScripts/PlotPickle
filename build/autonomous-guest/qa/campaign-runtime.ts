import { getAutonomousGuestAuthority } from "../../../core/auth/autonomous-guest/guest-authority";
import { startAutonomousGuestSchedulerRuntime } from "../mastra-wake-runtime";
import { listDueAutonomousGuestTasks } from "../task-lifecycle";
import {
  createAutonomousQaTaskPolicyResolver,
  type AutonomousQaCurrentPolicy,
} from "./campaign-planner";

function currentQaAuthority() {
  const authority = getAutonomousGuestAuthority("http://127.0.0.1", "desktop-loopback");
  if (!authority) throw new Error("Autonomous QA scheduler requires enabled delegated Guest authority.");
  return authority;
}

export function createCurrentAutonomousQaTaskPolicyResolver(policy: AutonomousQaCurrentPolicy) {
  return (task: Parameters<ReturnType<typeof createAutonomousQaTaskPolicyResolver>>[0]) => {
    const authority = currentQaAuthority();
    return createAutonomousQaTaskPolicyResolver(authority, policy)(task);
  };
}

export async function startAutonomousQaSchedulerRuntime(policy: AutonomousQaCurrentPolicy) {
  if (!policy.enabled) throw new Error("Autonomous QA scheduler cannot start while QA policy is disabled.");
  const runtime = await startAutonomousGuestSchedulerRuntime(createCurrentAutonomousQaTaskPolicyResolver(policy));
  return Object.freeze({
    ...runtime,
    qaPolicy: policy,
  });
}

export async function listEligibleAutonomousQaTasks(policy: AutonomousQaCurrentPolicy, at = new Date()) {
  const authority = currentQaAuthority();
  const resolver = createAutonomousQaTaskPolicyResolver(authority, policy);
  const due = await listDueAutonomousGuestTasks(authority, at);
  const eligible = [];
  for (const task of due) {
    if (!task.taskKind.startsWith("qa:")) continue;
    const snapshot = await resolver(task);
    if (
      snapshot.guestEnabled
      && snapshot.allowListedTaskKinds.includes(task.taskKind)
      && snapshot.currentRevision === task.baseRevision
      && snapshot.providerAllowed
      && snapshot.budgetAllowed
      && !snapshot.cancelled
    ) eligible.push(task);
  }
  return Object.freeze(eligible);
}
