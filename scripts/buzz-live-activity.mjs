import { randomUUID } from "node:crypto";
import { appendFile, mkdir, readFile, stat, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { verificationAuthRequestHeaders } from "./full-verification-auth.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const config = JSON.parse(await readFile(path.join(repoRoot, "config", "buzz-guildhall.json"), "utf8"));
const LOCAL_BACKBONE_SCHEMA_VERSION = 1;
const LOCAL_BACKBONE_FILE = "events.jsonl";
const MAX_LOCAL_BACKBONE_BYTES = 2 * 1024 * 1024;
const MAX_LOCAL_BACKBONE_EVENTS = 500;
const DEFAULT_PRESENCE_TTL_MS = 5 * 60_000;
const HEALTH_STATES = new Set(["ready", "working", "degraded", "unavailable", "unknown"]);

function defaultLocalBackboneRoot() {
  if (process.env.PLOTPICKLE_BUZZ_LOCAL_ROOT) return path.resolve(process.env.PLOTPICKLE_BUZZ_LOCAL_ROOT);
  if (process.platform === "win32") {
    const localRoot = process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
    return path.join(localRoot, "PlotPickle", "buzz-local-backbone");
  }
  return path.join(repoRoot, ".artifacts", "buzz-local-backbone");
}

function clean(value, limit) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
    .replace(/\b[a-f0-9]{64}\b/gi, "[redacted-secret]")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[redacted-github-token]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|xai-[A-Za-z0-9_-]{16,})\b/g, "[redacted-api-key]")
    .replace(/\bBearer\s+[A-Za-z0-9._~+/=-]{8,}\b/gi, "Bearer [redacted]")
    .replace(/((?:password|passphrase|secret|private[_ -]?key|api[_ -]?key|token|cookie|authorization)\s*[=:]\s*)\S+/gi, "$1[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function evidenceItems(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((entry) => {
    const label = clean(entry?.label || entry?.kind, 120);
    const ref = clean(entry?.ref, 500);
    return label && ref ? [{ label, ref }] : [];
  });
}

export function normalizeLiveBuzzActivity(input) {
  const actor = config.actors.find((candidate) => candidate.id === input?.actorId);
  if (!actor) throw new Error(`Unknown Guildhall actor: ${input?.actorId || "(missing)"}.`);
  const channelId = config.eventRoutes[input?.type];
  if (!channelId) throw new Error(`Unknown Guildhall event type: ${input?.type || "(missing)"}.`);
  const channel = config.channels.find((candidate) => candidate.id === channelId);
  if (!channel) throw new Error(`Guildhall route ${input.type} points to a missing channel.`);
  const summary = clean(input?.summary, 700);
  if (!summary) throw new Error("Guildhall activity requires a short summary.");
  const severity = ["info", "low", "medium", "high", "critical"].includes(input?.severity) ? input.severity : "info";
  const evidence = evidenceItems(input?.evidence);
  if (input?.type === "improvement.candidate" && (input?.verified !== true || evidence.length === 0)) {
    throw new Error("Improvement candidates require verified evidence before they can enter the BUZZ backbone.");
  }
  return {
    actor,
    channel,
    event: {
      type: input.type,
      actorId: actor.id,
      summary,
      severity,
      projectId: clean(input?.projectId, 160),
      target: clean(input?.target, 220),
      verified: input?.verified === true,
      actionable: input?.actionable === true,
      evidence,
      occurredAt: new Date(input?.occurredAt || Date.now()).toISOString(),
    },
  };
}

