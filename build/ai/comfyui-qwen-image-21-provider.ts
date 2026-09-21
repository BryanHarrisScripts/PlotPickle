import { randomUUID } from "node:crypto";
import {
  referenceImages,
  saveGeneratedAsset,
  visualContinuityEnvelope,
  type ImageGenerationInput,
  type LocalReferenceImage,
} from "../media-provider-common";
import type { ComfyWorkflow } from "../media-routing-store";
import { workflowNodeClasses } from "./comfyui-media-provider";

const DEFAULT_BASE_URL = "http://127.0.0.1:8188";
const IMAGE_TIMEOUT_MS = 360_000;
const MAX_REFERENCES = 10;
const REQUIRED_GGUF_NODE = "UnetLoaderGGUF";

type ComfyOutput = { filename: string; subfolder?: string; type?: string };
type ComfyHistoryEntry = {
  outputs?: Record<string, { images?: ComfyOutput[] }>;
  status?: { status_str?: string; messages?: unknown[] };
};

function normalizeBaseUrl(value: string) {
  const url = new URL(value || DEFAULT_BASE_URL);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "8188") {
    throw new Error("Experimental Qwen-Image-2.1 is restricted to local ComfyUI at http://127.0.0.1:8188.");
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

async function uploadReference(baseUrl: string, reference: LocalReferenceImage, index: number) {
  const form = new FormData();
  const safeName = `plotpickle-qwen-reference-${index + 1}-${reference.fileName.replace(/[^A-Za-z0-9._-]+/g, "-")}`;
  form.set("image", new Blob([new Uint8Array(reference.bytes)], { type: reference.mimeType }), safeName);
  form.set("overwrite", "true");
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/upload/image`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error("ComfyUI could not accept an approved Qwen reference image.");
  const value = await response.json() as { name?: unknown; subfolder?: unknown };
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const subfolder = typeof value.subfolder === "string" ? value.subfolder.trim() : "";
  if (!name) throw new Error("ComfyUI uploaded a Qwen reference but returned no file name.");
  return subfolder ? `${subfolder}/${name}` : name;
}

function visitStrings(value: unknown, visitor: (value: string, key: string) => string, key = ""): unknown {
  if (typeof value === "string") return visitor(value, key);
  if (Array.isArray(value)) return value.map((item) => visitStrings(item, visitor, key));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, visitStrings(child, visitor, childKey)]));
}

export function validateQwenImage21Workflow(source: Record<string, unknown>) {
  const serialized = JSON.stringify(source);
  if (!serialized.includes("{{PLOTPICKLE_PROMPT}}")) {
    throw new Error("The Qwen-Image-2.1 ComfyUI workflow must contain {{PLOTPICKLE_PROMPT}}.");
  }
  if (/https?:\/\//i.test(serialized)) {
    throw new Error("The experimental Qwen workflow must not contain remote URLs. Keep model assets local to ComfyUI.");
  }
  const nodeClasses = workflowNodeClasses(source);
  if (!nodeClasses.includes(REQUIRED_GGUF_NODE)) {
    throw new Error(`The experimental Qwen workflow must use ${REQUIRED_GGUF_NODE} from ComfyUI-GGUF.`);
  }
  return nodeClasses;
}

function dimensions(input: ImageGenerationInput) {
  if (input.aspect === "portrait") return { width: 768, height: 1024 };
  if (input.aspect === "square") return { width: input.quality === "low" ? 768 : 1024, height: input.quality === "low" ? 768 : 1024 };
  return { width: 1024, height: 768 };
}

function hydrateWorkflow(
  source: Record<string, unknown>,
  input: ImageGenerationInput,
  prompt: string,
  negativePrompt: string,
  references: readonly string[],
) {
  const size = dimensions(input);
  return visitStrings(source, (value) => {
    let next = value
      .replaceAll("{{PLOTPICKLE_PROMPT}}", prompt)
      .replaceAll("{{PLOTPICKLE_NEGATIVE}}", negativePrompt)
      .replaceAll("{{PLOTPICKLE_WIDTH}}", String(size.width))
      .replaceAll("{{PLOTPICKLE_HEIGHT}}", String(size.height));
    for (let index = 0; index < MAX_REFERENCES; index += 1) {
      next = next.replaceAll(`{{PLOTPICKLE_REFERENCE_${index + 1}}}`, references[index] || "");
    }
    return next;
  }) as Record<string, unknown>;
}

async function submitWorkflow(baseUrl: string, workflow: Record<string, unknown>) {
  const value = await comfyJson(baseUrl, "/prompt", {
    method: "POST",
    body: JSON.stringify({ prompt: workflow, client_id: `plotpickle-qwen-image-21-${randomUUID()}` }),
  });
  const promptId = typeof value.prompt_id === "string" ? value.prompt_id : "";
  if (!promptId) throw new Error("ComfyUI returned no prompt ID for the Qwen-Image-2.1 workflow.");
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
  return JSON.stringify(entry.status.messages || []).slice(0, 900) || "The experimental Qwen workflow failed.";
}

async function downloadOutput(baseUrl: string, output: ComfyOutput) {
  const query = new URLSearchParams({ filename: output.filename, subfolder: output.subfolder || "", type: output.type || "output" });
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/view?${query.toString()}`, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error("ComfyUI finished Qwen-Image-2.1 but PlotPickle could not retrieve the image.");
  return Buffer.from(await response.arrayBuffer());
}

export async function generateQwenImage21(
  baseUrl: string,
  workflow: ComfyWorkflow,
  input: ImageGenerationInput,
) {
  if (typeof input.requestCount === "number" && input.requestCount !== 1) {
    throw new Error("Experimental Qwen-Image-2.1 is limited to one image per request.");
  }
  const envelope = visualContinuityEnvelope(input);
  if (!envelope.prompt) throw new Error("Enter an image prompt before generating.");
  validateQwenImage21Workflow(workflow.source);

  const approvedReferences = (await referenceImages(input)).slice(0, MAX_REFERENCES);
  const uploadedReferences: string[] = [];
  for (let index = 0; index < approvedReferences.length; index += 1) {
    uploadedReferences.push(await uploadReference(baseUrl, approvedReferences[index], index));
  }

  const hydrated = hydrateWorkflow(workflow.source, input, envelope.prompt, envelope.negativePrompt, uploadedReferences);
  const started = Date.now();
  const promptId = await submitWorkflow(baseUrl, hydrated);
  while (Date.now() - started < IMAGE_TIMEOUT_MS) {
    const entry = await historyEntry(baseUrl, promptId);
    const error = executionError(entry);
    if (error) throw new Error(error);
    const output = firstOutput(entry);
    if (output) {
      const assetUrl = await saveGeneratedAsset(
        await downloadOutput(baseUrl, output),
        input.assetId || input.characterId || "qwen-image-21",
        ".png",
      );
      return {
        assetUrl,
        revisedPrompt: envelope.prompt,
        referenceImagesUsed: uploadedReferences.length,
        referenceImagesAvailable: approvedReferences.length,
        providerRequestId: promptId,
        localProfile: "Qwen-Image-2.1 Experimental",
        renderDurationMs: Date.now() - started,
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
  throw new Error("ComfyUI did not finish the experimental Qwen-Image-2.1 workflow before the six-minute timeout.");
}
