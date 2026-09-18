import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#2170 extends existing ProductionShotIntent instead of creating a second Previs store", async () => {
  const contract = await read("core/contracts/previs/index.ts");

  assert.match(contract, /interface ProductionShotIntent/u);
  assert.match(contract, /readonly blockingIntent\?: string/u);
  assert.match(contract, /readonly performanceEnergy\?: string/u);
  assert.match(contract, /readonly pacingIntent\?: string/u);
  assert.match(contract, /readonly roughMotionEvidenceRefs\?: readonly string\[\]/u);
  assert.match(contract, /blockingIntent: cleanText\(item\.blockingIntent/u);
  assert.match(contract, /performanceEnergy: cleanText\(item\.performanceEnergy/u);
  assert.match(contract, /pacingIntent: cleanText\(item\.pacingIntent/u);
  assert.match(contract, /roughMotionEvidenceRefs: Array\.isArray/u);
  assert.match(contract, /\.slice\(0, 32\)/u);
  assert.match(contract, /interface PrevisProductionState[\s\S]*readonly shots: readonly ProductionShotIntent\[\]/u);
  assert.doesNotMatch(contract, /CharacterTruth|storyMatrix|screenplayText|new PrevisStore/u);
});

test("#2170 projects #2168/#2169 source and Storyboard provenance into every Previs anchor", async () => {
  const model = await read("app/_components/previs/previs-projection-model.ts");

  assert.match(model, /storyboardAnchorEvidence/u);
  assert.match(model, /storyboardCoverage: "kept" \| "candidate" \| "none"/u);
  assert.match(model, /sourcePassageCount: number/u);
  assert.match(model, /sourceSceneCount: number/u);
  assert.match(model, /structuralResponsibility: string/u);
  assert.match(model, /structuralFinding: string/u);
  assert.match(model, /sourceMappings: readonly/u);
  assert.match(model, /characterEvidenceRefs: readonly string\[\]/u);
  assert.match(model, /acceptedVisualRefs: readonly string\[\]/u);
  assert.match(model, /storyboard-source-kind:/u);
  assert.match(model, /storyboard-evidence:/u);
  assert.match(model, /keptStoryboardEvidenceRefs/u);
  assert.match(model, /storyEvidence\.passages\.length/u);
  assert.match(model, /storyEvidence\.sourceMappings/u);
});

test("#2170 begins from four Mini-Block visual coverage states and keeps missing motion/timing truthful", async () => {
  const [model, workspace] = await Promise.all([
    read("app/_components/previs/previs-projection-model.ts"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
  ]);

  assert.match(model, /const anchors = \[1, 2, 3, 4\]\.map/u);
  assert.match(model, /storyboardCoverage = kept \? "kept"/u);
  assert.match(model, /: observed \? "candidate"/u);
  assert.match(model, /: "none"/u);
  assert.match(workspace, /Visual coverage<\/dt>/u);
  assert.match(workspace, /KEPT STORYBOARD/u);
  assert.match(workspace, /CANDIDATE STORYBOARD/u);
  assert.match(workspace, /NO STORYBOARD VISUAL/u);
  assert.match(workspace, /timing missing/u);
  assert.match(workspace, /Missing motion or timing stays missing/u);
  assert.doesNotMatch(workspace, /infer.*timing.*24\/96/iu);
});

test("#2170 preserves exact Block/Mini coordinates through Previs, Storyboard and BUILD", async () => {
  const [workspace, page] = await Promise.all([
    read("app/_components/previs/previs-readiness-workspace.tsx"),
    read("app/previs/page.tsx"),
  ]);

  assert.match(workspace, /function requestedAddress/u);
  assert.match(workspace, /query\.get\("block"\)/u);
  assert.match(workspace, /query\.get\("mini"\)/u);
  assert.match(workspace, /function preservePrevisAddress/u);
  assert.match(workspace, /url\.searchParams\.set\("block", String\(blockNumber\)\)/u);
  assert.match(workspace, /url\.searchParams\.set\("mini", String\(miniBlockNumber\)\)/u);
  assert.match(workspace, /preservePrevisAddress\(anchor\.blockNumber, anchor\.miniBlockNumber\)/u);
  assert.match(page, /\/storyboard\?block=\$\{anchor\.blockNumber\}&mini=\$\{anchor\.miniBlockNumber\}/u);
  assert.match(page, /workspace=build&block=\$\{anchor\.blockNumber\}&mini=\$\{anchor\.miniBlockNumber\}/u);
});

test("#2170 keeps creative shot density variable and render-grid timing separate", async () => {
  const [contract, model, workspace] = await Promise.all([
    read("core/contracts/previs/index.ts"),
    read("app/_components/previs/previs-projection-model.ts"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
  ]);

  assert.match(contract, /Zero\/one\/many creative shots may share an anchor/u);
  assert.match(model, /project\.production\.shots[\s\S]*\.filter\(\(shot\) => shot\.anchorRef === anchorId\)/u);
  assert.match(model, /durationSeconds: null/u);
  assert.match(workspace, /creative shot density and timing remain variable/u);
  assert.match(workspace, /technical preset/u);
  assert.match(workspace, /clip grid is production plumbing, not a source of creative timing/u);
  assert.match(workspace, /current two-hour preset only/u);
  assert.match(model, /timing remains explicitly Human-authored/u);
});

test("#2170 records blocking, performance, pacing and rough motion as Human-authored shot intent", async () => {
  const [model, workspace] = await Promise.all([
    read("app/_components/previs/previs-projection-model.ts"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
  ]);

  assert.match(model, /blockingIntent: ""/u);
  assert.match(model, /performanceEnergy: ""/u);
  assert.match(model, /pacingIntent: ""/u);
  assert.match(model, /roughMotionEvidenceRefs: \[\]/u);
  assert.match(model, /reviewState: "planned"/u);

  assert.match(workspace, /Blocking intent/u);
  assert.match(workspace, /Performance energy/u);
  assert.match(workspace, /Pacing \/ rhythm intent/u);
  assert.match(workspace, /Rough motion evidence refs/u);
  assert.match(workspace, /These do not approve the shot/u);
  assert.match(workspace, /rough previews and motion references are evidence only/i);
  assert.match(workspace, /does not change a Production Shot from Planned to Approved/u);
});

test("#2170 keeps Storyboard dependency staleness and Human approval boundaries intact", async () => {
  const [model, workspace] = await Promise.all([
    read("app/_components/previs/previs-projection-model.ts"),
    read("app/_components/previs/previs-readiness-workspace.tsx"),
  ]);

  assert.match(model, /shot\.storyboardArtifactId !== kept\?\.id/u);
  assert.match(model, /shot\.storyboardDependencyKey !== dependencyKey/u);
  assert.match(model, /if \(!anchor\.timingAllowed \|\| !anchor\.storyboardArtifactId \|\| !anchor\.storyboardDependencyKey\) return null/u);
  assert.match(workspace, /Keep a current Storyboard visual before adding a creative Previs shot/u);
  assert.match(workspace, /Saving below is an explicit Human confirmation/u);
  assert.match(workspace, /option value="planned">Planned/u);
  assert.match(workspace, /option value="approved">Approved/u);
  assert.doesNotMatch(workspace, /auto.*approved|self-promot/iu);
});


test("#2170 Previs consumes the current Skin V1 screen contract instead of the old bespoke green palette", async () => {
  const css = await read("app/_components/previs/previs-readiness-workspace.module.css");

  for (const token of [
    "--pp-skin-canvas",
    "--pp-skin-font-ui",
    "--pp-skin-line-strong",
    "--pp-skin-fill-panel",
    "--pp-skin-fill-accent-header",
    "--pp-skin-accent-bright",
    "--pp-skin-selected-bg",
    "--pp-skin-selected-ink",
    "--pp-skin-focus",
    "--pp-skin-shadow-panel",
    "--pp-skin-radius",
    "--pp-skin-control-height",
    "--pp-skin-warning",
    "--pp-skin-danger",
  ]) {
    assert.ok(css.includes(token), `Previs is missing current Skin V1 token ${token}`);
  }

  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/iu);
  assert.doesNotMatch(css, /rgba?\(/iu);
  assert.doesNotMatch(css, /border-radius:\s*(?:[1-9]\d*px|999px)/iu);
  assert.match(css, /background:\s*var\(--pp-skin-canvas\)/u);
  assert.match(css, /font-family:\s*var\(--pp-skin-font-ui\)/u);
  assert.match(css, /background:\s*var\(--pp-skin-selected-bg\)/u);
  assert.match(css, /outline:\s*var\(--pp-skin-border-thin\) solid var\(--pp-skin-focus\)/u);
});


test("#2170 convergence surfaces use one Skin V1 palette, typography and square geometry", async () => {
  const surfaces = await Promise.all([
    read("modules/write/ui/block-native-write-workspace.module.css"),
    read("app/skin-v1/preproduction-review-flow.css"),
    read("app/_components/storyboard/storyboard-editorial-workspace.module.css"),
    read("app/_components/storyboard/storyboard-readiness-workspace.module.css"),
    read("app/_components/storyboard/visual-story-workspace.module.css"),
    read("app/_components/previs/previs-readiness-workspace.module.css"),
    read("app/_components/preproduction/preproduction-route-state.module.css"),
    read("app/pageflow/pageflow.module.css"),
    read("app/craftloop/craftloop.module.css"),
  ]);

  for (const [index, css] of surfaces.entries()) {
    const presentation = css.replace(/\/\*[\s\S]*?\*\//gu, "");
    assert.doesNotMatch(presentation, /#[0-9a-f]{3,8}\b/iu, `Surface ${index} must not carry a local hex palette`);
    assert.doesNotMatch(presentation, /rgba?\(/iu, `Surface ${index} must not carry local rgba presentation`);
    assert.doesNotMatch(presentation, /border-radius:\s*(?!var\(--pp-skin-radius\))[^;]+;/iu, `Surface ${index} must use canonical square radius`);
    assert.doesNotMatch(presentation, /ui-monospace|SFMono-Regular|Menlo|Arial|Helvetica|Consolas/u, `Surface ${index} must use the canonical Skin font token`);
    assert.match(presentation, /var\(--pp-skin-/u, `Surface ${index} must consume Skin V1 tokens`);
  }
});

test("#2170 keeps linked alternate screens intentional and preserves exact Block Mini context", async () => {
  const [storyLearning, preproductionNav, returnNav, root, storyboardPage, previsPage] = await Promise.all([
    read("modules/learn/model/story-learning-context.ts"),
    read("app/_components/preproduction/preproduction-context-nav.tsx"),
    read("app/_components/preproduction/preproduction-capability-return.tsx"),
    read("app/page.tsx"),
    read("app/storyboard/page.tsx"),
    read("app/previs/page.tsx"),
  ]);

  assert.match(storyLearning, /workspace: "dashboard"/);
  assert.match(storyLearning, /block: String\(context\.address\.blockNumber\)/);
  assert.match(storyLearning, /mini: String\(context\.address\.miniBlockNumber\)/);
  assert.match(root, /workspace === "dashboard"[\s\S]*<StoryMapWorkspace/u);
  assert.match(root, /case "visual-storytelling":[\s\S]*window\.location\.assign\("\/storyboard"\)/u);
  assert.match(root, /case "drafting":[\s\S]*navigateWorkspace\("write"\)/u);
  assert.doesNotMatch(root, /case "drafting":[\s\S]*\/pageflow/u);

  assert.match(preproductionNav, /outline:[\s\S]*href: "\/structure"/u);
  assert.match(preproductionNav, /storyboard:[\s\S]*href: "\/storyboard"/u);
  assert.match(preproductionNav, /previs:[\s\S]*href: "\/previs"/u);
  assert.match(preproductionNav, /function withAddress/u);
  assert.match(preproductionNav, /url\.searchParams\.set\("block", String\(blockNumber\)\)/u);
  assert.match(preproductionNav, /url\.searchParams\.set\("mini", String\(miniBlockNumber\)\)/u);
  assert.match(preproductionNav, /PageFlow · Diagnostic/u);
  assert.match(preproductionNav, /\/pageflow\?from=preproduction&return=/u);

  assert.match(returnNav, /dashboardReturnPath\(context\.returnPath\)/u);
  assert.match(returnNav, /source\.searchParams\.get\("block"\)/u);
  assert.match(returnNav, /source\.searchParams\.get\("mini"\)/u);

  assert.match(storyboardPage, /workspace=build&block=\$\{blockNumber\}&mini=\$\{miniBlockNumber\}/u);
  assert.match(previsPage, /\/storyboard\?block=\$\{anchor\.blockNumber\}&mini=\$\{anchor\.miniBlockNumber\}/u);
  assert.match(previsPage, /workspace=build&block=\$\{anchor\.blockNumber\}&mini=\$\{anchor\.miniBlockNumber\}/u);
});

test("#2170 linked PageFlow and CraftLoop surfaces are visually current while PageFlow authority migration remains #2180", async () => {
  const [pageFlowCss, craftLoopCss, pageFlowPage] = await Promise.all([
    read("app/pageflow/pageflow.module.css"),
    read("app/craftloop/craftloop.module.css"),
    read("app/pageflow/page.tsx"),
  ]);

  for (const css of [pageFlowCss, craftLoopCss]) {
    assert.match(css, /var\(--pp-skin-canvas\)/u);
    assert.match(css, /var\(--pp-skin-font-ui\)/u);
    assert.match(css, /var\(--pp-skin-fill-panel\)/u);
    assert.match(css, /var\(--pp-skin-selected-bg\)/u);
    assert.match(css, /var\(--pp-skin-focus\)/u);
  }

  assert.match(pageFlowPage, /const STORAGE_KEY = "plotpickle\.project\.v1"/u,
    "PageFlow authority migration is intentionally not hidden inside #2170; #2180 still owns removal of legacy screenplay storage.");
});
