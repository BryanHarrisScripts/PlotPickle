"use client";

/* eslint-disable @next/next/no-img-element -- Timeline previews canonical local Storyboard/Previs assets. */

import { useEffect, useMemo, useRef, useState } from "react";
import type {
  ProductionTake,
  TimelineAssemblyRevision,
  TimelineMotionShot,
  TimelinePrevisPlacement,
  TimelineRangeExport,
  TimelineShotImageRef,
} from "@/core/contracts/previs";
import { approvedWorldMapCharacterReferences } from "@/core/contracts/world-map";
import { applyStoryCommand } from "@/core/project/apply-command";
import type { PPFProject } from "@/core/project/project";
import { saveFoundationProject } from "@/core/storage/foundation-project-browser";
import type { LibraryPPFProject } from "@/core/storage/library-project";
import {
  resolveTimelineGenerationStrategy,
  serializeTimelineShotGenerationPacket,
  type TimelineGenerationStrategy,
  type TimelineShotGenerationPacket,
} from "@/lib/preproduction/provider-capability-contract";
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
import {
  buildTimelineGenerationPacketForShot,
  timelineMotionSourceKey,
} from "./timeline-motion-source";
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
  durationSeconds?: number;
}>;

type TimelineMotionRoute = Readonly<{
  route: "minimax" | "openai" | "comfyui-native";
  label: string;
  locality: "cloud" | "local";
  needsActivation: boolean;
  strategy: TimelineGenerationStrategy | null;
}>;

type MotionGenerationStage = "PREFLIGHT" | "SUBMITTING" | "QUEUED" | "RUNNING";

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

function storyPosition(placement: TimelinePrevisPlacement) {
  return ((placement.blockNumber - 1) * 4) + placement.miniBlockNumber;
}

function openingStoryRun(placements: readonly TimelinePrevisPlacement[]) {
  const ordered = [...placements]
    .sort((left, right) => storyPosition(left) - storyPosition(right) || left.order - right.order)
    .filter((placement, index, all) => all.findIndex((candidate) => storyPosition(candidate) === storyPosition(placement)) === index);
  const firstComplete = ordered.findIndex((placement) => placement.shotImages.length === SHOTS_PER_MINI_BLOCK);
  if (firstComplete < 0) return [] as TimelinePrevisPlacement[];
  const run: TimelinePrevisPlacement[] = [ordered[firstComplete]];
  let expected = storyPosition(ordered[firstComplete]) + 1;
  for (let index = firstComplete + 1; index < ordered.length && run.length < 4; index += 1) {
    const placement = ordered[index];
    const position = storyPosition(placement);
    if (position < expected) continue;
    if (position !== expected || placement.shotImages.length !== SHOTS_PER_MINI_BLOCK) break;
    run.push(placement);
    expected += 1;
  }
  return run;
}

function timelineRangeMp4FileName(projectTitle: string, placements: readonly TimelinePrevisPlacement[], withNarration: boolean) {
  const slug = projectTitle.toLowerCase().trim().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "") || "plotpickle";
  const first = placements[0];
  const last = placements.at(-1);
  const range = first && last
    ? `block-${String(first.blockNumber).padStart(2, "0")}-mini-${first.miniBlockNumber}-through-${String(last.blockNumber).padStart(2, "0")}-mini-${last.miniBlockNumber}`
    : "opening-range";
  return `${slug}-timeline-${range}${withNarration ? "-narrated" : ""}.mp4`;
}

async function resolveTimelineMotionRoute(packet?: TimelineShotGenerationPacket): Promise<TimelineMotionRoute> {
  const [routingResponse, mediaResponse] = await Promise.all([
    fetch("/api/ai-routing/status", { credentials: "same-origin", cache: "no-store" }),
    fetch("/api/media-routing/status", { credentials: "same-origin", cache: "no-store" }),
  ]);
  const routing = await routingResponse.json() as {
    video?: {
      selected?: string;
      options?: Record<string, {
        ready?: boolean;
        configured?: boolean;
        model?: string;
        error?: string;
        locality?: string;
        workflowFamily?: string;
        vramProfile?: string;
        performanceAcknowledged?: boolean;
      }>;
    };
    message?: string;
  };
  if (!routingResponse.ok) throw new Error(routing.message || "Video route status is unavailable.");
  const media = await mediaResponse.json() as {
    profiles?: { minimax?: { configured?: boolean; videoModel?: string; videoVerifiedAt?: string; lastError?: string } };
    videoRoute?: string;
    message?: string;
  };
  if (!mediaResponse.ok) throw new Error(media.message || "Media route status is unavailable.");

  const selected = routing.video?.selected ?? "off";
  const selectedState = routing.video?.options?.[selected];
  if (selected === "comfyui-native" && selectedState?.ready) {
    const strategy = packet ? resolveTimelineGenerationStrategy({
      route: "comfyui-native",
      locality: "local",
      ready: true,
      workflowFamily: (selectedState.workflowFamily ?? "") as "text-to-video" | "image-to-video" | "first-last-frame" | "reference-to-video" | "in-place-edit" | "",
      vramProfile: selectedState.vramProfile,
      performanceAcknowledged: selectedState.performanceAcknowledged === true,
    }, packet) : null;
    if (strategy && !strategy.eligible) throw new Error(strategy.reason);
    const family = selectedState.workflowFamily || "video";
    return { route: "comfyui-native", label: `Local ComfyUI MiniMax H3 · ${family} · ready`, locality: "local", needsActivation: false, strategy };
  }
  if (selected === "minimax" && selectedState?.ready) {
    const strategy = packet ? resolveTimelineGenerationStrategy({ route: "minimax", locality: "cloud", ready: true }, packet) : null;
    return { route: "minimax", label: "MiniMax H3 Direct · selected and verified", locality: "cloud", needsActivation: false, strategy };
  }
  if (selected === "openai" && selectedState?.ready) {
    const strategy = packet ? resolveTimelineGenerationStrategy({ route: "openai", locality: "cloud", ready: true }, packet) : null;
    return { route: "openai", label: "OpenAI video · selected and verified", locality: "cloud", needsActivation: false, strategy };
  }

  const minimax = media.profiles?.minimax;
  if (minimax?.configured && minimax.videoVerifiedAt) {
    return {
      route: "minimax",
      label: `MiniMax H3 Direct · verified ${minimax.videoModel ? `· ${minimax.videoModel}` : ""}`.trim(),
      locality: "cloud",
      needsActivation: selected !== "minimax",
      strategy: packet ? resolveTimelineGenerationStrategy({ route: "minimax", locality: "cloud", ready: true }, packet) : null,
    };
  }

  if (selected !== "off" && selectedState?.error) throw new Error(selectedState.error);
  throw new Error("No verified video generation route is ready for this Shot. Test the selected video workflow or choose another reviewed route in Settings.");
}

