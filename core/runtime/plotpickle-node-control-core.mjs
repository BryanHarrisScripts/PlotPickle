import { createHash, randomUUID } from "node:crypto";
import { closeSync, fsyncSync, mkdirSync, openSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const NODE_IDENTITY_FORMAT = "plotpickle-node-identity";
const NODE_IDENTITY_VERSION = 1;
const NODE_ID_PATTERN = /^[a-z0-9][a-z0-9._-]{1,62}$/i;
let cached = null;

export function plotPicklePersistentHome(env = process.env) {
  const override = String(env.PLOTPICKLE_HOME || "").trim();
  if (override) return path.resolve(override);
  const localAppData = String(env.LOCALAPPDATA || "").trim();
  if (localAppData) return path.join(localAppData, "PlotPickle");
  const xdgState = String(env.XDG_STATE_HOME || "").trim();
  if (xdgState) return path.join(xdgState, "PlotPickle");
  return path.join(os.homedir(), ".plotpickle");
}

function normalizeNodeId(value) {
  const nodeId = String(value || "").trim();
  if (!NODE_ID_PATTERN.test(nodeId)) throw new Error("PlotPickle Node identity is invalid.");
  return nodeId;
}

function parseIdentity(source, filePath) {
  let value;
  try { value = JSON.parse(source); } catch { throw new Error(`PlotPickle Node identity is unreadable: ${filePath}`); }
  if (!value || typeof value !== "object" || Array.isArray(value)
    || value.format !== NODE_IDENTITY_FORMAT || value.version !== NODE_IDENTITY_VERSION) {
    throw new Error(`PlotPickle Node identity contract is invalid: ${filePath}`);
  }
  return Object.freeze({
    format: NODE_IDENTITY_FORMAT,
    version: NODE_IDENTITY_VERSION,
    nodeId: normalizeNodeId(value.nodeId),
    createdAt: new Date(value.createdAt).toISOString(),
    path: filePath,
    source: "disk",
  });
}

export function shortPlotPickleNodeId(nodeId) {
  const digest = createHash("sha256").update(normalizeNodeId(nodeId)).digest("hex").slice(0, 4).toUpperCase();
  return `PP-${digest}`;
}

export function ensurePlotPickleNodeIdentity(options = {}) {
  const env = options.env || process.env;
  const root = path.resolve(options.root || plotPicklePersistentHome(env));
  const explicit = String(options.nodeId || env.PLOTPICKLE_NODE_ID || "").trim();
  if (explicit) {
    const nodeId = normalizeNodeId(explicit);
    return Object.freeze({
      format: NODE_IDENTITY_FORMAT,
      version: NODE_IDENTITY_VERSION,
      nodeId,
      createdAt: null,
      path: null,
      source: "environment",
      shortId: shortPlotPickleNodeId(nodeId),
    });
  }
  if (cached && cached.root === root) return cached.identity;

  const directory = path.join(root, "node", "identity");
  const filePath = path.join(directory, "node.json");
  mkdirSync(directory, { recursive: true, mode: 0o700 });

  let identity;
  try {
    identity = parseIdentity(readFileSync(filePath, "utf8"), filePath);
  } catch (error) {
    if (error?.code !== "ENOENT") throw error;
    const record = {
      format: NODE_IDENTITY_FORMAT,
      version: NODE_IDENTITY_VERSION,
      nodeId: `pp-node-${randomUUID().replaceAll("-", "")}`,
      createdAt: new Date().toISOString(),
    };
    let handle;
    try {
      handle = openSync(filePath, "wx", 0o600);
      writeFileSync(handle, `${JSON.stringify(record, null, 2)}\n`, "utf8");
      fsyncSync(handle);
      identity = parseIdentity(JSON.stringify(record), filePath);
    } catch (writeError) {
      if (writeError?.code !== "EEXIST") throw writeError;
      identity = parseIdentity(readFileSync(filePath, "utf8"), filePath);
    } finally {
      if (handle !== undefined) closeSync(handle);
    }
  }

  const normalized = Object.freeze({ ...identity, shortId: shortPlotPickleNodeId(identity.nodeId) });
  cached = { root, identity: normalized };
  return normalized;
}

export function resetPlotPickleNodeIdentityCacheForTests() {
  cached = null;
}

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
