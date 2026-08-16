const ROLE_NAMES = ["fast", "quality", "deep", "vision", "repair"];
const cache = new Map();
const CACHE_MS = 30_000;

function clean(value) {
  return String(value || "").trim();
}

function lowerList(values) {
  return [...new Set((Array.isArray(values) ? values : []).map((value) => clean(value).toLowerCase()).filter(Boolean))];
}

function modelKey(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function numberValue(value) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : 0;
}

export function parseParameterBillions(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value > 1_000_000 ? value / 1_000_000_000 : value;
  }
  const raw = clean(value).toUpperCase().replace(/,/g, "");
  const match = raw.match(/([0-9]+(?:\.[0-9]+)?)\s*([BMT])\b/);
  if (!match) return 0;
  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return 0;
  if (match[2] === "B") return amount;
  if (match[2] === "M") return amount / 1000;
  return amount * 1000;
}

export function parseQuantizationBits(value) {
  const raw = clean(value).toUpperCase();
  const q = raw.match(/(?:^|[^A-Z])Q([2-8])(?:_|\b)/);
  if (q) return Number(q[1]);
  const bit = raw.match(/([2-8])\s*-?BIT/);
  if (bit) return Number(bit[1]);
  if (/MXFP4|FP4|INT4/.test(raw)) return 4;
  if (/FP8|INT8/.test(raw)) return 8;
  if (/FP16|F16|BF16/.test(raw)) return 16;
  return 0;
}

function contextFromModelInfo(modelInfo) {
  if (!modelInfo || typeof modelInfo !== "object") return 0;
  let best = 0;
  for (const [key, value] of Object.entries(modelInfo)) {
    if (!/(?:^|\.)context_length$/i.test(key)) continue;
    best = Math.max(best, numberValue(value));
  }
  return best;
}

function nameParameterBillions(id) {
  const raw = clean(id).toLowerCase();
  const matches = [...raw.matchAll(/(?:^|[^0-9])([0-9]+(?:\.[0-9]+)?)b(?:[^a-z0-9]|$)/g)];
  if (!matches.length) return 0;
  return Number(matches[matches.length - 1][1]) || 0;
}

function inferNameHints(id, family = "") {
  const value = `${clean(id)} ${clean(family)}`.toLowerCase();
  const coding = /coder|codestral|devstral|deepseek[-_. ]?coder|starcoder|codeqwen/.test(value);
  const vision = /(?:^|[-_. ])(?:vl|vision|visual|multimodal|omni)(?:[-_. :]|$)/.test(value);
  const qwen3Family = /qwen[-_. ]?3(?:\.|[-_. ]|$)/.test(value);
  const thinking = qwen3Family || /gpt[-_. ]?oss|deepseek[-_. ]?r1|reasoning|thinking/.test(value);
  const tools = coding || qwen3Family || /gpt[-_. ]?oss|agentic|tool[-_. ]?use/.test(value);
  return { coding, vision, thinking, tools };
}

