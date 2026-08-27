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
  assert.match(model, /AFTERGLOW_V9_FOUNDATIONS_WORKING_TITLE/);
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

test("#1424 activates the editorial loop only behind the previously proven Block 17 readiness target", async () => {
  const workspace = await read("app/_components/storyboard/storyboard-readiness-workspace.tsx");
  const page = await read("app/storyboard/page.tsx");

  assert.match(workspace, /AFTERGLOW_V9_VISUAL_READINESS_BLOCK_NUMBER/);
  assert.match(workspace, /target\.storyboardAllowed/);
  assert.match(workspace, /StoryboardEditorialWorkspace/);
  assert.match(workspace, /onProjectChange/);
  assert.match(page, /onProjectChange=\{setProject\}/);
  assert.doesNotMatch(page, /PlotPickleProject|plotpickle\.project\.v1|localStorage/);
});
