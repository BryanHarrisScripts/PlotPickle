#!/usr/bin/env node

import process from "node:process";
import { approvedCodingModel } from "../../scripts/developer-repair-model-policy.mjs";
import { resolvePiLocalRuntime } from "../../scripts/pi-worker-runtime.mjs";

const RUNTIMES = [
  { kind: "llama.cpp", label: "llama.cpp", baseUrl: "http://127.0.0.1:8080/v1", priority: 0 },
  { kind: "lm-studio", label: "LM Studio", baseUrl: "http://127.0.0.1:1234/v1", priority: 1 },
  { kind: "ollama", label: "Ollama", baseUrl: "http://127.0.0.1:11434/v1", priority: 2 },
  { kind: "openai-compatible", label: "OpenAI-compatible", baseUrl: "http://127.0.0.1:8000/v1", priority: 3 },
];

function normalizeBaseUrl(value) {
  const raw = String(value || "").trim().replace(/\/$/u, "");
  if (!raw) return "";
  const normalized = /\/v1$/iu.test(raw) ? raw : `${raw}/v1`;
  if (!URL.canParse(normalized)) return "";
  const parsed = new URL(normalized);
  if (!new Set(["127.0.0.1", "localhost", "::1"]).has(parsed.hostname.toLowerCase())) return "";
  return parsed.toString().replace(/\/$/u, "");
}

function runtimeCandidates() {
  const configured = normalizeBaseUrl(process.env.PLOTPICKLE_REPAIR_ENDPOINT || "");
  const values = configured
    ? [{ kind: "configured", label: "Configured local runtime", baseUrl: configured, priority: -1 }, ...RUNTIMES]
    : RUNTIMES;
  const seen = new Set();
  return values.filter((item) => {
    const baseUrl = normalizeBaseUrl(item.baseUrl);
    if (!baseUrl || seen.has(baseUrl.toLowerCase())) return false;
    seen.add(baseUrl.toLowerCase());
    item.baseUrl = baseUrl;
    return true;
  });
}

async function probe(runtime) {
  try {
    const response = await fetch(`${runtime.baseUrl}/models`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(3_000),
    });
    if (!response.ok) return { ...runtime, ready: false, models: [], detail: `HTTP ${response.status}` };
    const body = await response.json();
    const ids = Array.isArray(body?.data)
      ? body.data.flatMap((item) => typeof item?.id === "string" ? [item.id.trim()] : []).filter(Boolean)
      : [];
    return { ...runtime, ready: true, models: [...new Set(ids)], detail: `${ids.length} model(s) advertised` };
  } catch (error) {
    return {
      ...runtime,
      ready: false,
      models: [],
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

export async function collectLocalReviewerInventory() {
  const probes = await Promise.all(runtimeCandidates().map(probe));
  let automatic = null;
  try {
    const resolved = await resolvePiLocalRuntime();
    automatic = {
      key: "automatic",
      runtime: resolved.kind || "automatic",
      label: resolved.label || "Automatic",
      baseUrl: normalizeBaseUrl(resolved.baseUrl),
      model: resolved.model || "",
      selectable: true,
      ready: true,
      detail: "Current Pi / Repair recommended local target.",
    };
  } catch (error) {
    automatic = {
      key: "automatic",
      runtime: "automatic",
      label: "Automatic · Pi / Repair recommended",
      baseUrl: "",
      model: "",
      selectable: true,
      ready: false,
      detail: error instanceof Error ? error.message : String(error),
    };
  }

  const candidates = probes.flatMap((runtime) => runtime.models.map((model) => ({
    key: `${runtime.kind}|${runtime.baseUrl}|${model}`,
    runtime: runtime.kind,
    label: runtime.label,
    baseUrl: runtime.baseUrl,
    model,
    selectable: approvedCodingModel(model),
    ready: runtime.ready,
    detail: approvedCodingModel(model)
      ? "Eligible for the existing Pi / Repair capability policy."
      : "Detected locally but not eligible for automatic Pi / Repair selection from current capability evidence.",
    priority: runtime.priority,
  })));
  candidates.sort((left, right) => left.priority - right.priority || left.label.localeCompare(right.label) || left.model.localeCompare(right.model));

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    automatic,
    candidates,
    runtimeDiagnostics: probes.map(({ kind, label, baseUrl, ready, detail }) => ({ kind, label, baseUrl, ready, detail })),
  };
}

if (process.argv.includes("--json")) {
  const report = await collectLocalReviewerInventory();
  process.stdout.write(`${JSON.stringify(report)}\n`);
}
