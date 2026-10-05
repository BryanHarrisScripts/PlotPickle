"use client";

/* eslint-disable @next/next/no-img-element -- Timeline previews canonical local Storyboard/Previs assets. */

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  TimelineAssemblyRevision,
  TimelineMotionShot,
  TimelinePrevisPlacement,
  TimelineShotImageRef,
} from "@/core/contracts/previs";
import { applyStoryCommand } from "@/core/project/apply-command";
import type { PPFProject } from "@/core/project/project";
import { saveFoundationProject } from "@/core/storage/foundation-project-browser";
import { requestPlotPickleConfirmation } from "../../common-overlay-layer";
import {
  storyboardAnchorEvidence,
  storyboardAnchorTargetRef,
  storyboardPositionProgression,
} from "../storyboard/storyboard-editorial-model";
import {
  buildPrevisGraphicNovelPanel,
  type PrevisGraphicNovelPanel,
} from "../previs/previs-graphic-novel-presentation";
import styles from "./timeline-assembly-workspace.module.css";

const SHOTS_PER_MINI_BLOCK = 25;
const PLANNING_SECONDS_PER_SHOT = 3;
const PLANNING_SECONDS_PER_MINI_BLOCK = SHOTS_PER_MINI_BLOCK * PLANNING_SECONDS_PER_SHOT;

type ReviewAddress = Readonly<{
  blockNumber: number;
  miniBlockNumber: number;
}>;

type VideoJob = Readonly<{
  id: string;
  status: "queued" | "running" | "succeeded" | "failed" | "expired";
  outputAssetUrl?: string;
  error?: string;
  provider?: string;
  route?: string;
  model?: string;
}>;

type TimelinePrevisSource = Readonly<{
  anchorRef: string;
  targetId: string;
  blockNumber: number;
  miniBlockNumber: number;
  act: number;
  sequence: number;
  sourceKey: string;
  sourceRevision: number;
  shotImages: readonly TimelineShotImageRef[];
  coverage: number;
}>;

function actForBlock(blockNumber: number) {
  return Math.ceil(blockNumber / 6);
}

function sequenceForBlock(blockNumber: number) {
  return Math.ceil((((blockNumber - 1) % 6) + 1) / 2);
}

function targetIdForBlock(blockNumber: number) {
  return `block:block-${String(blockNumber).padStart(2, "0")}`;
}

function clock(seconds: number) {
  const bounded = Math.max(0, seconds);
  const minutes = Math.floor(bounded / 60);
  const remainder = bounded - (minutes * 60);
  return `${String(minutes).padStart(2, "0")}:${remainder.toFixed(1).padStart(4, "0")}`;
}

function sourceKey(anchorRef: string, shotImages: readonly TimelineShotImageRef[]) {
  return `previs-flip-book:${anchorRef}:${shotImages.map((image) => `${image.shotNumber}:${image.artifactId}`).join("|")}`;
}

function graphicNovelTextSourceKey(panel: PrevisGraphicNovelPanel, passages: unknown, storyContext: unknown) {
  return JSON.stringify({
    passages,
    storyContext,
    assetUrl: panel.assetUrl,
    caption: panel.caption,
    narration: panel.narration,
    shotLabel: panel.shotLabel,
    shotContext: panel.shotContext,
    bubbles: panel.bubbles.map((bubble) => ({ speaker: bubble.speaker, text: bubble.text })),
  });
}

function timelinePresentationFor(project: PPFProject, placement: TimelinePrevisPlacement, shotNumber: number) {
  const imageRef = placement.shotImages.find((image) => image.shotNumber === shotNumber) ?? null;
  const artifact = imageRef
    ? project.build.foundations.visualArtifacts.find((candidate) => candidate.id === imageRef.artifactId) ?? null
    : null;
  const evidence = storyboardAnchorEvidence(project, targetIdForBlock(placement.blockNumber), placement.miniBlockNumber);
  const sceneNumbers = [...new Set(evidence.passages.map((passage) => passage.sceneNumber).filter(Boolean))];
  const progression = storyboardPositionProgression(shotNumber);
  const storyContext = {
    title: project.title,
    act: actForBlock(placement.blockNumber),
    block: placement.blockNumber,
    miniBlock: placement.miniBlockNumber,
    blockTitle: evidence.blockTitle ?? "",
    dramaticResponsibility: evidence.responsibility ?? "",
  };
  const panel = buildPrevisGraphicNovelPanel({
    position: shotNumber,
    assetUrl: artifact?.assetUrl ?? "",
    authoritative: Boolean(artifact),
    narrativeIntention: artifact?.narrativeIntention ?? "",
    sceneNumbers: sceneNumbers.map((number) => String(number)),
    beatLabel: progression.label,
    beatDirection: progression.direction,
    shotLabel: `Shot ${String(shotNumber).padStart(2, "0")} of 25`,
    shotContext: "~3-second planning target",
    passages: evidence.passages,
  });
  const approval = (project.production.graphicNovelTextApprovals ?? [])
    .find((candidate) => candidate.anchorRef === placement.anchorRef && candidate.position === shotNumber) ?? null;
  const currentApproval = approval && approval.sourceKey === graphicNovelTextSourceKey(panel, evidence.passages, storyContext)
    ? approval
    : null;
  return { artifact, panel, approval: currentApproval };
}

