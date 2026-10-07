import type {
  TimelineMotionShot,
  TimelinePrevisPlacement,
} from "@/core/contracts/previs";
import { approvedWorldMapCharacterReferences } from "@/core/contracts/world-map";
import type { PPFProject } from "@/core/project/project";
import {
  buildTimelineShotGenerationPacket,
  type TimelineShotGenerationPacket,
} from "@/lib/preproduction/provider-capability-contract";
import {
  storyboardAnchorEvidence,
  storyboardPositionProgression,
} from "../storyboard/storyboard-editorial-model";

const SHOTS_PER_MINI_BLOCK = 25;

function targetIdForBlock(blockNumber: number) {
  return `block:block-${String(blockNumber).padStart(2, "0")}`;
}

function storyboardArtifactFor(
  project: PPFProject,
  placement: TimelinePrevisPlacement,
  shotNumber: number,
) {
  const artifactId = placement.shotImages.find((image) => image.shotNumber === shotNumber)?.artifactId ?? "";
  return artifactId
    ? project.build.foundations.visualArtifacts.find((candidate) => candidate.id === artifactId) ?? null
    : null;
}

function timelineProductionShotsFor(
  project: PPFProject,
  placement: TimelinePrevisPlacement,
  shotNumber: number,
) {
  const artifact = storyboardArtifactFor(project, placement, shotNumber);
  if (!artifact) return [];
  return project.production.shots
    .filter((shot) => shot.anchorRef === placement.anchorRef && shot.storyboardArtifactId === artifact.id)
    .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id));
}

function timelineCharacterReferences(project: PPFProject, placement: TimelinePrevisPlacement) {
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

export function buildTimelineGenerationPacketForShot(
  project: PPFProject,
  placement: TimelinePrevisPlacement,
  shotNumber: number,
): TimelineShotGenerationPacket {
  const artifact = storyboardArtifactFor(project, placement, shotNumber);
  const evidence = storyboardAnchorEvidence(project, targetIdForBlock(placement.blockNumber), placement.miniBlockNumber);
  const progression = storyboardPositionProgression(shotNumber);
  const previous = shotNumber > 1 ? storyboardPositionProgression(shotNumber - 1) : null;
  const next = shotNumber < SHOTS_PER_MINI_BLOCK ? storyboardPositionProgression(shotNumber + 1) : null;
  const screenplay = evidence.passages.map((passage) => passage.text).filter(Boolean).join(" ").replace(/\s+/gu, " ").trim().slice(0, 1_800);
  const characters = timelineCharacterReferences(project, placement);
  const productionShots = timelineProductionShotsFor(project, placement, shotNumber);
  const nextArtifact = shotNumber < SHOTS_PER_MINI_BLOCK
    ? storyboardArtifactFor(project, placement, shotNumber + 1)
    : null;
  const references = [
    ...(artifact?.assetUrl ? [{
      role: "source-image" as const,
      id: artifact.id,
      assetUrl: artifact.assetUrl,
    }] : []),
    ...(nextArtifact?.assetUrl ? [{
      role: "last-frame" as const,
      id: nextArtifact.id,
      assetUrl: nextArtifact.assetUrl,
    }] : []),
    ...characters.flatMap((character) => character.imageUrls.map((assetUrl, index) => ({
      role: "character" as const,
      id: `${character.id}:reference-${index + 1}`,
      assetUrl,
    }))),
  ];

  return buildTimelineShotGenerationPacket({
    projectId: project.id,
    canonicalRevision: project.revision,
    placementId: placement.id,
    anchorRef: placement.anchorRef,
    blockNumber: placement.blockNumber,
    miniBlockNumber: placement.miniBlockNumber,
    shotNumber,
    dramaticResponsibility: evidence.responsibility ?? "",
    screenplay,
    progressionLabel: progression.label,
    progressionDirection: progression.direction,
    previousShotContext: previous ? `${previous.label}. ${previous.direction}` : "Mini-Block opening boundary.",
    nextShotContext: next ? `${next.label}. ${next.direction}` : "Mini-Block closing handoff.",
    narrativeIntention: artifact?.narrativeIntention ?? "",
    visualDirection: artifact?.prompt?.slice(0, 1_200) ?? "",
    characterFacts: characters.flatMap((character) => [character.name, ...character.facts]),
    productionDirection: productionShots.flatMap((shot) => [
      shot.shotSize ? `Framing: ${shot.shotSize}` : "",
      shot.angle ? `Angle: ${shot.angle}` : "",
      shot.lens ? `Lens: ${shot.lens}` : "",
      shot.movement ? `Movement: ${shot.movement}` : "",
      shot.blockingIntent ? `Blocking: ${shot.blockingIntent}` : "",
      shot.performanceEnergy ? `Performance: ${shot.performanceEnergy}` : "",
      shot.pacingIntent ? `Pacing: ${shot.pacingIntent}` : "",
      shot.transitionIn ? `Transition in: ${shot.transitionIn}` : "",
      shot.transitionOut ? `Transition out: ${shot.transitionOut}` : "",
    ].filter(Boolean)),
    continuityLocks: characters.flatMap((character) => [
      `Preserve character identity: ${character.name}`,
      ...character.facts,
    ]),
    references,
    sourceRefs: [
      placement.id,
      placement.anchorRef,
      ...(artifact ? [artifact.id] : []),
      ...characters.map((character) => character.id),
      ...productionShots.map((shot) => shot.id),
    ],
  });
}

export function timelineMotionSourceKey(
  placement: TimelinePrevisPlacement,
  packet: TimelineShotGenerationPacket,
) {
  return JSON.stringify({
    placementSourceKey: placement.sourceKey,
    packetFingerprint: packet.sourceFingerprint,
  });
}

export function currentTimelineMotionForStoryboardShot(
  project: PPFProject,
  anchorRef: string,
  shotNumber: number,
  sourceArtifactId: string,
): TimelineMotionShot | null {
  if (!anchorRef || !sourceArtifactId) return null;
  const assembly = [...(project.production.timelineAssemblies ?? [])]
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ?? null;
  const placement = assembly?.placements.find((candidate) => (
    candidate.anchorRef === anchorRef
    && candidate.shotImages.some((image) => image.shotNumber === shotNumber && image.artifactId === sourceArtifactId)
  )) ?? null;
  if (!placement) return null;

  const packet = buildTimelineGenerationPacketForShot(project, placement, shotNumber);
  const expectedSourceKey = timelineMotionSourceKey(placement, packet);
  return [...(project.production.timelineMotionShots ?? [])]
    .filter((motion) => (
      motion.placementId === placement.id
      && motion.anchorRef === anchorRef
      && motion.shotNumber === shotNumber
      && motion.sourceArtifactId === sourceArtifactId
      && motion.sourceKey === expectedSourceKey
      && motion.status === "succeeded"
      && Boolean(motion.outputAssetUrl)
    ))
    .sort((left, right) => (
      right.updatedAt.localeCompare(left.updatedAt)
      || right.createdAt.localeCompare(left.createdAt)
    ))[0] ?? null;
}
