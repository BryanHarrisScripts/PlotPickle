import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const [
  projectSource,
  assetSource,
  dependencySource,
  folderSource,
  moduleSource,
  visualSource,
  graphicNovelSource,
  productionSource,
  documentation,
] = await Promise.all([
  readFile(new URL("../lib/project.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/project-assets.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/story-dependencies.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/project-folder.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/project-modules.ts", import.meta.url), "utf8"),
  readFile(new URL("../app/visual-storyboard.tsx", import.meta.url), "utf8"),
  readFile(new URL("../lib/ai-pitch-deck-base.ts", import.meta.url), "utf8"),
  readFile(new URL("../lib/preproduction.ts", import.meta.url), "utf8"),
  readFile(new URL("../docs/ISSUE-194-PPF-RELATIONSHIP-ASSETS.md", import.meta.url), "utf8"),
]);

test("Issue 194 upgrades the existing derived dependency read model instead of adding a second story graph", () => {
  assert.match(dependencySource, /DEPENDENCY_FORMAT_VERSION = "2\.0\.0"/);
  assert.match(dependencySource, /buildPpfRelationshipIndex = buildStoryDependencies/);
  assert.match(dependencySource, /relationshipIndexFingerprint/);
  assert.match(folderSource, /"dependencies\/index\.json"/);
  assert.match(folderSource, /derived: true/);
  assert.match(folderSource, /canonicalDataStoredHere: false/);
  assert.match(documentation, /rebuildable derived read model/i);
  assert.match(documentation, /never becomes a second canonical story graph/i);
});

test("Issue 194 gives the three existing visual workspaces one optional shared asset identity", () => {
  for (const marker of [
    "ProjectAssetRegistry",
    "ProjectAssetReference",
    "migrateLegacyAssetReferences",
  ]) assert.match(projectSource, new RegExp(marker));
  for (const marker of [
    "graphic-novel-panel",
    "storyboard-frame",
    "production-shot",
    "variations",
    "provenanceIds",
    "portableAssetPath",
  ]) assert.match(assetSource, new RegExp(marker));
  assert.match(visualSource, /migrateLegacyAssetReferences/);
  assert.match(graphicNovelSource, /migrateLegacyAssetReferences/);
  assert.match(productionSource, /assetRef: frame\?\.assetRef/);
  assert.match(productionSource, /resolveProjectAssetSource/);
});

test("Issue 194 remains an optional additive project module", () => {
  assert.match(moduleSource, /key: "assets".*required: false/);
  assert.match(folderSource, /"assets\/index\.json": project\.assets/);
  assert.match(folderSource, /assets: files\["assets\/index\.json"\]/);
  assert.match(documentation, /folder format remains 2\.3\.0/i);
  assert.match(documentation, /fields remain compatibility mirrors/i);
});

