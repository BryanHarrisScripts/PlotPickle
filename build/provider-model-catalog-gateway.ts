import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import { readCredentialJson, writeCredentialJson } from "./local-credentials";
import {
  readMediaRoutingStore,
  writeMediaRoutingStore,
  type CloudMediaProvider,
} from "./media-routing-store";
import {
  readSynchronizedAssistantStore,
  writeAssistantStore,
  type TextProvider,
} from "./writing-assistant-store";

const CATALOG_PATH = "/api/ai-model-catalog";
const SELECT_PATH = `${CATALOG_PATH}/select`;
const CLOUD_PROVIDERS = ["openai", "minimax"] as const;
const CAPABILITIES = ["writing", "images", "video"] as const;

type CloudProvider = typeof CLOUD_PROVIDERS[number];
type Capability = typeof CAPABILITIES[number];

type LegacyConnection = {
  version?: unknown;
  provider?: unknown;
  baseUrl?: unknown;
  textModel?: unknown;
  imageModel?: unknown;
  videoModel?: unknown;
  apiKey?: unknown;
  verifiedAt?: unknown;
};

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

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > 32 * 1024) throw new Error("The model selection request is too large.");
    chunks.push(value);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Enter a valid model selection request.");
  return parsed as Record<string, unknown>;
}

function normalizedProvider(value: unknown): CloudProvider | null {
  return CLOUD_PROVIDERS.includes(value as CloudProvider) ? value as CloudProvider : null;
}

function normalizedCapability(value: unknown): Capability | null {
  return CAPABILITIES.includes(value as Capability) ? value as Capability : null;
}

function normalizedBaseUrl(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("The provider model catalog requires an HTTP or HTTPS server address.");
  if (url.username || url.password) throw new Error("Do not put credentials in the provider server address.");
  return url.toString().replace(/\/$/, "");
}

function modelIds(value: unknown) {
  if (!value || typeof value !== "object") return [];
  const body = value as {
    data?: Array<{ id?: unknown; name?: unknown }>;
    models?: Array<{ id?: unknown; name?: unknown; model?: unknown }>;
  };
  const candidates = [
    ...(Array.isArray(body.data) ? body.data : []),
    ...(Array.isArray(body.models) ? body.models : []),
  ];
  return candidates.flatMap((item) => {
    const id = typeof item.id === "string"
      ? item.id
      : typeof item.model === "string"
        ? item.model
        : typeof item.name === "string"
          ? item.name
          : "";
    return id.trim() ? [id.trim()] : [];
  });
}

