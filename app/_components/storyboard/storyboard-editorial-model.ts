import { normalizeBlockWritingState } from "@/core/contracts/block-writing";
import type { FoundationsVisualArtifact } from "@/core/contracts/build-progress";
import { normalizeProjectSourceEvidence } from "@/core/contracts/imported-screenplay-evidence";
import type { PPFProject } from "@/core/project/project";
import {
  AFTERGLOW_V9_FOUNDATIONS_FIXTURE_ID,
  AFTERGLOW_V9_REFERENCE_SOURCE_ID,
} from "@/data/afterglow-reference-identity";
import { afterglowStoryboardCoverage, createAfterglowStoryboardFrames } from "@/data/afterglow-storyboard";
import { deriveVisualReadiness } from "@/modules/build/visual-readiness";

export const STORYBOARD_REFERENCE_WORKFLOW = "storyboard-reference-adoption-v1" as const;
export type StoryboardFramePromptInput = Readonly<{
  title: string;
  blockNumber: number;
  miniBlockNumber: number;
  position: number;
  scene: string;
  beat: string;
  shot: string;
  source: string;
}>;

// Storyboard direction is a proposal skill: PlotPickle's story, shot and continuity roles
// each constrain one disposable image brief. No agent or provider runs until the writer asks.
const FRAME_DIRECTION = [
  ["Establish the geography", "Wide view: orient the audience to the verified place and the characters' positions."],
  ["Locate the protagonist", "Medium view: make the protagonist's immediate objective legible in the space."],
  ["Reveal the obstacle", "Show the physical resistance or opposing presence already in the source."],
  ["Show a telling detail", "Close on a grounded object or environmental detail that matters to this moment."],
  ["Clarify the eyeline", "Frame what the character actually notices; preserve screen direction."],
  ["Map the relationship", "Two-shot: express the established distance and power between the people present."],
  ["Track the first action", "A readable action frame with clear origin, destination and body position."],
  ["Show the reaction", "Close view of the observed response, avoiding an invented emotional beat."],
  ["Reveal new information", "Compose a source-supported discovery in foreground and background."],
  ["Hold the geography", "A wide continuity check that preserves exits, landmarks and character positions."],
  ["Focus the pressure", "Tighten the frame around the existing source of tension without adding events."],
  ["Find the point of view", "Use an over-shoulder or motivated POV aligned with the current observer."],
  ["Mark a physical choice", "Show a source-supported gesture or change in position at the moment of choice."],
  ["Expose the consequence", "Reveal the immediate visible result of an action present in the passage."],
  ["Reframe the opposition", "Give the established obstacle its own readable composition."],
  ["Preserve the axis", "Use the reverse angle without flipping established left-right relationships."],
  ["Isolate a prop", "Insert on a relevant object already named in the evidence; do not invent one."],
  ["Show the environment responding", "Frame an observed change in light, weather or setting, if present."],
  ["Measure the distance", "A spatial frame showing the gap between objective and obstacle."],
  ["Anticipate the turn", "Hold on a source-supported tension point before the next visible action."],
  ["Capture the turn", "Compose the concrete action that changes the moment, if the source supplies one."],
  ["Read the aftermath", "Show the immediate physical aftermath grounded in this part of the passage."],
  ["Return to the character", "A restrained reaction frame that keeps identity and wardrobe consistent."],
  ["Confirm changed space", "Wide view of the new arrangement without moving anyone unsupported."],
  ["Leave a visual handoff", "End on a source-supported image that can connect to the next shot."],
] as const;

export function storyboardPositionDirection(position: number) {
  if (!Number.isInteger(position) || position < 1 || position > FRAME_DIRECTION.length) throw new RangeError("Storyboard position must be 1 through 25.");
  return FRAME_DIRECTION[position - 1];
}

function positionEvidence(source: string, position: number) {
  const words = source.trim().replace(/\s+/g, " ").split(" ").filter(Boolean);
  if (!words.length) return "";
  const start = Math.max(0, Math.min(words.length - 1, Math.round((position - 1) * (words.length - 1) / 24) - 25));
  return words.slice(start, start + 65).join(" ");
}

