#!/usr/bin/env node

import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";
import {
  approvedCodingModel,
  chooseApprovedCodingModel,
  dedicatedLegacyRepairModel,
  rankApprovedCodingModel,
} from "./developer-repair-model-policy.mjs";

const exec = promisify(execFile);
const args = process.argv.slice(2);
const quiet = args.includes("--quiet");
const requestedWorker = (() => {
  const index = args.indexOf("--worker");
  return (index >= 0 && index + 1 < args.length ? args[index + 1] : process.env.PLOTPICKLE_REPAIR_WORKER || "pi").toLowerCase();
})();
const preferredModel = String(process.env.PLOTPICKLE_REPAIR_MODEL || "").trim();
const preferredEndpoint = String(process.env.PLOTPICKLE_REPAIR_ENDPOINT || "").trim().replace(/\/$/, "");

function safeModelKey(value) {
  const model = String(value || "").trim();
  if (!/^[a-zA-Z0-9._:/+@\-]+$/.test(model)) throw new Error(`Local model key contains unsupported shell characters: ${model}`);
  return model;
}

function modelKeyFromRow(row) {
  if (!row || typeof row !== "object") return "";
  for (const field of ["modelKey", "path", "id", "identifier", "name", "model"]) {
    if (typeof row[field] === "string" && row[field].trim()) return row[field].trim();
  }
  return "";
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

async function waitForLmStudioModel(model, timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const models = await openAiModels("http://127.0.0.1:1234/v1");
    if (models.some((item) => item === model || approvedCodingModel(item))) return chooseApprovedCodingModel(models, model) || model;
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
    for (const model of models.filter(workerAccepts)) candidates.push({ ...endpoint, model });
  }
  candidates.sort((a, b) => requestedWorker === "mastra-qwen" ? 0 : rankApprovedCodingModel(a.model) - rankApprovedCodingModel(b.model));
  if (preferredModel) {
    const exact = candidates.find((item) => item.model.toLowerCase() === preferredModel.toLowerCase());
    if (exact) return exact;
  }
  return candidates[0] || null;
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
    const candidates = [
      ...lmModels.filter(approvedCodingModel).map((model) => ({ kind: "lm-studio", label: "LM Studio", model })),
      ...ollamaModels.filter(approvedCodingModel).map((model) => ({ kind: "ollama", label: "Ollama", model })),
    ].sort((a, b) => rankApprovedCodingModel(a.model) - rankApprovedCodingModel(b.model));
    const preferred = preferredModel
      ? candidates.find((item) => item.model.toLowerCase() === preferredModel.toLowerCase())
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

    const localModels = [...new Set([...lmModels, ...ollamaModels])];
    output("Developer repair model ........... NOT FOUND  no approved local coding model is installed; PlotPickle did not download one automatically.");
    if (localModels.length) output(`Local models seen .................... INFO  ${localModels.slice(0, 8).join(", ")}`);
    output("Recommended lightweight option ...... INFO  Qwen2.5-Coder 7B (LM Studio or Ollama) is accepted for Pi on modest local hardware.");
    return;
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
    }
  }
}

main().catch((error) => {
  if (!quiet) console.error(`[repair-model] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