function uniqueModels(values: readonly string[]) {
  const seen = new Set<string>();
  return values.filter((value) => {
    const normalized = value.trim();
    if (!normalized) return false;
    const key = normalized.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((left, right) => left.localeCompare(right, undefined, { numeric: true, sensitivity: "base" }));
}

function configuredModel(capability: Capability, writingModel: string, imageModel: string, videoModel: string) {
  if (capability === "writing") return writingModel;
  if (capability === "images") return imageModel;
  return videoModel;
}

async function profileSnapshot(provider: CloudProvider, capability?: Capability) {
  const [assistantResult, media] = await Promise.all([
    readSynchronizedAssistantStore(),
    readMediaRoutingStore(),
  ]);
  const writing = assistantResult.store.profiles[provider as TextProvider];
  const mediaProfile = media.profiles[provider as CloudMediaProvider];
  const baseUrl = writing?.baseUrl || mediaProfile?.baseUrl || "";
  const apiKey = writing?.apiKey || mediaProfile?.apiKey || "";
  const writingModel = writing?.textModel || "";
  const imageModel = mediaProfile?.imageModel || "";
  const videoModel = mediaProfile?.videoModel || "";
  return {
    assistantStore: assistantResult.store,
    mediaStore: media,
    writing,
    mediaProfile,
    configured: Boolean((writing || mediaProfile) && baseUrl && apiKey),
    baseUrl,
    apiKey,
    writingModel,
    imageModel,
    videoModel,
    selected: capability ? configuredModel(capability, writingModel, imageModel, videoModel) : "",
  };
}

async function discoverProviderModels(provider: CloudProvider, baseUrl: string, apiKey: string) {
  const endpoint = provider === "minimax"
    ? `${normalizedBaseUrl(baseUrl)}/v1/models`
    : `${normalizedBaseUrl(baseUrl)}/models`;
  const response = await fetch(endpoint, {
    headers: { Accept: "application/json", Authorization: `Bearer ${apiKey}` },
    signal: AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let body: unknown = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  if (!response.ok) {
    const detail = body && typeof body === "object"
      ? String((body as { error?: { message?: unknown }; message?: unknown }).error?.message ?? (body as { message?: unknown }).message ?? "")
      : "";
    throw new Error(`Provider model discovery returned HTTP ${response.status}${detail ? `: ${detail.slice(0, 220)}` : ""}.`);
  }
  return uniqueModels(modelIds(body));
}

async function catalogBody(provider: CloudProvider, capability?: Capability) {
  const profile = await profileSnapshot(provider, capability);
  const configuredModels = uniqueModels([profile.writingModel, profile.imageModel, profile.videoModel]);
  if (!profile.configured) {
    return {
      ok: true,
      provider,
      configured: false,
      capability: capability || "",
      selected: profile.selected,
      models: configuredModels,
      count: configuredModels.length,
      source: "configured",
      discoveryError: "Connect this provider before loading its live model catalog.",
    };
  }
  try {
    const discovered = await discoverProviderModels(provider, profile.baseUrl, profile.apiKey);
    const models = uniqueModels([...discovered, ...configuredModels]);
    return {
      ok: true,
      provider,
      configured: true,
      capability: capability || "",
      selected: profile.selected,
      models,
      count: models.length,
      source: discovered.length ? "provider" : "configured",
      discoveryError: discovered.length ? "" : "The provider returned no model IDs; PlotPickle is showing the models already configured for this provider.",
    };
  } catch (error) {
    return {
      ok: true,
      provider,
      configured: true,
      capability: capability || "",
      selected: profile.selected,
      models: configuredModels,
      count: configuredModels.length,
      source: "configured",
      discoveryError: error instanceof Error ? error.message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]") : "Provider model discovery failed.",
    };
  }
}

async function mirrorLegacySelection(provider: CloudProvider, capability: Capability, model: string) {
  const legacy = await readCredentialJson<LegacyConnection>("ai-connection.json");
  if (!legacy || legacy.provider !== provider) return;
  const next = { ...legacy, verifiedAt: "" };
  if (capability === "writing") next.textModel = model;
  if (capability === "images") next.imageModel = model;
  if (capability === "video") next.videoModel = model;
  await writeCredentialJson("ai-connection.json", next);
}

async function selectModel(provider: CloudProvider, capability: Capability, model: string) {
  if (!model || model.length > 240 || /[\r\n\0]/u.test(model)) throw new Error("Choose a valid provider model ID.");
  const profile = await profileSnapshot(provider, capability);
  if (capability === "writing") {
    const writing = profile.assistantStore.profiles[provider as TextProvider];
    if (!writing) throw new Error(`Connect ${provider === "openai" ? "OpenAI" : "MiniMax"} for writing before choosing a writing model.`);
    profile.assistantStore.profiles[provider as TextProvider] = {
      ...writing,
      textModel: model,
      assistantVerifiedAt: "",
      lastError: "",
      configuredAt: new Date().toISOString(),
    };
    await writeAssistantStore(profile.assistantStore);
  } else {
    const mediaProfile = profile.mediaStore.profiles[provider as CloudMediaProvider];
    if (!mediaProfile) throw new Error(`Connect ${provider === "openai" ? "OpenAI" : "MiniMax"} for media before choosing a ${capability === "images" ? "image" : "video"} model.`);
    profile.mediaStore.profiles[provider as CloudMediaProvider] = capability === "images"
      ? { ...mediaProfile, imageModel: model, imageVerifiedAt: "", lastError: "", configuredAt: new Date().toISOString() }
      : { ...mediaProfile, videoModel: model, videoVerifiedAt: "", lastError: "", configuredAt: new Date().toISOString() };
    await writeMediaRoutingStore(profile.mediaStore);
  }
  await mirrorLegacySelection(provider, capability, model);
  return catalogBody(provider, capability);
}

export function registerProviderModelCatalogGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname !== CATALOG_PATH && pathname !== SELECT_PATH) {
      next();
      return;
    }
    if (!isLocalRequest(request)) {
      sendJson(response, 403, { ok: false, message: "The provider model catalog is available only to this PlotPickle server." });
      return;
    }
    void (async () => {
      try {
        if (pathname === CATALOG_PATH && request.method === "GET") {
          const url = new URL(request.url || CATALOG_PATH, "http://127.0.0.1");
          const provider = normalizedProvider(url.searchParams.get("provider"));
          const capabilityValue = url.searchParams.get("capability");
          const capability = capabilityValue ? normalizedCapability(capabilityValue) : undefined;
          if (!provider) throw new Error("Choose OpenAI or MiniMax before loading a cloud model catalog.");
          if (capabilityValue && !capability) throw new Error("Choose Writing, Images, or Video before loading a model catalog.");
          sendJson(response, 200, await catalogBody(provider, capability));
          return;
        }
        if (pathname === SELECT_PATH && request.method === "POST") {
          const body = await readBody(request);
          const provider = normalizedProvider(body.provider);
          const capability = normalizedCapability(body.capability);
          const model = typeof body.model === "string" ? body.model.trim() : "";
          if (!provider || !capability) throw new Error("Choose a valid provider and capability before selecting a model.");
          sendJson(response, 200, await selectModel(provider, capability, model));
          return;
        }
        sendJson(response, 405, { ok: false, message: "Method not allowed." });
      } catch (error) {
        const message = error instanceof Error ? error.message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]") : "The provider model catalog request failed.";
        sendJson(response, 400, { ok: false, message });
      }
    })();
  });
}
