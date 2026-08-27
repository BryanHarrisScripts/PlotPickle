import { access, mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { LOCAL_MODEL_CATALOG, type LocalRuntimeKind, type LocalTextRole } from "../../lib/runtime/ai/local-runtime";
import { detectLocalAiInstallations, type LocalAiInstallation } from "./local-ai-installation-status";
import { persistentHome } from "../local-credentials";
import {
  localRuntimeSnapshot,
  readLocalRuntimeSettings,
  startManagedLlama,
  type LocalRuntimeSnapshot,
} from "../local-runtime-manager";

export const LOCAL_AI_READINESS_SCHEMA_VERSION = 1 as const;
export const LOCAL_AI_READINESS_FILE = "local-ai-readiness.json";

export type LocalAiReadinessState =
  | "recommended-ready"
  | "recommended-missing"
  | "recommended-stopped"
  | "recommended-unhealthy"
  | "fallback-selected"
  | "user-override";

export type LocalAiInferenceProbe = {
  attempted: boolean;
  ready: boolean;
  latencyMs: number;
  error: string;
};

export type LocalAiReadinessSnapshot = {
  schemaVersion: typeof LOCAL_AI_READINESS_SCHEMA_VERSION;
  checkedAt: string;
  state: LocalAiReadinessState;
  hardware: {
    profile: string;
    label: string;
    ramGb: number;
    gpuName: string;
    vramGb: number;
  };
  recommended: {
    runtime: LocalRuntimeKind;
    model: string;
    runtimeInstalled: boolean;
    runtimeRunning: boolean;
    modelConfigured: boolean;
  };
  actual: {
    runtime: LocalRuntimeKind;
    model: string;
    reachable: boolean;
  };
  override: {
    active: boolean;
    runtime: LocalRuntimeKind | "";
  };
  managedStart: {
    attempted: boolean;
    started: boolean;
    error: string;
  };
  inference: LocalAiInferenceProbe;
  fallbackReason: string;
  action: "none" | "install-repair" | "start-restart" | "review-settings";
  message: string;
};

type ReadinessOptions = {
  attemptManagedStart?: boolean;
  probeInference?: boolean;
};

function runtimeInstallation(kind: LocalRuntimeKind, installations: Awaited<ReturnType<typeof detectLocalAiInstallations>>): LocalAiInstallation | null {
  if (kind === "llama.cpp") return installations.llamaCpp;
  if (kind === "lm-studio") return installations.lmStudio;
  if (kind === "ollama") return installations.ollama;
  return null;
}

async function fileExists(value: string) {
  if (!value.trim()) return false;
  try { await access(value); return true; } catch { return false; }
}

function loopbackBaseUrl(value: string) {
  const url = new URL(value);
  const host = url.hostname.toLowerCase();
  if (!["127.0.0.1", "localhost", "::1"].includes(host)) {
    throw new Error("Local AI readiness refuses non-loopback inference targets.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") throw new Error("Local AI readiness requires an HTTP loopback endpoint.");
  return url.toString().replace(/\/$/, "");
}

async function probeInference(snapshot: LocalRuntimeSnapshot, timeoutMs = 12_000): Promise<LocalAiInferenceProbe> {
  const role = snapshot.roles.fast;
  if (!snapshot.activeRuntime.reachable || !role.available || !role.selected) {
    return { attempted: false, ready: false, latencyMs: 0, error: "No active Fast local model is available for an inference readiness check." };
  }
  const started = Date.now();
  try {
    const baseUrl = loopbackBaseUrl(snapshot.activeRuntime.baseUrl);
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        model: role.selected,
        messages: [{ role: "user", content: "Reply with OK." }],
        stream: false,
        temperature: 0,
        max_tokens: 4,
      }),
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} from local chat-completions readiness probe.`);
    const value = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
    const content = value.choices?.[0]?.message?.content;
    if (typeof content !== "string" || !content.trim()) throw new Error("The local runtime returned no text from the bounded inference probe.");
    return { attempted: true, ready: true, latencyMs: Date.now() - started, error: "" };
  } catch (error) {
    return {
      attempted: true,
      ready: false,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message.slice(0, 300) : "The bounded local inference probe failed.",
    };
  }
}

function readinessFilePath() {
  return path.join(persistentHome(), "runtime", LOCAL_AI_READINESS_FILE);
}

async function persistSafeReadiness(snapshot: LocalAiReadinessSnapshot) {
  const target = readinessFilePath();
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(snapshot, null, 2)}\n`, { encoding: "utf8", mode: 0o600 });
}

