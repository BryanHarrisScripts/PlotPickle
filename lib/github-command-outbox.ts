import { createHash } from "node:crypto";

export const GITHUB_COMMAND_OUTBOX_VERSION = 1 as const;
export const GITHUB_COMMAND_MAX_ENTRIES = 100;
export const GITHUB_COMMAND_MAX_ATTEMPTS = 8;
export const GITHUB_COMMAND_BASE_DELAY_MS = 2_000;
export const GITHUB_COMMAND_MAX_DELAY_MS = 15 * 60 * 1000;
export const GITHUB_COMMAND_MAX_PAYLOAD_BYTES = 5 * 1024 * 1024;
export const GITHUB_COMMAND_SENDING_LEASE_MS = 2 * 60 * 1000;

export const GITHUB_COMMAND_TYPES = [
  "publish-project",
  "create-release-snapshot",
  "submit-proposal",
  "approve-proposal",
  "decline-proposal",
  "update-collaboration-policy",
] as const;

export type GitHubCommandType = (typeof GITHUB_COMMAND_TYPES)[number];
export type GitHubCommandState =
  | "pending"
  | "sending"
  | "completed"
  | "retryable"
  | "needs-authentication"
  | "needs-review"
  | "cancelled";

export type GitHubCommandFailureClass =
  | "offline"
  | "transient"
  | "rate-limited"
  | "authentication"
  | "review-required"
  | "invalid-request";

export type GitHubCommandFailure = {
  classification: GitHubCommandFailureClass;
  status: number;
  message: string;
  retryAfterMs: number;
  retryable: boolean;
};

export type GitHubCommandDraft = {
  type: GitHubCommandType;
  projectId: string;
  repository: string;
  branch: string;
  baseCommit?: string;
  payload: Record<string, unknown>;
  label?: string;
};

export type GitHubCommandEntry = {
  version: 1;
  id: string;
  idempotencyKey: string;
  type: GitHubCommandType;
  projectId: string;
  repository: string;
  branch: string;
  baseCommit: string;
  payloadHash: string;
  payload: Record<string, unknown>;
  label: string;
  state: GitHubCommandState;
  attempts: number;
  createdAt: string;
  updatedAt: string;
  lastAttemptAt: string;
  nextAttemptAt: string;
  completedAt: string;
  lastStatus: number;
  lastError: string;
  failureClass: GitHubCommandFailureClass | "";
};

export type GitHubCommandOutbox = {
  version: 1;
  entries: GitHubCommandEntry[];
  updatedAt: string;
};

export type PublicGitHubCommandEntry = Omit<GitHubCommandEntry, "payload">;

const FORBIDDEN_KEY_FRAGMENTS = [
  "accesstoken",
  "refreshtoken",
  "authorization",
  "clientsecret",
  "privatekey",
  "password",
  "setcookie",
  "apikey",
  "token",
  "cookie",
  "secret",
] as const;

function cleanText(value: unknown, maximum = 500) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function iso(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const time = Date.parse(value);
  return Number.isFinite(time) ? new Date(time).toISOString() : fallback;
}

function boundedInteger(value: unknown, minimum: number, maximum: number) {
  const number = Number(value);
  if (!Number.isFinite(number)) return minimum;
  return Math.min(maximum, Math.max(minimum, Math.floor(number)));
}

function normalizedCredentialKey(key: string) {
  return key.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isCredentialFieldName(key: string) {
  const normalized = normalizedCredentialKey(key);
  return FORBIDDEN_KEY_FRAGMENTS.some((fragment) => normalized === fragment || normalized.endsWith(fragment));
}

function sanitizeJsonValue(value: unknown, path: string, depth: number): unknown {
  if (depth > 24) throw new Error(`GitHub command payload is too deeply nested at ${path}.`);
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new Error(`GitHub command payload contains a non-finite number at ${path}.`);
    return value;
  }
  if (Array.isArray(value)) return value.map((item, index) => sanitizeJsonValue(item, `${path}[${index}]`, depth + 1));
  if (!value || typeof value !== "object") throw new Error(`GitHub command payload contains an unsupported value at ${path}.`);
  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (isCredentialFieldName(key)) throw new Error(`GitHub command payload contains a forbidden credential field: ${path}.${key}.`);
    output[key] = sanitizeJsonValue(item, `${path}.${key}`, depth + 1);
  }
  return output;
}

