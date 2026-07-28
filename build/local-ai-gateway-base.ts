import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  persistentHome,
  readCredentialJson,
  removeCredentialFile,
  writeCredentialJson,
} from "./local-credentials";

type LiveProvider = "openai" | "openai-compatible" | "ollama";

type SavedAiConnection = {
  version: 1;
  provider: LiveProvider;
  baseUrl: string;
  textModel: string;
  imageModel: string;
  apiKey: string;
  verifiedAt: string;
};

type ConnectionInput = {
  provider?: unknown;
  baseUrl?: unknown;
  textModel?: unknown;
  imageModel?: unknown;
  apiKey?: unknown;
};

type TextGenerationInput = { instructions?: unknown; prompt?: unknown };
type ImageGenerationInput = {
  prompt?: unknown;
  characterId?: unknown;
  assetId?: unknown;
  aspect?: unknown;
  quality?: unknown;
  referenceImages?: unknown;
  identityLocks?: unknown;
};

const API_PATH = "/api/local-ai/connection";
const CHECK_PATH = `${API_PATH}/check`;
const TEXT_PATH = "/api/local-ai/generate/text";
const IMAGE_PATH = "/api/local-ai/generate/image";
const ASSET_PATH = "/api/local-ai/assets/";
const LIVE_PROVIDERS: LiveProvider[] = ["openai", "openai-compatible", "ollama"];

function assetsDirectory() {
  return path.join(persistentHome(), "assets");
}

function isLoopback(value: string | undefined) {
  return value === "127.0.0.1" || value === "::1" || value === "::ffff:127.0.0.1";
}

function isLocalRequest(request: IncomingMessage) {
  if (!isLoopback(request.socket.remoteAddress)) return false;
  const host = request.headers.host;
  if (!host) return false;
  let hostUrl: URL;
  try {
    hostUrl = new URL(`http://${host}`);
  } catch {
    return false;
  }
  if (hostUrl.hostname !== "127.0.0.1" && hostUrl.hostname !== "localhost" && hostUrl.hostname !== "[::1]") return false;
  const origin = request.headers.origin;
  if (!origin) return true;
  try {
    return new URL(origin).host === hostUrl.host;
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

async function readBody(request: IncomingMessage, maximum = 64 * 1024): Promise<unknown> {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > maximum) throw new Error("The local request is too large.");
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
}

function isSavedConnection(value: unknown): value is SavedAiConnection {
  if (!value || typeof value !== "object") return false;
  const item = value as Partial<SavedAiConnection>;
  return item.version === 1
    && LIVE_PROVIDERS.includes(item.provider as LiveProvider)
    && typeof item.baseUrl === "string"
    && typeof item.textModel === "string"
    && typeof item.imageModel === "string"
    && typeof item.apiKey === "string"
    && typeof item.verifiedAt === "string";
}

async function readConnection() {
  const value = await readCredentialJson<unknown>("ai-connection.json");
  return isSavedConnection(value) ? value : null;
}

async function writeConnection(value: SavedAiConnection) {
  await writeCredentialJson("ai-connection.json", value);
}

function publicConnection(value: SavedAiConnection | null) {
  return value ? {
    available: true,
    saved: true,
    provider: value.provider,
    baseUrl: value.baseUrl,
    textModel: value.textModel,
    imageModel: value.imageModel,
    checkedAt: value.verifiedAt,
  } : { available: true, saved: false };
}

function normalizedUrl(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Use an HTTP or HTTPS server address.");
  if (url.username || url.password) throw new Error("Do not put credentials in the server address.");
  return url.toString().replace(/\/$/, "");
}

function cleanProviderError(value: unknown) {
  if (value && typeof value === "object") {
    const error = value as { error?: { message?: unknown }; message?: unknown };
    const message = error.error?.message ?? error.message;
    if (typeof message === "string") return message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]").slice(0, 300);
  }
  return "The provider did not accept the connection check.";
}

function providerHeaders(connection: SavedAiConnection) {
  const headers: Record<string, string> = { Accept: "application/json", "Content-Type": "application/json" };
  if (connection.provider !== "ollama" && connection.apiKey) headers.Authorization = `Bearer ${connection.apiKey}`;
  return headers;
}

function providerFormHeaders(connection: SavedAiConnection) {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (connection.apiKey) headers.Authorization = `Bearer ${connection.apiKey}`;
  return headers;
}