async function activateTimelineMotionRoute(route: TimelineMotionRoute) {
  if (!route.needsActivation) return;
  const response = await fetch("/api/ai-routing/select", {
    method: "POST",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      capability: "video",
      route: route.route,
      paidAcknowledged: route.locality === "cloud",
      dataSharingAcknowledged: route.locality === "cloud",
    }),
  });
  const result = await response.json() as { ok?: boolean; message?: string };
  if (!response.ok || result.ok === false) {
    throw new Error(result.message || `PlotPickle could not activate ${route.label} for this confirmed motion request.`);
  }
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

type TimelineCharacterReference = Readonly<{
  id: string;
  name: string;
  imageUrls: readonly string[];
  facts: readonly string[];
}>;

function timelineCharacterReferences(project: LibraryPPFProject, placement: TimelinePrevisPlacement): readonly TimelineCharacterReference[] {
  const exactIds = placement.shotImages.flatMap((imageRef) => {
    const artifact = project.build.foundations.visualArtifacts.find((candidate) => candidate.id === imageRef.artifactId);
    return (artifact?.sourceDecisionKeys ?? [])
      .filter((key) => key.startsWith("storyboard-character:"))
      .map((key) => key.slice("storyboard-character:".length))
      .filter(Boolean);
  });
  const evidence = storyboardAnchorEvidence(project, targetIdForBlock(placement.blockNumber), placement.miniBlockNumber);
  const sceneNumbers = new Set(evidence.passages.map((passage) => passage.sceneNumber).filter(Boolean));
  const fallbackIds = (project.sourceEvidence.characterTruth?.arcCells ?? [])
    .filter((cell) => (
      cell.blockNumber === placement.blockNumber
      && cell.state !== "not-present-no-evidence"
      && (!sceneNumbers.size || cell.sceneNumbers.some((sceneNumber) => sceneNumbers.has(sceneNumber)))
    ))
    .map((cell) => cell.characterId);
  const ids = [...new Set(exactIds.length ? exactIds : fallbackIds)];
  const claims = project.sourceEvidence.characterTruth?.claims ?? [];
  return ids.map((characterId) => {
    const characterClaims = claims.filter((claim) => (
      claim.characterIds.includes(characterId)
      && claim.reviewState !== "rejected"
      && claim.handling === "writer-reference"
      && claim.kind !== "sensitive-source"
    ));
    const identity = characterClaims.find((claim) => claim.kind === "identity");
    const rawName = characterId.replace(/^character:/u, "").replace(/[-_]+/gu, " ").trim();
    const fallbackName = rawName ? rawName.replace(/\b\w/gu, (letter) => letter.toUpperCase()) : "Unknown Character";
    return {
      id: characterId,
      name: identity?.summary || fallbackName,
      imageUrls: approvedWorldMapCharacterReferences(project.worldMap, characterId),
      facts: characterClaims
        .filter((claim) => claim.kind !== "identity" && claim.kind !== "visual-reference")
        .map((claim) => claim.summary)
        .slice(0, 2),
    };
  });
}

