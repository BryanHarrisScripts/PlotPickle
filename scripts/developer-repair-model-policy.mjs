export const APPROVED_LOCAL_CODING_MODELS = [
  { fragment: "qwen2.5-coder-7b", label: "Qwen2.5-Coder 7B", tier: "light" },
  { fragment: "qwen2.5coder7b", label: "Qwen2.5-Coder 7B", tier: "light" },
  { fragment: "qwen2.5-coder-14b", label: "Qwen2.5-Coder 14B", tier: "medium" },
  { fragment: "qwen2.5coder14b", label: "Qwen2.5-Coder 14B", tier: "medium" },
  { fragment: "gpt-oss-20b", label: "GPT-OSS 20B", tier: "medium" },
  { fragment: "gptoss20b", label: "GPT-OSS 20B", tier: "medium" },
  { fragment: "qwen3.8-27b", label: "Qwen3.8 27B", tier: "heavy" },
  { fragment: "qwen-3.8-27b", label: "Qwen3.8 27B", tier: "heavy" },
  { fragment: "qwen_qwen3.8-27b", label: "Qwen3.8 27B", tier: "heavy" },
  { fragment: "qwen/qwen3.8-27b", label: "Qwen3.8 27B", tier: "heavy" },
  { fragment: "qwen3-coder-30b", label: "Qwen3-Coder 30B", tier: "heavy" },
  { fragment: "qwen3coder30b", label: "Qwen3-Coder 30B", tier: "heavy" },
  { fragment: "qwen2.5-coder-32b", label: "Qwen2.5-Coder 32B", tier: "heavy" },
  { fragment: "qwen2.5coder32b", label: "Qwen2.5-Coder 32B", tier: "heavy" },
  { fragment: "devstral-small", label: "Devstral Small", tier: "heavy" },
  { fragment: "devstralsmall", label: "Devstral Small", tier: "heavy" },
  { fragment: "codestral", label: "Codestral", tier: "heavy" },
  { fragment: "deepseek-coder", label: "DeepSeek Coder", tier: "heavy" },
  { fragment: "deepseekcoder", label: "DeepSeek Coder", tier: "heavy" },
];

export const UAT_REPAIR_MODEL = {
  label: "Qwen3.8-27B",
  expectedNameFragments: ["qwen3.8-27b", "qwen-3.8-27b", "qwen_qwen3.8-27b", "qwen/qwen3.8-27b"],
  purpose: "On-demand PlotPickle repository repair and coding agent",
};

export function modelKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export function approvedCodingModel(value) {
  const candidate = modelKey(value);
  return APPROVED_LOCAL_CODING_MODELS.some((item) => candidate.includes(modelKey(item.fragment)));
}

export function dedicatedLegacyRepairModel(value) {
  const candidate = modelKey(value);
  return UAT_REPAIR_MODEL.expectedNameFragments.some((fragment) => candidate.includes(modelKey(fragment)));
}

export function rankApprovedCodingModel(value) {
  const candidate = modelKey(value);
  const index = APPROVED_LOCAL_CODING_MODELS.findIndex((item) => candidate.includes(modelKey(item.fragment)));
  return index < 0 ? Number.MAX_SAFE_INTEGER : index;
}

export function chooseApprovedCodingModel(models, preferred = "") {
  const available = [...new Set((models || []).map((value) => String(value || "").trim()).filter(Boolean))];
  if (preferred) {
    const wanted = modelKey(preferred);
    const exact = available.find((model) => modelKey(model) === wanted);
    if (exact && approvedCodingModel(exact)) return exact;
  }
  return available.filter(approvedCodingModel).sort((a, b) => rankApprovedCodingModel(a) - rankApprovedCodingModel(b))[0] || "";
}
