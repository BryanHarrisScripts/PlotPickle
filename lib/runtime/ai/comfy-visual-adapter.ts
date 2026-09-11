export type VisualComputeTarget = "local" | "cloud";
export type ComfyVisualTransport = "comfy-mcp" | "comfy-cloud-api";

export type ComfyVisualAdapterState = Readonly<{
  localMcpAvailable: boolean;
  cloudMcpAvailable: boolean;
  cloudApiReady: boolean;
}>;

export type ComfyVisualExecutionPlan = Readonly<{
  target: VisualComputeTarget;
  transport: ComfyVisualTransport;
  engine: "comfyui";
  paidCloudExecution: boolean;
}>;

export type ComfyVisualJob = Readonly<{
  jobId: string;
  target: VisualComputeTarget;
  transport: ComfyVisualTransport;
}>;

export type ComfyVisualOutput = Readonly<{
  jobId: string;
  assetRefs: readonly string[];
  provenance: Record<string, unknown>;
}>;

export type ComfyVisualExecutionBindings = Readonly<{
  run?: (plan: ComfyVisualExecutionPlan, input: Record<string, unknown>) => Promise<ComfyVisualJob>;
  getOutput?: (job: ComfyVisualJob) => Promise<ComfyVisualOutput>;
  cancel?: (job: ComfyVisualJob) => Promise<void>;
}>;

export const COMFY_PRODUCT_TRANSPORTS = Object.freeze({
  preferred: "comfy-mcp" as const,
  cloudFallback: "comfy-cloud-api" as const,
  developerOnly: "comfy-cli" as const,
  excludedAgentProvider: "comfy-agent" as const,
});

export function selectComfyVisualTransport(
  target: VisualComputeTarget,
  state: ComfyVisualAdapterState,
): ComfyVisualExecutionPlan | null {
  if (target === "local") {
    if (!state.localMcpAvailable) return null;
    return {
      target,
      transport: "comfy-mcp",
      engine: "comfyui",
      paidCloudExecution: false,
    };
  }

  if (state.cloudMcpAvailable) {
    return {
      target,
      transport: "comfy-mcp",
      engine: "comfyui",
      paidCloudExecution: true,
    };
  }

  if (state.cloudApiReady) {
    return {
      target,
      transport: "comfy-cloud-api",
      engine: "comfyui",
      paidCloudExecution: true,
    };
  }

  return null;
}

export function createComfyVisualAdapter(
  state: ComfyVisualAdapterState,
  bindings: ComfyVisualExecutionBindings = {},
) {
  return Object.freeze({
    engine: "comfyui" as const,
    state,
    selectTransport(target: VisualComputeTarget) {
      return selectComfyVisualTransport(target, state);
    },
    async run(plan: ComfyVisualExecutionPlan, input: Record<string, unknown>) {
      if (!bindings.run) throw new Error("The selected Comfy execution bridge is not connected yet.");
      return bindings.run(plan, input);
    },
    async getOutput(job: ComfyVisualJob) {
      if (!bindings.getOutput) throw new Error("The selected Comfy output bridge is not connected yet.");
      return bindings.getOutput(job);
    },
    async cancel(job: ComfyVisualJob) {
      if (!bindings.cancel) throw new Error("The selected Comfy cancellation bridge is not connected yet.");
      await bindings.cancel(job);
    },
  });
}

export type ComfyVisualAdapter = ReturnType<typeof createComfyVisualAdapter>;
