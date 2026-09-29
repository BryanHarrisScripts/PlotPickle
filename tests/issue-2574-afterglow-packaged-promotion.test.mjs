import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  AFTERGLOW_REFERENCE_SOURCE_ID,
  PACKAGED_ASSET_PUBLIC_ROOT,
  PACKAGED_PROJECT_ID,
  buildPromotedProject,
  collectLocalAssetUrls,
  rewriteAssetUrls,
  scanTemplate,
  validateAssetMappings,
} from "../scripts/promote-afterglow-packaged-example.mjs";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

function localAfterglowFixture() {
  return {
    format: "2.0-foundation",
    id: "profile-local-afterglow",
    title: "Afterglow: Reflections of Sentience",
    revision: 101,
    createdAt: "2026-09-01T00:00:00.000Z",
    updatedAt: "2026-09-29T00:00:00.000Z",
    learning: { activeLessonId: null, completedLessonIds: [] },
    creativeRoom: { threadId: "profile-private-thread" },
    foundations: { lessons: {}, brief: { content: "Current foundations", savedAt: "2026-09-29T00:00:00.000Z" } },
    world: { lessons: {}, brief: { content: "Current world", savedAt: "2026-09-29T00:00:00.000Z" } },
    build: {
      foundations: {
        visualArtifacts: [{
          id: "poster-1",
          assetUrl: "/api/local-ai/assets/afterglow-poster.webp",
          prompt: "Poster",
          createdAt: "2026-09-29T00:00:00.000Z",
          provider: "local",
          model: "model",
          reviewState: "accepted",
          parentArtifactId: null,
        }],
        acceptedVisualArtifactIds: ["poster-1"],
      },
      world: { visualArtifacts: [], acceptedVisualArtifactIds: [] },
    },
    production: {},
    structure: { blocks: [{ number: 1, title: "Opening" }] },
    sourceEvidence: {
      referenceFixture: {
        sourceId: AFTERGLOW_REFERENCE_SOURCE_ID,
        fixtureId: "afterglow-v9-through-foundations",
      },
    },
    writing: { entries: [{ blockNumber: 1, miniBlockNumber: 1, text: "Current writing" }] },
    discovery: { ideas: [] },
    worldMap: {
      version: 1,
      characterVisuals: [{
        characterId: "ren",
        characterName: "Ren",
        lockedVersionId: "ren-v1",
        approvedAt: "2026-09-29T00:00:00.000Z",
        updatedAt: "2026-09-29T00:00:00.000Z",
        references: [{
          id: "ren-front",
          versionId: "ren-v1",
          characterId: "ren",
          characterName: "Ren",
          view: "front-full",
          assetUrl: "/api/local-ai/assets/ren-front.webp",
          prompt: "Ren front",
          provider: "local",
          model: "model",
          createdAt: "2026-09-29T00:00:00.000Z",
          reviewState: "approved",
        }],
      }],
    },
    profileId: "must-not-survive",
    csrfToken: "must-not-survive",
    recovery: { temporary: true },
  };
}

test("#2574 promotion rewrites local media to repository assets without base64 or machine URLs", () => {
  const project = localAfterglowFixture();
  const required = collectLocalAssetUrls(project);
  assert.deepEqual([...required].sort(), [
    "/api/local-ai/assets/afterglow-poster.webp",
    "/api/local-ai/assets/ren-front.webp",
  ]);

  const mappings = validateAssetMappings({
    schemaVersion: 1,
    assets: [
      {
        sourceUrl: "/api/local-ai/assets/afterglow-poster.webp",
        sourceFile: "C:\\Users\\example\\AppData\\Local\\PlotPickle\\assets\\afterglow-poster.webp",
        target: "posters/poster-01.webp",
      },
      {
        sourceUrl: "/api/local-ai/assets/ren-front.webp",
        sourceFile: "C:\\Users\\example\\AppData\\Local\\PlotPickle\\assets\\ren-front.webp",
        target: "characters/ren/generation-1/front.webp",
      },
    ],
  }, required);

  const promoted = buildPromotedProject(project, mappings);
  assert.equal(promoted.id, PACKAGED_PROJECT_ID);
  assert.equal(promoted.creativeRoom.threadId, null);
  assert.equal(promoted.build.foundations.visualArtifacts[0].assetUrl, `${PACKAGED_ASSET_PUBLIC_ROOT}/posters/poster-01.webp`);
  assert.equal(promoted.worldMap.characterVisuals[0].references[0].assetUrl, `${PACKAGED_ASSET_PUBLIC_ROOT}/characters/ren/generation-1/front.webp`);
  assert.equal(promoted.sourceEvidence.referenceFixture.sourceId, AFTERGLOW_REFERENCE_SOURCE_ID);
  assert.equal("profileId" in promoted, false);
  assert.equal("csrfToken" in promoted, false);
  assert.equal("recovery" in promoted, false);
  assert.equal([...collectLocalAssetUrls(promoted)].length, 0);
});