export function normalizeModelDescriptor(input = {}) {
  const id = clean(input.id || input.model || input.name || input.key);
  const family = clean(input.family || input.architecture || input.arch);
  const native = lowerList(input.nativeCapabilities || input.capabilities);
  const hints = inferNameHints(id, family);
  const parameterB = numberValue(input.parameterB)
    || parseParameterBillions(input.parameterSize || input.paramsString || input.parameterCount)
    || nameParameterBillions(id);
  const contextTokens = numberValue(input.contextTokens || input.contextLength || input.maxContextLength)
    || contextFromModelInfo(input.modelInfo);
  const quantization = clean(input.quantization || input.quantizationLevel);
  const quantizationBits = numberValue(input.quantizationBits) || parseQuantizationBits(quantization);
  const sizeBytes = numberValue(input.sizeBytes || input.size);
  const nativeHas = (pattern) => native.some((item) => pattern.test(item));
  const embeddingLike = /embed|embedding|rerank/.test(`${id} ${family}`.toLowerCase());
  const completion = !embeddingLike && (native.length === 0 || nativeHas(/completion|chat|generate|text/));
  const vision = nativeHas(/vision|image|multimodal/) || hints.vision || input.vision === true;
  const tools = nativeHas(/tool|function/) || hints.tools || input.trainedForToolUse === true;
  const thinking = nativeHas(/think|reason/) || hints.thinking || input.reasoning === true;
  const coding = nativeHas(/code|coding/) || hints.coding;
  const longContext = contextTokens >= 32_768;
  const agentic = completion && tools && (coding || thinking || longContext);
  return {
    id,
    runtime: clean(input.runtime),
    family,
    families: lowerList(input.families),
    parameterSize: clean(input.parameterSize || input.paramsString) || (parameterB ? `${Number(parameterB.toFixed(2))}B` : ""),
    parameterB,
    quantization,
    quantizationBits,
    sizeBytes,
    contextTokens,
    nativeCapabilities: native,
    capabilities: { completion, vision, tools, thinking, coding, longContext, agentic },
    metadataSource: clean(input.metadataSource) || "name-inference",
  };
}

function estimatedWorkingSetGb(model) {
  if (model.sizeBytes > 0) return (model.sizeBytes / 1024 ** 3) * 1.18;
  if (!model.parameterB) return 0;
  const bits = model.quantizationBits || 5;
  return model.parameterB * (bits / 8) * 1.2;
}

export function modelHardwareFit(modelInput, hardware = {}) {
  const model = normalizeModelDescriptor(modelInput);
  const ramGb = numberValue(hardware.ramGb);
  const vramGb = numberValue(hardware.vramGb);
  const workingSetGb = estimatedWorkingSetGb(model);
  if (!workingSetGb) return { id: "unknown", label: "hardware fit unknown", workingSetGb: 0, score: 0 };
  if (vramGb >= 4 && workingSetGb <= vramGb * 0.9) {
    return { id: "gpu", label: "fits GPU", workingSetGb, score: 28 };
  }
  if (hardware.cpuGpuSplit !== false && vramGb > 0 && ramGb > 0 && workingSetGb <= (vramGb * 0.9) + (ramGb * 0.35)) {
    return { id: "split", label: "CPU/GPU split", workingSetGb, score: 4 };
  }
  if (ramGb > 0 && workingSetGb <= ramGb * 0.55) {
    return { id: "cpu", label: "CPU/RAM only", workingSetGb, score: -8 };
  }
  if (ramGb || vramGb) return { id: "too-large", label: "too large for automatic routing", workingSetGb, score: -200 };
  return { id: "unknown", label: "hardware fit unknown", workingSetGb, score: 0 };
}

function parameterScore(role, parameterB, fit) {
  if (!parameterB) return 0;
  if (role === "fast") {
    if (parameterB >= 2 && parameterB <= 9) return 36;
    if (parameterB <= 14) return 14;
    return -40;
  }
  if (role === "quality") {
    if (parameterB >= 7 && parameterB <= 14) return 34;
    if (parameterB > 14 && parameterB <= 32) return fit.id === "gpu" ? 48 : 20;
    if (parameterB >= 4 && parameterB < 7) return 10;
    return parameterB > 32 ? 4 : 0;
  }
  if (role === "deep") {
    if (parameterB >= 14 && parameterB <= 40) return 38;
    if (parameterB >= 7) return 20;
    return 0;
  }
  if (role === "vision") {
    if (parameterB >= 4 && parameterB <= 14) return 28;
    if (parameterB > 14 && parameterB <= 32) return fit.id === "gpu" ? 38 : 14;
    return 6;
  }
  if (role === "repair") {
    if (parameterB >= 7 && parameterB <= 14) return 28;
    if (parameterB > 14 && parameterB <= 32) return fit.id === "gpu" ? 38 : 10;
    if (parameterB >= 3) return 10;
  }
  return 0;
}

