export type ImageTestRoute = "comfyui" | "openai" | "minimax" | "manual";
export type CloudImageTestProvider = "openai" | "minimax";
export function resolveImageTestRoute(requestedRoute: unknown, selectedRoute: ImageTestRoute): ImageTestRoute;
export function assertCloudImageTestProof(
  expected: CloudImageTestProvider,
  receipt: { ok?: boolean; route?: string; provider?: string; assetUrl?: string } | null,
  status: { profiles?: Partial<Record<CloudImageTestProvider, { imageReady?: boolean; imageVerifiedAt?: string }>> } | null,
): { provider: CloudImageTestProvider; assetUrl: string; verifiedAt: string };
