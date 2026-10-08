import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";

const readText = (file) => readFile(path.resolve(file), "utf8");

function executableVisualContract(source) {
  const stripped = stripTypeScriptTypes(source).replace(/\bexport\s+/gu, "");
  return vm.runInNewContext(
    stripped + "\n({ isSupportedVisualAssetUrl, supportedVisualAssetKind, LOCAL_GENERATED_VISUAL_ASSET_PREFIX, PACKAGED_EXAMPLE_VISUAL_ASSET_PREFIX })",
  );
}

function executableMediaStorage(source, visual) {
  const start = source.indexOf("export function assetsDirectory");
  assert.ok(start >= 0);
  const executable = stripTypeScriptTypes(source.slice(start)).replace(/\bexport\s+/gu, "");
  return vm.runInNewContext(
    executable + "\n({ projectImageAssetFilePath, localImageAssetFilePath })",
    {
      path,
      process,
      persistentHome: () => path.resolve(".artifacts/2828-local-assets"),
      ASSET_PATH: visual.LOCAL_GENERATED_VISUAL_ASSET_PREFIX,
      PACKAGED_EXAMPLE_ASSET_PATH: visual.PACKAGED_EXAMPLE_VISUAL_ASSET_PREFIX,
      supportedVisualAssetKind: visual.supportedVisualAssetKind,
      Error,
    },
  );
}

function executableVideoSourceReference(source, visual, storage) {
  const start = source.indexOf("export async function videoSourceReference");
  assert.ok(start >= 0);
  const executable = stripTypeScriptTypes(source.slice(start)).replace(/\bexport\s+/gu, "");
  return vm.runInNewContext(
    executable + "\nvideoSourceReference",
    {
      isSupportedVisualAssetUrl: visual.isSupportedVisualAssetUrl,
      projectImageAssetFilePath: storage.projectImageAssetFilePath,
      readFile,
      path,
      URL,
      Error,
    },
  );
}

function storyboardCommand(project, command) {
  const artifacts = [...project.build.foundations.visualArtifacts];
  let accepted = [...project.build.foundations.acceptedVisualArtifactIds];
  if (command.type === "foundations.visual.store") {
    const index = artifacts.findIndex((item) => item.id === command.artifact.id);
    if (index >= 0) artifacts[index] = command.artifact;
    else artifacts.push(command.artifact);
  } else if (command.type === "foundations.visual.accept") {
    const index = artifacts.findIndex((item) => item.id === command.artifactId);
    assert.ok(index >= 0);
    artifacts[index] = { ...artifacts[index], reviewState: "accepted" };
    accepted = [...new Set([...accepted, command.artifactId])];
  } else if (command.type === "foundations.visual.unaccept") {
    const index = artifacts.findIndex((item) => item.id === command.artifactId);
    assert.ok(index >= 0);
    artifacts[index] = { ...artifacts[index], reviewState: "draft" };
    accepted = accepted.filter((id) => id !== command.artifactId);
  } else if (command.type === "foundations.visual.delete") {
    const index = artifacts.findIndex((item) => item.id === command.artifactId);
    if (index >= 0) artifacts.splice(index, 1);
    accepted = accepted.filter((id) => id !== command.artifactId);
  } else {
    throw new Error("Unexpected Storyboard command in #2828 fixture.");
  }
  return {
    ...project,
    revision: project.revision + 1,
    updatedAt: command.occurredAt,
    build: {
      ...project.build,
      foundations: {
        ...project.build.foundations,
        visualArtifacts: artifacts,
        acceptedVisualArtifactIds: accepted,
      },
    },
  };
}

