import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readCredentialJson, writeCredentialJson } from "./local-credentials";
import {
  ASSET_PATH,
  assetsDirectory,
  safeAssetStem,
  saveGeneratedAsset,
  type VideoGenerationInput,
} from "./media-provider-common";

const STORE_FILE = "h3-native-routing.json";
const JOBS_FILE = "h3-native-jobs.json";
const DEFAULT_BASE_URL = "http://127.0.0.1:8188";
const REQUEST_TIMEOUT_MS = 8_000;
const VIDEO_TIMEOUT_MS = 30 * 60_000;
const OFFICIAL_SOURCE_PREFIXES = [
  "https://www.minimax.io/",
  "https://minimax.io/",
  "https://github.com/MiniMax-AI/",
  "https://raw.githubusercontent.com/MiniMax-AI/",
  "https://huggingface.co/MiniMaxAI/",
  "https://github.com/Comfy-Org/ComfyUI/",
  "https://docs.comfy.org/",
] as const;
const SAFE_MODEL_DIRECTORIES = new Set([
  "checkpoints",
  "clip",
  "diffusion_models",
  "loras",
  "text_encoders",
  "vae",
  "vae_approx",
]);
const UNSAFE_NODE_PATTERN = /(api|authorization|download|git|http|install|python|shell|subprocess|execute)/i;

export type H3WorkflowFamily =
  | "text-to-video"
  | "image-to-video"
  | "first-last-frame"
  | "reference-to-video"
  | "in-place-edit";

export type H3ModelRequirement = {
  id: string;
  label: string;
  directory: string;
  loaderNode: string;
  inputName: string;
  filenames: string[];
};

export type H3NativeManifest = {
  schemaVersion: 1;
  model: "MiniMax-H3";
  workflowFamily: H3WorkflowFamily;
  officialSource: string;
  minimumComfyUIVersion: string;
  workflow: Record<string, unknown>;
  requiredModels: H3ModelRequirement[];
};

export type H3NativeStore = {
  version: 1;
  baseUrl: string;
  active: boolean;
  allowConstrainedVram: boolean;
  manifest: H3NativeManifest | null;
  manifestHash: string;
  configuredAt: string;
  verifiedAt: string;
  lastError: string;
};

export type H3NativeJob = {
  id: string;
  promptId: string;
  route: "minimax-h3-native";
  model: "MiniMax-H3";
  family: H3WorkflowFamily;
  status: "queued" | "running" | "succeeded" | "failed" | "expired";
  prompt: string;
  assetId: string;
  outputAssetUrl: string;
  error: string;
  createdAt: string;
  updatedAt: string;
};

export type H3NativeInput = VideoGenerationInput & {
  firstFrameAssetUrl?: unknown;
  lastFrameAssetUrl?: unknown;
  referenceAssetUrl?: unknown;
  sourceVideoAssetUrl?: unknown;
  performanceAcknowledged?: unknown;
};

type ComfyOutput = { filename: string; subfolder?: string; type?: string };
type ComfyHistoryEntry = {
  outputs?: Record<string, { images?: ComfyOutput[]; gifs?: ComfyOutput[]; videos?: ComfyOutput[] }>;
  status?: { status_str?: string; messages?: unknown[] };
};

function emptyStore(): H3NativeStore {
  return {
    version: 1,
    baseUrl: DEFAULT_BASE_URL,
    active: false,
    allowConstrainedVram: false,
    manifest: null,
    manifestHash: "",
    configuredAt: "",
    verifiedAt: "",
    lastError: "",
  };
}