export function safeGitHubCommandPayload(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("GitHub command payload must be a JSON object.");
  const payload = sanitizeJsonValue(value, "payload", 0) as Record<string, unknown>;
  const bytes = Buffer.byteLength(JSON.stringify(payload), "utf8");
  if (bytes > GITHUB_COMMAND_MAX_PAYLOAD_BYTES) throw new Error("GitHub command payload is too large for the durable outbox.");
  return payload;
}

export function stableGitHubCommandJson(value: unknown): string {
  if (value === null || typeof value !== "object") {
    const encoded = JSON.stringify(value);
    return encoded === undefined ? "null" : encoded;
  }
  if (Array.isArray(value)) return `[${value.map((item) => stableGitHubCommandJson(item)).join(",")}]`;
  const record = value as Record<string, unknown>;
  return `{${Object.keys(record).sort().map((key) => `${JSON.stringify(key)}:${stableGitHubCommandJson(record[key])}`).join(",")}}`;
}

export function sha256GitHubCommandValue(value: unknown) {
  return createHash("sha256").update(stableGitHubCommandJson(value), "utf8").digest("hex");
}

function validCommandType(value: unknown): value is GitHubCommandType {
  return typeof value === "string" && (GITHUB_COMMAND_TYPES as readonly string[]).includes(value);
}

function safeRepository(value: unknown) {
  const repository = cleanText(value, 240);
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) throw new Error("GitHub command repository must use owner/repository format.");
  return repository;
}

function safeBranch(value: unknown) {
  const branch = cleanText(value, 240);
  if (!branch || branch.startsWith("/") || branch.endsWith("/") || branch.includes("..") || /[~^:?*\\\s]/.test(branch)) {
    throw new Error("GitHub command branch is invalid.");
  }
  return branch;
}

export function normalizeGitHubCommandDraft(value: unknown): GitHubCommandDraft {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("GitHub command is invalid.");
  const item = value as Partial<GitHubCommandDraft>;
  if (!validCommandType(item.type)) throw new Error("GitHub command type is unsupported.");
  const projectId = cleanText(item.projectId, 240);
  if (!projectId) throw new Error("GitHub command project ID is required.");
  return {
    type: item.type,
    projectId,
    repository: safeRepository(item.repository),
    branch: safeBranch(item.branch),
    baseCommit: cleanText(item.baseCommit, 100),
    payload: safeGitHubCommandPayload(item.payload),
    label: cleanText(item.label, 240),
  };
}

export function githubCommandIdempotencyKey(value: unknown) {
  const draft = normalizeGitHubCommandDraft(value);
  const payloadHash = sha256GitHubCommandValue(draft.payload);
  const digest = sha256GitHubCommandValue({
    type: draft.type,
    projectId: draft.projectId,
    repository: draft.repository.toLowerCase(),
    branch: draft.branch,
    baseCommit: draft.baseCommit || "",
    payloadHash,
  });
  return `plotpickle-gh-${digest}`;
}

export function emptyGitHubCommandOutbox(nowValue = new Date().toISOString()): GitHubCommandOutbox {
  const now = iso(nowValue, new Date().toISOString());
  return { version: GITHUB_COMMAND_OUTBOX_VERSION, entries: [], updatedAt: now };
}

function normalizeState(value: unknown): GitHubCommandState {
  return ["pending", "sending", "completed", "retryable", "needs-authentication", "needs-review", "cancelled"].includes(String(value))
    ? value as GitHubCommandState
    : "pending";
}

function normalizeFailureClass(value: unknown): GitHubCommandFailureClass | "" {
  return ["offline", "transient", "rate-limited", "authentication", "review-required", "invalid-request"].includes(String(value))
    ? value as GitHubCommandFailureClass
    : "";
}

