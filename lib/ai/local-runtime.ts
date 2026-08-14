export type LocalRuntimeKind = "llama.cpp" | "lm-studio" | "ollama" | "openai-compatible";

export type LocalTextRole = "fast" | "quality" | "deep";
export type LocalRetrievalRole = "embedding" | "reranker";
export type LocalMediaRole = "image" | "video";
export type LocalHealthRole = "health-check";
export type LocalModelRole = LocalTextRole | LocalRetrievalRole | LocalMediaRole | LocalHealthRole;

export type LocalModelDefinition = {
  id: string;
  label: string;
  role: LocalModelRole;
  family: string;
  quantization?: string;
  source: string;
  expectedNameFragments: string[];
  production: boolean;
  notes: string;
};

export const LOCAL_MODEL_CATALOG: Readonly<Record<LocalModelRole, LocalModelDefinition>> = {
  fast: {
    id: "qwen3.5-4b-q6k",
    label: "Qwen3.5-4B GGUF",
    role: "fast",
    family: "Qwen3.5-4B",
    quantization: "Q6_K or Q8",
    source: "Qwen/Qwen3.5-4B",
    expectedNameFragments: ["qwen3.5-4b", "qwen-3.5-4b", "qwen_qwen3.5-4b"],
    production: true,
    notes: "Low-latency Creative Room, GUIDE, metadata, character and visual-inspection work.",
  },
  quality: {
    id: "qwen3.5-9b-q4km",
    label: "Qwen3.5-9B GGUF",
    role: "quality",
    family: "Qwen3.5-9B",
    quantization: "Q4_K_M",
    source: "Qwen/Qwen3.5-9B",
    expectedNameFragments: ["qwen3.5-9b", "qwen-3.5-9b", "qwen_qwen3.5-9b"],
    production: true,
    notes: "Story development, 24/96 planning, rewriting, character work and longer analysis.",
  },
  deep: {
    id: "gpt-oss-20b-mxfp4",
    label: "gpt-oss-20b MXFP4",
    role: "deep",
    family: "gpt-oss-20b",
    quantization: "MXFP4",
    source: "openai/gpt-oss-20b",
    expectedNameFragments: ["gpt-oss-20b", "gpt_oss_20b"],
    production: true,
    notes: "On-demand story auditing, structural reasoning, tool workflows and high-quality review passes.",
  },
  embedding: {
    id: "qwen3-embedding-0.6b",
    label: "Qwen3-Embedding-0.6B",
    role: "embedding",
    family: "Qwen3-Embedding-0.6B",
    source: "Qwen/Qwen3-Embedding-0.6B",
    expectedNameFragments: ["qwen3-embedding-0.6b"],
    production: true,
    notes: "CPU-resident curriculum retrieval embedding service.",
  },
  reranker: {
    id: "qwen3-reranker-0.6b",
    label: "Qwen3-Reranker-0.6B",
    role: "reranker",
    family: "Qwen3-Reranker-0.6B",
    source: "Qwen/Qwen3-Reranker-0.6B",
    expectedNameFragments: ["qwen3-reranker-0.6b"],
    production: true,
    notes: "CPU-resident curriculum reranking service.",
  },
  image: {
    id: "sdxl-1.0",
    label: "SDXL 1.0",
    role: "image",
    family: "Stable Diffusion XL 1.0",
    source: "stabilityai/stable-diffusion-xl-base-1.0",
    expectedNameFragments: ["sdxl", "stable-diffusion-xl"],
    production: true,
    notes: "Default ComfyUI image workflow for 8 GB VRAM. SD3.5 Medium is an advanced experimental override.",
  },
  video: {
    id: "ltx-video-2b-0.9.8-distilled",
    label: "LTX-Video 2B 0.9.8 Distilled",
    role: "video",
    family: "LTX-Video 2B",
    source: "Lightricks/LTX-Video",
    expectedNameFragments: ["ltxv-2b-0.9.8-distilled", "ltx-video-2b", "ltxv-2b"],
    production: true,
    notes: "Default lightweight local video workflow through ComfyUI on the 8 GB profile.",
  },
  "health-check": {
    id: "smollm2-135m-health",
    label: "SmolLM2 135M",
    role: "health-check",
    family: "SmolLM2-135M",
    source: "HuggingFaceTB/SmolLM2-135M-Instruct",
    expectedNameFragments: ["smollm2:135m", "smollm2-135m"],
    production: false,
    notes: "Installer verification and inference diagnostics only. Never route production story or Creative Room work here.",
  },
};

export type LocalHardwareProfile = {
  id: string;
  label: string;
  minimumRamGb: number;
  runtimePreference: readonly LocalRuntimeKind[];
  defaultContextTokens: 16384 | 32768;
  extendedContextTokens: 32768;
  cudaPolicy: "cu126-pascal" | "current-nvidia" | "cpu";
  allowVulkanFallback: boolean;
  cpuGpuSplit: boolean;
  defaultRoles: Readonly<Record<LocalTextRole | LocalRetrievalRole | LocalMediaRole, string>>;
  experimental: readonly string[];
};

