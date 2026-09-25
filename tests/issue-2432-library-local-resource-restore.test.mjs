import assert from "node:assert/strict";
import test from "node:test";
import { createEmptyProject } from "../core/project/project.ts";
import { normalizeLibraryProject } from "../core/storage/library-project.ts";
import {
  createLibraryLoadSessionBaseline,
  inventoryLocalResources,
  parseRecoverableStoryboardAsset,
  restoreLocalStoryboardResources,
  revisionReconciliationState,
} from "../modules/library/local-resource-recovery.ts";

const fixed = "2026-09-24T20:00:00.000Z";
const project = normalizeLibraryProject(createEmptyProject({
  id: "afterglow-session-a",
  now: fixed,
  title: "Afterglow",
}));

function asset(fileName, modifiedAt = fixed) {
  return {
    fileName,
    url: `/api/local-ai/assets/${fileName}`,
    mediaType: "image/webp",
    bytes: 1024,
    contentHash: `sha256:${fileName.includes("-12-") ? "b".repeat(64) : "a".repeat(64)}`,
    modifiedAt,
  };
}

test("#2432 parses current Storyboard WebP filenames into Block/Mini-Block/position recovery evidence", () => {
  const parsed = parseRecoverableStoryboardAsset(asset(
    "storyboard-afterglow-session-a-1-1-11-1760000000000-1760000001000.webp",
  ));
  assert.deepEqual(parsed && {
    originProjectId: parsed.originProjectId,
    blockNumber: parsed.blockNumber,
    miniBlockNumber: parsed.miniBlockNumber,
    position: parsed.position,
  }, {
    originProjectId: "afterglow-session-a",
    blockNumber: 1,
    miniBlockNumber: 1,
    position: 11,
  });

  assert.equal(parseRecoverableStoryboardAsset(asset(
    "storyboard-afterglow-session-a-25-1-11-1760000000000-1760000001000.webp",
  )), null);
  assert.equal(parseRecoverableStoryboardAsset(asset(
    "storyboard-afterglow-session-a-1-1-26-1760000000000-1760000001000.webp",
  )), null);
});

test("#2432 preselects only exact-project local resource groups and keeps unmatched legacy groups explicit", () => {
  const exact = asset("storyboard-afterglow-session-a-1-1-11-1760000000000-1760000001000.webp");
  const legacy = asset("storyboard-legacy-copy-b-1-1-12-1760000000000-1760000001000.webp");
  const unrelated = { ...asset("poster.webp"), fileName: "poster.webp", url: "/api/local-ai/assets/poster.webp" };
  const inventory = inventoryLocalResources(project, [legacy, unrelated, exact]);
  assert.equal(inventory.storyboardResources.length, 2);
  assert.equal(inventory.unclassifiedAssets.length, 1);
  assert.equal(inventory.groups.length, 2);
  assert.equal(inventory.groups[0].originProjectId, "afterglow-session-a");
  assert.equal(inventory.groups[0].exactProject, true);
  assert.equal(inventory.groups[0].selectedByDefault, true);
  assert.equal(inventory.groups[1].originProjectId, "legacy-copy-b");
  assert.equal(inventory.groups[1].exactProject, false);
  assert.equal(inventory.groups[1].selectedByDefault, false);
});

test("#2432 restores selected Storyboard resources additively as draft candidates without accepting or overwriting defaults", () => {
  const inventory = inventoryLocalResources(project, [
    asset("storyboard-afterglow-session-a-1-1-11-1760000000000-1760000001000.webp"),
    asset("storyboard-legacy-copy-b-1-1-12-1760000000000-1760000001000.webp", "2026-09-24T20:01:00.000Z"),
  ]);
  const restored = restoreLocalStoryboardResources(project, inventory.storyboardResources);
  assert.equal(restored.attachedCount, 2);
  assert.equal(restored.skippedCount, 0);
  assert.equal(restored.project.build.foundations.acceptedVisualArtifactIds.length, 0);
  assert.equal(restored.project.build.foundations.visualArtifacts.length, 2);
  assert.ok(restored.project.build.foundations.visualArtifacts.every((item) => item.reviewState === "draft"));
  assert.ok(restored.project.build.foundations.visualArtifacts.every((item) => item.workflow === "storyboard-frame-webp-v2"));
  const position11 = restored.project.build.foundations.visualArtifacts.find((item) => item.frameNumber === 11);
  assert.ok(position11?.sourceDecisionKeys?.includes("storyboard-anchor:block:block-01:mini-1"));
  assert.ok(position11?.sourceDecisionKeys?.includes("storyboard-position:11"));

  const again = restoreLocalStoryboardResources(restored.project, inventory.storyboardResources);
  assert.equal(again.attachedCount, 0);
  assert.equal(again.skippedCount, 2);
  assert.equal(again.project.build.foundations.visualArtifacts.length, 2);
});

test("#2432 Load Session records the comparison ancestor and refuses last-write-wins semantics", () => {
  const baseline = createLibraryLoadSessionBaseline(
    { ...project, revision: 42 },
    { sessionId: "load-session-1", startedAt: fixed },
  );
  assert.equal(baseline.projectId, "afterglow-session-a");
  assert.equal(baseline.sourceIdentity, "project:afterglow-session-a");
  assert.equal(baseline.baseRevision, 42);
  assert.equal(revisionReconciliationState(baseline, 42), "same-base");
  assert.equal(revisionReconciliationState(baseline, 43), "requires-three-way");
});
