import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { readNativeH3Store } from "./ai/h3/comfyui-h3-native-provider";
import { readCredentialJson, writeCredentialJson } from "./local-credentials";
import { readMediaRoutingStore } from "./media-routing-store";
import {
  isStoryModeImageJobClass,
  isStoryModeJobPreference,
  readStoryModeJobRouting,
  writeStoryModeJobRoutingPreference,
} from "./story-mode-job-routing";
import { readSynchronizedAssistantStore } from "./writing-assistant-store";

export type StoryModePolicy = "local" | "cloud" | "hybrid";
export type StoryModeRouteLocality = "local" | "cloud" | "neutral" | "unknown";

type StoryModePolicyStore = {
  version: 1;
  mode: StoryModePolicy;
  updatedAt: string;
};

type RoutingChoiceSnapshot = {
  text?: unknown;
  image?: unknown;
  video?: unknown;
};

const POLICY_PATH = "/api/story-mode/policy";
const JOB_ROUTING_PATH = "/api/story-mode/job-routing";
const POLICY_FILE = "story-mode-policy.json";
const ROUTING_FILE = "ai-routing.json";
const GENERATION_CAPABILITIES = new Map<string, "text" | "image" | "video">([
  ["/api/local-ai/generate/text", "text"],
  ["/api/writing-assistant/chat", "text"],
  ["/api/local-ai/generate/image", "image"],
  ["/api/local-ai/generate/video", "video"],
]);

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

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage, maximum = 8 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > maximum) throw new Error("The Story Mode policy request is too large.");
    chunks.push(value);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Enter a valid Story Mode policy request.");
  return parsed as Record<string, unknown>;
}

function normalizeMode(value: unknown): StoryModePolicy | null {
  return value === "local" || value === "cloud" || value === "hybrid" ? value : null;
}

export async function readStoryModePolicy(): Promise<StoryModePolicyStore> {
  const stored = await readCredentialJson<unknown>(POLICY_FILE);
  if (stored && typeof stored === "object" && !Array.isArray(stored)) {
    const source = stored as Partial<StoryModePolicyStore>;
    const mode = normalizeMode(source.mode);
    if (mode) {
      return {
        version: 1,
        mode,
        updatedAt: typeof source.updatedAt === "string" ? source.updatedAt : "",
      };
    }
  }
  return { version: 1, mode: "hybrid", updatedAt: "" };
}

async function writePolicy(mode: StoryModePolicy) {
  const next: StoryModePolicyStore = {
    version: 1,
    mode,
    updatedAt: new Date().toISOString(),
  };
  await writeCredentialJson(POLICY_FILE, next);
  return next;
}

export function storyModeRouteLocality(capability: "text" | "image" | "video", route: unknown): StoryModeRouteLocality {
  const value = typeof route === "string" ? route : "";
  if (capability === "text") {
    if (value === "local" || value === "ollama") return "local";
    if (value === "openai" || value === "minimax" || value === "gemini") return "cloud";
    if (value === "off" || value === "disabled") return "neutral";
    return "unknown";
  }
  if (capability === "image") {
    if (value === "comfyui" || value === "ollama-comfyui") return "local";
    if (value === "openai" || value === "minimax") return "cloud";
    if (value === "manual") return "neutral";
    return "unknown";
  }
  if (value === "comfyui-native") return "local";
  if (value === "openai" || value === "minimax") return "cloud";
  if (value === "off" || value === "none") return "neutral";
  return "unknown";
}

export function storyModeAllowsLocality(mode: StoryModePolicy, locality: StoryModeRouteLocality) {
  if (locality === "neutral") return true;
  if (locality === "unknown") return false;
  if (mode === "hybrid") return true;
  return mode === locality;
}