export const LOCAL_HARDWARE_PROFILES: readonly LocalHardwareProfile[] = [
  {
    id: "nvidia-pascal-8gb-32gb",
    label: "NVIDIA Pascal 8 GB / 32 GB RAM",
    minimumRamGb: 28,
    runtimePreference: ["llama.cpp", "lm-studio", "ollama", "openai-compatible"],
    defaultContextTokens: 16384,
    extendedContextTokens: 32768,
    cudaPolicy: "cu126-pascal",
    allowVulkanFallback: true,
    cpuGpuSplit: true,
    defaultRoles: {
      fast: LOCAL_MODEL_CATALOG.fast.id,
      quality: LOCAL_MODEL_CATALOG.quality.id,
      deep: LOCAL_MODEL_CATALOG.deep.id,
      embedding: LOCAL_MODEL_CATALOG.embedding.id,
      reranker: LOCAL_MODEL_CATALOG.reranker.id,
      image: LOCAL_MODEL_CATALOG.image.id,
      video: LOCAL_MODEL_CATALOG.video.id,
    },
    experimental: ["SD3.5 Medium", "32K context"],
  },
  {
    id: "nvidia-16gb",
    label: "NVIDIA 16 GB",
    minimumRamGb: 28,
    runtimePreference: ["llama.cpp", "lm-studio", "openai-compatible", "ollama"],
    defaultContextTokens: 16384,
    extendedContextTokens: 32768,
    cudaPolicy: "current-nvidia",
    allowVulkanFallback: true,
    cpuGpuSplit: true,
    defaultRoles: {
      fast: LOCAL_MODEL_CATALOG.fast.id,
      quality: LOCAL_MODEL_CATALOG.quality.id,
      deep: LOCAL_MODEL_CATALOG.deep.id,
      embedding: LOCAL_MODEL_CATALOG.embedding.id,
      reranker: LOCAL_MODEL_CATALOG.reranker.id,
      image: LOCAL_MODEL_CATALOG.image.id,
      video: LOCAL_MODEL_CATALOG.video.id,
    },
    experimental: ["larger image and video workflows", "32K context"],
  },
  {
    id: "nvidia-24gb-plus",
    label: "NVIDIA 24 GB+",
    minimumRamGb: 32,
    runtimePreference: ["llama.cpp", "lm-studio", "openai-compatible", "ollama"],
    defaultContextTokens: 32768,
    extendedContextTokens: 32768,
    cudaPolicy: "current-nvidia",
    allowVulkanFallback: true,
    cpuGpuSplit: true,
    defaultRoles: {
      fast: LOCAL_MODEL_CATALOG.fast.id,
      quality: LOCAL_MODEL_CATALOG.quality.id,
      deep: LOCAL_MODEL_CATALOG.deep.id,
      embedding: LOCAL_MODEL_CATALOG.embedding.id,
      reranker: LOCAL_MODEL_CATALOG.reranker.id,
      image: LOCAL_MODEL_CATALOG.image.id,
      video: LOCAL_MODEL_CATALOG.video.id,
    },
    experimental: ["higher-quality image workflows", "larger video models", "larger local text models"],
  },
  {
    id: "cpu-local",
    label: "CPU local fallback",
    minimumRamGb: 16,
    runtimePreference: ["llama.cpp", "openai-compatible", "lm-studio", "ollama"],
    defaultContextTokens: 16384,
    extendedContextTokens: 32768,
    cudaPolicy: "cpu",
    allowVulkanFallback: false,
    cpuGpuSplit: false,
    defaultRoles: {
      fast: LOCAL_MODEL_CATALOG.fast.id,
      quality: LOCAL_MODEL_CATALOG.quality.id,
      deep: LOCAL_MODEL_CATALOG.deep.id,
      embedding: LOCAL_MODEL_CATALOG.embedding.id,
      reranker: LOCAL_MODEL_CATALOG.reranker.id,
      image: LOCAL_MODEL_CATALOG.image.id,
      video: LOCAL_MODEL_CATALOG.video.id,
    },
    experimental: [],
  },
] as const;

export type HardwareProfileInput = {
  ramGb: number;
  gpuName: string;
  vramGb: number;
  gpuGeneration: string;
};

export function selectLocalHardwareProfile(input: HardwareProfileInput): LocalHardwareProfile {
  const isNvidia = /nvidia|geforce|quadro|tesla|rtx|gtx/i.test(input.gpuName);
  if (isNvidia && input.vramGb >= 22) return LOCAL_HARDWARE_PROFILES.find((item) => item.id === "nvidia-24gb-plus")!;
  if (isNvidia && input.vramGb >= 14) return LOCAL_HARDWARE_PROFILES.find((item) => item.id === "nvidia-16gb")!;
  if (isNvidia && (input.gpuGeneration === "pascal" || input.vramGb >= 6) && input.ramGb >= 28) {
    return LOCAL_HARDWARE_PROFILES.find((item) => item.id === "nvidia-pascal-8gb-32gb")!;
  }
  return LOCAL_HARDWARE_PROFILES.find((item) => item.id === "cpu-local")!;
}

export function isProductionLocalModel(role: LocalModelRole) {
  return LOCAL_MODEL_CATALOG[role].production;
}
