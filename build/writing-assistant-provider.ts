import type { ProfileStore, ProviderProfile, TextProvider } from "./writing-assistant-store";
import { writeAssistantStore } from "./writing-assistant-store";

export type ConversationMessage = { role: "user" | "assistant"; content: string };

export type OllamaProbe = {
  reachable: boolean;
  baseUrl: string;
  models: string[];
  version: string;
  latencyMs: number;
  checkedAt: string;
  error: string;
};

export const DEFAULT_OLLAMA_URL = "http://127.0.0.1:11434";
export const TEST_PROMPT = "Introduce yourself to a new PlotPickle writer.";
export const CURRICULUM_GUIDE_CONTEXT = 16_384;
export const CURRICULUM_GUIDE_EXTENDED_CONTEXT = 32_768;
export const CURRICULUM_GUIDE_TEMPERATURE = 0.2;
export const ASSISTANT_INSTRUCTIONS = [
  "You are the active PlotPickle Writing Assistant.",
  "Help the writer understand PlotPickle, develop story ideas, organize story logic, and decide a clear next action.",
  "Be concise, practical, candid about uncertainty, and never claim to change canon or project files.",
].join(" ");

export function normalizedProviderUrl(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Use an HTTP or HTTPS provider address.");
  if (url.username || url.password) throw new Error("Do not put credentials in the provider address.");
  return url.toString().replace(/\/$/, "");
}

function cleanProviderError(value: unknown) {
  if (value && typeof value === "object") {
    const item = value as { error?: { message?: unknown }; message?: unknown };
    const message = item.error?.message ?? item.message;
    if (typeof message === "string") return message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]").slice(0, 300);
  }
  return "The selected text provider did not accept the request.";
}

function providerName(profile: ProviderProfile) {
  if (profile.provider === "local") return profile.runtime === "llama.cpp"
    ? "llama.cpp"
    : profile.runtime === "lm-studio"
      ? "LM Studio"
      : profile.runtime === "ollama"
        ? "Ollama"
        : "local OpenAI-compatible runtime";
  if (profile.provider === "ollama") return "Ollama";
  if (profile.provider === "openai") return "OpenAI";
  return "MiniMax";
}

