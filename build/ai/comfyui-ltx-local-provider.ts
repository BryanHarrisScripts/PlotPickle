import { bundledLtxManifest, LTX_DEFAULT_PRESET, LTX_MIN_COMFY_VERSION } from "./comfyui-ltx-default";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { persistentHome, readCredentialJson, writeCredentialJson } from "../local-credentials";
import {
  saveGeneratedAsset,
  safeAssetStem,
  type VideoGenerationInput,
} from "../media-provider-common";

const STORE_FILE = "ltx-video-local.json";
const JOB_FILE = "ltx-video-jobs.json";
const DEFAULT_BASE_URL = "http://127.0.0.1:8188";
const REQUEST_TIMEOUT_MS = 8_000;
const VIDEO_TIMEOUT_MS = 30 * 60_000;
const UNSAFE_NODE_PATTERN = /(api|authorization|download|git|http|install|python|shell|subprocess|execute)/i;

export type LtxManifest = {
  schemaVersion: 1;
  model: "LTX-Video-2B-0.9.8-Distilled";
  workflow: Record<string, unknown>;
  requiredModelNames: string[];
  source: string;
};

export type LtxStore = {
  version: 1;
  baseUrl: string;
  enabled: boolean;
  manifest: LtxManifest | null;
  manifestHash: string;
  configuredAt: string;
  verifiedAt: string;
  lastError: string;
};

export type LtxJob = {
  id: string;
  promptId: string;
  route: "ltx-video-2b-comfyui";
  model: "LTX-Video 2B 0.9.8 Distilled";
  status: "queued" | "running" | "succeeded" | "failed" | "expired";
  prompt: string;
  assetId: string;
  outputAssetUrl: string;
  error: string;
  createdAt: string;
  updatedAt: string;
};

type ComfyOutput = { filename: string; subfolder?: string; type?: string };
type ComfyHistoryEntry = {
  outputs?: Record<string, { images?: ComfyOutput[]; gifs?: ComfyOutput[]; videos?: ComfyOutput[] }>;
  status?: { status_str?: string; messages?: unknown[] };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function clean(value: unknown, maximum = 500) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function normalizeBaseUrl(value: string) {
  const url = new URL(value || DEFAULT_BASE_URL);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "8188") {
    throw new Error("LTX-Video is restricted to the local ComfyUI address http://127.0.0.1:8188.");
  }
  if (url.username || url.password || (url.pathname && url.pathname !== "/")) throw new Error("Enter only the local ComfyUI address.");
  return DEFAULT_BASE_URL;
}

function nodeClasses(workflow: Record<string, unknown>) {
  return [...new Set(Object.values(workflow).flatMap((value) => {
    if (!isRecord(value)) return [];
    const classType = clean(value.class_type, 160);
    return classType ? [classType] : [];
  }))].sort();
}

function manifestHash(manifest: LtxManifest) {
  return createHash("sha256").update(JSON.stringify(manifest)).digest("hex");
}

export function validateLtxManifest(value: unknown): LtxManifest {
  if (!isRecord(value)) throw new Error("Paste a ComfyUI API-format LTX-Video manifest.");
  if (value.schemaVersion !== 1 || value.model !== "LTX-Video-2B-0.9.8-Distilled") {
    throw new Error("The local video manifest must use schemaVersion 1 and LTX-Video-2B-0.9.8-Distilled.");
  }
  if (!isRecord(value.workflow)) throw new Error("The LTX manifest must contain an API-format ComfyUI workflow object.");
  const serialized = JSON.stringify(value.workflow);
  if (!serialized.includes("{{PLOTPICKLE_PROMPT}}")) throw new Error("The LTX workflow must contain {{PLOTPICKLE_PROMPT}}.");
  if (/api.?key|authorization|bearer\s+/i.test(serialized)) throw new Error("Local LTX workflows must not contain API keys or authorization fields.");
  const classes = nodeClasses(value.workflow);
  if (!classes.length) throw new Error("The LTX workflow contains no API-format class_type nodes.");
  const unsafe = classes.find((name) => UNSAFE_NODE_PATTERN.test(name));
  if (unsafe) throw new Error(`The LTX workflow contains a network, installer or code-execution node: ${unsafe}.`);
  const requiredModelNames = Array.isArray(value.requiredModelNames)
    ? value.requiredModelNames.map((item) => clean(item, 240)).filter(Boolean).slice(0, 24)
    : [];
  if (!requiredModelNames.some((name) => /ltx/i.test(name))) throw new Error("List the installed LTX-Video 2B model file in requiredModelNames.");
  return {
    schemaVersion: 1,
    model: "LTX-Video-2B-0.9.8-Distilled",
    workflow: value.workflow,
    requiredModelNames,
    source: clean(value.source, 1_000),
  };
}

