import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("#1424 reuses bundled Afterglow references through the bounded local asset namespace", async () => {
  const route = await read("app/api/local-ai/assets/storyboard-reference/route.ts");
  const model = await read("app/_components/storyboard/storyboard-editorial-model.ts");

  assert.match(route, /block \(1-24\).*mini-block \(1-4\)/s);
  assert.match(route, /\/afterglow\/storyboard\/block-/);
  assert.match(route, /Response\.redirect\(target, 307\)/);
  assert.doesNotMatch(route, /fetch\(|writeFile|POST|DELETE|PUT/);

  assert.match(model, /createAfterglowStoryboardFrames/);
  assert.match(model, /\/api\/local-ai\/assets\/storyboard-reference\?block=/);
  assert.match(model, /AFTERGLOW_V9_FOUNDATIONS_FIXTURE_ID/);
  assert.match(model, /project\.id !== AFTERGLOW_V9_FOUNDATIONS_FIXTURE_ID/);
  assert.match(model, /STORYBOARD_REFERENCE_WORKFLOW = "storyboard-reference-adoption-v1"/);
});

test("#1424 maps a kept reference to one canonical PPF target with provenance instead of a legacy Storyboard store", async () => {
  const model = await read("app/_components/storyboard/storyboard-editorial-model.ts");
  const editorial = await read("app/_components/storyboard/storyboard-editorial-workspace.tsx");

  assert.match(model, /storyboard-target:\$\{targetId\}/);
  assert.match(model, /observed-reference:\$\{sourceRef\}/);
  assert.match(model, /ppf-revision:\$\{input\.project\.revision\}/);
  assert.match(model, /parentArtifactId: current\?\.id \?\? null/);
  assert.doesNotMatch(model, /PlotPickleProject|extensions|storyboardExploration/);

  assert.match(editorial, /applyStoryCommand/);
  assert.match(editorial, /foundations\.visual\.unaccept/);
  assert.match(editorial, /foundations\.visual\.store/);
  assert.match(editorial, /foundations\.visual\.accept/);
  assert.match(editorial, /saveFoundationProject\(next\)/);
  assert.match(editorial, /Human Keep decision/);
  assert.doesNotMatch(editorial, /localStorage|plotpickle\.project\.v1|\/api\/local-ai\/generate/);
});

test("#1424 keeps Change and Compare exploratory while Keep is the explicit approval action", async () => {
  const editorial = await read("app/_components/storyboard/storyboard-editorial-workspace.tsx");

  for (const label of [">Keep<", ">Change<", ">Compare<"]) {
    assert.ok(editorial.includes(label), `Missing Storyboard editorial action ${label}`);
  }
  assert.match(editorial, /function keepSelected\(\)/);
  assert.match(editorial, /function changeCandidate\(\)/);
  assert.match(editorial, /setComparing\(\(value\) => !value\)/);
  assert.match(editorial, /The kept PPF choice is unchanged until you choose Keep/);
  assert.match(editorial, /No reference is promoted merely because it exists/);
});

test("#1424 renders Storyboard as 24 Block tabs with four Mini-Block slots per selected Block", async () => {
  const workspace = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const css = await read("app/_components/storyboard/storyboard-readiness-workspace.module.css");

  assert.match(workspace, /Storyboard · 24 Blocks \/ 96 Mini-Blocks/);
  assert.match(workspace, /useState\(1\)/, "Block 01 must be the default Storyboard tab.");
  assert.match(workspace, /role="tablist"/);
  assert.match(workspace, /role="tab"/);
  assert.match(workspace, /role="tabpanel"/);
  assert.match(workspace, /\[1, 2, 3, 4\]\.map/);
  assert.match(workspace, /Visual slots<\/dt><dd>96/);
  assert.match(workspace, /A tab is always inspectable; only earned targets become authorable/);
  assert.match(workspace, /const canReviewReference = Boolean\(selectedTarget\.storyboardAllowed && reference\)/);
  assert.match(workspace, /disabled=\{!canReviewReference\}/);
  assert.match(workspace, /Awaiting candidate/);
  assert.match(workspace, /Locked by BUILD/);
  assert.match(css, /grid-template-columns: repeat\(24/);
  assert.match(css, /grid-template-columns: repeat\(4/);
});

test("#1424 uses the same five saturated evidence colours as BUILD and never restores legacy Storyboard authority", async () => {
  const workspace = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const css = await read("app/_components/storyboard/storyboard-readiness-workspace.module.css");
  const page = await read("app/storyboard/page.tsx");

  for (const label of ["DEFINED", "OBSERVED", "EMERGING", "MISSING", "LOCKED"]) assert.ok(workspace.includes(label));
  for (const colour of ["#35d779", "#3bb8ff", "#f6a93b", "#ff4d6d", "#a875ff"]) assert.ok(css.includes(colour));
  assert.match(workspace, /StoryboardEditorialWorkspace/);
  assert.match(workspace, /storyboardReferenceCandidates/);
  assert.match(workspace, /onProjectChange/);
  assert.match(page, /onProjectChange=\{setProject\}/);
  assert.doesNotMatch(workspace, /PlotPickleProject|plotpickle\.project\.v1|localStorage/);
  assert.doesNotMatch(page, /PlotPickleProject|plotpickle\.project\.v1|localStorage/);
});