export function normalizeLocalBuzzActivity(input) {
  const normalized = normalizeLiveBuzzActivity(input);
  const healthStatus = HEALTH_STATES.has(input?.healthStatus) ? input.healthStatus : "";
  const ttlMs = healthStatus
    ? Math.min(60 * 60_000, Math.max(30_000, Number(input?.presenceTtlMs || DEFAULT_PRESENCE_TTL_MS)))
    : 0;
  const occurredAt = normalized.event.occurredAt;
  return {
    schemaVersion: LOCAL_BACKBONE_SCHEMA_VERSION,
    eventId: clean(input?.eventId, 180) || `buzz-local-${randomUUID()}`,
    type: normalized.event.type,
    actorId: normalized.actor.id,
    actorKind: clean(normalized.actor.kind, 120),
    runtime: clean(normalized.actor.runtime, 120),
    route: normalized.channel.name,
    summary: normalized.event.summary,
    severity: normalized.event.severity,
    verified: normalized.event.verified,
    actionable: normalized.event.actionable,
    healthStatus,
    runId: clean(input?.runId, 220),
    executionId: clean(input?.executionId, 220),
    taskId: clean(input?.taskId, 220),
    scope: {
      nodeId: clean(input?.nodeId, 180),
      profileId: clean(input?.profileId, 180),
      projectId: normalized.event.projectId || clean(input?.projectId, 180),
      sessionId: clean(input?.sessionId, 180),
    },
    target: normalized.event.target,
    evidence: normalized.event.evidence,
    occurredAt,
    expiresAt: ttlMs ? new Date(Date.parse(occurredAt) + ttlMs).toISOString() : "",
  };
}

function formatActivity({ actor, channel, event }) {
  const lines = [
    `[${actor.displayName} · ${actor.title}]`,
    event.summary,
    `type=${event.type} severity=${event.severity} verified=${event.verified ? "yes" : "no"} actionable=${event.actionable ? "yes" : "no"}`,
  ];
  if (event.projectId) lines.push(`project=${event.projectId}`);
  if (event.target) lines.push(`target=${event.target}`);
  for (const evidence of event.evidence) lines.push(`evidence: ${evidence.label} — ${evidence.ref}`);
  lines.push(`occurred=${event.occurredAt}`);
  lines.push(`route=${channel.name}`);
  return lines.join("\n");
}

function localBackboneFile(options = {}) {
  return path.join(path.resolve(options.localRoot || defaultLocalBackboneRoot()), LOCAL_BACKBONE_FILE);
}

async function compactLocalBackbone(file) {
  let info;
  try {
    info = await stat(file);
  } catch (error) {
    if (error?.code === "ENOENT") return;
    throw error;
  }
  if (info.size <= MAX_LOCAL_BACKBONE_BYTES) return;
  const raw = await readFile(file, "utf8");
  const lines = raw.split(/\r?\n/).filter(Boolean).slice(-MAX_LOCAL_BACKBONE_EVENTS);
  await writeFile(file, lines.length ? `${lines.join("\n")}\n` : "", "utf8");
}

export async function recordLocalBuzzActivity(input, options = {}) {
  const event = normalizeLocalBuzzActivity(input);
  const file = localBackboneFile(options);
  await mkdir(path.dirname(file), { recursive: true });
  await appendFile(file, `${JSON.stringify(event)}\n`, "utf8");
  await compactLocalBackbone(file);
  return { ok: true, file, event };
}

export async function readLocalBuzzActivity(options = {}) {
  const file = localBackboneFile(options);
  const limit = Math.min(MAX_LOCAL_BACKBONE_EVENTS, Math.max(1, Number(options.limit || 100)));
  try {
    const raw = await readFile(file, "utf8");
    const events = raw
      .split(/\r?\n/)
      .filter(Boolean)
      .map((line) => JSON.parse(line))
      .filter((item) => item?.schemaVersion === LOCAL_BACKBONE_SCHEMA_VERSION);
    return events.slice(-limit);
  } catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
}

function effectiveHealth(event, nowMs) {
  if (!event?.healthStatus || !HEALTH_STATES.has(event.healthStatus)) return null;
  if (event.expiresAt && Date.parse(event.expiresAt) <= nowMs) {
    return { ...event, healthStatus: "unknown", stale: true };
  }
  return { ...event, stale: false };
}

