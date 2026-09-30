import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const DEVELOPMENT_TASK_STATES = Object.freeze([
  "proposed",
  "authorized",
  "active",
  "testing",
  "repair",
  "pr-open",
  "verifying",
  "ready-to-merge",
  "merged",
  "blocked",
  "cancelled",
]);

const TERMINAL_STATES = new Set(["merged", "cancelled"]);
const MUTATION_STATES = new Set(["authorized", "active", "testing", "repair"]);
const MERGE_POLICIES = new Set(["review-before-merge", "merge-when-current-head-green"]);

const TRANSITIONS = Object.freeze({
  proposed: new Set(["authorized", "cancelled"]),
  authorized: new Set(["active", "blocked", "cancelled"]),
  active: new Set(["testing", "repair", "blocked", "cancelled"]),
  testing: new Set(["repair", "pr-open", "blocked", "cancelled"]),
  repair: new Set(["testing", "pr-open", "blocked", "cancelled"]),
  "pr-open": new Set(["verifying", "repair", "blocked", "cancelled"]),
  verifying: new Set(["ready-to-merge", "repair", "blocked", "cancelled"]),
  "ready-to-merge": new Set(["merged", "repair", "verifying", "blocked", "cancelled"]),
  blocked: new Set(["authorized", "active", "repair", "verifying", "cancelled"]),
  merged: new Set(),
  cancelled: new Set(),
});

function text(value, max = 512) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function nowIso(now = new Date()) {
  return now instanceof Date ? now.toISOString() : new Date(now).toISOString();
}

function normalizedPath(value) {
  const raw = text(value, 4096).replace(/\\/gu, "/").replace(/^\.\//u, "").replace(/\/{2,}/gu, "/");
  const parts = [];
  for (const part of raw.split("/")) {
    if (!part || part === ".") continue;
    if (part === "..") {
      if (!parts.length) throw new Error("Development write scope may not escape the repository root.");
      parts.pop();
    } else parts.push(part);
  }
  return parts.join("/");
}

export function normalizeDevelopmentScope(value) {
  const scope = normalizedPath(value);
  if (!scope) return ".";
  return scope.endsWith("/**") ? scope.slice(0, -3) || "." : scope;
}

export function developmentScopesOverlap(left, right) {
  const a = normalizeDevelopmentScope(left);
  const b = normalizeDevelopmentScope(right);
  if (a === "." || b === ".") return true;
  return a === b || a.startsWith(`${b}/`) || b.startsWith(`${a}/`);
}

function uniqueScopes(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map(normalizeDevelopmentScope))].sort();
}

function boundedRefs(value, limit = 64) {
  return Array.isArray(value) ? value.map((item) => text(item, 512)).filter(Boolean).slice(0, limit) : [];
}

