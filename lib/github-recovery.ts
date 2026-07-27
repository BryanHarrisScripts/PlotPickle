export const PLOTPICKLE_GITHUB_RECOVERY_VERSION = 1 as const;
export const GITHUB_RECOVERY_MAX_ATTEMPTS = 8;
export const GITHUB_RECOVERY_MAX_DELAY_MS = 15 * 60 * 1000;

export const GITHUB_RECOVERY_ALLOWED_PATHS = [
  "/api/local-github-sync/publish",
  "/api/local-github-sync/release-snapshot",
  "/api/local-github/submit-proposal",
  "/api/local-github/approve-proposal",
  "/api/local-github/decline-proposal",
  "/api/local-collaboration/policy",
] as const;

export type GitHubRecoveryOperation =
  | "canonical-publish"
  | "release-snapshot"
  | "proposal-submit"
  | "proposal-approve"
  | "proposal-decline"
  | "collaboration-policy";

export type GitHubRecoveryClassification =
  | "offline"
  | "transient"
  | "rate-limited"
  | "authorization-expired"
  | "repository-missing"
  | "branch-missing"
  | "conflict-review"
  | "invalid-request"
  | "unknown";

export type GitHubRecoveryState = "queued" | "retrying" | "paused" | "conflict" | "failed";

export type GitHubRecoveryFailure = {
  status: number;
  message: string;
  retryAfterMs?: number;
};

export type GitHubRecoveryDecision = {
  classification: GitHubRecoveryClassification;
  state: GitHubRecoveryState;
  retryable: boolean;
  message: string;
  userAction: string;
};

export type GitHubRecoveryEntry = {
  id: string;
  version: typeof PLOTPICKLE_GITHUB_RECOVERY_VERSION;
  operation: GitHubRecoveryOperation;
  label: string;
  path: string;
  method: "POST";
  body: Record<string, unknown>;
  idempotencyKey: string;
  state: GitHubRecoveryState;
  classification: GitHubRecoveryClassification;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt: string;
  nextRetryAt: string;
  lastStatus: number;
  lastError: string;
  userAction: string;
};

export type GitHubRecoveryQueue = {
  version: typeof PLOTPICKLE_GITHUB_RECOVERY_VERSION;
  entries: GitHubRecoveryEntry[];
  updatedAt: string;
};

const FORBIDDEN_KEY = /(authorization|access.?token|refresh.?token|client.?secret|private.?key|password|passphrase|credential|cookie)/i;
const SECRET_TEXT = /(bearer\s+[a-z0-9._-]+|gh[pousr]_[a-z0-9_]+|github_pat_[a-z0-9_]+)/gi;
const MAX_DEPTH = 40;
const MAX_LABEL = 160;
const MAX_MESSAGE = 700;

function text(value: unknown, maximum = MAX_MESSAGE) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function iso(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stable(record[key])}`).join(",")}}`;
}

function hash(source: string) {
  let value = 2166136261;
  for (let index = 0; index < source.length; index += 1) {
    value ^= source.charCodeAt(index);
    value = Math.imul(value, 16777619);
  }
  return (value >>> 0).toString(16).padStart(8, "0");
}

function safeValue(value: unknown, depth: number): unknown {
  if (depth > MAX_DEPTH) throw new Error("The recovery request is nested too deeply.");
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error("The recovery request contains an invalid number.");
    return value;
  }
  if (Array.isArray(value)) return value.map((item) => safeValue(item, depth + 1));
  if (!value || typeof value !== "object") throw new Error("The recovery request contains an unsupported value.");
  const result: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (FORBIDDEN_KEY.test(key)) throw new Error(`Recovery requests cannot contain credential field ${key}.`);
    result[key] = safeValue(item, depth + 1);
  }
  return result;
}

export function redactGitHubRecoveryMessage(value: unknown) {
  return text(value || "GitHub operation failed.").replace(SECRET_TEXT, "[redacted]");
}