function timelineMp4FileName(projectTitle: string, placement: TimelinePrevisPlacement, withNarration: boolean) {
  const slug = projectTitle.toLowerCase().trim().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "") || "plotpickle";
  const suffix = withNarration ? "-narrated" : "";
  return `${slug}-timeline-block-${String(placement.blockNumber).padStart(2, "0")}-mini-${placement.miniBlockNumber}${suffix}.mp4`;
}

function motionSourceKey(placement: TimelinePrevisPlacement, shotNumber: number, artifactId: string) {
  return `${placement.sourceKey}:motion-shot-${String(shotNumber).padStart(2, "0")}:${artifactId}`;
}

function timelineMotionPrompt(project: PPFProject, placement: TimelinePrevisPlacement, shotNumber: number) {
  const presentation = timelinePresentationFor(project, placement, shotNumber);
  const evidence = storyboardAnchorEvidence(project, targetIdForBlock(placement.blockNumber), placement.miniBlockNumber);
  const progression = storyboardPositionProgression(shotNumber);
  const screenplay = evidence.passages.map((passage) => passage.text).filter(Boolean).join(" ").replace(/\s+/gu, " ").trim().slice(0, 1_800);
  return [
    `Create one restrained cinematic motion shot for ${project.title}.`,
    `Act ${actForBlock(placement.blockNumber)}, Block ${placement.blockNumber}, Mini-Block ${placement.miniBlockNumber}, Shot ${String(shotNumber).padStart(2, "0")} of 25.`,
    evidence.responsibility ? `Dramatic responsibility: ${evidence.responsibility}.` : "",
    screenplay ? `Mapped screenplay: ${screenplay}` : "",
    presentation.artifact?.narrativeIntention ? `Approved image intention: ${presentation.artifact.narrativeIntention}.` : "",
    presentation.artifact?.prompt ? `Approved visual direction: ${presentation.artifact.prompt.slice(0, 1_200)}` : "",
    `Shot progression: ${progression.label}. ${progression.direction}`,
    "Use the approved first frame as the strict visual and character reference. Preserve faces, identity, wardrobe, props, location, composition, geography, lighting and screen direction. Add only story-grounded subject motion, environmental motion and one restrained camera move. Do not add text, logos, new characters, dialogue audio, music or sound effects.",
    "The Timeline slot is exactly three seconds. If the selected provider must generate a longer clip, keep the useful action inside the first three seconds; Timeline playback will clamp the result to the three-second slot.",
  ].filter(Boolean).join("\n").slice(0, 7_000);
}

function derivePrevisSources(project: PPFProject): readonly TimelinePrevisSource[] {
  const accepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
  return Array.from({ length: 24 }, (_, blockIndex) => blockIndex + 1).flatMap((blockNumber) => (
    Array.from({ length: 4 }, (_, miniIndex) => miniIndex + 1).map((miniBlockNumber) => {
      const targetId = targetIdForBlock(blockNumber);
      const anchorRef = storyboardAnchorTargetRef(targetId, miniBlockNumber);
      const candidates = project.build.foundations.visualArtifacts
        .filter((artifact) => (
          artifact.workflow === "storyboard-frame-webp-v2"
          && artifact.reviewState === "accepted"
          && accepted.has(artifact.id)
          && (artifact.sourceDecisionKeys ?? []).includes(anchorRef)
          && typeof artifact.frameNumber === "number"
          && artifact.frameNumber >= 1
          && artifact.frameNumber <= SHOTS_PER_MINI_BLOCK
        ))
        .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
      const shotImages = Array.from({ length: SHOTS_PER_MINI_BLOCK }, (_, index) => index + 1).flatMap((shotNumber) => {
        const artifact = candidates.find((candidate) => candidate.frameNumber === shotNumber);
        return artifact ? [{ shotNumber, artifactId: artifact.id } satisfies TimelineShotImageRef] : [];
      });
      return {
        anchorRef,
        targetId,
        blockNumber,
        miniBlockNumber,
        act: actForBlock(blockNumber),
        sequence: sequenceForBlock(blockNumber),
        sourceKey: sourceKey(anchorRef, shotImages),
        sourceRevision: project.revision,
        shotImages,
        coverage: shotImages.length,
      } satisfies TimelinePrevisSource;
    })
  ));
}

function newestTimelineAssembly(project: PPFProject): TimelineAssemblyRevision | null {
  return [...(project.production.timelineAssemblies ?? [])]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
}

function placementAddress(placement: TimelinePrevisPlacement): ReviewAddress {
  return { blockNumber: placement.blockNumber, miniBlockNumber: placement.miniBlockNumber };
}

function locationForTime(placements: readonly TimelinePrevisPlacement[], playheadSeconds: number) {
  if (!placements.length) return null;
  let cursor = 0;
  for (let index = 0; index < placements.length; index += 1) {
    const placement = placements[index];
    const end = cursor + placement.durationSeconds;
    if (playheadSeconds < end || index === placements.length - 1) {
      return {
        index,
        placement,
        startSecond: cursor,
        localSecond: Math.max(0, Math.min(placement.durationSeconds, playheadSeconds - cursor)),
      };
    }
    cursor = end;
  }
  return null;
}