function emptyStore(): LtxStore {
  return {
    version: 1,
    baseUrl: DEFAULT_BASE_URL,
    enabled: true,
    manifest: null,
    manifestHash: "",
    configuredAt: "",
    verifiedAt: "",
    lastError: "",
  };
}

export async function readLtxStore(): Promise<LtxStore> {
  const stored = await readCredentialJson<unknown>(STORE_FILE);
  if (!isRecord(stored)) return emptyStore();
  let manifest: LtxManifest | null = null;
  try { if (stored.manifest) manifest = validateLtxManifest(stored.manifest); } catch { manifest = null; }
  return {
    version: 1,
    baseUrl: normalizeBaseUrl(clean(stored.baseUrl) || DEFAULT_BASE_URL),
    enabled: stored.enabled !== false,
    manifest,
    manifestHash: manifest ? manifestHash(manifest) : "",
    configuredAt: clean(stored.configuredAt, 80),
    verifiedAt: clean(stored.verifiedAt, 80),
    lastError: clean(stored.lastError, 500),
  };
}

let ltxWrites: Promise<void> = Promise.resolve();

function updateLtxStore(update: (store: LtxStore) => LtxStore | null): Promise<LtxStore> {
  const pending = ltxWrites.then(async () => {
    const current = await readLtxStore();
    const next = update(current);
    if (next) await writeCredentialJson(STORE_FILE, next);
    return next || current;
  });
  ltxWrites = pending.then(() => {}, () => {});
  return pending;
}

export async function configureLtxManifest(value: unknown) {
  const manifest = validateLtxManifest(value);
  return updateLtxStore((store) => ({
    ...store, manifest, manifestHash: manifestHash(manifest),
    configuredAt: new Date().toISOString(), verifiedAt: "", lastError: "",
  }));
}

/** Idempotent first-run setup; serialized with imports and verification writes. */
export async function ensureLtxDefault(): Promise<LtxStore> {
  return updateLtxStore((store) => {
    if (store.manifest) return null;
    const manifest = validateLtxManifest(bundledLtxManifest());
    return { ...store, manifest, manifestHash: manifestHash(manifest),
      configuredAt: new Date().toISOString(), verifiedAt: "", lastError: "" };
  });
}