export function safeGitHubRecoveryBody(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("The recovery request body must be a JSON object.");
  const result = safeValue(value, 0) as Record<string, unknown>;
  const serialized = JSON.stringify(result);
  if (serialized.length > 1_500_000) throw new Error("This GitHub operation is too large for the protected retry queue. Save a local backup and retry it directly after reconnecting.");
  return result;
}

export function recoveryOperationForPath(path: string): GitHubRecoveryOperation {
  if (path === "/api/local-github-sync/publish") return "canonical-publish";
  if (path === "/api/local-github-sync/release-snapshot") return "release-snapshot";
  if (path === "/api/local-github/submit-proposal") return "proposal-submit";
  if (path === "/api/local-github/approve-proposal") return "proposal-approve";
  if (path === "/api/local-github/decline-proposal") return "proposal-decline";
  if (path === "/api/local-collaboration/policy") return "collaboration-policy";
  throw new Error("That operation is not eligible for GitHub recovery.");
}

export function isGitHubRecoveryPath(path: string) {
  return (GITHUB_RECOVERY_ALLOWED_PATHS as readonly string[]).includes(path);
}

export function classifyGitHubRecoveryFailure(input: GitHubRecoveryFailure): GitHubRecoveryDecision {
  const status = Number(input.status) || 0;
  const message = redactGitHubRecoveryMessage(input.message);
  const lowered = message.toLowerCase();
  if (status === 0 || /failed to fetch|network|offline|socket|timed? out|econn|enotfound/.test(lowered)) {
    return { classification: "offline", state: "queued", retryable: true, message, userAction: "Keep writing locally. PlotPickle will retry when the connection returns." };
  }
  if (status === 429 || (status === 403 && /rate limit|secondary rate/.test(lowered))) {
    return { classification: "rate-limited", state: "queued", retryable: true, message, userAction: "Wait for GitHub's limit to reset or choose Retry now later." };
  }
  if (status === 401 || (status === 403 && !/rate limit|secondary rate/.test(lowered))) {
    return { classification: "authorization-expired", state: "paused", retryable: false, message, userAction: "Reconnect GitHub and wait for the green Ready light, then retry." };
  }
  if (status === 404 && /branch|ref|reference|heads\//.test(lowered)) {
    return { classification: "branch-missing", state: "paused", retryable: false, message, userAction: "Choose an existing approved branch or use guarded branch recovery." };
  }
  if (status === 404) {
    return { classification: "repository-missing", state: "paused", retryable: false, message, userAction: "Check whether the repository moved, was renamed or is no longer shared with this account." };
  }
  if (status === 409 || status === 422 || /non-fast-forward|changed after|stale|conflict|already exists/.test(lowered)) {
    return { classification: "conflict-review", state: "conflict", retryable: false, message, userAction: "Refresh the approved version and review the conflict. PlotPickle will not choose a side automatically." };
  }
  if (status >= 500 || status === 408 || status === 425) {
    return { classification: "transient", state: "queued", retryable: true, message, userAction: "PlotPickle will retry with bounded backoff. Local writing remains available." };
  }
  if (status >= 400) {
    return { classification: "invalid-request", state: "failed", retryable: false, message, userAction: "Review the operation details and create a fresh comparison or proposal." };
  }
  return { classification: "unknown", state: "failed", retryable: false, message, userAction: "Review the operation before trying again." };
}

export function githubRecoveryDelayMs(attempts: number, retryAfterMs = 0) {
  const safeAttempts = Math.max(0, Math.min(20, Math.floor(attempts)));
  const exponential = Math.min(GITHUB_RECOVERY_MAX_DELAY_MS, 5_000 * (3 ** safeAttempts));
  return Math.min(GITHUB_RECOVERY_MAX_DELAY_MS, Math.max(exponential, Math.max(0, retryAfterMs)));
}

