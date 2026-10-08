#!/usr/bin/env node
import { createHash } from "node:crypto";
import { access, copyFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";

export const AFTERGLOW_REFERENCE_SOURCE_ID = "afterglow-v9-complete-baseline";
export const PACKAGED_PROJECT_ID = "reference-afterglow-packaged-current";
export const PACKAGED_ASSET_PUBLIC_ROOT = "/assets/library/examples/afterglow/current";
export const PACKAGED_ASSET_DISK_ROOT = "public/assets/library/examples/afterglow/current";
export const PACKAGED_DATA_ROOT = "data/afterglow-packaged-current";
export const PACKAGED_SNAPSHOT_PATH = `${PACKAGED_DATA_ROOT}/snapshot.json`;
export const PACKAGED_MANIFEST_PATH = `${PACKAGED_DATA_ROOT}/manifest.json`;

const PROJECT_KEYS = [
  "format",
  "id",
  "title",
  "revision",
  "createdAt",
  "updatedAt",
  "learning",
  "creativeRoom",
  "foundations",
  "world",
  "build",
  "production",
  "structure",
  "sourceEvidence",
  "writing",
  "discovery",
  "worldMap",
  "storyDevelopment",
  "mindMapNotes",
];

function record(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

function sha256Bytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function sha256Text(value) {
  return sha256Bytes(Buffer.from(value, "utf8"));
}

function normalizedSlash(value) {
  return value.replace(/\\/g, "/");
}

function safeTarget(value) {
  const normalized = normalizedSlash(String(value || "")).replace(/^\/+/, "");
  if (!normalized || normalized.includes("..") || path.isAbsolute(normalized)) {
    throw new Error(`Asset target must be a safe path relative to ${PACKAGED_ASSET_DISK_ROOT}: ${value}`);
  }
  if (!/\.(?:png|jpe?g|webp|svg)$/iu.test(normalized)) {
    throw new Error(`Asset target must be png, jpg, jpeg, webp or svg: ${value}`);
  }
  return normalized;
}

export function collectLocalAssetUrls(value, found = new Set()) {
  if (typeof value === "string") {
    if (value.startsWith("/api/local-ai/assets/")) found.add(value);
    if (/^data:/iu.test(value)) throw new Error("Base64/data URLs are forbidden in the packaged Afterglow example.");
    if (/^file:/iu.test(value)) throw new Error("file: URLs are forbidden in the packaged Afterglow example.");
    return found;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectLocalAssetUrls(item, found);
    return found;
  }
  if (value && typeof value === "object") {
    for (const item of Object.values(value)) collectLocalAssetUrls(item, found);
  }
  return found;
}

export function validateAssetMappings(rawMappings, requiredUrls) {
  const source = record(rawMappings);
  if (source.schemaVersion !== 1 || !Array.isArray(source.assets)) {
    throw new Error("Asset map must use schemaVersion 1 and an assets array.");
  }

  const bySource = new Map();
  const targetSet = new Set();
  for (const raw of source.assets) {
    const item = record(raw);
    const sourceUrl = typeof item.sourceUrl === "string" ? item.sourceUrl.trim() : "";
    const sourceFile = typeof item.sourceFile === "string" ? item.sourceFile.trim() : "";
    const target = safeTarget(item.target);
    if (!sourceUrl.startsWith("/api/local-ai/assets/")) {
      throw new Error(`Asset map sourceUrl must start with /api/local-ai/assets/: ${sourceUrl || "<missing>"}`);
    }
    if (!sourceFile) throw new Error(`Asset map sourceFile is required for ${sourceUrl}`);
    if (bySource.has(sourceUrl)) throw new Error(`Duplicate sourceUrl in asset map: ${sourceUrl}`);
    if (targetSet.has(target)) throw new Error(`Duplicate target path in asset map: ${target}`);
    targetSet.add(target);
    bySource.set(sourceUrl, {
      sourceUrl,
      sourceFile,
      target,
      publicUrl: `${PACKAGED_ASSET_PUBLIC_ROOT}/${target}`,
    });
  }

  const missing = [...requiredUrls].filter((url) => !bySource.has(url));
  if (missing.length) {
    throw new Error(`Asset map is missing ${missing.length} local URL(s):\n${missing.map((url) => `- ${url}`).join("\n")}`);
  }
  return [...bySource.values()].filter((item) => requiredUrls.has(item.sourceUrl));
}

export function rewriteAssetUrls(value, mappingBySource) {
  if (typeof value === "string") {
    if (/^data:/iu.test(value)) throw new Error("Base64/data URLs are forbidden in the packaged Afterglow example.");
    if (/^file:/iu.test(value)) throw new Error("file: URLs are forbidden in the packaged Afterglow example.");
    if (!value.startsWith("/api/local-ai/assets/")) return value;
    const mapped = mappingBySource.get(value);
    if (!mapped) throw new Error(`Unmapped local asset URL: ${value}`);
    return mapped.publicUrl;
  }
  if (Array.isArray(value)) return value.map((item) => rewriteAssetUrls(item, mappingBySource));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewriteAssetUrls(item, mappingBySource)]));
  }
  return value;
}