export function createDevelopmentTask(input = {}, now = new Date()) {
  const issueNumber = Number(input.issueNumber);
  const repository = text(input.repository, 240);
  const baseSha = text(input.baseSha, 160);
  if (!Number.isInteger(issueNumber) || issueNumber <= 0) throw new Error("A governed development task requires an originating GitHub issue.");
  if (!repository || !baseSha) throw new Error("A governed development task requires repository and base SHA.");
  const timestamp = nowIso(now);
  return {
    schemaVersion: 1,
    taskId: text(input.taskId, 180) || `dev-${issueNumber}-${randomUUID()}`,
    issue: { repository, number: issueNumber },
    provenance: {
      dsddFingerprint: text(input.dsddFingerprint, 240),
      intentVersion: Number.isInteger(input.intentVersion) ? input.intentVersion : null,
      intentDigest: text(input.intentDigest, 160),
    },
    lockedIntent: {
      immutable: Boolean(input.intentDigest),
      digest: text(input.intentDigest, 160),
      version: Number.isInteger(input.intentVersion) ? input.intentVersion : null,
    },
    repository: { name: repository, baseSha },
    branch: "",
    worktree: "",
    writeScopes: uniqueScopes(input.writeScopes),
    route: input.route && typeof input.route === "object" ? {
      logicalProviderId: text(input.route.logicalProviderId, 120),
      logicalModelId: text(input.route.logicalModelId, 160),
      providerId: text(input.route.providerId, 120),
      modelId: text(input.route.modelId, 200),
    } : null,
    allowedTools: Array.isArray(input.allowedTools) ? [...new Set(input.allowedTools.map((item) => text(item, 120)).filter(Boolean))].sort() : [],
    state: "proposed",
    authorization: null,
    focusedVerification: { status: "unrun", headSha: "", evidenceRefs: [] },
    pullRequest: { number: null, headSha: "" },
    exactHeadVerification: { status: "unverified", headSha: "", runIds: [], evidenceRefs: [] },
    mergeAuthorization: null,
    blockingReason: "",
    evidenceRefs: boundedRefs(input.evidenceRefs),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
}

export function authorizeDevelopmentTask(task, authorization = {}, now = new Date()) {
  if (task.state !== "proposed" && task.state !== "blocked") throw new Error("Only proposed or blocked tasks may receive implementation authorization.");
  if (authorization.authority !== "human") throw new Error("Implementation authorization must be explicit Human authority.");
  const authorized = structuredClone(task);
  authorized.authorization = {
    authority: "human",
    authorizedAt: nowIso(now),
    authorizationRef: text(authorization.authorizationRef, 512),
    revokedAt: "",
  };
  authorized.state = "authorized";
  authorized.blockingReason = "";
  authorized.updatedAt = nowIso(now);
  return authorized;
}

export function revokeDevelopmentTaskAuthorization(task, now = new Date()) {
  const next = structuredClone(task);
  if (next.authorization) next.authorization.revokedAt = nowIso(now);
  if (!TERMINAL_STATES.has(next.state)) next.state = "blocked";
  next.blockingReason = "human-authorization-revoked";
  next.mergeAuthorization = null;
  next.updatedAt = nowIso(now);
  return next;
}

export function bindDevelopmentWorktree(task, { branch, worktree, writeScopes = task.writeScopes } = {}, now = new Date()) {
  if (!task.authorization || task.authorization.revokedAt) throw new Error("Worktree binding requires active Human implementation authorization.");
  const branchName = text(branch, 512);
  const worktreePath = text(worktree, 4096);
  if (!branchName || !worktreePath) throw new Error("Source-writing tasks require explicit branch and worktree identity.");
  const next = structuredClone(task);
  next.branch = branchName;
  next.worktree = worktreePath;
  next.writeScopes = uniqueScopes(writeScopes);
  next.state = next.state === "authorized" ? "active" : next.state;
  next.updatedAt = nowIso(now);
  return next;
}

export function assertDevelopmentMutationAuthorized(task, requestedPath = ".") {
  if (!task?.authorization || task.authorization.authority !== "human" || task.authorization.revokedAt) {
    throw new Error("Human implementation authorization is required before source mutation.");
  }
  if (!MUTATION_STATES.has(task.state)) throw new Error(`Task state ${task.state} does not permit source mutation.`);
  if (!task.branch || !task.worktree) throw new Error("Source mutation requires bound branch/worktree identity.");
  const scopes = uniqueScopes(task.writeScopes);
  const target = normalizeDevelopmentScope(requestedPath);
  if (!scopes.some((scope) => developmentScopesOverlap(scope, target) && (scope === "." || target === scope || target.startsWith(`${scope}/`)))) {
    throw new Error(`Requested path ${target} is outside the task write scope.`);
  }
  return { allowed: true, taskId: task.taskId, branch: task.branch, worktree: task.worktree };
}

export function claimDevelopmentScopes(claims = [], task, scopes = task.writeScopes, now = new Date()) {
  assertDevelopmentMutationAuthorized(task, scopes?.[0] || ".");
  const wanted = uniqueScopes(scopes);
  const conflicts = [];
  for (const claim of Array.isArray(claims) ? claims : []) {
    if (!claim || claim.releasedAt || claim.taskId === task.taskId) continue;
    for (const requested of wanted) {
      if ((claim.scopes || []).some((owned) => developmentScopesOverlap(owned, requested))) {
        conflicts.push({ taskId: claim.taskId, scope: requested });
      }
    }
  }
  if (conflicts.length) {
    const error = new Error(`Development write scope conflicts with task ${conflicts[0].taskId}.`);
    error.code = "PLOTPICKLE_WRITE_SCOPE_CONFLICT";
    error.conflicts = conflicts;
    throw error;
  }
  const remaining = (Array.isArray(claims) ? claims : []).filter((claim) => claim?.taskId !== task.taskId || claim.releasedAt);
  return [...remaining, {
    claimId: `claim-${randomUUID()}`,
    taskId: task.taskId,
    branch: task.branch,
    worktree: task.worktree,
    scopes: wanted,
    claimedAt: nowIso(now),
    heartbeatAt: nowIso(now),
    releasedAt: "",
  }];
}

export function releaseDevelopmentClaims(claims = [], taskId, now = new Date()) {
  return (Array.isArray(claims) ? claims : []).map((claim) => (
    claim?.taskId === taskId && !claim.releasedAt
      ? { ...claim, releasedAt: nowIso(now) }
      : claim
  ));
}

export function reconcileDevelopmentClaims(claims = [], tasks = [], { now = new Date(), staleAfterMs = 30 * 60_000 } = {}) {
  const byId = new Map((Array.isArray(tasks) ? tasks : []).map((task) => [task.taskId, task]));
  const current = new Date(now).getTime();
  return (Array.isArray(claims) ? claims : []).map((claim) => {
    if (!claim || claim.releasedAt) return claim;
    const task = byId.get(claim.taskId);
    const heartbeat = Date.parse(claim.heartbeatAt || claim.claimedAt || "");
    const stale = !Number.isFinite(heartbeat) || current - heartbeat > staleAfterMs;
    if (!task || TERMINAL_STATES.has(task.state) || stale) {
      return { ...claim, releasedAt: nowIso(now), reconciliation: !task ? "orphaned-task" : TERMINAL_STATES.has(task.state) ? "task-terminal" : "stale-heartbeat" };
    }
    return claim;
  });
}

export function transitionDevelopmentTask(task, state, { blockingReason = "" } = {}, now = new Date()) {
  const target = text(state, 80);
  if (!DEVELOPMENT_TASK_STATES.includes(target)) throw new Error(`Unknown development task state: ${target}`);
  if (!TRANSITIONS[task.state]?.has(target)) throw new Error(`Illegal development task transition: ${task.state} -> ${target}`);
  const next = structuredClone(task);
  next.state = target;
  next.blockingReason = target === "blocked" ? text(blockingReason, 1200) || "blocked" : "";
  next.updatedAt = nowIso(now);
  return next;
}

export function recordDevelopmentPrHead(task, { prNumber, headSha } = {}, now = new Date()) {
  const number = Number(prNumber);
  const sha = text(headSha, 160);
  if (!Number.isInteger(number) || number <= 0 || !sha) throw new Error("PR number and current head SHA are required.");
  const next = structuredClone(task);
  const changedHead = Boolean(next.pullRequest.headSha && next.pullRequest.headSha !== sha);
  next.pullRequest = { number, headSha: sha };
  if (changedHead || (next.exactHeadVerification.headSha && next.exactHeadVerification.headSha !== sha)) {
    next.exactHeadVerification = { status: "unverified", headSha: "", runIds: [], evidenceRefs: [] };
    next.mergeAuthorization = next.mergeAuthorization?.policy === "merge-when-current-head-green"
      ? { ...next.mergeAuthorization, validForHeadSha: "", invalidatedAt: nowIso(now), invalidationReason: "pr-head-changed" }
      : next.mergeAuthorization;
    if (next.state === "ready-to-merge") next.state = "verifying";
  } else if (["testing", "repair", "active"].includes(next.state)) {
    next.state = "pr-open";
  }
  next.updatedAt = nowIso(now);
  return next;
}

export function recordExactHeadVerification(task, { headSha, status, runIds = [], evidenceRefs = [] } = {}, now = new Date()) {
  const sha = text(headSha, 160);
  if (!sha || sha !== task.pullRequest.headSha) throw new Error("Verification evidence must match the current PR head SHA.");
  if (status !== "green" && status !== "failed") throw new Error("Exact-head verification status must be green or failed.");
  const next = structuredClone(task);
  next.exactHeadVerification = {
    status,
    headSha: sha,
    runIds: boundedRefs(runIds, 32),
    evidenceRefs: boundedRefs(evidenceRefs),
  };
  next.state = status === "green" ? "verifying" : "repair";
  next.blockingReason = status === "failed" ? "exact-head-verification-failed" : "";
  if (status === "failed") next.mergeAuthorization = null;
  next.updatedAt = nowIso(now);
  return next;
}

export function authorizeDevelopmentMerge(task, { authority, policy, prNumber, headSha, authorizationRef = "" } = {}, now = new Date()) {
  if (authority !== "human") throw new Error("Merge authorization must be explicit Human authority.");
  if (!MERGE_POLICIES.has(policy)) throw new Error("Unsupported governed merge policy.");
  if (Number(prNumber) !== task.pullRequest.number || text(headSha, 160) !== task.pullRequest.headSha) {
    throw new Error("Merge authorization must be scoped to the current task PR/head.");
  }
  const next = structuredClone(task);
  next.mergeAuthorization = {
    authority: "human",
    policy,
    prNumber: task.pullRequest.number,
    validForHeadSha: task.pullRequest.headSha,
    authorizationRef: text(authorizationRef, 512),
    authorizedAt: nowIso(now),
    invalidatedAt: "",
    invalidationReason: "",
  };
  if (policy === "merge-when-current-head-green" && next.exactHeadVerification.status === "green" && next.exactHeadVerification.headSha === next.pullRequest.headSha) {
    next.state = "ready-to-merge";
  }
  next.updatedAt = nowIso(now);
  return next;
}

export function canMergeDevelopmentTask(task, currentHeadSha = task?.pullRequest?.headSha) {
  const head = text(currentHeadSha, 160);
  const auth = task?.mergeAuthorization;
  const green = task?.exactHeadVerification?.status === "green"
    && task.exactHeadVerification.headSha === head
    && task.pullRequest.headSha === head;
  const authorized = auth?.authority === "human"
    && !auth.invalidatedAt
    && auth.validForHeadSha === head
    && auth.prNumber === task.pullRequest.number;
  return {
    allowed: Boolean(green && authorized),
    reason: !green ? "current-head-not-green" : !authorized ? "task-scoped-merge-authorization-required" : "current-head-green-and-authorized",
  };
}

export function recoverDevelopmentTask(task, observation = {}, now = new Date()) {
  const currentHead = text(observation.currentPrHead, 160);
  let recovered = structuredClone(task);
  if (currentHead && recovered.pullRequest.headSha && currentHead !== recovered.pullRequest.headSha) {
    recovered = recordDevelopmentPrHead(recovered, { prNumber: recovered.pullRequest.number, headSha: currentHead }, now);
  }
  const authValid = recovered.authorization?.authority === "human" && !recovered.authorization.revokedAt;
  let nextLegalAction = "inspect";
  if (!authValid) nextLegalAction = "request-human-authorization";
  else if (!observation.branchExists || !observation.worktreeExists) nextLegalAction = "reconcile-worktree";
  else if (!observation.providerReady) nextLegalAction = "restore-provider-readiness";
  else if (recovered.pullRequest.number && recovered.exactHeadVerification.headSha !== recovered.pullRequest.headSha) nextLegalAction = "verify-current-pr-head";
  else if (canMergeDevelopmentTask(recovered).allowed) nextLegalAction = "merge-current-head";
  else if (recovered.state === "repair") nextLegalAction = "repair-against-locked-intent";
  else nextLegalAction = "resume-authorized-task";
  return {
    task: recovered,
    mutationAllowed: authValid && Boolean(observation.branchExists && observation.worktreeExists) && MUTATION_STATES.has(recovered.state),
    nextLegalAction,
  };
}

export function developmentDeliveryRoot(explicitRoot = "") {
  if (explicitRoot) return path.resolve(explicitRoot);
  const base = process.env.LOCALAPPDATA || (process.platform === "win32"
    ? path.join(os.homedir(), "AppData", "Local")
    : path.join(os.homedir(), ".local", "share"));
  return path.join(base, "PlotPickle", "development-delivery");
}

async function atomicJson(file, value) {
  await mkdir(path.dirname(file), { recursive: true });
  const temp = `${file}.tmp-${process.pid}-${Date.now()}`;
  await writeFile(temp, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  await rename(temp, file);
}

export async function saveDevelopmentTask(root, task) {
  const targetRoot = developmentDeliveryRoot(root);
  await atomicJson(path.join(targetRoot, "tasks", `${task.taskId}.json`), task);
  return task;
}

export async function loadDevelopmentTask(root, taskId) {
  const file = path.join(developmentDeliveryRoot(root), "tasks", `${text(taskId, 180)}.json`);
  return JSON.parse(await readFile(file, "utf8"));
}

export async function appendDevelopmentLedgerEvent(root, event = {}, now = new Date()) {
  const targetRoot = developmentDeliveryRoot(root);
  const safe = {
    schemaVersion: 1,
    eventId: `event-${randomUUID()}`,
    taskId: text(event.taskId, 180),
    type: text(event.type, 120),
    state: text(event.state, 80),
    issueNumber: Number.isInteger(event.issueNumber) ? event.issueNumber : null,
    branch: text(event.branch, 512),
    prNumber: Number.isInteger(event.prNumber) ? event.prNumber : null,
    headSha: text(event.headSha, 160),
    logicalProviderId: text(event.logicalProviderId, 120),
    logicalModelId: text(event.logicalModelId, 160),
    providerId: text(event.providerId, 120),
    modelId: text(event.modelId, 200),
    toolIds: boundedRefs(event.toolIds, 64),
    evidenceRefs: boundedRefs(event.evidenceRefs, 64),
    summary: text(event.summary, 1200),
    recordedAt: nowIso(now),
  };
  if (!safe.taskId || !safe.type) throw new Error("Development ledger events require taskId and type.");
  await mkdir(path.join(targetRoot, "ledger"), { recursive: true });
  await appendFile(path.join(targetRoot, "ledger", "events.ndjson"), `${JSON.stringify(safe)}\n`, { encoding: "utf8", mode: 0o600 });
  return safe;
}

export async function readDevelopmentClaims(root) {
  try {
    return JSON.parse(await readFile(path.join(developmentDeliveryRoot(root), "claims.json"), "utf8"));
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

export async function saveDevelopmentClaims(root, claims) {
  await atomicJson(path.join(developmentDeliveryRoot(root), "claims.json"), Array.isArray(claims) ? claims : []);
  return claims;
}
