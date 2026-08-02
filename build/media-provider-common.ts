import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { persistentHome } from "./local-credentials";
import type { MediaProfile } from "./media-routing-store";

export type ImageGenerationInput = {
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

export type VideoGenerationInput = {
  prompt?: unknown;
  sourceAssetUrl?: unknown;
  assetId?: unknown;
  durationSeconds?: unknown;
  aspectRatio?: unknown;
  billingAcknowledged?: unknown;
  dataSharingAcknowledged?: unknown;
};

export const ASSET_PATH = "/api/local-ai/assets/";
export const MAX_ASSET_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

export function assetsDirectory() {
  return path.join(persistentHome(), "assets");
}

export function safeAssetStem(value: unknown) {
  const stem = typeof value === "string" ? value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "") : "asset";
  return stem.slice(0, 70) || "asset";
}

export function normalizedUrl(value: string) {
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
  return "The provider did not accept the media request.";
}

function providerFailure(status: number, value: unknown) {
  const detail = cleanProviderError(value);
  if (status === 401 || status === 403) return new Error("The saved API key was rejected. Reconnect a key owned by the current user in Settings.");
  if (status === 402 || /insufficient balance|\b1008\b/i.test(detail)) return new Error("This provider account has insufficient balance. PlotPickle does not supply credits.");
  if (status === 429) return new Error("The provider rate limit was reached. PlotPickle will not switch to another paid provider automatically.");
  if (status === 422 || /sensitive content|\b1026\b|\b1027\b/i.test(detail)) return new Error("The provider declined the prompt or reference media under its safety rules.");
  return new Error(detail);
}

function providerHeaders(profile: MediaProfile) {
  return {
    Accept: "application/json",
    "Content-Type": "application/json",
    Authorization: `Bearer ${profile.apiKey}`,
  };
}

export async function providerJson(
  url: string,
  profile: MediaProfile,
  body: Record<string, unknown>,
  timeout = 180_000,
) {
  const response = await fetch(url, {
    method: "POST",
    headers: providerHeaders(profile),
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeout),
  });
  const text = await response.text();
  let value: unknown = {};
  try { value = text ? JSON.parse(text) : {}; } catch { value = {}; }
  if (!response.ok) throw providerFailure(response.status, value);
  return value as Record<string, unknown>;
}

export async function providerRequest(
  url: string,
  profile: MediaProfile,
  method: "GET" | "DELETE",
  timeout = 30_000,
) {
  const response = await fetch(url, {
    method,
    headers: providerHeaders(profile),
    signal: AbortSignal.timeout(timeout),
  });
  const text = await response.text();
  let value: unknown = {};
  try { value = text ? JSON.parse(text) : {}; } catch { value = {}; }
  if (!response.ok) throw providerFailure(response.status, value);
  return value as Record<string, unknown>;
}

export async function providerForm(url: string, profile: MediaProfile, body: FormData) {
  const response = await fetch(url, {
    method: "POST",
    headers: { Accept: "application/json", Authorization: `Bearer ${profile.apiKey}` },
    body,
    signal: AbortSignal.timeout(180_000),
  });
  const text = await response.text();
  let value: unknown = {};
  try { value = text ? JSON.parse(text) : {}; } catch { value = {}; }
  if (!response.ok) throw providerFailure(response.status, value);
  return value as Record<string, unknown>;
}

export type LocalReferenceImage = {
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
  if (!bytes.length || bytes.length > MAX_ASSET_BYTES) return null;
  return {
    bytes,
    mimeType: extension === ".png" ? "image/png" : extension === ".jpg" ? "image/jpeg" : "image/webp",
    fileName: `plotpickle-reference-${index + 1}${extension}`,
  };
}

export async function referenceImages(input: ImageGenerationInput) {
  if (!Array.isArray(input.referenceImages)) return [];
  const values = await Promise.all(input.referenceImages.slice(0, 4).map((value, index) => localReferenceImage(value, index).catch(() => null)));
  return values.filter((value): value is LocalReferenceImage => Boolean(value));
}

export async function saveGeneratedAsset(
  bytes: Buffer,
  stem: unknown,
  extension: ".webp" | ".jpg" | ".png" | ".mp4" | ".webm",
) {
  const maximum = extension === ".mp4" || extension === ".webm" ? MAX_VIDEO_BYTES : MAX_ASSET_BYTES;
  if (!bytes.length || bytes.length > maximum) throw new Error("The generated media file was empty or too large.");
  const fileName = `${safeAssetStem(stem)}-${Date.now()}${extension}`;
  await mkdir(assetsDirectory(), { recursive: true, mode: 0o700 });
  await writeFile(path.join(assetsDirectory(), fileName), bytes, { mode: 0o600 });
  return `${ASSET_PATH}${fileName}`;
}

export async function videoSourceReference(value: unknown) {
  if (typeof value !== "string" || !value.trim()) return "";
  const source = value.trim();
  if (source.startsWith(ASSET_PATH)) {
    const fileName = source.slice(ASSET_PATH.length);
    if (!/^[a-z0-9][a-z0-9._-]*\.(?:webp|png|jpe?g)$/i.test(fileName)) throw new Error("Choose a saved PlotPickle image as the first video frame.");
    const bytes = await readFile(path.join(assetsDirectory(), fileName));
    const mime = fileName.endsWith(".png") ? "image/png" : /\.jpe?g$/i.test(fileName) ? "image/jpeg" : "image/webp";
    return `data:${mime};base64,${bytes.toString("base64")}`;
  }
  const url = new URL(source);
  if (url.protocol !== "https:") throw new Error("External video references must use HTTPS.");
  return url.toString();
}