test("#2574 promotion fails closed for base64, unmapped assets and unsafe targets", () => {
  assert.throws(() => collectLocalAssetUrls({ image: "data:image/webp;base64,AAAA" }), /Base64\/data URLs are forbidden/u);

  const required = new Set(["/api/local-ai/assets/ren-front.webp"]);
  assert.throws(() => validateAssetMappings({ schemaVersion: 1, assets: [] }, required), /missing 1 local URL/u);

  assert.throws(() => validateAssetMappings({
    schemaVersion: 1,
    assets: [{
      sourceUrl: "/api/local-ai/assets/ren-front.webp",
      sourceFile: "C:\\temp\\ren-front.webp",
      target: "../outside.webp",
    }],
  }, required), /safe path/u);
});

test("#2574 scan produces Windows persistent-home asset candidates and normal repository targets", () => {
  const prior = process.env.LOCALAPPDATA;
  process.env.LOCALAPPDATA = "C:\\Users\\example\\AppData\\Local";
  try {
    const scanned = scanTemplate(localAfterglowFixture());
    assert.equal(scanned.schemaVersion, 1);
    assert.equal(scanned.assets.length, 2);
    for (const item of scanned.assets) {
      assert.match(item.sourceUrl, /^\/api\/local-ai\/assets\//u);
      assert.match(item.sourceFile.replace(/\\/g, "/"), /AppData\/Local\/PlotPickle\/assets\//u);
      assert.match(item.target, /^generated\//u);
    }
  } finally {
    if (prior === undefined) delete process.env.LOCALAPPDATA;
    else process.env.LOCALAPPDATA = prior;
  }
});

test("#2574 packaged loader preserves fallback before promotion and accepts the promoted Human snapshot after write", async () => {
  const [loader, catalog, workspace, manifestText, snapshotText] = await Promise.all([
    read("modules/library/reference/afterglow-packaged-current.ts"),
    read("modules/library/project-library-catalog.ts"),
    read("modules/library/ui/library-workspace.tsx"),
    read("data/afterglow-packaged-current/manifest.json"),
    read("data/afterglow-packaged-current/snapshot.json"),
  ]);

  assert.match(loader, /createAfterglowV9FoundationsReference/u);
  assert.match(loader, /manifest\.status === "promoted"/u);
  assert.match(loader, /normalizeLibraryProject\(candidate\.project\)/u);
  assert.match(catalog, /referenceLoader: "afterglow-packaged-current"/u);
  assert.match(workspace, /createAfterglowPackagedCurrentReference/u);

  const manifest = JSON.parse(manifestText);
  const snapshot = JSON.parse(snapshotText);
  assert.ok(["pending-human-export", "promoted"].includes(manifest.status));
  assert.equal(snapshot.status, manifest.status);

  if (manifest.status === "pending-human-export") {
    assert.equal(snapshot.project, null);
    assert.equal(manifest.snapshotSha256, null);
  } else {
    assert.ok(snapshot.project && typeof snapshot.project === "object" && !Array.isArray(snapshot.project));
    assert.equal(snapshot.project.id, PACKAGED_PROJECT_ID);
    assert.match(manifest.snapshotSha256, /^[a-f0-9]{64}$/u);
  }
});

test("#2574 packaged manifest hashes suppress identical local media during later restore", async () => {
  const [recovery, promotion] = await Promise.all([
    read("modules/library/local-resource-recovery.ts"),
    read("scripts/promote-afterglow-packaged-example.mjs"),
  ]);

  assert.match(promotion, /contentHash: `sha256:\$\{sha256Bytes\(bytes\)\}`/u);
  assert.doesNotMatch(promotion, /records\.push\(\{[\s\S]*sourceFile:/u);
  assert.match(recovery, /PACKAGED_AFTERGLOW_CONTENT_HASHES/u);
  assert.match(recovery, /isAlreadyPackagedAfterglowAsset\(asset\)/u);
  assert.match(recovery, /if \(isAlreadyPackagedAfterglowAsset\(asset\)\) continue/u);
});

test("#2574 docs give the Human an explicit no-base64 Windows export/copy workflow", async () => {
  const [doc, pkg, ignore] = await Promise.all([
    read("docs/developer-briefs/2574-promote-afterglow-packaged-example.md"),
    read("package.json"),
    read(".gitignore"),
  ]);

  assert.match(doc, /Do not use base64\/data URLs/u);
  assert.match(doc, /%LOCALAPPDATA%\\PlotPickle\\assets/u);
  assert.match(doc, /Library → Import Export → Export story/u);
  assert.match(doc, /--scan/u);
  assert.match(doc, /--write/u);
  assert.match(doc, /public\/assets\/library\/examples\/afterglow\/current/u);
  assert.match(pkg, /"afterglow:package-example": "node scripts\/promote-afterglow-packaged-example\.mjs"/u);
  assert.match(ignore, /asset-map\.local\.json/u);
  assert.match(ignore, /input\.local\.ppf\.json/u);
});


test("#2576 Library export stays available for the active profile-local Afterglow state", async () => {
  const workspace = await read("modules/library/ui/library-workspace.tsx");

  assert.match(workspace, /const \[canExportCurrentStory, setCanExportCurrentStory\] = useState\(false\)/u);
  assert.match(workspace, /setCanExportCurrentStory\(Boolean\(sessionProject \?\? library\.activeProject\)\)/u);
  assert.match(workspace, /disabled=\{!canExportCurrentStory\} onClick=\{exportCurrentStory\}/u);
  assert.doesNotMatch(workspace, /disabled=\{!stories\.length\} onClick=\{exportCurrentStory\}/u);
});
