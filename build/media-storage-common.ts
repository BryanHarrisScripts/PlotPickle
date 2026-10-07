import path from "node:path";
import {
  LOCAL_GENERATED_VISUAL_ASSET_PREFIX,
  PACKAGED_EXAMPLE_VISUAL_ASSET_PREFIX,
  supportedVisualAssetKind,
} from "../core/media/visual-asset-url";
import { persistentHome } from "./local-credentials";

export const ASSET_PATH = LOCAL_GENERATED_VISUAL_ASSET_PREFIX;
export const PACKAGED_EXAMPLE_ASSET_PATH = PACKAGED_EXAMPLE_VISUAL_ASSET_PREFIX;
export const MAX_ASSET_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

export function assetsDirectory() {
  return path.join(persistentHome(), "assets");
}

export function packagedExampleAssetsDirectory() {
  return path.resolve(process.cwd(), "public", "assets", "library", "examples");
}

export function safeAssetStem(value: unknown) {
  const stem = typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "")
    : "asset";
  return stem.slice(0, 70) || "asset";
}

function safeRelativeImagePath(assetUrl: string, prefix: string) {
  const relative = assetUrl.slice(prefix.length);
  if (!relative || relative.length > 360 || relative.includes("\\") || relative.includes("%") || relative.includes("?") || relative.includes("#") || relative.includes("\0")) {
    throw new Error("Media rendering received an unsafe PlotPickle image asset path.");
  }
  const segments = relative.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === ".." || !/^[a-z0-9][a-z0-9._-]*$/iu.test(segment))) {
    throw new Error("Media rendering received an unsafe PlotPickle image asset path.");
  }
  const fileName = segments.at(-1) ?? "";
  if (!/\.(png|jpe?g|webp)$/iu.test(fileName)) throw new Error("Media rendering accepts PNG, JPEG or WebP image assets only.");
  return segments;
}

function resolvedInside(rootDirectory: string, segments: readonly string[]) {
  const root = path.resolve(rootDirectory);
  const filePath = path.resolve(root, ...segments);
  if (!filePath.startsWith(root + path.sep)) throw new Error("Media rendering received an unsafe PlotPickle image asset path.");
  return filePath;
}

export function projectImageAssetFilePath(assetUrl: string) {
  const kind = supportedVisualAssetKind(assetUrl);
  if (!kind) throw new Error("Media rendering accepts supported PlotPickle image assets only.");
  if (kind === "local-generated") {
    return resolvedInside(assetsDirectory(), safeRelativeImagePath(assetUrl, ASSET_PATH));
  }
  return resolvedInside(packagedExampleAssetsDirectory(), safeRelativeImagePath(assetUrl, PACKAGED_EXAMPLE_ASSET_PATH));
}

export function localImageAssetFilePath(assetUrl: string) {
  if (!assetUrl.startsWith(ASSET_PATH)) throw new Error("Media rendering accepts saved PlotPickle local image assets only.");
  return projectImageAssetFilePath(assetUrl);
}
