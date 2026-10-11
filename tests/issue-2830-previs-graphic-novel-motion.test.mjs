import assert from "node:assert/strict";
import { readFile, mkdtemp, rm } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import path from "node:path";
import os from "node:os";
import vm from "node:vm";
import test from "node:test";
import { normalizePrevisProductionState } from "../core/contracts/previs/index.ts";
import { createProfilePrivateStorageService } from "../core/storage/profile-private/profile-private-storage-core.mjs";

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
  assert.doesNotMatch(workspace, /saveFoundationProjectDurably|lockedImageContactSheet/u,
    "Previs plays approved motion and Bubble text without creating new approval");
  assert.match(workspace, /selectedFlipBookFrame\.locked\.assetUrl/u);
  assert.match(styles, /\.flipBookStage video/u);
  assert.match(styles, /\.motionBadge/u);
  assert.match(motionSource, /motion\.sourceKey === expectedSourceKey/u);
  assert.match(motionSource, /motion\.sourceArtifactId === sourceArtifactId/u);
  assert.match(motionSource, /motion\.status === "succeeded"/u);
  assert.match(timelineWorkspace, /buildTimelineGenerationPacketForShot\(project,/u);
  assert.match(timelineWorkspace, /timelineMotionSourceKey\(/u);
});

test("#2830 Graphic Novel and Timeline cap provider video to three seconds and Pause controls real playback", async () => {
  const [presentation, previs, timeline] = await Promise.all([
    readText("app/_components/previs/previs-graphic-novel-presentation.ts"),
    readText("app/_components/previs/previs-readiness-workspace.tsx"),
    readText("app/_components/timeline/timeline-assembly-workspace.tsx"),
  ]);
  const start = presentation.indexOf("export function enforceMotionPresentationEnd(");
  const end = presentation.indexOf("export type PrevisGraphicNovelBubble", start);
  assert.ok(start >= 0 && end > start, "the actual presentation end guard must be executable");
  const code = stripTypeScriptTypes(presentation.slice(start, end)).replace(/\bexport\s+/gu, "");
  const enforce = vm.runInNewContext(code + "\n enforceMotionPresentationEnd", { Number });
  const video = { currentTime: 2.4, paused: 0, pause() { this.paused++; } };
  assert.equal(enforce(video, 3), false);
  assert.equal(video.currentTime, 2.4);
  assert.equal(video.paused, 0);
  video.currentTime = 3;
  assert.equal(enforce(video, 3), true);
  assert.equal(video.paused, 1);
  video.currentTime = 4.2; // legal provider duration can exceed desired timeline slot
  assert.equal(enforce(video, 3), true);
  assert.equal(video.currentTime, 3);
  assert.equal(video.paused, 2);
  video.currentTime = 2;
  assert.equal(enforce(video, 0), false, "invalid presentation duration cannot pause a clip");
  assert.equal(video.paused, 2);

  assert.match(previs, /autoPlay=\{graphicNovelPlaying\}/u);
  assert.match(previs, /ref=\{graphicNovelVideoRef\}/u);
  assert.match(previs, /if \(!graphicNovelMode \|\| !graphicNovelPlaying\) \{\s*video\.pause\(\)/u);
  assert.match(previs, /onTimeUpdate=\{\(event\) => enforceMotionPresentationEnd\(event\.currentTarget, PREVIS_GRAPHIC_NOVEL_INTERVAL_MS \/ 1000\)\}/u);
  assert.match(timeline, /onTimeUpdate=\{\(event\) => enforceMotionPresentationEnd\(event\.currentTarget, PLANNING_SECONDS_PER_SHOT\)\}/u);
  assert.match(timeline, /onSeeking=\{\(event\) => enforceMotionPresentationEnd\(event\.currentTarget, PLANNING_SECONDS_PER_SHOT\)\}/u);
  assert.match(previs, /selectedFlipBookFrame\.locked\.assetUrl/u, "missing or stale motion still shows authoritative image");
});

test("#2830 Previs and Timeline runtime playback edits select the Windows build proof", async () => {
  const workflow = await readText(".github/workflows/architecture-shadow.yml");
  const scope = workflow.split("\n").find((line) => line.includes("then build=true; fi"));
  assert.ok(scope, "the product Windows lane must have an explicit build selection");
  const rawPattern = scope.match(/grep -Eq '([^']+)'/u)?.[1];
  assert.ok(rawPattern, "read the exact executable Windows impact regex");
  const selected = new RegExp(rawPattern);
  for (const path of [
    "app/_components/previs/previs-readiness-workspace.tsx",
    "app/_components/previs/previs-graphic-novel-presentation.ts",
    "app/_components/timeline/timeline-assembly-workspace.tsx",
    "app/_components/preproduction/storyboard-locked-shot-handoff.tsx",
  ]) assert.equal(selected.test(path), true, path + " must select the Windows build gate");
  assert.equal(selected.test("docs/developer-briefs/2830-mini-block-comic-motion-slice.md"), false,
    "documentation-only changes must not fan out into the expensive Windows lane");
});


