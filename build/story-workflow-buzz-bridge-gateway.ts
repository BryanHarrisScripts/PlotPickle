import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  createStoryBridgeRequest,
  decodeStoryBridgeResultEnvelope,
  dedupeStoryBridgeContributions,
  encodeStoryBridgeDispatchEnvelope,
  normalizeStoryBridgeContribution,
  STORY_BRIDGE_DISPATCH_MARKER,
  type StoryBridgeRequest,
} from "../core/story-workflow/buzz-story-bridge-core.mjs";

const API = "/api/story-workflow/buzz-bridge";
const MAX_BODY = 128 * 1024;
const TERMINAL_RUN_STATES = new Set(["completed", "failed", "cancelled"]);

type BuzzStatus = {
  connection?: { configured?: boolean; identityVerified?: boolean; identityConfigured?: boolean };
  cli?: { available?: boolean };
  relay?: { reachable?: boolean };
};
type BuzzRoom = { id: string; name: string; description?: string };
type BuzzMessage = { id: string; content: string; author: string; createdAt: string; raw?: unknown };
type ResponsibilityRunSnapshot = {
  runId: string;
  profileId: string;
  state: string;
  context: { taskId: string; sourceIds: string[]; receiptGeneratedAt: string } | null;
  limits: {
    timeoutMs: number;
    maxContextCharacters: number;
    maxTokens: number;
    maxToolCalls: number;
    maxCloudCostUsd: number;
  };
};
type LocalResponse<T> = T & { ok?: boolean; message?: string };

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalRequest(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  try {
    const hostUrl = new URL(`http://${host}`);
    if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
    const origin = request.headers.origin;
    return !origin || new URL(origin).host === hostUrl.host;
  } catch {
    return false;
  }
}

function sendJson(response: ServerResponse, status: number, value: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(value));
}

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += value.length;
    if (bytes > MAX_BODY) throw new Error("The Story Bridge request is too large.");
    chunks.push(value);
  }
  const decoded: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error("The Story Bridge request is invalid.");
  return decoded as Record<string, unknown>;
}

function safeError(error: unknown) {
  return (error instanceof Error ? error.message : "The Story Bridge operation failed.")
    .replace(/nsec1[a-z0-9]+/gi, "[redacted-nsec]")
    .replace(/\b[a-f0-9]{64}\b/gi, "[redacted-key]")
    .replace(/(password|secret|private[_ -]?key|api[_ -]?key|token)\s*[=:]\s*\S+/gi, "$1=[redacted]")
    .slice(0, 900);
}

function localBase(request: IncomingMessage) {
  const host = request.headers.host || "";
  const value = new URL(`http://${host}`);
  if (!["127.0.0.1", "localhost", "[::1]"].includes(value.hostname)) throw new Error("The local PlotPickle host is unavailable.");
  return value.origin;
}

async function localJson<T>(request: IncomingMessage, route: string, init?: RequestInit): Promise<T> {
  const base = localBase(request);
  const response = await fetch(`${base}${route}`, {
    ...init,
    signal: AbortSignal.timeout(45_000),
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      Origin: base,
      ...(init?.headers || {}),
    },
  });
  const value = await response.json() as LocalResponse<T>;
  if (!response.ok) throw new Error(value.message || `Local PlotPickle service returned ${response.status}.`);
  return value as T;
}

function normalizeRequest(value: unknown): StoryBridgeRequest {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("Story Bridge requires one bounded request envelope.");
  const input = value as StoryBridgeRequest;
  const normalized = createStoryBridgeRequest({
    projectId: input.projectId,
    projectRoomPrefix: input.projectRoomPrefix,
    workItemId: input.workItemId,
    runId: input.runId,
    baseRevision: input.baseRevision,
    targetRefs: input.targetRefs,
    dependencyRefs: input.dependencyRefs,
    evidenceRefs: input.evidenceRefs,
    agentProfileId: input.agentProfileId,
    agentActorId: input.agentActorId,
    expectedAgentPubkey: input.expectedAgentPubkey,
    localEquivalentAllowed: input.localEquivalentAllowed,
    destination: input.destination,
    contextItems: input.contextItems,
    limits: input.limits,
    createdAt: input.createdAt,
  });
  if (input.requestId && input.requestId !== normalized.requestId) throw new Error("Story Bridge request identity does not match its bounded work/run/revision fields.");
  return normalized;
}

function fallback(request: StoryBridgeRequest, reason: string) {
  return request.localEquivalentAllowed ? {
    ok: true,
    state: "degraded-local",
    executionPath: "local",
    requestId: request.requestId,
    message: `${reason} Continue through the existing local Responsibility Run; no paid-cloud fallback is permitted.`,
  } : {
    ok: true,
    state: "blocked",
    executionPath: "blocked",
    requestId: request.requestId,
    message: reason,
  };
}