export function scoreModelForRole(role, modelInput, hardware = {}) {
  if (!ROLE_NAMES.includes(role)) throw new Error(`Unknown local model role: ${role}`);
  const model = normalizeModelDescriptor(modelInput);
  const cap = model.capabilities;
  const fit = modelHardwareFit(model, hardware);
  const reasons = [];
  if (!model.id || !cap.completion || fit.id === "too-large") {
    return { role, model, eligible: false, score: -999, fit, reasons: [!cap.completion ? "not a text-generation model" : fit.label] };
  }
  if (role === "vision" && !cap.vision) return { role, model, eligible: false, score: -999, fit, reasons: ["no detected vision capability"] };
  if (role === "repair" && !(cap.coding || cap.tools)) return { role, model, eligible: false, score: -999, fit, reasons: ["no detected coding or tool-use capability"] };

  let score = 20 + fit.score + parameterScore(role, model.parameterB, fit);
  if (fit.id === "gpu") reasons.push("fits GPU");
  else if (fit.id === "split") reasons.push("can run with CPU/GPU split");
  else if (fit.id === "cpu") reasons.push("runs from system RAM");

  if (cap.tools) { score += role === "repair" ? 28 : 10; reasons.push("tool use"); }
  if (cap.coding) { score += role === "repair" ? 34 : 6; reasons.push("coding tuned"); }
  if (cap.thinking) { score += role === "deep" ? 28 : role === "quality" || role === "repair" ? 12 : 3; reasons.push("thinking/reasoning"); }
  if (cap.longContext) { score += role === "repair" ? 14 : role === "quality" || role === "deep" ? 12 : 5; reasons.push(`${Math.round(model.contextTokens / 1024)}K context`); }
  if (cap.vision) { score += role === "vision" ? 38 : role === "quality" ? 5 : 0; if (role === "vision" || role === "quality") reasons.push("vision input"); }
  if (cap.agentic) { score += role === "repair" ? 18 : role === "deep" ? 10 : 5; reasons.push("agent-ready"); }

  if (fit.id === "split" && model.parameterB > 20 && (role === "fast" || role === "quality" || role === "repair" || role === "vision")) {
    score -= 28;
    reasons.push("large model is on-demand on this hardware");
  }
  if (role === "fast" && model.contextTokens >= 64_000) score += 2;
  return { role, model, eligible: score > 0, score, fit, reasons };
}

export function recommendModelsForRoles(models = [], hardware = {}) {
  const normalized = [...new Map((models || []).map((item) => {
    const model = normalizeModelDescriptor(item);
    return [modelKey(model.id), model];
  }).filter(([key]) => Boolean(key))).values()];
  return Object.fromEntries(ROLE_NAMES.map((role) => {
    const ranked = normalized
      .map((model) => scoreModelForRole(role, model, hardware))
      .filter((item) => item.eligible)
      .sort((a, b) => b.score - a.score || a.model.id.localeCompare(b.model.id));
    return [role, ranked[0] || null];
  }));
}

export function chooseModelForRole(role, models = [], hardware = {}, preferred = "") {
  const normalized = (models || []).map(normalizeModelDescriptor);
  if (preferred) {
    const wanted = modelKey(preferred);
    const exact = normalized.find((model) => modelKey(model.id) === wanted);
    if (exact) {
      const scored = scoreModelForRole(role, exact, hardware);
      if (scored.eligible) return scored;
    }
  }
  return recommendModelsForRoles(normalized, hardware)[role] || null;
}

function nativeBase(baseUrl) {
  const url = new URL(baseUrl);
  url.pathname = "/";
  url.search = "";
  url.hash = "";
  return url.toString().replace(/\/$/, "");
}

async function fetchJson(url, init, timeoutMs) {
  try {
    const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  }
}

