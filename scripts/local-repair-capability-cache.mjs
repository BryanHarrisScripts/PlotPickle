import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";

function localRoot() {
  return process.env.LOCALAPPDATA || path.join(os.homedir(), "AppData", "Local");
}

function cachePath() {
  return path.join(localRoot(), "PlotPickle", "repair-model-capabilities.json");
}

function modelKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function readRepairCapabilityCache() {
  try {
    const parsed = JSON.parse(readFileSync(cachePath(), "utf8"));
    const rows = Array.isArray(parsed?.models) ? parsed.models : [];
    return rows.filter((row) => row && typeof row.model === "string" && row.repairEligible === true);
  } catch {
    return [];
  }
}

export function repairCapabilityCacheApproves(model) {
  const wanted = modelKey(model);
  if (!wanted) return false;
  return readRepairCapabilityCache().some((row) => modelKey(row.model) === wanted);
}

export function writeRepairCapabilityCache(models) {
  const rows = [...new Map((models || []).flatMap((row) => {
    const model = String(row?.model || "").trim();
    if (!model || row?.repairEligible !== true) return [];
    return [[modelKey(model), {
      model,
      repairEligible: true,
      score: Number(row?.score || 0),
      fit: String(row?.fit || ""),
      metadataSource: String(row?.metadataSource || ""),
      capabilities: Array.isArray(row?.capabilities) ? row.capabilities.map(String) : [],
    }]];
  })).values()];
  const file = cachePath();
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify({ version: 1, checkedAt: new Date().toISOString(), models: rows }, null, 2)}\n`, "utf8");
  return file;
}