async function providerJson(url: string, profile: ProviderProfile, body: Record<string, unknown>) {
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  if (profile.provider !== "ollama" && profile.provider !== "local" && profile.apiKey) headers.Authorization = `Bearer ${profile.apiKey}`;
  const timeoutMs = profile.provider === "local" || profile.provider === "ollama" ? 300_000 : 180_000;
  let result: Response;
  try {
    result = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch (error) {
    if (error instanceof DOMException && (error.name === "TimeoutError" || error.name === "AbortError")) {
      throw new Error(`${providerName(profile)} took too long to answer. Your question was kept so you can try again or choose a faster text role in Settings.`);
    }
    throw error;
  }
  const source = await result.text();
  let value: unknown = {};
  try { value = source ? JSON.parse(source) : {}; } catch { value = {}; }
  if (!result.ok) {
    if (result.status === 401 || result.status === 403) throw new Error("The provider rejected this saved API key. Reconnect it in Settings.");
    if (result.status === 402) throw new Error("The provider account has insufficient balance. PlotPickle does not supply credits.");
    if (result.status === 429) throw new Error("The provider rate limit was reached. Wait before trying again.");
    throw new Error(cleanProviderError(value));
  }
  return value as Record<string, unknown>;
}

function openAiText(value: Record<string, unknown>) {
  if (typeof value.output_text === "string") return value.output_text.trim();
  const output = Array.isArray(value.output) ? value.output as Array<{ content?: Array<{ type?: string; text?: string }> }> : [];
  return output.flatMap((item) => item.content ?? [])
    .filter((item) => item.type === "output_text")
    .map((item) => item.text ?? "")
    .join("\n")
    .trim();
}

function chatCompletionText(value: Record<string, unknown>) {
  const choices = Array.isArray(value.choices) ? value.choices as Array<{ message?: { content?: unknown } }> : [];
  const content = choices[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content.flatMap((part) => part && typeof part === "object" && "text" in part && typeof (part as { text?: unknown }).text === "string"
      ? [(part as { text: string }).text]
      : []).join("\n").trim();
  }
  return "";
}

function compatibleChatEndpoint(profile: ProviderProfile) {
  const baseUrl = normalizedProviderUrl(profile.baseUrl);
  if (profile.provider === "ollama" && !/\/v1$/i.test(baseUrl)) return `${baseUrl}/v1/chat/completions`;
  return `${baseUrl}/chat/completions`;
}

export async function generateAssistantText(profile: ProviderProfile, instructions: string, prompt: string) {
  const baseUrl = normalizedProviderUrl(profile.baseUrl);
  if (!prompt.trim()) throw new Error("Enter a question before sending it to the Writing Assistant.");
  if (!profile.textModel.trim()) throw new Error("Choose a text model for this provider.");

  if (profile.provider === "openai") {
    const value = await providerJson(`${baseUrl}/responses`, profile, {
      model: profile.textModel,
      instructions: instructions.slice(0, 6_000),
      input: prompt.slice(0, 64_000),
    });
    return openAiText(value);
  }

  if (profile.provider === "minimax") {
    const value = await providerJson(`${baseUrl}/v1/chat/completions`, profile, {
      model: profile.textModel,
      messages: [
        { role: "system", content: instructions.slice(0, 6_000) },
        { role: "user", content: prompt.slice(0, 64_000) },
      ],
    });
    return chatCompletionText(value);
  }

  // Every local runtime, including legacy Ollama, enters PlotPickle through the
  // OpenAI-compatible chat-completions contract. Runtime-specific lifecycle and
  // installation logic stays below this provider boundary.
  const value = await providerJson(compatibleChatEndpoint(profile), profile, {
    model: profile.textModel,
    messages: [
      { role: "system", content: instructions.slice(0, 6_000) },
      { role: "user", content: prompt.slice(0, 64_000) },
    ],
    stream: false,
    temperature: CURRICULUM_GUIDE_TEMPERATURE,
  });
  return chatCompletionText(value);
}

export async function testAssistantProfile(store: ProfileStore, provider: TextProvider) {
  const profile = store.profiles[provider];
  if (!profile) throw new Error(`Configure ${provider === "local" ? "a local runtime" : provider === "ollama" ? "Ollama" : provider === "openai" ? "OpenAI" : "MiniMax"} before testing it.`);
  const started = Date.now();
  const attemptedAt = new Date().toISOString();
  try {
    const text = await generateAssistantText(profile, ASSISTANT_INSTRUCTIONS, TEST_PROMPT);
    if (!text) throw new Error("The provider returned no text.");
    const updated: ProviderProfile = {
      ...profile,
      assistantVerifiedAt: new Date().toISOString(),
      lastAttemptAt: attemptedAt,
      lastLatencyMs: Date.now() - started,
      lastPreview: text.slice(0, 600),
      lastError: "",
    };
    store.profiles[provider] = updated;
    await writeAssistantStore(store);
    return { text, profile: updated };
  } catch (error) {
    const message = error instanceof Error ? error.message : "The provider test failed.";
    store.profiles[provider] = {
      ...profile,
      assistantVerifiedAt: "",
      lastAttemptAt: attemptedAt,
      lastLatencyMs: Date.now() - started,
      lastPreview: "",
      lastError: message,
    };
    await writeAssistantStore(store);
    throw error;
  }
}

function ollamaError(error: unknown) {
  if (error instanceof DOMException && error.name === "TimeoutError") {
    return "Ollama did not answer before the three-second connection timeout. Start Ollama and verify the server address.";
  }
  if (error instanceof Error) {
    if (/fetch failed|ECONNREFUSED|connect/i.test(error.message)) {
      return "Ollama is not reachable at this address. Start Ollama, then test the connection again.";
    }
    return error.message.slice(0, 300);
  }
  return "Ollama could not be checked.";
}

export async function probeOllama(baseUrl = DEFAULT_OLLAMA_URL): Promise<OllamaProbe> {
  const normalized = normalizedProviderUrl(baseUrl || DEFAULT_OLLAMA_URL).replace(/\/v1$/i, "");
  const started = Date.now();
  const checkedAt = new Date().toISOString();
  try {
    const [tagsResponse, versionResponse] = await Promise.all([
      fetch(`${normalized}/api/tags`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3_000),
      }),
      fetch(`${normalized}/api/version`, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(3_000),
      }).catch(() => null),
    ]);
    if (!tagsResponse.ok) throw new Error(`Ollama returned HTTP ${tagsResponse.status} from /api/tags.`);
    const value = await tagsResponse.json() as { models?: Array<{ name?: unknown; model?: unknown }> };
    const models = (value.models ?? [])
      .map((item) => typeof item.name === "string" ? item.name : typeof item.model === "string" ? item.model : "")
      .filter(Boolean)
      .slice(0, 100);
    let version = "";
    if (versionResponse?.ok) {
      const versionValue = await versionResponse.json().catch(() => ({})) as { version?: unknown };
      version = typeof versionValue.version === "string" ? versionValue.version : "";
    }
    return {
      reachable: true,
      baseUrl: normalized,
      models,
      version,
      latencyMs: Date.now() - started,
      checkedAt,
      error: models.length ? "" : "Ollama is running, but no installed models were reported.",
    };
  } catch (error) {
    return {
      reachable: false,
      baseUrl: normalized,
      models: [],
      version: "",
      latencyMs: Date.now() - started,
      checkedAt,
      error: ollamaError(error),
    };
  }
}

export async function listOllamaModels(baseUrl = DEFAULT_OLLAMA_URL) {
  return (await probeOllama(baseUrl)).models;
}

export function curriculumGuideLocalProfile(profile: ProviderProfile) {
  return {
    ...profile,
    contextTokens: profile.contextTokens === CURRICULUM_GUIDE_EXTENDED_CONTEXT
      ? CURRICULUM_GUIDE_EXTENDED_CONTEXT
      : CURRICULUM_GUIDE_CONTEXT,
  };
}

export function conversationPrompt(history: ConversationMessage[], message: string) {
  const transcript = history.slice(-10)
    .map((item) => `${item.role === "user" ? "Writer" : "Assistant"}: ${item.content.slice(0, 4_000)}`)
    .join("\n");
  return transcript ? `${transcript}\nWriter: ${message}\nAssistant:` : message;
}
