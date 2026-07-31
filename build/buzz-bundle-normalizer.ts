import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { Plugin } from "vite";

const BUZZ_TEXT_FILES = ["compose.yml", "README.md", "LICENSE.buzz.txt"] as const;

export function canonicalBuzzText(source: string) {
  return source.replace(/\r\n?/g, "\n");
}

async function normalizeBuzzTrustFiles() {
  const bundle = path.resolve(process.cwd(), "runtime", "buzz");
  await Promise.all(BUZZ_TEXT_FILES.map(async (fileName) => {
    const filePath = path.join(bundle, fileName);
    const source = await readFile(filePath, "utf8");
    const canonical = canonicalBuzzText(source);
    if (canonical !== source) await writeFile(filePath, canonical, "utf8");
  }));
}

export function buzzBundleNormalizer(): Plugin {
  const normalize = () => normalizeBuzzTrustFiles();
  return {
    name: "plotpickle-buzz-bundle-normalizer",
    enforce: "pre",
    async configureServer() { await normalize(); },
    async configurePreviewServer() { await normalize(); },
  };
}