function timelineProductionShotsFor(
  project: PPFProject,
  placement: TimelinePrevisPlacement,
  shotNumber: number,
) {
  const artifactId = placement.shotImages.find((image) => image.shotNumber === shotNumber)?.artifactId ?? "";
  if (!artifactId) return [];
  return project.production.shots
    .filter((shot) => shot.anchorRef === placement.anchorRef && shot.storyboardArtifactId === artifactId)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

function timelineSoundCuesFor(
  project: PPFProject,
  placement: TimelinePrevisPlacement,
  productionShotIds: readonly string[],
) {
  const exactIds = new Set(productionShotIds);
  return (project.production.soundCues ?? [])
    .filter((cue) => (
      cue.anchorRef === placement.anchorRef
      && (!cue.productionShotId || exactIds.has(cue.productionShotId))
      && cue.reviewState !== "rejected"
    ))
    .sort((left, right) => (left.startSecond ?? 0) - (right.startSecond ?? 0) || left.id.localeCompare(right.id));
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
  readonly project: LibraryPPFProject;
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
  const [generatingMotionStage, setGeneratingMotionStage] = useState<MotionGenerationStage | null>(null);
  const [motionRouteMessage, setMotionRouteMessage] = useState("Checking video generation provider…");
  const motionVideoRef = useRef<HTMLVideoElement | null>(null);
  const latestProject = useRef<PPFProject>(project);
  latestProject.current = project;
  const [openingSegmentCount, setOpeningSegmentCount] = useState(1);
  const [openingExporting, setOpeningExporting] = useState(false);
  const [openingExportUrl, setOpeningExportUrl] = useState("");
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
  const activeShotLocalSecond = activePlacement
    ? Math.max(0, activeLocalSecond - ((activeShotNumber - 1) * activeShotSeconds))
    : 0;
  const activePresentation = activePlacement
    ? timelinePresentationFor(project, activePlacement, activeShotNumber)
    : null;
  const activeImage = activePresentation?.artifact ?? null;
  const motionShots = project.production.timelineMotionShots ?? [];
  const motionFor = (placement: TimelinePrevisPlacement, shotNumber: number) => {
    const packet = buildTimelineGenerationPacketForShot(project, placement, shotNumber);
    const sourceKey = timelineMotionSourceKey(placement, packet);
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
  const selectedCharacters = selectedPlacement ? timelineCharacterReferences(project, selectedPlacement) : [];
  const activeCharacters = activePlacement ? timelineCharacterReferences(project, activePlacement) : [];
  const activeProductionShots = activePlacement ? timelineProductionShotsFor(project, activePlacement, activeShotNumber) : [];
  const activeSoundCues = activePlacement
    ? timelineSoundCuesFor(project, activePlacement, activeProductionShots.map((shot) => shot.id))
    : [];
  const openingRun = useMemo(() => openingStoryRun(placements), [placements]);
  const selectedOpeningPlacements = openingRun.slice(0, Math.max(1, Math.min(openingSegmentCount, openingRun.length)));
  const latestRangeExport = [...(project.production.timelineRangeExports ?? [])]
    .filter((item) => item.timelineAssemblyId === latestAssembly?.id)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;

  useEffect(() => {
    setOpeningSegmentCount((current) => Math.max(1, Math.min(current, Math.max(1, openingRun.length))));
  }, [openingRun.length]);

  useEffect(() => {
    let cancelled = false;
    setMotionRouteMessage("Checking video generation provider…");
    void resolveTimelineMotionRoute()
      .then((route) => {
        if (cancelled) return;
        setMotionRouteMessage(route.needsActivation
          ? `${route.label} · ready to activate only after Generate motion is confirmed`
          : route.label);
      })
      .catch((error) => {
        if (!cancelled) setMotionRouteMessage(error instanceof Error ? error.message : "No verified video generation provider is ready.");
      });
    return () => { cancelled = true; };
  }, [project.id]);

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
    const target = Math.min(PLANNING_SECONDS_PER_SHOT - 0.05, Math.max(0, activeShotLocalSecond));
    if (Math.abs(video.currentTime - target) > 0.25) video.currentTime = target;
    if (playing) void video.play().catch(() => undefined);
    else video.pause();
  }, [activeShotLocalSecond, activeMotion.current?.id, activeMotion.current?.status, playbackMode, playing]);

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

  function seekToShot(placementIndex: number, shotNumber: number) {
    const placement = placements[placementIndex];
    if (!placement || shotNumber < 1 || shotNumber > SHOTS_PER_MINI_BLOCK) return;
    const placementStart = placements.slice(0, placementIndex).reduce((sum, candidate) => sum + candidate.durationSeconds, 0);
    const shotSeconds = placement.durationSeconds / SHOTS_PER_MINI_BLOCK;
    setSelectedPlacementId(placement.id);
    setPlayheadSeconds(placementStart + ((shotNumber - 1) * shotSeconds));
    setPlaying(false);
  }

  function previousShot() {
    if (!activePlacement) return;
    const placementIndex = placements.findIndex((placement) => placement.id === activePlacement.id);
    if (placementIndex < 0) return;
    if (activeShotNumber > 1) {
      seekToShot(placementIndex, activeShotNumber - 1);
      return;
    }
    if (placementIndex > 0) seekToShot(placementIndex - 1, SHOTS_PER_MINI_BLOCK);
  }

  function nextShot() {
    if (!activePlacement) return;
    const placementIndex = placements.findIndex((placement) => placement.id === activePlacement.id);
    if (placementIndex < 0) return;
    if (activeShotNumber < SHOTS_PER_MINI_BLOCK) {
      seekToShot(placementIndex, activeShotNumber + 1);
      return;
    }
    if (placementIndex < placements.length - 1) seekToShot(placementIndex + 1, 1);
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

  function storeProductionTake(take: ProductionTake) {
    const next = applyStoryCommand(latestProject.current, {
      type: "production.take.store",
      take,
      occurredAt: take.createdAt,
    });
    const saved = saveFoundationProject(next);
    latestProject.current = saved;
    onProjectChange(saved);
  }

  async function pollMotionJob(initial: VideoJob, onProgress: (job: VideoJob) => void) {
    let current = initial;
    let lastStatus = current.status;
    for (let attempt = 0; attempt < 150 && (current.status === "queued" || current.status === "running"); attempt += 1) {
      await new Promise((resolve) => window.setTimeout(resolve, 2_000));
      const response = await fetch(`/api/local-ai/video/${encodeURIComponent(current.id)}`, { credentials: "same-origin", cache: "no-store" });
      const result = await response.json() as VideoJob & { message?: string };
      if (!response.ok) throw new Error(result.message || "The active video route could not report motion progress.");
      current = result;
      if (current.status !== lastStatus) {
        lastStatus = current.status;
        onProgress(current);
      }
    }
    if (current.status === "succeeded" && current.outputAssetUrl) return current;
    if (current.status === "queued" || current.status === "running") {
      throw new Error("The motion job is still running after the Timeline review window. Retry status later without replacing the locked still.");
    }
    throw new Error(current.error || `The motion job ended with status ${current.status}.`);
  }

  async function generateMotionShot(shotNumber: number) {
    if (!selectedPlacement || generatingShotNumber !== null) return;
    const packet = buildTimelineGenerationPacketForShot(project, selectedPlacement, shotNumber);
    const sourceImage = packet.references.find((reference) => reference.role === "source-image") ?? null;
    const now = new Date().toISOString();
    const id = `timeline-motion:${selectedPlacement.id}:shot-${String(shotNumber).padStart(2, "0")}`;
    const sourceKey = timelineMotionSourceKey(selectedPlacement, packet);

    setGeneratingShotNumber(shotNumber);
    setGeneratingMotionStage("PREFLIGHT");
    setMessage(`Checking generation readiness for Shot ${String(shotNumber).padStart(2, "0")}…`);
    let route: TimelineMotionRoute;
    try {
      route = await resolveTimelineMotionRoute(packet);
      if (!route.strategy?.eligible || !route.strategy.modality) {
        throw new Error(route.strategy?.reason || "The selected video route cannot render this Shot Generation Packet.");
      }
      setMotionRouteMessage(route.needsActivation
        ? `${route.label} · ${route.strategy.modality} · ready to activate only after Generate motion is confirmed`
        : `${route.label} · ${route.strategy.modality}`);
    } catch (error) {
      const detail = error instanceof Error ? error.message : "No compatible video generation route is available.";
      const failedAt = new Date().toISOString();
      const failed: TimelineMotionShot = {
        id,
        placementId: selectedPlacement.id,
        anchorRef: selectedPlacement.anchorRef,
        shotNumber,
        sourceArtifactId: sourceImage?.id ?? "",
        sourceKey,
        prompt: "",
        packetFingerprint: packet.sourceFingerprint,
        inputReferenceAssetIds: packet.references.map((reference) => reference.id),
        requestedDurationSeconds: 3,
        providerDurationSeconds: null,
        provider: "",
        route: "",
        model: "",
        jobId: "",
        status: "failed",
        outputAssetUrl: "",
        error: `PREFLIGHT FAILED · ${detail}`,
        createdAt: now,
        updatedAt: failedAt,
      };
      storeMotion(failed);
      setMessage(failed.error);
      setMotionRouteMessage(failed.error);
      setGeneratingShotNumber(null);
      setGeneratingMotionStage(null);
      return;
    }

    const strategy = route.strategy!;
    const usesVisualReference = Boolean(strategy.sourceAssetUrl || strategy.referenceAssetUrl || strategy.lastFrameAssetUrl);
    const confirmed = await requestPlotPickleConfirmation({
      title: `Generate motion for Shot ${String(shotNumber).padStart(2, "0")}?`,
      description: `PlotPickle will send this Shot Generation Packet to ${route.label} using ${strategy.modality}. ${usesVisualReference ? "Approved visual reference media will be included where the provider supports it. " : ""}A cloud route may charge your account and send the disclosed story/reference material off this computer. No route activation or generation request is made unless you confirm.`,
      confirmLabel: "Generate motion",
      cancelLabel: "Keep still image",
    });
    if (!confirmed) {
      setMessage("Motion generation was cancelled. Existing Timeline sources remain unchanged.");
      setGeneratingShotNumber(null);
      setGeneratingMotionStage(null);
      return;
    }

    const prompt = serializeTimelineShotGenerationPacket(packet, strategy);
    const priorTakeId = motionFor(selectedPlacement, shotNumber).current?.takeId;
    setGeneratingMotionStage("SUBMITTING");
    setMessage(`Submitting Shot ${String(shotNumber).padStart(2, "0")} via ${strategy.modality} to ${route.label}…`);
    let running: TimelineMotionShot | null = null;
    try {
      await activateTimelineMotionRoute(route);
      if (route.needsActivation) setMotionRouteMessage(`${route.label} · activated by this confirmed request`);
      const response = await fetch("/api/local-ai/generate/video", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          ...(strategy.sourceAssetUrl ? { sourceAssetUrl: strategy.sourceAssetUrl } : {}),
          ...(strategy.modality === "first-last-frame" ? {
            firstFrameAssetUrl: strategy.sourceAssetUrl,
            lastFrameAssetUrl: strategy.lastFrameAssetUrl,
          } : {}),
          ...(strategy.modality === "reference-to-video" && strategy.referenceAssetUrl
            ? { referenceAssetUrl: strategy.referenceAssetUrl }
            : {}),
          assetId: `timeline-${selectedPlacement.blockNumber}-${selectedPlacement.miniBlockNumber}-shot-${shotNumber}`,
          durationSeconds: 4,
          aspectRatio: "16:9",
          performanceAcknowledged: strategy.performanceAcknowledged,
          continuityMetadata: {
            packetId: packet.id,
            packetFingerprint: packet.sourceFingerprint,
            generationMode: strategy.modality,
            placementId: selectedPlacement.id,
            anchorRef: selectedPlacement.anchorRef,
            sourceArtifactId: sourceImage?.id ?? "",
            sourceRefs: packet.sourceRefs,
            requestedTimelineSeconds: PLANNING_SECONDS_PER_SHOT,
          },
          billingAcknowledged: true,
          dataSharingAcknowledged: true,
        }),
      });
      const job = await response.json() as VideoJob & { message?: string };
      if (!response.ok || !job.id) throw new Error(job.message || "The active video route did not accept this Shot Generation Packet.");
      running = {
        id,
        placementId: selectedPlacement.id,
        anchorRef: selectedPlacement.anchorRef,
        shotNumber,
        sourceArtifactId: sourceImage?.id ?? "",
        sourceKey,
        prompt,
        generationMode: strategy.modality,
        packetFingerprint: packet.sourceFingerprint,
        inputReferenceAssetIds: packet.references.map((reference) => reference.id),
        requestedDurationSeconds: 3,
        providerDurationSeconds: job.durationSeconds ?? null,
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
      setGeneratingMotionStage(job.status === "queued" ? "QUEUED" : "RUNNING");
      setMessage(`Shot ${String(shotNumber).padStart(2, "0")} ${job.status === "queued" ? "is queued" : "is running"} on ${route.label}.`);
      const result = await pollMotionJob(job, (progress) => {
        if (!running || (progress.status !== "queued" && progress.status !== "running")) return;
        const progressAt = new Date().toISOString();
        running = {
          ...running,
          provider: progress.provider ?? running.provider,
          route: progress.route ?? running.route,
          model: progress.model ?? running.model,
          jobId: progress.id,
          providerDurationSeconds: progress.durationSeconds ?? running.providerDurationSeconds,
          status: progress.status,
          updatedAt: progressAt,
        };
        storeMotion(running);
        setGeneratingMotionStage(progress.status === "queued" ? "QUEUED" : "RUNNING");
        setMessage(`Shot ${String(shotNumber).padStart(2, "0")} ${progress.status === "queued" ? "is queued" : "is running"} on ${route.label}.`);
      });
      const completedAt = new Date().toISOString();
      const productionShot = timelineProductionShotsFor(latestProject.current, selectedPlacement, shotNumber)[0] ?? null;
      const takeId = productionShot && result.outputAssetUrl
        ? `timeline-take:${selectedPlacement.id}:shot-${String(shotNumber).padStart(2, "0")}:${result.id}`
        : "";
      if (productionShot && result.outputAssetUrl) {
        storeProductionTake({
          id: takeId,
          productionShotId: productionShot.id,
          sourceRevision: packet.canonicalRevision,
          storyboardDependencyKey: productionShot.storyboardDependencyKey,
          mediaRef: result.outputAssetUrl,
          provider: result.provider ?? running.provider,
          model: result.model ?? running.model,
          intendedDurationSeconds: PLANNING_SECONDS_PER_SHOT,
          observedDurationSeconds: result.durationSeconds ?? null,
          provenanceRefs: [packet.id, ...packet.sourceRefs],
          reviewState: "candidate",
          ...(priorTakeId ? { replacesTakeId: priorTakeId } : {}),
          createdAt: completedAt,
        });
      }
      storeMotion({
        ...running,
        provider: result.provider ?? running.provider,
        route: result.route ?? running.route,
        model: result.model ?? running.model,
        jobId: result.id,
        providerDurationSeconds: result.durationSeconds ?? running.providerDurationSeconds,
        takeId,
        status: "succeeded",
        outputAssetUrl: result.outputAssetUrl ?? "",
        error: "",
        updatedAt: completedAt,
      });
      setPlaybackMode("motion");
      setMessage(`Shot ${String(shotNumber).padStart(2, "0")} motion is ready via ${strategy.modality}. Timeline retains its three-second placement authority and keeps the original source separately.`);
    } catch (error) {
      const failedAt = new Date().toISOString();
      const previous = running ?? motionFor(selectedPlacement, shotNumber).current;
      const failed: TimelineMotionShot = previous ?? {
        id,
        placementId: selectedPlacement.id,
        anchorRef: selectedPlacement.anchorRef,
        shotNumber,
        sourceArtifactId: sourceImage?.id ?? "",
        sourceKey,
        prompt,
        generationMode: strategy.modality,
        packetFingerprint: packet.sourceFingerprint,
        inputReferenceAssetIds: packet.references.map((reference) => reference.id),
        requestedDurationSeconds: 3,
        providerDurationSeconds: null,
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
      setMessage(error instanceof Error ? error.message : "Motion generation failed. Existing Timeline sources remain available.");
    } finally {
      setGeneratingShotNumber(null);
      setGeneratingMotionStage(null);
    }
  }

  function storeRangeExport(item: TimelineRangeExport) {
    const next = applyStoryCommand(latestProject.current, {
      type: "production.timeline.export.store",
      export: item,
      occurredAt: item.createdAt,
    });
    const saved = saveFoundationProject(next);
    latestProject.current = saved;
    onProjectChange(saved);
  }

  async function exportOpeningRangeMp4() {
    if (!latestAssembly || openingExporting || !selectedOpeningPlacements.length) return;
    if (selectedOpeningPlacements.some((placement) => placementIsStale(placement))) {
      setMessage("Opening-range export stopped because one or more placed Mini-Blocks are stale. Update them to the current Previs source first.");
      return;
    }

    const missingNarration: string[] = [];
    const frames = selectedOpeningPlacements.flatMap((placement, placementIndex) => (
      Array.from({ length: SHOTS_PER_MINI_BLOCK }, (_, shotIndex) => {
        const shotNumber = shotIndex + 1;
        const presentation = timelinePresentationFor(project, placement, shotNumber);
        if (!presentation.artifact?.assetUrl) return null;
        if (showNarration && !presentation.approval) {
          missingNarration.push(`${placement.blockNumber}.${placement.miniBlockNumber} Shot ${String(shotNumber).padStart(2, "0")}`);
        }
        const caption = showNarration && presentation.approval
          ? presentation.approval.bubbles.map((bubble) => `${bubble.speaker}: ${bubble.text}`).join(" · ")
          : "";
        const narration = showNarration && presentation.approval ? presentation.approval.narration : "";
        return {
          position: (placementIndex * SHOTS_PER_MINI_BLOCK) + shotNumber,
          assetId: presentation.artifact.id,
          assetUrl: presentation.artifact.assetUrl,
          authoritative: true as const,
          durationMs: PLANNING_SECONDS_PER_SHOT * 1000,
          sourceRefs: [latestAssembly.id, placement.id, placement.anchorRef, presentation.artifact.id],
          ...(caption ? { caption } : {}),
          ...(narration ? { narration } : {}),
        };
      }).filter((frame): frame is NonNullable<typeof frame> => Boolean(frame))
    ));

    const expectedFrames = selectedOpeningPlacements.length * SHOTS_PER_MINI_BLOCK;
    if (frames.length !== expectedFrames) {
      setMessage("Opening-range export stopped because one or more saved Storyboard Images are missing.");
      return;
    }
    if (showNarration && missingNarration.length) {
      setMessage(`Written narration is stale or missing for ${missingNarration.slice(0, 6).join(", ")}${missingNarration.length > 6 ? " and more" : ""}. Refresh narration in Previs before narrated range export.`);
      return;
    }

    const first = selectedOpeningPlacements[0];
    setOpeningExporting(true);
    setOpeningExportUrl("");
    setMessage(`Exporting ${selectedOpeningPlacements.length} Mini-Block opening range as one silent MP4…`);
    try {
      const response = await fetch("/api/timeline/media-engine/render", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: project.id,
          blockNumber: first.blockNumber,
          miniBlockNumber: first.miniBlockNumber,
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
        throw new Error(result.message || "Timeline opening-range export did not produce a verified video.");
      }
      const createdAt = new Date().toISOString();
      const record: TimelineRangeExport = {
        id: globalThis.crypto?.randomUUID?.() ?? `timeline-range-export-${Date.now()}`,
        timelineAssemblyId: latestAssembly.id,
        placementIds: selectedOpeningPlacements.map((placement) => placement.id),
        sourceKeys: selectedOpeningPlacements.map((placement) => placement.sourceKey),
        mediaMode: "stills",
        narrationIncluded: showNarration,
        videoAssetUrl: videoPath,
        durationSeconds: selectedOpeningPlacements.length * PLANNING_SECONDS_PER_MINI_BLOCK,
        fps: 24,
        createdAt,
      };
      storeRangeExport(record);
      setOpeningExportUrl(videoPath);
      setMessage(`Opening MP4 ready: ${selectedOpeningPlacements.length * 25} Shots · ${selectedOpeningPlacements.length * 75} seconds · silent · 24 fps${showNarration ? " with saved written narration overlays" : ""}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Timeline opening-range MP4 export failed.");
    } finally {
      setOpeningExporting(false);
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
    <section className={styles.workspace} data-timeline-assembly="previs-media" data-timeline-shot-board="25-shot">
      <header className={styles.productionHeader}>
        <div className={styles.projectIdentity}>
          <p className={styles.kicker}>Production context</p>
          <h2>{project.title}</h2>
          <span>Timeline · cinematic Shot Board</span>
        </div>
        <dl className={styles.productionStats}>
          <div><dt>Act</dt><dd>{selectedPlacement ? actForBlock(selectedPlacement.blockNumber) : selectedAct}</dd></div>
          <div><dt>Sequence</dt><dd>{selectedPlacement ? sequenceForBlock(selectedPlacement.blockNumber) : sequenceForBlock(address.blockNumber)}</dd></div>
          <div><dt>Block</dt><dd>{selectedPlacement ? String(selectedPlacement.blockNumber).padStart(2, "0") : String(address.blockNumber).padStart(2, "0")}</dd></div>
          <div><dt>Mini-Block</dt><dd>{selectedPlacement ? selectedPlacement.blockNumber + "." + selectedPlacement.miniBlockNumber : address.blockNumber + "." + address.miniBlockNumber}</dd></div>
          <div><dt>Duration</dt><dd>~75 sec</dd></div>
          <div><dt>Shots</dt><dd>25</dd></div>
          <div><dt>Media</dt><dd>{playbackMode === "stills" ? "Still images" : "Generated motion"}</dd></div>
          <div><dt>Visual source</dt><dd>Approved Storyboard / Previs</dd></div>
          <div><dt>Pacing</dt><dd>~3 sec / Shot</dd></div>
          <div data-stale={selectedPlacement && placementIsStale(selectedPlacement) ? "true" : "false"}><dt>Source</dt><dd>{selectedPlacement ? (placementIsStale(selectedPlacement) ? "STALE" : "CURRENT") : "NOT PLACED"}</dd></div>
        </dl>
      </header>

      <div className={styles.mathStrip} role="status">
        <strong>Act {selectedAct} · 6 Blocks · 24 Mini-Blocks</strong>
        <span>1 Mini-Block = 25 planned Shots · ~3 sec per Shot · ~75 sec planning target · ~1,800 final video frames at 24 fps</span>
        <span>{selectedMotionSucceeded}/25 generated Shots ready</span>
      </div>

      <details className={styles.sourceDrawer}>
        <summary>Approved Previs sources · no manual re-import</summary>
        <div className={styles.sourceGrid}>
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
      </details>

      <section className={`${styles.monitor} ${styles.topMonitor}`} aria-label="Timeline playback viewer">
        <header>
          <p className={styles.kicker}>Playback monitor</p>
          <strong>{activePlacement ? "Shot " + String(activeShotNumber).padStart(2, "0") + " of 25" : "No placed Previs media"}</strong>
        </header>
        <div className={styles.stage}>
          {activeMotion.current?.status === "succeeded" && activeMotion.current.outputAssetUrl
            ? <video controls key={activeMotion.current.outputAssetUrl} muted playsInline preload="metadata" ref={motionVideoRef} src={activeMotion.current.outputAssetUrl} />
            : activeImage?.assetUrl
              ? <img alt={activeImage.narrativeIntention || "Storyboard Image for Shot " + activeShotNumber} src={activeImage.assetUrl} />
              : <div className={styles.missing}><strong>Shot {String(activeShotNumber).padStart(2, "0")} of 25</strong><span>{activeMotion.stale ? "The saved motion belongs to an older Shot Generation Packet. Regenerate this Shot." : activeMotion.current?.status === "failed" ? activeMotion.current.error || "Motion generation failed." : "No locked Storyboard Image exists in this saved Timeline source snapshot."}</span></div>}
          {activePlacement ? <span className={styles.shotCounter}>Shot {String(activeShotNumber).padStart(2, "0")} of 25</span> : null}
        </div>
      </section>

      <div className={styles.boardShell}>
        <aside className={styles.referenceRail} aria-label="Authoritative Timeline visual references">
          <header>
            <p className={styles.kicker}>Reference images</p>
            <strong>Locked visual continuity</strong>
          </header>
          <div className={styles.referenceGroup}>
            <strong>Characters</strong>
            <div className={styles.referenceFrames}>
              {selectedCharacters.flatMap((character) => character.imageUrls.slice(0, 1).map((assetUrl) => (
                <figure key={character.id + ":" + assetUrl}>
                  <img alt={"Approved World Map reference for " + character.name} src={assetUrl} />
                  <figcaption>{character.name}</figcaption>
                </figure>
              )))}
              {selectedCharacters.length && !selectedCharacters.some((character) => character.imageUrls.length)
                ? <p>Character evidence is present, but no locked World Map visual reference is approved.</p>
                : null}
              {!selectedCharacters.length ? <p>No character identity is mapped to the selected Mini-Block.</p> : null}
            </div>
          </div>
          <div className={styles.referenceGroup}>
            <strong>Storyboard continuity</strong>
            <div className={styles.referenceFrames}>
              {selectedPlacement?.shotImages.slice(0, 4).map((imageRef) => {
                const presentation = timelinePresentationFor(project, selectedPlacement, imageRef.shotNumber);
                return presentation.artifact?.assetUrl ? (
                  <figure key={imageRef.artifactId}>
                    <img alt={presentation.artifact.narrativeIntention || "Locked Storyboard reference"} src={presentation.artifact.assetUrl} />
                    <figcaption>Shot {String(imageRef.shotNumber).padStart(2, "0")}</figcaption>
                  </figure>
                ) : null;
              })}
              {!selectedPlacement?.shotImages.length ? <p>No locked visual references are available for this Mini-Block.</p> : null}
            </div>
          </div>
          <dl className={styles.referenceFacts}>
            <div><dt>Character</dt><dd>{selectedCharacters.map((character) => character.name).join(" · ") || "Not established in authoritative Timeline data"}</dd></div>
            <div><dt>Locked character refs</dt><dd>{selectedCharacters.reduce((total, character) => total + character.imageUrls.length, 0) || "None approved"}</dd></div>
            <div><dt>Props</dt><dd>Not established in authoritative Timeline data</dd></div>
            <div><dt>Location</dt><dd>Not established in authoritative Timeline data</dd></div>
            <div><dt>Lighting</dt><dd>Not established in authoritative Timeline data</dd></div>
            <div><dt>Mood</dt><dd>{activeEvidence.responsibility || "Not established"}</dd></div>
            <div><dt>Palette</dt><dd>Not established in authoritative Timeline data</dd></div>
          </dl>
        </aside>

        <main className={styles.shotBoard} aria-label="25 Shot cinematic production board">
          <header className={styles.shotBoardHeader}>
            <div>
              <p className={styles.kicker}>Shot storyboard & shotlist</p>
              <h3>{selectedPlacement ? "Mini-Block " + selectedPlacement.blockNumber + "." + selectedPlacement.miniBlockNumber : "Place a Mini-Block to begin"}</h3>
            </div>
            <span>25 Shots · approximately 3 seconds each · 75 seconds total</span>
          </header>

          <div className={styles.shotColumns} aria-hidden="true">
            <span>Shot</span>
            <span>Storyboard frame</span>
            <span>Duration</span>
            <span>Cinematic / story details</span>
            <span>Action / dialogue / narration</span>
            <span>Flow / motion</span>
          </div>

          <div className={styles.shotRows}>
            {selectedPlacement ? Array.from({ length: SHOTS_PER_MINI_BLOCK }, (_, index) => index + 1).map((shotNumber) => {
              const presentation = timelinePresentationFor(project, selectedPlacement, shotNumber);
              const progression = storyboardPositionProgression(shotNumber);
              const generationPacket = buildTimelineGenerationPacketForShot(project, selectedPlacement, shotNumber);
              const state = motionFor(selectedPlacement, shotNumber);
              const current = state.current;
              const working = generatingShotNumber === shotNumber;
              const label = working && generatingMotionStage
                ? generatingMotionStage
                : state.stale
                  ? "STALE"
                  : current?.status === "succeeded"
                    ? "READY"
                    : current?.status === "failed" && current.error.startsWith("PREFLIGHT FAILED")
                      ? "PREFLIGHT FAILED"
                      : current?.status?.toUpperCase() ?? "NOT GENERATED";
              const placementIndex = placements.findIndex((placement) => placement.id === selectedPlacement.id);
              const selected = activePlacement?.id === selectedPlacement.id && activeShotNumber === shotNumber;
              const dialogue = presentation.approval?.bubbles.map((bubble) => bubble.speaker + ": " + bubble.text).join(" · ") || "";
              const narration = presentation.approval?.narration || "";
              const productionShots = timelineProductionShotsFor(project, selectedPlacement, shotNumber);
              const productionShotIds = productionShots.map((shot) => shot.id);
              const soundCues = timelineSoundCuesFor(project, selectedPlacement, productionShotIds);
              const cameraDetail = productionShots
                .flatMap((shot) => [shot.shotSize, shot.angle, shot.movement, shot.lens])
                .map((value) => value.trim())
                .filter(Boolean)
                .join(" · ");
              const productionIntent = productionShots
                .map((shot) => shot.visualIntent.trim())
                .filter(Boolean)
                .join(" · ");
              const soundIntent = soundCues.map((cue) => cue.kind + ": " + cue.intent).join(" · ");
              return (
                <article className={styles.shotRow} data-selected={selected ? "true" : "false"} key={shotNumber}>
                  <div className={styles.shotNumber}><strong>{String(shotNumber).padStart(2, "0")}</strong></div>
                  <button
                    aria-label={"Select Shot " + String(shotNumber).padStart(2, "0")}
                    aria-pressed={selected}
                    className={styles.shotFrameButton}
                    disabled={placementIndex < 0}
                    onClick={() => seekToShot(placementIndex, shotNumber)}
                    type="button"
                  >
                    {presentation.artifact?.assetUrl
                      ? <img alt={presentation.artifact.narrativeIntention || "Storyboard Image for Shot " + shotNumber} src={presentation.artifact.assetUrl} />
                      : <span>No locked Storyboard Image</span>}
                  </button>
                  <div className={styles.durationCell}>
                    <strong>3.0s</strong>
                    <small>{clock((shotNumber - 1) * PLANNING_SECONDS_PER_SHOT)} – {clock(shotNumber * PLANNING_SECONDS_PER_SHOT)}</small>
                  </div>
                  <div className={styles.cinematicCell} data-production-evidence={productionShots.length ? "authored" : "not-established"}>
                    <strong>{productionShots.length ? "Authored Previs camera" : progression.label}</strong>
                    <span>{cameraDetail || progression.direction}</span>
                    <small>{productionIntent || presentation.artifact?.narrativeIntention || activeEvidence.responsibility || "No approved cinematic intention is established."}</small>
                    {productionShots.length ? <small>{productionShots.length} authored production Shot{productionShots.length === 1 ? "" : "s"} tied to this exact Storyboard Image.</small> : <small>No exact production-shot camera record is tied to this Storyboard Image.</small>}
                  </div>
                  <div className={styles.storyCell}>
                    <span>{dialogue || narration || "No approved dialogue or narration is mapped to this Shot."}</span>
                    {soundIntent ? <small>Sound · {soundIntent}</small> : null}
                    <small>{activeEvidence.passages.length ? "Synchronized screenplay source · Current Mini-Block evidence" : "Timeline does not manufacture source text or timestamps."}</small>
                  </div>
                  <div className={styles.motionCell} data-motion-status={state.stale ? "stale" : current?.status ?? "empty"}>
                    <strong>{label}</strong>
                    {current?.provider || current?.model ? <small>{[current.generationMode, current.provider, current.model].filter(Boolean).join(" · ")}</small> : <small>Shot packet can route through text or approved visual references.</small>}
                    {current?.error ? <small>{current.error}</small> : null}
                    <details>
                      <summary>Generation packet</summary>
                      <small>{generationPacket.dramaticResponsibility || "No separate Mini-Block responsibility text."}</small>
                      <small>{generationPacket.progression.label} · {generationPacket.progression.direction}</small>
                      <small>{generationPacket.references.length} approved reference binding{generationPacket.references.length === 1 ? "" : "s"} · {generationPacket.sourceRefs.length} provenance refs</small>
                    </details>
                    <button
                      disabled={generatingShotNumber !== null}
                      onClick={() => void generateMotionShot(shotNumber)}
                      type="button"
                    >
                      {working ? "Generating…" : current?.status === "failed" || state.stale ? "Retry motion" : current?.status === "succeeded" ? "Regenerate motion" : "Generate motion"}
                    </button>
                  </div>
                </article>
              );
            }) : <p className={styles.emptyBoard}>Place approved Previs media from the source drawer to populate the 25-Shot Timeline board.</p>}
          </div>
        </main>

        <aside className={styles.sidePanel}>
          <section className={styles.inspector} aria-label="Selected Timeline media inspector">
            <p className={styles.kicker}>Selected Mini-Block</p>
            {selectedPlacement ? (
              <>
                <h3>Mini-Block {selectedPlacement.blockNumber}.{selectedPlacement.miniBlockNumber}</h3>
                <dl>
                  <div><dt>Address</dt><dd>Act {actForBlock(selectedPlacement.blockNumber)} · Sequence {sequenceForBlock(selectedPlacement.blockNumber)} · Block {String(selectedPlacement.blockNumber).padStart(2, "0")}</dd></div>
                  <div><dt>Source</dt><dd>Previs Flip Book</dd></div>
                  <div><dt>Source revision</dt><dd>{selectedPlacement.sourceRevision}</dd></div>
                  <div><dt>Coverage</dt><dd>{selectedPlacement.shotImages.length}/25 locked Storyboard Images</dd></div>
                  <div><dt>Motion</dt><dd>{selectedMotionSucceeded}/25 generated Shots ready</dd></div>
                  <div><dt>Status</dt><dd>{placementIsStale(selectedPlacement) ? "STALE · newer upstream source available" : "CURRENT"}</dd></div>
                </dl>
                <small className={styles.sourceKey}>Source identity · {selectedPlacement.sourceKey}</small>
                <div className={styles.inspectorActions}>
                  <button disabled={exporting || selectedPlacement.shotImages.length !== SHOTS_PER_MINI_BLOCK} onClick={exportSelectedMp4} type="button">
                    {exporting ? "Exporting MP4…" : "Export selected Mini-Block MP4 · narration " + (showNarration ? "on" : "off")}
                  </button>
                  {exportUrl ? <a className={styles.exportLink} download={timelineMp4FileName(project.title, selectedPlacement, showNarration)} href={exportUrl}>Open exported MP4</a> : null}
                  <small>Silent export · 25 × 3-second Shots · 75 seconds · 24 fps. Export failure never reports success.</small>
                  {placementIsStale(selectedPlacement) ? <button onClick={() => updatePlacementSource(selectedPlacement)} type="button">Update to current Previs source</button> : null}
                </div>
              </>
            ) : <p>Select or place approved Previs media to inspect its provenance.</p>}
          </section>

          <section className={styles.assemblyControls} aria-label="Opening movie assembly and export">
            <header className={styles.assemblyHeader}>
              <div>
                <p className={styles.kicker}>Assembly & export</p>
                <strong>Opening movie range</strong>
              </div>
              <span>Up to 4 Mini-Blocks · 5-minute Block</span>
            </header>
            {openingRun.length ? (
              <>
                <div className={styles.rangeControls} aria-label="Opening range length">
                  {openingRun.map((_, index) => {
                    const count = index + 1;
                    return <button aria-pressed={openingSegmentCount === count} key={count} onClick={() => setOpeningSegmentCount(count)} type="button">{count} × 75s</button>;
                  })}
                </div>
                <ol className={styles.rangeSummary} aria-label="Selected opening range">
                  {selectedOpeningPlacements.map((placement, index) => (
                    <li data-stale={placementIsStale(placement) ? "true" : "false"} key={placement.id}>
                      <strong>{index + 1}. B{String(placement.blockNumber).padStart(2, "0")} · M{placement.blockNumber}.{placement.miniBlockNumber}</strong>
                      <span>{placement.shotImages.length}/25 Images · revision {placement.sourceRevision}</span>
                      <small>{placementIsStale(placement) ? "STALE · update before export" : "CURRENT"}</small>
                    </li>
                  ))}
                </ol>
                <div className={styles.openingActions}>
                  <button disabled={openingExporting || !selectedOpeningPlacements.length} onClick={() => void exportOpeningRangeMp4()} type="button">
                    {openingExporting ? "Exporting opening MP4…" : "Export " + selectedOpeningPlacements.length + "-Mini-Block MP4 · narration " + (showNarration ? "on" : "off")}
                  </button>
                  {(openingExportUrl || latestRangeExport?.videoAssetUrl) ? (
                    <a
                      className={styles.exportLink}
                      download={timelineRangeMp4FileName(project.title, selectedOpeningPlacements.length ? selectedOpeningPlacements : openingRun.slice(0, 1), showNarration)}
                      href={openingExportUrl || latestRangeExport?.videoAssetUrl}
                    >
                      Open saved opening MP4
                    </a>
                  ) : null}
                  <small>Locked still-image assembly only. Generated motion is never substituted silently.</small>
                  {latestRangeExport ? <small>Saved · {latestRangeExport.placementIds.length} Mini-Block{latestRangeExport.placementIds.length === 1 ? "" : "s"} · {latestRangeExport.durationSeconds}s · {latestRangeExport.narrationIncluded ? "narration on" : "narration off"}</small> : null}
                </div>
              </>
            ) : <p className={styles.openingEmpty}>Place one complete 25-Shot Previs Mini-Block to start opening assembly.</p>}
          </section>

          <section className={styles.providerStatus}>
            <p className={styles.kicker}>Motion provider</p>
            <span>{motionRouteMessage}</span>
          </section>
        </aside>
      </div>

      <section className={styles.continuityPanel} aria-label="Timeline continuity and story evidence">
        <header>
          <div>
            <p className={styles.kicker}>Continuity bible</p>
            <h3>Authoritative story and production continuity</h3>
          </div>
          <span>Unknown values remain explicit; Timeline does not invent continuity facts.</span>
        </header>
        <div className={styles.continuityGrid}>
          <dl>
            <div><dt>Scenes</dt><dd>{activeEvidence.passages.map((passage) => passage.sceneNumber).filter(Boolean).join(", ") || "Not established"}</dd></div>
            <div><dt>Dramatic responsibility</dt><dd>{activeEvidence.responsibility || "Not established"}</dd></div>
            <div><dt>Structural finding</dt><dd>{activeEvidence.structuralFinding || "Not established"}</dd></div>
            <div><dt>Action continuity</dt><dd>{activePresentation?.artifact?.narrativeIntention || "No approved source"}</dd></div>
            <div><dt>Dialogue continuity</dt><dd>{activePresentation?.approval?.bubbles.length ? activePresentation.approval.bubbles.map((bubble) => bubble.speaker + ": " + bubble.text).join(" · ") : "No approved source"}</dd></div>
            <div><dt>Sound continuity</dt><dd>{activeSoundCues.length ? activeSoundCues.map((cue) => cue.kind + ": " + cue.intent).join(" · ") : "No approved source"}</dd></div>
          </dl>
          <dl>
            <div><dt>Character</dt><dd>{activeCharacters.map((character) => character.name).join(" · ") || "No approved Timeline source"}</dd></div>
            <div><dt>Character truth</dt><dd>{activeCharacters.flatMap((character) => character.facts).join(" · ") || "No approved Timeline source"}</dd></div>
            <div><dt>Wardrobe</dt><dd>No approved structured Timeline source</dd></div>
            <div><dt>Props</dt><dd>No approved structured Timeline source</dd></div>
            <div><dt>Location</dt><dd>No approved structured Timeline source</dd></div>
          </dl>
          <dl>
            <div><dt>Camera</dt><dd>{activeProductionShots.flatMap((shot) => [shot.shotSize, shot.angle, shot.movement, shot.lens]).map((value) => value.trim()).filter(Boolean).join(" · ") || "No authored production camera record"}</dd></div>
            <div><dt>Blocking</dt><dd>{activeProductionShots.map((shot) => shot.blockingIntent?.trim()).filter(Boolean).join(" · ") || "No authored blocking record"}</dd></div>
            <div><dt>Transitions</dt><dd>{activeProductionShots.flatMap((shot) => [shot.transitionIn, shot.transitionOut]).map((value) => value.trim()).filter(Boolean).join(" · ") || "No authored transition record"}</dd></div>
            <div><dt>Time / weather</dt><dd>No approved structured Timeline source</dd></div>
            <div><dt>Lighting / palette</dt><dd>No approved structured Timeline source</dd></div>
          </dl>
          <div className={styles.storyEvidence}>
            <strong>Spatial / scene-flow evidence</strong>
            <span>{activeProductionShots.length ? "Exact Storyboard Image ↔ authored Previs Shot linkage" : "No exact authored Previs Shot is linked to the active Storyboard Image."}</span>
            {activeProductionShots.length ? activeProductionShots.map((shot) => (
              <article key={shot.id}>
                <small>Production Shot {shot.order} · {shot.reviewState}</small>
                <p>{[
                  shot.visualIntent,
                  shot.blockingIntent,
                  shot.performanceEnergy,
                  shot.pacingIntent,
                  shot.transitionIn && "Transition in: " + shot.transitionIn,
                  shot.transitionOut && "Transition out: " + shot.transitionOut,
                ].filter(Boolean).join(" · ") || "The Shot is linked, but no additional production intent is authored."}</p>
              </article>
            )) : null}
            <strong>Synchronized screenplay source</strong>
            <span>Current Mini-Block evidence</span>
            {activeEvidence.passages.length ? activeEvidence.passages.map((passage) => (
              <article key={passage.id}>
                <small>{passage.type} · Scene {passage.sceneNumber || "—"}</small>
                <p>{passage.text}</p>
              </article>
            )) : <p>Timeline does not manufacture source text or timestamps.</p>}
          </div>
        </div>
      </section>

      <p className={styles.status} role="status">{message}</p>
    </section>
  );
}
