import path from "node:path";
import { persistentHome } from "./local-credentials";

export const ASSET_PATH = "/api/local-ai/assets/";
export const MAX_ASSET_BYTES = 20 * 1024 * 1024;
export const MAX_VIDEO_BYTES = 150 * 1024 * 1024;

export function assetsDirectory() {
  return path.join(persistentHome(), "assets");
}

export function safeAssetStem(value: unknown) {
  const stem = typeof value === "string"
    ? value.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-|-$/g, "")
    : "asset";
  return stem.slice(0, 70) || "asset";
}
