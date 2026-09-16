import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFile(new URL(path, root), "utf8");
const dataUrl = (source) => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;

async function loadHandoff() {
  const previs = stripTypeScriptTypes(await read("core/contracts/previs/index.ts"), { mode: "transform" });
  const previsUrl = dataUrl(previs);
  const handoff = stripTypeScriptTypes(await read("lib/preproduction/render-evidence-handoff.ts"), { mode: "transform" })
    .replaceAll('"../../core/contracts/previs"', JSON.stringify(previsUrl));
  return import(`${dataUrl(handoff)}#${Date.now()}-${Math.random()}`);
}

const anchorRef = "storyboard-anchor:block:block-01:mini-1";

function productionShot(id, order, dependencyKey = `storyboard-upstream:${id}`) {
  return {
    id,
    anchorRef,
    storyboardArtifactId: `frame-${order}`,
    storyboardDependencyKey: dependencyKey,
    order,
    shotSize: "Medium",
    angle: "Eye level",
    movement: "Locked",
    lens: "Natural",
    visualIntent: `Shot ${order}`,
    durationSeconds: order === 1 ? 6 : 9,
    transitionIn: "cut",
    transitionOut: "cut",
    reviewState: "approved",
    createdAt: "2026-09-16T00:00:00.000Z",
    updatedAt: "2026-09-16T00:00:00.000Z",
  };
}

function intentShot(shot) {
  return {
    editorialShotId: `editorial-${shot.order}`,
    anchorRef: shot.anchorRef,
    order: shot.order,
    narrativePurpose: `Purpose ${shot.order}`,
    camera: { shotSize: shot.shotSize, angle: shot.angle, movement: shot.movement, lensIntent: shot.lens, lightingIntent: "" },
    blocking: [],
    continuityLockReferences: [],
    informationDirectives: [],
    beatRefs: [],
    audioIntents: [],
    frameRefs: [shot.storyboardArtifactId],
    sceneRefs: [],
    assetRefs: [],
    execution: {
      productionShotId: shot.id,
      storyboardArtifactId: shot.storyboardArtifactId,
      storyboardDependencyKey: shot.storyboardDependencyKey,
      visualIntent: shot.visualIntent,
      durationSeconds: shot.durationSeconds,
      transitionIn: shot.transitionIn,
      transitionOut: shot.transitionOut,
    },
    sourceRefs: [shot.id],
  };
}

function productionIntent(shots) {
  return {
    version: 1,
    projectId: "story-1",
    canonicalRevision: 8,
    providerNeutral: true,
    projectionOnly: true,
    story: { storyRef: "story-1:story", title: "Story", premise: "", logline: "", theme: "" },
    shots: shots.map(intentShot),
    sourceRefs: shots.map((shot) => shot.id),
  };
}

function measurements(slots, shotIds = []) {
  return slots.map((slot, index) => ({
    renderAddress: slot.id,
    productionShotId: shotIds.length ? shotIds[index % shotIds.length] : "",
  }));
}

test("#2092 Phase 8 keeps 25 technical RenderClip slots independent from two variable creative shots", async () => {
  const { preparePreproductionRenderEvidenceHandoff } = await loadHandoff();
  const shots = [productionShot("shot-a", 1), productionShot("shot-b", 2)];
  const first = preparePreproductionRenderEvidenceHandoff({
    productionIntent: productionIntent(shots),
    productionShots: shots,
    blockNumber: 1,
    miniBlockNumber: 1,
  });

  assert.equal(first.technicalClipCount, 25);
  assert.equal(first.creativeShotCount, 2);
  assert.equal(first.technicalRenderSlots[0].anchorRef, anchorRef);
  assert.deepEqual(first.creativeShotRefs.map((shot) => shot.productionShotId), ["shot-a", "shot-b"]);
  assert.equal(first.bindingMode, "technical-only-multi-shot");
  assert.deepEqual(first.sequenceEvidenceProductionShots, []);
});