export function buildPromotedProject(rawProject, mappings) {
  const source = record(rawProject);
  const fixture = record(record(source.sourceEvidence).referenceFixture);
  if (fixture.sourceId !== AFTERGLOW_REFERENCE_SOURCE_ID) {
    throw new Error(`Project is not the canonical Afterglow working state. Expected sourceEvidence.referenceFixture.sourceId=${AFTERGLOW_REFERENCE_SOURCE_ID}.`);
  }
  if (source.format !== "2.0-foundation") throw new Error("Unsupported PlotPickle project format.");
  if (typeof source.title !== "string" || !source.title.trim().toLowerCase().includes("afterglow")) {
    throw new Error("Promotion input must be an Afterglow Library project.");
  }

  const durable = Object.fromEntries(PROJECT_KEYS.filter((key) => key in source).map((key) => [key, source[key]]));
  durable.id = PACKAGED_PROJECT_ID;
  durable.creativeRoom = { threadId: null };

  const mappingBySource = new Map(mappings.map((item) => [item.sourceUrl, item]));
  const rewritten = rewriteAssetUrls(durable, mappingBySource);
  const remainingLocal = [...collectLocalAssetUrls(rewritten)];
  if (remainingLocal.length) throw new Error(`Promotion left local asset URLs behind: ${remainingLocal.join(", ")}`);
  return rewritten;
}

function parseArgs(argv) {
  const result = { project: "", assetMap: "", scan: false, write: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--project") result.project = argv[++index] || "";
    else if (arg === "--asset-map") result.assetMap = argv[++index] || "";
    else if (arg === "--scan") result.scan = true;
    else if (arg === "--write") result.write = true;
    else throw new Error(`Unknown argument: ${arg}`);
  }
  if (!result.project) throw new Error("Usage: node scripts/promote-afterglow-packaged-example.mjs --project <afterglow.ppf.json> [--scan | --asset-map <map.json> [--write]]");
  return result;
}

async function readJson(filePath) {
  const text = await readFile(filePath, "utf8");
  return JSON.parse(text.replace(/^\uFEFF/u, ""));
}

function defaultSourceFileForUrl(url) {
  const fileName = decodeURIComponent(url.slice(url.lastIndexOf("/") + 1));
  const localAppData = process.env.LOCALAPPDATA || "%LOCALAPPDATA%";
  return path.join(localAppData, "PlotPickle", "assets", fileName);
}

export function packagedPosterUrls(project) {
  const foundations = record(record(record(project).build).foundations);
  const artifacts = Array.isArray(foundations.visualArtifacts) ? foundations.visualArtifacts : [];
  return artifacts
    .map((item) => record(item))
    .filter((item) => item.workflow === "marquee-director/foundations-first-poster-v1")
    .filter((item) => typeof item.assetUrl === "string" && item.assetUrl.startsWith(PACKAGED_ASSET_PUBLIC_ROOT + "/"))
    .sort((left, right) => String(right.createdAt || "").localeCompare(String(left.createdAt || "")))
    .map((item) => item.assetUrl)
    .filter((url, index, all) => all.indexOf(url) === index)
    .slice(0, 5);
}

