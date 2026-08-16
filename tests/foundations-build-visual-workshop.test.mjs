import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Foundations BUILD uses the existing single-image provider boundary", async () => {
  const [workspace, localGateway, routingGateway, mediaCommon] = await Promise.all([
    read("modules/build/ui/foundations-build-workspace.tsx"),
    read("build/local-ai-gateway.ts"),
    read("build/ai-routing-gateway.ts"),
    read("build/media-provider-common.ts"),
  ]);

  assert.match(workspace, /fetch\("\/api\/local-ai\/generate\/image"/);
  assert.match(workspace, /requestCount: 1/);
  assert.match(workspace, /aspect: "landscape"/);
  assert.match(localGateway, /IMAGE_PATHS = new Set\(\["\/api\/local-ai\/generate\/image"/);
  assert.match(localGateway, /imageRequestActive/);
  assert.match(routingGateway, /generateComfyImage/);
  assert.match(mediaCommon, /saveGeneratedAsset/);
  assert.match(mediaCommon, /ASSET_PATH = "\/api\/local-ai\/assets\/"/);
});

test("Foundations BUILD sends only approved story decisions and cannot rewrite PLAN", async () => {
  const workspace = await read("modules/build/ui/foundations-build-workspace.tsx");

  assert.match(workspace, /project\.foundations\.brief\.content/);
  assert.match(workspace, /assembleFoundationsBrief/);
  assert.match(workspace, /Use only the writer-approved decisions below/);
  assert.match(workspace, /BUILD can visualize these decisions, but it cannot rewrite them/);
  assert.doesNotMatch(workspace, /foundations\.answer\.update|foundations\.proposal\.store|foundations\.brief\.save/);
});

test("generated artifacts persist as project metadata while image bytes stay in the local asset store", async () => {
  const [contract, project, reducer, storage] = await Promise.all([
    read("core/contracts/build-progress.ts"),
    read("core/project/project.ts"),
    read("core/project/apply-command.ts"),
    read("core/storage/foundation-project-browser.ts"),
  ]);

  assert.match(contract, /interface FoundationsVisualArtifact/);
  assert.match(contract, /readonly assetUrl: string/);
  assert.match(contract, /readonly visualArtifacts/);
  assert.match(project, /normalizeVisualArtifact/);
  assert.match(project, /item\.assetUrl\.startsWith\("\/api\/local-ai\/assets\/"\)/);
  assert.match(reducer, /case "foundations\.visual\.store"/);
  assert.match(reducer, /visualArtifacts: \[command\.artifact, \.\.\.existing\]\.slice\(0, 12\)/);
  assert.match(storage, /JSON\.stringify\(project\)/);
});

test("acceptance can only unlock progression for a real stored artifact", async () => {
  const [reducer, guided, adapter] = await Promise.all([
    read("core/project/apply-command.ts"),
    read("modules/dashboard/guided-progression.ts"),
    read("modules/dashboard/foundations-progression.ts"),
  ]);

  assert.match(reducer, /const artifactExists = project\.build\.foundations\.visualArtifacts\.some/);
  assert.match(reducer, /artifactExists && !accepted\.includes\(command\.artifactId\)/);
  assert.match(reducer, /case "foundations\.visual\.discard"/);
  assert.match(reducer, /acceptedVisualArtifactIds: project\.build\.foundations\.acceptedVisualArtifactIds\.filter/);
  assert.match(guided, /project\.build\.foundations\.acceptedVisualArtifactIds\.length/);
  assert.match(guided, /const buildComplete = planComplete && acceptedVisualArtifactCount > 0/);
  assert.match(guided, /const unlocked = index === 0 && foundations\.complete/);
  assert.match(adapter, /worldUnlocked: Boolean\(world\?\.unlocked\)/);
});

test("cloud image use requires explicit paid acknowledgement while local generation does not", async () => {
  const workspace = await read("modules/build/ui/foundations-build-workspace.tsx");

  assert.match(workspace, /selectedOption\?\.locality === "cloud"/);
  assert.match(workspace, /cloudRoute && !billingAcknowledged/);
  assert.match(workspace, /can charge my selected cloud provider account/);
  assert.match(workspace, /billingAcknowledged: cloudRoute \? billingAcknowledged : false/);
  assert.match(workspace, /Manual image mode is selected/);
});

test("Foundations BUILD preserves the shared three-column responsive workspace", async () => {
  const styles = await read("modules/build/ui/foundations-build-workspace.module.css");

  assert.match(styles, /grid-template-columns: minmax\(240px, 19%\) minmax\(440px, 56%\) minmax\(300px, 25%\)/);
  assert.match(styles, /@media \(max-width: 1050px\)/);
  assert.match(styles, /@media \(max-width: 820px\)/);
  assert.match(styles, /:focus-visible/);
});
