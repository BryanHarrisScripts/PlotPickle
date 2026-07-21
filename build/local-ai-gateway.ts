import { chmod, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";

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

const API_PATH = "/api/local-ai/connection";
const CHECK_PATH = `${API_PATH}/check`;
const LIVE_PROVIDERS: LiveProvider[] = ["openai", "openai-compatible", "ollama"];

function persistentHome() {
  if (process.env.PLOTPICKLE_HOME) return path.resolve(process.env.PLOTPICKLE_HOME);
  if (process.env.LOCALAPPDATA) return path.join(process.env.LOCALAPPDATA, "PlotPickle");
  return path.join(os.homedir(), ".plotpickle");
}

function connectionFile() {
  return path.join(persistentHome(), "secrets", "ai-connection.json");
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

async function readBody(request: IncomingMessage) {
  const chunks: Buffer[] = [];
  let length = 0;
  for await (const chunk of request) {
    const value = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    length += value.length;
    if (length > 64 * 1024) throw new Error("Connection settings are too large.");
    chunks.push(value);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}") as ConnectionInput;
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
  try {
    const value: unknown = JSON.parse(await readFile(connectionFile(), "utf8"));
    return isSavedConnection(value) ? value : null;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw error;
  }
}

async function writeConnection(value: SavedAiConnection) {
  const file = connectionFile();
  await mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  await writeFile(file, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
  try {
    await chmod(file, 0o600);
  } catch {
    // Windows protects the file through the current user's profile permissions.
  }
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
      const candidate = parseInput(await readBody(request), existing);
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
      try { await unlink(connectionFile()); } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      }
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

export function localAiGateway(): Plugin {
  return {
    name: "plotpickle-local-ai-gateway",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use((request, response, next) => {
        const pathname = request.url?.split("?", 1)[0];
        if (pathname !== API_PATH && pathname !== CHECK_PATH) {
          next();
          return;
        }
        void handleConnection(request, response);
      });
    },
  };
}
