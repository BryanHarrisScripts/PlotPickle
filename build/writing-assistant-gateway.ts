import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import {
  ASSISTANT_INSTRUCTIONS,
  curriculumGuideLocalProfile,
  DEFAULT_OLLAMA_URL,
  generateAssistantText,
  normalizedProviderUrl,
  probeOllama,
  testAssistantProfile,
  type ConversationMessage,
} from "./writing-assistant-provider";
import {
  isTextProvider,
  publicProfile,
  readSynchronizedAssistantStore,
  writeAssistantStore,
  type ProviderProfile,
  type TextProvider,
} from "./writing-assistant-store";
import {
  localRuntimeSnapshot,
  localTextExecutionProfile,
} from "./local-runtime-manager";
import type { LocalTextRole } from "../lib/ai/local-runtime";
import {
  PLOTPICKLE_AGENT_ROLES,
  askPlotPickleAgent,
  mastraRuntimeStatus,
  type PlotPickleAgentId,
  type PlotPickleTone,
} from "./mastra-agent-runtime";

const API_ROOT = "/api/writing-assistant";
const STATUS_PATH = `${API_ROOT}/status`;
const ACTIVE_PATH = `${API_ROOT}/active`;
const TEST_PATH = `${API_ROOT}/test`;
const CHAT_PATH = `${API_ROOT}/chat`;
const OLLAMA_PATH = `${API_ROOT}/ollama`;
const OLLAMA_CONNECTION_PATH = `${OLLAMA_PATH}/connection`;
const TEXT_PATH = "/api/local-ai/generate/text";

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalRequest(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  let hostUrl: URL;
  try { hostUrl = new URL(`http://${host}`); } catch { return false; }
  if (!["127.0.0.1", "localhost", "[::1]"].includes(hostUrl.hostname)) return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  try { return new URL(origin).host === hostUrl.host; } catch { return false; }
}

function sendJson(response: ServerResponse, status: number, body: Record<string, unknown>) {
  response.statusCode = status;
  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(JSON.stringify(body));
}

async function readBody(request: IncomingMessage, maximum = 64 * 1024): Promise<Record<string, unknown>> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > maximum) throw new Error("The Writing Assistant request is too large.");
    chunks.push(value);
  }
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  return parsed && typeof parsed === "object" ? parsed as Record<string, unknown> : {};
}

function localProfileFromExecution(
  execution: Awaited<ReturnType<typeof localTextExecutionProfile>>,
  existing?: ProviderProfile,
): ProviderProfile {
  return {
    provider: "local",
    runtime: execution.runtime,
    baseUrl: execution.baseUrl,
    textModel: execution.textModel,
    apiKey: "",
    contextTokens: execution.contextTokens,
    configuredAt: existing?.configuredAt || new Date().toISOString(),
    assistantVerifiedAt: existing?.assistantVerifiedAt || "",
    lastAttemptAt: existing?.lastAttemptAt || "",
    lastLatencyMs: existing?.lastLatencyMs || 0,
    lastPreview: existing?.lastPreview || "",
    lastError: existing?.lastError || "",
  };
}

async function synchronizeLocalFastProfile(store: Awaited<ReturnType<typeof readSynchronizedAssistantStore>>["store"]) {
  const snapshot = await localRuntimeSnapshot();
  if (!snapshot.activeRuntime.reachable || !snapshot.roles.fast.available) return snapshot;
  const execution = await localTextExecutionProfile("fast");
  store.profiles.local = localProfileFromExecution(execution, store.profiles.local);
  if (store.activeProvider === "disabled" && !store.explicitlyDisabled) store.activeProvider = "local";
  await writeAssistantStore(store);
  return snapshot;
}

