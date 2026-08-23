import {
  chooseModelForRole,
  normalizeModelDescriptor,
  scoreModelForRole,
} from "../lib/ai/local-model-capabilities.mjs";
import { repairCapabilityCacheApproves } from "./local-repair-capability-cache.mjs";

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

// Retained only for the legacy mastra-qwen worker. Pi no longer requires this
// specific family; it can accept any locally detected model that satisfies the
// repair capability contract and hardware-fit policy.
export const UAT_REPAIR_MODEL = {
  label: "Qwen3.8-27B",
  expectedNameFragments: ["qwen3.8-27b", "qwen-3.8-27b", "qwen_qwen3.8-27b", "qwen/qwen3.8-27b"],
  purpose: "Legacy dedicated PlotPickle repository repair model",
};

export function modelKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9]+/g, "");
}

function staticApprovedCodingModel(value) {
  const candidate = modelKey(value);
  return APPROVED_LOCAL_CODING_MODELS.some((item) => candidate.includes(modelKey(item.fragment)));
}

export function capabilityApprovedCodingModel(descriptor, hardware = {}) {
  if (!descriptor) return false;
  return scoreModelForRole("repair", normalizeModelDescriptor(descriptor), hardware).eligible;
}

export function approvedCodingModel(value, descriptor = null, hardware = {}) {
  const inferred = descriptor || normalizeModelDescriptor({ id: value });
  return staticApprovedCodingModel(value)
    || repairCapabilityCacheApproves(value)
    || capabilityApprovedCodingModel(inferred, hardware);
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

export function chooseApprovedCodingModel(models, preferred = "", descriptors = [], hardware = {}) {
  const available = [...new Set((models || []).map((value) => String(value || "").trim()).filter(Boolean))];
  const descriptorByKey = new Map((descriptors || []).map((item) => {
    const descriptor = normalizeModelDescriptor(item);
    return [modelKey(descriptor.id), descriptor];
  }));
  if (preferred) {
    const wanted = modelKey(preferred);
    const exact = available.find((model) => modelKey(model) === wanted);
    if (exact && approvedCodingModel(exact, descriptorByKey.get(wanted), hardware)) return exact;
  }

  const dynamic = chooseModelForRole(
    "repair",
    available.map((model) => descriptorByKey.get(modelKey(model)) || normalizeModelDescriptor({ id: model })),
    hardware,
  );
  if (dynamic?.model?.id) {
    const exact = available.find((model) => modelKey(model) === modelKey(dynamic.model.id));
    if (exact) return exact;
  }

  return available.filter((model) => staticApprovedCodingModel(model) || repairCapabilityCacheApproves(model))
    .sort((a, b) => rankApprovedCodingModel(a) - rankApprovedCodingModel(b))[0] || "";
}
