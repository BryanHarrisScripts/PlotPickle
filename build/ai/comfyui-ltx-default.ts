import type { LtxManifest } from "./comfyui-ltx-local-provider";

/** Single-stage adaptation; provenance and review notes: docs/architecture/ltx-default-workflow.md. */
export const LTX_DEFAULT_PRESET = Object.freeze({
  id: "pascal-8gb-proof", mode: "text-to-video", width: 640, height: 352,
  frames: 25, fps: 24, steps: 8, guidance: 1, upscaling: false,
});
export const LTX_MIN_COMFY_VERSION = "0.3.50";
const SOURCE = "https://github.com/Lightricks/ComfyUI-LTXVideo/blob/36fdaf500b3cd6f7fa8b2dfec36e984746e630a2/example_workflows/low_level/ltxvideo-i2v-distilled.json";
const SIGMAS = "1.0000, 0.9937, 0.9875, 0.9812, 0.9750, 0.9094, 0.7250, 0.4219, 0.0";

export function bundledLtxManifest(): LtxManifest {
  return {
    schemaVersion: 1,
    model: "LTX-Video-2B-0.9.8-Distilled",
    source: SOURCE,
    requiredModelNames: ["ltxv-2b-0.9.8-distilled.safetensors", "t5xxl_fp16.safetensors"],
    workflow: {
      "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "ltxv-2b-0.9.8-distilled.safetensors" } },
      "2": { class_type: "CLIPLoader", inputs: { clip_name: "t5xxl_fp16.safetensors", type: "ltxv", device: "cpu" } },
      "3": { class_type: "CLIPTextEncode", inputs: { clip: ["2", 0], text: "{{PLOTPICKLE_PROMPT}}" } },
      "4": { class_type: "CLIPTextEncode", inputs: { clip: ["2", 0], text: "" } },
      "5": { class_type: "LTXVConditioning", inputs: { positive: ["3", 0], negative: ["4", 0], frame_rate: 24 } },
      "6": { class_type: "EmptyLTXVLatentVideo", inputs: { width: 640, height: 352, length: 25, batch_size: 1 } },
      "7": { class_type: "RandomNoise", inputs: { noise_seed: "{{PLOTPICKLE_SEED}}" } },
      "8": { class_type: "CFGGuider", inputs: { model: ["1", 0], positive: ["5", 0], negative: ["5", 1], cfg: 1 } },
      "9": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler_ancestral" } },
      "10": { class_type: "ManualSigmas", inputs: { sigmas: SIGMAS } },
      "12": { class_type: "SamplerCustomAdvanced", inputs: { noise: ["7", 0], guider: ["8", 0], sampler: ["9", 0], sigmas: ["10", 0], latent_image: ["6", 0] } },
      "13": { class_type: "VAEDecode", inputs: { samples: ["12", 1], vae: ["1", 2] } },
      "14": { class_type: "CreateVideo", inputs: { images: ["13", 0], fps: 24 } },
      "15": { class_type: "SaveVideo", inputs: { video: ["14", 0], filename_prefix: "PlotPickle/LTX", format: "mp4", codec: "h264" } },
    },
  };
}

/** Exact pre-core-sigma bundle, used only to migrate PlotPickle's own persisted default. */
export function legacyBundledLtxManifestV1(): LtxManifest {
  return {
    schemaVersion: 1,
    model: "LTX-Video-2B-0.9.8-Distilled",
    source: SOURCE,
    requiredModelNames: ["ltxv-2b-0.9.8-distilled.safetensors", "t5xxl_fp16.safetensors"],
    workflow: {
      "1": { class_type: "CheckpointLoaderSimple", inputs: { ckpt_name: "ltxv-2b-0.9.8-distilled.safetensors" } },
      "2": { class_type: "CLIPLoader", inputs: { clip_name: "t5xxl_fp16.safetensors", type: "ltxv", device: "cpu" } },
      "3": { class_type: "CLIPTextEncode", inputs: { clip: ["2", 0], text: "{{PLOTPICKLE_PROMPT}}" } },
      "4": { class_type: "CLIPTextEncode", inputs: { clip: ["2", 0], text: "" } },
      "5": { class_type: "LTXVConditioning", inputs: { positive: ["3", 0], negative: ["4", 0], frame_rate: 24 } },
      "6": { class_type: "EmptyLTXVLatentVideo", inputs: { width: 640, height: 352, length: 25, batch_size: 1 } },
      "7": { class_type: "RandomNoise", inputs: { noise_seed: "{{PLOTPICKLE_SEED}}" } },
      "8": { class_type: "CFGGuider", inputs: { model: ["1", 0], positive: ["5", 0], negative: ["5", 1], cfg: 1 } },
      "9": { class_type: "KSamplerSelect", inputs: { sampler_name: "euler_ancestral" } },
      "10": { class_type: "StringToFloatList", inputs: { string: SIGMAS } },
      "11": { class_type: "FloatToSigmas", inputs: { float_list: ["10", 0] } },
      "12": { class_type: "SamplerCustomAdvanced", inputs: { noise: ["7", 0], guider: ["8", 0], sampler: ["9", 0], sigmas: ["11", 0], latent_image: ["6", 0] } },
      "13": { class_type: "VAEDecode", inputs: { samples: ["12", 1], vae: ["1", 2] } },
      "14": { class_type: "CreateVideo", inputs: { images: ["13", 0], fps: 24 } },
      "15": { class_type: "SaveVideo", inputs: { video: ["14", 0], filename_prefix: "PlotPickle/LTX", format: "mp4", codec: "h264" } },
    },
  };
}