async function handleStatus(response: ServerResponse) {
  const { store } = await readSynchronizedAssistantStore();
  const [localRuntime, ollama] = await Promise.all([
    synchronizeLocalFastProfile(store).catch(() => localRuntimeSnapshot()),
    probeOllama(store.ollamaBaseUrl || store.profiles.ollama?.baseUrl || DEFAULT_OLLAMA_URL),
  ]);
  sendJson(response, 200, {
    ok: true,
    activeProvider: store.activeProvider,
    explicitlyDisabled: store.explicitlyDisabled,
    providers: {
      local: publicProfile(store.profiles.local, store.activeProvider),
      ollama: publicProfile(store.profiles.ollama, store.activeProvider),
      openai: publicProfile(store.profiles.openai, store.activeProvider),
      minimax: publicProfile(store.profiles.minimax, store.activeProvider),
    },
    localRuntime: {
      ready: localRuntime.activeRuntime.reachable && localRuntime.roles.fast.available,
      runtime: localRuntime.activeRuntime.kind,
      baseUrl: localRuntime.activeRuntime.baseUrl,
      hardwareProfile: localRuntime.hardware.profile.id,
      contextTokens: localRuntime.settings.contextTokens,
      models: localRuntime.roles,
      error: localRuntime.activeRuntime.reachable ? "" : localRuntime.activeRuntime.error,
    },
    ollama: {
      detected: ollama.reachable,
      reachable: ollama.reachable,
      models: ollama.models,
      baseUrl: ollama.baseUrl,
      version: ollama.version,
      latencyMs: ollama.latencyMs,
      checkedAt: ollama.checkedAt,
      error: ollama.error,
      legacyOptionalRuntime: true,
    },
    mastra: mastraRuntimeStatus(),
  });
}

async function handleActive(request: IncomingMessage, response: ServerResponse) {
  const body = await readBody(request);
  const requested = body.provider;
  if (requested !== "disabled" && !isTextProvider(requested)) throw new Error("Choose Local Runtime, Ollama, OpenAI, MiniMax or Off.");
  const { store } = await readSynchronizedAssistantStore();
  if (requested === "local") {
    const execution = await localTextExecutionProfile("fast");
    store.profiles.local = localProfileFromExecution(execution, store.profiles.local);
  } else if (requested !== "disabled" && !store.profiles[requested]) {
    throw new Error("Configure this provider before selecting it.");
  }
  store.activeProvider = requested;
  store.explicitlyDisabled = requested === "disabled";
  await writeAssistantStore(store);
  sendJson(response, 200, { ok: true, activeProvider: store.activeProvider });
}

async function refreshLocalProfile(store: Awaited<ReturnType<typeof readSynchronizedAssistantStore>>["store"], role: LocalTextRole) {
  const execution = await localTextExecutionProfile(role);
  const profile = localProfileFromExecution(execution, store.profiles.local);
  store.profiles.local = profile;
  return profile;
}

async function handleTest(request: IncomingMessage, response: ServerResponse) {
  const body = await readBody(request);
  const { store } = await readSynchronizedAssistantStore();
  const provider = isTextProvider(body.provider) ? body.provider : store.activeProvider;
  if (!isTextProvider(provider)) throw new Error("Choose a configured text provider before running the test.");
  if (provider === "local") await refreshLocalProfile(store, "fast");
  const result = await testAssistantProfile(store, provider);
  sendJson(response, 200, {
    ok: true,
    provider,
    runtimeProvider: result.profile.runtime || result.profile.provider,
    model: result.profile.textModel,
    text: result.text,
    latencyMs: result.profile.lastLatencyMs,
    verifiedAt: result.profile.assistantVerifiedAt,
  });
}

async function handleOllamaConnection(request: IncomingMessage, response: ServerResponse) {
  const body = await readBody(request);
  const baseUrl = typeof body.baseUrl === "string" && body.baseUrl.trim()
    ? normalizedProviderUrl(body.baseUrl)
    : DEFAULT_OLLAMA_URL;
  const probe = await probeOllama(baseUrl);
  const { store } = await readSynchronizedAssistantStore();
  store.ollamaBaseUrl = probe.baseUrl;
  if (store.profiles.ollama && store.profiles.ollama.baseUrl !== probe.baseUrl) {
    store.profiles.ollama = {
      ...store.profiles.ollama,
      baseUrl: probe.baseUrl,
      assistantVerifiedAt: "",
      lastAttemptAt: probe.checkedAt,
      lastLatencyMs: probe.latencyMs,
      lastPreview: "",
      lastError: probe.error,
    };
  }
  await writeAssistantStore(store);
  sendJson(response, probe.reachable ? 200 : 400, { ok: probe.reachable, ...probe });
}

