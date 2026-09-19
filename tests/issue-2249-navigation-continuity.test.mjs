import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const readJson = async (path) => JSON.parse(await read(path));

test("#2249 records the Human UAT continuity repair without creating new authorities", async () => {
  const brief = await read("docs/developer-briefs/2249-skin-v1-navigation-continuity.md");
  for (const phrase of [
    "Notices / Licensing",
    "Visual Story",
    "BUILD Evidence",
    "All Curriculum",
    "FoundationsBuildWorkspace",
    "Surface Registry / Surface Orchestrator",
    "frozen set remains 30 surfaces",
  ]) assert.ok(brief.includes(phrase), `Missing #2249 brief contract: ${phrase}`);
});

test("#2249 global Dashboard return closes Licensing and Issue Log owner state", async () => {
  const host = await read("app/skin-v1/dashboard-bbs-review-host.tsx");
  const start = host.indexOf("const returnToDashboard = () =>");
  const end = host.indexOf("window.addEventListener", start);
  const handler = host.slice(start, end);

  assert.match(handler, /setLibraryOpen\(false\)/u);
  assert.match(handler, /closePreproductionSurfaces\(\)/u);
  assert.match(handler, /setOpenSourceOpen\(false\)/u);
  assert.match(handler, /setHelpIssueLogOpen\(false\)/u);
  assert.match(handler, /setShutdownOpen\(false\)/u);
  assert.match(host, /data-dashboard-review-surface="open-source"[\s\S]*closeOpenSource/u);
  assert.match(host, /data-dashboard-review-surface="help"[\s\S]*closeHelpIssueLog/u);
});

test("#2249 Visual Story has an explicit Storyboard-owned open and return lifecycle", async () => {
  const [storyboard, visual, capture] = await Promise.all([
    read("app/_components/storyboard/storyboard-readiness-workspace.tsx"),
    read("app/_components/storyboard/visual-story-workspace.tsx"),
    read("lib/verification/webmcp-surface-capture-registry.mjs"),
  ]);

  assert.match(storyboard, /const \[visualStoryOpen, setVisualStoryOpen\] = useState/u);
  assert.match(storyboard, /data-storyboard-open-visual-story="true"/u);
  assert.match(storyboard, /setVisualStoryOpen\(true\)/u);
  assert.match(storyboard, /\{visualStoryOpen && selectedTarget \? \(/u);
  assert.match(storyboard, /onReturnToStoryboard=\{\(\) => setVisualStoryOpen\(false\)\}/u);
  assert.match(visual, /data-skin-v1-return="storyboard"/u);
  assert.match(visual, />Back to Storyboard<\/button>/u);
  assert.match(visual, /onClick=\{onReturnToStoryboard\}/u);
  assert.doesNotMatch(storyboard + visual, /history\.back\(/u);

  const visualStart = capture.indexOf('"visual-story": Object.freeze');
  const visualEnd = capture.indexOf("profile: Object.freeze", visualStart);
  const visualContract = capture.slice(visualStart, visualEnd);
  assert.match(visualContract, /data-storyboard-open-visual-story='true'/u);
  assert.match(visualContract, /backPath: "Storyboard > Dashboard"/u);
});

test("#2249 BUILD Evidence returns to its actual source without replacing BUILD authority", async () => {
  const [host, surfaces] = await Promise.all([
    read("app/skin-v1/dashboard-bbs-review-host.tsx"),
    read("app/skin-v1/preproduction-review-surfaces.tsx"),
  ]);

  assert.match(host, /type BuildReturnTarget = "outline" \| "storyboard" \| "previs"/u);
  assert.match(host, /openBuild\(reviewAddress, "storyboard"\)/u);
  assert.match(host, /openBuild\(reviewAddress, "previs"\)/u);
  assert.match(host, /function returnFromBuild\(\)/u);
  assert.match(host, /if \(buildReturnTarget === "storyboard"\)[\s\S]*openStoryboard\(reviewAddress\)/u);
  assert.match(host, /if \(buildReturnTarget === "previs"\)[\s\S]*openPrevis\(reviewAddress\)/u);
  assert.match(surfaces, /import FoundationsBuildWorkspace/u);
  assert.match(surfaces, /<FoundationsBuildWorkspace/u);
  assert.match(surfaces, /data-preproduction-return/u);
  assert.match(surfaces, />Back to \{returnLabel\}<\/button>/u);
  assert.doesNotMatch(surfaces, /applyStoryCommand|createEmpty|manufacture/u);
});

test("#2249 BUILD presentation uses Skin V1 tokens instead of the old hard-coded teal/green skin", async () => {
  const [css, ownership] = await Promise.all([
    read("modules/build/ui/foundations-build-workspace.module.css"),
    readJson("config/verification/ownership-map.json"),
  ]);

  for (const token of [
    "--pp-skin-canvas",
    "--pp-skin-shell-max",
    "--pp-skin-line-strong",
    "--pp-skin-surface-1",
    "--pp-skin-accent-deep",
    "--pp-skin-accent-bright",
    "--pp-skin-focus",
  ]) assert.ok(css.includes(token), `BUILD Skin V1 token missing: ${token}`);
  assert.doesNotMatch(css, /#[0-9a-f]{3,8}\b/iu);
  assert.doesNotMatch(css, /rgba?\(/iu);

  const owner = ownership.rules.find((entry) => entry.id === "preproduction-connected-skin");
  assert.ok(owner?.include.includes("modules/build/ui/foundations-build-workspace.module.css"));
});

test("#2249 keeps the observed Previs selected state on the governed canonical dark accent", async () => {
  const [css, grammar] = await Promise.all([
    read("app/_components/previs/previs-readiness-workspace.module.css"),
    readJson("config/skin-v1-surface-grammar.json"),
  ]);
  const selected = grammar.selectedStateProfiles["canonical-dark-accent"];

  assert.equal(selected.backgroundToken, "--pp-skin-accent-deep");
  assert.match(css, /\.blockTab\[aria-selected="true"\][\s\S]*background: var\(--pp-skin-accent-deep\)/u);
  assert.match(css, /\.blockTab\[aria-selected="true"\][\s\S]*border-color: var\(--pp-skin-accent\)/u);
});

test("#2249 lesson detail remains inside the registered Writer's Craft surface and returns to the 96-lesson directory", async () => {
  const [explore, registry] = await Promise.all([
    read("app/skin-v1/learn-explore.tsx"),
    readJson("config/skin-v1-surface-registry.json"),
  ]);
  const writersCraft = registry.surfaces.find((entry) => entry.id === "writers-craft");

  assert.equal(
    writersCraft.runtimeSelector,
    "section[aria-label='LEARN Explore All Curriculum'][data-learn-explore-access='unrestricted']",
  );
  assert.match(explore, /if \(openEntry\)[\s\S]*aria-label="LEARN Explore All Curriculum"/u);
  assert.match(explore, /if \(openEntry\)[\s\S]*data-learn-explore-access="unrestricted"/u);
  assert.match(explore, /if \(openEntry\)[\s\S]*data-learn-explore-view="lesson"/u);
  assert.match(explore, /Back to All Curriculum/u);
  assert.match(explore, /onClick=\{\(\) => setOpenEntry\(null\)\}/u);
  assert.match(explore, /data-learn-explore-view="directory"/u);
});

test("#2249 preserves the frozen 30-surface WebMCP standard capture set", async () => {
  const registry = await readJson("config/skin-v1-surface-registry.json");
  assert.equal(registry.surfaces.filter((surface) => surface.capturePolicy === "standard").length, 30);
});