async function comfyJson(baseUrl: string, pathname: string, init?: RequestInit, timeout = REQUEST_TIMEOUT_MS) {
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${pathname}`, {
    ...init,
    headers: { Accept: "application/json", ...(init?.body ? { "Content-Type": "application/json" } : {}), ...init?.headers },
    signal: AbortSignal.timeout(timeout),
  });
  const text = await response.text();
  let value: unknown = {};
  try { value = text ? JSON.parse(text) : {}; } catch { value = {}; }
  if (!response.ok) throw new Error(`ComfyUI returned HTTP ${response.status}.`);
  if (!isRecord(value)) throw new Error("ComfyUI returned an invalid JSON response.");
  return value;
}

async function comfyObjectInfo(baseUrl: string) {
  return comfyJson(baseUrl, "/object_info", undefined, 15_000);
}

function modelNamesFromObjectInfo(value: unknown): string[] {
  const names = new Set<string>();
  const visit = (item: unknown) => {
    if (typeof item === "string" && /\.(?:safetensors|gguf|ckpt|pt|pth)$/i.test(item)) names.add(item);
    else if (Array.isArray(item)) item.forEach(visit);
    else if (isRecord(item)) Object.values(item).forEach(visit);
  };
  visit(value);
  return [...names];
}

export async function probeLtxVideo(store?: LtxStore) {
  store ??= await ensureLtxDefault();
  try {
    const [system, objectInfo] = await Promise.all([
      comfyJson(store.baseUrl, "/system_stats"),
      comfyObjectInfo(store.baseUrl),
    ]);
    const classes = store.manifest ? nodeClasses(store.manifest.workflow) : [];
    const availableClasses = new Set(Object.keys(objectInfo));
    const missingNodes = classes.filter((name) => !availableClasses.has(name));
    const availableModels = modelNamesFromObjectInfo(objectInfo);
    const missingModels = store.manifest
      ? store.manifest.requiredModelNames.filter((required) => {
        const loaders = Object.values(store.manifest!.workflow).filter((node) =>
          isRecord(node) && isRecord(node.inputs) && Object.values(node.inputs).includes(required));
        if (!loaders.length) return !availableModels.includes(required);
        return loaders.some((node) => {
          if (!isRecord(node) || !isRecord(node.inputs)) return true;
          const info = objectInfo[clean(node.class_type)];
          if (!isRecord(info) || !isRecord(info.input)) return true;
          const slots = { ...(isRecord(info.input.required) ? info.input.required : {}), ...(isRecord(info.input.optional) ? info.input.optional : {}) };
          return Object.entries(node.inputs).some(([key, value]) => value === required && !modelNamesFromObjectInfo(slots[key]).includes(required));
        });
      })
      : [];
    const version = isRecord(system.system) ? clean(system.system.comfyui_version, 80) : "";
    const parts = version.replace(/^v/, "").match(/^(\d+)\.(\d+)\.(\d+)/);
    const versionTooOld = Boolean(parts && Number(parts[1]) === 0 && (Number(parts[2]) < 3 || (Number(parts[2]) === 3 && Number(parts[3]) < 50)));
    const blockers = [
      ...(!store.enabled ? ["LTX ENGINE DISABLED"] : []),
      ...(!store.manifest ? ["LTX WORKFLOW NOT CONFIGURED"] : []),
      ...(versionTooOld ? [`COMFYUI VERSION TOO OLD: ${version}; requires ${LTX_MIN_COMFY_VERSION} or newer`] : []),
      ...missingNodes.map((name) => `MISSING NODE: ${name}`),
      ...missingModels.map((name) => `MISSING MODEL: ${name}`),
    ];
    return {
      reachable: true,
      blockers,
      supportedModes: ["text-to-video"],
      defaultPreset: LTX_DEFAULT_PRESET,
      version,
      manifestConfigured: Boolean(store.manifest),
      missingNodes,
      missingModels,
      ready: blockers.length === 0,
      model: "LTX-Video 2B 0.9.8 Distilled",
      error: blockers.join("; "),
    };
  } catch (error) {
    return {
      reachable: false,
      blockers: ["COMFYUI SERVICE NOT READY"],
      supportedModes: ["text-to-video"],
      defaultPreset: LTX_DEFAULT_PRESET,
      version: "",
      manifestConfigured: Boolean(store.manifest),
      missingNodes: store.manifest ? nodeClasses(store.manifest.workflow) : [],
      missingModels: store.manifest?.requiredModelNames ?? [],
      ready: false,
      model: "LTX-Video 2B 0.9.8 Distilled",
      error: `COMFYUI SERVICE NOT READY: ${error instanceof Error ? error.message : "ComfyUI could not be checked."}`,
    };
  }
}

function visitStrings(value: unknown, visitor: (value: string) => string | number): unknown {
  if (typeof value === "string") return visitor(value);
  if (Array.isArray(value)) return value.map((item) => visitStrings(item, visitor));
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([key, child]) => [key, visitStrings(child, visitor)]));
}

export function hydratedLtxWorkflow(store: LtxStore, input: VideoGenerationInput, prompt: string) {
  if (!store.manifest) throw new Error("LTX WORKFLOW NOT CONFIGURED");
  if (input.sourceAssetUrl) throw new Error("The selected local video engine supports text-to-video only.");
  const seed = Math.floor(Math.random() * 2_147_483_647);
  const values: Record<string, string | number> = {
    "{{PLOTPICKLE_PROMPT}}": prompt,
    "{{PLOTPICKLE_WIDTH}}": LTX_DEFAULT_PRESET.width,
    "{{PLOTPICKLE_HEIGHT}}": LTX_DEFAULT_PRESET.height,
    "{{PLOTPICKLE_FRAMES}}": LTX_DEFAULT_PRESET.frames,
    "{{PLOTPICKLE_SEED}}": seed,
  };
  return visitStrings(store.manifest.workflow, (value) => {
    if (Object.hasOwn(values, value)) return values[value];
    return value.replaceAll("{{PLOTPICKLE_PROMPT}}", prompt);
  }) as Record<string, unknown>;
}

async function submitWorkflow(store: LtxStore, workflow: Record<string, unknown>) {
  const value = await comfyJson(store.baseUrl, "/prompt", {
    method: "POST",
    body: JSON.stringify({ prompt: workflow, client_id: `plotpickle-ltx-${randomUUID()}` }),
  });
  const promptId = clean(value.prompt_id, 160);
  if (!promptId) throw new Error("ComfyUI returned no prompt ID for the LTX workflow.");
  return promptId;
}

function jobsPath() {
  return path.join(persistentHome(), JOB_FILE);
}

async function readJobs(): Promise<LtxJob[]> {
  try {
    const value = JSON.parse(await readFile(jobsPath(), "utf8")) as unknown;
    return Array.isArray(value) ? value.filter((item): item is LtxJob => Boolean(item && typeof item === "object" && typeof (item as LtxJob).id === "string")) : [];
  } catch { return []; }
}

async function saveJob(job: LtxJob) {
  const jobs = await readJobs();
  await mkdir(persistentHome(), { recursive: true, mode: 0o700 });
  await writeFile(jobsPath(), `${JSON.stringify([job, ...jobs.filter((item) => item.id !== job.id)].slice(0, 200), null, 2)}\n`, { mode: 0o600 });
  return job;
}

async function historyEntry(baseUrl: string, promptId: string) {
  const value = await comfyJson(baseUrl, `/history/${encodeURIComponent(promptId)}`);
  const entry = value[promptId];
  return isRecord(entry) ? entry as ComfyHistoryEntry : null;
}

export function firstLtxVideoOutput(entry: ComfyHistoryEntry | null) {
  if (!entry?.outputs) return null;
  for (const output of Object.values(entry.outputs)) {
    const candidate = [...(output.videos || []), ...(output.gifs || []), ...(output.images || [])]
      .find((item) => /\.(mp4|webm)$/i.test(item.filename));
    if (candidate?.filename) return candidate;
  }
  return null;
}

function executionError(entry: ComfyHistoryEntry | null) {
  if (!entry?.status || entry.status.status_str !== "error") return "";
  return JSON.stringify(entry.status.messages || []).slice(0, 500) || "The LTX ComfyUI workflow failed.";
}

async function downloadOutput(baseUrl: string, output: ComfyOutput) {
  const query = new URLSearchParams({ filename: output.filename, subfolder: output.subfolder || "", type: output.type || "output" });
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/view?${query.toString()}`, { signal: AbortSignal.timeout(120_000) });
  if (!response.ok) throw new Error("ComfyUI finished LTX-Video but PlotPickle could not retrieve the output.");
  return Buffer.from(await response.arrayBuffer());
}