test("legacy visuals migrate, share identity, retain variations and round-trip", () => {
  const program = String.raw`
    import { createBlankProject, normalizePlotPickleProject } from "./lib/project.ts";
    import { createComicPitchDeckPlan } from "./lib/ai-pitch-deck.ts";
    import { createShotFromFrame, updateProductionShot } from "./lib/preproduction.ts";
    import { buildStoryDependencies, relationshipIndexFingerprint } from "./lib/story-dependencies.ts";
    import { createProjectFolder, parseProjectFolder } from "./lib/project-folder.ts";
    import { createPortableProjectFile, parsePortableProjectFile, portableProjectHash, serializePortableProjectFile } from "./lib/project-package.ts";
    import { projectAssetSourceRisks } from "./lib/project-assets.ts";

    let project = createBlankProject();
    const firstSource = "/api/local-ai/assets/shared.webp";
    project.blocks[0].visuals[0].src = firstSource;
    const deck = createComicPitchDeckPlan(project);
    deck.panels[0] = { ...deck.panels[0], imageSrc: firstSource, status: "complete" };
    project.review.pitchPackage.comicDeck = deck;
    project = normalizePlotPickleProject(project);
    if (!project) throw new Error("Legacy project normalization failed.");

    const frame = project.blocks[0].visuals[0];
    project = createShotFromFrame(project, 1, project.blocks[0].scenes[0].id, frame.id);
    const shotId = project.production.shots[0].id;
    const sharedReferences = [
      project.blocks[0].visuals[0].assetRef,
      project.review.pitchPackage.comicDeck.panels[0].assetRef,
      project.production.shots[0].assetRef,
    ];
    const sharedAssetId = sharedReferences[0]?.assetId || "";
    const sharedBefore = sharedReferences.every((reference) => reference?.assetId === sharedAssetId);

    project = updateProductionShot(project, shotId, { keyframeSrc: "/api/local-ai/assets/revised.webp" });
    const retainedAsset = project.assets.assets.find((asset) => asset.id === sharedAssetId);
    const firstFingerprint = relationshipIndexFingerprint(buildStoryDependencies(project));
    const secondFingerprint = relationshipIndexFingerprint(buildStoryDependencies(project));
    const index = buildStoryDependencies(project);
    const folder = createProjectFolder(project);
    const folderRoundTrip = parseProjectFolder(folder.files);
    const portable = createPortableProjectFile(project);
    const portableRoundTrip = parsePortableProjectFile(serializePortableProjectFile(portable));
    const portableOnly = structuredClone(project);
    portableOnly.assets.assets[0].variations[0].source = "";
    portableOnly.assets.assets[0].variations[0].sourceFingerprint = "";
    const portableOnlyRoundTrip = parsePortableProjectFile(serializePortableProjectFile(createPortableProjectFile(portableOnly)));

    const legacy = structuredClone(project);
    delete legacy.assets;
    for (const block of legacy.blocks) for (const visual of block.visuals) delete visual.assetRef;
    for (const panel of legacy.review.pitchPackage.comicDeck.panels) delete panel.assetRef;
    for (const shot of legacy.production.shots) delete shot.assetRef;
    const migratedLegacy = normalizePlotPickleProject(legacy);
    const legacyPortable = {
      ...portable,
      project: legacy,
      assets: [],
      integrity: { algorithm: "fnv1a-32", projectHash: portableProjectHash(legacy) },
    };
    const legacyPortableResult = parsePortableProjectFile(serializePortableProjectFile(legacyPortable));

    const risky = structuredClone(project.assets);
    risky.assets[0].variations[0].source = "/tmp/private-render.webp";
    let unsafePortableRejected = false;
    try {
      createPortableProjectFile({ ...project, assets: risky });
    } catch {
      unsafePortableRejected = true;
    }
    let unsafeManifestRejected = false;
    try {
      createPortableProjectFile(project, "test", [{
        id: "unsafe",
        path: "assets/unsafe.webp",
        mediaType: "image/webp",
        sha256: "",
        bytes: 0,
        source: "https://renderer.example/output.webp?access_token=not-a-real-token-value",
      }]);
    } catch {
      unsafeManifestRejected = true;
    }

    process.stdout.write(JSON.stringify({
      assetCount: project.assets.assets.length,
      targetKinds: retainedAsset?.targets.map((target) => target.kind).sort() || [],
      sharedBefore,
      variationCount: retainedAsset?.variations.length || 0,
      shotVariationChanged: project.production.shots[0].assetRef?.variationId !== project.blocks[0].visuals[0].assetRef?.variationId,
      approvedVariationPreserved: retainedAsset?.approvedVariationId === project.blocks[0].visuals[0].assetRef?.variationId,
      newVariationUnreviewed: retainedAsset?.variations.find((variation) => variation.id === project.production.shots[0].assetRef?.variationId)?.approval === "unreviewed",
      deterministic: firstFingerprint === secondFingerprint,
      assetNodes: index.graph.nodes.filter((node) => node.kind === "asset" || node.kind === "asset-variation").length,
      assetEdges: index.graph.edges.filter((edge) => edge.type === "uses-asset" || edge.type === "uses-asset-variation").length,
      brokenReferences: index.conflicts.filter((conflict) => conflict.type === "broken-reference").length,
      folderAssetCount: folderRoundTrip.assets.assets.length,
      folderDerivedOnly: folder.files["dependencies/index.json"].canonicalDataStoredHere === false,
      portableAssetCount: portableRoundTrip.project.assets.assets.length,
      portableManifestCount: portable.assets.length,
      portableOnlySource: portableOnlyRoundTrip.project.assets.assets[0].variations[0].source,
      portableOnlyPath: portableOnlyRoundTrip.project.assets.assets[0].variations[0].portablePath,
      portableOnlyFingerprint: portableOnlyRoundTrip.project.assets.assets[0].variations[0].sourceFingerprint,
      migratedLegacyAssetCount: migratedLegacy?.assets.assets.length || 0,
      legacyPortableIntegrity: legacyPortableResult.integrityValid,
      machinePathRisk: projectAssetSourceRisks(risky).some((finding) => finding.type === "machine-path"),
      unsafePortableRejected,
      unsafeManifestRejected,
    }));
  `;

  const result = JSON.parse(execFileSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", program],
    { cwd: root, encoding: "utf8" },
  ));

  assert.equal(result.assetCount, 1);
  assert.deepEqual(result.targetKinds, ["graphic-novel-panel", "production-shot", "storyboard-frame"]);
  assert.equal(result.sharedBefore, true);
  assert.equal(result.variationCount, 2);
  assert.equal(result.shotVariationChanged, true);
  assert.equal(result.approvedVariationPreserved, true);
  assert.equal(result.newVariationUnreviewed, true);
  assert.equal(result.deterministic, true);
  assert.ok(result.assetNodes >= 3);
  assert.ok(result.assetEdges >= 6);
  assert.equal(result.brokenReferences, 0);
  assert.equal(result.folderAssetCount, 1);
  assert.equal(result.folderDerivedOnly, true);
  assert.equal(result.portableAssetCount, 1);
  assert.equal(result.portableManifestCount, 2);
  assert.equal(result.portableOnlySource, "");
  assert.match(result.portableOnlyPath, /^assets\//);
  assert.match(result.portableOnlyFingerprint, /^fnv1a-/);
  assert.equal(result.migratedLegacyAssetCount, 1);
  assert.equal(result.legacyPortableIntegrity, true);
  assert.equal(result.machinePathRisk, true);
  assert.equal(result.unsafePortableRejected, true);
  assert.equal(result.unsafeManifestRejected, true);
});

