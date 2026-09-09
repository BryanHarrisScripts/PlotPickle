import {
  probeLtxVideo,
  readLtxStore,
} from "./comfyui-ltx-local-provider";
import {
  probeNativeH3,
  readNativeH3Store,
} from "./h3/comfyui-h3-native-provider";

export type LocalAiPluginProbe = {
  adapterId: string;
  runtimeReady: boolean;
  configured: boolean;
  ready: boolean;
  active: boolean;
  error: string;
  details: Record<string, unknown>;
};

export type LocalAiPluginAdapter = {
  id: string;
  probe: () => Promise<LocalAiPluginProbe>;
};

const adapters = new Map<string, LocalAiPluginAdapter>();

export function registerLocalAiPluginAdapter(adapter: LocalAiPluginAdapter) {
  if (!adapter.id.trim()) throw new Error("A local AI plug-in adapter must have an id.");
  if (adapters.has(adapter.id)) throw new Error(`The local AI plug-in adapter ${adapter.id} is already registered.`);
  adapters.set(adapter.id, adapter);
  return adapter;
}

export function registeredLocalAiPluginAdapterIds() {
  return [...adapters.keys()].sort();
}

export async function probeLocalAiPluginAdapter(adapterId: string): Promise<LocalAiPluginProbe> {
  const adapter = adapters.get(adapterId);
  if (!adapter) {
    return {
      adapterId,
      runtimeReady: false,
      configured: false,
      ready: false,
      active: false,
      error: `No reviewed local AI adapter is registered for ${adapterId}.`,
      details: {},
    };
  }
  return adapter.probe();
}

registerLocalAiPluginAdapter({
  id: "comfyui-ltx-local",
  async probe() {
    const store = await readLtxStore();
    const status = await probeLtxVideo(store);
    const error = status.ready
      ? ""
      : status.error
        || (status.missingNodes.length ? `Missing ComfyUI nodes: ${status.missingNodes.join(", ")}` : "")
        || (status.missingModels.length ? `Missing local model files: ${status.missingModels.join(", ")}` : "")
        || "LTX-Video is not ready locally.";
    return {
      adapterId: "comfyui-ltx-local",
      runtimeReady: status.reachable,
      configured: status.manifestConfigured,
      ready: status.ready,
      active: status.ready && store.enabled,
      error,
      details: {
        model: status.model,
        version: status.version,
        missingNodes: status.missingNodes,
        missingModels: status.missingModels,
        verifiedAt: store.verifiedAt,
      },
    };
  },
});

registerLocalAiPluginAdapter({
  id: "comfyui-h3-native",
  async probe() {
    const store = await readNativeH3Store();
    const status = await probeNativeH3(store);
    const textToVideo = status.workflowFamily === "text-to-video";
    const ready = status.ready && textToVideo;
    const error = ready
      ? ""
      : !status.manifestConfigured
        ? "MiniMax H3 text-to-video workflow is not configured."
        : !textToVideo
          ? "The configured MiniMax H3 workflow is not text-to-video."
          : status.error || "MiniMax H3 text-to-video is not ready locally.";
    return {
      adapterId: "comfyui-h3-native",
      runtimeReady: status.reachable,
      configured: status.manifestConfigured && textToVideo,
      ready,
      active: ready && store.active,
      error,
      details: {
        model: "MiniMax H3",
        version: status.version,
        workflowFamily: status.workflowFamily,
        vramGiB: status.vramGiB,
        vramProfile: status.vramProfile,
        missingNodes: status.missingNodes,
        modelRequirements: status.modelRequirements,
      },
    };
  },
});
