import { spawn, type ChildProcess } from "node:child_process";
import { access } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import {
  LOCAL_MODEL_CATALOG,
  type LocalRuntimeKind,
  type LocalTextRole,
} from "../lib/ai/local-runtime";
import { detectLocalHardware } from "./local-hardware-detection";
import { persistentHome, readCredentialJson, writeCredentialJson } from "./local-credentials";

export type LocalRuntimeSettings = {
  version: 1;
  preferredRuntime: LocalRuntimeKind | "auto";
  contextTokens: 16384 | 32768;
  endpointOverrides: Partial<Record<LocalRuntimeKind, string>>;
  modelOverrides: Partial<Record<LocalTextRole, string>>;
  managedLlama: {
    enabled: boolean;
    executable: string;
    port: number;
    modelPaths: Partial<Record<LocalTextRole, string>>;
    gpuLayers: Partial<Record<LocalTextRole, number>>;
  };
};

export type LocalRuntimeProbe = {
  kind: LocalRuntimeKind;
  label: string;
  baseUrl: string;
  reachable: boolean;
  models: string[];
  latencyMs: number;
  error: string;
  managed: boolean;
};

export type LocalRuntimeSnapshot = {
  checkedAt: string;
  hardware: Awaited<ReturnType<typeof detectLocalHardware>>;
  settings: LocalRuntimeSettings;
  runtimes: LocalRuntimeProbe[];
  activeRuntime: LocalRuntimeProbe;
  roles: Record<LocalTextRole, { recommended: string; selected: string; available: boolean; production: true }>;
  retrieval: { embedding: string; reranker: string; cpuResident: true };
  image: { workflow: "SDXL 1.0"; experimental: "SD3.5 Medium" };
  video: { workflow: "LTX-Video 2B 0.9.8 Distilled" };
  healthCheckModel: { model: "SmolLM2 135M"; productionEligible: false };
};

const SETTINGS_FILE = "local-runtime.json";
const DEFAULT_ENDPOINTS: Readonly<Record<LocalRuntimeKind, string>> = {
  "llama.cpp": "http://127.0.0.1:8080/v1",
  "lm-studio": "http://127.0.0.1:1234/v1",
  ollama: "http://127.0.0.1:11434/v1",
  "openai-compatible": "http://127.0.0.1:8000/v1",
};

let managedLlama: ChildProcess | null = null;
let managedRole: LocalTextRole | null = null;
let managedModel = "";

function defaultSettings(): LocalRuntimeSettings {
  return {
    version: 1,
    preferredRuntime: "auto",
    contextTokens: 16384,
    endpointOverrides: {},
    modelOverrides: {},
    managedLlama: {
      enabled: false,
      executable: "",
      port: 8080,
      modelPaths: {},
      gpuLayers: { fast: 99, quality: 24, deep: 8 },
    },
  };
}

function validRuntime(value: unknown): value is LocalRuntimeKind {
  return value === "llama.cpp" || value === "lm-studio" || value === "ollama" || value === "openai-compatible";
}

function normalizedBaseUrl(value: string) {
  const url = new URL(value.trim());
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Use an HTTP or HTTPS local runtime address.");
  if (url.username || url.password) throw new Error("Do not put credentials in the local runtime address.");
  return url.toString().replace(/\/$/, "");
}

function normalizeSettings(value: unknown): LocalRuntimeSettings {
  const fallback = defaultSettings();
  if (!value || typeof value !== "object") return fallback;
  const item = value as Partial<LocalRuntimeSettings>;
  const managed = item.managedLlama && typeof item.managedLlama === "object" ? item.managedLlama : fallback.managedLlama;
  const endpointOverrides: Partial<Record<LocalRuntimeKind, string>> = {};
  for (const kind of Object.keys(DEFAULT_ENDPOINTS) as LocalRuntimeKind[]) {
    const raw = item.endpointOverrides?.[kind];
    if (typeof raw === "string" && raw.trim()) {
      try { endpointOverrides[kind] = normalizedBaseUrl(raw); } catch {}
    }
  }
  const modelOverrides: Partial<Record<LocalTextRole, string>> = {};
  const modelPaths: Partial<Record<LocalTextRole, string>> = {};
  const gpuLayers: Partial<Record<LocalTextRole, number>> = {};
  for (const role of ["fast", "quality", "deep"] as const) {
    const override = item.modelOverrides?.[role];
    if (typeof override === "string" && override.trim()) modelOverrides[role] = override.trim();
    const modelPath = managed.modelPaths?.[role];
    if (typeof modelPath === "string" && modelPath.trim()) modelPaths[role] = modelPath.trim();
    const layers = managed.gpuLayers?.[role];
    if (typeof layers === "number" && Number.isFinite(layers)) gpuLayers[role] = Math.max(0, Math.min(999, Math.round(layers)));
  }
  return {
    version: 1,
    preferredRuntime: item.preferredRuntime === "auto" || validRuntime(item.preferredRuntime) ? item.preferredRuntime : "auto",
    contextTokens: item.contextTokens === 32768 ? 32768 : 16384,
    endpointOverrides,
    modelOverrides,
    managedLlama: {
      enabled: managed.enabled === true,
      executable: typeof managed.executable === "string" ? managed.executable.trim() : "",
      port: typeof managed.port === "number" && Number.isFinite(managed.port) ? Math.max(1024, Math.min(65535, Math.round(managed.port))) : 8080,
      modelPaths,
      gpuLayers: { ...fallback.managedLlama.gpuLayers, ...gpuLayers },
    },
  };
}