test("Afterglow rebuilds the relationship index and asset registry from its existing visual workspaces", () => {
  const program = String.raw`
    import { createAfterglowProject } from "./data/afterglow-complete.ts";
    import { normalizePlotPickleProject } from "./lib/project.ts";
    import { createProjectFolder } from "./lib/project-folder.ts";
    import { buildStoryDependencies, relationshipIndexFingerprint } from "./lib/story-dependencies.ts";

    const project = normalizePlotPickleProject(createAfterglowProject());
    if (!project) throw new Error("Afterglow normalization failed.");
    const first = buildStoryDependencies(project);
    const second = buildStoryDependencies(project);
    const folder = createProjectFolder(project);
    process.stdout.write(JSON.stringify({
      retainedFrames: project.blocks.flatMap((block) => block.visuals).filter((frame) => frame.src).length,
      retainedAssets: project.assets.assets.length,
      retainedReferences: project.blocks.flatMap((block) => block.visuals).filter((frame) => frame.assetRef).length,
      assetFileCount: folder.files["assets/index.json"].assets.length,
      relationshipNodes: first.graph.nodes.length,
      brokenReferences: first.conflicts.filter((conflict) => conflict.type === "broken-reference").length,
      deterministic: relationshipIndexFingerprint(first) === relationshipIndexFingerprint(second),
    }));
  `;

  const result = JSON.parse(execFileSync(
    process.execPath,
    ["--import", "tsx", "--input-type=module", "-e", program],
    { cwd: root, encoding: "utf8" },
  ));

  assert.equal(result.retainedFrames, 96);
  assert.equal(result.retainedAssets, 96);
  assert.equal(result.retainedReferences, 96);
  assert.equal(result.assetFileCount, 96);
  assert.ok(result.relationshipNodes > 2_000);
  assert.equal(result.brokenReferences, 0);
  assert.equal(result.deterministic, true);
});

test("the additive JSON schema accepts shared asset references without making the module mandatory", async () => {
  for (const path of [
    "../schema/plotpickle-project.schema.json",
    "../schema/plotpickle-project-v1.7.schema.json",
  ]) {
    const schema = JSON.parse(await readFile(new URL(path, import.meta.url), "utf8"));
    assert.equal(schema.properties.assets.$ref, "#/$defs/projectAssetRegistry");
    assert.equal(schema.$defs.visual.properties.assetRef.$ref, "#/$defs/projectAssetReference");
    assert.equal(schema.$defs.comicPitchPanel.properties.assetRef.$ref, "#/$defs/projectAssetReference");
    assert.equal(schema.$defs.productionShot.properties.assetRef.$ref, "#/$defs/projectAssetReference");
    assert.equal(schema.$defs.projectAssetRegistry.properties.version.const, "1.0.0");
    assert.ok(!schema.required.includes("assets"));
  }
});
