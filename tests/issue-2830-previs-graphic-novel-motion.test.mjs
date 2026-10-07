import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import vm from "node:vm";
import test from "node:test";
import { normalizePrevisProductionState } from "../core/contracts/previs/index.ts";

const readText = (file) => readFile(path.resolve(file), "utf8");

function executableMotionCurrency(source) {
  const start = source.indexOf("export function timelineMotionSourceKey");
  assert.ok(start >= 0);
  const executable = stripTypeScriptTypes(source.slice(start)).replace(/\bexport\s+/gu, "");
  return vm.runInNewContext(
    executable + "\n({ timelineMotionSourceKey, currentTimelineMotionForStoryboardShot })",
    {
      buildTimelineGenerationPacketForShot: () => ({ sourceFingerprint: "fingerprint-current" }),
      Boolean,
    },
  );
}

test("#2830 Graphic Novel selects motion only when the Timeline packet and locked Afterglow Shot are still current", async () => {
  const [manifest, snapshot, motionSource] = await Promise.all([
    readText("data/afterglow-packaged-current/manifest.json").then(JSON.parse),
    readText("data/afterglow-packaged-current/snapshot.json").then(JSON.parse),
    readText("app/_components/timeline/timeline-motion-source.ts"),
  ]);
  const motionContract = executableMotionCurrency(motionSource);
  const manifestStoryboardUrls = new Set(
    (manifest.assets ?? [])
      .map((item) => item?.publicUrl)
      .filter((value) => typeof value === "string" && value.includes("/storyboard-")),
  );
  const promoted = snapshot.project ?? snapshot;
  const artifact = (promoted.build?.foundations?.visualArtifacts ?? []).find((candidate) => (
    candidate.workflow === "storyboard-frame-webp-v2"
    && candidate.reviewState !== "rejected"
    && manifestStoryboardUrls.has(candidate.assetUrl)
    && (candidate.sourceDecisionKeys ?? []).some((key) => /^storyboard-anchor:block:block-\d{2}:mini-[1-4]$/u.test(key))
  ));
  assert.ok(artifact, "committed Afterglow must provide a packaged Storyboard artifact");

  const anchorRef = (artifact.sourceDecisionKeys ?? []).find((key) => /^storyboard-anchor:block:block-\d{2}:mini-[1-4]$/u.test(key));
  assert.ok(anchorRef);
  const position = artifact.frameNumber ?? 1;
  const anchorMatch = /^storyboard-anchor:block:block-(\d{2}):mini-([1-4])$/u.exec(anchorRef);
  assert.ok(anchorMatch);

  const placement = {
    id: "placement-current",
    anchorRef,
    blockNumber: Number(anchorMatch[1]),
    miniBlockNumber: Number(anchorMatch[2]),
    sourceRevision: promoted.revision,
    sourceKey: `previs-flip-book:${anchorRef}:${position}:${artifact.id}`,
    sourceKind: "previs-flip-book",
    shotImages: [{ shotNumber: position, artifactId: artifact.id }],
    durationSeconds: 75,
    order: 1,
    createdAt: "2026-10-07T17:00:00.000Z",
  };
  const expectedSourceKey = motionContract.timelineMotionSourceKey(placement, { sourceFingerprint: "fingerprint-current" });

  const normalized = normalizePrevisProductionState({
    timelineAssemblies: [{
      id: "timeline-current",
      sourceRevision: promoted.revision,
      placements: [placement],
      createdAt: "2026-10-07T17:00:00.000Z",
    }],
    timelineMotionShots: [
      {
        id: "wrong-artifact",
        placementId: placement.id,
        anchorRef,
        shotNumber: position,
        sourceArtifactId: "replaced-storyboard-artifact",
        sourceKey: expectedSourceKey,
        requestedDurationSeconds: 3,
        providerDurationSeconds: 4,
        provider: "fixture",
        route: "fixture",
        model: "fixture",
        jobId: "job-wrong-image",
        status: "succeeded",
        outputAssetUrl: "/api/local-ai/assets/stale-image-shot.mp4",
        error: "",
        createdAt: "2026-10-07T17:01:00.000Z",
        updatedAt: "2026-10-07T17:02:00.000Z",
      },
      {
        id: "wrong-packet",
        placementId: placement.id,
        anchorRef,
        shotNumber: position,
        sourceArtifactId: artifact.id,
        sourceKey: motionContract.timelineMotionSourceKey(placement, { sourceFingerprint: "fingerprint-before-script-change" }),
        requestedDurationSeconds: 3,
        providerDurationSeconds: 4,
        provider: "fixture",
        route: "fixture",
        model: "fixture",
        jobId: "job-stale-packet",
        status: "succeeded",
        outputAssetUrl: "/api/local-ai/assets/stale-packet-shot.mp4",
        error: "",
        createdAt: "2026-10-07T17:03:00.000Z",
        updatedAt: "2026-10-07T17:04:00.000Z",
      },
      {
        id: "current-motion",
        placementId: placement.id,
        anchorRef,
        shotNumber: position,
        sourceArtifactId: artifact.id,
        sourceKey: expectedSourceKey,
        requestedDurationSeconds: 3,
        providerDurationSeconds: 4,
        provider: "fixture",
        route: "fixture",
        model: "fixture",
        jobId: "job-current",
        status: "succeeded",
        outputAssetUrl: "/api/local-ai/assets/current-shot.mp4",
        error: "",
        createdAt: "2026-10-07T17:05:00.000Z",
        updatedAt: "2026-10-07T17:06:00.000Z",
      },
    ],
  });
  const project = {
    ...promoted,
    production: {
      ...promoted.production,
      timelineAssemblies: normalized.timelineAssemblies,
      timelineMotionShots: normalized.timelineMotionShots,
    },
  };

  const motion = motionContract.currentTimelineMotionForStoryboardShot(project, anchorRef, position, artifact.id);
  assert.equal(motion?.id, "current-motion");
  assert.equal(motion?.requestedDurationSeconds, 3);
  assert.equal(motion?.outputAssetUrl, "/api/local-ai/assets/current-shot.mp4");

  assert.equal(
    motionContract.currentTimelineMotionForStoryboardShot(project, anchorRef, position, "replacement-artifact"),
    null,
    "replacing the locked Storyboard image must invalidate earlier motion for Graphic Novel playback",
  );

  const changedPacketProject = {
    ...project,
    production: {
      ...project.production,
      timelineAssemblies: [{
        ...project.production.timelineAssemblies[0],
        placements: [{ ...placement, sourceKey: placement.sourceKey + ":changed" }],
      }],
    },
  };
  assert.equal(
    motionContract.currentTimelineMotionForStoryboardShot(changedPacketProject, anchorRef, position, artifact.id),
    null,
    "a changed Timeline source/packet must make the previous motion stale in Previs too",
  );
});