export async function readLocalRuntimeSettings() {
  return normalizeSettings(await readCredentialJson<unknown>(SETTINGS_FILE));
}

export async function writeLocalRuntimeSettings(value: LocalRuntimeSettings) {
  const normalized = normalizeSettings(value);
  await writeCredentialJson(SETTINGS_FILE, normalized);
  return normalized;
}

function runtimeLabel(kind: LocalRuntimeKind) {
  if (kind === "llama.cpp") return "llama.cpp";
  if (kind === "lm-studio") return "LM Studio";
  if (kind === "ollama") return "Ollama";
  return "OpenAI-compatible server";
}

async function probeCompatible(kind: LocalRuntimeKind, baseUrl: string, timeoutMs = 1_800): Promise<LocalRuntimeProbe> {
  const started = Date.now();
  try {
    const response = await fetch(`${baseUrl}/models`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} from /models`);
    const body = await response.json() as { data?: Array<{ id?: unknown }> };
    const models = Array.isArray(body.data)
      ? body.data.flatMap((item) => typeof item.id === "string" ? [item.id] : []).slice(0, 200)
      : [];
    return {
      kind,
      label: runtimeLabel(kind),
      baseUrl,
      reachable: true,
      models,
      latencyMs: Date.now() - started,
      error: models.length ? "" : "The runtime is reachable but did not report a model.",
      managed: kind === "llama.cpp" && Boolean(managedLlama),
    };
  } catch (error) {
    return {
      kind,
      label: runtimeLabel(kind),
      baseUrl,
      reachable: false,
      models: [],
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message.slice(0, 240) : "The runtime did not answer.",
      managed: kind === "llama.cpp" && Boolean(managedLlama),
    };
  }
}

function selectedModel(role: LocalTextRole, models: readonly string[], settings: LocalRuntimeSettings) {
  const override = settings.modelOverrides[role];
  if (override) return override;
  const fragments = LOCAL_MODEL_CATALOG[role].expectedNameFragments;
  return models.find((model) => fragments.some((fragment) => model.toLowerCase().includes(fragment))) || "";
}

export async function localRuntimeSnapshot(): Promise<LocalRuntimeSnapshot> {
  const [hardware, settings] = await Promise.all([detectLocalHardware(), readLocalRuntimeSettings()]);
  const runtimes = await Promise.all((Object.keys(DEFAULT_ENDPOINTS) as LocalRuntimeKind[]).map((kind) => {
    const baseUrl = settings.endpointOverrides[kind] || (kind === "llama.cpp" && settings.managedLlama.enabled
      ? `http://127.0.0.1:${settings.managedLlama.port}/v1`
      : DEFAULT_ENDPOINTS[kind]);
    return probeCompatible(kind, baseUrl);
  }));
  const preference = settings.preferredRuntime === "auto"
    ? hardware.profile.runtimePreference
    : [settings.preferredRuntime, ...hardware.profile.runtimePreference.filter((kind) => kind !== settings.preferredRuntime)];
  const activeRuntime = preference.map((kind) => runtimes.find((runtime) => runtime.kind === kind)).find((runtime) => runtime?.reachable)
    ?? runtimes.find((runtime) => runtime.kind === preference[0])
    ?? runtimes[0];
  const models = activeRuntime?.models ?? [];
  const role = (id: LocalTextRole) => {
    const model = selectedModel(id, models, settings);
    return {
      recommended: LOCAL_MODEL_CATALOG[id].label,
      selected: model,
      available: Boolean(model && models.includes(model)),
      production: true as const,
    };
  };
  return {
    checkedAt: new Date().toISOString(),
    hardware,
    settings,
    runtimes,
    activeRuntime: activeRuntime!,
    roles: { fast: role("fast"), quality: role("quality"), deep: role("deep") },
    retrieval: {
      embedding: LOCAL_MODEL_CATALOG.embedding.label,
      reranker: LOCAL_MODEL_CATALOG.reranker.label,
      cpuResident: true,
    },
    image: { workflow: "SDXL 1.0", experimental: "SD3.5 Medium" },
    video: { workflow: "LTX-Video 2B 0.9.8 Distilled" },
    healthCheckModel: { model: "SmolLM2 135M", productionEligible: false },
  };
}