function normalizeBaseUrl(value: string) {
  const url = new URL(value || DEFAULT_BASE_URL);
  if (url.protocol !== "http:" || !["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "8188") {
    throw new Error("Native H3 is restricted to the local ComfyUI address http://127.0.0.1:8188.");
  }
  if (url.username || url.password || (url.pathname && url.pathname !== "/")) {
    throw new Error("Enter only the local ComfyUI server address, without credentials or a path.");
  }
  return DEFAULT_BASE_URL;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function cleanString(value: unknown, maximum = 500) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function manifestHash(value: H3NativeManifest) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function officialSource(value: string) {
  return OFFICIAL_SOURCE_PREFIXES.some((prefix) => value.startsWith(prefix));
}

function workflowNodeClasses(source: Record<string, unknown>) {
  return Array.from(new Set(Object.values(source).flatMap((value) => {
    if (!isRecord(value)) return [];
    const classType = cleanString(value.class_type, 160);
    return classType ? [classType] : [];
  }))).sort();
}

function visitStrings(value: unknown, visitor: (value: string, key: string) => string, key = ""): unknown {
  if (typeof value === "string") return visitor(value, key);
  if (Array.isArray(value)) return value.map((item) => visitStrings(item, visitor, key));
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.entries(value).map(([childKey, child]) => [childKey, visitStrings(child, visitor, childKey)]));
}

function requiredTokens(family: H3WorkflowFamily) {
  const shared = ["{{PLOTPICKLE_PROMPT}}"];
  if (family === "image-to-video") return [...shared, "{{PLOTPICKLE_SOURCE_IMAGE}}"];
  if (family === "first-last-frame") return [...shared, "{{PLOTPICKLE_FIRST_FRAME}}", "{{PLOTPICKLE_LAST_FRAME}}"];
  if (family === "reference-to-video") return [...shared, "{{PLOTPICKLE_REFERENCE_ASSET}}"];
  if (family === "in-place-edit") return [...shared, "{{PLOTPICKLE_SOURCE_VIDEO}}"];
  return shared;
}

export function validateNativeH3Manifest(value: unknown): H3NativeManifest {
  if (!isRecord(value)) throw new Error("Paste an official MiniMax H3 native manifest JSON object.");
  if (value.schemaVersion !== 1 || value.model !== "MiniMax-H3") throw new Error("The manifest must use schemaVersion 1 and model MiniMax-H3.");
  const family = cleanString(value.workflowFamily) as H3WorkflowFamily;
  if (!["text-to-video", "image-to-video", "first-last-frame", "reference-to-video", "in-place-edit"].includes(family)) {
    throw new Error("Choose a supported official H3 workflow family.");
  }
  const source = cleanString(value.officialSource, 1_000);
  if (!officialSource(source)) throw new Error("The H3 manifest must cite an official MiniMax or ComfyUI source.");
  const minimumComfyUIVersion = cleanString(value.minimumComfyUIVersion, 40);
  if (!/^\d+\.\d+\.\d+(?:[-+][a-z0-9.-]+)?$/i.test(minimumComfyUIVersion)) {
    throw new Error("The manifest must declare a semantic minimum ComfyUI version.");
  }
  if (!isRecord(value.workflow)) throw new Error("The manifest must contain an API-format ComfyUI workflow object.");
  const serialized = JSON.stringify(value.workflow);
  for (const token of requiredTokens(family)) {
    if (!serialized.includes(token)) throw new Error(`The ${family} workflow must contain ${token}.`);
  }
  if (/PLOTPICKLE_MINIMAX_KEY|api.?key|authorization|bearer\s+/i.test(serialized)) {
    throw new Error("Native H3 workflows must not contain a cloud API key or authorization field.");
  }
  const nodes = workflowNodeClasses(value.workflow);
  if (!nodes.length) throw new Error("The native H3 workflow contains no API-format class_type nodes.");
  const unsafeNode = nodes.find((node) => UNSAFE_NODE_PATTERN.test(node));
  if (unsafeNode) throw new Error(`The workflow contains a network, installer or code-execution node: ${unsafeNode}.`);
  const rawRequirements = Array.isArray(value.requiredModels) ? value.requiredModels : [];
  if (!rawRequirements.length || rawRequirements.length > 24) throw new Error("List the user-owned model files required by the official workflow.");
  const requiredModels = rawRequirements.map((item, index): H3ModelRequirement => {
    if (!isRecord(item)) throw new Error(`Model requirement ${index + 1} is invalid.`);
    const directory = cleanString(item.directory, 80);
    const loaderNode = cleanString(item.loaderNode, 160);
    const inputName = cleanString(item.inputName, 120);
    const filenames = Array.isArray(item.filenames)
      ? item.filenames.map((name) => cleanString(name, 240)).filter(Boolean)
      : [];
    if (!SAFE_MODEL_DIRECTORIES.has(directory)) throw new Error(`Unsupported ComfyUI model directory: ${directory}.`);
    if (!loaderNode || UNSAFE_NODE_PATTERN.test(loaderNode) || !inputName || !filenames.length || filenames.length > 12) {
      throw new Error(`Model requirement ${index + 1} must name a safe loader input and expected file.`);
    }
    return {
      id: cleanString(item.id, 80) || `model-${index + 1}`,
      label: cleanString(item.label, 160) || filenames[0],
      directory,
      loaderNode,
      inputName,
      filenames,
    };
  });
  return {
    schemaVersion: 1,
    model: "MiniMax-H3",
    workflowFamily: family,
    officialSource: source,
    minimumComfyUIVersion,
    workflow: value.workflow,
    requiredModels,
  };
}

export async function readNativeH3Store() {
  const stored = await readCredentialJson<unknown>(STORE_FILE);
  if (!isRecord(stored)) return emptyStore();
  let manifest: H3NativeManifest | null = null;
  try { if (stored.manifest) manifest = validateNativeH3Manifest(stored.manifest); } catch { manifest = null; }
  const next: H3NativeStore = {
    version: 1,
    baseUrl: normalizeBaseUrl(cleanString(stored.baseUrl) || DEFAULT_BASE_URL),
    active: stored.active === true,
    allowConstrainedVram: stored.allowConstrainedVram === true,
    manifest,
    manifestHash: manifest ? manifestHash(manifest) : "",
    configuredAt: cleanString(stored.configuredAt, 80),
    verifiedAt: cleanString(stored.verifiedAt, 80),
    lastError: cleanString(stored.lastError, 500),
  };
  if (!manifest) next.active = false;
  return next;
}

export async function writeNativeH3Store(value: H3NativeStore) {
  await writeCredentialJson(STORE_FILE, value);
}

export async function configureNativeH3Manifest(value: unknown) {
  const manifest = validateNativeH3Manifest(value);
  const state = await readNativeH3Store();
  state.manifest = manifest;
  state.manifestHash = manifestHash(manifest);
  state.configuredAt = new Date().toISOString();
  state.verifiedAt = "";
  state.lastError = "";
  state.active = false;
  await writeNativeH3Store(state);
  return state;
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
  if (!isRecord(value)) throw new Error("ComfyUI returned an invalid JSON response.");
  return value;
}

function versionParts(value: string) {
  return value.split(/[.+-]/, 3).map((part) => Number.parseInt(part, 10) || 0);
}

export function versionAtLeast(current: string, minimum: string) {
  const left = versionParts(current);
  const right = versionParts(minimum);
  for (let index = 0; index < 3; index += 1) {
    if (left[index] > right[index]) return true;
    if (left[index] < right[index]) return false;
  }
  return true;
}

function modelOptions(info: Record<string, unknown>, requirement: H3ModelRequirement) {
  const node = info[requirement.loaderNode];
  if (!isRecord(node) || !isRecord(node.input) || !isRecord(node.input.required)) return [];
  const input = node.input.required[requirement.inputName];
  if (!Array.isArray(input) || !Array.isArray(input[0])) return [];
  return input[0].filter((item): item is string => typeof item === "string");
}

function vramProfile(bytes: number) {
  const gib = bytes / (1024 ** 3);
  if (gib >= 24) return { id: "recommended", warning: "Local H3 has substantial VRAM headroom, subject to the official workflow requirements." };
  if (gib >= 16) return { id: "supported", warning: "Local H3 may be practical with the official workflow, model quantization and conservative settings." };
  if (gib >= 12) return { id: "limited", warning: "Use conservative resolution, frame count and offloading. Generation may be slow." };
  if (gib >= 8) return { id: "constrained", warning: "8 GB VRAM is experimental and may be impractical. PlotPickle does not promise 2K, 15 seconds or usable speed." };
  return { id: "impractical", warning: "Less than 8 GB VRAM is blocked for native H3 because successful generation is not reasonably expected." };
}

export async function probeNativeH3(state: H3NativeStore) {
  const manifest = state.manifest;
  try {
    const system = await comfyJson(state.baseUrl, "/system_stats");
    const systemInfo = isRecord(system.system) ? system.system : {};
    const version = cleanString(systemInfo.comfyui_version, 80);
    const devices = Array.isArray(system.devices) ? system.devices.filter(isRecord) : [];
    const vramBytes = Math.max(0, ...devices.map((device) => Number(device.vram_total || device.torch_vram_total || 0)));
    const profile = vramProfile(vramBytes);
    if (!manifest) {
      return {
        reachable: true,
        version,
        manifestConfigured: false,
        compatibleVersion: false,
        workflowFamily: "",
        officialSource: "",
        nodeClasses: [],
        missingNodes: [],
        modelRequirements: [],
        modelsReady: false,
        vramBytes,
        vramGiB: Math.round((vramBytes / (1024 ** 3)) * 10) / 10,
        vramProfile: profile.id,
        vramWarning: profile.warning,
        ready: false,
        error: "Official MiniMax H3 weights and a compatible ComfyUI workflow manifest have not been configured.",
      };
    }
    const nodeClasses = workflowNodeClasses(manifest.workflow);
    const nodeChecks = await Promise.all(nodeClasses.map(async (name) => {
      try { return (await comfyJson(state.baseUrl, `/object_info/${encodeURIComponent(name)}`))[name] ? "" : name; }
      catch { return name; }
    }));
    const missingNodes = nodeChecks.filter(Boolean);
    const modelRequirements = await Promise.all(manifest.requiredModels.map(async (requirement) => {
      try {
        const info = await comfyJson(state.baseUrl, `/object_info/${encodeURIComponent(requirement.loaderNode)}`);
        const available = modelOptions(info, requirement);
        const found = requirement.filenames.find((name) => available.includes(name)) || "";
        return { ...requirement, found, ready: Boolean(found) };
      } catch {
        return { ...requirement, found: "", ready: false };
      }
    }));
    const compatibleVersion = Boolean(version && versionAtLeast(version, manifest.minimumComfyUIVersion));
    const modelsReady = modelRequirements.every((item) => item.ready);
    const vramAllowed = profile.id !== "impractical" && (profile.id !== "constrained" || state.allowConstrainedVram);
    const ready = compatibleVersion && missingNodes.length === 0 && modelsReady && vramAllowed;
    return {
      reachable: true,
      version,
      manifestConfigured: true,
      manifestHash: state.manifestHash,
      minimumComfyUIVersion: manifest.minimumComfyUIVersion,
      compatibleVersion,
      workflowFamily: manifest.workflowFamily,
      officialSource: manifest.officialSource,
      nodeClasses,
      missingNodes,
      modelRequirements,
      modelsReady,
      vramBytes,
      vramGiB: Math.round((vramBytes / (1024 ** 3)) * 10) / 10,
      vramProfile: profile.id,
      vramWarning: profile.warning,
      ready,
      error: ready ? "" : "Complete every native H3 prerequisite before activation.",
    };
  } catch (error) {
    return {
      reachable: false,
      version: "",
      manifestConfigured: Boolean(manifest),
      compatibleVersion: false,
      workflowFamily: manifest?.workflowFamily || "",
      officialSource: manifest?.officialSource || "",
      nodeClasses: manifest ? workflowNodeClasses(manifest.workflow) : [],
      missingNodes: manifest ? workflowNodeClasses(manifest.workflow) : [],
      modelRequirements: manifest?.requiredModels.map((item) => ({ ...item, found: "", ready: false })) || [],
      modelsReady: false,
      vramBytes: 0,
      vramGiB: 0,
      vramProfile: "unknown",
      vramWarning: "ComfyUI must be running locally before PlotPickle can inspect GPU and model readiness.",
      ready: false,
      error: error instanceof Error ? error.message : "ComfyUI could not be checked.",
    };
  }
}

function localAssetFile(value: unknown, allowed: RegExp) {
  const source = cleanString(value, 2_000);
  if (!source.startsWith(ASSET_PATH)) throw new Error("Native H3 reference media must be a saved PlotPickle asset.");
  const fileName = source.slice(ASSET_PATH.length);
  if (!allowed.test(fileName)) throw new Error("The selected PlotPickle asset type is not supported by this H3 workflow family.");
  return fileName;
}

async function uploadAsset(baseUrl: string, value: unknown, kind: "image" | "video") {
  const allowed = kind === "image" ? /^[a-z0-9][a-z0-9._-]*\.(png|jpe?g|webp)$/i : /^[a-z0-9][a-z0-9._-]*\.(mp4|webm)$/i;
  const fileName = localAssetFile(value, allowed);
  const bytes = await readFile(path.join(assetsDirectory(), fileName));
  const endpoint = kind === "image" ? "/upload/image" : "/upload/file";
  const form = new FormData();
  form.append(kind === "image" ? "image" : "file", new Blob([bytes]), fileName);
  form.append("type", "input");
  form.append("overwrite", "false");
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}${endpoint}`, {
    method: "POST",
    body: form,
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) throw new Error(`ComfyUI could not accept the local ${kind} asset for the official H3 workflow.`);
  const result = await response.json() as { name?: unknown; subfolder?: unknown };
  const name = cleanString(result.name, 400) || fileName;
  const subfolder = cleanString(result.subfolder, 400);
  return subfolder ? `${subfolder}/${name}` : name;
}

async function hydrateWorkflow(state: H3NativeStore, input: H3NativeInput, prompt: string) {
  const manifest = state.manifest;
  if (!manifest) throw new Error("Configure an official native H3 manifest first.");
  const replacements = new Map<string, string>([
    ["{{PLOTPICKLE_PROMPT}}", prompt],
    ["{{PLOTPICKLE_DURATION}}", String(Math.max(1, Math.min(15, Math.round(Number(input.durationSeconds) || 4))))],
    ["{{PLOTPICKLE_ASPECT_RATIO}}", cleanString(input.aspectRatio, 10) || "16:9"],
  ]);
  if (manifest.workflowFamily === "image-to-video") replacements.set("{{PLOTPICKLE_SOURCE_IMAGE}}", await uploadAsset(state.baseUrl, input.sourceAssetUrl, "image"));
  if (manifest.workflowFamily === "first-last-frame") {
    replacements.set("{{PLOTPICKLE_FIRST_FRAME}}", await uploadAsset(state.baseUrl, input.firstFrameAssetUrl || input.sourceAssetUrl, "image"));
    replacements.set("{{PLOTPICKLE_LAST_FRAME}}", await uploadAsset(state.baseUrl, input.lastFrameAssetUrl, "image"));
  }
  if (manifest.workflowFamily === "reference-to-video") replacements.set("{{PLOTPICKLE_REFERENCE_ASSET}}", await uploadAsset(state.baseUrl, input.referenceAssetUrl || input.sourceAssetUrl, "image"));
  if (manifest.workflowFamily === "in-place-edit") replacements.set("{{PLOTPICKLE_SOURCE_VIDEO}}", await uploadAsset(state.baseUrl, input.sourceVideoAssetUrl || input.sourceAssetUrl, "video"));
  return visitStrings(manifest.workflow, (value) => {
    let next = value;
    for (const [token, replacement] of replacements) next = next.replaceAll(token, replacement);
    return next;
  }) as Record<string, unknown>;
}

async function submitWorkflow(baseUrl: string, workflow: Record<string, unknown>) {
  const value = await comfyJson(baseUrl, "/prompt", {
    method: "POST",
    body: JSON.stringify({ prompt: workflow, client_id: `plotpickle-h3-${randomUUID()}` }),
  });
  const promptId = cleanString(value.prompt_id, 200);
  if (!promptId) throw new Error("ComfyUI returned no native H3 prompt ID.");
  return promptId;
}

async function readJobs(): Promise<H3NativeJob[]> {
  const value = await readCredentialJson<unknown>(JOBS_FILE);
  return Array.isArray(value) ? value.filter((item): item is H3NativeJob => isRecord(item) && typeof item.id === "string") : [];
}

async function writeJob(job: H3NativeJob) {
  const jobs = await readJobs();
  await writeCredentialJson(JOBS_FILE, [job, ...jobs.filter((item) => item.id !== job.id)].slice(0, 100));
  return job;
}

export async function createNativeH3Video(state: H3NativeStore, input: H3NativeInput) {
  const status = await probeNativeH3(state);
  if (!state.active || !status.ready) throw new Error(status.error || "Native H3 is not active and ready.");
  if (status.vramProfile === "constrained" && input.performanceAcknowledged !== true) {
    throw new Error("Acknowledge that 8 GB VRAM native H3 generation may be impractical and can fail or run very slowly.");
  }
  const prompt = cleanString(input.prompt, 12_000);
  if (!prompt) throw new Error("Enter a storyboard or scene motion prompt before creating native H3 video.");
  const workflow = await hydrateWorkflow(state, input, prompt);
  const promptId = await submitWorkflow(state.baseUrl, workflow);
  const now = new Date().toISOString();
  return writeJob({
    id: `native-h3-${promptId}`,
    promptId,
    route: "minimax-h3-native",
    model: "MiniMax-H3",
    family: state.manifest!.workflowFamily,
    status: "queued",
    prompt,
    assetId: safeAssetStem(input.assetId || `h3-${promptId}`),
    outputAssetUrl: "",
    error: "",
    createdAt: now,
    updatedAt: now,
  });
}

function firstOutput(entry: ComfyHistoryEntry | null) {
  if (!entry?.outputs) return null;
  for (const output of Object.values(entry.outputs)) {
    const candidate = output.videos?.[0] || output.gifs?.[0] || output.images?.[0];
    if (candidate?.filename) return candidate;
  }
  return null;
}

async function historyEntry(baseUrl: string, promptId: string) {
  const value = await comfyJson(baseUrl, `/history/${encodeURIComponent(promptId)}`);
  const entry = value[promptId];
  return isRecord(entry) ? entry as ComfyHistoryEntry : null;
}

async function downloadOutput(baseUrl: string, output: ComfyOutput) {
  const query = new URLSearchParams({ filename: output.filename, subfolder: output.subfolder || "", type: output.type || "output" });
  const response = await fetch(`${normalizeBaseUrl(baseUrl)}/view?${query.toString()}`, { signal: AbortSignal.timeout(180_000) });
  if (!response.ok) throw new Error("ComfyUI completed native H3 but PlotPickle could not retrieve the output.");
  return Buffer.from(await response.arrayBuffer());
}

export async function queryNativeH3Video(state: H3NativeStore, id: string) {
  const jobs = await readJobs();
  const job = jobs.find((item) => item.id === id);
  if (!job) throw new Error("The native H3 job was not found in local PlotPickle state.");
  if (!["queued", "running"].includes(job.status)) return job;
  if (Date.now() - new Date(job.createdAt).valueOf() > VIDEO_TIMEOUT_MS) {
    job.status = "expired";
    job.error = "The native H3 job exceeded the conservative local completion window.";
    job.updatedAt = new Date().toISOString();
    return writeJob(job);
  }
  const entry = await historyEntry(state.baseUrl, job.promptId);
  if (entry?.status?.status_str === "error") {
    job.status = "failed";
    job.error = JSON.stringify(entry.status.messages || []).slice(0, 800) || "The native H3 workflow failed in ComfyUI.";
  } else {
    const output = firstOutput(entry);
    if (output) {
      const extension = output.filename.toLowerCase().endsWith(".webm") ? ".webm" : output.filename.toLowerCase().endsWith(".mp4") ? ".mp4" : "";
      if (!extension) {
        job.status = "failed";
        job.error = "The official native H3 workflow must return an MP4 or WebM output.";
      } else {
        job.outputAssetUrl = await saveGeneratedAsset(await downloadOutput(state.baseUrl, output), job.assetId, extension);
        job.status = "succeeded";
        job.error = "";
        state.verifiedAt = new Date().toISOString();
        state.lastError = "";
        await writeNativeH3Store(state);
      }
    } else job.status = entry ? "running" : "queued";
  }
  job.updatedAt = new Date().toISOString();
  return writeJob(job);
}

export function publicNativeH3Job(job: H3NativeJob) {
  return {
    id: job.id,
    route: job.route,
    model: job.model,
    family: job.family,
    status: job.status,
    outputAssetUrl: job.outputAssetUrl,
    error: job.error,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}