function normalizedEntry(value: unknown, now: string): GitHubCommandEntry | null {
  if (!value || typeof value !== "object") return null;
  const item = value as Partial<GitHubCommandEntry>;
  if (!validCommandType(item.type)) return null;
  const payload = (() => {
    try { return safeGitHubCommandPayload(item.payload); } catch { return null; }
  })();
  if (!payload) return null;
  const repository = cleanText(item.repository, 240);
  const branch = cleanText(item.branch, 240);
  const projectId = cleanText(item.projectId, 240);
  if (!repository || !branch || !projectId) return null;
  const idempotencyKey = cleanText(item.idempotencyKey, 100) || githubCommandIdempotencyKey({
    type: item.type,
    projectId,
    repository,
    branch,
    baseCommit: cleanText(item.baseCommit, 100),
    payload,
  });
  const payloadHash = cleanText(item.payloadHash, 64) || sha256GitHubCommandValue(payload);
  const id = cleanText(item.id, 80) || `ghcmd_${idempotencyKey.slice(-24)}`;
  return {
    version: 1,
    id,
    idempotencyKey,
    type: item.type,
    projectId,
    repository,
    branch,
    baseCommit: cleanText(item.baseCommit, 100),
    payloadHash,
    payload,
    label: cleanText(item.label, 240) || item.type.replaceAll("-", " "),
    state: normalizeState(item.state),
    attempts: boundedInteger(item.attempts, 0, GITHUB_COMMAND_MAX_ATTEMPTS),
    createdAt: iso(item.createdAt, now),
    updatedAt: iso(item.updatedAt, now),
    lastAttemptAt: iso(item.lastAttemptAt, ""),
    nextAttemptAt: iso(item.nextAttemptAt, ""),
    completedAt: iso(item.completedAt, ""),
    lastStatus: boundedInteger(item.lastStatus, 0, 599),
    lastError: cleanText(item.lastError, 1000),
    failureClass: normalizeFailureClass(item.failureClass),
  };
}

export function normalizeGitHubCommandOutbox(value: unknown, nowValue = new Date().toISOString()): GitHubCommandOutbox {
  const now = iso(nowValue, new Date().toISOString());
  if (!value || typeof value !== "object") return emptyGitHubCommandOutbox(now);
  const item = value as Partial<GitHubCommandOutbox>;
  const entries = Array.isArray(item.entries)
    ? item.entries.map((entry) => normalizedEntry(entry, now)).filter((entry): entry is GitHubCommandEntry => Boolean(entry))
    : [];
  const unique = new Map<string, GitHubCommandEntry>();
  for (const entry of entries) if (!unique.has(entry.id)) unique.set(entry.id, entry);
  return {
    version: GITHUB_COMMAND_OUTBOX_VERSION,
    entries: [...unique.values()].sort((left, right) => left.createdAt.localeCompare(right.createdAt)).slice(-GITHUB_COMMAND_MAX_ENTRIES),
    updatedAt: iso(item.updatedAt, now),
  };
}

export function createGitHubCommandEntry(value: unknown, nowValue = new Date().toISOString()): GitHubCommandEntry {
  const now = iso(nowValue, new Date().toISOString());
  const draft = normalizeGitHubCommandDraft(value);
  const idempotencyKey = githubCommandIdempotencyKey(draft);
  const payloadHash = sha256GitHubCommandValue(draft.payload);
  return {
    version: 1,
    id: `ghcmd_${idempotencyKey.slice(-24)}`,
    idempotencyKey,
    type: draft.type,
    projectId: draft.projectId,
    repository: draft.repository,
    branch: draft.branch,
    baseCommit: draft.baseCommit || "",
    payloadHash,
    payload: draft.payload,
    label: draft.label || draft.type.replaceAll("-", " "),
    state: "pending",
    attempts: 0,
    createdAt: now,
    updatedAt: now,
    lastAttemptAt: "",
    nextAttemptAt: "",
    completedAt: "",
    lastStatus: 0,
    lastError: "",
    failureClass: "",
  };
}

