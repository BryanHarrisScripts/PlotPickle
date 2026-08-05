import type { IncomingMessage, ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";
import {
  ASSISTANT_INSTRUCTIONS,
  DEFAULT_OLLAMA_URL,
  conversationPrompt,
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
} from "./writing-assistant-store";

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

async function handleStatus(response: ServerResponse) {
  const { store } = await readSynchronizedAssistantStore();
  const ollamaProfile = store.profiles.ollama;
  const baseUrl = store.ollamaBaseUrl || ollamaProfile?.baseUrl || DEFAULT_OLLAMA_URL;
  const probe = await probeOllama(baseUrl);
  sendJson(response, 200, {
    ok: true,
    activeProvider: store.activeProvider,
    explicitlyDisabled: store.explicitlyDisabled,
    providers: {
      ollama: publicProfile(store.profiles.ollama, store.activeProvider),
      openai: publicProfile(store.profiles.openai, store.activeProvider),
      minimax: publicProfile(store.profiles.minimax, store.activeProvider),
    },
    ollama: {
      detected: probe.reachable,
      reachable: probe.reachable,
      models: probe.models,
      baseUrl: probe.baseUrl,
      version: probe.version,
      latencyMs: probe.latencyMs,
      checkedAt: probe.checkedAt,
      error: probe.error,
    },
  });
}

async function handleActive(request: IncomingMessage, response: ServerResponse) {
  const body = await readBody(request);
  const requested = body.provider;
  if (requested !== "disabled" && !isTextProvider(requested)) throw new Error("Choose Ollama, OpenAI, MiniMax or Off.");
  const { store } = await readSynchronizedAssistantStore();
  if (requested !== "disabled" && !store.profiles[requested]) throw new Error("Configure this provider before selecting it.");
  store.activeProvider = requested;
  store.explicitlyDisabled = requested === "disabled";
  await writeAssistantStore(store);
  sendJson(response, 200, { ok: true, activeProvider: store.activeProvider });
}

async function handleTest(request: IncomingMessage, response: ServerResponse) {
  const body = await readBody(request);
  const { store } = await readSynchronizedAssistantStore();
  const provider = isTextProvider(body.provider) ? body.provider : store.activeProvider;
  if (!isTextProvider(provider)) throw new Error("Choose a configured text provider before running the test.");
  const result = await testAssistantProfile(store, provider);
  sendJson(response, 200, {
    ok: true,
    provider,
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
    baseUrl: probe.baseUrl,
    textModel: model,
    apiKey: "",
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
    && typeof (item as ConversationMessage).content === "string",
  )).slice(-10);
}

async function handleChat(request: IncomingMessage, response: ServerResponse) {
  const body = await readBody(request, 96 * 1024);
  const message = typeof body.message === "string" ? body.message.trim().slice(0, 12_000) : "";
  if (!message) throw new Error("Enter a question for the Writing Assistant.");
  const { store } = await readSynchronizedAssistantStore();
  if (!isTextProvider(store.activeProvider)) throw new Error("The Writing Assistant is off. Select Ollama, OpenAI or MiniMax first.");
  const profile = store.profiles[store.activeProvider];
  if (!profile) throw new Error("The selected Writing Assistant provider is not configured.");
  const started = Date.now();
  const text = await generateAssistantText(profile, ASSISTANT_INSTRUCTIONS, conversationPrompt(safeHistory(body.history), message));
  if (!text) throw new Error("The provider returned no text.");
  const updated: ProviderProfile = {
    ...profile,
    assistantVerifiedAt: new Date().toISOString(),
    lastAttemptAt: new Date().toISOString(),
    lastLatencyMs: Date.now() - started,
    lastPreview: text.slice(0, 600),
    lastError: "",
  };
  store.profiles[store.activeProvider] = updated;
  await writeAssistantStore(store);
  sendJson(response, 200, {
    ok: true,
    provider: updated.provider,
    model: updated.textModel,
    text,
    latencyMs: updated.lastLatencyMs,
    verifiedAt: updated.assistantVerifiedAt,
  });
}

async function handleTextOverride(request: IncomingMessage, response: ServerResponse) {
  const { store, available } = await readSynchronizedAssistantStore();
  if (!available) return false;
  if (!isTextProvider(store.activeProvider)) {
    sendJson(response, 409, { ok: false, message: "The Writing Assistant is off. Select a text engine on the Configuration Dashboard." });
    return true;
  }
  const profile = store.profiles[store.activeProvider];
  if (!profile) {
    sendJson(response, 409, { ok: false, message: "The selected Writing Assistant provider is not configured." });
    return true;
  }
  const body = await readBody(request, 48 * 1024);
  const instructions = typeof body.instructions === "string" ? body.instructions : ASSISTANT_INSTRUCTIONS;
  const prompt = typeof body.prompt === "string" ? body.prompt : "";
  const text = await generateAssistantText(profile, instructions, prompt);
  if (!text) throw new Error("The selected text provider returned no text.");
  sendJson(response, 200, { ok: true, text, provider: profile.provider, model: profile.textModel });
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