function configuredModelForRole(settings: Awaited<ReturnType<typeof readLocalRuntimeSettings>>, role: LocalTextRole) {
  return settings.managedLlama.modelPaths[role] || "";
}

export async function localAiReadinessSnapshot(options: ReadinessOptions = {}): Promise<LocalAiReadinessSnapshot> {
  const settings = await readLocalRuntimeSettings();
  let runtimeSnapshot = await localRuntimeSnapshot();
  const recommendedRuntime = runtimeSnapshot.hardware.profile.runtimePreference[0] || "llama.cpp";
  const explicitRuntimeOverride = settings.preferredRuntime !== "auto";
  const recommendedProbe = runtimeSnapshot.runtimes.find((runtime) => runtime.kind === recommendedRuntime);
  const installationInput = {
    llamaCppRunning: Boolean(runtimeSnapshot.runtimes.find((runtime) => runtime.kind === "llama.cpp")?.reachable),
    lmStudioRunning: Boolean(runtimeSnapshot.runtimes.find((runtime) => runtime.kind === "lm-studio")?.reachable),
    ollamaRunning: Boolean(runtimeSnapshot.runtimes.find((runtime) => runtime.kind === "ollama")?.reachable),
    comfyuiRunning: false,
  };
  let installations = await detectLocalAiInstallations(installationInput);
  let recommendedInstallation = runtimeInstallation(recommendedRuntime, installations);
  const configuredFastModel = configuredModelForRole(settings, "fast");
  const configuredFastModelPresent = Boolean(configuredFastModel && await fileExists(configuredFastModel));
  const managedEligible = recommendedRuntime === "llama.cpp"
    && !explicitRuntimeOverride
    && settings.managedLlama.enabled
    && configuredFastModelPresent;

  const managedStart = { attempted: false, started: false, error: "" };
  if (options.attemptManagedStart && managedEligible && !recommendedProbe?.reachable) {
    managedStart.attempted = true;
    try {
      managedStart.started = await startManagedLlama("fast");
      runtimeSnapshot = await localRuntimeSnapshot();
      installations = await detectLocalAiInstallations({
        ...installationInput,
        llamaCppRunning: Boolean(runtimeSnapshot.runtimes.find((runtime) => runtime.kind === "llama.cpp")?.reachable),
      });
      recommendedInstallation = runtimeInstallation(recommendedRuntime, installations);
    } catch (error) {
      managedStart.error = error instanceof Error ? error.message.slice(0, 300) : "The configured managed llama.cpp runtime could not start.";
    }
  }

  const activeRuntime = runtimeSnapshot.activeRuntime;
  const activeFast = runtimeSnapshot.roles.fast;
  const currentRecommendedProbe = runtimeSnapshot.runtimes.find((runtime) => runtime.kind === recommendedRuntime);
  const inference = options.probeInference ? await probeInference(runtimeSnapshot) : {
    attempted: false,
    ready: false,
    latencyMs: 0,
    error: "Inference readiness has not been checked yet.",
  };
  const runtimeInstalled = recommendedInstallation?.installed ?? currentRecommendedProbe?.reachable ?? false;
  const runtimeRunning = Boolean(currentRecommendedProbe?.reachable);
  const recommendationModel = recommendedRuntime === "llama.cpp"
    ? (configuredFastModelPresent ? path.basename(configuredFastModel) : LOCAL_MODEL_CATALOG.fast.label)
    : activeRuntime.kind === recommendedRuntime && activeFast.selected
      ? activeFast.selected
      : LOCAL_MODEL_CATALOG.fast.label;
  const actualModel = activeFast.selected || "";
  let state: LocalAiReadinessState;
  let fallbackReason = "";
  let action: LocalAiReadinessSnapshot["action"] = "none";

  if (explicitRuntimeOverride) {
    state = "user-override";
    fallbackReason = `${activeRuntime.label} is selected by your explicit local runtime override.`;
    action = activeRuntime.reachable && (!options.probeInference || inference.ready) ? "none" : "review-settings";
  } else if (!runtimeInstalled) {
    state = activeRuntime.kind !== recommendedRuntime && activeRuntime.reachable ? "fallback-selected" : "recommended-missing";
    fallbackReason = `${recommendedRuntime} is recommended for this hardware but is not installed.`;
    action = "install-repair";
  } else if (!runtimeRunning) {
    state = activeRuntime.kind !== recommendedRuntime && activeRuntime.reachable ? "fallback-selected" : "recommended-stopped";
    fallbackReason = managedStart.error
      ? `${recommendedRuntime} is installed but failed to start: ${managedStart.error}`
      : `${recommendedRuntime} is installed but not running.`;
    action = managedEligible ? "start-restart" : "install-repair";
  } else if (!configuredFastModelPresent && recommendedRuntime === "llama.cpp" && settings.managedLlama.enabled) {
    state = activeRuntime.kind !== recommendedRuntime && activeRuntime.reachable ? "fallback-selected" : "recommended-missing";
    fallbackReason = "llama.cpp is installed; the configured Fast GGUF is missing.";
    action = "install-repair";
  } else if (options.probeInference && !inference.ready) {
    state = activeRuntime.kind !== recommendedRuntime ? "fallback-selected" : "recommended-unhealthy";
    fallbackReason = `${activeRuntime.label} failed its bounded local inference readiness probe: ${inference.error}`;
    action = "start-restart";
  } else if (activeRuntime.kind !== recommendedRuntime) {
    state = "fallback-selected";
    fallbackReason = `${recommendedRuntime} is recommended for this hardware; using ${activeRuntime.label} because the preferred route is not ready.`;
    action = "install-repair";
  } else {
    state = "recommended-ready";
  }

  const result: LocalAiReadinessSnapshot = {
    schemaVersion: LOCAL_AI_READINESS_SCHEMA_VERSION,
    checkedAt: new Date().toISOString(),
    state,
    hardware: {
      profile: runtimeSnapshot.hardware.profile.id,
      label: runtimeSnapshot.hardware.profile.label,
      ramGb: runtimeSnapshot.hardware.ramGb,
      gpuName: runtimeSnapshot.hardware.gpuName,
      vramGb: runtimeSnapshot.hardware.vramGb,
    },
    recommended: {
      runtime: recommendedRuntime,
      model: recommendationModel,
      runtimeInstalled,
      runtimeRunning,
      modelConfigured: recommendedRuntime !== "llama.cpp" || configuredFastModelPresent,
    },
    actual: {
      runtime: activeRuntime.kind,
      model: actualModel,
      reachable: activeRuntime.reachable,
    },
    override: {
      active: explicitRuntimeOverride,
      runtime: explicitRuntimeOverride ? settings.preferredRuntime as LocalRuntimeKind : "",
    },
    managedStart,
    inference,
    fallbackReason,
    action,
    message: state === "recommended-ready"
      ? `AI COMPUTE: Recommended ${recommendedRuntime} · ${recommendationModel}; active and inference-ready.`
      : `AI COMPUTE: Recommended ${recommendedRuntime} · ${recommendationModel}; active ${activeRuntime.label}${actualModel ? ` · ${actualModel}` : ""}; ${fallbackReason}`,
  };
  await persistSafeReadiness(result);
  return result;
}
