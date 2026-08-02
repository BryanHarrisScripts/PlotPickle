import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { persistentHome } from "./local-credentials";
import type { MediaProfile } from "./media-routing-store";
import {
  normalizedUrl,
  providerForm,
  providerJson,
  providerRequest,
  referenceImages,
  safeAssetStem,
  saveGeneratedAsset,
  videoSourceReference,
  type ImageGenerationInput,
  type VideoGenerationInput,
} from "./media-provider-common";

export type CloudVideoJob = {
  id: string;
  route: "minimax-direct";
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

function jobsPath() {
  return path.join(persistentHome(), "media-cloud-video-jobs.json");
}

async function readJobs(): Promise<CloudVideoJob[]> {
  try {
    const value = JSON.parse(await readFile(jobsPath(), "utf8")) as unknown;
    return Array.isArray(value) ? value.filter((item): item is CloudVideoJob => Boolean(item && typeof item === "object" && typeof (item as CloudVideoJob).id === "string")) : [];
  } catch {
    return [];
  }
}

async function saveJob(job: CloudVideoJob) {
  const jobs = await readJobs();
  await mkdir(persistentHome(), { recursive: true, mode: 0o700 });
  await writeFile(jobsPath(), `${JSON.stringify([job, ...jobs.filter((item) => item.id !== job.id)].slice(0, 200), null, 2)}\n`, { mode: 0o600 });
  return job;
}

export async function generateCloudImage(profile: MediaProfile, input: ImageGenerationInput) {
  const prompt = typeof input.prompt === "string" ? input.prompt.trim().slice(0, 30_000) : "";
  if (!prompt) throw new Error("Enter an image prompt before generating.");
  if (input.billingAcknowledged !== true || input.requestCount !== 1) {
    throw new Error("Confirm this one paid image request and the selected story data before sending it to the cloud provider.");
  }
  if (!profile.imageModel) throw new Error(`Choose an image model for ${profile.provider} in Settings.`);
  const quality = input.quality === "low" || input.quality === "medium" || input.quality === "high" ? input.quality : "medium";
  const size = input.aspect === "landscape" ? "1536x1024" : "1024x1536";
  const references = await referenceImages(input);
  let base64 = "";
  let outputUrl = "";
  let revisedPrompt = "";
  let providerRequestId = "";
  let extension: ".webp" | ".jpg" = ".webp";

  if (profile.provider === "minimax") {
    const value = await providerJson(`${normalizedUrl(profile.baseUrl)}/v1/image_generation`, profile, {
      model: profile.imageModel,
      prompt: prompt.slice(0, 1500),
      aspect_ratio: input.aspect === "landscape" ? "16:9" : "9:16",
      response_format: "base64",
      n: 1,
      ...(references[0] ? { subject_reference: [{ type: "character", image_file: references[0].bytes.toString("base64") }] } : {}),
    });
    const data = value.data && typeof value.data === "object" ? value.data as { image_base64?: string[]; image_urls?: string[] } : {};
    base64 = data.image_base64?.[0] ?? "";
    outputUrl = data.image_urls?.[0] ?? "";
    providerRequestId = typeof value.id === "string" ? value.id : "";
    extension = ".jpg";
  } else if (references.length) {
    const form = new FormData();
    form.set("model", profile.imageModel);
    form.set("prompt", prompt);
    form.set("size", size);
    form.set("quality", quality);
    form.set("output_format", "webp");
    form.set("n", "1");
    if (!profile.imageModel.startsWith("gpt-image-2")) form.set("input_fidelity", "high");
    references.forEach((reference) => form.append("image[]", new Blob([new Uint8Array(reference.bytes)], { type: reference.mimeType }), reference.fileName));
    const value = await providerForm(`${normalizedUrl(profile.baseUrl)}/images/edits`, profile, form);
    const data = Array.isArray(value.data) ? value.data as Array<{ b64_json?: string; url?: string; revised_prompt?: string }> : [];
    base64 = data[0]?.b64_json ?? "";
    outputUrl = data[0]?.url ?? "";
    revisedPrompt = data[0]?.revised_prompt ?? "";
  } else {
    const value = await providerJson(`${normalizedUrl(profile.baseUrl)}/images/generations`, profile, {
      model: profile.imageModel,
      prompt,
      size,
      quality,
      output_format: "webp",
      n: 1,
    });
    const data = Array.isArray(value.data) ? value.data as Array<{ b64_json?: string; url?: string; revised_prompt?: string }> : [];
    base64 = data[0]?.b64_json ?? "";
    outputUrl = data[0]?.url ?? "";
    revisedPrompt = data[0]?.revised_prompt ?? "";
  }

  if (!base64 && !outputUrl) throw new Error("The image provider returned no image.");
  let bytes: Buffer;
  if (base64) bytes = Buffer.from(base64, "base64");
  else {
    const url = new URL(outputUrl);
    if (url.protocol !== "https:") throw new Error("The image provider returned an invalid download address.");
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) });
    if (!response.ok) throw new Error("The generated image could not be downloaded for local storage.");
    bytes = Buffer.from(await response.arrayBuffer());
  }
  const assetUrl = await saveGeneratedAsset(bytes, input.assetId || input.characterId, extension);
  return {
    assetUrl,
    revisedPrompt,
    referenceImagesUsed: Math.min(references.length, profile.provider === "minimax" ? 1 : references.length),
    providerRequestId,
  };
}