test("#2828 real packaged Afterglow Storyboard media satisfies Save narration and media input contracts", async (t) => {
  const [manifest, snapshot, visualSource, projectSource, storageSource, mediaCommonSource] = await Promise.all([
    readText("data/afterglow-packaged-current/manifest.json").then(JSON.parse),
    readText("data/afterglow-packaged-current/snapshot.json").then(JSON.parse),
    readText("core/media/visual-asset-url.ts"),
    readText("core/project/project.ts"),
    readText("build/media-storage-common.ts"),
    readText("build/media-provider-common.ts"),
  ]);
  const visual = executableVisualContract(visualSource);
  const storage = executableMediaStorage(storageSource, visual);
  const videoSourceReference = executableVideoSourceReference(mediaCommonSource, visual, storage);
  const manifestStoryboardUrls = new Set(
    (manifest.assets ?? [])
      .map((item) => item?.publicUrl)
      .filter((value) => typeof value === "string" && value.includes("/storyboard-")),
  );
  assert.ok(manifestStoryboardUrls.size > 0, "the committed Afterglow package must include Storyboard media");

  const promotedProject = snapshot.project ?? snapshot;
  const artifact = (promotedProject.build?.foundations?.visualArtifacts ?? []).find((candidate) => (
    candidate.workflow === "storyboard-frame-webp-v2"
    && candidate.reviewState !== "rejected"
    && manifestStoryboardUrls.has(candidate.assetUrl)
  ));
  assert.ok(artifact, "the committed Afterglow snapshot must reference a committed Storyboard image from its manifest");
  assert.equal(visual.supportedVisualAssetKind(artifact.assetUrl), "packaged-example");
  assert.equal(visual.isSupportedVisualAssetUrl(artifact.assetUrl), true);
  assert.equal(visual.isSupportedVisualAssetUrl("/api/local-ai/assets/current-human-frame.webp"), true);
  assert.equal(visual.isSupportedVisualAssetUrl("/assets/unrelated/frame.webp"), false);
  assert.match(projectSource, /if \(!isSupportedVisualAssetUrl\(item\.assetUrl\)\) return null;/u);

  await t.test("the real committed image resolves inside the packaged root and is a valid video/reference source", async () => {
    const filePath = storage.projectImageAssetFilePath(artifact.assetUrl);
    const root = path.resolve("public/assets/library/examples");
    assert.ok(filePath.startsWith(root + path.sep));
    const bytes = await readFile(filePath);
    assert.ok(bytes.length > 0);
    const reference = await videoSourceReference(artifact.assetUrl);
    assert.match(reference, /^data:image\/(?:png|jpeg|webp);base64,/u);
    assert.throws(
      () => storage.projectImageAssetFilePath("/assets/library/examples/../package.json"),
      /unsafe PlotPickle image asset path/u,
    );
    assert.throws(
      () => storage.projectImageAssetFilePath("/assets/library/examples/%2e%2e/package.json"),
      /unsafe PlotPickle image asset path/u,
    );
  });

  await t.test("the actual Storyboard Save and Lock handlers retain packaged media without duplicating it", async () => {
    const anchorKey = (artifact.sourceDecisionKeys ?? []).find((key) => /^storyboard-anchor:block:block-\d{2}:mini-[1-4]$/u.test(key));
    assert.ok(anchorKey);
    const anchorMatch = /^storyboard-anchor:block:block-(\d{2}):mini-([1-4])$/u.exec(anchorKey);
    assert.ok(anchorMatch);
    const selectedNumber = Number(anchorMatch[1]);
    const selectedMiniBlockNumber = Number(anchorMatch[2]);
    let current = promotedProject;
    // This isolated packaged-media fixture simulates durable acknowledgements.
    // Until a Save actually completes it must not grant Lock authority.
    let acknowledged = false;
    const notices = [];
    const component = await readText("app/_components/storyboard/storyboard-readiness-workspace.tsx");
    const handlers = stripTypeScriptTypes(component.slice(
      component.search(/  (?:async )?function saveFrameVersion\(/u),
      component.indexOf("  const normalizedSourceEvidence"),
    ));
    const context = vm.createContext({
      Error,
      project: promotedProject,
      qaOnlyAccess: false,
      frameBusy: false,
      frameMutation: { current: false },
      selectedNumber,
      selectedMiniBlockNumber,
      STORYBOARD_LOCAL_SAVE_MARKER: "storyboard-local-save:v1",
      isSupportedVisualAssetUrl: visual.isSupportedVisualAssetUrl,
      storyboardArtifactSavedLocally: (item) => visual.isSupportedVisualAssetUrl(item.assetUrl)
        && (item.sourceDecisionKeys ?? []).includes("storyboard-local-save:v1"),
      loadFoundationProject: () => current,
      applyStoryCommand: storyboardCommand,
      getProfilePrivateSaveState: () => ({ state: acknowledged ? "saved" : "idle" }),
      saveFoundationProjectDurably: async (next, expectedRevision) => {
        assert.equal(current.revision, expectedRevision);
        current = next;
        acknowledged = true;
        return next;
      },
      setFrameSaving() {},
      setFrameNotice(value) { notices.push(value); },
      setFrameNoticePosition() {},
      setSelectedImageByPosition() {},
      setPendingDeleteArtifactId() {},
      onProjectChange() {},
    });
    vm.runInContext(handlers, context);

    const originalCount = current.build.foundations.visualArtifacts.length;
    assert.equal(acknowledged, false);
    await context.saveFrameVersion(artifact);
    assert.equal(acknowledged, true, "fixture grants Lock only after its simulated durable Save completes");
    let saved = current.build.foundations.visualArtifacts.find((candidate) => candidate.id === artifact.id);
    assert.ok(saved?.sourceDecisionKeys?.includes("storyboard-local-save:v1"));
    assert.match(notices.at(-1), /saved locally with this story/u);

    await context.reviewFrame(artifact, "unaccept");
    saved = current.build.foundations.visualArtifacts.find((candidate) => candidate.id === artifact.id);
    assert.equal(saved?.reviewState, "draft");
    assert.ok(saved?.sourceDecisionKeys?.includes("storyboard-local-save:v1"));

    await context.reviewFrame(artifact, "accept");
    saved = current.build.foundations.visualArtifacts.find((candidate) => candidate.id === artifact.id);
    assert.equal(saved?.reviewState, "accepted");
    assert.ok(saved?.sourceDecisionKeys?.includes("storyboard-local-save:v1"));
    assert.equal(current.build.foundations.visualArtifacts.length, originalCount, "Save/Lock must not copy or duplicate packaged media");
  });

  await t.test("Previs Graphic Novel and narration keep the same packaged-image contract", async () => {
    const source = await readText("app/_components/previs/previs-readiness-workspace.tsx");
    const localImageSource = stripTypeScriptTypes(source.slice(
      source.indexOf("async function localImage"),
      source.indexOf("function drawCover"),
    ));
    let fetched = false;
    const mimeType = artifact.assetUrl.toLowerCase().endsWith(".png")
      ? "image/png"
      : /\.jpe?g$/iu.test(artifact.assetUrl) ? "image/jpeg" : "image/webp";
    const context = vm.createContext({
      URL,
      window: { location: { origin: "http://127.0.0.1:3000" } },
      isSupportedVisualAssetUrl: visual.isSupportedVisualAssetUrl,
      fetch: async (url) => {
        const parsed = new URL(url);
        assert.equal(parsed.pathname, artifact.assetUrl);
        fetched = true;
        return new Response(await readFile(storage.projectImageAssetFilePath(parsed.pathname)), {
          status: 200,
          headers: { "Content-Type": mimeType },
        });
      },
      createImageBitmap: async () => ({ width: 1280, height: 720, close() {} }),
      Response,
    });
    vm.runInContext(localImageSource, context);
    const image = await context.localImage(artifact.assetUrl);
    assert.equal(fetched, true);
    assert.equal(image.width, 1280);
    assert.equal(source.includes("lockedImageContactSheet"), false, "Previs playback must not construct a narration contact sheet");
    assert.equal(source.includes('fetch("/api/previs/narration"'), false, "Previs must not generate text during playback");
    assert.match(source, /Playing approved text only/u);
  });
});

test("PP-SAVE-001 T7 same-version recovered media must be BOTH explicitly Saved and Locked before Previs handoff", async () => {
  const [contractSource, previsSource, handoffSource, snapshotSource] = await Promise.all([
    readText("core/contracts/build-progress.ts"),
    readText("app/_components/previs/previs-readiness-workspace.tsx"),
    readText("app/_components/preproduction/storyboard-locked-shot-handoff.tsx"),
    readText("data/afterglow-packaged-current/snapshot.json"),
  ]);
  const marker = "export function isSavedLockedStoryboardImage";
  const start = contractSource.indexOf(marker);
  assert.ok(start >= 0, "approved PP-SAVE-001 truth must be encoded in a shared canonical predicate");
  const evaluator = stripTypeScriptTypes(contractSource.slice(start)).replace(/^export /mu, "");
  const eligible = vm.runInNewContext(evaluator + "\n isSavedLockedStoryboardImage");
  const project = JSON.parse(snapshotSource).project;
  const artifact = project.build.foundations.visualArtifacts.find((item) =>
    item.workflow === "storyboard-frame-webp-v2"
    && item.frameNumber === 1
    && item.assetUrl.startsWith("/assets/library/examples/")
    && (item.sourceDecisionKeys ?? []).includes("storyboard-anchor:block:block-01:mini-1"));
  assert.ok(artifact, "exercise a real packaged Afterglow Storyboard image");
  const saved = { ...artifact, reviewState: "accepted",
    sourceDecisionKeys: [...new Set([...(artifact.sourceDecisionKeys ?? []), "storyboard-local-save:v1"])] };
  const accepted = new Set([saved.id]);
  assert.equal(eligible(saved, accepted), true, "identical explicitly saved and locked version is eligible");
  assert.equal(eligible({ ...saved, sourceDecisionKeys: saved.sourceDecisionKeys.filter((k) => k !== "storyboard-local-save:v1") }, accepted), false,
    "historic or uncommitted accepted candidate is not authoritative in Previs");
  assert.equal(eligible({ ...saved, reviewState: "draft" }, accepted), false, "Save without Lock is not eligible");
  assert.equal(eligible(saved, new Set()), false, "accepted reviewState without canonical accepted ID is insufficient");
  assert.equal(eligible({ ...saved, id: saved.id + "-alternate" }, accepted), false, "another candidate cannot inherit a Shot's approval");
  assert.equal(eligible({ ...saved, workflow: "storyboard-reference-adoption-v1" }, accepted), false, "other workflows cannot be silently promoted as saved Storyboard frames");
  assert.equal(eligible(JSON.parse(JSON.stringify(saved)), accepted), true, "saved exact artifact stays eligible after serialization");
  assert.match(previsSource, /isSavedLockedStoryboardImage\(artifact, acceptedVisualIds\)/u,
    "live Previs Flip Book/Graphic Novel must consult the exact-version Save+Lock gate");
  assert.match(handoffSource, /isSavedLockedStoryboardImage\(candidate, acceptedIds\)/u,
    "live Storyboard narration/handoff must consult the same Save+Lock gate");
});
