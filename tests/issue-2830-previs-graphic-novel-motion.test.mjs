import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { normalizePrevisProductionState } from "../core/contracts/previs/index.ts";
import {
  PREVIS_GRAPHIC_NOVEL_INTERVAL_MS,
  currentGraphicNovelMotion,
} from "../app/_components/previs/previs-graphic-novel-presentation.ts";

const readText = (file) => readFile(path.resolve(file), "utf8");

test("#2830 Graphic Novel selects persisted motion only for the exact locked Afterglow Shot identity", async () => {
  const [manifest, snapshot] = await Promise.all([
    readText("data/afterglow-packaged-current/manifest.json").then(JSON.parse),
    readText("data/afterglow-packaged-current/snapshot.json").then(JSON.parse),
  ]);
  const manifestStoryboardUrls = new Set(
    (manifest.assets ?? [])
      .map((item) => item?.publicUrl)
      .filter((value) => typeof value === "string" && value.includes("/storyboard-")),
  );
  const project = snapshot.project ?? snapshot;
  const artifact = (project.build?.foundations?.visualArtifacts ?? []).find((candidate) => (
    candidate.workflow === "storyboard-frame-webp-v2"
    && candidate.reviewState !== "rejected"
    && manifestStoryboardUrls.has(candidate.assetUrl)
    && (candidate.sourceDecisionKeys ?? []).some((key) => /^storyboard-anchor:block:block-\d{2}:mini-[1-4]$/u.test(key))
  ));
  assert.ok(artifact, "committed Afterglow must provide a packaged Storyboard artifact");

  const anchorRef = (artifact.sourceDecisionKeys ?? []).find((key) => /^storyboard-anchor:block:block-\d{2}:mini-[1-4]$/u.test(key));
  assert.ok(anchorRef);
  const position = artifact.frameNumber ?? 1;
  const normalized = normalizePrevisProductionState({
    timelineMotionShots: [
      {
        id: "stale-other-artifact",
        placementId: "placement-1",
        anchorRef,
        shotNumber: position,
        sourceArtifactId: "replaced-storyboard-artifact",
        sourceKey: "old-source",
        requestedDurationSeconds: 3,
        providerDurationSeconds: 4,
        provider: "fixture",
        route: "fixture",
        model: "fixture",
        jobId: "job-old",
        status: "succeeded",
        outputAssetUrl: "/api/local-ai/assets/stale-shot.mp4",
        error: "",
        createdAt: "2026-10-07T17:00:00.000Z",
        updatedAt: "2026-10-07T17:01:00.000Z",
      },
      {
        id: "current-older",
        placementId: "placement-1",
        anchorRef,
        shotNumber: position,
        sourceArtifactId: artifact.id,
        sourceKey: "current-source-older",
        requestedDurationSeconds: 3,
        providerDurationSeconds: 4,
        provider: "fixture",
        route: "fixture",
        model: "fixture",
        jobId: "job-current-old",
        status: "succeeded",
        outputAssetUrl: "/api/local-ai/assets/current-shot-old.mp4",
        error: "",
        createdAt: "2026-10-07T17:02:00.000Z",
        updatedAt: "2026-10-07T17:03:00.000Z",
      },
      {
        id: "current-newest",
        placementId: "placement-2",
        anchorRef,
        shotNumber: position,
        sourceArtifactId: artifact.id,
        sourceKey: "current-source-newest",
        requestedDurationSeconds: 3,
        providerDurationSeconds: 4,
        provider: "fixture",
        route: "fixture",
        model: "fixture",
        jobId: "job-current-new",
        status: "succeeded",
        outputAssetUrl: "/api/local-ai/assets/current-shot-new.mp4",
        error: "",
        createdAt: "2026-10-07T17:04:00.000Z",
        updatedAt: "2026-10-07T17:05:00.000Z",
      },
    ],
  });

  const motion = currentGraphicNovelMotion(
    normalized.timelineMotionShots ?? [],
    anchorRef,
    position,
    artifact.id,
  );
  assert.equal(motion?.id, "current-newest");
  assert.equal(motion?.requestedDurationSeconds, 3);
  assert.equal(motion?.outputAssetUrl, "/api/local-ai/assets/current-shot-new.mp4");

  assert.equal(
    currentGraphicNovelMotion(normalized.timelineMotionShots ?? [], anchorRef, position, "replacement-artifact"),
    null,
    "replacing the locked Storyboard image must invalidate earlier motion for Graphic Novel playback",
  );
});

test("#2830 Previs plays three-second Graphic Novel motion with approved bubbles over the media", async () => {
  const [workspace, styles, presentation] = await Promise.all([
    readText("app/_components/previs/previs-readiness-workspace.tsx"),
    readText("app/_components/previs/previs-readiness-workspace.module.css"),
    readText("app/_components/previs/previs-graphic-novel-presentation.ts"),
  ]);

  assert.equal(PREVIS_GRAPHIC_NOVEL_INTERVAL_MS, 3000);
  assert.match(workspace, /currentGraphicNovelMotion\(/u);
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
  assert.match(presentation, /motion\.sourceArtifactId === sourceArtifactId/u);
  assert.match(presentation, /motion\.status === "succeeded"/u);
});