async function runJob(job: LtxJob, store: LtxStore) {
  job.status = "running";
  job.updatedAt = new Date().toISOString();
  await saveJob(job);
  try {
    const started = Date.now();
    while (Date.now() - started < VIDEO_TIMEOUT_MS) {
      const entry = await historyEntry(store.baseUrl, job.promptId);
      const error = executionError(entry);
      if (error) throw new Error(error);
      const output = firstLtxVideoOutput(entry);
      if (output) {
        const extension = output.filename.toLowerCase().endsWith(".webm") ? ".webm" : ".mp4";
        job.outputAssetUrl = await saveGeneratedAsset(await downloadOutput(store.baseUrl, output), job.assetId, extension);
        job.status = "succeeded";
        job.updatedAt = new Date().toISOString();
        await updateLtxStore((current) => current.manifestHash === store.manifestHash
          ? { ...current, verifiedAt: job.updatedAt, lastError: "" } : null);
        await saveJob(job);
        return;
      }
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    throw new Error("LTX-Video did not finish before the 30-minute local workflow timeout.");
  } catch (error) {
    job.status = "failed";
    job.error = error instanceof Error ? error.message : "The local LTX-Video job failed.";
    job.updatedAt = new Date().toISOString();
    await saveJob(job);
    await updateLtxStore((current) => current.manifestHash === store.manifestHash
      ? { ...current, verifiedAt: "", lastError: job.error } : null);
  }
}

export async function createLtxVideo(input: VideoGenerationInput) {
  const store = await ensureLtxDefault();
  const probe = await probeLtxVideo(store);
  if (!probe.ready) throw new Error(probe.error || `LTX-Video is not ready. Missing nodes: ${probe.missingNodes.join(", ")}; missing models: ${probe.missingModels.join(", ")}`);
  const prompt = clean(input.prompt, 12_000);
  if (!prompt) throw new Error("Enter a video prompt before generating.");
  const workflow = hydratedLtxWorkflow(store, input, prompt);
  const promptId = await submitWorkflow(store, workflow);
  const now = new Date().toISOString();
  const job: LtxJob = {
    id: `ltx-${randomUUID()}`,
    promptId,
    route: "ltx-video-2b-comfyui",
    model: "LTX-Video 2B 0.9.8 Distilled",
    status: "queued",
    prompt,
    assetId: safeAssetStem(input.assetId || "ltx-video"),
    outputAssetUrl: "",
    error: "",
    createdAt: now,
    updatedAt: now,
  };
  await saveJob(job);
  void runJob(job, store);
  return job;
}

export async function getLtxVideoJob(id: string) {
  const job = (await readJobs()).find((item) => item.id === id);
  if (!job) throw new Error("The local LTX-Video job was not found.");
  return job;
}
