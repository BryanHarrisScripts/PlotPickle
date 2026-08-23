import {
  cancelResponsibilityRun,
  responsibilityRunTimestamp,
  responsibilityRunLimitStatus,
  type ResponsibilityRun,
  type ResponsibilityRunLimits,
} from "./responsibility-runs";

export type ResponsibilityInterruptSignal = "cancel" | "manual-stop" | "host-shutdown";

export type ResponsibilityRunInterruptReceipt = {
  version: 1;
  runId: string;
  requestedBy: string;
  signal: ResponsibilityInterruptSignal;
  reason: string;
  requestedAt: string;
  previousState: ResponsibilityRun["state"];
  resultingState: "cancelled";
  limitsAtInterrupt: ResponsibilityRunLimits;
  immutable: true;
};

function clean(value: unknown, maximum = 500) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

/**
 * Host-owned interrupt boundary. It delegates state transition to the existing
 * Responsibility Run cancellation function and records immutable metadata
 * without altering attempts, token/tool budgets, permissions or verification.
 */
export function interruptResponsibilityRun(input: {
  run: ResponsibilityRun;
  requestedBy: string;
  signal?: ResponsibilityInterruptSignal;
  reason: string;
  requestedAt?: string;
}) {
  const requestedBy = clean(input.requestedBy, 180);
  const reason = clean(input.reason, 500);
  if (!requestedBy) throw new Error("Responsibility Run interrupt requires a host/user identity.");
  if (!reason) throw new Error("Responsibility Run interrupt requires an explicit reason.");
  if (["completed", "failed", "cancelled"].includes(input.run.state)) throw new Error(`A terminal Responsibility Run cannot be interrupted while ${input.run.state}.`);
  const requestedAt = responsibilityRunTimestamp(input.requestedAt);
  const limitsAtInterrupt = { ...input.run.limits };
  const previousState = input.run.state;
  const run = cancelResponsibilityRun(input.run, `interrupt:${input.signal || "cancel"}:${requestedBy}:${reason}`, requestedAt);
  const receipt: ResponsibilityRunInterruptReceipt = {
    version: 1,
    runId: run.runId,
    requestedBy,
    signal: input.signal || "cancel",
    reason,
    requestedAt,
    previousState,
    resultingState: "cancelled",
    limitsAtInterrupt,
    immutable: true,
  };
  return { run, receipt };
}

export function responsibilityInterruptPreservedLimits(run: ResponsibilityRun, receipt: ResponsibilityRunInterruptReceipt) {
  return JSON.stringify(run.limits) === JSON.stringify(receipt.limitsAtInterrupt);
}

export function responsibilityRunCanContinue(run: ResponsibilityRun, now?: string) {
  if (["completed", "failed", "cancelled"].includes(run.state)) return false;
  return !responsibilityRunLimitStatus(run, now).exhausted;
}