test("#2830 stored Afterglow Storyboard, Bubble and current Motion recover together through encrypted vault reopen", async (t) => {
  const home = await mkdtemp(path.join(os.tmpdir(), "plotpickle-2830-reopen-"));
  const authService = {
    createProfileVaultCapability(context) {
      return {
        profileId: context.profileId,
        async wrapSecret({ secret }) { return { payload: Buffer.from(secret).toString("base64") }; },
        async unwrapSecret({ envelope }) { return Uint8Array.from(Buffer.from(envelope.payload, "base64")); },
      };
    },
    registerVaultCleanupHook() { return () => undefined; },
    resolveSession() { return {}; },
  };
  const makeVault = () => createProfilePrivateStorageService({
    root: home, authService, normalizeProject: value => structuredClone(value),
  });
  const primary = { profileId: "profile_afterglow_motion", sessionId: "session_before" };
  const another = { profileId: "profile_other_story", sessionId: "session_other" };
  const [original, manifest] = await Promise.all([
    readText("data/afterglow-packaged-current/snapshot.json").then(JSON.parse),
    readText("data/afterglow-packaged-current/manifest.json").then(JSON.parse),
  ]);
  const project = original.project ?? original;
  const approvedPackagedMedia = new Set((manifest.assets ?? [])
    .map(item => item?.publicUrl)
    .filter(value => typeof value === "string" && value.includes("/storyboard-")));
  const artifact = project.build.foundations.visualArtifacts.find(item => (
    item.workflow === "storyboard-frame-webp-v2"
    && approvedPackagedMedia.has(item.assetUrl)
    && item.sourceDecisionKeys?.some(key => /^storyboard-anchor:block:block-\d{2}:mini-[1-4]$/u.test(key))
  ));
  assert.ok(artifact, "do not substitute a synthetic image for packaged Afterglow");
  const anchorRef = artifact.sourceDecisionKeys.find(key => key.startsWith("storyboard-anchor:"));
  const match = /^storyboard-anchor:block:block-(\d{2}):mini-([1-4])$/u.exec(anchorRef);
  assert.ok(match);
  const position = artifact.frameNumber ?? 1;
  const date = "2026-10-10T12:00:00.000Z";
  const placement = {
    id: "mini-block-reopen", anchorRef, blockNumber: Number(match[1]),
    miniBlockNumber: Number(match[2]), sourceRevision: project.revision,
    sourceKey: "previs-flip-book:" + artifact.id, sourceKind: "previs-flip-book",
    shotImages: [{ shotNumber: position, artifactId: artifact.id }],
    durationSeconds: 75, order: 1, createdAt: date,
  };
  const motionSource = await readText("app/_components/timeline/timeline-motion-source.ts");
  const key = executableMotionCurrency(motionSource).timelineMotionSourceKey(placement, {
    sourceFingerprint: "fingerprint-current",
  });
  const expectedMediaUrl = "/api/local-ai/assets/afterglow-reopen-fixture.mp4";
  // Synthetic provider *receipt* tests persistence, not generation: no provider
  // is contacted and this fixture does not represent a physically present MP4.
  const normalized = normalizePrevisProductionState({
    timelineAssemblies: [{ id: "mini-block-reopen-assembly", sourceRevision: project.revision,
      placements: [placement], createdAt: date }],
    timelineMotionShots: [{
      id: "mini-block-reopen-motion", placementId: placement.id,
      anchorRef, shotNumber: position, sourceArtifactId: artifact.id,
      sourceKey: key, packetFingerprint: "fingerprint-current",
      requestedDurationSeconds: 3, providerDurationSeconds: 4,
      provider: "fixture", route: "fixture", model: "fixture", jobId: "job-fixture",
      status: "succeeded", outputAssetUrl: expectedMediaUrl, error: "",
      createdAt: date, updatedAt: date,
    }],
    graphicNovelTextApprovals: [{
      anchorRef, position, sourceKey: "approved-bubble-fixture",
      narration: "A choice changes everything.", bubbles: [], noText: false,
      approvedAt: date,
    }],
  });
  assert.equal(normalized.timelineMotionShots.length, 1);
  assert.equal(normalized.graphicNovelTextApprovals.length, 1);
  const saved = {
    ...project, production: { ...project.production,
      timelineAssemblies: normalized.timelineAssemblies,
      timelineMotionShots: normalized.timelineMotionShots,
      graphicNovelTextApprovals: normalized.graphicNovelTextApprovals },
  };
  const before = makeVault();
  t.after(async () => { before.close(); await rm(home, { recursive: true, force: true }); });
  await before.saveProject(primary, { project: saved, activate: true });
  assert.equal(await before.loadProject(another, saved.id), null, "profile boundary excludes another user");
  before.close();
  const reopened = makeVault();
  try {
    const reloaded = await reopened.loadProject({ ...primary, sessionId: "session_after" }, saved.id);
    assert.ok(reloaded, "same profile explicitly restores the project after a new session");
    assert.equal(reloaded.build.foundations.visualArtifacts.find(x => x.id === artifact.id)?.assetUrl,
      artifact.assetUrl, "same locked image identity survives encrypted reload");
    const text = reloaded.production.graphicNovelTextApprovals.find(x => x.position === position && x.anchorRef === anchorRef);
    assert.equal(text?.narration, "A choice changes everything.");
    const current = executableMotionCurrency(motionSource).currentTimelineMotionForStoryboardShot(
      reloaded, anchorRef, position, artifact.id);
    assert.equal(current?.outputAssetUrl, expectedMediaUrl);
    assert.equal(current?.sourceArtifactId, artifact.id);
    assert.equal(current?.requestedDurationSeconds, 3);
    assert.equal(current?.providerDurationSeconds, 4, "source duration remains truthful after reopen");
    assert.equal(executableMotionCurrency(motionSource).currentTimelineMotionForStoryboardShot(
      reloaded, anchorRef, position, "another-artifact"), null,
      "reopened motion must remain bound to its original exact Shot artifact");
  } finally { reopened.close(); }
});