export function storyboardFramePrompt(input: StoryboardFramePromptInput) {
  const clean = (value: string) => value.trim().replace(/\s+/g, " ").slice(0, 1200);
  const [purpose, composition] = storyboardPositionDirection(input.position);
  return [
    `Create one cinematic storyboard frame for ${clean(input.title) || "this story"}.`,
    `Block ${String(input.blockNumber).padStart(2, "0")}, Mini-Block ${input.miniBlockNumber}, position ${String(input.position).padStart(2, "0")}.`,
    `PlotPickle shot direction skill: ${purpose}. ${composition}`,
    input.scene ? `Observed scene: ${clean(input.scene)}.` : "No scene is mapped here; do not invent a scene.",
    input.beat ? `Authored beat: ${clean(input.beat)}.` : "No beat is authored here; do not invent a beat.",
    input.shot ? `Authored shot: ${clean(input.shot)}.` : "No shot is authored here; treat this as exploratory frame coverage.",
    input.source ? `Screenplay evidence near this position: ${clean(positionEvidence(input.source, input.position))}.` : "No screenplay passage is mapped here; use only the available story context.",
    "Story Architect: keep the sequence, source action and character intent intact. Visual Director: turn this one purpose into a legible camera composition. Continuity keeper: preserve established identity, wardrobe, props, geography and the screen axis. These are prompt instructions, not a claim that an agent has run.",
    "Show clear dramatic action and spatial continuity with established characters and locations. Black-and-white storyboard illustration, landscape composition, no dialogue, text, logos, or watermarks.",
    "Create one WebP visual candidate. Generation does not create a canonical Beat or Shot or approve the Frame.",
  ].join(" ");
}

const STORYBOARD_UPSTREAM_PREFIX = "storyboard-upstream:" as const;
const STORYBOARD_UPSTREAM_V2_PREFIX = "storyboard-upstream:v2:" as const;
const STORYBOARD_STALE_PREFIX = "storyboard-stale:" as const;

export type StoryboardApprovalAuthority = Readonly<{
  readonly authorityClass: "authenticated-human" | "delegated-autonomous-operator";
  readonly humanProfileId?: string;
  readonly autonomousRunId?: string;
  readonly operatorId?: string;
}>;

export type StoryboardEditorialCandidate = {
  readonly id: string;
  readonly targetId: string;
  readonly miniBlockNumber: number;
  readonly label: string;
  readonly caption: string;
  readonly assetUrl: string;
  readonly sourceRef: string;
  readonly sourceKind: "historical-storyboard" | "replacement-concept";
  readonly provenanceRefs: readonly string[];
  readonly acceptedArtifactId: string | null;
};

export type StoryboardAnchorEvidenceProjection = {
  readonly anchorRef: string;
  readonly blockNumber: number;
  readonly miniBlockNumber: number;
  readonly sourceFileName: string;
  readonly passages: readonly {
    readonly id: string;
    readonly type: string;
    readonly text: string;
    readonly sceneId: string | null;
    readonly sceneNumber: number;
  }[];
  readonly blockTitle: string;
  readonly responsibility: string;
  readonly structuralFinding: string;
  readonly structuralReviewNote: string;
  readonly sourceMappings: readonly {
    readonly sourceVersion: string;
    readonly sourceRole: string;
    readonly mappingMethod: string;
    readonly sourceRef: string;
    readonly candidateOnly: boolean;
  }[];
  readonly sourceSections: readonly {
    readonly id: string;
    readonly title: string;
    readonly page: number;
    readonly mappingMethod: string;
  }[];
  readonly characterEvidenceRefs: readonly string[];
  readonly acceptedVisualRefs: readonly string[];
};

export function storyboardTargetSourceKey(targetId: string) {
  return `storyboard-target:${targetId}`;
}

export function storyboardAnchorTargetRef(targetId: string, miniBlockNumber: number) {
  return `storyboard-anchor:${targetId}:mini-${miniBlockNumber}`;
}

function observedReferenceSourceKey(sourceRef: string) {
  return `observed-reference:${sourceRef}`;
}

