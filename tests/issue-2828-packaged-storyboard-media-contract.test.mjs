import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import vm from "node:vm";
import test from "node:test";
import { build } from "esbuild";

const readText = (file) => readFile(path.resolve(file), "utf8");

async function runtimeFixture() {
  const temporary = await mkdtemp(path.resolve("node_modules/.2828-packaged-media-"));
  const output = path.join(temporary, "fixture.mjs");
  await build({
    stdin: {
      contents: [
        'export { normalizeFoundationProject } from "./core/project/project.ts";',
        'export { applyStoryCommand } from "./core/project/apply-command.ts";',
        'export { isSupportedVisualAssetUrl, supportedVisualAssetKind } from "./core/media/visual-asset-url.ts";',
        'export { projectImageAssetFilePath } from "./build/media-storage-common.ts";',
        'export { videoSourceReference } from "./build/media-provider-common.ts";',
      ].join("\n"),
      resolveDir: process.cwd(),
      loader: "ts",
    },
    bundle: true,
    platform: "node",
    format: "esm",
    packages: "external",
    outfile: output,
    logLevel: "silent",
  });
  return { temporary, runtime: await import(pathToFileURL(output).href) };
}

test("#2828 real packaged Afterglow Storyboard media satisfies Save narration and media input contracts", async (t) => {
  const { temporary, runtime } = await runtimeFixture();
  try {
    const manifest = JSON.parse(await readText("data/afterglow-packaged-current/manifest.json"));
    const snapshot = JSON.parse(await readText("data/afterglow-packaged-current/snapshot.json"));
    const manifestStoryboardUrls = new Set(
      (manifest.assets ?? [])
        .map((item) => item?.publicUrl)
        .filter((value) => typeof value === "string" && value.includes("/storyboard-")),
    );
    assert.ok(manifestStoryboardUrls.size > 0, "the committed Afterglow package must include Storyboard media");

    const project = runtime.normalizeFoundationProject(snapshot);
    const artifact = project.build.foundations.visualArtifacts.find((candidate) => (
      candidate.workflow === "storyboard-frame-webp-v2"
      && candidate.reviewState !== "rejected"
      && manifestStoryboardUrls.has(candidate.assetUrl)
    ));
    assert.ok(artifact, "the committed Afterglow snapshot must reference a committed Storyboard image from its manifest");
    assert.equal(runtime.supportedVisualAssetKind(artifact.assetUrl), "packaged-example");
    assert.equal(runtime.isSupportedVisualAssetUrl(artifact.assetUrl), true);
    assert.equal(runtime.isSupportedVisualAssetUrl("/api/local-ai/assets/current-human-frame.webp"), true);
    assert.equal(runtime.isSupportedVisualAssetUrl("/assets/unrelated/frame.webp"), false);

    await t.test("the real committed image resolves inside the packaged root and is a valid video/reference source", async () => {
      const filePath = runtime.projectImageAssetFilePath(artifact.assetUrl);
      const root = path.resolve("public/assets/library/examples");
      assert.ok(filePath.startsWith(root + path.sep));
      const bytes = await readFile(filePath);
      assert.ok(bytes.length > 0);
      const reference = await runtime.videoSourceReference(artifact.assetUrl);
      assert.match(reference, /^data:image\/(?:png|jpeg|webp);base64,/u);
      assert.throws(
        () => runtime.projectImageAssetFilePath("/assets/library/examples/../package.json"),
        /unsafe PlotPickle image asset path/u,
      );
      assert.throws(
        () => runtime.projectImageAssetFilePath("/assets/library/examples/%2e%2e/package.json"),
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
      let current = project;
      const notices = [];
      const component = await readText("app/_components/storyboard/storyboard-readiness-workspace.tsx");
      const handlers = stripTypeScriptTypes(component.slice(
        component.search(/  (?:async )?function saveFrameVersion\(/u),
        component.indexOf("  const normalizedSourceEvidence"),
      ));
      const context = vm.createContext({
        Error,
        project,
        qaOnlyAccess: false,
        frameBusy: false,
        frameMutation: { current: false },
        selectedNumber,
        selectedMiniBlockNumber,
        STORYBOARD_LOCAL_SAVE_MARKER: "storyboard-local-save:v1",
        isSupportedVisualAssetUrl: runtime.isSupportedVisualAssetUrl,
        storyboardArtifactSavedLocally: (item) => runtime.isSupportedVisualAssetUrl(item.assetUrl)
          && (item.sourceDecisionKeys ?? []).includes("storyboard-local-save:v1"),
        loadFoundationProject: () => current,
        applyStoryCommand: runtime.applyStoryCommand,
        saveFoundationProjectDurably: async (next, expectedRevision) => {
          assert.equal(current.revision, expectedRevision);
          current = next;
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
      await context.saveFrameVersion(artifact);
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

    await t.test("narration contact-sheet preparation reads the same real packaged image", async () => {
      const source = await readText("app/_components/preproduction/storyboard-locked-shot-handoff.tsx");
      const functionSource = stripTypeScriptTypes(source.slice(
        source.indexOf("async function oneShotNarrationContactSheet"),
        source.indexOf("function compact"),
      ));
      let fetched = false;
      const mimeType = artifact.assetUrl.toLowerCase().endsWith(".png")
        ? "image/png"
        : /\.jpe?g$/iu.test(artifact.assetUrl) ? "image/jpeg" : "image/webp";
      const context = vm.createContext({
        AbortSignal,
        Error,
        URL,
        window: { location: { origin: "http://127.0.0.1:3000" } },
        isSupportedVisualAssetUrl: runtime.isSupportedVisualAssetUrl,
        fetch: async (url) => {
          const parsed = new URL(url);
          assert.equal(parsed.pathname, artifact.assetUrl);
          fetched = true;
          return new Response(await readFile(runtime.projectImageAssetFilePath(parsed.pathname)), {
            status: 200,
            headers: { "Content-Type": mimeType },
          });
        },
        createImageBitmap: async () => ({ width: 1280, height: 720, close() {} }),
        document: {
          createElement(name) {
            assert.equal(name, "canvas");
            return {
              width: 0,
              height: 0,
              getContext() {
                return {
                  fillStyle: "",
                  font: "",
                  textBaseline: "",
                  fillRect() {},
                  drawImage() {},
                  fillText() {},
                };
              },
              toDataURL() { return "data:image/jpeg;base64,ZmFrZQ=="; },
            };
          },
        },
        Response,
      });
      vm.runInContext(functionSource, context);
      const sheet = await context.oneShotNarrationContactSheet(artifact.assetUrl, artifact.frameNumber ?? 1, new AbortController().signal);
      assert.equal(fetched, true);
      assert.match(sheet, /^data:image\/jpeg;base64,/u);
      await assert.rejects(
        context.oneShotNarrationContactSheet("/assets/unrelated/frame.webp", 1, new AbortController().signal),
        /supported PlotPickle Storyboard image/u,
      );
    });
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
});
