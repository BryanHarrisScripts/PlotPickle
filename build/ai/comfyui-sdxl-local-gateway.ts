import { probeComfyUI } from "./comfyui-media-provider";
import { generateSdxlImage } from "./comfyui-sdxl-local-provider";
import { LOCAL_SDXL_CHECKPOINT, type MediaRoutingStore } from "../media-routing-store";
import type { ImageGenerationInput } from "../media-provider-common";

/**
 * Local SDXL validation/execution only. The canonical media-routing gateway
 * parses POST /api/media-routing/test/image once, chooses the requested route,
 * and records verification for that route alone (PP-IMG-PROVIDER-001).
 */
export async function generateSdxlLocalTest(store: MediaRoutingStore, input: ImageGenerationInput) {
  if (store.comfyui.imageProfile !== "sdxl-1.0") {
    throw new Error("The selected local image profile is not SDXL 1.0.");
  }
  const probe = await probeComfyUI(store.comfyui.baseUrl, store.comfyui.h3Workflow);
  if (!probe.reachable || !probe.imageNodesReady) {
    throw new Error(probe.error || `ComfyUI is missing required image nodes: ${probe.missingImageNodes.join(", ")}`);
  }
  const checkpoint = probe.checkpoints.find((name) => name.toLowerCase() === LOCAL_SDXL_CHECKPOINT.toLowerCase()) || "";
  if (!checkpoint) {
    throw new Error(`ComfyUI is running, but PlotPickle could not find its fixed local image model ${LOCAL_SDXL_CHECKPOINT}. Install the reviewed SDXL 1.0 starter, then restart or refresh ComfyUI.`);
  }
  const result = await generateSdxlImage(store.comfyui.baseUrl, checkpoint, input);
  return { ...result, localProfile: "SDXL 1.0", checkpoint, continuityLayer: "provider-independent" };
}
