#!/usr/bin/env node

import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";
import {
  normalizeModelDescriptor,
  probeRuntimeModelCapabilities,
  scoreModelForRole,
} from "../lib/ai/local-model-capabilities.mjs";
import {
  approvedCodingModel,
  chooseApprovedCodingModel,
  dedicatedLegacyRepairModel,
  rankApprovedCodingModel,
} from "./developer-repair-model-policy.mjs";
import { writeRepairCapabilityCache } from "./local-repair-capability-cache.mjs";
import { detectRepairHardware } from "./local-repair-hardware.mjs";

const exec = promisify(execFile);
const args = process.argv.slice(2);
const quiet = args.includes("--quiet");
const requestedWorker = (() => {
  const index = args.indexOf("--worker");
  return (index >= 0 && index + 1 < args.length ? args[index + 1] : process.env.PLOTPICKLE_REPAIR_WORKER || "pi").toLowerCase();
})();
const preferredModel = String(process.env.PLOTPICKLE_REPAIR_MODEL || "").trim();
const preferredEndpoint = String(process.env.PLOTPICKLE_REPAIR_ENDPOINT || "").trim().replace(/\/$/, "");
const allowAutoDownload = process.env.PLOTPICKLE_REPAIR_AUTO_DOWNLOAD !== "0";
const DEFAULT_OLLAMA_PI_MODEL = "qwen2.5-coder:7b";
let cachedHardware = null;

function safeModelKey(value) {
  const model = String(value || "").trim();
  if (!/^[a-zA-Z0-9._:/+@\-]+$/.test(model)) throw new Error(`Local model key contains unsupported shell characters: ${model}`);
  return model;
}

function modelKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function modelKeyFromRow(row) {
  if (!row || typeof row !== "object") return "";
  for (const field of ["modelKey", "path", "id", "identifier", "name", "model"]) {
    if (typeof row[field] === "string" && row[field].trim()) return row[field].trim();
  }
  return "";
}

async function repairHardware() {
  if (!cachedHardware) cachedHardware = await detectRepairHardware();
  return cachedHardware;
}

async function runLms(commandArgs, timeout = 30_000) {
  const result = await exec("lms", commandArgs, {
    env: process.env,
    windowsHide: true,
    shell: process.platform === "win32",
    timeout,
    maxBuffer: 4 * 1024 * 1024,
  });
  return result.stdout.trim();
}

async function lmsAvailable() {
  try {
    await runLms(["--help"], 10_000);
    return true;
  } catch {
    return false;
  }
}

async function downloadedLmStudioModels() {
  if (!(await lmsAvailable())) return [];
  try {
    const raw = await runLms(["ls", "--llm", "--json"], 20_000);
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.map(modelKeyFromRow).filter(Boolean) : [];
  } catch {
    return [];
  }
}

async function lmStudioServerRunning() {
  try {
    const raw = await runLms(["server", "status", "--json", "--quiet"], 10_000);
    return JSON.parse(raw || "{}").running === true;
  } catch {
    return false;
  }
}

async function startLmStudioServerIfNeeded() {
  if (await lmStudioServerRunning()) return;
  await runLms(["server", "start", "--bind", "127.0.0.1"], 30_000);
}

async function openAiModels(baseUrl) {
  try {
    const normalized = String(baseUrl || "").replace(/\/$/, "");
    const response = await fetch(`${normalized}/models`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body?.data)
      ? body.data.flatMap((item) => typeof item?.id === "string" ? [item.id] : [])
      : [];
  } catch {
    return [];
  }
}

async function ollamaInstalledModels() {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/tags", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return [];
    const body = await response.json();
    return Array.isArray(body?.models)
      ? body.models.flatMap((item) => typeof item?.name === "string" ? [item.name] : typeof item?.model === "string" ? [item.model] : [])
      : [];
  } catch {
    return [];
  }
}