export function enqueueGitHubCommand(outboxValue: unknown, commandValue: unknown, nowValue = new Date().toISOString()) {
  const now = iso(nowValue, new Date().toISOString());
  const outbox = normalizeGitHubCommandOutbox(outboxValue, now);
  const entry = createGitHubCommandEntry(commandValue, now);
  const existing = outbox.entries.find((item) => item.idempotencyKey === entry.idempotencyKey);
  if (existing) return { outbox, entry: existing, created: false };
  let entries = [...outbox.entries];
  if (entries.length >= GITHUB_COMMAND_MAX_ENTRIES) {
    const removable = entries.findIndex((item) => item.state === "completed" || item.state === "cancelled");
    if (removable < 0) throw new Error("The GitHub command outbox is full. Complete, review or cancel an existing command before adding another.");
    entries.splice(removable, 1);
  }
  entries.push(entry);
  return { outbox: { version: 1 as const, entries, updatedAt: now }, entry, created: true };
}

function replaceEntry(outboxValue: unknown, id: string, update: (entry: GitHubCommandEntry) => GitHubCommandEntry, nowValue: string) {
  const now = iso(nowValue, new Date().toISOString());
  const outbox = normalizeGitHubCommandOutbox(outboxValue, now);
  let found: GitHubCommandEntry | null = null;
  const entries = outbox.entries.map((entry) => {
    if (entry.id !== id) return entry;
    found = update(entry);
    return found;
  });
  if (!found) throw new Error("The GitHub command was not found in the outbox.");
  return { outbox: { version: 1 as const, entries, updatedAt: now }, entry: found };
}

export function markGitHubCommandSending(outboxValue: unknown, id: string, nowValue = new Date().toISOString()) {
  const now = iso(nowValue, new Date().toISOString());
  return replaceEntry(outboxValue, id, (entry) => {
    if (!["pending", "retryable"].includes(entry.state)) throw new Error(`GitHub command ${entry.id} cannot start from ${entry.state}.`);
    return {
      ...entry,
      state: "sending",
      attempts: Math.min(GITHUB_COMMAND_MAX_ATTEMPTS, entry.attempts + 1),
      lastAttemptAt: now,
      nextAttemptAt: "",
      updatedAt: now,
    };
  }, now);
}

export function markGitHubCommandCompleted(outboxValue: unknown, id: string, nowValue = new Date().toISOString()) {
  const now = iso(nowValue, new Date().toISOString());
  return replaceEntry(outboxValue, id, (entry) => ({
    ...entry,
    state: "completed",
    completedAt: now,
    nextAttemptAt: "",
    lastStatus: 0,
    lastError: "",
    failureClass: "",
    updatedAt: now,
  }), now);
}

export function retryGitHubCommand(
  outboxValue: unknown,
  id: string,
  nowValue = new Date().toISOString(),
  options: { authenticationReady?: boolean } = {},
) {
  const now = iso(nowValue, new Date().toISOString());
  return replaceEntry(outboxValue, id, (entry) => {
    const authenticationRecovered = entry.state === "needs-authentication" && options.authenticationReady === true;
    if (entry.state !== "retryable" && !authenticationRecovered) {
      throw new Error(`GitHub command ${entry.id} cannot be prepared for retry from ${entry.state}.`);
    }
    return {
      ...entry,
      state: "pending",
      nextAttemptAt: "",
      updatedAt: now,
    };
  }, now);
}

export function cancelGitHubCommand(outboxValue: unknown, id: string, nowValue = new Date().toISOString()) {
  const now = iso(nowValue, new Date().toISOString());
  return replaceEntry(outboxValue, id, (entry) => {
    if (!["pending", "retryable", "needs-authentication", "needs-review"].includes(entry.state)) {
      throw new Error(`GitHub command ${entry.id} cannot be cancelled from ${entry.state}.`);
    }
    return {
      ...entry,
      state: "cancelled",
      nextAttemptAt: "",
      updatedAt: now,
    };
  }, now);
}

export function githubCommandRetryDelayMs(attempts: number, retryAfterMs = 0) {
  const exponential = GITHUB_COMMAND_BASE_DELAY_MS * (2 ** Math.max(0, boundedInteger(attempts, 0, GITHUB_COMMAND_MAX_ATTEMPTS) - 1));
  return Math.min(GITHUB_COMMAND_MAX_DELAY_MS, Math.max(exponential, boundedInteger(retryAfterMs, 0, GITHUB_COMMAND_MAX_DELAY_MS)));
}

