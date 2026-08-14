import { randomUUID } from "node:crypto";
import {
  referenceImages,
  saveGeneratedAsset,
  visualContinuityEnvelope,
  type ImageGenerationInput,
  type LocalReferenceImage,
} from "./media-provider-common";

const DEFAULT_BASE_URL = "http://127.0.0.1:8188";
const IMAGE_TIMEOUT_MS = 240_000;

type ComfyOutput = { filename: string; subfolder?: string; type?: string };
type ComfyHistoryEntry = {
  outputs?: Record<string, { images?: ComfyOutput[] }>;
  status?: { status_str?: string; messages?: unknown[] };
};

function normalizeBaseUrl(value: string) {
  const url = new URL(value || DEFAULT_BASE_URL);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "8188") {
    throw new Error("Local SDXL is restricted to the local ComfyUI address http://127.0.0.1:8188.");
  }
  return DEFAULT_BASE_URL;
}

async function comfyJson(baseUrl: string, pathname: string, init?: RequestInit, timeout = 8_000) {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${pathname}`, {
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

async function uploadReference(baseUrl: string, reference: LocalReferenceImage) {
  const form = new FormData();
  form.set("image", new Blob([new Uint8Array(reference.bytes)], { type: reference.mimeType }), reference.fileName);
  form.set("overwrite", "true");
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/upload/image`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("ComfyUI could not accept the approved character reference image.");
  const value = await response.json() as { name?: unknown; subfolder?: unknown };
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const subfolder = typeof value.subfolder === "string" ? value.subfolder.trim() : "";
  if (!name) throw new Error("ComfyUI uploaded the approved character reference but returned no file name.");
  return subfolder ? `${subfolder}/${name}` : name;
}

function dimensions(input: ImageGenerationInput) {
  if (input.aspect === "portrait") return { width: 576, height: 768 };
  if (input.aspect === "square") return { width: 704, height: 704 };
  return { width: 768, height: 576 };
}

function textWorkflow(checkpoint: string, input: ImageGenerationInput, prompt: string, negativePrompt: string) {
  const size = dimensions(input);
  const low = input.quality === "low";
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: checkpoint } },
    "2": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["1", 1] } },
    "3": { class_type: "CLIPTextEncode", inputs: { text: negativePrompt, clip: ["1", 1] } },
    "4": { class_type: "EmptyLatentImage", inputs: { width: size.width, height: size.height, batch_size: 1 } },
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
    "7": { class_type: "SaveImage", inputs: { filename_prefix: "PlotPickle-SDXL", images: ["6", 0] } },
  };
}

function referenceWorkflow(checkpoint: string, input: ImageGenerationInput, prompt: string, negativePrompt: string, uploadedReference: string) {
  const low = input.quality === "low";
  return {
    "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: checkpoint } },
    "2": { class_type: "CLIPTextEncode", inputs: { text: prompt, clip: ["1", 1] } },
    "3": { class_type: "CLIPTextEncode", inputs: { text: negativePrompt, clip: ["1", 1] } },
    "4": { class_type: "LoadImage", inputs: { image: uploadedReference, upload: "image" } },
    "5": { class_type: "VAEEncode", inputs: { pixels: ["4", 0], vae: ["1", 2] } },
    "6": {
      class_type: "KSampler",
      inputs: {
        seed: Math.floor(Math.random() * 2_147_483_647),
        steps: low ? 8 : 20,
        cfg: 6.5,
        sampler_name: "euler",
        scheduler: "normal",
        denoise: 0.58,
        model: ["1", 0],
        positive: ["2", 0],
        negative: ["3", 0],
        latent_image: ["5", 0],
      },
    },
    "7": { class_type: "VAEDecode", inputs: { samples: ["6", 0], vae: ["1", 2] } },
    "8": { class_type: "SaveImage", inputs: { filename_prefix: "PlotPickle-SDXL-Continuity", images: ["7", 0] } },
  };
}

async function submitWorkflow(baseUrl: string, workflow: Record<string, unknown>) {
  const value = await comfyJson(baseUrl, "/prompt", {
    method: "POST",
    body: JSON.stringify({ prompt: workflow, client_id: `plotpickle-sdxl-${randomUUID()}` }),
  });
  const promptId = typeof value.prompt_id === "string" ? value.prompt_id : "";
  if (!promptId) throw new Error("ComfyUI returned no prompt ID for the SDXL workflow.");
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
    const candidate = output.images?.[0];
    if (candidate?.filename) return candidate;
  }
  return null;
}

function executionError(entry: ComfyHistoryEntry | null) {
  if (!entry?.status || entry.status.status_str !== "error") return "";
  return JSON.stringify(entry.status.messages || []).slice(0, 700) || "The local SDXL workflow failed.";
}

async function downloadOutput(baseUrl: string, output: ComfyOutput) {
  const query = new URLSearchParams({ filename: output.filename, subfolder: output.subfolder || "", type: output.type || "output" });
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/view?${query.toString()}`, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error("ComfyUI finished SDXL but PlotPickle could not retrieve the image.");
  return Buffer.from(await response.arrayBuffer());
}

export async function generateSdxlImage(baseUrl: string, checkpoint: string, input: ImageGenerationInput) {
  const envelope = visualContinuityEnvelope(input);
  if (!envelope.prompt) throw new Error("Enter an image prompt before generating.");
  if (!checkpoint) throw new Error("Install or select an SDXL checkpoint before generating.");
  const references = await referenceImages(input);
  const primaryReference = references[0];
  const uploadedReference = primaryReference ? await uploadReference(baseUrl, primaryReference) : "";
  const workflow = uploadedReference
    ? referenceWorkflow(checkpoint, input, envelope.prompt, envelope.negativePrompt, uploadedReference)
    : textWorkflow(checkpoint, input, envelope.prompt, envelope.negativePrompt);
  const promptId = await submitWorkflow(baseUrl, workflow);
  const started = Date.now();
  while (Date.now() - started < IMAGE_TIMEOUT_MS) {
    const entry = await historyEntry(baseUrl, promptId);
    const error = executionError(entry);
    if (error) throw new Error(error);
    const output = firstOutput(entry);
    if (output) {
      const assetUrl = await saveGeneratedAsset(await downloadOutput(baseUrl, output), input.assetId || input.characterId || "sdxl-image", ".png");
      return {
        assetUrl,
        revisedPrompt: envelope.prompt,
        referenceImagesUsed: uploadedReference ? 1 : 0,
        referenceImagesAvailable: references.length,
        providerRequestId: promptId,
        continuity: {
          identityLocks: envelope.identityLockCount,
          wardrobeLookIds: envelope.wardrobeLookIds,
          compositionApplied: Boolean(envelope.composition),
          continuityRules: envelope.continuity.length,
          negativeConstraintsApplied: Boolean(envelope.negativePrompt),
        },
      };
    }
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  throw new Error("ComfyUI did not finish the local SDXL workflow before the four-minute timeout.");
}