async function providerJson(url: string, connection: SavedAiConnection, body: Record<string, unknown>, timeout = 120_000) {
  const providerResponse = await fetch(url, {
    method: "POST",
    headers: providerHeaders(connection),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const text = await providerResponse.text();
  let value: unknown = {};
  try { value = text ? JSON.parse(text) : {}; } catch { value = {}; }
  if (!providerResponse.ok) {
    if (providerResponse.status === 401 || providerResponse.status === 403) throw new Error("The saved API key was rejected. Reconnect it in Settings.");
    throw new Error(cleanProviderError(value));
  }
  return value as Record<string, unknown>;
}

async function providerForm(url: string, connection: SavedAiConnection, body: FormData, timeout = 180_000) {
  const providerResponse = await fetch(url, {
    method: "POST",
    headers: providerFormHeaders(connection),
    body,
    signal: AbortSignal.timeout(timeout),
  });
  const text = await providerResponse.text();
  let value: unknown = {};
  try { value = text ? JSON.parse(text) : {}; } catch { value = {}; }
  if (!providerResponse.ok) {
    if (providerResponse.status === 401 || providerResponse.status === 403) throw new Error("The saved API key was rejected. Reconnect it in Settings.");
    throw new Error(cleanProviderError(value));
  }
  return value as Record<string, unknown>;
}

function openAiOutputText(value: Record<string, unknown>) {
  if (typeof value.output_text === "string") return value.output_text;
  const output = Array.isArray(value.output) ? value.output as Array<{ content?: Array<{ type?: string; text?: string }> }> : [];
  return output.flatMap((item) => item.content ?? []).filter((item) => item.type === "output_text").map((item) => item.text ?? "").join("\n").trim();
}

async function generateText(connection: SavedAiConnection, input: TextGenerationInput) {
  const instructions = typeof input.instructions === "string" ? input.instructions.trim().slice(0, 6_000) : "";
  const prompt = typeof input.prompt === "string" ? input.prompt.trim().slice(0, 30_000) : "";
  if (!prompt) throw new Error("Enter a writing request before generating.");
  if (!connection.textModel) throw new Error("Choose a text model in Settings.");
  const baseUrl = normalizedUrl(connection.baseUrl);
  if (connection.provider === "openai") {
    const value = await providerJson(`${baseUrl}/responses`, connection, { model: connection.textModel, instructions, input: prompt });
    return openAiOutputText(value);
  }
  if (connection.provider === "openai-compatible") {
    const value = await providerJson(`${baseUrl}/chat/completions`, connection, {
      model: connection.textModel,
      messages: [{ role: "system", content: instructions }, { role: "user", content: prompt }],
    });
    const choices = Array.isArray(value.choices) ? value.choices as Array<{ message?: { content?: string } }> : [];
    return choices[0]?.message?.content?.trim() ?? "";
  }
  const value = await providerJson(`${baseUrl}/api/generate`, connection, {
    model: connection.textModel,
    system: instructions,
    prompt,
    stream: false,
  });
  return typeof value.response === "string" ? value.response.trim() : "";
}

function safeAssetStem(value: unknown) {
  const stem = typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") : "character";
  return stem.slice(0, 70) || "character";
}

type LocalReferenceImage = {
  bytes: Buffer;
  mimeType: "image/png" | "image/jpeg" | "image/webp";
  fileName: string;
};

async function localReferenceImage(value: unknown, index: number): Promise<LocalReferenceImage | null> {
  if (typeof value !== "string") return null;
  const reference = value.trim();
  let bytes: Buffer;
  let extension: ".png" | ".jpg" | ".webp";
  if (reference.startsWith(ASSET_PATH)) {
    const fileName = reference.slice(ASSET_PATH.length);
    if (!/^[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp)$/i.test(fileName)) return null;
    bytes = await readFile(path.join(assetsDirectory(), fileName));
    extension = fileName.toLowerCase().endsWith(".png") ? ".png" : /\.jpe?g$/i.test(fileName) ? ".jpg" : ".webp";
  } else {
    const match = /^data:image\/(png|jpeg|jpg|webp);base64,([a-z0-9+/=\s]+)$/i.exec(reference);
    if (!match) return null;
    extension = match[1].toLowerCase() === "png" ? ".png" : /^jpe?g$/i.test(match[1]) ? ".jpg" : ".webp";
    bytes = Buffer.from(match[2], "base64");
  }
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) return null;
  return {
    bytes,
    mimeType: extension === ".png" ? "image/png" : extension === ".jpg" ? "image/jpeg" : "image/webp",
    fileName: `character-reference-${index + 1}${extension}`,
  };
}

async function referenceImages(input: ImageGenerationInput) {
  if (!Array.isArray(input.referenceImages)) return [];
  const candidates = await Promise.all(input.referenceImages.slice(0, 4).map(async (value, index) => {
    try {
      return await localReferenceImage(value, index);
    } catch {
      return null;
    }
  }));
  return candidates.filter((value): value is LocalReferenceImage => Boolean(value));
}

async function generateImage(connection: SavedAiConnection, input: ImageGenerationInput) {
  const prompt = typeof input.prompt === "string" ? input.prompt.trim().slice(0, 30_000) : "";
  if (!prompt) throw new Error("Enter an image prompt before generating.");
  if (connection.provider === "ollama") throw new Error("The selected local text model does not provide image generation. Connect an image-capable provider in Settings.");
  if (!connection.imageModel) throw new Error("Choose an image model in Settings.");
  const quality = input.quality === "low" || input.quality === "medium" || input.quality === "high" ? input.quality : "medium";
  const size = input.aspect === "landscape" ? "1536x1024" : "1024x1536";
  const references = connection.provider === "openai" ? await referenceImages(input) : [];
  let value: Record<string, unknown>;
  if (references.length) {
    const form = new FormData();
    form.set("model", connection.imageModel);
    form.set("prompt", prompt);
    form.set("size", size);
    form.set("quality", quality);
    form.set("output_format", "webp");
    form.set("n", "1");
    if (!connection.imageModel.startsWith("gpt-image-2")) form.set("input_fidelity", "high");
    references.forEach((reference) => {
      form.append("image[]", new Blob([new Uint8Array(reference.bytes)], { type: reference.mimeType }), reference.fileName);
    });
    value = await providerForm(`${normalizedUrl(connection.baseUrl)}/images/edits`, connection, form);
  } else {
    value = await providerJson(`${normalizedUrl(connection.baseUrl)}/images/generations`, connection, {
      model: connection.imageModel,
      prompt,
      size,
      quality,
      output_format: "webp",
      n: 1,
    }, 180_000);
  }
  const data = Array.isArray(value.data) ? value.data as Array<{ b64_json?: string; url?: string; revised_prompt?: string }> : [];
  const result = data[0];
  if (!result?.b64_json && !result?.url) throw new Error("The image provider returned no image.");
  let bytes: Buffer;
  if (result.b64_json) {
    bytes = Buffer.from(result.b64_json, "base64");
  } else {
    const imageResponse = await fetch(result.url!, { signal: AbortSignal.timeout(60_000) });
    if (!imageResponse.ok) throw new Error("The generated image could not be downloaded for local storage.");
    bytes = Buffer.from(await imageResponse.arrayBuffer());
  }
  if (!bytes.length || bytes.length > 20 * 1024 * 1024) throw new Error("The generated image file was empty or too large.");
  const fileName = `${safeAssetStem(input.assetId || input.characterId)}-${Date.now()}.webp`;
  await mkdir(assetsDirectory(), { recursive: true, mode: 0o700 });
  await writeFile(path.join(assetsDirectory(), fileName), bytes, { mode: 0o600 });
  return { assetUrl: `${ASSET_PATH}${fileName}`, revisedPrompt: result.revised_prompt, referenceImagesUsed: references.length };
}

async function serveAsset(pathname: string, response: ServerResponse) {
  const fileName = pathname.slice(ASSET_PATH.length);
  if (!/^[a-z0-9-]+\.(?:webp|png|jpe?g)$/i.test(fileName)) throw new Error("Invalid local asset path.");
  const bytes = await readFile(path.join(assetsDirectory(), fileName));
  const extension = path.extname(fileName).toLowerCase();
  response.statusCode = 200;
  response.setHeader("Content-Type", extension === ".png" ? "image/png" : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "image/webp");
  response.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(bytes);
}

async function verifyConnection(value: Omit<SavedAiConnection, "verifiedAt">) {
  if (value.provider === "openai" && !value.apiKey) throw new Error("Enter an OpenAI API key.");
  const baseUrl = normalizedUrl(value.baseUrl);
  const endpoint = value.provider === "ollama" ? `${baseUrl}/api/tags` : `${baseUrl}/models`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (value.provider !== "ollama" && value.apiKey) headers.Authorization = `Bearer ${value.apiKey}`;
  const providerResponse = await fetch(endpoint, { headers, signal: AbortSignal.timeout(15_000) });
  const text = await providerResponse.text();
  let body: unknown = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  if (!providerResponse.ok) {
    if (providerResponse.status === 401 || providerResponse.status === 403) throw new Error("The API key was rejected. Check the key and try again.");
    throw new Error(cleanProviderError(body));
  }
  return new Date().toISOString();
}

function parseInput(input: ConnectionInput, saved: SavedAiConnection | null): Omit<SavedAiConnection, "verifiedAt"> {
  if (!LIVE_PROVIDERS.includes(input.provider as LiveProvider)) throw new Error("Choose a live AI provider before connecting.");
  const provider = input.provider as LiveProvider;
  const apiKey = typeof input.apiKey === "string" && input.apiKey.trim()
    ? input.apiKey.trim()
    : saved?.provider === provider ? saved.apiKey : "";
  return {
    version: 1,
    provider,
    baseUrl: normalizedUrl(typeof input.baseUrl === "string" ? input.baseUrl : ""),
    textModel: typeof input.textModel === "string" ? input.textModel.trim() : "",
    imageModel: typeof input.imageModel === "string" ? input.imageModel.trim() : "",
    apiKey,
  };
}

async function handleConnection(request: IncomingMessage, response: ServerResponse) {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, { ok: false, message: "The local AI gateway accepts requests only from this PlotPickle server." });
    return;
  }
  try {
    if (request.url === API_PATH && request.method === "GET") {
      sendJson(response, 200, publicConnection(await readConnection()));
      return;
    }
    if (request.url === API_PATH && request.method === "POST") {
      const existing = await readConnection();
      const candidate = parseInput(await readBody(request) as ConnectionInput, existing);
      const verifiedAt = await verifyConnection(candidate);
      const saved: SavedAiConnection = { ...candidate, verifiedAt };
      await writeConnection(saved);
      sendJson(response, 200, { ok: true, message: "API connected.", ...publicConnection(saved) });
      return;
    }
    if (request.url === CHECK_PATH && request.method === "POST") {
      const saved = await readConnection();
      if (!saved) throw new Error("No saved AI connection was found.");
      const { verifiedAt: _previousCheck, ...candidate } = saved;
      const verifiedAt = await verifyConnection(candidate);
      const updated = { ...saved, verifiedAt };
      await writeConnection(updated);
      sendJson(response, 200, { ok: true, message: "API connected.", ...publicConnection(updated) });
      return;
    }
    if (request.url === API_PATH && request.method === "DELETE") {
      await removeCredentialFile("ai-connection.json");
      sendJson(response, 200, { ok: true, message: "Saved API connection removed.", available: true, saved: false });
      return;
    }
    sendJson(response, 405, { ok: false, message: "Method not allowed." });
  } catch (error) {
    const message = error instanceof Error
      ? error.message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]")
      : "The local AI connection could not be checked.";
    sendJson(response, 400, { ok: false, message });
  }
}