function approvalValue(value: unknown, maximum = 180) {
  return String(value ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function approvalDescription(authority?: StoryboardApprovalAuthority) {
  if (authority?.authorityClass !== "delegated-autonomous-operator") return "Human Keep decision";
  const operatorId = approvalValue(authority.operatorId);
  const autonomousRunId = approvalValue(authority.autonomousRunId);
  const identity = [operatorId ? `operator ${operatorId}` : "", autonomousRunId ? `run ${autonomousRunId}` : ""].filter(Boolean).join(", ");
  return `delegated autonomous Keep decision${identity ? ` (${identity})` : ""}`;
}

function approvalSourceKeys(authority?: StoryboardApprovalAuthority) {
  if (authority?.authorityClass !== "delegated-autonomous-operator") return [];
  const operatorId = approvalValue(authority.operatorId);
  const autonomousRunId = approvalValue(authority.autonomousRunId);
  return [
    "authority:delegated-autonomous-operator",
    autonomousRunId ? `autonomous-run:${autonomousRunId}` : "",
    operatorId ? `autonomous-operator:${operatorId}` : "",
  ].filter(Boolean);
}

function targetBlockNumber(targetId: string) {
  const match = targetId.match(/^block:block-(\d{2})$/);
  return match ? Number(match[1]) : 0;
}

export function storyboardSourceEvidenceForAnchor(project: PPFProject, targetId: string, miniBlockNumber: number) {
  const blockNumber = targetBlockNumber(targetId);
  if (!blockNumber) return [];
  const screenplay = normalizeProjectSourceEvidence(
    (project as PPFProject & { readonly sourceEvidence?: unknown }).sourceEvidence,
  ).screenplay;
  return (screenplay?.passages ?? [])
    .filter((passage) => passage.blockNumber === blockNumber && passage.miniBlockNumber === miniBlockNumber)
    .map((passage) => ({
      id: passage.id,
      type: passage.type,
      text: passage.text,
      sceneId: passage.sceneId,
      sceneNumber: passage.sceneNumber,
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

function artifactTargetsFrame(
  artifact: FoundationsVisualArtifact,
  targetId: string,
  miniBlockNumber: number,
) {
  const keys = artifact.sourceDecisionKeys ?? [];
  return artifact.workflow === STORYBOARD_REFERENCE_WORKFLOW
    && keys.includes(storyboardTargetSourceKey(targetId))
    && keys.includes(storyboardAnchorTargetRef(targetId, miniBlockNumber));
}

export function acceptedTargetScopedVisualIds(project: PPFProject, targetId: string, miniBlockNumber: number) {
  const targetKey = storyboardTargetSourceKey(targetId);
  const anchorKey = storyboardAnchorTargetRef(targetId, miniBlockNumber);
  const foundationAccepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
  const worldAccepted = new Set(project.build.world.acceptedVisualArtifactIds);
  const matchesTarget = (keys: readonly string[] | undefined) => (
    (keys ?? []).includes(anchorKey) || (keys ?? []).includes(targetKey)
  );

  return [
    ...project.build.foundations.visualArtifacts
      .filter((artifact) => (
        artifact.workflow !== STORYBOARD_REFERENCE_WORKFLOW
        && artifact.reviewState === "accepted"
        && foundationAccepted.has(artifact.id)
        && matchesTarget(artifact.sourceDecisionKeys)
      ))
      .map((artifact) => `foundation:${artifact.id}`),
    ...project.build.world.visualArtifacts
      .filter((artifact) => (
        artifact.reviewState === "accepted"
        && worldAccepted.has(artifact.id)
        && matchesTarget(artifact.sourceDecisionKeys)
      ))
      .map((artifact) => `world:${artifact.id}`),
  ].sort();
}

export function storyboardAnchorEvidence(
  project: PPFProject,
  targetId: string,
  miniBlockNumber: number,
): StoryboardAnchorEvidenceProjection {
  const blockNumber = targetBlockNumber(targetId);
  const evidence = normalizeProjectSourceEvidence(
    (project as PPFProject & { readonly sourceEvidence?: unknown }).sourceEvidence,
  );
  const passages = blockNumber
    ? storyboardSourceEvidenceForAnchor(project, targetId, miniBlockNumber)
    : [];
  const matrixBlock = blockNumber
    ? evidence.storyMatrix?.blocks.find((block) => block.blockNumber === blockNumber) ?? null
    : null;
  const sourceSections = blockNumber
    ? (evidence.storyMatrix?.sourceSections ?? [])
      .filter((section) => section.projectedBlockNumber === blockNumber)
      .map((section) => ({
        id: section.id,
        title: section.title,
        page: section.page,
        mappingMethod: section.mappingMethod,
      }))
    : [];
  return {
    anchorRef: storyboardAnchorTargetRef(targetId, miniBlockNumber),
    blockNumber,
    miniBlockNumber,
    sourceFileName: evidence.screenplay?.sourceFileName ?? "",
    passages,
    blockTitle: matrixBlock?.title ?? "",
    responsibility: matrixBlock?.responsibility ?? "",
    structuralFinding: matrixBlock?.structuralFinding.state ?? "unresolved",
    structuralReviewNote: matrixBlock?.structuralFinding.reason ?? "",
    sourceMappings: (matrixBlock?.sourceMappings ?? []).map((mapping) => ({
      sourceVersion: mapping.sourceVersion,
      sourceRole: mapping.sourceRole,
      mappingMethod: mapping.mappingMethod,
      sourceRef: mapping.sourceRef,
      candidateOnly: mapping.candidateOnly,
    })),
    sourceSections,
    characterEvidenceRefs: matrixBlock?.characterEvidenceRefs ?? [],
    acceptedVisualRefs: blockNumber
      ? acceptedTargetScopedVisualIds(project, targetId, miniBlockNumber)
      : [],
  };
}

function isAfterglowReferenceProject(project: PPFProject) {
  const evidence = normalizeProjectSourceEvidence(
    (project as PPFProject & { readonly sourceEvidence?: unknown }).sourceEvidence,
  );
  return evidence.referenceFixture?.fixtureId === AFTERGLOW_V9_FOUNDATIONS_FIXTURE_ID
    || evidence.referenceFixture?.sourceId === AFTERGLOW_V9_REFERENCE_SOURCE_ID;
}

export function storyboardFrameDependencySourceKey(
  project: PPFProject,
  targetId: string,
  miniBlockNumber: number,
) {
  const target = deriveVisualReadiness({ project }).targets.find((candidate) => candidate.id === targetId);
  const blockNumber = targetBlockNumber(targetId);
  const structure = (project as PPFProject & {
    readonly structure?: {
      readonly blocks?: readonly {
        readonly number?: number;
        readonly title?: string;
        readonly note?: string;
        readonly miniBlocks?: readonly {
          readonly ordinal?: number;
          readonly title?: string;
          readonly note?: string;
        }[];
      }[];
    };
    readonly writing?: unknown;
  }).structure;
  const block = structure?.blocks?.find((candidate) => candidate.number === blockNumber) ?? null;
  const mini = block?.miniBlocks?.find((candidate) => candidate.ordinal === miniBlockNumber) ?? null;
  const writing = normalizeBlockWritingState(
    (project as PPFProject & { readonly writing?: unknown }).writing,
  );
  const workingText = writing.entries.find((entry) => (
    entry.blockNumber === blockNumber && entry.miniBlockNumber === miniBlockNumber
  ))?.text ?? "";
  const snapshot = JSON.stringify({
    targetId,
    miniBlockNumber,
    state: target?.state ?? "missing",
    storyboardAllowed: target?.storyboardAllowed ?? false,
    provenance: (target?.provenance ?? []).map((item) => `${item.source}:${item.ref}`).sort(),
    planningContent: {
      blockTitle: block?.title ?? "",
      blockNote: block?.note ?? "",
      miniTitle: mini?.title ?? "",
      miniNote: mini?.note ?? "",
    },
    workingText,
    sourceEvidence: storyboardSourceEvidenceForAnchor(project, targetId, miniBlockNumber),
    scopedAcceptedVisuals: acceptedTargetScopedVisualIds(project, targetId, miniBlockNumber),
  });
  const checksum = Array.from(snapshot).reduce(
    (value, character, index) => (((value * 33) ^ character.charCodeAt(0) ^ index) >>> 0),
    5381,
  ).toString(36);
  return `${STORYBOARD_UPSTREAM_V2_PREFIX}${storyboardAnchorTargetRef(targetId, miniBlockNumber)}:${checksum}`;
}

export function storyboardArtifactStaleReasons(
  project: PPFProject,
  targetId: string,
  miniBlockNumber: number,
  artifact: FoundationsVisualArtifact | null,
) {
  if (!artifact) return [];
  const anchorRef = storyboardAnchorTargetRef(targetId, miniBlockNumber);
  const keys = artifact.sourceDecisionKeys ?? [];
  const staleMarker = keys.find((key) => key.startsWith(`${STORYBOARD_STALE_PREFIX}${anchorRef}:revision-`));
  if (staleMarker) {
    return [`Upstream story content changed for ${anchorRef}. Review this kept visual anchor before carrying it forward.`];
  }

  const v2Prefix = `${STORYBOARD_UPSTREAM_V2_PREFIX}${anchorRef}:`;
  const recordedV2 = keys.find((key) => key.startsWith(v2Prefix));
  if (recordedV2) {
    const current = storyboardFrameDependencySourceKey(project, targetId, miniBlockNumber);
    return recordedV2 === current
      ? []
      : [`Upstream story or visual identity evidence changed for ${anchorRef}. Review this kept visual anchor before carrying it forward.`];
  }

  const legacyPrefix = `${STORYBOARD_UPSTREAM_PREFIX}${anchorRef}:`;
  if (keys.some((key) => key.startsWith(legacyPrefix))) return [];
  return [];
}

function acceptedArtifactForSource(
  project: PPFProject,
  targetId: string,
  miniBlockNumber: number,
  sourceRef: string,
) {
  const accepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
  return project.build.foundations.visualArtifacts.find((artifact) => (
    accepted.has(artifact.id)
    && artifact.reviewState === "accepted"
    && artifactTargetsFrame(artifact, targetId, miniBlockNumber)
    && (artifact.sourceDecisionKeys ?? []).includes(observedReferenceSourceKey(sourceRef))
  )) ?? null;
}

export function storyboardReferenceCandidates(project: PPFProject, targetId: string): readonly StoryboardEditorialCandidate[] {
  if (!isAfterglowReferenceProject(project)) return [];
  const blockNumber = targetBlockNumber(targetId);
  if (!blockNumber) return [];

  return createAfterglowStoryboardFrames(blockNumber).map((frame) => {
    const acceptedArtifact = acceptedArtifactForSource(project, targetId, frame.miniBlockNumber, frame.id);
    const anchorEvidence = storyboardAnchorEvidence(project, targetId, frame.miniBlockNumber);
    const sourceKind = blockNumber <= afterglowStoryboardCoverage.sourceBlocks
      ? "historical-storyboard" as const
      : "replacement-concept" as const;
    return {
      id: frame.id,
      targetId,
      miniBlockNumber: frame.miniBlockNumber,
      label: `Mini-block ${blockNumber}.${frame.miniBlockNumber}`,
      caption: frame.caption || frame.alt,
      assetUrl: frame.src,
      sourceRef: frame.id,
      sourceKind,
      provenanceRefs: [
        frame.id,
        ...anchorEvidence.passages.map((passage) => passage.id),
        ...anchorEvidence.sourceMappings.map((mapping) => mapping.sourceRef),
        ...anchorEvidence.sourceSections.map((section) => section.id),
      ].filter((value, index, all) => all.indexOf(value) === index),
      acceptedArtifactId: acceptedArtifact?.id ?? null,
    };
  });
}

export function currentStoryboardArtifactForFrame(
  project: PPFProject,
  targetId: string,
  miniBlockNumber: number,
) {
  const accepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
  return project.build.foundations.visualArtifacts.find((artifact) => (
    accepted.has(artifact.id)
    && artifact.reviewState === "accepted"
    && artifactTargetsFrame(artifact, targetId, miniBlockNumber)
  )) ?? null;
}

export function createStoryboardReferenceArtifact(input: {
  readonly project: PPFProject;
  readonly targetId: string;
  readonly candidate: StoryboardEditorialCandidate;
  readonly occurredAt: string;
  readonly approvalAuthority?: StoryboardApprovalAuthority;
}): FoundationsVisualArtifact {
  const current = currentStoryboardArtifactForFrame(
    input.project,
    input.targetId,
    input.candidate.miniBlockNumber,
  );
  const anchorRef = storyboardAnchorTargetRef(input.targetId, input.candidate.miniBlockNumber);
  const approval = approvalDescription(input.approvalAuthority);
  return {
    id: `storyboard-${input.candidate.id}-${input.project.revision + 1}`,
    assetUrl: input.candidate.assetUrl,
    prompt: `Adopt the bundled observed Storyboard reference ${input.candidate.sourceRef} for ${anchorRef}. This ${approval} approves the current preferred visual projection for the anchor only; it does not rewrite story canon or prohibit later variations.`,
    createdAt: input.occurredAt,
    provider: "bundled-reference",
    model: "",
    frameNumber: input.candidate.miniBlockNumber,
    narrativeIntention: input.candidate.caption,
    sourceDecisionKeys: [
      storyboardTargetSourceKey(input.targetId),
      anchorRef,
      storyboardFrameDependencySourceKey(input.project, input.targetId, input.candidate.miniBlockNumber),
      observedReferenceSourceKey(input.candidate.sourceRef),
      `storyboard-source-kind:${input.candidate.sourceKind}`,
      `ppf-revision:${input.project.revision}`,
      ...approvalSourceKeys(input.approvalAuthority),
      ...input.candidate.provenanceRefs
        .slice(0, 32)
        .map((ref) => approvalValue(ref, 200))
        .filter(Boolean)
        .map((ref) => `storyboard-evidence:${ref}`),
    ],
    workflow: STORYBOARD_REFERENCE_WORKFLOW,
    reviewState: "draft",
    parentArtifactId: current?.id ?? null,
  };
}