async function mapLimited(values, limit, mapper) {
  const output = new Array(values.length);
  let cursor = 0;
  await Promise.all(Array.from({ length: Math.min(limit, values.length) }, async () => {
    while (cursor < values.length) {
      const index = cursor++;
      output[index] = await mapper(values[index], index);
    }
  }));
  return output;
}

async function ollamaDescriptors(baseUrl, modelIds, timeoutMs) {
  const origin = nativeBase(baseUrl);
  const tags = await fetchJson(`${origin}/api/tags`, { headers: { Accept: "application/json" } }, timeoutMs);
  const rows = Array.isArray(tags?.models) ? tags.models : [];
  return mapLimited(modelIds.slice(0, 32), 4, async (id) => {
    const row = rows.find((item) => clean(item?.name || item?.model).toLowerCase() === id.toLowerCase()) || {};
    const shown = await fetchJson(`${origin}/api/show`, {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "application/json" },
      body: JSON.stringify({ model: id, verbose: false }),
    }, timeoutMs);
    const details = shown?.details || row?.details || {};
    return normalizeModelDescriptor({
      id,
      runtime: "ollama",
      family: details.family,
      families: details.families,
      parameterSize: details.parameter_size,
      quantization: details.quantization_level,
      sizeBytes: row?.size,
      contextLength: contextFromModelInfo(shown?.model_info),
      modelInfo: shown?.model_info,
      nativeCapabilities: shown?.capabilities,
      metadataSource: shown ? "ollama-api-show" : row?.details ? "ollama-api-tags" : "name-inference",
    });
  });
}

async function lmStudioDescriptors(baseUrl, modelIds, timeoutMs) {
  const origin = nativeBase(baseUrl);
  const body = await fetchJson(`${origin}/api/v1/models`, { headers: { Accept: "application/json" } }, timeoutMs);
  const rows = Array.isArray(body?.models) ? body.models : [];
  if (!rows.length) return modelIds.map((id) => normalizeModelDescriptor({ id, runtime: "lm-studio" }));
  return modelIds.map((id) => {
    const wanted = modelKey(id);
    const row = rows.find((item) => [item?.key, item?.id, item?.display_name].some((value) => modelKey(value) === wanted)) || {};
    const reasoning = row?.reasoning && typeof row.reasoning === "object";
    return normalizeModelDescriptor({
      id,
      runtime: "lm-studio",
      family: row?.architecture,
      parameterSize: row?.params_string,
      quantization: row?.quantization?.name,
      quantizationBits: row?.quantization?.bits_per_weight,
      sizeBytes: row?.size_bytes,
      contextLength: row?.max_context_length || row?.loaded_instances?.[0]?.config?.context_length,
      vision: row?.capabilities?.vision === true,
      trainedForToolUse: row?.capabilities?.trained_for_tool_use === true,
      reasoning,
      nativeCapabilities: [
        row?.capabilities?.vision ? "vision" : "",
        row?.capabilities?.trained_for_tool_use ? "tools" : "",
        reasoning ? "thinking" : "",
        row?.type === "llm" ? "completion" : "",
      ],
      metadataSource: Object.keys(row).length ? "lm-studio-api-v1" : "name-inference",
    });
  });
}

export async function probeRuntimeModelCapabilities({ kind, baseUrl, models = [], timeoutMs = 1_800 } = {}) {
  const modelIds = [...new Set((models || []).map(clean).filter(Boolean))];
  const key = `${kind}|${baseUrl}|${modelIds.join("|")}`;
  const cached = cache.get(key);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.value;
  let descriptors;
  if (kind === "ollama") descriptors = await ollamaDescriptors(baseUrl, modelIds, timeoutMs);
  else if (kind === "lm-studio") descriptors = await lmStudioDescriptors(baseUrl, modelIds, timeoutMs);
  else descriptors = modelIds.map((id) => normalizeModelDescriptor({ id, runtime: kind }));
  cache.set(key, { at: Date.now(), value: descriptors });
  return descriptors;
}

export const LOCAL_CAPABILITY_ROLES = Object.freeze([...ROLE_NAMES]);
