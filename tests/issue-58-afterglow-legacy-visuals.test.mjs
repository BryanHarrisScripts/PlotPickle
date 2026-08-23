import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const root = new URL("..", import.meta.url);
const source = (path) => readFile(new URL(path, root), "utf8");

async function manifest() {
  return JSON.parse(await source("data/afterglow-visual-manifest.json"));
}

test("exact Afterglow Images inventory is preserved", async () => {
  const report = JSON.parse(await source("public/afterglow/legacy-visuals/report.json"));
  assert.equal(report.sourceCount, 22);
  assert.equal(report.retainedCount, 21);
  assert.equal(report.placeholderCount, 1);
  assert.equal(report.omittedCount, 0);
  assert.equal(report.duplicateCount, 0);
  assert.equal(report.unresolvedCount, 3);
  assert.equal(report.derivativeCount, 66);
  assert.equal(report.sizeReductionPercent, 81.5);
  assert.deepEqual(report.failures, []);
});

test("every manifest visual has full card and thumbnail WebPs", async () => {
  const items = await manifest();
  assert.equal(items.length, 22);
  assert.equal(new Set(items.map((item) => item.id)).size, items.length);
  for (const item of items) {
    for (const key of ["thumb", "card", "full"]) {
      assert.match(item.images[key], /\.webp$/);
      await access(new URL(`public${item.images[key]}`, root));
    }
    assert.ok(item.source.originalFilename);
    assert.match(item.source.originalSha, /^[a-f0-9]{40}$/);
    assert.ok(item.source.repository);
    assert.ok(item.source.rightsNote);
  }
  assert.equal((await readdir(new URL("public/afterglow/legacy-visuals/full/", root))).filter((name) => name.endsWith(".webp")).length, 22);
  assert.equal((await readdir(new URL("public/afterglow/legacy-visuals/card/", root))).filter((name) => name.endsWith(".webp")).length, 22);
  assert.equal((await readdir(new URL("public/afterglow/legacy-visuals/thumbnail/", root))).filter((name) => name.endsWith(".webp")).length, 22);
});

test("story mapping preserves proposed status and known Block relationships", async () => {
  const items = await manifest();
  const byId = Object.fromEntries(items.map((item) => [item.id, item]));
  assert.deepEqual(byId["puppets-and-puppeteers"].proposedBlockNumbers, [1, 2]);
  assert.equal(byId["puppets-and-puppeteers"].mappingStatus, "proposed");
  assert.deepEqual(byId["summers-symphony"].proposedBlockNumbers, [3]);
  assert.deepEqual(byId["broken-numbers"].proposedBlockNumbers, [4]);
  assert.deepEqual(byId["lost-and-found-venice-beach"].proposedBlockNumbers, [16]);
  for (let block = 4; block <= 16; block += 1) {
    if ([8, 9, 10, 11, 12, 13, 14, 15, 16, 4, 5, 6, 7].includes(block)) assert.ok(items.some((item) => item.proposedBlockNumbers.includes(block)), `Missing mapped legacy visual for Block ${block}`);
  }
});

test("Banner remains historical placeholder and unresolved assets remain visible for review", async () => {
  const items = await manifest();
  const banner = items.find((item) => item.id === "banner-placeholder");
  assert.equal(banner.kind, "placeholder");
  assert.equal(banner.mappingStatus, "placeholder");
  assert.deepEqual(banner.proposedBlockNumbers, []);
  assert.match(banner.mappingNote, /Do not present as completed artwork for Blocks 17–24/);
  const unresolved = items.filter((item) => item.mappingStatus === "unmapped").map((item) => item.source.originalFilename).sort();
  assert.deepEqual(unresolved, ["AfterglowPrompts.png", "IndieWood.png", "ScreenwritingBlocks.png"]);
});

test("overview pitch visual bible and storyboard integrations keep approval boundaries", async () => {
  const overview = await source("app/project-overview.tsx");
  const labs = await source("app/specialist-labs.tsx");
  const storyboard = await source("app/visual-storyboard.tsx");
  const component = await source("app/afterglow-legacy-visuals.tsx");
  for (const phrase of ["Legacy Afterglow Visuals", "Earlier visual-development stage", "not automatically approved storyboard frames", "Prepare reviewable decision"]) assert.ok(component.includes(phrase), `Missing component boundary: ${phrase}`);
  assert.ok(overview.includes('mode="overview"'));
  assert.ok(labs.includes('mode="gallery"'));
  assert.ok(labs.includes('mode="pitch"'));
  assert.ok(storyboard.includes('mode="block"'));
  assert.match(storyboard, /current approved (?:storyboard )?image/i);
  assert.match(labs, /bundled legacy source visual/i);
});

test("legacy decisions use specialist review and do not mutate automatically", async () => {
  const model = await source("lib/afterglow-legacy-visuals.ts");
  const labs = await source("app/specialist-labs.tsx");
  for (const phrase of ["pin-reference", "approve-block-cover", "pitch-reference", "retire", "Source SHA", "does not duplicate the image into project data", "not classify it as a new AI generation event"]) assert.ok(model.includes(phrase), `Missing decision boundary: ${phrase}`);
  assert.ok(labs.includes("createSpecialistSuggestion"));
  assert.ok(labs.includes("applySpecialistSuggestion"));
  assert.ok(labs.includes("Nothing changes automatically"));
});

test("Summer and Isobel reconciliation is explicit", async () => {
  const component = await source("app/afterglow-legacy-visuals.tsx");
  assert.match(component, /Summer and Isobel as one character pending final reconciliation/);
  assert.match(component, /Legacy naming note/);
});

test("learning deep dive distinguishes concept card Block cover storyboard and production keyframe", async () => {
  const learning = await source("app/learning-early-visual-development.ts");
  const studio = await source("app/learning-studio.tsx");
  for (const phrase of ["From Concept Card to Storyboard Frame", "Legacy visual", "Block cover", "Storyboard frame", "Production keyframe", "Puppets across two Blocks", "Banner as unique art for Blocks 17–24"]) assert.ok(learning.includes(phrase), `Missing learning concept: ${phrase}`);
  assert.ok(studio.includes("earlyVisualDevelopmentLesson"));
  assert.ok(studio.includes("earlyVisualDevelopmentSearchText"));
});