function statusValue(value: unknown): CloudVideoJob["status"] {
  if (value === "queued" || value === "running" || value === "succeeded" || value === "failed" || value === "cancelled" || value === "expired") return value;
  return "failed";
}

export async function createCloudVideo(profile: MediaProfile, input: VideoGenerationInput) {
  if (profile.provider !== "minimax") throw new Error("MiniMax is the supported direct cloud video provider.");
  if (input.billingAcknowledged !== true || input.dataSharingAcknowledged !== true) {
    throw new Error("Confirm the paid MiniMax video request and the exact prompt and first-frame image being uploaded.");
  }
  const prompt = typeof input.prompt === "string" ? input.prompt.trim().slice(0, 7_000) : "";
  if (!prompt) throw new Error("Enter a motion prompt before creating a video job.");
  const model = profile.videoModel || "MiniMax-H3";
  const sourceAssetUrl = typeof input.sourceAssetUrl === "string" ? input.sourceAssetUrl.trim() : "";
  const source = await videoSourceReference(sourceAssetUrl);
  const durationSeconds = typeof input.durationSeconds === "number" && Number.isFinite(input.durationSeconds)
    ? Math.max(4, Math.min(15, Math.round(input.durationSeconds)))
    : 5;
  const aspectRatio = input.aspectRatio === "9:16" || input.aspectRatio === "1:1" ? input.aspectRatio : "16:9";
  const content: Array<Record<string, unknown>> = [{ type: "text", text: prompt }];
  if (source) content.push({ type: "image_url", image_url: { url: source }, role: "first_frame" });
  const value = await providerJson(`${normalizedUrl(profile.baseUrl)}/v2/video_generation`, profile, {
    model,
    content,
    resolution: "2K",
    duration: durationSeconds,
    ...(!source ? { ratio: aspectRatio } : {}),
  });
  const id = typeof value.task_id === "string" ? value.task_id : "";
  if (!id) throw new Error("MiniMax returned no video task ID.");
  const now = new Date().toISOString();
  return saveJob({
    id,
    route: "minimax-direct",
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

export function publicCloudVideoJob(job: CloudVideoJob) {
  return {
    id: job.id,
    provider: job.provider,
    route: job.route,
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

export async function queryCloudVideo(profile: MediaProfile, id: string) {
  const jobs = await readJobs();
  const existing = jobs.find((item) => item.id === id);
  if (!existing) throw new Error("This MiniMax video job was not created by the current media router.");
  const value = await providerRequest(`${normalizedUrl(profile.baseUrl)}/v2/query/video_generation/${encodeURIComponent(id)}`, profile, "GET");
  const task = value.task && typeof value.task === "object" ? value.task as { status?: unknown; content?: { url?: unknown }; error?: unknown } : {};
  const status = statusValue(task.status);
  const error = status === "failed" || status === "expired"
    ? typeof task.error === "string" ? task.error.slice(0, 300) : `MiniMax video task ${status}.`
    : "";
  let updated: CloudVideoJob = { ...existing, status, error, updatedAt: new Date().toISOString() };
  const output = task.content?.url;
  if (status === "succeeded" && !updated.outputAssetUrl && typeof output === "string") {
    const url = new URL(output);
    if (url.protocol !== "https:") throw new Error("MiniMax returned an invalid video download address.");
    const response = await fetch(url, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error("The completed MiniMax video could not be downloaded into local PlotPickle storage.");
    updated = { ...updated, outputAssetUrl: await saveGeneratedAsset(Buffer.from(await response.arrayBuffer()), updated.assetId, ".mp4") };
  }
  return saveJob(updated);
}

export async function cancelCloudVideo(profile: MediaProfile, id: string) {
  const jobs = await readJobs();
  const existing = jobs.find((item) => item.id === id);
  if (!existing) throw new Error("This MiniMax video job was not created by the current media router.");
  if (existing.status !== "queued") throw new Error("MiniMax can cancel only a queued job. A running job may finish and may still be charged.");
  const value = await providerRequest(`${normalizedUrl(profile.baseUrl)}/v2/video_generation/${encodeURIComponent(id)}`, profile, "DELETE");
  return saveJob({ ...existing, status: statusValue(value.status || "cancelled"), updatedAt: new Date().toISOString() });
}
