import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Foundations BUILD reuses the existing image provider boundary one frame at a time", async () => {
  const [workspace, localGateway, routingGateway, mediaCommon] = await Promise.all([
    read("modules/build/ui/foundations-build-workspace.tsx"),
    read("build/local-ai-gateway.ts"),
    read("build/ai-routing-gateway.ts"),
    read("build/media-provider-common.ts"),
  ]);

  assert.match(workspace, /fetch\("\/api\/local-ai\/generate\/image"/);
  assert.match(workspace, /for \(const frame of plans\)/);
  assert.match(workspace, /requestCount: 1/);
  assert.match(workspace, /quality: "low"/);
  assert.match(workspace, /aspect: "landscape"/);
  assert.match(localGateway, /IMAGE_PATHS = new Set\(\["\/api\/local-ai\/generate\/image"/);
  assert.match(localGateway, /imageRequestActive/);
  assert.match(routingGateway, /generateComfyImage/);
  assert.match(mediaCommon, /saveGeneratedAsset/);
  assert.match(mediaCommon, /ASSET_PATH = "\/api\/local-ai\/assets\/"/);
});

test("Foundations BUILD sends only approved story decisions and cannot rewrite PLAN", async () => {
  const [workspace, planner] = await Promise.all([
    read("modules/build/ui/foundations-build-workspace.tsx"),
    read("modules/build/wireframe/foundations-wireframe.ts"),
  ]);

  assert.match(workspace, /project\.foundations\.brief\.content/);
  assert.match(workspace, /assembleFoundationsBrief/);
  assert.match(workspace, /BUILD can visualize these decisions, but it cannot rewrite them/);
  assert.doesNotMatch(workspace, /foundations\.answer\.update|foundations\.proposal\.store|foundations\.brief\.save/);
  assert.match(planner, /Use only the accepted Foundations decisions supplied below/);
  assert.match(planner, /Do not invent named locations, character backstory, world rules, future plot beats/);
  assert.match(planner, /project\.foundations\.lessons/);
  assert.doesNotMatch(planner, /project\.world|project\.character|project\.theme|project\.structure/);
});

test("generated artifacts persist as project metadata while image bytes stay in the local asset store", async () => {
  const [contract, project, reducer, storage, library] = await Promise.all([
    read("core/contracts/build-progress.ts"),
    read("core/project/project.ts"),
    read("core/project/apply-command.ts"),
    read("core/storage/foundation-project-browser.ts"),
    read("core/storage/project-library-core.mjs"),
  ]);

  assert.match(contract, /interface FoundationsVisualArtifact/);
  assert.match(contract, /readonly assetUrl: string/);
  assert.match(contract, /readonly visualArtifacts/);
  assert.match(contract, /readonly frameNumber\?: number/);
  assert.match(contract, /readonly sourceDecisionKeys\?: readonly string\[\]/);
  assert.match(project, /normalizeVisualArtifact/);
  assert.match(project, /isSupportedVisualAssetUrl/);
  assert.match(project, /value\.startsWith\("\/api\/local-ai\/assets\/"\)/);
  assert.match(project, /value\.startsWith\("\/assets\/library\/examples\/"\)/);
  assert.match(project, /\.slice\(0, 75\)/);
  assert.match(reducer, /case "foundations\.visual\.store"/);
  assert.match(reducer, /visualArtifacts: \[\{ \.\.\.command\.artifact, reviewState:/);
  assert.match(storage, /saveActiveLibraryProject as saveFoundationProject/);
  assert.match(library, /JSON\.stringify\(entry\)/);
});

test("acceptance can only unlock progression for a real non-rejected stored artifact", async () => {
  const [reducer, guided, adapter] = await Promise.all([
    read("core/project/apply-command.ts"),
    read("modules/dashboard/guided-progression.ts"),
    read("modules/dashboard/foundations-progression.ts"),
  ]);

  assert.match(reducer, /const artifactExists = project\.build\.foundations\.visualArtifacts\.some/);
  assert.match(reducer, /artifact\.reviewState !== "rejected"/);
  assert.match(reducer, /case "foundations\.visual\.discard"/);
  assert.match(reducer, /reviewState: "rejected" as const/);
  assert.match(reducer, /acceptedVisualArtifactIds: project\.build\.foundations\.acceptedVisualArtifactIds\.filter/);
  assert.match(guided, /const foundationAcceptedVisualArtifactCount = project\.build\.foundations\.acceptedVisualArtifactIds\.length/);
  assert.match(guided, /const foundationBuildComplete = foundationPlanComplete && foundationAcceptedVisualArtifactCount > 0/);
  assert.match(guided, /unlocked: foundations\.complete/);
  assert.match(adapter, /worldUnlocked: Boolean\(world\?\.unlocked\)/);
});

test("cloud image use requires explicit paid acknowledgement while local generation does not", async () => {
  const workspace = await read("modules/build/ui/foundations-build-workspace.tsx");

  assert.match(workspace, /selectedOption\?\.locality === "cloud"/);
  assert.match(workspace, /cloudRoute && !billingAcknowledged/);
  assert.match(workspace, /separate paid image requests through my selected cloud account/);
  assert.match(workspace, /billingAcknowledged: cloudRoute \? billingAcknowledged : false/);
  assert.match(workspace, /Manual image mode is selected/);
});

test("Foundations BUILD preserves the shared three-column responsive workspace", async () => {
  const styles = await read("modules/build/ui/foundations-build-workspace.module.css");

  assert.match(styles, /grid-template-columns: minmax\(240px, 19%\) minmax\(440px, 56%\) minmax\(300px, 25%\)/);
  assert.match(styles, /\.wireframeGrid/);
  assert.match(styles, /@media \(max-width: 1050px\)/);
  assert.match(styles, /@media \(max-width: 820px\)/);
  assert.match(styles, /:focus-visible/);
});