export function scanTemplate(project) {
  return {
    schemaVersion: 1,
    assets: [...collectLocalAssetUrls(project)].sort().map((sourceUrl) => ({
      sourceUrl,
      sourceFile: defaultSourceFileForUrl(sourceUrl),
      target: `generated/${decodeURIComponent(sourceUrl.slice(sourceUrl.lastIndexOf("/") + 1))}`,
    })),
  };
}

async function copyMappedAssets(root, mappings) {
  const records = [];
  for (const item of mappings) {
    await access(item.sourceFile);
    const bytes = await readFile(item.sourceFile);
    const targetPath = path.join(root, PACKAGED_ASSET_DISK_ROOT, item.target);
    await mkdir(path.dirname(targetPath), { recursive: true });
    await copyFile(item.sourceFile, targetPath);
    records.push({
      publicUrl: item.publicUrl,
      target: item.target,
      contentHash: `sha256:${sha256Bytes(bytes)}`,
    });
  }
  return records;
}

export async function promoteAfterglowSnapshot({ root = process.cwd(), projectPath, assetMapPath, write = false }) {
  const rawProject = await readJson(projectPath);
  const requiredUrls = collectLocalAssetUrls(rawProject);
  const rawMap = assetMapPath ? await readJson(assetMapPath) : { schemaVersion: 1, assets: [] };
  const mappings = validateAssetMappings(rawMap, requiredUrls);
  const project = buildPromotedProject(rawProject, mappings);
  const snapshot = { schemaVersion: 1, status: "promoted", project };
  const snapshotText = stableJson(snapshot);
  const assetRecords = write ? await copyMappedAssets(root, mappings) : mappings.map((item) => ({
    publicUrl: item.publicUrl,
    target: item.target,
    contentHash: "<computed-on-write>",
  }));
  const manifest = {
    schemaVersion: 1,
    status: "promoted",
    assetRoot: PACKAGED_ASSET_PUBLIC_ROOT,
    source: {
      referenceSourceId: AFTERGLOW_REFERENCE_SOURCE_ID,
      projectId: typeof rawProject.id === "string" ? rawProject.id : null,
      revision: Number.isInteger(rawProject.revision) ? rawProject.revision : null,
      updatedAt: typeof rawProject.updatedAt === "string" ? rawProject.updatedAt : null,
    },
    snapshotSha256: sha256Text(snapshotText),
    featuredPosterUrls: packagedPosterUrls(project),
    assets: assetRecords,
  };

  if (write) {
    const snapshotPath = path.join(root, PACKAGED_SNAPSHOT_PATH);
    const manifestPath = path.join(root, PACKAGED_MANIFEST_PATH);
    await mkdir(path.dirname(snapshotPath), { recursive: true });
    await writeFile(snapshotPath, snapshotText, "utf8");
    await writeFile(manifestPath, stableJson(manifest), "utf8");
  }

  return { snapshot, manifest, requiredUrls: [...requiredUrls].sort(), mappings };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const project = await readJson(args.project);
  if (args.scan) {
    process.stdout.write(stableJson(scanTemplate(project)));
    return;
  }
  const result = await promoteAfterglowSnapshot({
    projectPath: args.project,
    assetMapPath: args.assetMap,
    write: args.write,
  });
  process.stdout.write(stableJson({
    mode: args.write ? "written" : "check-only",
    requiredAssetCount: result.requiredUrls.length,
    snapshotSha256: result.manifest.snapshotSha256,
    assetRoot: result.manifest.assetRoot,
    next: args.write
      ? "Review git diff. Commit only the generated snapshot/manifest and normal repository media files."
      : "Validation passed. Re-run with --write to copy mapped media and generate the packaged snapshot.",
  }));
}

const invoked = process.argv[1] ? pathToFileURL(path.resolve(process.argv[1])).href : "";
if (import.meta.url === invoked) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  });
}
