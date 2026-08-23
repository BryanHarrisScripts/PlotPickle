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
  approvedCharacterReferences?: unknown;
  environmentReferences?: unknown;
  identityLocks?: unknown;
  wardrobeLookIds?: unknown;
  composition?: unknown;
  negativeConstraints?: unknown;
  continuityMetadata?: unknown;
  billingAcknowledged?: unknown;
  requestCount?: unknown;
};

export type VideoGenerationInput = {
  prompt?: unknown;
  sourceAssetUrl?: unknown;
  assetId?: unknown;
  durationSeconds?: unknown;
  aspectRatio?: unknown;
  identityLocks?: unknown;
  wardrobeLookIds?: unknown;
  composition?: unknown;
  environmentReferences?: unknown;
  negativeConstraints?: unknown;
  continuityMetadata?: unknown;
  billingAcknowledged?: unknown;
  dataSharingAcknowledged?: unknown;
};

export type VisualContinuityEnvelope = {
  prompt: string;
  negativePrompt: string;
  references: unknown[];
  identityLockCount: number;
  wardrobeLookIds: string[];
  composition: string;
  continuity: string[];
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

function cleanString(value: unknown, maximum = 1_000) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim().slice(0, maximum) : "";
}

function cleanStringArray(value: unknown, maximumItems = 24, maximumCharacters = 500) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maximumItems).flatMap((item) => {
    const text = cleanString(item, maximumCharacters);
    return text ? [text] : [];
  });
}

function recordLines(value: unknown, prefix: string) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const item = value as Record<string, unknown>;
  const lines: string[] = [];
  for (const [key, child] of Object.entries(item)) {
    if (key === "canonicalReferenceAssetIds" || key === "referenceAssetIds" || key === "assetIds") continue;
    if (Array.isArray(child)) {
      const values = cleanStringArray(child, 20, 300);
      if (values.length) lines.push(`${prefix} ${key}: ${values.join("; ")}`);
    } else {
      const text = cleanString(child, 500);
      if (text) lines.push(`${prefix} ${key}: ${text}`);
    }
  }
  return lines;
}

function referenceIdsFromRecord(value: unknown) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  const item = value as Record<string, unknown>;
  return [
    ...cleanStringArray(item.canonicalReferenceAssetIds, 8, 300),
    ...cleanStringArray(item.referenceAssetIds, 8, 300),
    ...cleanStringArray(item.assetIds, 8, 300),
  ];
}

function normalizeAssetReference(value: string) {
  if (!value) return "";
  if (value.startsWith(ASSET_PATH) || value.startsWith("data:image/")) return value;
  if (/^[a-z0-9][a-z0-9._-]*\.(?:png|jpe?g|webp)$/i.test(value)) return `${ASSET_PATH}${value}`;
  return "";
}

export function visualContinuityEnvelope(input: ImageGenerationInput): VisualContinuityEnvelope {
  const basePrompt = cleanString(input.prompt, 30_000);
  const identityLocks = Array.isArray(input.identityLocks) ? input.identityLocks.slice(0, 12) : input.identityLocks ? [input.identityLocks] : [];
  const wardrobeLookIds = cleanStringArray(input.wardrobeLookIds, 12, 240);
  const composition = cleanString(input.composition, 1_500);
  const continuity = Array.isArray(input.continuityMetadata)
    ? input.continuityMetadata.slice(0, 24).flatMap((item) => typeof item === "string" ? [cleanString(item, 700)] : recordLines(item, "Continuity"))
    : input.continuityMetadata
      ? (typeof input.continuityMetadata === "string" ? [cleanString(input.continuityMetadata, 1_500)] : recordLines(input.continuityMetadata, "Continuity"))
      : [];
  const identityLines = identityLocks.flatMap((lock) => recordLines(lock, "Identity lock"));
  const neverChange = identityLocks.flatMap((lock) => {
    if (!lock || typeof lock !== "object" || Array.isArray(lock)) return [];
    return cleanStringArray((lock as Record<string, unknown>).neverChange, 24, 400);
  });
  const avoid = identityLocks.flatMap((lock) => {
    if (!lock || typeof lock !== "object" || Array.isArray(lock)) return [];
    return cleanStringArray((lock as Record<string, unknown>).avoid, 24, 400);
  });
  const negativeConstraints = cleanStringArray(input.negativeConstraints, 32, 500);
  const promptParts = [
    basePrompt,
    identityLines.length ? `APPROVED CHARACTER IDENTITY — preserve exactly:\n${identityLines.join("\n")}` : "",
    neverChange.length ? `NON-NEGOTIABLE IDENTITY FEATURES — do not alter: ${neverChange.join("; ")}` : "",
    wardrobeLookIds.length ? `APPROVED WARDROBE / LOOK IDS: ${wardrobeLookIds.join("; ")}` : "",
    composition ? `COMPOSITION: ${composition}` : "",
    continuity.length ? `VISUAL CONTINUITY METADATA:\n${continuity.filter(Boolean).join("\n")}` : "",
  ].filter(Boolean);
  const references = [
    ...(Array.isArray(input.approvedCharacterReferences) ? input.approvedCharacterReferences : []),
    ...identityLocks.flatMap(referenceIdsFromRecord).map(normalizeAssetReference).filter(Boolean),
    ...(Array.isArray(input.referenceImages) ? input.referenceImages : []),
    ...(Array.isArray(input.environmentReferences) ? input.environmentReferences : []),
  ];
  return {
    prompt: promptParts.join("\n\n").slice(0, 30_000),
    negativePrompt: [
      "text, watermark, logo, distorted anatomy, duplicate subject, identity drift, unintended wardrobe change, unintended environment change",
      ...avoid,
      ...negativeConstraints,
    ].filter(Boolean).join(", ").slice(0, 6_000),
    references: [...new Set(references.filter((value) => typeof value === "string" && value.trim()).map((value) => (value as string).trim()))].slice(0, 4),
    identityLockCount: identityLocks.length,
    wardrobeLookIds,
    composition,
    continuity: continuity.filter(Boolean),
  };
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
  const envelope = visualContinuityEnvelope(input);
  const values = await Promise.all(envelope.references.map((value, index) => localReferenceImage(value, index).catch(() => null)));
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