export default function TimelineAssemblyWorkspace({
  project,
  address,
  onProjectChange,
  onOpenStoryboard,
  onOpenPrevis,
}: {
  readonly project: PPFProject;
  readonly address: ReviewAddress;
  readonly onProjectChange: (project: PPFProject) => void;
  readonly onOpenStoryboard: (address: ReviewAddress) => void;
  readonly onOpenPrevis: (address: ReviewAddress) => void;
}) {
  const sources = useMemo(() => derivePrevisSources(project), [project]);
  const latestAssembly = useMemo(() => newestTimelineAssembly(project), [project]);
  const placements = latestAssembly?.placements ?? [];
  const selectedAct = actForBlock(address.blockNumber);
  const actSources = sources.filter((source) => source.act === selectedAct);
  const [selectedPlacementId, setSelectedPlacementId] = useState("");
  const [playheadSeconds, setPlayheadSeconds] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<"stills" | "motion">("stills");
  const [showNarration, setShowNarration] = useState(false);
  const [generatingShotNumber, setGeneratingShotNumber] = useState<number | null>(null);
  const motionVideoRef = useRef<HTMLVideoElement | null>(null);
  const latestProject = useRef(project);
  latestProject.current = project;
  const [exporting, setExporting] = useState(false);
  const [exportUrl, setExportUrl] = useState("");
  const [message, setMessage] = useState("");

  const totalSeconds = placements.reduce((sum, placement) => sum + placement.durationSeconds, 0);
  const activeLocation = locationForTime(placements, playheadSeconds);
  const selectedPlacement = placements.find((placement) => placement.id === selectedPlacementId)
    ?? activeLocation?.placement
    ?? placements[0]
    ?? null;
  const activePlacement = activeLocation?.placement ?? selectedPlacement;
  const activeAddress = activePlacement ? placementAddress(activePlacement) : address;
  const activeTargetId = targetIdForBlock(activeAddress.blockNumber);
  const activeEvidence = storyboardAnchorEvidence(project, activeTargetId, activeAddress.miniBlockNumber);
  const activeLocalSecond = activeLocation?.localSecond ?? 0;
  const activeShotSeconds = activePlacement ? activePlacement.durationSeconds / SHOTS_PER_MINI_BLOCK : PLANNING_SECONDS_PER_SHOT;
  const activeShotNumber = activePlacement
    ? Math.min(SHOTS_PER_MINI_BLOCK, Math.max(1, Math.floor(activeLocalSecond / Math.max(0.01, activeShotSeconds)) + 1))
    : 1;
  const activePresentation = activePlacement
    ? timelinePresentationFor(project, activePlacement, activeShotNumber)
    : null;
  const activeImage = activePresentation?.artifact ?? null;
  const motionShots = project.production.timelineMotionShots ?? [];
  const motionFor = (placement: TimelinePrevisPlacement, shotNumber: number) => {
    const artifactId = placement.shotImages.find((image) => image.shotNumber === shotNumber)?.artifactId ?? "";
    const sourceKey = artifactId ? motionSourceKey(placement, shotNumber, artifactId) : "";
    const latest = motionShots.find((motion) => motion.placementId === placement.id && motion.shotNumber === shotNumber) ?? null;
    return {
      latest,
      current: latest && latest.sourceKey === sourceKey ? latest : null,
      stale: Boolean(latest && latest.sourceKey !== sourceKey),
    };
  };
  const activeMotion = activePlacement ? motionFor(activePlacement, activeShotNumber) : { latest: null, current: null, stale: false };
  const selectedMotionStates = selectedPlacement
    ? Array.from({ length: SHOTS_PER_MINI_BLOCK }, (_, index) => motionFor(selectedPlacement, index + 1))
    : [];
  const selectedMotionSucceeded = selectedMotionStates.filter((state) => state.current?.status === "succeeded" && state.current.outputAssetUrl).length;

  useEffect(() => {
    if (!placements.length) {
      setSelectedPlacementId("");
      setPlayheadSeconds(0);
      setPlaying(false);
      return;
    }
    if (!placements.some((placement) => placement.id === selectedPlacementId)) {
      setSelectedPlacementId(placements[0].id);
    }
    setPlayheadSeconds((current) => Math.min(current, totalSeconds));
  }, [placements, selectedPlacementId, totalSeconds]);

  useEffect(() => {
    const video = motionVideoRef.current;
    if (!video || playbackMode !== "motion" || activeMotion.current?.status !== "succeeded") return;
    const target = Math.min(PLANNING_SECONDS_PER_SHOT - 0.05, Math.max(0, activeLocalSecond));
    if (Math.abs(video.currentTime - target) > 0.25) video.currentTime = target;
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [activeLocalSecond, activeMotion.current?.id, activeMotion.current?.status, playbackMode, playing]);

  useEffect(() => {
    if (!playing || totalSeconds <= 0) return;
    const interval = window.setInterval(() => {
      setPlayheadSeconds((current) => {
        const next = Math.min(totalSeconds, current + 0.1);
        if (next >= totalSeconds) window.setTimeout(() => setPlaying(false), 0);
        return next;
      });
    }, 100);
    return () => window.clearInterval(interval);
  }, [playing, totalSeconds]);

  function currentSourceFor(placement: TimelinePrevisPlacement) {
    return sources.find((source) => source.anchorRef === placement.anchorRef) ?? null;
  }

  function placementIsStale(placement: TimelinePrevisPlacement) {
    const current = currentSourceFor(placement);
    return !current || current.sourceKey !== placement.sourceKey;
  }

  function commitPlacements(nextPlacements: readonly TimelinePrevisPlacement[], notice: string) {
    const now = new Date().toISOString();
    const normalized = nextPlacements.map((placement, index) => ({ ...placement, order: index + 1 }));
    const assembly: TimelineAssemblyRevision = {
      id: globalThis.crypto?.randomUUID?.() ?? `timeline-${Date.now()}`,
      sourceRevision: project.revision,
      placements: normalized,
      ...(latestAssembly?.id ? { supersedesTimelineId: latestAssembly.id } : {}),
      createdAt: now,
    };
    const next = applyStoryCommand(project, {
      type: "production.timeline.store",
      assembly,
      occurredAt: now,
    });
    const saved = saveFoundationProject(next);
    onProjectChange(saved);
    setPlaying(false);
    setMessage(notice);
  }

  function placeSource(source: TimelinePrevisSource) {
    if (!source.coverage) {
      setMessage("This Mini-Block has no locked Storyboard Images in Previs yet.");
      return;
    }
    const now = new Date().toISOString();
    const placement: TimelinePrevisPlacement = {
      id: globalThis.crypto?.randomUUID?.() ?? `timeline-placement-${Date.now()}`,
      anchorRef: source.anchorRef,
      blockNumber: source.blockNumber,
      miniBlockNumber: source.miniBlockNumber,
      sourceRevision: source.sourceRevision,
      sourceKey: source.sourceKey,
      sourceKind: "previs-flip-book",
      shotImages: source.shotImages,
      durationSeconds: PLANNING_SECONDS_PER_MINI_BLOCK,
      order: placements.length + 1,
      createdAt: now,
    };
    commitPlacements([...placements, placement], `Placed Previs Mini-Block ${source.blockNumber}.${source.miniBlockNumber} on Timeline. Its locked source snapshot will not change silently.`);
    setSelectedPlacementId(placement.id);
  }

  function removePlacement(placement: TimelinePrevisPlacement) {
    commitPlacements(
      placements.filter((candidate) => candidate.id !== placement.id),
      `Removed Timeline placement ${placement.blockNumber}.${placement.miniBlockNumber}. Earlier Timeline revisions remain preserved.`,
    );
  }

  function movePlacement(placement: TimelinePrevisPlacement, delta: -1 | 1) {
    const index = placements.findIndex((candidate) => candidate.id === placement.id);
    const nextIndex = index + delta;
    if (index < 0 || nextIndex < 0 || nextIndex >= placements.length) return;
    const next = [...placements];
    [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
    commitPlacements(next, `Moved Mini-Block ${placement.blockNumber}.${placement.miniBlockNumber} ${delta < 0 ? "earlier" : "later"} on Timeline.`);
  }

  function updatePlacementSource(placement: TimelinePrevisPlacement) {
    const current = currentSourceFor(placement);
    if (!current?.coverage) {
      setMessage("No current locked Previs source is available for this Mini-Block.");
      return;
    }
    const next = placements.map((candidate) => candidate.id === placement.id
      ? {
          ...candidate,
          sourceRevision: current.sourceRevision,
          sourceKey: current.sourceKey,
          shotImages: current.shotImages,
          createdAt: new Date().toISOString(),
        }
      : candidate);
    commitPlacements(next, `Updated Mini-Block ${placement.blockNumber}.${placement.miniBlockNumber} to the current approved Previs source in a new Timeline revision.`);
  }

  function seekToPlacement(placement: TimelinePrevisPlacement) {
    const index = placements.findIndex((candidate) => candidate.id === placement.id);
    if (index < 0) return;
    const start = placements.slice(0, index).reduce((sum, candidate) => sum + candidate.durationSeconds, 0);
    setSelectedPlacementId(placement.id);
    setPlayheadSeconds(start);
    setPlaying(false);
  }

  function previousPlacement() {
    const index = activeLocation?.index ?? placements.findIndex((placement) => placement.id === selectedPlacement?.id);
    if (index <= 0) return;
    seekToPlacement(placements[index - 1]);
  }

  function nextPlacement() {
    const index = activeLocation?.index ?? placements.findIndex((placement) => placement.id === selectedPlacement?.id);
    if (index < 0 || index >= placements.length - 1) return;
    seekToPlacement(placements[index + 1]);
  }

  function storeMotion(motion: TimelineMotionShot) {
    const next = applyStoryCommand(latestProject.current, {
      type: "production.timeline.motion.store",
      motion,
      occurredAt: motion.updatedAt,
    });
    const saved = saveFoundationProject(next);
    latestProject.current = saved;
    onProjectChange(saved);
  }

  async function imageToVideoRoute() {
    const routingResponse = await fetch("/api/ai-routing/status", { credentials: "same-origin", cache: "no-store" });
    const routing = await routingResponse.json() as { video?: { selected?: string }; message?: string };
    if (!routingResponse.ok) throw new Error(routing.message || "Video route status is unavailable.");
    const selected = routing.video?.selected ?? "off";
    if (selected === "minimax" || selected === "openai") return selected;
    if (selected === "comfyui-native") {
      const h3Response = await fetch("/api/media-routing/comfyui/h3/native/status", { credentials: "same-origin", cache: "no-store" });
      const h3 = await h3Response.json() as { ready?: boolean; workflowFamily?: string; error?: string; message?: string };
      if (h3Response.ok && h3.ready && h3.workflowFamily === "image-to-video") return "comfyui-native";
      throw new Error(h3.error || h3.message || `The selected local H3 workflow is ${h3.workflowFamily || "not ready"}; Timeline motion requires a reviewed image-to-video workflow.`);
    }

    const localResponse = await fetch("/api/local-ai/plugins/video", { credentials: "same-origin", cache: "no-store" });
    const local = await localResponse.json() as {
      recommendation?: {
        ready?: boolean;
        active?: boolean;
        selected?: { label?: string; modes?: string[] } | null;
      };
      message?: string;
    };
    const recommendation = local.recommendation;
    if (localResponse.ok && recommendation?.ready && recommendation.active && recommendation.selected?.modes?.includes("image-to-video")) {
      return recommendation.selected.label || "local image-to-video";
    }
    const selectedLocal = recommendation?.selected;
    const mode = selectedLocal?.modes?.join(", ") || "none";
    throw new Error(`No ready image-to-video route is selected. The current local video plug-in supports ${mode}; choose a reviewed image-to-video route in Settings.`);
  }

  async function pollMotionJob(initial: VideoJob) {
    let current = initial;
    for (let attempt = 0; attempt < 150 && (current.status === "queued" || current.status === "running"); attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
      const response = await fetch(`/api/local-ai/video/${encodeURIComponent(current.id)}`, { credentials: "same-origin", cache: "no-store" });
      const result = await response.json() as VideoJob & { message?: string };
      if (!response.ok) throw new Error(result.message || "The active video route could not report motion progress.");
      current = result;
    }
    if (current.status === "succeeded" && current.outputAssetUrl) return current;
    if (current.status === "queued" || current.status === "running") {
      throw new Error("The motion job is still running after the Timeline review window. Retry status later without replacing the locked still.");
    }
    throw new Error(current.error || `The motion job ended with status ${current.status}.`);
  }

  async function generateMotionShot(shotNumber: number) {
    if (!selectedPlacement || generatingShotNumber !== null) return;
    const presentation = timelinePresentationFor(project, selectedPlacement, shotNumber);
    if (!presentation.artifact?.assetUrl) {
      setMessage(`Shot ${String(shotNumber).padStart(2, "0")} has no locked Storyboard Image to animate.`);
      return;
    }
    let routeLabel = "";
    try {
      routeLabel = await imageToVideoRoute();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "No ready image-to-video route is available.");
      return;
    }
    const confirmed = await requestPlotPickleConfirmation({
      title: `Generate motion for Shot ${String(shotNumber).padStart(2, "0")}?`,
      description: `PlotPickle will send the approved first frame and story-grounded motion instructions to ${routeLabel}. A cloud route may charge your account and upload this approved image. No request is made unless you confirm.`,
      confirmLabel: "Generate motion",
      cancelLabel: "Keep still image",
    });
    if (!confirmed) {
      setMessage("Motion generation was cancelled. The locked still remains unchanged.");
      return;
    }

    const now = new Date().toISOString();
    const id = `timeline-motion:${selectedPlacement.id}:shot-${String(shotNumber).padStart(2, "0")}`;
    const sourceKey = motionSourceKey(selectedPlacement, shotNumber, presentation.artifact.id);
    const prompt = timelineMotionPrompt(project, selectedPlacement, shotNumber);
    setGeneratingShotNumber(shotNumber);
    setMessage(`Submitting motion for Shot ${String(shotNumber).padStart(2, "0")}…`);
    let running: TimelineMotionShot | null = null;
    try {
      const response = await fetch("/api/local-ai/generate/video", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          sourceAssetUrl: presentation.artifact.assetUrl,
          assetId: `timeline-${selectedPlacement.blockNumber}-${selectedPlacement.miniBlockNumber}-shot-${shotNumber}`,
          durationSeconds: 4,
          aspectRatio: "16:9",
          continuityMetadata: {
            placementId: selectedPlacement.id,
            anchorRef: selectedPlacement.anchorRef,
            sourceArtifactId: presentation.artifact.id,
            sourceKey,
            requestedTimelineSeconds: PLANNING_SECONDS_PER_SHOT,
          },
          billingAcknowledged: true,
          dataSharingAcknowledged: true,
        }),
      });
      const job = await response.json() as VideoJob & { message?: string };
      if (!response.ok || !job.id) throw new Error(job.message || "The active video route did not accept this motion shot.");
      running = {
        id,
        placementId: selectedPlacement.id,
        anchorRef: selectedPlacement.anchorRef,
        shotNumber,
        sourceArtifactId: presentation.artifact.id,
        sourceKey,
        prompt,
        requestedDurationSeconds: 3,
        provider: job.provider ?? "",
        route: job.route ?? "",
        model: job.model ?? "",
        jobId: job.id,
        status: job.status === "queued" ? "queued" : "running",
        outputAssetUrl: "",
        error: "",
        createdAt: now,
        updatedAt: now,
      };
      storeMotion(running);
      const result = await pollMotionJob(job);
      const completedAt = new Date().toISOString();
      storeMotion({
        ...running,
        provider: result.provider ?? running.provider,
        route: result.route ?? running.route,
        model: result.model ?? running.model,
        jobId: result.id,
        status: "succeeded",
        outputAssetUrl: result.outputAssetUrl ?? "",
        error: "",
        updatedAt: completedAt,
      });
      setPlaybackMode("motion");
      setMessage(`Shot ${String(shotNumber).padStart(2, "0")} motion is ready. Timeline uses only its first three seconds; the locked still remains available separately.`);
    } catch (error) {
      const failedAt = new Date().toISOString();
      const previous = running ?? motionFor(selectedPlacement, shotNumber).current;
      const failed: TimelineMotionShot = previous ?? {
        id,
        placementId: selectedPlacement.id,
        anchorRef: selectedPlacement.anchorRef,
        shotNumber,
        sourceArtifactId: presentation.artifact.id,
        sourceKey,
        prompt,
        requestedDurationSeconds: 3,
        provider: "",
        route: "",
        model: "",
        jobId: "",
        status: "failed",
        outputAssetUrl: "",
        error: "",
        createdAt: now,
        updatedAt: failedAt,
      };
      storeMotion({ ...failed, status: "failed", outputAssetUrl: "", error: error instanceof Error ? error.message : "Motion generation failed.", updatedAt: failedAt });
      setMessage(error instanceof Error ? error.message : "Motion generation failed. The locked still remains available.");
    } finally {
      setGeneratingShotNumber(null);
    }
  }

  async function exportSelectedMp4() {
    if (!selectedPlacement || exporting) return;
    if (selectedPlacement.shotImages.length !== SHOTS_PER_MINI_BLOCK) {
      setMessage("Timeline MP4 export requires all 25 locked Storyboard Images for the selected Mini-Block.");
      return;
    }

    const missingNarration: number[] = [];
    const frames = Array.from({ length: SHOTS_PER_MINI_BLOCK }, (_, index) => {
      const position = index + 1;
      const presentation = timelinePresentationFor(project, selectedPlacement, position);
      if (!presentation.artifact?.assetUrl) return null;
      if (showNarration && !presentation.approval) missingNarration.push(position);
      const caption = showNarration && presentation.approval
        ? presentation.approval.bubbles.map((bubble) => `${bubble.speaker}: ${bubble.text}`).join(" · ")
        : "";
      const narration = showNarration && presentation.approval ? presentation.approval.narration : "";
      return {
        position,
        assetId: presentation.artifact.id,
        assetUrl: presentation.artifact.assetUrl,
        authoritative: true as const,
        durationMs: PLANNING_SECONDS_PER_SHOT * 1000,
        sourceRefs: [selectedPlacement.id, selectedPlacement.anchorRef, presentation.artifact.id],
        ...(caption ? { caption } : {}),
        ...(narration ? { narration } : {}),
      };
    }).filter((frame): frame is NonNullable<typeof frame> => Boolean(frame));

    if (frames.length !== SHOTS_PER_MINI_BLOCK) {
      setMessage("Timeline MP4 export stopped because one or more saved Storyboard Images are missing.");
      return;
    }
    if (showNarration && missingNarration.length) {
      setMessage(`Written narration is stale or missing for Shot ${missingNarration.map((position) => String(position).padStart(2, "0")).join(", ")}. Open this Mini-Block in Previs and Play with Narration again before exporting the narrated MP4.`);
      return;
    }

    setExporting(true);
    setExportUrl("");
    setMessage(`Exporting silent MP4 for Mini-Block ${selectedPlacement.blockNumber}.${selectedPlacement.miniBlockNumber}…`);
    try {
      const response = await fetch("/api/previs/media-engine/render", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          blockNumber: selectedPlacement.blockNumber,
          miniBlockNumber: selectedPlacement.miniBlockNumber,
          frames,
        }),
      });
      const result = await response.json() as {
        ok?: boolean;
        mode?: string;
        message?: string;
        evidence?: { state?: string; artifacts?: { videoPath?: string } } | null;
      };
      const videoPath = result.evidence?.artifacts?.videoPath ?? "";
      if (!response.ok || !result.ok || result.mode !== "fframes" || result.evidence?.state !== "succeeded" || !videoPath) {
        throw new Error(result.message || "Timeline MP4 export did not produce a verified video.");
      }
      setExportUrl(videoPath);
      setMessage(`MP4 ready: 25 locked images × 3 seconds = 75 seconds, silent, 24 fps${showNarration ? " with the saved written narration overlays" : ""}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Timeline MP4 export failed.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <section className={styles.workspace} data-timeline-assembly="previs-media">
      <header className={styles.header}>
        <div>
          <p className={styles.kicker}>Timeline · approved Previs media against screenplay</p>
          <h2>Story alignment and assembly</h2>
          <p>Place Mini-Block Previs sources in sequence, play and scrub them continuously, and compare the visual story with its mapped screenplay evidence. Timeline does not generate Shots or Storyboard Images.</p>
        </div>
        <div className={styles.revision}>
          <strong>{placements.length} placed Mini-Block{placements.length === 1 ? "" : "s"}</strong>
          <span>{latestAssembly ? `Timeline revision ${latestAssembly.id}` : "No Timeline revision yet"}</span>
        </div>
      </header>

      <div className={styles.mathStrip} role="status">
        <strong>Act {selectedAct} · 6 Blocks · 24 Mini-Blocks</strong>
        <span>1 Mini-Block = 25 planned Shots · ~3 sec per Shot · ~75 sec planning target · ~1,800 final video frames at 24 fps</span>
      </div>

      <div className={styles.mediaBin} aria-label="Approved Previs media source list">
        <header>
          <div>
            <p className={styles.kicker}>Previs media</p>
            <h3>Available in Act {selectedAct}</h3>
          </div>
          <span>Locked Storyboard Images feed the approved Previs Flip Book source directly; no manual re-import.</span>
        </header>
        <div className={styles.mediaGrid}>
          {actSources.map((source) => (
            <article key={source.anchorRef} data-available={source.coverage ? "true" : "false"}>
              <strong>Act {source.act} · Sequence {source.sequence} · Block {String(source.blockNumber).padStart(2, "0")} · Mini-Block {source.blockNumber}.{source.miniBlockNumber}</strong>
              <span>Previs Flip Book · ~75 sec · {source.coverage}/25 locked Storyboard Images</span>
              <small>Source version · project revision {source.sourceRevision}</small>
              <button disabled={!source.coverage} onClick={() => placeSource(source)} type="button">
                {source.coverage ? "Place on Timeline" : "No approved Previs images yet"}
              </button>
            </article>
          ))}
        </div>
      </div>

      <div className={styles.topGrid}>
        <section className={styles.viewer} aria-label="Timeline playback viewer">
          <header>
            <p className={styles.kicker}>Playback</p>
            <strong>{activePlacement
              ? `Act ${actForBlock(activePlacement.blockNumber)} · Sequence ${sequenceForBlock(activePlacement.blockNumber)} · Block ${String(activePlacement.blockNumber).padStart(2, "0")} · Mini-Block ${activePlacement.blockNumber}.${activePlacement.miniBlockNumber}`
              : "No placed Previs media"}</strong>
          </header>
          <div className={styles.stage}>
            {playbackMode === "motion" && activeMotion.current?.status === "succeeded" && activeMotion.current.outputAssetUrl
              ? <video key={activeMotion.current.outputAssetUrl} muted playsInline preload="metadata" ref={motionVideoRef} src={activeMotion.current.outputAssetUrl} />
              : playbackMode === "motion"
                ? <div className={styles.missing}><strong>Motion Shot {String(activeShotNumber).padStart(2, "0")} not ready</strong><span>{activeMotion.stale ? "The saved motion belongs to an older locked image. Regenerate this Shot." : "Generate this Shot before Motion playback. Timeline does not silently substitute the still image."}</span></div>
                : activeImage?.assetUrl
                  ? <img alt={activeImage.narrativeIntention || `Storyboard Image for Shot ${activeShotNumber}`} src={activeImage.assetUrl} />
                  : <div className={styles.missing}><strong>Shot {String(activeShotNumber).padStart(2, "0")} of 25</strong><span>No locked Storyboard Image exists in this saved Timeline source snapshot.</span></div>}
            {showNarration && activePresentation?.approval && (activePresentation.approval.narration || activePresentation.approval.bubbles.length) ? (
              <div className={styles.narrationOverlay} aria-label="Written narration overlay">
                {activePresentation.approval.bubbles.map((bubble) => (
                  <p className={styles.speechLine} key={`${bubble.speaker}:${bubble.text}`}><strong>{bubble.speaker}</strong> {bubble.text}</p>
                ))}
                {activePresentation.approval.narration ? <p>{activePresentation.approval.narration}</p> : null}
              </div>
            ) : null}
            {showNarration && activePlacement && !activePresentation?.approval ? (
              <div className={styles.narrationUnavailable}>Written narration is not current for this Shot. Regenerate it in Previs before narrated export.</div>
            ) : null}
            {activePlacement ? <span className={styles.shotCounter}>Shot {String(activeShotNumber).padStart(2, "0")} of 25</span> : null}
          </div>
          <div className={styles.transport}>
            <button disabled={!placements.length || (activeLocation?.index ?? 0) <= 0} onClick={previousPlacement} type="button">Previous clip</button>
            <button disabled={!totalSeconds} onClick={() => setPlaying((value) => !value)} type="button">{playing ? "Pause" : "Play"}</button>
            <button disabled={!placements.length || (activeLocation?.index ?? 0) >= placements.length - 1} onClick={nextPlacement} type="button">Next clip</button>
            <button disabled={!activePlacement} onClick={() => setPlaybackMode((value) => value === "stills" ? "motion" : "stills")} type="button">Playback: {playbackMode === "stills" ? "Still images" : "Generated motion"}</button>
            <button disabled={!activePlacement} onClick={() => setShowNarration((value) => !value)} type="button">Written narration: {showNarration ? "On" : "Off"}</button>
            <strong>{clock(playheadSeconds)} / {clock(totalSeconds)}</strong>
            <input
              aria-label="Timeline seek and scrub"
              disabled={!totalSeconds}
              max={Math.max(0.1, totalSeconds)}
              min="0"
              onChange={(event) => {
                setPlaying(false);
                setPlayheadSeconds(Number(event.currentTarget.value));
              }}
              step="0.1"
              type="range"
              value={Math.min(playheadSeconds, Math.max(0.1, totalSeconds))}
            />
          </div>
        </section>

        <section className={styles.screenplay} aria-label="Synchronized screenplay source">
          <header>
            <p className={styles.kicker}>Screenplay source</p>
            <strong>Current Mini-Block evidence</strong>
          </header>
          <div className={styles.screenplayScroll}>
            {activeEvidence.passages.length ? activeEvidence.passages.map((passage) => (
              <article key={passage.id}>
                <small>{passage.type} · Scene {passage.sceneNumber || "—"}</small>
                <p>{passage.text}</p>
              </article>
            )) : <p>No screenplay passage is mapped to this Mini-Block. Timeline does not manufacture source text or timestamps.</p>}
          </div>
        </section>

        <aside className={styles.inspector} aria-label="Selected Timeline media inspector">
          <p className={styles.kicker}>Inspector</p>
          {selectedPlacement ? (
            <>
              <h3>Mini-Block {selectedPlacement.blockNumber}.{selectedPlacement.miniBlockNumber}</h3>
              <dl>
                <div><dt>Address</dt><dd>Act {actForBlock(selectedPlacement.blockNumber)} · Sequence {sequenceForBlock(selectedPlacement.blockNumber)} · Block {String(selectedPlacement.blockNumber).padStart(2, "0")}</dd></div>
                <div><dt>Source</dt><dd>Previs Flip Book</dd></div>
                <div><dt>Source revision</dt><dd>{selectedPlacement.sourceRevision}</dd></div>
                <div><dt>Coverage</dt><dd>{selectedPlacement.shotImages.length}/25 locked Storyboard Images</dd></div>
                <div><dt>Motion</dt><dd>{selectedMotionSucceeded}/25 generated Shots ready</dd></div>
                <div><dt>Duration</dt><dd>~{selectedPlacement.durationSeconds}s planning target</dd></div>
                <div><dt>Status</dt><dd>{placementIsStale(selectedPlacement) ? "STALE · newer upstream source available" : "CURRENT"}</dd></div>
              </dl>
              <small className={styles.sourceKey}>Source identity · {selectedPlacement.sourceKey}</small>
              <div className={styles.inspectorActions}>
                <button onClick={() => onOpenPrevis(placementAddress(selectedPlacement))} type="button">Open owning Previs Mini-Block</button>
                <button onClick={() => onOpenStoryboard(placementAddress(selectedPlacement))} type="button">Open owning Storyboard Mini-Block</button>
                <button disabled={exporting || selectedPlacement.shotImages.length !== SHOTS_PER_MINI_BLOCK} onClick={exportSelectedMp4} type="button">
                  {exporting ? "Exporting MP4…" : `Export selected Mini-Block MP4 · narration ${showNarration ? "on" : "off"}`}
                </button>
                {exportUrl ? <a className={styles.exportLink} download={timelineMp4FileName(project.title, selectedPlacement, showNarration)} href={exportUrl}>Open exported MP4</a> : null}
                <small>Silent export · 25 × 3-second Shots · 75 seconds · 24 fps. Export failure never reports success.</small>
                {placementIsStale(selectedPlacement) ? <button onClick={() => updatePlacementSource(selectedPlacement)} type="button">Update to current Previs source</button> : null}
                <button disabled={selectedPlacement.order <= 1} onClick={() => movePlacement(selectedPlacement, -1)} type="button">Move earlier</button>
                <button disabled={selectedPlacement.order >= placements.length} onClick={() => movePlacement(selectedPlacement, 1)} type="button">Move later</button>
                <button onClick={() => removePlacement(selectedPlacement)} type="button">Remove placement</button>
              </div>
            </>
          ) : <p>Select or place approved Previs media to inspect its provenance.</p>}
        </aside>
      </div>

      <section className={styles.motion} aria-label="Optional generated motion shots">
        <header>
          <div>
            <p className={styles.kicker}>Optional motion</p>
            <h3>Image-to-video Shot generation</h3>
          </div>
          <span>Each generated clip remains separate from its locked still. Timeline uses exactly the first 3 seconds of a successful result and never substitutes a still for failed motion.</span>
        </header>
        {selectedPlacement ? (
          <div className={styles.motionGrid}>
            {Array.from({ length: SHOTS_PER_MINI_BLOCK }, (_, index) => index + 1).map((shotNumber) => {
              const state = motionFor(selectedPlacement, shotNumber);
              const current = state.current;
              const working = generatingShotNumber === shotNumber;
              const label = working ? "GENERATING" : state.stale ? "STALE" : current?.status?.toUpperCase() ?? "NOT GENERATED";
              return (
                <article data-motion-status={state.stale ? "stale" : current?.status ?? "empty"} key={shotNumber}>
                  <strong>Shot {String(shotNumber).padStart(2, "0")}</strong>
                  <span>{label}</span>
                  {current?.provider || current?.model ? <small>{[current.provider, current.model].filter(Boolean).join(" · ")}</small> : <small>Approved first frame is the source reference.</small>}
                  {current?.error ? <small>{current.error}</small> : null}
                  <button disabled={generatingShotNumber !== null || !selectedPlacement.shotImages.some((image) => image.shotNumber === shotNumber)} onClick={() => void generateMotionShot(shotNumber)} type="button">
                    {working ? "Generating…" : current?.status === "failed" || state.stale ? "Retry motion" : current?.status === "succeeded" ? "Regenerate motion" : "Generate motion"}
                  </button>
                </article>
              );
            })}
          </div>
        ) : <p className={styles.motionEmpty}>Place a Previs Mini-Block on Timeline before generating optional motion.</p>}
      </section>

      <section className={styles.timeline} aria-label="Previs media timeline">
        <header>
          <div>
            <p className={styles.kicker}>Media timeline</p>
            <h3>Chronological Mini-Block assembly</h3>
          </div>
          <span>Each placement retains its saved Previs source identity. Upstream replacement is never applied silently.</span>
        </header>
        <div className={styles.timelineRail}>
          {placements.length ? placements.map((placement) => (
            <button
              aria-pressed={placement.id === selectedPlacement?.id}
              data-stale={placementIsStale(placement) ? "true" : "false"}
              key={placement.id}
              onClick={() => seekToPlacement(placement)}
              type="button"
            >
              <strong>{placement.order}. A{actForBlock(placement.blockNumber)} · S{sequenceForBlock(placement.blockNumber)} · B{String(placement.blockNumber).padStart(2, "0")} · M{placement.blockNumber}.{placement.miniBlockNumber}</strong>
              <span>~{placement.durationSeconds}s · {placement.shotImages.length}/25 Images</span>
              <small>{placementIsStale(placement) ? "STALE" : "CURRENT"}</small>
            </button>
          )) : <p>Place approved Previs media from the source list to begin the Timeline assembly.</p>}
        </div>
      </section>

      <p className={styles.status} role="status">{message}</p>
    </section>
  );
}