function statusReady(status: BuzzStatus) {
  return Boolean(status.connection?.configured
    && status.connection?.identityConfigured
    && status.connection?.identityVerified
    && status.cli?.available !== false
    && status.relay?.reachable !== false);
}

function withinRunLimit(value: number, limit: number) {
  return Number.isFinite(value) && Number.isFinite(limit) && value <= limit;
}

async function verifyRunAuthorization(request: IncomingMessage, bridge: StoryBridgeRequest) {
  const response = await localJson<{ run: ResponsibilityRunSnapshot }>(
    request,
    `/api/responsibility-runs?runId=${encodeURIComponent(bridge.runId)}`,
  );
  const run = response.run;
  if (!run || run.runId !== bridge.runId || run.profileId !== bridge.agentProfileId) {
    throw new Error("Story Bridge request does not match the persisted Responsibility Run and approved Agent Profile.");
  }
  if (TERMINAL_RUN_STATES.has(run.state)) throw new Error(`Story Bridge cannot dispatch or collect against terminal Responsibility Run state ${run.state}.`);
  if (!run.context || run.context.taskId !== bridge.workItemId) {
    throw new Error("Story Bridge work item does not match the persisted Responsibility Run context task.");
  }
  const allowedSources = new Set(run.context.sourceIds || []);
  if (!bridge.contextItems.every((item) => allowedSources.has(item.id))) {
    throw new Error("Story Bridge context contains a source that was not authorized by the persisted Responsibility Run receipt.");
  }
  if (!withinRunLimit(bridge.limits.timeoutMs, run.limits.timeoutMs)
    || !withinRunLimit(bridge.limits.maxContextCharacters, run.limits.maxContextCharacters)
    || !withinRunLimit(bridge.limits.maxTokens, run.limits.maxTokens)
    || !withinRunLimit(bridge.limits.maxToolCalls, run.limits.maxToolCalls)
    || !withinRunLimit(bridge.limits.maxCloudCostUsd, run.limits.maxCloudCostUsd)) {
    throw new Error("Story Bridge request attempted to exceed its persisted Responsibility Run budget.");
  }
  return run;
}

function observability(bridge: StoryBridgeRequest, startedAt: number) {
  return {
    agentActorId: bridge.agentActorId,
    privacyClass: bridge.destination.privacyClass,
    federation: bridge.destination.federation,
    contextCount: bridge.contextItems.length,
    contextCharacters: bridge.contextCharacters,
    elapsedMs: Math.max(0, Date.now() - startedAt),
  };
}

async function storyRoom(request: IncomingMessage, bridge: StoryBridgeRequest, create: boolean) {
  const listed = await localJson<{ rooms: BuzzRoom[] }>(
    request,
    `/api/local-buzz/rooms?projectPrefix=${encodeURIComponent(bridge.projectRoomPrefix)}`,
  ).then((value) => value.rooms ?? []).catch(() => []);
  const existing = listed.find((room) => room.name === bridge.destination.roomName);
  if (existing || !create) return existing ?? null;
  const ensured = await localJson<{ rooms: Array<{ roomId: string; channel: BuzzRoom }> }>(request, "/api/local-buzz/rooms/ensure", {
    method: "POST",
    body: JSON.stringify({
      projectPrefix: bridge.projectRoomPrefix,
      rooms: [{
        id: bridge.destination.roomId,
        name: bridge.destination.roomName,
        description: `Private PlotPickle Story Bridge room for ${bridge.projectId}. Structured proposals only; BUZZ has no PPF authority.`,
      }],
    }),
  });
  return ensured.rooms.find((item) => item.roomId === bridge.destination.roomId)?.channel ?? null;
}

async function recentMessages(request: IncomingMessage, channelId: string) {
  return localJson<{ messages: BuzzMessage[] }>(
    request,
    `/api/local-buzz/messages?channel=${encodeURIComponent(channelId)}&limit=100`,
  ).then((value) => value.messages ?? []);
}

function dispatchAlreadyPresent(messages: readonly BuzzMessage[], requestId: string) {
  return messages.some((message) => message.content.startsWith(`${STORY_BRIDGE_DISPATCH_MARKER}\n`)
    && message.content.includes(`\"requestId\":\"${requestId}\"`));
}

