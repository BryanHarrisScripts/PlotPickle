import guildhallConfig from "../config/buzz-guildhall.json";

const BUZZ_API = "/api/local-buzz";
const GUILDHALL_EVENT_VERSION = 1 as const;
const SEVERITY_RANK = { info: 0, low: 1, medium: 2, high: 3, critical: 4 } as const;

export type BuzzGuildhallSeverity = keyof typeof SEVERITY_RANK;
export type BuzzGuildhallEventType = keyof typeof guildhallConfig.eventRoutes;
export type BuzzGuildhallActorId = (typeof guildhallConfig.actors)[number]["id"];
export type BuzzGuildhallChannelId = (typeof guildhallConfig.channels)[number]["id"];

export type BuzzGuildhallEvidence = {
  label: string;
  ref: string;
};

export type BuzzGuildhallEventInput = {
  type: BuzzGuildhallEventType;
  actorId: BuzzGuildhallActorId;
  summary: string;
  severity?: BuzzGuildhallSeverity;
  projectId?: string;
  target?: string;
  verified?: boolean;
  actionable?: boolean;
  evidence?: BuzzGuildhallEvidence[];
  occurredAt?: string;
};

export type BuzzGuildhallEvent = {
  version: typeof GUILDHALL_EVENT_VERSION;
  type: BuzzGuildhallEventType;
  actorId: BuzzGuildhallActorId;
  summary: string;
  severity: BuzzGuildhallSeverity;
  projectId: string;
  target: string;
  verified: boolean;
  actionable: boolean;
  evidence: BuzzGuildhallEvidence[];
  occurredAt: string;
};

type BuzzChannel = {
  id: string;
  name: string;
  description?: string;
};

type GuildhallFetch = typeof fetch;

export const BUZZ_GUILDHALL = guildhallConfig;
export const BUZZ_GUILDHALL_CHANNELS = guildhallConfig.channels;
export const BUZZ_GUILDHALL_ACTORS = guildhallConfig.actors;

function cleanText(value: unknown, limit: number) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, " ")
    .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
    .replace(/\b(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,})\b/g, "[redacted-github-token]")
    .replace(/\b(?:sk-[A-Za-z0-9_-]{16,}|xai-[A-Za-z0-9_-]{16,})\b/g, "[redacted-api-key]")
    .replace(/(authorization\s*:\s*bearer\s+)\S+/gi, "$1[redacted]")
    .replace(/((?:password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*)\S+/gi, "$1[redacted]")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, limit);
}

function isoDate(value: unknown) {
  const candidate = cleanText(value, 64);
  const parsed = candidate ? new Date(candidate) : new Date();
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function evidenceItems(value: unknown): BuzzGuildhallEvidence[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 8).flatMap((entry) => {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) return [];
    const item = entry as Record<string, unknown>;
    const label = cleanText(item.label, 120);
    const ref = cleanText(item.ref, 500);
    return label && ref ? [{ label, ref }] : [];
  });
}

export function guildhallActor(actorId: string) {
  return BUZZ_GUILDHALL_ACTORS.find((actor) => actor.id === actorId) ?? null;
}

export function guildhallChannel(channelId: string) {
  return BUZZ_GUILDHALL_CHANNELS.find((channel) => channel.id === channelId) ?? null;
}

export function routeBuzzGuildhallEvent(type: BuzzGuildhallEventType) {
  const channelId = BUZZ_GUILDHALL.eventRoutes[type] as BuzzGuildhallChannelId | undefined;
  if (!channelId) throw new Error(`No Buzz Guildhall route is registered for ${type}.`);
  const channel = guildhallChannel(channelId);
  if (!channel) throw new Error(`Buzz Guildhall route ${type} points to missing channel ${channelId}.`);
  return channel;
}