export function emptyGitHubRecoveryQueue(now = new Date().toISOString()): GitHubRecoveryQueue {
  return { version: PLOTPICKLE_GITHUB_RECOVERY_VERSION, entries: [], updatedAt: iso(now, new Date().toISOString()) };
}

export function normalizeGitHubRecoveryQueue(value: unknown, now = new Date().toISOString()): GitHubRecoveryQueue {
  const fallback = iso(now, new Date().toISOString());
  if (!value || typeof value !== "object" || (value as { version?: unknown }).version !== PLOTPICKLE_GITHUB_RECOVERY_VERSION) return emptyGitHubRecoveryQueue(fallback);
  const source = Array.isArray((value as { entries?: unknown }).entries) ? (value as { entries: unknown[] }).entries : [];
  const entries = source.flatMap((item): GitHubRecoveryEntry[] => {
    if (!item || typeof item !== "object") return [];
    const entry = item as Partial<GitHubRecoveryEntry>;
    try {
      const path = text(entry.path, 220);
      if (!isGitHubRecoveryPath(path)) return [];
      const body = safeGitHubRecoveryBody(entry.body);
      const operation = recoveryOperationForPath(path);
      const createdAt = iso(entry.createdAt, fallback);
      const updatedAt = iso(entry.updatedAt, createdAt);
      const attempts = Math.max(0, Math.floor(Number(entry.attempts) || 0));
      const state: GitHubRecoveryState = ["queued", "retrying", "paused", "conflict", "failed"].includes(String(entry.state)) ? entry.state as GitHubRecoveryState : "queued";
      const decision = classifyGitHubRecoveryFailure({ status: Number(entry.lastStatus) || 0, message: entry.lastError || "Queued for retry." });
      return [{
        id: text(entry.id, 120) || `recovery-${hash(stable({ path, body, createdAt }))}`,
        version: PLOTPICKLE_GITHUB_RECOVERY_VERSION,
        operation,
        label: text(entry.label, MAX_LABEL) || operation,
        path,
        method: "POST",
        body,
        idempotencyKey: text(entry.idempotencyKey, 160) || hash(stable({ path, body })),
        state,
        classification: entry.classification || decision.classification,
        attempts,
        createdAt,
        updatedAt,
        lastAttemptAt: iso(entry.lastAttemptAt, ""),
        nextRetryAt: iso(entry.nextRetryAt, createdAt),
        lastStatus: Number(entry.lastStatus) || 0,
        lastError: redactGitHubRecoveryMessage(entry.lastError || "Queued for retry."),
        userAction: text(entry.userAction, 300) || decision.userAction,
      }];
    } catch {
      return [];
    }
  });
  const deduplicated = [...new Map(entries.sort((left, right) => left.createdAt.localeCompare(right.createdAt)).map((entry) => [entry.idempotencyKey, entry])).values()];
  return { version: PLOTPICKLE_GITHUB_RECOVERY_VERSION, entries: deduplicated, updatedAt: iso((value as { updatedAt?: unknown }).updatedAt, fallback) };
}

export function enqueueGitHubRecoveryOperation(queueValue: unknown, input: {
  path: string;
  body: unknown;
  label?: string;
  idempotencyKey?: string;
  failure?: GitHubRecoveryFailure;
  now?: string;
}) {
  const now = iso(input.now, new Date().toISOString());
  const queue = normalizeGitHubRecoveryQueue(queueValue, now);
  const path = text(input.path, 220);
  if (!isGitHubRecoveryPath(path)) throw new Error("That operation is not eligible for GitHub recovery.");
  const body = safeGitHubRecoveryBody(input.body);
  const operation = recoveryOperationForPath(path);
  const idempotencyKey = text(input.idempotencyKey, 160) || hash(stable({ path, body }));
  const existing = queue.entries.find((entry) => entry.idempotencyKey === idempotencyKey);
  if (existing) return { queue, entry: existing, created: false };
  const failure = input.failure || { status: 0, message: "Queued while GitHub was unavailable." };
  const decision = classifyGitHubRecoveryFailure(failure);
  const retryable = decision.retryable && 0 < GITHUB_RECOVERY_MAX_ATTEMPTS;
  const entry: GitHubRecoveryEntry = {
    id: `recovery-${hash(`${idempotencyKey}:${now}`)}`,
    version: PLOTPICKLE_GITHUB_RECOVERY_VERSION,
    operation,
    label: text(input.label, MAX_LABEL) || operation,
    path,
    method: "POST",
    body,
    idempotencyKey,
    state: decision.state,
    classification: decision.classification,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    lastAttemptAt: "",
    nextRetryAt: retryable ? new Date(Date.parse(now) + githubRecoveryDelayMs(0, failure.retryAfterMs)).toISOString() : "",
    lastStatus: Number(failure.status) || 0,
    lastError: decision.message,
    userAction: decision.userAction,
  };
  return { queue: { ...queue, entries: [...queue.entries, entry], updatedAt: now }, entry, created: true };
}

