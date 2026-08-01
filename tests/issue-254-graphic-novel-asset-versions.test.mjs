import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

test("local asset discovery is loopback-only, hashed and restricted to the PlotPickle asset directory", async () => {
  const gateway = await source("build/local-ai-gateway-base.ts");
  assert.match(gateway, /const ASSET_INDEX_PATH = "\/api\/local-ai\/assets"/);
  assert.match(gateway, /createHash\("sha256"\)\.update\(bytes\)\.digest\("hex"\)/);
  assert.match(gateway, /path\.join\(persistentHome\(\), "assets"\)/);
  assert.match(gateway, /safeAssetFileName/);
  assert.match(gateway, /MAX_ASSET_BYTES = 20 \* 1024 \* 1024/);
  assert.match(gateway, /if \(!isLocalRequest\(request\)\)/);
  assert.doesNotMatch(gateway, /searchParams\.get\("directory"\)/);
});

test("Graphic Novel discovery matches stable panel IDs and keeps originals as separate variations", async () => {
  const [versions, assets] = await Promise.all([
    source("lib/graphic-novel-asset-versions.ts"),
    source("lib/project-assets.ts"),
  ]);
  assert.match(versions, /graphicNovelPanelIdForLocalAsset/);
  assert.match(versions, /stem\.startsWith/);
  assert.match(versions, /discoverLocalGraphicNovelVersions/);
  assert.match(versions, /preferredReference = panel\.assetRef \?\? storyboardReference/);
  assert.match(versions, /variationExtensions: \{ origin: "local"/);
  assert.match(versions, /GraphicNovelAssetOrigin = "original" \| "local" \| "repository"/);
  assert.match(assets, /variations: sortedVariations\(\[\.\.\.existing\.variations, variation\]\)/);
  assert.doesNotMatch(versions, /unlink\(|deleteFile|overwrite/i);
});

test("per-panel UI can scan, compare, select and explicitly publish one local alternate", async () => {
  const [workspace, css] = await Promise.all([
    source("app/ai-pitch-deck-workspace-base.tsx"),
    source("app/ai-pitch-deck-workspace.module.css"),
  ]);
  for (const phrase of [
    "Originals stay intact. Local alternates stay optional.",
    "Scan local images",
    "Image versions",
    "Use version",
    "Publish alternate to GitHub",
    "The approved story and original image are unchanged until Project Lead approval.",
  ]) assert.ok(workspace.includes(phrase), "Missing asset-version UI contract: " + phrase);
  assert.match(workspace, /fetch\("\/api\/local-ai\/assets"/);
  assert.match(workspace, /fetch\("\/api\/local-github\/submit-proposal"/);
  assert.match(workspace, /assetFiles: \[prepared\.assetFile\]/);
  assert.match(css, /\.versionGrid article\[data-selected\]/);
});

test("repository publishing verifies immutable binaries and makes Asset versions separately reviewable", async () => {
  const [gateway, proposals, proposalUi] = await Promise.all([
    source("build/github-review-gateway.ts"),
    source("lib/story-proposals.ts"),
    source("app/story-proposals.tsx"),
  ]);
  assert.match(gateway, /proposalAssetFiles/);
  assert.match(gateway, /contentHash !== file\.contentHash/);
  assert.match(gateway, /already exists\. PlotPickle preserves repository assets instead of overwriting them/);
  assert.match(gateway, /may add immutable alternates but may not overwrite or delete existing assets/);
  assert.match(gateway, /accepted\.includes\("assets"\) !== accepted\.includes\("review"\)/);
  assert.match(gateway, /serveRepositoryAsset/);
  assert.match(gateway, /repositoryAssetDiff/);
  assert.match(proposals, /id: "assets", label: "Asset versions"/);
  assert.match(proposals, /if \(selected\.has\("assets"\)\) next\.assets = source\.assets/);
  assert.match(proposalUi, /"review", "assets", "rights"/);
});

test("Buzz Community uses supported application handoffs instead of a blocked iframe", async () => {
  const community = await source("app/buzz-community-workspace.tsx");
  assert.doesNotMatch(community, /<iframe/);
  assert.match(community, /Buzz opens beside PlotPickle/);
  assert.match(community, /Buzz Communities blocks embedded frames/);
  assert.match(community, /Open Buzz Desktop/);
  assert.match(community, /Manage communities in browser/);
});