export function classifyGitHubCommandFailure(value: unknown): GitHubCommandFailure {
  const item = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const status = boundedInteger(item.status, 0, 599);
  const message = cleanText(item.message, 1000) || "GitHub command failed.";
  const retryAfterMs = boundedInteger(item.retryAfterMs, 0, GITHUB_COMMAND_MAX_DELAY_MS);
  const lower = message.toLowerCase();
  if (status === 0 || /failed to fetch|network|offline|enotfound|econnrefused|timed? out|abort/.test(lower)) {
    return { classification: "offline", status, message, retryAfterMs, retryable: true };
  }
  if (status === 401 || /bad credentials|requires authentication|authentication failed|token expired/.test(lower)) {
    return { classification: "authentication", status, message, retryAfterMs, retryable: false };
  }
  if ((status === 403 || status === 429) && (/rate limit|secondary rate|abuse detection|too many requests/.test(lower) || retryAfterMs > 0 || status === 429)) {
    return { classification: "rate-limited", status, message, retryAfterMs, retryable: true };
  }
  if (status === 409 || status === 422 || /non-fast-forward|conflict|changed after|repository not found|branch not found|reference.*not found/.test(lower)) {
    return { classification: "review-required", status, message, retryAfterMs, retryable: false };
  }
  if (status === 408 || status === 429 || status >= 500) {
    return { classification: "transient", status, message, retryAfterMs, retryable: true };
  }
  return { classification: "invalid-request", status, message, retryAfterMs, retryable: false };
}

export function recordGitHubCommandFailure(outboxValue: unknown, id: string, failureValue: unknown, nowValue = new Date().toISOString()) {
  const now = iso(nowValue, new Date().toISOString());
  const failure = classifyGitHubCommandFailure(failureValue);
  return replaceEntry(outboxValue, id, (entry) => {
    const exhausted = entry.attempts >= GITHUB_COMMAND_MAX_ATTEMPTS;
    const state: GitHubCommandState = failure.classification === "authentication"
      ? "needs-authentication"
      : failure.retryable && !exhausted
        ? "retryable"
        : "needs-review";
    const nextAttemptAt = state === "retryable"
      ? new Date(Date.parse(now) + githubCommandRetryDelayMs(entry.attempts, failure.retryAfterMs)).toISOString()
      : "";
    return {
      ...entry,
      state,
      nextAttemptAt,
      lastStatus: failure.status,
      lastError: failure.message,
      failureClass: failure.classification,
      updatedAt: now,
    };
  }, now);
}

export function recoverInterruptedGitHubCommands(
  outboxValue: unknown,
  nowValue = new Date().toISOString(),
  leaseMs = GITHUB_COMMAND_SENDING_LEASE_MS,
) {
  const nowText = iso(nowValue, new Date().toISOString());
  const now = Date.parse(nowText);
  const outbox = normalizeGitHubCommandOutbox(outboxValue, nowText);
  let changed = false;
  const entries = outbox.entries.map((entry) => {
    if (entry.state !== "sending" || !entry.lastAttemptAt) return entry;
    const elapsed = now - Date.parse(entry.lastAttemptAt);
    if (!Number.isFinite(elapsed) || elapsed < Math.max(1_000, leaseMs)) return entry;
    changed = true;
    return {
      ...entry,
      state: "retryable" as const,
      nextAttemptAt: nowText,
      lastError: "PlotPickle stopped before GitHub confirmed this command. The durable command is ready to retry.",
      failureClass: "transient" as const,
      updatedAt: nowText,
    };
  });
  return { outbox: { version: 1 as const, entries, updatedAt: changed ? nowText : outbox.updatedAt }, changed };
}

export function dueGitHubCommands(outboxValue: unknown, nowValue = new Date().toISOString()) {
  const now = Date.parse(iso(nowValue, new Date().toISOString()));
  return normalizeGitHubCommandOutbox(outboxValue, new Date(now).toISOString()).entries.filter((entry) =>
    entry.state === "retryable" && entry.nextAttemptAt && Date.parse(entry.nextAttemptAt) <= now);
}

export function publicGitHubCommandEntry(entry: GitHubCommandEntry): PublicGitHubCommandEntry {
  const publicEntry = { ...entry } as Partial<GitHubCommandEntry>;
  delete publicEntry.payload;
  return publicEntry as PublicGitHubCommandEntry;
}