test("#2830 Previs plays three-second Graphic Novel motion with approved bubbles over the media", async () => {
  const [workspace, styles, presentation, timelineWorkspace, motionSource] = await Promise.all([
    readText("app/_components/previs/previs-readiness-workspace.tsx"),
    readText("app/_components/previs/previs-readiness-workspace.module.css"),
    readText("app/_components/previs/previs-graphic-novel-presentation.ts"),
    readText("app/_components/timeline/timeline-assembly-workspace.tsx"),
    readText("app/_components/timeline/timeline-motion-source.ts"),
  ]);

  assert.match(presentation, /PREVIS_GRAPHIC_NOVEL_INTERVAL_MS = 3000/u);
  assert.match(workspace, /currentTimelineMotionForStoryboardShot\(/u);
  assert.match(workspace, /graphicNovelMode && selectedGraphicNovelMotion/u);
  assert.match(workspace, /<video/u);
  assert.match(workspace, /src=\{selectedGraphicNovelMotion\.outputAssetUrl\}/u);
  assert.match(workspace, /selectedGraphicNovelDisplayPanel\.bubbles/u);
  assert.match(workspace, /selectedGraphicNovelDisplayPanel\.narration/u);
  assert.match(workspace, /Play Graphic Novel/u);
  assert.match(workspace, /Pause Graphic Novel/u);
  assert.match(workspace, /saveFoundationProjectDurably\(next, base\.revision\)/u);
  assert.match(workspace, /selectedFlipBookFrame\.locked\.assetUrl/u);
  assert.match(styles, /\.flipBookStage video/u);
  assert.match(styles, /\.motionBadge/u);
  assert.match(motionSource, /motion\.sourceKey === expectedSourceKey/u);
  assert.match(motionSource, /motion\.sourceArtifactId === sourceArtifactId/u);
  assert.match(motionSource, /motion\.status === "succeeded"/u);
  assert.match(timelineWorkspace, /buildTimelineGenerationPacketForShot\(project,/u);
  assert.match(timelineWorkspace, /timelineMotionSourceKey\(/u);
});
