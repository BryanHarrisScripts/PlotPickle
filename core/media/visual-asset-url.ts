export const LOCAL_GENERATED_VISUAL_ASSET_PREFIX = "/api/local-ai/assets/";
export const PACKAGED_EXAMPLE_VISUAL_ASSET_PREFIX = "/assets/library/examples/";

export type SupportedVisualAssetKind = "local-generated" | "packaged-example";

export function supportedVisualAssetKind(value: unknown): SupportedVisualAssetKind | null {
  if (typeof value !== "string") return null;
  if (value.startsWith(LOCAL_GENERATED_VISUAL_ASSET_PREFIX)) return "local-generated";
  if (value.startsWith(PACKAGED_EXAMPLE_VISUAL_ASSET_PREFIX)) return "packaged-example";
  return null;
}

export function isSupportedVisualAssetUrl(value: unknown): value is string {
  return supportedVisualAssetKind(value) !== null;
}
