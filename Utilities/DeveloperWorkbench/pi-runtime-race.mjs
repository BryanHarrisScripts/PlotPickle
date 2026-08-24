import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { approvedCodingModel, rankApprovedCodingModel } from "../../scripts/developer-repair-model-policy.mjs";
import { probeManagedPiReadiness } from "./pi-managed-node-launch.mjs";

export const WORKBENCH_RUNTIME_RACE_MS = 60_000;
export const WORKBENCH_RUNTIME_POLL_MS = 2_500;
const WORKBENCH_RUNTIME_ATTEMPT_MS = 5_000;
const WORKBENCH_PI_SMOKE_MS = 12_000;
const WORKBENCH_RUNTIME_MARKER = "PLOTPICKLE_WORKBENCH_RUNTIME_READY";
const PIN_MAX_AGE_MS = 4 * 60 * 60_000;

const STANDARD_ENDPOINTS = [
  { kind: "lm-studio", label: "LM Studio", baseUrl: "http://127.0.0.1:1234/v1" },
  { kind: "ollama", label: "Ollama", baseUrl: "http://127.0.0.1:11434/v1" },
  { kind: "llama.cpp", label: "llama.cpp", baseUrl: "http://127.0.0.1:8080/v1" },
  { kind: "openai-compatible", label: "OpenAI-compatible", baseUrl: "http://127.0.0.1:8000/v1" },
];

function normalizeLoopbackBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/$/, "");
  if (!raw) return "";
  const normalized = /\/v1$/i.test(raw) ? raw : `${raw}/v1`;
  if (!URL.canParse(normalized)) throw new Error(`Workbench local runtime URL is invalid: ${value}`);
  const parsed = new URL(normalized);
  const host = parsed.hostname.toLowerCase();
  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(host)) {
    throw new Error(`Workbench local runtime must stay on loopback; refusing ${value}.`);
  }
  return parsed.toString().replace(/\/$/, "");
}

function runtimeKey(runtime) {
  return `${runtime.baseUrl}|${runtime.model}`.toLowerCase();
}

function errorDetail(error) {
  const stderr = String(error?.stderr || "").trim();
  const stdout = String(error?.stdout || "").trim();
  const message = error instanceof Error ? error.message : String(error);
  const detail = stderr || stdout || message;
  return detail.length <= 1_500 ? detail : `${detail.slice(-1_500)} [truncated]`;
}