export function recordGitHubRecoveryFailure(queueValue: unknown, id: string, failure: GitHubRecoveryFailure, nowValue = new Date().toISOString()) {
  const now = iso(nowValue, new Date().toISOString());
  const queue = normalizeGitHubRecoveryQueue(queueValue, now);
  let updated: GitHubRecoveryEntry | null = null;
  const entries = queue.entries.map((entry) => {
    if (entry.id !== id) return entry;
    const attempts = entry.attempts + 1;
    const decision = classifyGitHubRecoveryFailure(failure);
    const exhausted = attempts >= GITHUB_RECOVERY_MAX_ATTEMPTS;
    updated = {
      ...entry,
      state: exhausted && decision.retryable ? "failed" : decision.state,
      classification: decision.classification,
      attempts,
      updatedAt: now,
      lastAttemptAt: now,
      nextRetryAt: decision.retryable && !exhausted ? new Date(Date.parse(now) + githubRecoveryDelayMs(attempts, failure.retryAfterMs)).toISOString() : "",
      lastStatus: Number(failure.status) || 0,
      lastError: decision.message,
      userAction: exhausted && decision.retryable ? "Automatic retries stopped. Review the connection and choose Retry now when ready." : decision.userAction,
    };
    return updated;
  });
  if (!updated) throw new Error("The queued GitHub operation was not found.");
  return { queue: { ...queue, entries, updatedAt: now }, entry: updated };
}

export function removeGitHubRecoveryEntry(queueValue: unknown, id: string, nowValue = new Date().toISOString()) {
  const now = iso(nowValue, new Date().toISOString());
  const queue = normalizeGitHubRecoveryQueue(queueValue, now);
  return { ...queue, entries: queue.entries.filter((entry) => entry.id !== id), updatedAt: now };
}

export function markGitHubRecoveryRetrying(queueValue: unknown, id: string, nowValue = new Date().toISOString()) {
  const now = iso(nowValue, new Date().toISOString());
  const queue = normalizeGitHubRecoveryQueue(queueValue, now);
  let found = false;
  const entries = queue.entries.map((entry) => {
    if (entry.id !== id) return entry;
    found = true;
    return { ...entry, state: "retrying" as const, updatedAt: now, lastAttemptAt: now };
  });
  if (!found) throw new Error("The queued GitHub operation was not found.");
  return { ...queue, entries, updatedAt: now };
}

export function dueGitHubRecoveryEntries(queueValue: unknown, nowValue = new Date().toISOString()) {
  const now = Date.parse(iso(nowValue, new Date().toISOString()));
  return normalizeGitHubRecoveryQueue(queueValue, new Date(now).toISOString()).entries.filter((entry) => entry.state === "queued" && entry.nextRetryAt && Date.parse(entry.nextRetryAt) <= now);
}

export function publicGitHubRecoveryEntry(entry: GitHubRecoveryEntry) {
  const { body: _body, ...publicEntry } = entry;
  return publicEntry;
}
