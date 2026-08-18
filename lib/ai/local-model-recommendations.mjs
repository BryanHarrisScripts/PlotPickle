import {
  modelHardwareFit,
  normalizeModelDescriptor,
  scoreModelForRole,
} from "./local-model-capabilities.mjs";

export const LOCAL_MODEL_PREFERENCES = ["fastest", "balanced", "best-quality", "lowest-memory"];

export const LOCAL_MODEL_PREFERENCE_PROFILES = Object.freeze({
  fastest: {
    id: "fastest",
    label: "Fastest",
    description: "Prefer the quickest safe model for each PlotPickle job.",
  },
  balanced: {
    id: "balanced",
    label: "Balanced",
    description: "Balance speed, quality and memory fit. Recommended for most work.",
  },
  "best-quality": {
    id: "best-quality",
    label: "Best Quality",
    description: "Prefer the strongest capable model that still fits this computer safely.",
  },
  "lowest-memory": {
    id: "lowest-memory",
    label: "Lowest Memory",
    description: "Prefer the smallest capable model to leave the most memory free.",
  },
});

function clean(value) {
  return String(value || "").trim();
}

function modelKey(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function positive(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function normalizedPreference(value) {
  return LOCAL_MODEL_PREFERENCES.includes(value) ? value : "balanced";
}

function benchmarkForModel(benchmarks, modelId) {
  const source = benchmarks && typeof benchmarks === "object" && benchmarks.models && typeof benchmarks.models === "object"
    ? benchmarks.models
    : benchmarks;
  if (!source || typeof source !== "object") return null;
  const wanted = modelKey(modelId);
  for (const [id, evidence] of Object.entries(source)) {
    if (modelKey(id) !== wanted || !evidence || typeof evidence !== "object") continue;
    return evidence;
  }
  return null;
}

function generationBaseTokens(generation) {
  if (generation === "blackwell") return 92;
  if (generation === "ada") return 72;
  if (generation === "ampere") return 56;
  if (generation === "turing") return 42;
  if (generation === "pascal") return 32;
  if (generation === "none") return 10;
  return 28;
}

function quantizationFactor(model) {
  const bits = positive(model.quantizationBits);
  if (!bits) return 1;
  if (bits <= 4) return 1.1;
  if (bits <= 5) return 1;
  if (bits <= 6) return 0.9;
  if (bits <= 8) return 0.76;
  return 0.52;
}

function estimatedMidTokens(model, hardware, fit) {
  if (!model.parameterB) return 0;
  const ratio = Math.max(0.5, model.parameterB / 4);
  const gpuEstimate = generationBaseTokens(hardware.gpuGeneration) / Math.pow(ratio, 0.85);
  const quantFactor = quantizationFactor(model);
  if (fit.id === "gpu") return gpuEstimate * quantFactor;
  if (fit.id === "split") return gpuEstimate * quantFactor * 0.48;
  if (fit.id === "cpu") {
    const threads = Math.max(4, positive(hardware.cpuThreads) || 8);
    return ((threads * 0.6) / Math.pow(ratio, 0.9)) * quantFactor;
  }
  return 0;
}

export function modelThroughput(modelInput, hardware = {}, benchmarks = {}) {
  const model = normalizeModelDescriptor(modelInput);
  const evidence = benchmarkForModel(benchmarks, model.id);
  const measured = positive(evidence?.tokensPerSecond);
  if (measured) {
    return {
      source: "measured",
      mid: round1(measured),
      low: round1(measured),
      high: round1(measured),
      measuredAt: clean(evidence?.measuredAt),
      runtime: clean(evidence?.runtime),
    };
  }
  const fit = modelHardwareFit(model, hardware);
  const mid = estimatedMidTokens(model, hardware, fit);
  if (!mid) {
    return { source: "unknown", mid: 0, low: 0, high: 0, measuredAt: "", runtime: "" };
  }
  return {
    source: "estimated",
    mid: round1(mid),
    low: round1(Math.max(0.1, mid * 0.75)),
    high: round1(mid * 1.25),
    measuredAt: "",
    runtime: "",
  };
}

function qualityPotential(model) {
  const cap = model.capabilities || {};
  let score = positive(model.parameterB) * 3;
  if (cap.thinking) score += 18;
  if (cap.tools) score += 8;
  if (cap.coding) score += 7;
  if (cap.longContext) score += 7;
  if (cap.vision) score += 4;
  if (cap.agentic) score += 6;
  return round1(score);
}

function fitHeadroomGb(fit, hardware) {
  const working = positive(fit.workingSetGb);
  if (!working) return 0;
  const vram = positive(hardware.vramGb);
  const ram = positive(hardware.ramGb);
  if (fit.id === "gpu") return Math.max(0, (vram * 0.9) - working);
  if (fit.id === "split") return Math.max(0, (vram * 0.9) + (ram * 0.35) - working);
  if (fit.id === "cpu") return Math.max(0, (ram * 0.55) - working);
  return 0;
}

function speculativeRecommendation(model, fit, hardware, benchmarks) {
  const evidence = benchmarkForModel(benchmarks, model.id);
  const baseline = positive(evidence?.tokensPerSecond);
  const speculative = positive(evidence?.speculativeTokensPerSecond);
  const headroomGb = fitHeadroomGb(fit, hardware);
  if (!baseline || !speculative) {
    return {
      recommended: false,
      reason: "Off until a local benchmark proves it is faster.",
      gainPercent: 0,
      headroomGb: round1(headroomGb),
    };
  }
  const gainPercent = ((speculative / baseline) - 1) * 100;
  const recommended = gainPercent >= 5 && headroomGb >= 1.5;
  return {
    recommended,
    reason: recommended
      ? `Measured ${Math.round(gainPercent)}% faster with enough memory headroom.`
      : gainPercent < 5
        ? "Measured gain is too small to justify speculative decoding."
        : "Measured speed improved, but memory headroom is too small.",
    gainPercent: round1(gainPercent),
    headroomGb: round1(headroomGb),
  };
}

export function buildLocalModelCatalog(models = [], hardware = {}, benchmarks = {}) {
  const normalized = [...new Map((models || []).map((input) => {
    const model = normalizeModelDescriptor(input);
    return [modelKey(model.id), model];
  }).filter(([key]) => Boolean(key))).values()];

  return normalized.map((model) => {
    const fit = modelHardwareFit(model, hardware);
    const throughput = modelThroughput(model, hardware, benchmarks);
    return {
      ...model,
      fit,
      throughput,
      qualityPotential: qualityPotential(model),
      acceleration: speculativeRecommendation(model, fit, hardware, benchmarks),
    };
  });
}

function fitRank(id) {
  if (id === "gpu") return 3;
  if (id === "split") return 2;
  if (id === "cpu") return 1;
  return 0;
}

function preferenceScore(preference, roleScore, catalog) {
  const throughput = positive(catalog.throughput.mid);
  const workingSet = positive(catalog.fit.workingSetGb);
  const quality = positive(catalog.qualityPotential);
  const fit = fitRank(catalog.fit.id);
  if (preference === "fastest") return (throughput * 100) + (fit * 10) + roleScore;
  if (preference === "lowest-memory") return (10_000 - (workingSet * 100)) + (fit * 10) + Math.min(throughput, 50) + (roleScore * 0.1);
  if (preference === "best-quality") return (roleScore * 4) + (quality * 2) + (fit * 12) + Math.min(throughput, 30);
  return (roleScore * 3) + (Math.min(throughput, 60) * 2) + (fit * 18) - workingSet;
}

export function chooseModelForPreference(role, models = [], hardware = {}, preference = "balanced", benchmarks = {}, preferred = "") {
  const catalog = buildLocalModelCatalog(models, hardware, benchmarks);
  const selectedPreference = normalizedPreference(preference);
  const wanted = modelKey(preferred);
  if (wanted) {
    const exact = catalog.find((item) => modelKey(item.id) === wanted);
    if (exact) {
      const scored = scoreModelForRole(role, exact, hardware);
      if (scored.eligible) return { ...scored, catalog: exact, preference: selectedPreference };
    }
  }
  const ranked = catalog
    .map((item) => {
      const roleFit = scoreModelForRole(role, item, hardware);
      return {
        ...roleFit,
        catalog: item,
        preference: selectedPreference,
        preferenceScore: preferenceScore(selectedPreference, roleFit.score, item),
      };
    })
    .filter((item) => item.eligible && item.catalog.fit.id !== "too-large")
    .sort((a, b) => b.preferenceScore - a.preferenceScore || b.score - a.score || a.model.id.localeCompare(b.model.id));
  return ranked[0] || null;
}

export function recommendLocalModelPreferences(models = [], hardware = {}, benchmarks = {}) {
  const profiles = LOCAL_MODEL_PREFERENCES.map((preference) => {
    const roles = Object.fromEntries(["fast", "quality", "deep", "vision", "repair"].map((role) => {
      const selected = chooseModelForPreference(role, models, hardware, preference, benchmarks);
      return [role, selected ? selected.model.id : ""];
    }));
    const primaryId = roles.quality || roles.fast || roles.deep || roles.repair || roles.vision || "";
    const primary = buildLocalModelCatalog(models, hardware, benchmarks).find((item) => modelKey(item.id) === modelKey(primaryId));
    return {
      ...LOCAL_MODEL_PREFERENCE_PROFILES[preference],
      roles,
      primaryModel: primaryId,
      primaryFit: primary?.fit?.label || "",
      workingSetGb: round1(primary?.fit?.workingSetGb || 0),
      throughput: primary?.throughput || { source: "unknown", mid: 0, low: 0, high: 0, measuredAt: "", runtime: "" },
    };
  });
  return profiles;
}
