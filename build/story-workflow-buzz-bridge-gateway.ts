import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  createStoryBridgeRequest,
  dedupeStoryBridgeContributions,
  encodeStoryBridgeDispatchEnvelope,
  normalizeStoryBridgeContribution,
  storyBridgeResultMatchesRequest,
  STORY_BRIDGE_DISPATCH_MARKER,
  STORY_BRIDGE_RESULT_MARKER,
  type StoryBridgeRequest,
} from "../core/story-workflow/buzz-story-bridge-core.mjs";
import { agentProfileById } from "../lib/agents/agent-profiles";
import {
  prepareStoryBridgeRequest,
  storyBridgeAgentSignerDiagnostics,
} from "../modules/story-workflow/bridge/buzz-story-bridge";
import { currentProfileRequestContext } from "./profile-request-context";
import { ensurePrivateBuzzAgentMembership } from "./story-workflow/buzz-private-room-membership";

const API = "/api/story-workflow/buzz-bridge";
const MAX_BODY = 128 * 1024;
const TERMINAL_RUN_STATES = new Set(["completed", "failed", "cancelled"]);
const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "[::1]"]);
const SAFE_HTTP_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const DIAGNOSTIC_PROJECT_PREFIX = "plotpickle-story-bridge-diagnostics";

type HumanBuzzIdentity = {
  ready?: boolean;
  identityVerified?: boolean;
  humanCommunityAllowed?: boolean;
  kind?: "human" | "agent" | "unknown";
  displayName?: string;
  message?: string;
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
type StoryBridgePreparationInput = Parameters<typeof prepareStoryBridgeRequest>[0];

function requestMatchesLocalBridge(request: IncomingMessage, expectedPath: string) {
  if (!["127.0.0.1", "::1", "::ffff:127.0.0.1"].includes(request.socket.remoteAddress || "")) return false;
  const host = request.headers.host;
  const rawUrl = request.url;
  if (!host || !rawUrl) return false;
  try {
    const hostUrl = new URL(`http://${host}`);
    const requestUrl = new URL(rawUrl, hostUrl);
    const origin = request.headers.origin;
    return LOOPBACK_HOSTS.has(hostUrl.hostname)
      && requestUrl.pathname === expectedPath
      && (!origin || new URL(origin).host === hostUrl.host);
  } catch {
    return false;
  }
}

function writeBridgeResponse(response: ServerResponse, status: number, value: Record<string, unknown>, requestId = "") {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  if (requestId) response.setHeader("X-PlotPickle-Story-Bridge-Request", requestId);
  response.end(JSON.stringify(value));
}

async function readBridgeAction(request: IncomingMessage, byteLimit = MAX_BODY, label = "Story Bridge") {
  const chunks: Buffer[] = [];
  let bytes = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    bytes += value.length;
    if (bytes > byteLimit) throw new Error(`The ${label} request is too large.`);
    chunks.push(value);
  }
  const decoded: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!decoded || typeof decoded !== "object" || Array.isArray(decoded)) throw new Error(`The ${label} request is invalid.`);
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
  if (!LOOPBACK_HOSTS.has(value.hostname)) throw new Error("The local PlotPickle host is unavailable.");
  return value.origin;
}

function requestHeader(request: IncomingMessage, name: string) {
  const value = request.headers[name.toLowerCase()];
  if (Array.isArray(value)) return value[0] || "";
  return typeof value === "string" ? value : "";
}

function forwardedProfileHeaders(request: IncomingMessage, method: string) {
  const headers: Record<string, string> = {};
  const cookie = requestHeader(request, "cookie");
  if (cookie) headers.Cookie = cookie;
  if (!SAFE_HTTP_METHODS.has(method.toUpperCase())) {
    const csrf = requestHeader(request, "x-plotpickle-csrf");
    if (csrf) headers["X-PlotPickle-CSRF"] = csrf;
  }
  return headers;
}

