import { randomUUID } from "node:crypto";

export const PLOTPICKLE_NODE_LIFECYCLE_STATES = Object.freeze([
  "RUNNING",
  "SAVING",
  "SHUTTING DOWN",
  "SHUTDOWN BLOCKED",
  "STOPPED",
]);

function errorText(error) {
  return error instanceof Error ? error.message : String(error || "Shutdown could not continue.");
}

export function createPlotPickleNodeShutdownLifecycle(options = {}) {
  const now = typeof options.now === "function" ? options.now : () => new Date().toISOString();
  const tokenFactory = typeof options.tokenFactory === "function" ? options.tokenFactory : randomUUID;
  let state = "RUNNING";
  let token = null;
  let lastError = "";
  let updatedAt = now();

  const snapshot = () => Object.freeze({ state, lastError, updatedAt, inProgress: state === "SAVING" || state === "SHUTTING DOWN" });
  const requireToken = (candidate) => {
    if (!token || candidate !== token) throw new Error("The graceful shutdown proof is invalid or expired.");
  };

  return Object.freeze({
    snapshot,
    begin() {
      if (state === "SAVING" || state === "SHUTTING DOWN") throw new Error("PlotPickle shutdown is already in progress.");
      if (state === "STOPPED") throw new Error("This PlotPickle Node is already stopped.");
      state = "SAVING";
      token = tokenFactory();
      lastError = "";
      updatedAt = now();
      return Object.freeze({ token, lifecycle: snapshot() });
    },
    block(candidate, error) {
      requireToken(candidate);
      state = "SHUTDOWN BLOCKED";
      token = null;
      lastError = errorText(error).slice(0, 500);
      updatedAt = now();
      return snapshot();
    },
    commit(candidate) {
      requireToken(candidate);
      if (state !== "SAVING") throw new Error("PlotPickle shutdown cannot advance from the current lifecycle state.");
      state = "SHUTTING DOWN";
      token = null;
      lastError = "";
      updatedAt = now();
      return snapshot();
    },
    blockCommitted(error) {
      if (state !== "SHUTTING DOWN") throw new Error("PlotPickle shutdown is not in the managed-service teardown phase.");
      state = "SHUTDOWN BLOCKED";
      lastError = errorText(error).slice(0, 500);
      updatedAt = now();
      return snapshot();
    },
    stop() {
      if (state !== "SHUTTING DOWN") throw new Error("PlotPickle can report STOPPED only after managed shutdown begins.");
      state = "STOPPED";
      lastError = "";
      updatedAt = now();
      return snapshot();
    },
  });
}

export async function runSaveFirstNodeShutdown(steps) {
  const begun = await steps.begin();
  try {
    await steps.persist();
    await steps.releaseSession();
    await steps.commit(begun.token);
    return begun.token;
  } catch (error) {
    if (typeof steps.block === "function") {
      try { await steps.block(begun.token, error); }
      catch (blockError) {
        throw new AggregateError([error, blockError], "PlotPickle could not persist the session or record the blocked shutdown state.");
      }
    }
    throw error;
  }
}