export function normalizeBuzzGuildhallEvent(input: BuzzGuildhallEventInput): BuzzGuildhallEvent {
  if (!guildhallActor(input.actorId)) throw new Error(`Unknown PlotPickle Guildhall actor: ${input.actorId}.`);
  routeBuzzGuildhallEvent(input.type);
  const summary = cleanText(input.summary, 700);
  if (!summary) throw new Error("Buzz Guildhall events require a short operational summary.");
  const severity = input.severity && input.severity in SEVERITY_RANK ? input.severity : "info";
  return {
    version: GUILDHALL_EVENT_VERSION,
    type: input.type,
    actorId: input.actorId,
    summary,
    severity,
    projectId: cleanText(input.projectId, 160),
    target: cleanText(input.target, 220),
    verified: input.verified === true,
    actionable: input.actionable === true,
    evidence: evidenceItems(input.evidence),
    occurredAt: isoDate(input.occurredAt),
  };
}

export function canEscalateBuzzGuildhallEventToGitHub(input: BuzzGuildhallEventInput | BuzzGuildhallEvent) {
  const event = normalizeBuzzGuildhallEvent(input);
  const policy = BUZZ_GUILDHALL.githubEscalation;
  const allowed = policy.allowedTypes.includes(event.type as (typeof policy.allowedTypes)[number]);
  const severeEnough = SEVERITY_RANK[event.severity] >= SEVERITY_RANK[policy.minimumSeverity as BuzzGuildhallSeverity];
  return allowed
    && severeEnough
    && (!policy.requiresVerified || event.verified)
    && (!policy.requiresActionable || event.actionable);
}

export function formatBuzzGuildhallEvent(input: BuzzGuildhallEventInput | BuzzGuildhallEvent) {
  const event = normalizeBuzzGuildhallEvent(input);
  const actor = guildhallActor(event.actorId);
  const channel = routeBuzzGuildhallEvent(event.type);
  const lines = [
    `[${actor?.displayName ?? event.actorId} · ${actor?.title ?? "Guild member"}]`,
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

async function buzzRequest<T>(path: string, init: RequestInit | undefined, fetchImpl: GuildhallFetch) {
  const response = await fetchImpl(`${BUZZ_API}${path}`, {
    ...init,
    headers: { Accept: "application/json", "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await response.json() as T & { message?: string };
  if (!response.ok) throw new Error(body.message || `Buzz returned ${response.status}.`);
  return body;
}

export async function getBuzzGuildhallStatus(fetchImpl: GuildhallFetch = fetch) {
  const body = await buzzRequest<{ rooms: BuzzChannel[] }>("/rooms", undefined, fetchImpl);
  const rooms = Array.isArray(body.rooms) ? body.rooms : [];
  const ready = BUZZ_GUILDHALL_CHANNELS.flatMap((definition) => {
    const channel = rooms.find((candidate) => candidate.name === definition.name);
    return channel ? [{ definition, channel }] : [];
  });
  const missing = BUZZ_GUILDHALL_CHANNELS.filter((definition) => !rooms.some((candidate) => candidate.name === definition.name));
  return {
    configured: ready.length > 0,
    ready: missing.length === 0,
    readyCount: ready.length,
    totalCount: BUZZ_GUILDHALL_CHANNELS.length,
    readyRooms: ready,
    missingRooms: missing,
  };
}

export async function postBuzzGuildhallEvent(input: BuzzGuildhallEventInput, fetchImpl: GuildhallFetch = fetch) {
  const event = normalizeBuzzGuildhallEvent(input);
  const route = routeBuzzGuildhallEvent(event.type);
  const status = await getBuzzGuildhallStatus(fetchImpl);
  const room = status.readyRooms.find((item) => item.definition.id === route.id);
  if (!room) {
    return {
      ok: false as const,
      reason: "guildhall-not-bootstrapped" as const,
      channel: route,
      event,
      message: `Buzz is connected, but ${route.label} has not been created yet. Run the Guildhall bootstrap first.`,
    };
  }
  await buzzRequest("/messages", {
    method: "POST",
    body: JSON.stringify({ channel: room.channel.id, content: formatBuzzGuildhallEvent(event) }),
  }, fetchImpl);
  return {
    ok: true as const,
    channel: route,
    event,
    githubEligible: canEscalateBuzzGuildhallEventToGitHub(event),
  };
}