test("#2830 resumes an exact current queued job without a second paid POST or confirmation", async () => {
  const source = await readText("app/_components/timeline/timeline-assembly-workspace.tsx");
  const start = source.indexOf("  async function generateMotionShot(shotNumber: number) {");
  const end = source.indexOf("  function storeRangeExport(", start);
  assert.ok(start >= 0 && end > start, "execute the real Timeline motion action");
  const program = stripTypeScriptTypes(source.slice(start, end));
  const placement = { id: "existing-placement", anchorRef: "storyboard-anchor:block:block-01:mini-1" };
  const pending = { id: "record", jobId: "provider-job-123", status: "queued", sourceKey: "source-current", takeId: undefined };
  const guard = { current: false };
  const stages = [];
  let observed = 0, resolveObserved;
  const vmContext = vm.createContext({
    selectedPlacement: placement,
    generatingShotNumber: null,
    motionAttemptInFlight: guard,
    buildTimelineGenerationPacketForShot: () => ({ references: [], sourceFingerprint: "same-current-shot" }),
    project: { id: "afterglow", revision: 1 },
    timelineMotionSourceKey: () => "source-current",
    motionFor: () => ({ current: pending }),
    setGeneratingShotNumber: value => stages.push(["shot", value]),
    setGeneratingMotionStage: value => stages.push(["stage", value]),
    setMessage: () => {},
    observeSubmittedMotion: async (_placement, _shot, _packet, record) => {
      observed++;
      assert.equal(record.jobId, "provider-job-123");
      await new Promise(resolve => { resolveObserved = resolve; });
    },
    resolveTimelineMotionRoute: () => { throw new Error("resume must not preflight a new route"); },
    requestPlotPickleConfirmation: () => { throw new Error("resume must not ask for new billing consent"); },
    fetch: () => { throw new Error("resume must not submit to the video API"); },
  });
  vm.runInContext(program, vmContext);
  const first = vmContext.generateMotionShot(1);
  assert.equal(guard.current, true, "lock synchronously before any await");
  await vmContext.generateMotionShot(1);
  assert.equal(observed, 1, "a rapid second click does not poll or bill twice");
  resolveObserved();
  await first;
  assert.equal(guard.current, false);
  assert.deepEqual(stages.at(-1), ["stage", null]);
  assert.match(source, /Resume existing motion job/u);
  assert.match(source, /pending\?\.jobId && \(pending\.status === "queued" \|\| pending\.status === "running"\)/u);
});

