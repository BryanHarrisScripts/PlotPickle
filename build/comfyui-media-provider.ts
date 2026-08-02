import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { persistentHome } from "./local-credentials";
import type { ComfyWorkflow, MediaProfile } from "./media-routing-store";
import {
  safeAssetStem,
  saveGeneratedAsset,
  videoSourceReference,
  type ImageGenerationInput,
  type VideoGenerationInput,
} from "./media-provider-common";

const DEFAULT_BASE_URL = "http://127.0.0.1:8188";
const REQUEST_TIMEOUT_MS = 5_000;
const IMAGE_TIMEOUT_MS = 240_000;
const REQUIRED_IMAGE_NODES = [
  "CheckpointLoaderSimple",
  "CLIPTextEncode",
  "EmptyLatentImage",
  "KSampler",
  "VAEDecode",
  "SaveImage",
] as const;

export type ComfyProbe = {
  reachable: boolean;
  version: string;
  checkpoints: string[];
  imageNodesReady: boolean;
  missingImageNodes: string[];
  workflowNodesReady: boolean;
  missingWorkflowNodes: string[];
  error: string;
};

type ComfyOutput = { filename: string; subfolder?: string; type?: string };
type ComfyHistoryEntry = {
  outputs?: Record<string, { images?: ComfyOutput[]; gifs?: ComfyOutput[]; videos?: ComfyOutput[] }>;
  status?: { status_str?: string; messages?: unknown[] };
};

type ComfyVideoJob = {
  id: string;
  promptId: string;
  route: "minimax-comfyui";
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
  workflowHash: string;
  createdAt: string;
  updatedAt: string;
};

function normalizeBaseUrl(value: string) {
  const url = new URL(value || DEFAULT_BASE_URL);
  if (url.protocol !== "http:" || url.hostname !== "127.0.0.1" || url.port !== "8188") {
    throw new Error("ComfyUI media routing is restricted to http://127.0.0.1:8188.");
  }
  return url.toString().replace(/\/$/, "");
}