async function probeModels(endpoint, fetchImpl, timeoutMs) {
  const baseUrl = normalizeLoopbackBaseUrl(endpoint.baseUrl);
  const response = await fetchImpl(`${baseUrl}/models`, {
    headers: { Accept: "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`HTTP ${response.status}`);
  const body = await response.json();
  const models = Array.isArray(body?.data)
    ? body.data.flatMap((item) => typeof item?.id === "string" ? [item.id] : [])
    : [];
  return models.filter(approvedCodingModel).map((model) => ({ ...endpoint, baseUrl, model }));
}

export async function discoverWorkbenchRuntimeCandidates(options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs || 2_000;
  const preferredEndpoint = normalizeLoopbackBaseUrl(options.preferredEndpoint ?? process.env.PLOTPICKLE_REPAIR_ENDPOINT ?? "");
  const preferredModel = String(options.preferredModel ?? process.env.PLOTPICKLE_REPAIR_MODEL ?? "").trim();
  if (preferredModel && !approvedCodingModel(preferredModel)) {
    throw new Error(`Configured Pi repair model is not approved for local coding: ${preferredModel}`);
  }

  if (preferredEndpoint && preferredModel) {
    return {
      candidates: [{ kind: "explicit", label: "Configured local runtime", baseUrl: preferredEndpoint, model: preferredModel }],
      diagnostics: [],
    };
  }

  const endpoints = options.endpoints || (preferredEndpoint
    ? [{ kind: "openai-compatible", label: "Configured local runtime", baseUrl: preferredEndpoint }]
    : STANDARD_ENDPOINTS);
  const probes = await Promise.allSettled(endpoints.map((endpoint) => probeModels(endpoint, fetchImpl, timeoutMs)));
  let candidates = [];
  const diagnostics = [];
  probes.forEach((probe, index) => {
    if (probe.status === "fulfilled") candidates.push(...probe.value);
    else diagnostics.push(`${endpoints[index].label}: ${errorDetail(probe.reason)}`);
  });

  if (preferredModel) {
    const exact = candidates.filter((candidate) => candidate.model.toLowerCase() === preferredModel.toLowerCase());
    if (exact.length) candidates = exact;
  }
  candidates.sort((left, right) => rankApprovedCodingModel(left.model) - rankApprovedCodingModel(right.model));
  return { candidates, diagnostics };
}

export async function probeWorkbenchRuntimeInference(runtime, options = {}) {
  const fetchImpl = options.fetchImpl || fetch;
  const timeoutMs = options.timeoutMs || WORKBENCH_RUNTIME_ATTEMPT_MS;
  const baseUrl = normalizeLoopbackBaseUrl(runtime.baseUrl);
  const startedAt = Date.now();
  const response = await fetchImpl(`${baseUrl}/completions`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      Authorization: "Bearer plotpickle-local",
    },
    body: JSON.stringify({
      model: runtime.model,
      prompt: `Reply with exactly ${WORKBENCH_RUNTIME_MARKER}.`,
      max_tokens: 16,
      temperature: 0,
      stream: false,
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) {
    const detail = (await response.text()).trim();
    throw new Error(`HTTP ${response.status}${detail ? `: ${detail.slice(-500)}` : ""}`);
  }
  const body = await response.json();
  const output = String(body?.choices?.[0]?.text ?? body?.choices?.[0]?.message?.content ?? "").trim();
  if (!output) throw new Error("Local runtime returned HTTP 200 but no completion text.");
  return { runtime: { ...runtime, baseUrl }, latencyMs: Date.now() - startedAt, output };
}

async function firstInferenceResponse(candidates, options = {}) {
  const probeCandidate = options.probeCandidate || probeWorkbenchRuntimeInference;
  const timeoutMs = options.timeoutMs || WORKBENCH_RUNTIME_ATTEMPT_MS;
  const errors = new Map();
  const tasks = candidates.map(async (candidate) => {
    try {
      return await probeCandidate(candidate, { timeoutMs, fetchImpl: options.fetchImpl });
    } catch (error) {
      errors.set(runtimeKey(candidate), errorDetail(error));
      throw error;
    }
  });
  try {
    const winner = await Promise.any(tasks);
    await Promise.allSettled(tasks);
    return { winner, errors };
  } catch {
    await Promise.allSettled(tasks);
    return { winner: null, errors };
  }
}

function pinPath(repositoryPath) {
  return path.join(path.resolve(repositoryPath), ".plotpickle", "developer-workbench", "runtime-selection.json");
}

export async function writePinnedWorkbenchRuntime(repositoryPath, runtime, providerId) {
  const target = pinPath(repositoryPath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify({
    schemaVersion: 1,
    selectedAt: new Date().toISOString(),
    providerId,
    runtime: {
      kind: runtime.kind || "local",
      label: runtime.label || runtime.kind || "Local runtime",
      baseUrl: normalizeLoopbackBaseUrl(runtime.baseUrl),
      model: runtime.model,
    },
  }, null, 2)}\n`, "utf8");
}

export async function readPinnedWorkbenchRuntime(repositoryPath, options = {}) {
  try {
    const parsed = JSON.parse(await readFile(pinPath(repositoryPath), "utf8"));
    const selectedAt = Date.parse(parsed?.selectedAt || "");
    const maxAgeMs = options.maxAgeMs || PIN_MAX_AGE_MS;
    if (!Number.isFinite(selectedAt) || Date.now() - selectedAt > maxAgeMs) return null;
    const runtime = parsed?.runtime;
    if (!runtime?.model || !approvedCodingModel(runtime.model)) return null;
    return {
      ...runtime,
      baseUrl: normalizeLoopbackBaseUrl(runtime.baseUrl),
      providerId: String(parsed.providerId || "plotpickle-workbench-local"),
    };
  } catch {
    return null;
  }
}

export async function raceWorkbenchRuntime(options) {
  const pi = options.pi;
  const cwd = path.resolve(options.cwd);
  const raceMs = options.raceMs || WORKBENCH_RUNTIME_RACE_MS;
  const pollMs = options.pollMs || WORKBENCH_RUNTIME_POLL_MS;
  const attemptTimeoutMs = options.attemptTimeoutMs || WORKBENCH_RUNTIME_ATTEMPT_MS;
  const piSmokeTimeoutMs = options.piSmokeTimeoutMs || WORKBENCH_PI_SMOKE_MS;
  const discoverCandidates = options.discoverCandidates || discoverWorkbenchRuntimeCandidates;
  const probeCandidate = options.probeCandidate || probeWorkbenchRuntimeInference;
  const probePi = options.probePi || probeManagedPiReadiness;
  const sleepFn = options.sleepFn || ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const pinSelection = options.pinSelection || writePinnedWorkbenchRuntime;
  const now = options.now || (() => Date.now());
  const startedAt = now();
  const deadline = startedAt + raceMs;
  const lastErrors = new Map();
  const piCooldownUntil = new Map();
  let lastCandidates = [];
  let attempts = 0;

  while (now() < deadline) {
    let discovery;
    try {
      discovery = await discoverCandidates({ fetchImpl: options.fetchImpl });
    } catch (error) {
      discovery = { candidates: [], diagnostics: [errorDetail(error)] };
    }
    lastCandidates = discovery.candidates || [];
    for (const diagnostic of discovery.diagnostics || []) lastErrors.set(`discovery:${diagnostic}`, diagnostic);

    const eligible = lastCandidates.filter((candidate) => (piCooldownUntil.get(runtimeKey(candidate)) || 0) <= now());
    if (eligible.length) {
      attempts += eligible.length;
      const remaining = Math.max(1, deadline - now());
      const direct = await firstInferenceResponse(eligible, {
        probeCandidate,
        fetchImpl: options.fetchImpl,
        timeoutMs: Math.min(attemptTimeoutMs, remaining),
      });
      for (const [key, detail] of direct.errors) lastErrors.set(key, detail);

      if (direct.winner) {
        const runtime = direct.winner.runtime;
        const remainingForPi = deadline - now();
        if (remainingForPi > 0) {
          try {
            const probe = await probePi({
              pi,
              runtime,
              cwd,
              purpose: "work-item-readiness",
              smokeTimeout: Math.min(piSmokeTimeoutMs, remainingForPi),
            });
            await pinSelection(cwd, runtime, probe.providerId);
            return Object.freeze({
              ready: true,
              runtime,
              providerId: probe.providerId,
              directLatencyMs: direct.winner.latencyMs,
              piLatencyMs: probe.latencyMs,
              totalLatencyMs: now() - startedAt,
              attempts,
              diagnostics: [...lastErrors.values()],
            });
          } catch (error) {
            const key = runtimeKey(runtime);
            lastErrors.set(key, `Pi handshake: ${errorDetail(error)}`);
            piCooldownUntil.set(key, now() + 8_000);
          }
        }
      }
    }

    const remaining = deadline - now();
    if (remaining <= 0) break;
    await sleepFn(Math.min(pollMs, remaining));
  }

  const detectedRuntime = lastCandidates[0] || null;
  const diagnostics = [...lastErrors.values()].slice(-8);
  return Object.freeze({
    ready: false,
    runtime: detectedRuntime,
    providerId: "plotpickle-workbench-local",
    totalLatencyMs: now() - startedAt,
    attempts,
    diagnostics,
    detail: detectedRuntime
      ? `No approved local model completed the real inference + Pi handshake within ${Math.round(raceMs / 1000)} seconds. Last detail: ${diagnostics.join(" | ") || "no candidate returned a usable completion"}`
      : `No approved local coding model became responsive within ${Math.round(raceMs / 1000)} seconds. Last detail: ${diagnostics.join(" | ") || "no local runtime advertised an approved model"}`,
  });
}