async function handleOllama(request: IncomingMessage, response: ServerResponse) {
  const body = await readBody(request);
  const model = typeof body.model === "string" ? body.model.trim() : "";
  if (!model) throw new Error("Choose an installed Ollama model.");
  const baseUrl = typeof body.baseUrl === "string" && body.baseUrl.trim()
    ? normalizedProviderUrl(body.baseUrl)
    : DEFAULT_OLLAMA_URL;
  const probe = await probeOllama(baseUrl);
  if (!probe.reachable) throw new Error(probe.error || "Ollama is not reachable.");
  if (!probe.models.includes(model)) throw new Error("That Ollama model is not currently available from the local service. Refresh installed models and choose again.");
  const { store } = await readSynchronizedAssistantStore();
  const profile: ProviderProfile = {
    provider: "ollama",
    runtime: "ollama",
    baseUrl: probe.baseUrl,
    textModel: model,
    apiKey: "",
    contextTokens: 16384,
    configuredAt: new Date().toISOString(),
    assistantVerifiedAt: "",
    lastAttemptAt: probe.checkedAt,
    lastLatencyMs: probe.latencyMs,
    lastPreview: "",
    lastError: "",
  };
  store.ollamaBaseUrl = probe.baseUrl;
  store.profiles.ollama = profile;
  store.activeProvider = "ollama";
  store.explicitlyDisabled = false;
  await writeAssistantStore(store);
  const result = await testAssistantProfile(store, "ollama");
  sendJson(response, 200, {
    ok: true,
    provider: "ollama",
    model,
    text: result.text,
    latencyMs: result.profile.lastLatencyMs,
    verifiedAt: result.profile.assistantVerifiedAt,
  });
}

function safeHistory(value: unknown): ConversationMessage[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is ConversationMessage => Boolean(
    item
    && typeof item === "object"
    && ((item as ConversationMessage).role === "user" || (item as ConversationMessage).role === "assistant")
    && typeof (item as ConversationMessage).content === "string"
    && (item as ConversationMessage).content.length <= 2_000,
  )).slice(-6).map((item) => ({
    role: item.role,
    content: item.content.slice(0, 900),
  }));
}

function requestedModelRole(body: Record<string, unknown>, agentId: PlotPickleAgentId): LocalTextRole {
  if (body.modelRole === "deep") return "deep";
  if (body.modelRole === "quality") return "quality";
  if (body.modelRole === "fast") return "fast";
  if (agentId === "curriculum-guide") return "fast";
  return "fast";
}

async function profileForProvider(
  store: Awaited<ReturnType<typeof readSynchronizedAssistantStore>>["store"],
  provider: TextProvider,
  role: LocalTextRole,
) {
  if (provider === "local") return refreshLocalProfile(store, role);
  const profile = store.profiles[provider];
  if (!profile) throw new Error("The selected Writing Assistant provider is not configured.");
  return profile;
}

async function handleChat(request: IncomingMessage, response: ServerResponse) {
  const body = await readBody(request, 96 * 1024);
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 12_000) : "";
  if (!message) throw new Error("Enter a question for the Writing Assistant.");
  const { store } = await readSynchronizedAssistantStore();
  const explicit = isTextProvider(body.provider) ? body.provider : null;
  const requestedProvider = explicit || store.activeProvider;
  if (!isTextProvider(requestedProvider)) throw new Error("The Writing Assistant is off. Select Local Runtime, Ollama, OpenAI or MiniMax first.");
  const agentId = typeof body.agentId === "string" && body.agentId in PLOTPICKLE_AGENT_ROLES
    ? body.agentId as PlotPickleAgentId
    : "creative-director";
  const role = requestedModelRole(body, agentId);
  let profile = await profileForProvider(store, requestedProvider, role);
  if (agentId === "curriculum-guide") profile = curriculumGuideLocalProfile(profile);
  const allowedTones = new Set<PlotPickleTone>(["collaborative", "direct", "curious", "challenging", "gentle"]);
  const tone = typeof body.tone === "string" && allowedTones.has(body.tone as PlotPickleTone)
    ? body.tone as PlotPickleTone
    : "collaborative";
  const foundationFieldIds = agentId === "foundations-planner" && Array.isArray(body.foundationFieldIds)
    ? body.foundationFieldIds.filter((value): value is string => (
      typeof value === "string" && /^output-[1-9][0-9]?$/.test(value)
    )).slice(0, 12)
    : [];
  const started = Date.now();
  const text = await askPlotPickleAgent({
    profile,
    agentId,
    tone,
    message,
    history: safeHistory(body.history),
    foundationFieldIds,
  });
  if (!text) throw new Error("The provider returned no text.");
  const updated: ProviderProfile = {
    ...profile,
    assistantVerifiedAt: new Date().toISOString(),
    lastAttemptAt: new Date().toISOString(),
    lastLatencyMs: Date.now() - started,
    lastPreview: text.slice(0, 600),
    lastError: "",
  };
  store.profiles[requestedProvider] = updated;
  await writeAssistantStore(store);
  sendJson(response, 200, {
    ok: true,
    provider: updated.provider,
    runtimeProvider: updated.runtime || updated.provider,
    model: updated.textModel,
    modelRole: role,
    contextTokens: updated.contextTokens,
    runtime: "mastra",
    agentId,
    text,
    latencyMs: updated.lastLatencyMs,
    verifiedAt: updated.assistantVerifiedAt,
  });
}