async function comfyJson(baseUrl: string, pathname: string, init?: RequestInit, timeout = REQUEST_TIMEOUT_MS) {
  const root = normalizeBaseUrl(baseUrl);
  const response = await fetch(`${root}${pathname}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    signal: AbortSignal.timeout(timeout),
  });
  const text = await response.text();
  let value: unknown = {};
  try { value = text ? JSON.parse(text) : {}; } catch { value = {}; }
  if (!response.ok) throw new Error(`ComfyUI returned HTTP ${response.status}.`);
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("ComfyUI returned an invalid JSON response.");
  return value as Record<string, unknown>;
}

function checkpointNames(body: Record<string, unknown>) {
  const loader = body.CheckpointLoaderSimple;
  if (!loader || typeof loader !== "object" || Array.isArray(loader)) return [];
  const input = (loader as Record<string, unknown>).input;
  if (!input || typeof input !== "object" || Array.isArray(input)) return [];
  const required = (input as Record<string, unknown>).required;
  if (!required || typeof required !== "object" || Array.isArray(required)) return [];
  const checkpoint = (required as Record<string, unknown>).ckpt_name;
  if (!Array.isArray(checkpoint) || !Array.isArray(checkpoint[0])) return [];
  return checkpoint[0].filter((name): name is string => typeof name === "string" && Boolean(name.trim()));
}

export function workflowNodeClasses(source: Record<string, unknown>) {
  return Array.from(new Set(Object.values(source).flatMap((value) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return [];
    const classType = (value as Record<string, unknown>).class_type;
    return typeof classType === "string" && classType.trim() ? [classType.trim()] : [];
  }))).sort();
}

async function missingNodes(baseUrl: string, names: readonly string[]) {
  const results = await Promise.all(names.map(async (name) => {
    try {
      const value = await comfyJson(baseUrl, `/object_info/${encodeURIComponent(name)}`);
      return value[name] ? "" : name;
    } catch {
      return name;
    }
  }));
  return results.filter(Boolean);
}

export async function probeComfyUI(baseUrl: string, workflow: ComfyWorkflow | null): Promise<ComfyProbe> {
  try {
    const [system, loader] = await Promise.all([
      comfyJson(baseUrl, "/system_stats"),
      comfyJson(baseUrl, "/object_info/CheckpointLoaderSimple"),
    ]);
    const info = system.system && typeof system.system === "object" && !Array.isArray(system.system)
      ? system.system as Record<string, unknown>
      : {};
    const imageMissing = await missingNodes(baseUrl, REQUIRED_IMAGE_NODES);
    const workflowMissing = workflow ? await missingNodes(baseUrl, workflow.nodeClasses) : [];
    return {
      reachable: true,
      version: typeof info.comfyui_version === "string" ? info.comfyui_version : "",
      checkpoints: checkpointNames(loader),
      imageNodesReady: imageMissing.length === 0,
      missingImageNodes: imageMissing,
      workflowNodesReady: Boolean(workflow) && workflowMissing.length === 0,
      missingWorkflowNodes: workflowMissing,
      error: "",
    };
  } catch (error) {
    return {
      reachable: false,
      version: "",
      checkpoints: [],
      imageNodesReady: false,
      missingImageNodes: [...REQUIRED_IMAGE_NODES],
      workflowNodesReady: false,
      missingWorkflowNodes: workflow?.nodeClasses ?? [],
      error: error instanceof Error ? error.message : "ComfyUI could not be checked.",
    };
  }
}

function imageWorkflow(prompt: string, checkpoint: string, input: ImageGenerationInput) {
  const landscape = input.aspect === "landscape";
  const low = input.quality === "low";
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: checkpoint } },
    "2": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["1", 1] } },
    "3": { class_type: "CLIPTextEncode", inputs: { text: "text, watermark, logo, distorted anatomy, duplicate subject", clip: ["1", 1] } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: landscape ? 768 : 576, height: landscape ? 576 : 768, batch_size: 1 } },
    "5": {
      class_type: "KSampler",
      inputs: {
        seed: Math.floor(Math.random() * 2_147_483_647),
        steps: low ? 8 : 20,
        cfg: 7,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 1,
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["4", 0],
      },
    },
    "6": { class_type: "VAEDecode", inputs: { samples: ["5", 0], vae: ["1", 2] } },
    "7": { class_type: "SaveImage", inputs: { filename_prefix: "PlotPickle", images: ["6", 0] } },
  };
}

async function submitWorkflow(baseUrl: string, workflow: Record<string, unknown>) {
  const value = await comfyJson(baseUrl, "/prompt", {
    method: "POST",
    body: JSON.stringify({ prompt: workflow, client_id: `plotpickle-${randomUUID()}` }),
  });
  const promptId = typeof value.prompt_id === "string" ? value.prompt_id : "";
  if (!promptId) throw new Error("ComfyUI returned no prompt ID.");
  return promptId;
}

async function historyEntry(baseUrl: string, promptId: string) {
  const value = await comfyJson(baseUrl, `/history/${encodeURIComponent(promptId)}`);
  const entry = value[promptId];
  return entry && typeof entry === "object" && !Array.isArray(entry) ? entry as ComfyHistoryEntry : null;
}

function firstOutput(entry: ComfyHistoryEntry | null) {
  if (!entry?.outputs) return null;
  for (const output of Object.values(entry.outputs)) {
    const candidate = output.videos?.[0] || output.gifs?.[0] || output.images?.[0];
    if (candidate?.filename) return candidate;
  }
  return null;
}

function executionError(entry: ComfyHistoryEntry | null) {
  if (!entry?.status || entry.status.status_str !== "error") return "";
  const text = JSON.stringify(entry.status.messages || []);
  return text.slice(0, 500) || "ComfyUI workflow execution failed.";
}

async function downloadOutput(baseUrl: string, output: ComfyOutput) {
  const root = normalizeBaseUrl(baseUrl);
  const query = new URLSearchParams({
    filename: output.filename,
    subfolder: output.subfolder || "",
    type: output.type || "output",
  });
  const response = await fetch(`${root}/view?${query.toString()}`, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error("ComfyUI completed the workflow but PlotPickle could not retrieve the output.");
  return Buffer.from(await response.arrayBuffer());
}

export async function generateComfyImage(baseUrl: string, checkpoint: string, input: ImageGenerationInput) {
  const prompt = typeof input.prompt === "string" ? input.prompt.trim().slice(0, 30_000) : "";
  if (!prompt) throw new Error("Enter an image prompt before generating.");
  if (!checkpoint) throw new Error("Select a ComfyUI checkpoint before testing image generation.");
  const promptId = await submitWorkflow(baseUrl, imageWorkflow(prompt, checkpoint, input));
  const started = Date.now();
  while (Date.now() - started < IMAGE_TIMEOUT_MS) {
    const entry = await historyEntry(baseUrl, promptId);
    const error = executionError(entry);
    if (error) throw new Error(error);
    const output = firstOutput(entry);
    if (output) {
      const assetUrl = await saveGeneratedAsset(await downloadOutput(baseUrl, output), input.assetId || input.characterId || "comfyui-image", ".png");
      return { assetUrl, revisedPrompt: "", referenceImagesUsed: 0, providerRequestId: promptId };
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("ComfyUI did not finish the reviewed image workflow before the local timeout.");
}

function visitStrings(value: unknown, visitor: (value: string, key: string) => string, key = ""): unknown {
  if (typeof value === "string") return visitor(value, key);
  if (Array.isArray(value)) return value.map((item) => visitStrings(item, visitor, key));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, visitStrings(child, visitor, childKey)]));
}

export function validateH3Workflow(source: Record<string, unknown>) {
  const serialized = JSON.stringify(source);
  if (!serialized.includes("{{PLOTPICKLE_PROMPT}}")) throw new Error("The ComfyUI H3 workflow must contain {{PLOTPICKLE_PROMPT}}.");
  if (!serialized.includes("{{PLOTPICKLE_MINIMAX_KEY}}")) throw new Error("The ComfyUI H3 workflow must contain {{PLOTPICKLE_MINIMAX_KEY}} instead of a saved key.");
  visitStrings(source, (value, key) => {
    if (/api.?key|authorization|token/i.test(key) && value !== "{{PLOTPICKLE_MINIMAX_KEY}}") {
      throw new Error("Remove embedded credentials from the workflow and use {{PLOTPICKLE_MINIMAX_KEY}}.");
    }
    return value;
  });
  const nodeClasses = workflowNodeClasses(source);
  if (!nodeClasses.length) throw new Error("The ComfyUI H3 workflow contains no API-format class_type nodes.");
  return nodeClasses;
}

function hydrateH3Workflow(
  source: Record<string, unknown>,
  profile: MediaProfile,
  input: VideoGenerationInput,
  prompt: string,
  sourceData: string,
) {
  const duration = typeof input.durationSeconds === "number" ? Math.max(4, Math.min(15, Math.round(input.durationSeconds))) : 5;
  const aspect = input.aspectRatio === "9:16" || input.aspectRatio === "1:1" ? input.aspectRatio : "16:9";
  return visitStrings(source, (value) => value
    .replaceAll("{{PLOTPICKLE_PROMPT}}", prompt)
    .replaceAll("{{PLOTPICKLE_MINIMAX_KEY}}", profile.apiKey)
    .replaceAll("{{PLOTPICKLE_SOURCE_IMAGE}}", sourceData)
    .replaceAll("{{PLOTPICKLE_DURATION}}", String(duration))
    .replaceAll("{{PLOTPICKLE_ASPECT_RATIO}}", aspect)) as Record<string, unknown>;
}

function comfyJobsPath() {
  return path.join(persistentHome(), "media-comfy-video-jobs.json");
}

async function readComfyJobs(): Promise<ComfyVideoJob[]> {
  try {
    const value = JSON.parse(await readFile(comfyJobsPath(), "utf8")) as unknown;
    return Array.isArray(value) ? value.filter((item): item is ComfyVideoJob => Boolean(item && typeof item === "object" && typeof (item as ComfyVideoJob).id === "string")) : [];
  } catch {
    return [];
  }
}

async function saveComfyJob(job: ComfyVideoJob) {
  const jobs = await readComfyJobs();
  await mkdir(persistentHome(), { recursive: true, mode: 0o700 });
  await writeFile(comfyJobsPath(), `${JSON.stringify([job, ...jobs.filter((item) => item.id !== job.id)].slice(0, 200), null, 2)}\n`, { mode: 0o600 });
  return job;
}

export async function createComfyVideo(
  baseUrl: string,
  workflow: ComfyWorkflow,
  profile: MediaProfile,
  input: VideoGenerationInput,
) {
  if (input.billingAcknowledged !== true || input.dataSharingAcknowledged !== true) {
    throw new Error("Confirm the paid MiniMax H3 request and the exact data sent through the local ComfyUI workflow.");
  }
  const prompt = typeof input.prompt === "string" ? input.prompt.trim().slice(0, 7_000) : "";
  if (!prompt) throw new Error("Enter a motion prompt before creating a ComfyUI H3 job.");
  const sourceAssetUrl = typeof input.sourceAssetUrl === "string" ? input.sourceAssetUrl.trim() : "";
  const sourceData = await videoSourceReference(sourceAssetUrl);
  const promptId = await submitWorkflow(baseUrl, hydrateH3Workflow(workflow.source, profile, input, prompt, sourceData));
  const id = `comfyui-${promptId}`;
  const now = new Date().toISOString();
  return saveComfyJob({
    id,
    promptId,
    route: "minimax-comfyui",
    provider: "minimax",
    model: profile.videoModel || "MiniMax-H3",
    status: "queued",
    prompt,
    sourceAssetUrl,
    assetId: safeAssetStem(input.assetId || id),
    durationSeconds: typeof input.durationSeconds === "number" ? Math.max(4, Math.min(15, Math.round(input.durationSeconds))) : 5,
    aspectRatio: input.aspectRatio === "9:16" || input.aspectRatio === "1:1" ? input.aspectRatio : "16:9",
    outputAssetUrl: "",
    error: "",
    workflowHash: workflow.hash,
    createdAt: now,
    updatedAt: now,
  });
}

export function publicComfyVideoJob(job: ComfyVideoJob) {
  return { ...job, promptId: undefined, prompt: undefined, workflowHash: undefined, reviewState: "unreviewed" };
}

export async function queryComfyVideo(baseUrl: string, id: string) {
  const jobs = await readComfyJobs();
  const existing = jobs.find((item) => item.id === id);
  if (!existing) throw new Error("This ComfyUI video job was not created by the current PlotPickle installation.");
  const entry = await historyEntry(baseUrl, existing.promptId);
  const error = executionError(entry);
  if (error) return saveComfyJob({ ...existing, status: "failed", error, updatedAt: new Date().toISOString() });
  const output = firstOutput(entry);
  if (!output) return saveComfyJob({ ...existing, status: entry ? "running" : "queued", updatedAt: new Date().toISOString() });
  const extension = output.filename.toLowerCase().endsWith(".webm") ? ".webm" : output.filename.toLowerCase().endsWith(".mp4") ? ".mp4" : null;
  if (!extension) return saveComfyJob({ ...existing, status: "failed", error: "The reviewed H3 workflow must return an MP4 or WebM output.", updatedAt: new Date().toISOString() });
  const outputAssetUrl = existing.outputAssetUrl || await saveGeneratedAsset(await downloadOutput(baseUrl, output), existing.assetId, extension);
  return saveComfyJob({ ...existing, status: "succeeded", outputAssetUrl, error: "", updatedAt: new Date().toISOString() });
}
