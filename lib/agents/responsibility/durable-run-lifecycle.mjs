const ACTIVE_STATES = new Set(["queued", "preparing-context", "working", "verifying", "revising"]);
const TERMINAL_STATES = new Set(["completed", "failed", "cancelled"]);

export const DURABLE_RUN_PRESENTATION_STATES = Object.freeze([
  "active",
  "paused",
  "interrupted",
  "waiting-for-writer",
  "stale",
  "unavailable",
  "completed",
  "failed",
  "cancelled",
]);

export const DURABLE_TASK_MAINTENANCE_POLICY = Object.freeze({
  upgrade: "preserve",
  startupInference: false,
  startupReset: false,
  automaticDelete: false,
  resetRequiresHuman: true,
  resetRequiresStoppedTask: true,
  deleteRequiresHuman: true,
  deleteAvailableInRunActivity: false,
  terminalRestartAllowed: false,
});

function failedPresentation(run) {
  const reason = String(run?.stopReason || "").replace(/\s+/gu, " ").trim();
  if (/\bstale\b|mismatch|revision|context (?:changed|expired|invalid)|out[- ]of[- ]date/iu.test(reason)) {
    return {
      state: "stale",
      resumableHere: false,
      nextAction: "Restart from the owning workflow with current project and context authority.",
      detail: reason || "Saved task authority no longer matches the current project context.",
    };
  }
  if (/unavailable|provider|runtime|durable|model.*(?:missing|offline)|not installed|not compatible/iu.test(reason)) {
    return {
      state: "unavailable",
      resumableHere: false,
      nextAction: "Restore the required runtime or provider, then return to the owning workflow.",
      detail: reason || "The required runtime or provider is unavailable.",
    };
  }
  return {
    state: "failed",
    resumableHere: false,
    nextAction: "Review the failure before starting new work.",
    detail: reason || "The bounded run failed.",
  };
}

/**
 * Project persisted Responsibility Run state into a Human-facing recovery state.
 *
 * sessionOwned is deliberately process-local presentation evidence. It never
 * authorizes execution. An active run loaded by a new PlotPickle process is
 * shown as interrupted until its owning workflow performs governed resume.
 */
export function projectDurableRunLifecycle(run, { sessionOwned = false } = {}) {
  const state = String(run?.state || "");
  if (state === "completed") {
    return Object.freeze({
      state: "completed",
      resumableHere: false,
      nextAction: "No action required.",
      detail: "The bounded run completed.",
    });
  }
  if (state === "cancelled") {
    return Object.freeze({
      state: "cancelled",
      resumableHere: false,
      nextAction: "Start new work only through the owning workflow.",
      detail: String(run?.stopReason || "").replace(/\s+/gu, " ").trim() || "The run was stopped by the Human or owning workflow.",
    });
  }
  if (state === "failed") return Object.freeze(failedPresentation(run));
  if (state === "paused") {
    return Object.freeze({
      state: "paused",
      resumableHere: true,
      nextAction: "Resume when ready, or stop the run.",
      detail: "The Human explicitly paused this Responsibility Run.",
    });
  }
  if (state === "waiting-for-writer") {
    return Object.freeze({
      state: "waiting-for-writer",
      resumableHere: false,
      nextAction: "Review the proposal in its owning workflow.",
      detail: "Agent work is waiting for writer authority.",
    });
  }
  if (ACTIVE_STATES.has(state)) {
    if (sessionOwned) {
      return Object.freeze({
        state: "active",
        resumableHere: false,
        nextAction: "Current bounded work is active.",
        detail: "This PlotPickle process owns the current Responsibility Run presentation.",
      });
    }
    return Object.freeze({
      state: "interrupted",
      resumableHere: false,
      nextAction: "Return to the owning workflow to resume the remaining work.",
      detail: "PlotPickle reopened with unfinished Responsibility Run state. No Agent was resumed automatically.",
    });
  }
  return Object.freeze({
    state: "unavailable",
    resumableHere: false,
    nextAction: "Review the Responsibility Run record before continuing.",
    detail: "The saved Responsibility Run state is not recognized by this version of PlotPickle.",
  });
}

export function durableRunIsTerminal(run) {
  return TERMINAL_STATES.has(String(run?.state || ""));
}
