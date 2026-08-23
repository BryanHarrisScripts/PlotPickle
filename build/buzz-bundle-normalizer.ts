import type { Plugin } from "vite";

const BUZZ_TEXT_FILE = /\.(?:ya?ml|md|txt)$/i;

export function canonicalBuzzText(source: string) {
  return source.replace(/\r\n?/g, "\n");
}

export function canonicalBuzzBytes(filePath: string, source: Buffer | string) {
  const bytes = typeof source === "string" ? Buffer.from(source, "utf8") : source;
  if (!BUZZ_TEXT_FILE.test(filePath)) return bytes;
  return Buffer.from(canonicalBuzzText(bytes.toString("utf8")), "utf8");
}

export function buzzBundleNormalizer(): Plugin {
  // Compatibility plugin retained for the existing Vite ordering contract.
  // Trust files are canonicalized in memory by verification code and are never
  // rewritten in the source checkout when PlotPickle starts or tests Buzz.
  return {
    name: "plotpickle-buzz-bundle-normalizer",
    enforce: "pre",
  };
}