async function localJson<T>(request: IncomingMessage, route: string, init?: RequestInit): Promise<T> {
  const base = localBase(request);
  const method = String(init?.method || "GET").toUpperCase();
  const response = await fetch(`${base}${route}`, {
    ...init,
    method,
    signal: AbortSignal.timeout(45_000),
    headers: {
      Accept: "application/json",
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      Origin: base,
      ...forwardedProfileHeaders(request, method),
      ...(init?.headers || {}),
    },
  });
  const value = await response.json() as LocalResponse<T>;
  if (!response.ok) throw new Error(value.message || `Local PlotPickle service returned ${response.status}.`);
  return value as T;
}

function prepareRequest(body: Record<string, unknown>) {
  return prepareStoryBridgeRequest({
    project: body.project as StoryBridgePreparationInput["project"],
    workItem: body.workItem as StoryBridgePreparationInput["workItem"],
    run: body.run as StoryBridgePreparationInput["run"],
    contextPacket: body.contextPacket as StoryBridgePreparationInput["contextPacket"],
  });
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

function humanIdentityReady(identity: HumanBuzzIdentity) {
  return Boolean(identity.ready
    && identity.identityVerified
    && identity.humanCommunityAllowed
    && identity.kind === "human");
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
  ).then((value) => value.rooms ?? []);
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

function agentMention(bridge: StoryBridgeRequest) {
  const profile = agentProfileById(bridge.agentProfileId);
  if (!profile || profile.buzzBinding.actorId !== bridge.agentActorId) {
    throw new Error("Story Bridge cannot resolve the approved BUZZ Agent mention from the bound Agent Profile.");
  }
  return `@${profile.displayName}`;
}

function agentReplyProtocol(bridge: StoryBridgeRequest) {
  const template = {
    version: 1,
    requestId: bridge.requestId,
    projectId: bridge.projectId,
    workItemId: bridge.workItemId,
    runId: bridge.runId,
    baseRevision: bridge.baseRevision,
    agentProfileId: bridge.agentProfileId,
    agentActorId: bridge.agentActorId,
    result: {
      workItemId: bridge.workItemId,
      kind: "proposal",
      targetRefs: bridge.targetRefs,
      evidenceRefs: bridge.evidenceRefs,
      severity: "medium",
      confidence: 0.5,
      changesCanon: false,
      explanation: "REPLACE_WITH_A_SHORT_EVIDENCE_BASED_EXPLANATION",
      proposal: "REPLACE_WITH_ONE_REVIEWABLE_FOUNDATIONS_PROPOSAL",
      alternatives: [],
      affectedDownstreamRefs: bridge.dependencyRefs,
    },
  };
  return [
    `${agentMention(bridge)}, answer this bounded task only.`,
    `Your reply MUST begin with exactly: ${STORY_BRIDGE_RESULT_MARKER}`,
    "On the next line output exactly one JSON object using the template below. Do not use markdown fences or add text before/after it.",
    "Copy every correlation ID and target/evidence ref exactly. Replace only explanation, proposal and confidence. Do not claim to edit PlotPickle or canon.",
    JSON.stringify(template),
  ].join("\n");
}

async function ensureApprovedAgentInRoom(bridge: StoryBridgeRequest, roomId: string) {
  if (!bridge.expectedAgentPubkey) throw new Error("Story Bridge cannot add an Agent without an approved public signer binding.");
  return ensurePrivateBuzzAgentMembership({
    channelId: roomId,
    agentPubkey: bridge.expectedAgentPubkey,
  });
}

async function storyBridgeDiagnostics(request: IncomingMessage) {
  const profileContext = currentProfileRequestContext();
  const signers = storyBridgeAgentSignerDiagnostics();
  const identity = await localJson<HumanBuzzIdentity>(request, "/api/local-buzz/human-identity");
  const roomProbe = await localJson<{ rooms: BuzzRoom[] }>(
    request,
    `/api/local-buzz/rooms?projectPrefix=${encodeURIComponent(DIAGNOSTIC_PROJECT_PREFIX)}`,
  );
  const transportReady = Array.isArray(roomProbe.rooms);
  const humanReady = humanIdentityReady(identity);
  const profileReady = Boolean(profileContext?.profileId);
  const storyBridgeReady = profileReady && transportReady && humanReady && signers.tamsinReady;
  return {
    ok: true,
    checkedAt: new Date().toISOString(),
    transport: {
      ready: transportReady,
      message: transportReady ? "BUZZ read transport is reachable through the Story Bridge path." : "BUZZ read transport is not reachable through the Story Bridge path.",
    },
    humanIdentity: {
      ready: humanReady,
      displayName: identity.displayName || "",
      message: identity.message || (humanReady ? "Human BUZZ identity verified." : "Human BUZZ identity is not ready."),
    },
    agentSigners: signers,
    storyBridge: {
      ready: storyBridgeReady,
      profileScoped: profileReady,
      message: storyBridgeReady
        ? "Story Bridge profile scope, Human identity, BUZZ read transport and Tamsin signer are ready."
        : "Story Bridge is not ready on the exact active-Human transport path.",
    },
  };
}

async function dispatch(request: IncomingMessage, bridge: StoryBridgeRequest) {
  const startedAt = Date.now();
  if (bridge.state !== "ready") return { ...fallback(bridge, bridge.stateReason), ...observability(bridge, startedAt) };
  await verifyRunAuthorization(request, bridge);
  const identity = await localJson<HumanBuzzIdentity>(request, "/api/local-buzz/human-identity");
  if (!humanIdentityReady(identity)) return { ...fallback(bridge, "The connected Human BUZZ transport identity is not verified."), ...observability(bridge, startedAt) };

  const room = await storyRoom(request, bridge, true);
  if (!room?.id) return { ...fallback(bridge, "The private project Story Room could not be resolved."), ...observability(bridge, startedAt) };
  await ensureApprovedAgentInRoom(bridge, room.id);
  const existing = await recentMessages(request, room.id);
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

  const content = `${encodeStoryBridgeDispatchEnvelope(bridge)}\n\n${agentReplyProtocol(bridge)}`;
  await localJson(request, "/api/local-buzz/messages", {
    method: "POST",
    body: JSON.stringify({ channel: room.id, content, mentionPubkeys: [bridge.expectedAgentPubkey] }),
  });
  return {
    ok: true,
    state: "sent",
    executionPath: "buzz",
    requestId: bridge.requestId,
    room: { id: room.id, name: room.name },
    idempotent: false,
    ...observability(bridge, startedAt),
    message: "The bounded Story Work Item was dispatched to its private BUZZ Story Room, the approved Agent was ensured as a bot member, and its canonical Agent mention was included with the approved signer pubkey as the explicit BUZZ recipient. The connected Human signer authored only the task dispatch; an Agent result is accepted only from the approved Agent signer.",
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
    if (!storyBridgeResultMatchesRequest(message.content, bridge.requestId)) return [];
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
        if (!requestMatchesLocalBridge(request, API)) {
          writeBridgeResponse(response, 403, { ok: false, message: "Story Bridge operations are available only from the local PlotPickle application." });
          return;
        }
        void (async () => {
          try {
            if (request.method !== "POST") {
              writeBridgeResponse(response, 405, { ok: false, message: "Story Bridge uses bounded POST actions only." });
              return;
            }
            const body = await readBridgeAction(request);
            const action = typeof body.action === "string" ? body.action : "";
            if (action === "diagnostics") {
              writeBridgeResponse(response, 200, await storyBridgeDiagnostics(request));
              return;
            }
            if (action === "prepare") {
              const bridge = prepareRequest(body);
              writeBridgeResponse(response, 200, { ok: true, request: bridge }, bridge.requestId);
              return;
            }
            const bridge = normalizeRequest(body.request);
            if (action === "dispatch") {
              writeBridgeResponse(response, 200, await dispatch(request, bridge), bridge.requestId);
              return;
            }
            if (action === "collect") {
              writeBridgeResponse(response, 200, await collect(request, bridge, body.currentRevision), bridge.requestId);
              return;
            }
            writeBridgeResponse(response, 404, { ok: false, message: "Story Bridge action not found." }, bridge.requestId);
          } catch (error) {
            writeBridgeResponse(response, 400, { ok: false, message: safeError(error) });
          }
        })();
      });
    },
  };
}