test("#2830 acknowledges one atomic encrypted save of a ready Motion and Production Take", async () => {
  const source = await readText("app/_components/timeline/timeline-assembly-workspace.tsx");
  const start = source.indexOf("  async function storeMotion(motion: TimelineMotionShot, take?: ProductionTake) {");
  const end = source.indexOf("  async function observeSubmittedMotion(", start);
  assert.ok(start >= 0 && end > start, "test the real Timeline motion commit handler");
  const execute = stripTypeScriptTypes(source.slice(start, end));
  const base = { id: "afterglow", revision: 18, production: { timelineMotionShots: [], takes: [] } };
  const current = { current: base };
  const recorded = [];
  let publications = 0, durableCalls = 0;
  let failWrite = false;
  const context = vm.createContext({
    latestProject: current,
    TimelineMotionSaveError: class TimelineMotionSaveError extends Error {},
    applyStoryCommand: (project, command) => {
      recorded.push(command.type);
      return {
        ...project, revision: project.revision + 1,
        production: { ...project.production,
          ...(command.type === "production.take.store" ? { takes: [command.take, ...project.production.takes] } : {}),
          ...(command.type === "production.timeline.motion.store" ? { timelineMotionShots: [command.motion, ...project.production.timelineMotionShots] } : {}),
        },
      };
    },
    saveFoundationProjectDurably: async (project, revision) => {
      durableCalls++;
      assert.equal(revision, current.current.revision);
      if (failWrite) throw new Error("vault acknowledgement unavailable");
      return structuredClone(project);
    },
    onProjectChange: () => { publications++; },
  });
  vm.runInContext(execute, context);
  const motion = {
    id: "shot-motion", status: "succeeded", jobId: "provider-job-123",
    sourceKey: "verified-locked-shot", outputAssetUrl: "/api/local-ai/assets/shot-01.mp4",
    updatedAt: "2026-10-10T23:00:00.000Z",
  };
  const take = {
    id: "shot-take", mediaRef: motion.outputAssetUrl,
    createdAt: motion.updatedAt,
  };
  await context.storeMotion(motion, take);
  assert.deepEqual(recorded, ["production.take.store", "production.timeline.motion.store"]);
  assert.equal(durableCalls, 1, "the result and its Production Take share one encrypted commit");
  assert.equal(publications, 1, "UI updates only after durable acknowledgement");
  assert.equal(current.current.production.takes[0].mediaRef, motion.outputAssetUrl);
  assert.equal(current.current.production.timelineMotionShots[0].jobId, motion.jobId);

  failWrite = true;
  const next = { ...motion, status: "failed", outputAssetUrl: "", updatedAt: "2026-10-10T23:01:00.000Z" };
  await assert.rejects(() => context.storeMotion(next), /vault acknowledgement unavailable/u);
  assert.equal(publications, 1, "failed save must not publish an unconfirmed change");
  assert.equal(current.current.production.timelineMotionShots[0].status, "succeeded",
    "failed write must not rewrite the last acknowledged result");
  assert.match(source, /await storeMotion\(running\)/u);
  assert.match(source, /await observeSubmittedMotion\(/u);
  assert.match(source, /await onProgress\(current\)/u);
});

test("#2830 transient provider status failures keep an already paid job resumable, terminal failure does not", async () => {
  const source = await readText("app/_components/timeline/timeline-assembly-workspace.tsx");
  const observerStart = source.indexOf("  async function observeSubmittedMotion(");
  const observerEnd = source.indexOf("  async function generateMotionShot(", observerStart);
  assert.ok(observerStart >= 0 && observerEnd > observerStart);
  const code = stripTypeScriptTypes(source.slice(observerStart, observerEnd));
  const messages = [], writes = [], urls = [];
  let terminal = false;
  const ctx = vm.createContext({
    TimelineMotionSaveError: class TimelineMotionSaveError extends Error {},
    TimelineMotionObservationError: class TimelineMotionObservationError extends Error {},
    window: { setTimeout: callback => callback() },
    fetch: async url => {
      urls.push(url);
      if (terminal) return { ok: true, json: async () => ({
        id: "already-submitted-job", status: "failed", error: "provider rejected the exact Shot",
      }) };
      return { ok: false, json: async () => ({ message: "temporary status endpoint outage" }) };
    },
    setMessage: value => messages.push(value),
    setGeneratingMotionStage: () => {},
    setPlaybackMode: () => { throw new Error("no video has been confirmed"); },
    storeMotion: async motion => { writes.push(motion); },
    latestProject: { current: { production: { timelineMotionShots: [] } } },
    timelineProductionShotsFor: () => [],
  });
  vm.runInContext(code, ctx);
  const placement = { id: "p1" };
  const packet = { canonicalRevision: 1, id: "packet", sourceRefs: [] };
  const submitted = {
    id: "timeline-existing-motion", jobId: "already-submitted-job", status: "queued",
    provider: "verified", sourceKey: "locked-shot-source", outputAssetUrl: "",
  };
  await ctx.observeSubmittedMotion(placement, 1, packet, submitted, undefined);
  assert.equal(writes.length, 0, "network/status outage does not mark paid job terminally failed");
  assert.equal(urls.length, 1);
  assert.match(urls[0], /^\\/api\\/local-ai\\/video\\//u);
  assert.match(messages.at(-1), /Resume existing motion job/u);
  assert.match(messages.at(-1), /temporary status endpoint outage/u);

  terminal = true;
  await ctx.observeSubmittedMotion(placement, 1, packet, submitted, undefined);
  assert.equal(writes.length, 1, "confirmed provider failure is recorded");
  assert.equal(writes[0].status, "failed");
  assert.equal(writes[0].jobId, "already-submitted-job");
  assert.match(writes[0].error, /provider rejected the exact Shot/u);
  assert.ok(urls.every(url => url.startsWith("/api/local-ai/video/")),
    "status retry must never invoke /api/local-ai/generate/video");
});
