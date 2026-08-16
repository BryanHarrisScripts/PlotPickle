import { readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, "..");
const config = JSON.parse(await readFile(path.join(repoRoot, "config", "buzz-guildhall.json"), "utf8"));

function clean(value, limit) {
  return String(value ?? "")
    .replace(/[\u0000-\u001F\u007F]/g, " ")
    .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[redacted-github-token]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|xai-[A-Za-z0-9_-]{16,})\b/g, "[redacted-api-key]")
    .replace(/((?:password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*)\S+/gi, "$1[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function evidenceItems(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((entry) => {
    const label = clean(entry?.label, 120);
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
      evidence: evidenceItems(input?.evidence),
      occurredAt: new Date(input?.occurredAt || Date.now()).toISOString(),
    },
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

async function request(baseUrl, pathname, init, fetchImpl) {
  const response = await fetchImpl(`${String(baseUrl).replace(/\/$/, "")}/api/local-buzz${pathname}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers || {}) },
    signal: AbortSignal.timeout(4_000),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body?.message || `PlotPickle BUZZ gateway returned ${response.status}.`);
  return body;
}

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

export async function bestEffortLiveBuzzActivity(input, options = {}) {
  try {
    return await postLiveBuzzActivity(input, options);
  } catch (error) {
    return {
      ok: false,
      reason: "buzz-unavailable",
      message: clean(error instanceof Error ? error.message : String(error), 300),
    };
  }
}