export function deriveLocalBuzzBackboneHealth(events, options = {}) {
  const nowMs = Date.parse(options.now || new Date().toISOString());
  const latestByActor = new Map();
  for (const event of Array.isArray(events) ? events : []) {
    const effective = effectiveHealth(event, nowMs);
    if (!effective) continue;
    const previous = latestByActor.get(effective.actorId);
    if (!previous || Date.parse(effective.occurredAt) >= Date.parse(previous.occurredAt)) latestByActor.set(effective.actorId, effective);
  }
  const actors = [...latestByActor.values()].sort((a, b) => a.actorId.localeCompare(b.actorId));
  const rank = { ready: 0, unknown: 1, working: 2, degraded: 3, unavailable: 4 };
  const overall = actors.length
    ? actors.reduce((worst, actor) => rank[actor.healthStatus] > rank[worst] ? actor.healthStatus : worst, "ready")
    : "unknown";
  const sourceEvents = Array.isArray(events) ? events : [];
  return {
    schemaVersion: LOCAL_BACKBONE_SCHEMA_VERSION,
    overall,
    actorCount: actors.length,
    actors: actors.map((actor) => ({
      actorId: actor.actorId,
      actorKind: actor.actorKind,
      runtime: actor.runtime,
      status: actor.healthStatus,
      stale: actor.stale,
      summary: actor.summary,
      occurredAt: actor.occurredAt,
      runId: actor.runId,
      executionId: actor.executionId,
      taskId: actor.taskId,
      evidence: actor.evidence,
    })),
    recentEvidenceCount: sourceEvents.length,
    verifiedEvidenceCount: sourceEvents.filter((event) => event?.verified === true).length,
    improvementCandidateCount: sourceEvents.filter((event) => event?.type === "improvement.candidate" && event?.verified === true).length,
    checkedAt: new Date(nowMs).toISOString(),
  };
}

export async function getLocalBuzzBackboneHealth(options = {}) {
  const events = await readLocalBuzzActivity({ ...options, limit: options.limit || 250 });
  return deriveLocalBuzzBackboneHealth(events, options);
}

async function request(baseUrl, pathname, init, fetchImpl) {
  const method = String(init?.method || "GET").toUpperCase();
  const response = await fetchImpl(`${String(baseUrl).replace(/\/$/, "")}/api/local-buzz${pathname}`, {
    ...init,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(init?.headers || {}),
      ...verificationAuthRequestHeaders(baseUrl, method),
    },
    signal: AbortSignal.timeout(4_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || `PlotPickle BUZZ gateway returned ${response.status}.`);
  return body;
}

/**
 * Explicit compatibility helper for a real signed Human message round-trip.
 * Operational Agent/test activity must not call this path because /messages uses
 * the connected Human signer. Official Agent speech requires that Agent's signer.
 */
export async function postLiveBuzzActivity(input, options = {}) {
  const normalized = normalizeLiveBuzzActivity(input);
  const baseUrl = options.baseUrl || process.env.PLOTPICKLE_URL || process.env.PLOTPICKLE_ACCEPTANCE_URL || "http://127.0.0.1:4173";
  const fetchImpl = options.fetchImpl || fetch;
  const rooms = await request(baseUrl, "/rooms", undefined, fetchImpl);
  const room = (rooms.rooms || []).find((candidate) => candidate.name === normalized.channel.name);
  if (!room?.id) throw new Error(`Guildhall room '${normalized.channel.name}' is missing.`);
  await request(baseUrl, "/messages", {
    method: "POST",
    body: JSON.stringify({ channel: room.id, content: formatActivity(normalized) }),
  }, fetchImpl);
  return { ok: true, actor: normalized.actor.id, eventType: normalized.event.type, channel: normalized.channel.name };
}

/**
 * Runtime/UAT/repair activity is local evidence. It must never fall back to the
 * connected Human BUZZ signer. A future official-Agent publishing path can mirror
 * selected public speech only after the Agent's own signer is available.
 */
export async function bestEffortLiveBuzzActivity(input, options = {}) {
  try {
    const local = await recordLocalBuzzActivity(input, options);
    return {
      ok: true,
      localRecorded: true,
      buzzMirrored: false,
      reason: "agent-signer-required",
      localFile: local.file || "",
    };
  } catch (error) {
    return {
      ok: false,
      localRecorded: false,
      buzzMirrored: false,
      reason: "local-record-failed",
      message: clean(error instanceof Error ? error.message : String(error), 300),
      localFile: "",
    };
  }
}
