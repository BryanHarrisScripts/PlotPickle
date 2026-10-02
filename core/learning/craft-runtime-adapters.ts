import type { CraftInvocationMode } from "./contextual-craft-router";

export type CraftRuntimeKind = "host" | "mastra" | "pi" | "local-model" | "provider-api" | "mcp" | "cli" | "sidecar";

export type CraftRuntimeRequest = Readonly<{
  capabilityId: string;
  mode: CraftInvocationMode;
  input: string;
  supportingCapabilityIds: readonly string[];
}>;

export type CraftRuntimeResult = Readonly<{
  capabilityId: string;
  mode: CraftInvocationMode;
  text: string;
  runtime: CraftRuntimeKind;
  canonical: false;
}>;

export interface CraftRuntimeAdapter {
  readonly kind: CraftRuntimeKind;
  readonly hostSelected: true;
  execute(request: CraftRuntimeRequest): Promise<CraftRuntimeResult>;
}

export function governedCraftRuntimeRequest(input: CraftRuntimeRequest): CraftRuntimeRequest {
  if (!input.capabilityId.trim()) throw new Error("Craft capability id is required.");
  if (input.supportingCapabilityIds.length > 2) throw new Error("Craft capability fan-out exceeds the governed pilot maximum.");
  return Object.freeze({
    ...input,
    supportingCapabilityIds: Object.freeze([...input.supportingCapabilityIds]),
  });
}

export async function executeCraftRuntime(
  adapter: CraftRuntimeAdapter,
  request: CraftRuntimeRequest,
): Promise<CraftRuntimeResult> {
  const governed = governedCraftRuntimeRequest(request);
  const result = await adapter.execute(governed);
  if (result.mode !== governed.mode || result.capabilityId !== governed.capabilityId) {
    throw new Error("Craft runtime changed the governed invocation contract.");
  }
  return { ...result, canonical: false };
}

export class LocalHostCraftAdapter implements CraftRuntimeAdapter {
  readonly kind = "host" as const;
  readonly hostSelected = true as const;
  constructor(private readonly run: (request: CraftRuntimeRequest) => Promise<string>) {}
  async execute(request: CraftRuntimeRequest): Promise<CraftRuntimeResult> {
    return { capabilityId: request.capabilityId, mode: request.mode, text: await this.run(request), runtime: this.kind, canonical: false };
  }
}

export class CliCraftAdapter implements CraftRuntimeAdapter {
  readonly kind = "cli" as const;
  readonly hostSelected = true as const;
  constructor(private readonly run: (request: CraftRuntimeRequest) => Promise<string>) {}
  async execute(request: CraftRuntimeRequest): Promise<CraftRuntimeResult> {
    return { capabilityId: request.capabilityId, mode: request.mode, text: await this.run(request), runtime: this.kind, canonical: false };
  }
}
