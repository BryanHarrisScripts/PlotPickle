import { createHash } from "node:crypto";
import { mkdir, readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite";
import {
  persistentHome,
  readCredentialJson,
  removeCredentialFile,
  writeCredentialJson,
} from "./local-credentials";

type LiveProvider = "openai" | "minimax" | "openai-compatible" | "ollama";

type SavedAiConnection = {
  version: 1;
  provider: LiveProvider;
  baseUrl: string;
  textModel: string;
  imageModel: string;
  videoModel?: string;
  apiKey: string;
  verifiedAt: string;
};

type ConnectionInput = {
  provider?: unknown;
  baseUrl?: unknown;
  textModel?: unknown;
  imageModel?: unknown;
  videoModel?: unknown;
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
  billingAcknowledged?: unknown;
  requestCount?: unknown;
};

type VideoGenerationInput = {
  prompt?: unknown;
  sourceAssetUrl?: unknown;
  assetId?: unknown;
  durationSeconds?: unknown;
  aspectRatio?: unknown;
  billingAcknowledged?: unknown;
  dataSharingAcknowledged?: unknown;
};

type StoredVideoJob = {
  id: string;
  provider: "minimax";
  model: string;
  status: "queued" | "running" | "succeeded" | "failed" | "cancelled" | "expired";
  prompt: string;
  sourceAssetUrl: string;
  assetId: string;
  durationSeconds: number;
  aspectRatio: "16:9" | "9:16" | "1:1";
  outputAssetUrl: string;
  error: string;
  createdAt: string;
  updatedAt: string;
};

const API_PATH = "/api/local-ai/connection";
const CHECK_PATH = `${API_PATH}/check`;
const TEXT_PATH = "/api/local-ai/generate/text";
const IMAGE_PATH = "/api/local-ai/generate/image";
const VIDEO_CREATE_PATH = "/api/local-ai/generate/video";
const VIDEO_JOB_PATH = "/api/local-ai/video/";
const ASSET_INDEX_PATH = "/api/local-ai/assets";
const ASSET_PATH = "/api/local-ai/assets/";
const MAX_ASSET_BYTES = 20 * 1024 * 1024;
const MAX_VIDEO_BYTES = 150 * 1024 * 1024;
const LIVE_PROVIDERS: LiveProvider[] = ["openai", "minimax", "openai-compatible", "ollama"];

function assetsDirectory() {
  return path.join(persistentHome(), "assets");
}

function videoJobsPath() {
  return path.join(persistentHome(), "video-jobs.json");
}

async function readVideoJobs(): Promise<StoredVideoJob[]> {
  try {
    const value = JSON.parse(await readFile(videoJobsPath(), "utf8")) as unknown;
    return Array.isArray(value) ? value.filter((item): item is StoredVideoJob => Boolean(item && typeof item === "object" && typeof (item as StoredVideoJob).id === "string")) : [];
  } catch {
    return [];
  }
}

async function writeVideoJobs(jobs: StoredVideoJob[]) {
  await mkdir(persistentHome(), { recursive: true, mode: 0o700 });
  await writeFile(videoJobsPath(), `${JSON.stringify(jobs, null, 2)}\n`, { mode: 0o600 });
}

async function saveVideoJob(job: StoredVideoJob) {
  const jobs = await readVideoJobs();
  await writeVideoJobs([job, ...jobs.filter((item) => item.id !== job.id)].slice(0, 200));
  return job;
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
    && (typeof item.videoModel === "string" || typeof item.videoModel === "undefined")
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
    videoModel: value.videoModel ?? "",
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

function providerFailure(status: number, value: unknown) {
  const detail = cleanProviderError(value);
  if (status === 401 || status === 403) return new Error("The saved API key was rejected. Reconnect a key owned by the current user in Settings.");
  if (status === 402 || /insufficient balance|\b1008\b/i.test(detail)) return new Error("This provider account has insufficient balance. Add funds to that user's account; PlotPickle does not supply credits.");
  if (status === 429) return new Error("The provider rate limit was reached. Wait before retrying; PlotPickle will not switch to another paid provider automatically.");
  if (status === 422 || /sensitive content|\b1026\b|\b1027\b/i.test(detail)) return new Error("The provider declined the prompt or reference media under its safety rules.");
  return new Error(detail);
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
    throw providerFailure(providerResponse.status, value);
  }
  return value as Record<string, unknown>;
}

async function providerRequest(url: string, connection: SavedAiConnection, method: "GET" | "DELETE", timeout = 30_000) {
  const providerResponse = await fetch(url, {
    method,
    headers: providerHeaders(connection),
    signal: AbortSignal.timeout(timeout),
  });
  const text = await providerResponse.text();
  let value: unknown = {};
  try { value = text ? JSON.parse(text) : {}; } catch { value = {}; }
  if (!providerResponse.ok) throw providerFailure(providerResponse.status, value);
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
    throw providerFailure(providerResponse.status, value);
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
  if (connection.provider === "openai-compatible" || connection.provider === "minimax") {
    const endpoint = connection.provider === "minimax" ? `${baseUrl}/v1/chat/completions` : `${baseUrl}/chat/completions`;
    const value = await providerJson(endpoint, connection, {
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
  if (input.billingAcknowledged !== true || input.requestCount !== 1) {
    throw new Error("Confirm this one paid image request and the selected story data before sending it to the cloud provider.");
  }
  if (!connection.imageModel) throw new Error("Choose an image model in Settings.");
  const quality = input.quality === "low" || input.quality === "medium" || input.quality === "high" ? input.quality : "medium";
  const size = input.aspect === "landscape" ? "1536x1024" : "1024x1536";
  const references = connection.provider === "openai" || connection.provider === "minimax" ? await referenceImages(input) : [];
  let value: Record<string, unknown>;
  let base64 = "";
  let outputUrl = "";
  let revisedPrompt = "";
  let providerRequestId = "";
  let extension: ".webp" | ".jpg" = ".webp";
  if (connection.provider === "minimax") {
    value = await providerJson(`${normalizedUrl(connection.baseUrl)}/v1/image_generation`, connection, {
      model: connection.imageModel,
      prompt: prompt.slice(0, 1500),
      aspect_ratio: input.aspect === "landscape" ? "16:9" : "9:16",
      response_format: "base64",
      n: 1,
      ...(references[0] ? { subject_reference: [{ type: "character", image_file: references[0].bytes.toString("base64") }] } : {}),
    }, 180_000);
    const data = value.data && typeof value.data === "object" ? value.data as { image_base64?: string[]; image_urls?: string[] } : {};
    base64 = data.image_base64?.[0] ?? "";
    outputUrl = data.image_urls?.[0] ?? "";
    providerRequestId = typeof value.id === "string" ? value.id : "";
    extension = ".jpg";
  } else if (references.length) {
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
  if (connection.provider !== "minimax") {
    const data = Array.isArray(value.data) ? value.data as Array<{ b64_json?: string; url?: string; revised_prompt?: string }> : [];
    const result = data[0];
    base64 = result?.b64_json ?? "";
    outputUrl = result?.url ?? "";
    revisedPrompt = result?.revised_prompt ?? "";
  }
  if (!base64 && !outputUrl) throw new Error("The image provider returned no image.");
  let bytes: Buffer;
  if (base64) {
    bytes = Buffer.from(base64, "base64");
  } else {
    const imageResponse = await fetch(outputUrl, { signal: AbortSignal.timeout(60_000) });
    if (!imageResponse.ok) throw new Error("The generated image could not be downloaded for local storage.");
    bytes = Buffer.from(await imageResponse.arrayBuffer());
  }
  if (!bytes.length || bytes.length > MAX_ASSET_BYTES) throw new Error("The generated image file was empty or too large.");
  const fileName = `${safeAssetStem(input.assetId || input.characterId)}-${Date.now()}${extension}`;
  await mkdir(assetsDirectory(), { recursive: true, mode: 0o700 });
  await writeFile(path.join(assetsDirectory(), fileName), bytes, { mode: 0o600 });
  return { assetUrl: `${ASSET_PATH}${fileName}`, revisedPrompt, referenceImagesUsed: Math.min(references.length, connection.provider === "minimax" ? 1 : references.length), providerRequestId };
}

function miniMaxVideoStatus(value: unknown): StoredVideoJob["status"] {
  if (value === "queued" || value === "running" || value === "succeeded" || value === "failed" || value === "cancelled" || value === "expired") return value;
  return "failed";
}

async function videoSourceReference(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const source = value.trim();
  if (source.startsWith(ASSET_PATH)) {
    const fileName = source.slice(ASSET_PATH.length);
    if (!/^[a-z0-9][a-z0-9._-]*\.(?:webp|png|jpe?g)$/i.test(fileName)) throw new Error("Choose a saved PlotPickle image as the first video frame.");
    const bytes = await readFile(path.join(assetsDirectory(), fileName));
    if (!bytes.length || bytes.length > MAX_ASSET_BYTES) throw new Error("The selected first-frame image is empty or too large.");
    return `data:${assetMediaType(fileName)};base64,${bytes.toString("base64")}`;
  }
  const url = new URL(source);
  if (url.protocol !== "https:") throw new Error("External video references must use HTTPS.");
  return url.toString();
}

async function createVideo(connection: SavedAiConnection, input: VideoGenerationInput) {
  if (connection.provider !== "minimax") throw new Error("MiniMax is the supported cloud video provider for this H3 job endpoint.");
  if (input.billingAcknowledged !== true || input.dataSharingAcknowledged !== true) {
    throw new Error("Confirm the paid MiniMax video request and the exact prompt and first-frame image being uploaded.");
  }
  const prompt = typeof input.prompt === "string" ? input.prompt.trim().slice(0, 7_000) : "";
  if (!prompt) throw new Error("Enter a motion prompt before creating a video job.");
  const model = connection.videoModel || "MiniMax-H3";
  const sourceAssetUrl = typeof input.sourceAssetUrl === "string" ? input.sourceAssetUrl.trim() : "";
  const source = await videoSourceReference(sourceAssetUrl);
  const durationSeconds = typeof input.durationSeconds === "number" && Number.isFinite(input.durationSeconds)
    ? Math.max(4, Math.min(15, Math.round(input.durationSeconds)))
    : 5;
  const aspectRatio = input.aspectRatio === "9:16" || input.aspectRatio === "1:1" ? input.aspectRatio : "16:9";
  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  if (source) content.push({ type: "image_url", image_url: { url: source }, role: "first_frame" });
  const value = await providerJson(`${normalizedUrl(connection.baseUrl)}/v2/video_generation`, connection, {
    model,
    content,
    resolution: "2K",
    duration: durationSeconds,
    ...(!source ? { ratio: aspectRatio } : {}),
  });
  const id = typeof value.task_id === "string" ? value.task_id : "";
  if (!id) throw new Error("MiniMax returned no video task ID.");
  const now = new Date().toISOString();
  return saveVideoJob({
    id,
    provider: "minimax",
    model,
    status: "queued",
    prompt,
    sourceAssetUrl,
    assetId: safeAssetStem(input.assetId || `minimax-video-${id}`),
    durationSeconds,
    aspectRatio,
    outputAssetUrl: "",
    error: "",
    createdAt: now,
    updatedAt: now,
  });
}

function publicVideoJob(job: StoredVideoJob) {
  return {
    id: job.id,
    provider: job.provider,
    model: job.model,
    status: job.status,
    durationSeconds: job.durationSeconds,
    aspectRatio: job.aspectRatio,
    sourceAssetUrl: job.sourceAssetUrl,
    outputAssetUrl: job.outputAssetUrl,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
    reviewState: "unreviewed",
  };
}

async function downloadVideoOutput(job: StoredVideoJob, value: unknown) {
  if (typeof value !== "string" || !value) return job;
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error("MiniMax returned an invalid video download URL.");
  const providerResponse = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!providerResponse.ok) throw new Error("The completed MiniMax video could not be downloaded into local PlotPickle storage.");
  const bytes = Buffer.from(await providerResponse.arrayBuffer());
  if (!bytes.length || bytes.length > MAX_VIDEO_BYTES) throw new Error("The completed MiniMax video was empty or too large for local storage.");
  const fileName = `${job.assetId}-${Date.now()}.mp4`;
  await mkdir(assetsDirectory(), { recursive: true, mode: 0o700 });
  await writeFile(path.join(assetsDirectory(), fileName), bytes, { mode: 0o600 });
  return { ...job, outputAssetUrl: `${ASSET_PATH}${fileName}` };
}

async function queryVideo(connection: SavedAiConnection, id: string) {
  if (connection.provider !== "minimax") throw new Error("The saved provider cannot query MiniMax H3 jobs.");
  const jobs = await readVideoJobs();
  const existing = jobs.find((item) => item.id === id);
  if (!existing) throw new Error("This MiniMax video job was not created by the current PlotPickle installation.");
  const value = await providerRequest(`${normalizedUrl(connection.baseUrl)}/v2/query/video_generation/${encodeURIComponent(id)}`, connection, "GET");
  const task = value.task && typeof value.task === "object" ? value.task as { status?: unknown; content?: { url?: unknown }; error?: unknown } : {};
  const status = miniMaxVideoStatus(task.status);
  const error = status === "failed" || status === "expired"
    ? typeof task.error === "string" ? task.error.slice(0, 300) : `MiniMax video task ${status}.`
    : "";
  let updated: StoredVideoJob = { ...existing, status, error, updatedAt: new Date().toISOString() };
  if (status === "succeeded" && !updated.outputAssetUrl) updated = await downloadVideoOutput(updated, task.content?.url);
  await saveVideoJob(updated);
  return updated;
}

async function cancelVideo(connection: SavedAiConnection, id: string) {
  if (connection.provider !== "minimax") throw new Error("The saved provider cannot cancel MiniMax H3 jobs.");
  const jobs = await readVideoJobs();
  const existing = jobs.find((item) => item.id === id);
  if (!existing) throw new Error("This MiniMax video job was not created by the current PlotPickle installation.");
  if (existing.status !== "queued") throw new Error("MiniMax can cancel only a queued job. A running job may finish and may still be charged.");
  const value = await providerRequest(`${normalizedUrl(connection.baseUrl)}/v2/video_generation/${encodeURIComponent(id)}`, connection, "DELETE");
  const updated = { ...existing, status: miniMaxVideoStatus(value.status || "cancelled"), updatedAt: new Date().toISOString() };
  await saveVideoJob(updated);
  return updated;
}

function safeAssetFileName(value: string) {
  return /^[a-z0-9][a-z0-9._-]*\.(?:webp|png|jpe?g|mp4)$/i.test(value) ? value : "";
}

function assetMediaType(fileName: string) {
  const extension = path.extname(fileName).toLowerCase();
  return extension === ".mp4" ? "video/mp4" : extension === ".png" ? "image/png" : extension === ".jpg" || extension === ".jpeg" ? "image/jpeg" : "image/webp";
}

async function listAssets() {
  const directory = assetsDirectory();
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const entries = await readdir(directory, { withFileTypes: true });
  const assets = await Promise.all(entries.filter((entry) => entry.isFile() && safeAssetFileName(entry.name)).map(async (entry) => {
    const fileName = safeAssetFileName(entry.name);
    const filePath = path.join(directory, fileName);
    const info = await stat(filePath);
    const maximum = fileName.toLowerCase().endsWith(".mp4") ? MAX_VIDEO_BYTES : MAX_ASSET_BYTES;
    if (!info.isFile() || !info.size || info.size > maximum) return null;
    const bytes = await readFile(filePath);
    return {
      fileName,
      url: `${ASSET_PATH}${fileName}`,
      mediaType: assetMediaType(fileName),
      bytes: bytes.length,
      contentHash: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      modifiedAt: info.mtime.toISOString(),
    };
  }));
  return {
    directory,
    assets: assets.filter(Boolean).sort((left, right) => right!.modifiedAt.localeCompare(left!.modifiedAt) || left!.fileName.localeCompare(right!.fileName)),
  };
}

async function serveAsset(pathname: string, response: ServerResponse) {
  const fileName = pathname.slice(ASSET_PATH.length);
  if (!safeAssetFileName(fileName)) throw new Error("Invalid local asset path.");
  const bytes = await readFile(path.join(assetsDirectory(), fileName));
  const maximum = fileName.toLowerCase().endsWith(".mp4") ? MAX_VIDEO_BYTES : MAX_ASSET_BYTES;
  if (!bytes.length || bytes.length > maximum) throw new Error("The local asset is empty or too large.");
  response.statusCode = 200;
  response.setHeader("Content-Type", assetMediaType(fileName));
  response.setHeader("Cache-Control", "private, max-age=31536000, immutable");
  response.setHeader("X-Content-Type-Options", "nosniff");
  response.end(bytes);
}

async function verifyConnection(value: Omit<SavedAiConnection, "verifiedAt">) {
  if ((value.provider === "openai" || value.provider === "minimax") && !value.apiKey) throw new Error(`Enter a ${value.provider === "minimax" ? "MiniMax" : "OpenAI"} API key owned by the current user.`);
  const baseUrl = normalizedUrl(value.baseUrl);
  const endpoint = value.provider === "ollama" ? `${baseUrl}/api/tags` : value.provider === "minimax" ? `${baseUrl}/v1/models` : `${baseUrl}/models`;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (value.provider !== "ollama" && value.apiKey) headers.Authorization = `Bearer ${value.apiKey}`;
  const providerResponse = await fetch(endpoint, { headers, signal: AbortSignal.timeout(15_000) });
  const text = await providerResponse.text();
  let body: unknown = {};
  try { body = text ? JSON.parse(text) : {}; } catch { body = {}; }
  if (!providerResponse.ok) {
    throw providerFailure(providerResponse.status, body);
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
    videoModel: typeof input.videoModel === "string" ? input.videoModel.trim() : "",
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
    if (request.method === "GET" && pathname === ASSET_INDEX_PATH) {
      sendJson(response, 200, { ok: true, ...(await listAssets()) });
      return;
    }
    if (request.method === "GET" && pathname.startsWith(ASSET_PATH)) {
      await serveAsset(pathname, response);
      return;
    }
    if (pathname.startsWith(VIDEO_JOB_PATH) && (request.method === "GET" || request.method === "DELETE")) {
      const connection = await readConnection();
      if (!connection) throw new Error("Connect MiniMax in Settings before managing a video job.");
      const id = decodeURIComponent(pathname.slice(VIDEO_JOB_PATH.length));
      if (!/^[A-Za-z0-9_-]{1,128}$/.test(id)) throw new Error("Invalid MiniMax video task ID.");
      const job = request.method === "GET" ? await queryVideo(connection, id) : await cancelVideo(connection, id);
      sendJson(response, 200, { ok: true, ...publicVideoJob(job) });
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
    if (pathname === VIDEO_CREATE_PATH) {
      const job = await createVideo(connection, await readBody(request, 128 * 1024) as VideoGenerationInput);
      sendJson(response, 200, { ok: true, ...publicVideoJob(job) });
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
        if (!pathname || (pathname !== API_PATH && pathname !== CHECK_PATH && pathname !== TEXT_PATH && pathname !== IMAGE_PATH && pathname !== VIDEO_CREATE_PATH && pathname !== ASSET_INDEX_PATH && !pathname.startsWith(VIDEO_JOB_PATH) && !pathname.startsWith(ASSET_PATH))) {
          next();
          return;
        }
        if (pathname === API_PATH || pathname === CHECK_PATH) void handleConnection(request, response);
        else void handleGeneration(request, response, pathname);
      });
    },
  };
}