async function ollamaAvailable() {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/version", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

async function pullOllama(model) {
  const response = await fetch("http://127.0.0.1:11434/api/pull", {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify({ model, stream: false }),
    signal: AbortSignal.timeout(30 * 60_000),
  });
  if (!response.ok) {
    let detail = "";
    try {
      const body = await response.json();
      detail = typeof body?.error === "string" ? body.error : "";
    } catch {}
    throw new Error(`Ollama could not download ${model}${detail ? `: ${detail}` : "."}`);
  }
}

async function warmOllama(model) {
  try {
    const response = await fetch("http://127.0.0.1:11434/api/generate", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        prompt: "Reply OK.",
        stream: false,
        keep_alive: "60m",
        options: { num_predict: 1, temperature: 0 },
      }),
      signal: AbortSignal.timeout(120_000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

function descriptorFor(model, descriptors) {
  const wanted = modelKey(model);
  return (descriptors || []).find((item) => modelKey(item?.id) === wanted)
    || normalizeModelDescriptor({ id: model });
}

function rememberRepairCapability(model, descriptors, hardware) {
  if (!model) return;
  const descriptor = descriptorFor(model, descriptors);
  const scored = scoreModelForRole("repair", descriptor, hardware);
  if (!scored.eligible) return;
  writeRepairCapabilityCache([{
    model,
    repairEligible: true,
    score: scored.score,
    fit: scored.fit.label,
    metadataSource: descriptor.metadataSource,
    capabilities: Object.entries(descriptor.capabilities).flatMap(([name, enabled]) => enabled ? [name] : []),
  }]);
}

async function capabilityChoice(kind, baseUrl, models) {
  if (requestedWorker === "mastra-qwen") {
    return {
      model: (models || []).find(dedicatedLegacyRepairModel) || "",
      descriptors: [],
      hardware: await repairHardware(),
    };
  }
  const hardware = await repairHardware();
  const descriptors = await probeRuntimeModelCapabilities({ kind, baseUrl, models, timeoutMs: 2_500 });
  const model = chooseApprovedCodingModel(models, preferredModel, descriptors, hardware);
  if (model) rememberRepairCapability(model, descriptors, hardware);
  return { model, descriptors, hardware };
}

async function waitForLmStudioModel(model, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const models = await openAiModels("http://127.0.0.1:1234/v1");
    const choice = await capabilityChoice("lm-studio", "http://127.0.0.1:1234/v1", models);
    if (models.some((item) => modelKey(item) === modelKey(model)) || choice.model) return choice.model || model;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return "";
}

function workerAccepts(model) {
  return requestedWorker === "mastra-qwen" ? dedicatedLegacyRepairModel(model) : approvedCodingModel(model);
}

function choose(models) {
  const allowed = (models || []).filter(workerAccepts);
  if (requestedWorker === "mastra-qwen") return allowed[0] || "";
  return chooseApprovedCodingModel(allowed, preferredModel);
}

function output(line) {
  if (!quiet) process.stdout.write(`${line}\n`);
}

async function alreadyExposedCandidate() {
  const endpoints = [
    { kind: "lm-studio", label: "LM Studio", baseUrl: "http://127.0.0.1:1234/v1" },
    { kind: "ollama", label: "Ollama", baseUrl: "http://127.0.0.1:11434/v1" },
    { kind: "llama.cpp", label: "llama.cpp", baseUrl: "http://127.0.0.1:8080/v1" },
    { kind: "openai-compatible", label: "OpenAI-compatible", baseUrl: preferredEndpoint || "http://127.0.0.1:8000/v1" },
  ];
  const candidates = [];
  for (const endpoint of endpoints) {
    if (preferredEndpoint && endpoint.kind !== "openai-compatible" && !endpoint.baseUrl.startsWith(preferredEndpoint)) continue;
    const models = await openAiModels(endpoint.baseUrl);
    if (!models.length) continue;
    const choice = await capabilityChoice(endpoint.kind, endpoint.baseUrl, models);
    if (!choice.model) continue;
    const scored = scoreModelForRole("repair", descriptorFor(choice.model, choice.descriptors), choice.hardware);
    candidates.push({ ...endpoint, model: safeModelKey(choice.model), score: scored.score });
  }
  if (preferredModel) {
    const exact = candidates.find((item) => modelKey(item.model) === modelKey(preferredModel));
    if (exact) return exact;
  }
  candidates.sort((a, b) => requestedWorker === "mastra-qwen"
    ? 0
    : b.score - a.score || rankApprovedCodingModel(a.model) - rankApprovedCodingModel(b.model));
  return candidates[0] || null;
}

async function ensureDefaultPiOllamaModel() {
  if (requestedWorker !== "pi" || preferredEndpoint || !allowAutoDownload) return "";
  if (!(await ollamaAvailable())) return "";
  const model = safeModelKey(preferredModel || DEFAULT_OLLAMA_PI_MODEL);
  if (!approvedCodingModel(model)) {
    throw new Error(`The requested Pi repair model ${model} is not suitable for PlotPickle's local repair role.`);
  }
  output(`Developer repair model ........... DOWNLOADING  ${model} via Ollama; first setup can take several minutes`);
  await pullOllama(model);
  const installedModels = await ollamaInstalledModels();
  const choice = await capabilityChoice("ollama", "http://127.0.0.1:11434/v1", installedModels);
  const installed = choice.model || choose(installedModels);
  if (!installed) throw new Error(`Ollama finished downloading ${model}, but PlotPickle still cannot see a repair-capable local model.`);
  rememberRepairCapability(installed, choice.descriptors, choice.hardware);
  const warmed = await warmOllama(installed);
  output(`Developer repair model ............... READY  ${installed} via Ollama${warmed ? "" : "; it will finish loading on Pi's first request"}`);
  return installed;
}

async function candidateFromDownloaded(kind, label, baseUrl, models) {
  if (!models.length) return null;
  if (kind === "lm-studio" && await lmsAvailable()) {
    try { await startLmStudioServerIfNeeded(); } catch {}
  }
  const choice = await capabilityChoice(kind, baseUrl, models);
  if (!choice.model) return null;
  const scored = scoreModelForRole("repair", descriptorFor(choice.model, choice.descriptors), choice.hardware);
  return { kind, label, model: choice.model, score: scored.score };
}

async function main() {
  if (process.env.PLOTPICKLE_REPAIR_AUTOLOAD === "0") return;

  const exposed = await alreadyExposedCandidate();
  if (exposed) {
    if (exposed.kind === "ollama") await warmOllama(exposed.model);
    output(`Developer repair model ............... READY  ${exposed.model} via ${exposed.label}`);
    return;
  }

  if (requestedWorker !== "mastra-qwen" && !preferredEndpoint) {
    const [lmModels, ollamaModels] = await Promise.all([downloadedLmStudioModels(), ollamaInstalledModels()]);
    const candidates = (await Promise.all([
      candidateFromDownloaded("lm-studio", "LM Studio", "http://127.0.0.1:1234/v1", lmModels),
      candidateFromDownloaded("ollama", "Ollama", "http://127.0.0.1:11434/v1", ollamaModels),
    ])).filter(Boolean).sort((a, b) => b.score - a.score || rankApprovedCodingModel(a.model) - rankApprovedCodingModel(b.model));
    const preferred = preferredModel
      ? candidates.find((item) => modelKey(item.model) === modelKey(preferredModel))
      : null;
    const selected = preferred || candidates[0];

    if (selected?.kind === "lm-studio") {
      const model = safeModelKey(selected.model);
      output(`Developer repair model ............. LOADING  ${model} via LM Studio`);
      await runLms(["load", model, "--ttl", "3600", "-y"], 180_000);
      await startLmStudioServerIfNeeded();
      const loaded = await waitForLmStudioModel(model);
      if (!loaded) throw new Error(`LM Studio loaded ${model}, but it did not become available through http://127.0.0.1:1234/v1/models.`);
      output(`Developer repair model ............... READY  ${loaded} via LM Studio`);
      return;
    }

    if (selected?.kind === "ollama") {
      const model = safeModelKey(selected.model);
      output(`Developer repair model ............. LOADING  ${model} via Ollama`);
      const warmed = await warmOllama(model);
      if (!warmed) output(`Developer repair model ............... READY  ${model} via Ollama; it will finish loading on Pi's first request`);
      else output(`Developer repair model ............... READY  ${model} via Ollama`);
      return;
    }

    const installed = await ensureDefaultPiOllamaModel();
    if (installed) return;

    const localModels = [...new Set([...lmModels, ...ollamaModels])];
    output("Developer repair model ........... NOT READY  no repair-capable local model fits the current Pi policy and hardware.");
    if (localModels.length) output(`Local models seen .................... INFO  ${localModels.slice(0, 8).join(", ")}`);
    output(`Recommended lightweight option ...... INFO  ${DEFAULT_OLLAMA_PI_MODEL} via Ollama.`);
    if (!allowAutoDownload) output("Automatic download ................ DISABLED  PLOTPICKLE_REPAIR_AUTO_DOWNLOAD=0");
    throw new Error("Pi repair readiness failed because no suitable local coding/agent model is available.");
  }

  if (requestedWorker === "mastra-qwen") {
    const lmModels = await downloadedLmStudioModels();
    const selected = choose(lmModels);
    if (selected) {
      const model = safeModelKey(selected);
      output(`Legacy repair model ................ LOADING  ${model} via LM Studio`);
      await runLms(["load", model, "--ttl", "3600", "-y"], 180_000);
      await startLmStudioServerIfNeeded();
      const loaded = await waitForLmStudioModel(model);
      if (!loaded) throw new Error(`LM Studio loaded ${model}, but it did not become available through the OpenAI-compatible endpoint.`);
      output(`Legacy repair model .................. READY  ${loaded} via LM Studio`);
      return;
    }
    throw new Error("Legacy repair readiness failed because its dedicated local model is not installed.");
  }
}

main().catch((error) => {
  if (!quiet) console.error(`[repair-model] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 2;
});
