#!/usr/bin/env node

import { execFile } from "node:child_process";
import process from "node:process";
import { promisify } from "node:util";

const exec = promisify(execFile);
const args = process.argv.slice(2);
const quiet = args.includes("--quiet");
const requestedWorker = (() => {
  const index = args.indexOf("--worker");
  return (index >= 0 && index + 1 < args.length ? args[index + 1] : process.env.PLOTPICKLE_REPAIR_WORKER || "pi").toLowerCase();
})();

const APPROVED_FRAGMENTS = [
  "qwen3.8-27b",
  "qwen-3.8-27b",
  "qwen3-coder-30b",
  "qwen2.5-coder-32b",
  "devstral-small",
  "codestral",
  "deepseek-coder",
  "gpt-oss-20b",
];

function key(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function approved(value) {
  const candidate = key(value);
  return APPROVED_FRAGMENTS.some((fragment) => candidate.includes(key(fragment)));
}

function safeModelKey(value) {
  const model = String(value || "").trim();
  if (!/^[a-zA-Z0-9._:/+@\-]+$/.test(model)) throw new Error(`LM Studio model key contains unsupported shell characters: ${model}`);
  return model;
}

function modelKeyFromRow(row) {
  if (!row || typeof row !== "object") return "";
  for (const field of ["modelKey", "path", "id", "identifier"]) {
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

async function downloadedCodingModels() {
  const raw = await runLms(["ls", "--llm", "--json"], 20_000);
  const parsed = JSON.parse(raw || "[]");
  if (!Array.isArray(parsed)) return [];
  return parsed.map(modelKeyFromRow).filter((value) => value && approved(value));
}

function rankModel(value) {
  const normalized = key(value);
  const index = APPROVED_FRAGMENTS.findIndex((fragment) => normalized.includes(key(fragment)));
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

async function serverRunning() {
  try {
    const raw = await runLms(["server", "status", "--json", "--quiet"], 10_000);
    return JSON.parse(raw || "{}").running === true;
  } catch {
    return false;
  }
}

async function startServerIfNeeded() {
  if (await serverRunning()) return;
  await runLms(["server", "start", "--bind", "127.0.0.1"], 30_000);
}

async function loadedApprovedModel() {
  try {
    const response = await fetch("http://127.0.0.1:1234/v1/models", {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(2_500),
    });
    if (!response.ok) return "";
    const body = await response.json();
    const models = Array.isArray(body?.data)
      ? body.data.flatMap((item) => typeof item?.id === "string" ? [item.id] : [])
      : [];
    return models.find(approved) || "";
  } catch {
    return "";
  }
}

async function waitForModel(timeoutMs = 45_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const model = await loadedApprovedModel();
    if (model) return model;
    await new Promise((resolve) => setTimeout(resolve, 1_000));
  }
  return "";
}

async function main() {
  if (requestedWorker === "mastra-qwen") return;
  if (process.env.PLOTPICKLE_REPAIR_AUTOLOAD === "0") return;
  if (await loadedApprovedModel()) return;
  if (!(await lmsAvailable())) return;

  const downloaded = await downloadedCodingModels();
  if (!downloaded.length) {
    if (!quiet) process.stdout.write("LM Studio repair model .............. NOT FOUND  no approved coding model is downloaded; nothing was downloaded automatically.\n");
    return;
  }

  const selected = safeModelKey(downloaded.sort((a, b) => rankModel(a) - rankModel(b))[0]);
  if (!quiet) process.stdout.write(`LM Studio repair model .............. LOADING  ${selected}\n`);
  await runLms(["load", selected, "--ttl", "3600", "-y"], 180_000);
  await startServerIfNeeded();
  const loaded = await waitForModel();
  if (!loaded) throw new Error(`LM Studio loaded ${selected}, but it did not become available through http://127.0.0.1:1234/v1/models.`);
  if (!quiet) process.stdout.write(`LM Studio repair model .............. READY  ${loaded}\n`);
}

main().catch((error) => {
  if (!quiet) console.error(`[repair-model] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
