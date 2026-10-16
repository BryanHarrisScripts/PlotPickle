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
export function outlineTaskDisplayStatus(task: Pick<OutlineTaskView, "run" | "running" | "resumeRequired" | "error" | "reviewGate">): string {
  if (task.running && EXECUTING_STATES.has(task.run.state)) return "working";
  if (task.reviewGate && !task.error) return "source review required - candidate withheld";
  if (task.resumeRequired) return task.error ? "blocked - recovery required" : "recovery required";
  if (EXECUTING_STATES.has(task.run.state)) return "not executing - inspect recovery";
  return task.run.state.replaceAll("-", " ");
}

/** Authenticated, read-only diagnostic projection; never echo provider exceptions.
 * A reservation is not proof of a model call, invoice, or completed artifact.
 */
export function describeOutlineTaskDiagnostic(task: OutlineTaskView): string {
  const reservations = Array.isArray(task.attempts) ? task.attempts : [];
  const reported = reservations.filter(attempt => attempt.status === "reported" && attempt.usage != null).length;
  // Explicit conditional order matters. The old `faultMatch || timeout ?`
  // expression incorrectly classified any matching non-timeout fault as HOST_TIMEOUT.
  const faultCode = typeof task.error === "string"
    ? /^The scheduler faulted \(([A-Z_]+)\)\./u.exec(task.error)?.[1] : undefined;
  const timedOut = typeof task.error === "string"
    && /^The scheduler review timed out at the (25|180)-second response limit\./u.test(task.error);
  const knownFaultCodes = new Set([
    "SOURCE_CONTEXT_LIMIT", "USAGE_NOT_RECORDED", "TASK_BUDGET_EXHAUSTED",
    "HOST_QUOTE_UNAVAILABLE", "FIDELITY_SCHEMA_INVALID", "FIDELITY_EVIDENCE_INVALID",
    "FIDELITY_COVERAGE_MISSING", "UNCLASSIFIED_PRIVATE_FAILURE",
  ]);
  const cause = faultCode && knownFaultCodes.has(faultCode) ? faultCode
    : timedOut ? "HOST_TIMEOUT" : typeof task.error === "string" ? "UNCLASSIFIED" : "NOT_RECORDED_OR_UNAVAILABLE";
  const candidate = task.productionPass?.candidate ? "saved candidate" : "no candidate";
  const fidelity = task.productionPass?.review ? "saved semantic review" : "no semantic review";
  const stage = task.running ? "executing" : task.proposals.length ? "partial or completed assessment saved" : "no admitted assessment";
  // Never interpret a reservation or callback entry as a confirmed HTTP request.
  // Older tasks lack checkpointStage; report that distinction rather than infer
  // stages retroactively from the persisted "working" run state.
  const stages = new Set([
    "reservation-persisted", "worker-callback-entered", "usage-reported",
    "result-processing-entered", "assessment-saved", "semantic-review-saved",
  ]);
  const latest = reservations.at(-1);
  const lastStage = stages.has(latest?.checkpointStage || "") ? latest.checkpointStage : "NOT_CAPTURED_LEGACY";
  const stagesText = lastStage === "worker-callback-entered"
    ? "worker callback entered; provider HTTP dispatch and cost UNKNOWN"
    : lastStage === "reservation-persisted"
      ? "reservation saved only; worker callback not proven"
      : lastStage === "usage-reported"
        ? "usage callback persisted; result validation not proven"
        : lastStage === "result-processing-entered"
          ? "worker output processing began; validated artifact not proven"
          : lastStage === "assessment-saved"
            ? "assessment artifact persisted; independent review not implied"
            : lastStage === "semantic-review-saved"
              ? "assessment and semantic review persisted; Human approval not implied"
              : "legacy or unrecognized stage; checkpoint not captured";
  return [
    "Protected task: " + task.scope.runId,
    "Provider: " + task.scope.provider + "; model: " + task.scope.model,
    "Execution: " + outlineTaskDisplayStatus(task) + "; durable run state: " + task.run.state + "; stage: " + stage,
    "Attempts reserved: " + reservations.length + "; usage-reported: " + reported + "; model dispatch: UNKNOWN unless independently observed",
    "Last durable host checkpoint: " + lastStage + " — " + stagesText
      + ". This records stage, NOT provider call count or charge.",
    "Admitted source-bound assessments: " + task.proposals.length + "/" + task.steps.length
      + "; " + fidelity + "; " + candidate,
    task.reviewGate && !task.error
      ? "Review gate: " + task.reviewGate.code + "; " + task.reviewGate.blockers.join(" ") + " Review saved findings against source; no automatic retry."
      : "Safe fault category: " + cause + "; protected checkpoint/private error cause: NOT INSPECTED",
    "No resume, cancellation, new model request, creative acceptance or media generation was performed.",
  ].join("\n");
}

function createdAt(task: OutlineTaskView): number {
  // Responsibility Runs persist creation as an event, not a createdAt field.
  const timestamp = Date.parse(task.run.events?.find(event => event.type === "run.created")?.at
    ?? task.run.context?.receiptGeneratedAt ?? "");
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