async function dispatch(request: IncomingMessage, bridge: StoryBridgeRequest) {
  const startedAt = Date.now();
  if (bridge.state !== "ready") return { ...fallback(bridge, bridge.stateReason), ...observability(bridge, startedAt) };
  await verifyRunAuthorization(request, bridge);
  const status = await localJson<BuzzStatus>(request, "/api/local-buzz/status").catch(() => ({}));
  if (!statusReady(status)) return { ...fallback(bridge, "BUZZ is unavailable or the connected Human transport identity is not verified."), ...observability(bridge, startedAt) };

  const room = await storyRoom(request, bridge, true);
  if (!room?.id) return { ...fallback(bridge, "The private project Story Room could not be resolved."), ...observability(bridge, startedAt) };
  const existing = await recentMessages(request, room.id).catch(() => []);
  if (dispatchAlreadyPresent(existing, bridge.requestId)) {
    return {
      ok: true,
      state: "sent",
      executionPath: "buzz",
      requestId: bridge.requestId,
      room: { id: room.id, name: room.name },
      idempotent: true,
      ...observability(bridge, startedAt),
      message: "This bounded Story Work Item is already present in the private BUZZ Story Room; no duplicate dispatch was sent.",
    };
  }

  await localJson(request, "/api/local-buzz/messages", {
    method: "POST",
    body: JSON.stringify({ channel: room.id, content: encodeStoryBridgeDispatchEnvelope(bridge) }),
  });
  return {
    ok: true,
    state: "sent",
    executionPath: "buzz",
    requestId: bridge.requestId,
    room: { id: room.id, name: room.name },
    idempotent: false,
    ...observability(bridge, startedAt),
    message: "The bounded Story Work Item was dispatched to its private BUZZ Story Room. The connected Human signer authored only the task dispatch; an Agent result is accepted only from the approved Agent signer.",
  };
}

async function collect(request: IncomingMessage, bridge: StoryBridgeRequest, currentRevision: unknown) {
  const startedAt = Date.now();
  if (!bridge.expectedAgentPubkey) return { ...fallback(bridge, bridge.stateReason), ...observability(bridge, startedAt) };
  await verifyRunAuthorization(request, bridge);
  const room = await storyRoom(request, bridge, false);
  if (!room?.id) return { ...fallback(bridge, "The private project Story Room is not available."), ...observability(bridge, startedAt) };
  const messages = await recentMessages(request, room.id);
  const contributions = messages.flatMap((message) => {
    const envelope = decodeStoryBridgeResultEnvelope(message.content);
    if (!envelope || envelope.requestId !== bridge.requestId) return [];
    return [normalizeStoryBridgeContribution({
      request: bridge,
      envelope: message.content,
      rawEvent: message.raw,
      currentRevision: String(currentRevision ?? bridge.baseRevision),
    })];
  });
  const unique = dedupeStoryBridgeContributions(contributions);
  const accepted = unique.filter((item) => item.accepted);
  return {
    ok: true,
    state: accepted.length ? "received" : unique.length ? "review-required" : "pending",
    executionPath: "buzz",
    requestId: bridge.requestId,
    contributions: unique,
    accepted,
    ...observability(bridge, startedAt),
    message: accepted.length
      ? `${accepted.length} signed Agent contribution${accepted.length === 1 ? "" : "s"} matched the bounded Story Work Item.`
      : unique.length
        ? "BUZZ returned Story Bridge envelopes, but none passed the current identity/revision boundary."
        : "No matching signed Agent contribution is available yet.",
  };
}

export function storyWorkflowBuzzBridgeGateway(): Plugin {
  return {
    name: "plotpickle-story-workflow-buzz-bridge-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const raw = request.url;
        if (!raw) { next(); return; }
        let url: URL;
        try { url = new URL(raw, "http://127.0.0.1"); } catch { next(); return; }
        if (url.pathname !== API) { next(); return; }
        if (!isLocalRequest(request)) {
          sendJson(response, 403, { ok: false, message: "Story Bridge operations are available only from the local PlotPickle application." });
          return;
        }
        void (async () => {
          try {
            if (request.method !== "POST") {
              sendJson(response, 405, { ok: false, message: "Story Bridge uses bounded POST actions only." });
              return;
            }
            const body = await readBody(request);
            const action = typeof body.action === "string" ? body.action : "";
            const bridge = normalizeRequest(body.request);
            if (action === "dispatch") {
              sendJson(response, 200, await dispatch(request, bridge));
              return;
            }
            if (action === "collect") {
              sendJson(response, 200, await collect(request, bridge, body.currentRevision));
              return;
            }
            sendJson(response, 404, { ok: false, message: "Story Bridge action not found." });
          } catch (error) {
            sendJson(response, 400, { ok: false, message: safeError(error) });
          }
        })();
      });
    },
  };
}