async function selectedRoute(capability: "text" | "image" | "video") {
  const [routing, assistantResult, media, native] = await Promise.all([
    readCredentialJson<RoutingChoiceSnapshot>(ROUTING_FILE),
    readSynchronizedAssistantStore(),
    readMediaRoutingStore(),
    readNativeH3Store(),
  ]);
  if (capability === "text") return assistantResult.store.activeProvider;
  if (routing && typeof routing === "object" && !Array.isArray(routing)) {
    const route = routing[capability];
    if (typeof route === "string") return route;
  }
  if (capability === "image") return media.imageRoute;
  if (native.active) return "comfyui-native";
  return media.videoRoute === "none" ? "off" : "minimax";
}

async function enforceGenerationPolicy(pathname: string, response: ServerResponse, next: () => void) {
  const capability = GENERATION_CAPABILITIES.get(pathname);
  if (!capability) { next(); return; }
  const policy = await readStoryModePolicy();
  if (policy.mode === "hybrid") { next(); return; }
  const route = await selectedRoute(capability);
  const locality = storyModeRouteLocality(capability, route);
  if (storyModeAllowsLocality(policy.mode, locality)) { next(); return; }
  const routeLabel = typeof route === "string" && route ? route : "unclassified";
  sendJson(response, 409, {
    ok: false,
    message: locality === "unknown"
      ? `Story Mode ${policy.mode.toUpperCase()} cannot classify the selected ${capability} route (${routeLabel}). Choose a reviewed route before running this job.`
      : `Story Mode is ${policy.mode.toUpperCase()}, but the selected ${capability} route (${routeLabel}) is ${locality.toUpperCase()}. Choose a ${policy.mode} route or switch Story Mode policy.`,
    storyMode: policy.mode,
    capability,
    selectedRoute: routeLabel,
    selectedLocality: locality,
  });
}

async function handlePolicy(request: IncomingMessage, response: ServerResponse) {
  if (request.method === "GET") {
    const policy = await readStoryModePolicy();
    sendJson(response, 200, { ok: true, ...policy });
    return;
  }
  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, message: "Method not allowed." });
    return;
  }
  const body = await readBody(request);
  const mode = normalizeMode(body.mode);
  if (!mode) throw new Error("Choose Local, Cloud or Hybrid Story Mode.");
  const policy = await writePolicy(mode);
  sendJson(response, 200, { ok: true, ...policy });
}

async function handleJobRouting(request: IncomingMessage, response: ServerResponse) {
  if (request.method === "GET") {
    sendJson(response, 200, { ok: true, ...(await readStoryModeJobRouting()) });
    return;
  }
  if (request.method !== "POST") {
    sendJson(response, 405, { ok: false, message: "Method not allowed." });
    return;
  }
  const body = await readBody(request);
  if (!isStoryModeImageJobClass(body.jobClass)) {
    throw new Error("Choose Images — Fast / Draft or Images — Precision / Edit.");
  }
  if (!isStoryModeJobPreference(body.preference)) {
    throw new Error("Choose AUTO, LOCAL FIRST or CLOUD FIRST Job Routing.");
  }
  sendJson(response, 200, {
    ok: true,
    ...(await writeStoryModeJobRoutingPreference(body.jobClass, body.preference)),
  });
}

export function registerStoryModePolicyGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== POLICY_PATH && pathname !== JOB_ROUTING_PATH && !GENERATION_CAPABILITIES.has(pathname)) { next(); return; }
    if (!isLocalRequest(request)) {
      sendJson(response, 403, { ok: false, message: "Story Mode policy accepts requests only from this PlotPickle server." });
      return;
    }
    if (pathname === POLICY_PATH) {
      void handlePolicy(request, response).catch((error) => sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : "Story Mode policy update failed.",
      }));
      return;
    }
    if (pathname === JOB_ROUTING_PATH) {
      void handleJobRouting(request, response).catch((error) => sendJson(response, 400, {
        ok: false,
        message: error instanceof Error ? error.message : "Story Mode Job Routing update failed.",
      }));
      return;
    }
    if (request.method !== "POST") { next(); return; }
    void enforceGenerationPolicy(pathname, response, next).catch((error) => sendJson(response, 500, {
      ok: false,
      message: error instanceof Error ? error.message : "Story Mode policy check failed.",
    }));
  });
}
