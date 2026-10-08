import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import vm from "node:vm";

async function identityFunctions() {
  const source = await readFile("app/_components/previs/previs-graphic-novel-presentation.ts", "utf8");
  const start = source.indexOf("function normalizedBubbleStoryFacts(");
  const end = source.indexOf("\nexport function approvedGraphicNovelPanel(", start);
  assert.ok(start > 0 && end > start, "actual shared production identity implementation must exist");
  const executable = stripTypeScriptTypes(source.slice(start, end)).replace(/^export /gmu, "");
  const context = vm.createContext({ JSON, Array, Set });
  vm.runInContext(executable, context);
  return context;
}
const anchorRef = "storyboard-anchor:block:block-01:mini-1";
const image = {
  id: "accepted-image-01", assetUrl: "/api/local-ai/assets/one.webp",
  createdAt: "2026-10-08T01:00:00.000Z", workflow: "storyboard-frame-webp-v2",
  reviewState: "accepted", frameNumber: 1, narrativeIntention: "Ren at the door",
  sourceDecisionKeys: [anchorRef],
};
const shot = {
  id: "shot-01", anchorRef, order: 1, storyboardArtifactId: image.id,
  shotSize: "CU", angle: "front", movement: "static", lens: "50mm",
  visualIntent: "Ren at the door", blockingIntent: "left", performanceEnergy: "hesitant",
  pacingIntent: "slow", durationSeconds: 3, transitionIn: "cut", transitionOut: "doorway",
};
const project = {
  id: "afterglow",
  build: { foundations: { acceptedVisualArtifactIds: [image.id] } },
  production: { shots: [shot, { ...shot, id: "shot-02", order: 2, shotSize: "wide" }] },
};
const panel = {
  position: 1, assetUrl: image.assetUrl, caption: "Scene 1", narration: "Ren waits",
  shotLabel: "Shot 01 of 25", shotContext: "~3-second planning target", bubbles: [],
};
const passages = [{ id: "one", type: "dialogue", text: "We should go." }];
const context = { title: "Afterglow", block: 1, miniBlock: 1 };

test("PP-NARR-001 B6 uses one exact saved frame and complete authored Shot source", async () => {
  const { graphicNovelTextSourceSnapshot: snapshot, graphicNovelTextSourceKey: key } = await identityFunctions();
  const source = (p = project, artifact = image) =>
    key(panel, passages, context, snapshot(p, anchorRef, 1, artifact));
  const approved = source();
  assert.equal(source(JSON.parse(JSON.stringify(project)), JSON.parse(JSON.stringify(image))), approved,
    "serialized/reloaded project retains the same exact approval key");
  assert.equal(source({
    ...project, production: { shots: [
      { updatedAt: "later", createdAt: "reloaded", reviewState: "approved",
        performanceEnergy: "hesitant", ...shot, transitionIn: "cut", },
      project.production.shots[1],
    ] },
  }), approved, "lifecycle bookkeeping is not changed screenplay/Shot intent");
  const reorderedShot = Object.fromEntries(Object.entries(shot).reverse());
  assert.equal(source({ ...project, production: { shots: [reorderedShot, project.production.shots[1]] } }), approved,
    "storage normalization/reordering must not invalidate otherwise identical authored facts");
  assert.notEqual(key(panel, passages, context), approved,
    "old three-argument approvals cannot silently remain current");
  const change = (field, value) => ({
    ...project, production: { shots: [{ ...shot, [field]: value }, project.production.shots[1]] },
  });
  for (const [field, value] of [
    ["angle", "45°"], ["shotSize", "wide"], ["movement", "tracking"],
    ["lens", "85mm"], ["blockingIntent", "right"],
    ["performanceEnergy", "urgent"], ["pacingIntent", "quick"],
    ["durationSeconds", 5], ["transitionIn", "dissolve"],
    ["transitionOut", "corridor"], ["visualIntent", "Ren exits"],
    ["lightingIntent", "warm sunset"], ["informationBoundary", "withhold destination"],
  ]) assert.notEqual(source(change(field, value)), approved,
    `editing ${field} must make a saved Bubble stale`);
  assert.notEqual(source(project, { ...image, id: "accepted-image-02" }), approved,
    "another image version cannot inherit a saved caption");
  assert.notEqual(source(project, { ...image, createdAt: "2026-10-08T02:00:00.000Z" }), approved);
  assert.notEqual(source(project, { ...image, sourceDecisionKeys: [anchorRef, "storyboard-upstream:changed"] }), approved);
  assert.notEqual(source({ ...project, id: "different-project" }), approved);
  assert.notEqual(source({ ...project, build: { foundations: { acceptedVisualArtifactIds: [] } } }), approved,
    "an image that is no longer accepted cannot continue as current");
  assert.equal(source({
    ...project, production: { shots: [shot, { ...project.production.shots[1], shotSize: "medium" }] },
  }), approved, "unrelated Shot edits must not invalidate this Shot's Bubble");
});
test("PP-NARR-001 B6 Storyboard and Previs derive the identical snapshot, never a separate renderer key", async () => {
  const [storyboard, previs] = await Promise.all([
    readFile("app/_components/preproduction/storyboard-locked-shot-handoff.tsx", "utf8"),
    readFile("app/_components/previs/previs-readiness-workspace.tsx", "utf8"),
  ]);
  assert.match(storyboard, /graphicNovelTextSourceSnapshot\(project, anchorRef, panel\.position, artifact\)/u);
  assert.match(previs, /graphicNovelTextSourceSnapshot\(project, selectedAddressAnchor\?\.id \?\? "", panel\.position, artifact\)/u);
  assert.match(storyboard, /if \(!liveArtifact \|\| liveKey !== sourceKey\) throw new Error/u,
    "durable approval must revalidate the real current source");
  assert.match(storyboard, /if \(sourceKey !== requestedSourceKey\) return/u,
    "out-of-date generated responses must not become current");
  assert.match(previs, /return panel\.authoritative && approval && approval\.sourceKey === sourceKey/u);
});
