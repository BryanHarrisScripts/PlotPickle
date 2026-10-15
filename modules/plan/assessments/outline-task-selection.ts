import type { OutlineTaskView } from "./outline-task-browser";

export type OutlineTaskSelectionScope = Readonly<{
  projectId: string;
  contextReceipt: string;
  blockNumber: number;
  production: boolean;
  /** The authenticated gateway already restricts tasks to the unlocked profile. */
  profileId?: string;
  /** Preserve the exact run admitted by the host across automatic polling/actions. */
  pinnedRunId?: string;
}>;

const EXECUTING_STATES = new Set(["queued", "preparing-context", "working", "verifying", "revising"]);

/** Project host execution separately from a durable state that may still say "working"
 * after the worker has stopped. This is display-only: no task lifecycle changes.
 */
export function outlineTaskDisplayStatus(task: Pick<OutlineTaskView, "run" | "running" | "resumeRequired" | "error">): string {
  if (task.running && EXECUTING_STATES.has(task.run.state)) return "working";
  if (task.resumeRequired) return task.error ? "blocked - recovery required" : "recovery required";
  if (EXECUTING_STATES.has(task.run.state)) return "not executing - inspect recovery";
  return task.run.state.replaceAll("-", " ");
}

function createdAt(task: OutlineTaskView): number {
  const timestamp = Date.parse(task.run.createdAt);
  return Number.isFinite(timestamp) ? timestamp : Number.NEGATIVE_INFINITY;
}

/** Select one authenticated, current-material Block run independently of gateway list order.
 * An executing task takes precedence over settled history. Among peers the
 * immutable creation time wins, with run identity as the final stable tie-break.
 * A pinned admission never falls back to a different task.
 */
export function selectCurrentOutlineTask(
  tasks: readonly OutlineTaskView[],
  scope: OutlineTaskSelectionScope,
): OutlineTaskView | null {
  const matching = tasks.filter((task) => task.scope.projectId === scope.projectId
    && task.scope.contextReceipt === scope.contextReceipt
    && (scope.profileId === undefined || task.scope.humanProfileId === scope.profileId)
    && Boolean(task.productionPass) === scope.production
    && task.steps.length === 1 && task.steps[0].id === "block-" + scope.blockNumber
    && (!scope.production || (task.productionPass?.grant.blockNumber === scope.blockNumber
      && task.productionPass.grant.sourceReceipt === scope.contextReceipt)));
  if (scope.pinnedRunId !== undefined) {
    return matching.find((task) => task.scope.runId === scope.pinnedRunId) ?? null;
  }
  return matching.sort((left, right) => {
    const activeDelta = Number(EXECUTING_STATES.has(right.run.state)) - Number(EXECUTING_STATES.has(left.run.state));
    if (activeDelta) return activeDelta;
    const timeDelta = createdAt(right) - createdAt(left);
    if (Number.isFinite(timeDelta) && timeDelta !== 0) return timeDelta;
    return left.scope.runId === right.scope.runId ? 0 : left.scope.runId < right.scope.runId ? 1 : -1;
  })[0] ?? null;
}