async function handleGeneration(request: IncomingMessage, response: ServerResponse, pathname: string) {
  if (!isLocalRequest(request)) {
    sendJson(response, 403, { ok: false, message: "The local AI gateway accepts requests only from this PlotPickle server." });
    return;
  }
  try {
    if (request.method === "GET" && pathname.startsWith(ASSET_PATH)) {
      await serveAsset(pathname, response);
      return;
    }
    if (request.method !== "POST") {
      sendJson(response, 405, { ok: false, message: "Method not allowed." });
      return;
    }
    const connection = await readConnection();
    if (!connection) throw new Error("Connect an AI provider in Settings before generating.");
    if (pathname === TEXT_PATH) {
      const text = await generateText(connection, await readBody(request, 48 * 1024) as TextGenerationInput);
      if (!text) throw new Error("The AI provider returned no text.");
      sendJson(response, 200, { ok: true, text, provider: connection.provider, model: connection.textModel });
      return;
    }
    if (pathname === IMAGE_PATH) {
      const result = await generateImage(connection, await readBody(request, 256 * 1024) as ImageGenerationInput);
      sendJson(response, 200, { ok: true, ...result, provider: connection.provider, model: connection.imageModel });
      return;
    }
    sendJson(response, 404, { ok: false, message: "Local AI operation not found." });
  } catch (error) {
    const message = error instanceof Error ? error.message.replace(/sk-[a-zA-Z0-9_-]+/g, "[redacted]") : "The local AI operation failed.";
    sendJson(response, 400, { ok: false, message });
  }
}

export function localAiGateway(): Plugin {
  return {
    name: "plotpickle-local-ai-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split("?", 1)[0];
        if (!pathname || (pathname !== API_PATH && pathname !== CHECK_PATH && pathname !== TEXT_PATH && pathname !== IMAGE_PATH && !pathname.startsWith(ASSET_PATH))) {
          next();
          return;
        }
        if (pathname === API_PATH || pathname === CHECK_PATH) void handleConnection(request, response);
        else void handleGeneration(request, response, pathname);
      });
    },
  };
}