test("#2092 Phase 8 passes multiple creative shots to Sequence Evidence only with explicit per-clip shot provenance", async () => {
  const { preparePreproductionRenderEvidenceHandoff } = await loadHandoff();
  const shots = [productionShot("shot-a", 1), productionShot("shot-b", 2)];
  const base = preparePreproductionRenderEvidenceHandoff({
    productionIntent: productionIntent(shots),
    productionShots: shots,
    blockNumber: 1,
    miniBlockNumber: 1,
  });
  const handoff = preparePreproductionRenderEvidenceHandoff({
    productionIntent: productionIntent(shots),
    productionShots: shots,
    blockNumber: 1,
    miniBlockNumber: 1,
    measurements: measurements(base.technicalRenderSlots, ["shot-a", "shot-b"]),
  });

  assert.equal(handoff.bindingMode, "explicit-clip-shot-provenance");
  assert.deepEqual(handoff.sequenceEvidenceProductionShots.map((shot) => shot.id), ["shot-a", "shot-b"]);
  assert.deepEqual(handoff.unresolvedRenderAddresses, []);
  assert.equal(handoff.technicalClipCount, 25);
  assert.equal(handoff.creativeShotCount, 2);
});

test("#2092 Phase 8 refuses to guess a creative shot when multi-shot clip provenance is incomplete", async () => {
  const { preparePreproductionRenderEvidenceHandoff } = await loadHandoff();
  const shots = [productionShot("shot-a", 1), productionShot("shot-b", 2)];
  const base = preparePreproductionRenderEvidenceHandoff({
    productionIntent: productionIntent(shots),
    productionShots: shots,
    blockNumber: 1,
    miniBlockNumber: 1,
  });
  const bound = measurements(base.technicalRenderSlots, ["shot-a", "shot-b"]);
  bound[4] = { ...bound[4], productionShotId: "" };
  const handoff = preparePreproductionRenderEvidenceHandoff({
    productionIntent: productionIntent(shots),
    productionShots: shots,
    blockNumber: 1,
    miniBlockNumber: 1,
    measurements: bound,
  });

  assert.equal(handoff.bindingMode, "technical-only-multi-shot");
  assert.deepEqual(handoff.sequenceEvidenceProductionShots, []);
  assert.deepEqual(handoff.unresolvedRenderAddresses, [base.technicalRenderSlots[4].id]);
});

test("#2092 Phase 8 fails closed on stale or unknown Production Shot provenance", async () => {
  const { preparePreproductionRenderEvidenceHandoff } = await loadHandoff();
  const shots = [productionShot("shot-a", 1), productionShot("shot-b", 2)];
  const base = preparePreproductionRenderEvidenceHandoff({
    productionIntent: productionIntent(shots),
    productionShots: shots,
    blockNumber: 1,
    miniBlockNumber: 1,
  });

  assert.throws(() => preparePreproductionRenderEvidenceHandoff({
    productionIntent: productionIntent(shots),
    productionShots: shots,
    blockNumber: 1,
    miniBlockNumber: 1,
    measurements: [{ renderAddress: base.technicalRenderSlots[0].id, productionShotId: "shot-unknown" }],
  }), /not in the approved production intent/i);

  const stale = [{ ...shots[0], storyboardDependencyKey: "storyboard-upstream:changed" }, shots[1]];
  assert.throws(() => preparePreproductionRenderEvidenceHandoff({
    productionIntent: productionIntent(shots),
    productionShots: stale,
    blockNumber: 1,
    miniBlockNumber: 1,
  }), /stale relative to the approved pre-production intent/i);
});

test("#2092 Phase 8 preserves the safe single-shot fallback without creating 25 creative shots", async () => {
  const { preparePreproductionRenderEvidenceHandoff } = await loadHandoff();
  const shot = productionShot("shot-only", 1);
  const handoff = preparePreproductionRenderEvidenceHandoff({
    productionIntent: productionIntent([shot]),
    productionShots: [shot],
    blockNumber: 1,
    miniBlockNumber: 1,
  });

  assert.equal(handoff.bindingMode, "single-creative-shot");
  assert.equal(handoff.sequenceEvidenceProductionShots.length, 1);
  assert.equal(handoff.creativeShotCount, 1);
  assert.equal(handoff.technicalClipCount, 25);
});