async function handleTextOverride(request: IncomingMessage, response: ServerResponse) {
  const { store, available } = await readSynchronizedAssistantStore();
  if (!available && store.activeProvider !== "local") return false;
  if (!isTextProvider(store.activeProvider)) {
    sendJson(response, 409, { ok: false, message: "The Writing Assistant is off. Select a text engine on the Configuration Dashboard." });
    return true;
  }
  const body = await readBody(request, 96 * 1024);
  const role: LocalTextRole = body.modelRole === "deep" ? "deep" : body.modelRole === "quality" ? "quality" : "fast";
  const profile = await profileForProvider(store, store.activeProvider, role);
  const instructions = typeof body.instructions === "string" ? body.instructions : ASSISTANT_INSTRUCTIONS;
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const text = await generateAssistantText(profile, instructions, prompt);
  if (!text) throw new Error("The selected text provider returned no text.");
  sendJson(response, 200, {
    ok: true,
    text,
    provider: profile.provider,
    runtimeProvider: profile.runtime || profile.provider,
    model: profile.textModel,
    modelRole: role,
  });
  return true;
}

async function routeAssistant(request: IncomingMessage, response: ServerResponse, pathname: string) {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, { ok: false, message: "The Writing Assistant accepts requests only from this PlotPickle server." });
    return;
  }
  try {
    if (pathname === STATUS_PATH && request.method === "GET") return await handleStatus(response);
    if (pathname === ACTIVE_PATH && request.method === "POST") return await handleActive(request, response);
    if (pathname === TEST_PATH && request.method === "POST") return await handleTest(request, response);
    if (pathname === CHAT_PATH && request.method === "POST") return await handleChat(request, response);
    if (pathname === OLLAMA_CONNECTION_PATH && request.method === "POST") return await handleOllamaConnection(request, response);
    if (pathname === OLLAMA_PATH && request.method === "POST") return await handleOllama(request, response);
    sendJson(response, 404, { ok: false, message: "Writing Assistant operation not found." });
  } catch (error) {
    const message = error instanceof Error
      ? error.message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]")
      : "The Writing Assistant operation failed.";
    sendJson(response, 400, { ok: false, message });
  }
}

export function registerWritingAssistantGateway(server: ViteDevServer) {
  server.middlewares.use((request, response, next) => {
    const pathname = request.url?.split("?", 1)[0] || "";
    if (pathname === TEXT_PATH && request.method === "POST") {
      if (!isLocalRequest(request)) {
        sendJson(response, 403, { ok: false, message: "The local text gateway accepts requests only from this PlotPickle server." });
        return;
      }
      void handleTextOverride(request, response)
        .then((handled) => { if (!handled) next(); })
        .catch((error) => {
          const message = error instanceof Error
            ? error.message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]")
            : "The selected text provider failed.";
          sendJson(response, 400, { ok: false, message });
        });
      return;
    }
    if (!pathname.startsWith(API_ROOT)) {
      next();
      return;
    }
    void routeAssistant(request, response, pathname);
  });
}