export async function localTextExecutionProfile(role: LocalTextRole) {
  const settings = await readLocalRuntimeSettings();
  if (settings.managedLlama.enabled && (settings.preferredRuntime === "auto" || settings.preferredRuntime === "llama.cpp")) {
    await startManagedLlama(role);
  }
  const snapshot = await localRuntimeSnapshot();
  if (!snapshot.activeRuntime.reachable) {
    throw new Error("No local OpenAI-compatible runtime is reachable. Start llama.cpp, LM Studio, Ollama, or another compatible server.");
  }
  const selected = snapshot.roles[role];
  if (!selected.available) {
    throw new Error(`${selected.recommended} is not available for the ${role} local role. Install it or set an advanced model override in Settings.`);
  }
  return {
    provider: "local" as const,
    runtime: snapshot.activeRuntime.kind,
    baseUrl: snapshot.activeRuntime.baseUrl,
    textModel: selected.selected,
    apiKey: "",
    contextTokens: snapshot.settings.contextTokens,
  };
}

async function existingFile(value: string) {
  if (!value) return false;
  try { await access(value); return true; } catch { return false; }
}

function localModelDirectory() {
  return path.join(persistentHome(), "models", "text");
}

export async function managedLlamaInstallPlan() {
  const settings = await readLocalRuntimeSettings();
  return {
    recommended: true,
    runtime: "llama.cpp" as const,
    modelDirectory: localModelDirectory(),
    executable: settings.managedLlama.executable || "llama-server",
    models: (["fast", "quality", "deep"] as const).map((role) => ({
      role,
      model: LOCAL_MODEL_CATALOG[role],
      configuredPath: settings.managedLlama.modelPaths[role] || "",
    })),
    compatibility: {
      pascalBuild: "CUDA 12.x / cu126-compatible build",
      fallback: "Vulkan",
    },
  };
}

export async function stopManagedLlama() {
  if (!managedLlama) return false;
  const child = managedLlama;
  managedLlama = null;
  managedRole = null;
  managedModel = "";
  child.kill();
  return true;
}

async function waitForManagedLlama(port: number, expectedModelPath: string) {
  const baseUrl = `http://127.0.0.1:${port}/v1`;
  const deadline = Date.now() + 30_000;
  let lastError = "llama.cpp did not answer.";
  while (Date.now() < deadline) {
    if (!managedLlama || managedLlama.exitCode !== null) throw new Error("The managed llama.cpp process exited before becoming ready.");
    const probe = await probeCompatible("llama.cpp", baseUrl, 1_500);
    if (probe.reachable && probe.models.length) return true;
    lastError = probe.error || lastError;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  await stopManagedLlama();
  throw new Error(`Managed llama.cpp did not become ready for ${path.basename(expectedModelPath)} within 30 seconds: ${lastError}`);
}

export async function startManagedLlama(role: LocalTextRole) {
  const settings = await readLocalRuntimeSettings();
  if (!settings.managedLlama.enabled) return false;
  const executable = settings.managedLlama.executable || "llama-server";
  const modelPath = settings.managedLlama.modelPaths[role];
  if (!modelPath || !(await existingFile(modelPath))) {
    throw new Error(`The managed llama.cpp ${role} model path is not configured or does not exist.`);
  }
  if (managedLlama && managedRole === role && managedModel === modelPath && managedLlama.exitCode === null) return true;
  await stopManagedLlama();
  const layers = settings.managedLlama.gpuLayers[role] ?? (role === "fast" ? 99 : role === "quality" ? 24 : 8);
  managedLlama = spawn(executable, [
    "--model", modelPath,
    "--host", "127.0.0.1",
    "--port", String(settings.managedLlama.port),
    "--ctx-size", String(settings.contextTokens),
    "--n-gpu-layers", String(layers),
  ], {
    windowsHide: true,
    stdio: "ignore",
    env: { ...process.env, LLAMA_CACHE: path.join(persistentHome(), "llama-cache") },
  });
  managedRole = role;
  managedModel = modelPath;
  const child = managedLlama;
  child.once("exit", () => {
    if (managedLlama !== child) return;
    managedLlama = null;
    managedRole = null;
    managedModel = "";
  });
  await waitForManagedLlama(settings.managedLlama.port, modelPath);
  return true;
}

export function managedLlamaStatus() {
  return { running: Boolean(managedLlama && managedLlama.exitCode === null), role: managedRole, model: managedModel };
}
