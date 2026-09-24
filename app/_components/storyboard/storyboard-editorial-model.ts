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
  previousShot?: string;
  nextShot?: string;
  storyFunction?: string;
  visibleChange?: string;
  characterTruth?: string;
  identityMode?: "approved-reference" | "exploratory" | "not-applicable";
  continuityIn?: string;
  continuityOut?: string;
}>;

export type StoryboardPositionProgression = Readonly<{
  position: number;
  label: string;
  direction: string;
}>;

const STORYBOARD_POSITION_PROGRESSION: readonly StoryboardPositionProgression[] = [
  { position: 1, label: "Entry boundary", direction: "Establish the approved Mini-Block starting state clearly before new movement develops." },
  { position: 2, label: "Geography", direction: "Clarify the supported spatial relationship between characters, objects and environment." },
  { position: 3, label: "Subject relationship", direction: "Make the central supported character or object relationship visually legible." },
  { position: 4, label: "Story detail", direction: "Isolate a supported prop, expression, environmental clue or physical detail that matters." },
  { position: 5, label: "Directional shift", direction: "Show the next supported change in attention, intention or movement without inventing an event." },
  { position: 6, label: "Response", direction: "Show the supported reaction or physical response that follows the established state." },
  { position: 7, label: "Forward movement", direction: "Clarify supported movement through the space or toward the current objective." },
  { position: 8, label: "Resistance", direction: "Emphasize the supported obstacle, friction or counterforce already present in the story evidence." },
  { position: 9, label: "Compression", direction: "Increase visual pressure through supported staging, proximity or framing rather than new plot." },
  { position: 10, label: "Setup pressure", direction: "Emphasize a supported setup, risk or unresolved condition that carries forward." },
  { position: 11, label: "Reorientation", direction: "Re-establish geography, eyelines or power relationships after the preceding supported change." },
  { position: 12, label: "Pressure", direction: "Increase visual emphasis on the supported source of tension without exaggerating the story." },
  { position: 13, label: "Reaction under pressure", direction: "Capture the supported human or physical response with restrained readable performance." },
  { position: 14, label: "Discovery emphasis", direction: "Make an existing reveal, recognition or important piece of information visually clear." },
  { position: 15, label: "Turn coverage", direction: "Emphasize the supported change of direction, meaning or control at this point in the sequence." },
  { position: 16, label: "Consequence", direction: "Show the visible supported result of the preceding action or turn." },
  { position: 17, label: "Stakes detail", direction: "Isolate what the evidence shows is now at risk, changed or newly important." },
  { position: 18, label: "Intent / strategy", direction: "Clarify the next supported intention, preparation or directional choice." },
  { position: 19, label: "Convergence", direction: "Bring the supported opposing forces, goals or movements into a clearer visual relationship." },
  { position: 20, label: "Crisis pressure", direction: "Frame the strongest supported unresolved pressure before the sequence payoff." },
  { position: 21, label: "Confrontation coverage", direction: "Make the supported central conflict or decisive interaction visually readable." },
  { position: 22, label: "Peak emphasis", direction: "Capture the strongest supported action, realization or emotional peak available in the evidence." },
  { position: 23, label: "Immediate aftermath", direction: "Show the first supported visible state after the peak without skipping continuity." },
  { position: 24, label: "Resolution movement", direction: "Show the supported settling, departure, recovery or emerging new state." },
  { position: 25, label: "Exit boundary", direction: "Establish the approved Mini-Block ending state and a clean visual handoff to what follows." },
];

export function storyboardPositionProgression(position: number) {
  const item = STORYBOARD_POSITION_PROGRESSION.find((candidate) => candidate.position === position);
  if (!item) throw new RangeError("Storyboard position must be between 1 and 25.");
  return item;
}

export function storyboardFramePrompt(input: StoryboardFramePromptInput) {
  const clean = (value: string) => value.trim().replace(/\s+/g, " ").slice(0, 1200);
  const progression = storyboardPositionProgression(input.position);
  return [
    `Create one standalone cinematic storyboard frame for ${clean(input.title) || "this story"}.`,
    `Production address: Block ${String(input.blockNumber).padStart(2, "0")}, Mini-Block ${input.miniBlockNumber}, Storyboard Position ${String(input.position).padStart(2, "0")}.`,
    `Visual progression function: ${progression.label}. ${progression.direction} This is a visual coverage function, not a Beat assignment; never invent unsupported story events to satisfy it.`,
    input.storyFunction ? `Frame-brief story function: ${clean(input.storyFunction)}` : "",
    input.visibleChange ? `Required visible progression: ${clean(input.visibleChange)}` : "",
    input.scene ? `Observed scene: ${clean(input.scene)}.` : "No scene is mapped here; do not invent a scene.",
    input.beat ? `Authored beat evidence: ${clean(input.beat)}.` : "No beat is authored here; do not invent a beat.",
    input.shot ? `Authored shot evidence takes precedence: ${clean(input.shot)}.` : "No shot is authored here; treat this as exploratory Shot / Frame coverage only.",
    input.characterTruth ? `Canonical character truth for characters actually present in this frame: ${clean(input.characterTruth)}.` : "",
    input.identityMode === "approved-reference"
      ? "Character identity mode: locked approved character visual references are attached to this request and are identity authority."
      : input.identityMode === "exploratory"
        ? "Character identity mode: no locked approved character visual reference is available for one or more present characters; keep identity exploratory and do not imply visual canon."
        : "",
    input.previousShot ? `Continuity-in from the previous authored shot: ${clean(input.previousShot)}.` : input.continuityIn ? `Continuity-in: ${clean(input.continuityIn)}` : input.position === 1 ? "Continuity-in: establish the Mini-Block entry boundary from approved story evidence." : "Continuity-in: preserve the established state from earlier approved Storyboard positions.",
    input.nextShot ? `Next-shot handoff target: ${clean(input.nextShot)}.` : input.continuityOut ? `Continuity-out: ${clean(input.continuityOut)}` : input.position === 25 ? "Continuity-out: establish a stable Mini-Block exit boundary that can hand off to the next story address." : "Continuity-out: end on a clear state that the next selected Storyboard position can continue.",
    input.source ? `Position-specific screenplay evidence: ${clean(input.source)}.` : "No screenplay passage is mapped here; use only the available story context.",
    "Direct the camera physically: choose a plausible camera position, height, distance, viewing direction and shot size that best reveals the supported action. Prefer concrete staging, eyelines, foreground/background relationships and readable silhouette over vague cinematic adjectives.",
    "Make this position visibly distinct from neighboring positions through a supported change in action, reaction, distance, angle, composition or dramatic emphasis while preserving causal continuity.",
    "Continuity lock: preserve established character identity, age, face, hair, wardrobe, props, injuries, location geography, screen direction, time of day, lighting logic and visual language unless the supplied story evidence explicitly changes them.",
    "Output one clean black-and-white storyboard illustration in landscape composition. No collage, contact sheet, storyboard grid, split screen, multiple panels, poster layout, dialogue text, captions, logos or watermarks.",
    "Create one WebP visual candidate only. Generation does not create or approve a canonical Scene, Beat, Shot or Frame.",
  ].filter(Boolean).join(" ");
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

export type StoryboardGenerationScope = "single" | "group5" | "all25";

export type StoryboardPlanningPassage = Readonly<{
  id: string;
  type: string;
  text: string;
}>;

export type StoryboardCharacterGrounding = Readonly<{
  id: string;
  name: string;
  aliases?: readonly string[];
  pronouns: string;
  role: string;
  description: string;
  truthClaims: readonly string[];
  approvedVisualRefs: readonly string[];
  identityLock: Readonly<{
    characterId: string;
    status: string;
    version: number;
    approvedPrompt: string;
  }> | null;
}>;

export type StoryboardFrameBrief = Readonly<{
  position: number;
  storyFunction: string;
  visibleChange: string;
  evidence: readonly StoryboardPlanningPassage[];
  evidenceSummary: string;
  characters: readonly StoryboardCharacterGrounding[];
  characterTruth: string;
  approvedVisualRefs: readonly string[];
  identityLocks: readonly NonNullable<StoryboardCharacterGrounding["identityLock"]>[];
  identityMode: "approved-reference" | "exploratory" | "not-applicable";
  continuityIn: string;
  continuityOut: string;
}>;

const POSITION_STORY_FUNCTIONS = [
  "Establish the Mini-Block entry state and the first supported visual fact.",
  "Clarify the geography around the opening state.",
  "Clarify the central subject relationship present in the opening evidence.",
  "Isolate a supported story detail that gives the opening state meaning.",
  "Show the first supported shift in attention, intention, or physical state.",
  "Show the reaction caused by the preceding supported shift.",
  "Advance to the next supported action or story condition.",
  "Make the current obstacle, friction, or emotional resistance legible.",
  "Tighten visual pressure through staging, distance, or emphasis.",
  "Hold the unresolved setup that must carry into the next movement.",
  "Reorient the audience after the preceding change using supported geography or eyelines.",
  "Advance the next supported source event or emotional pressure.",
  "Show the human or physical reaction to that pressure.",
  "Emphasize a supported discovery, object, expression, or environmental clue.",
  "Cover the supported turn or change in meaning near the middle of the sequence.",
  "Show the immediate consequence of the supported turn.",
  "Isolate the supported detail that makes the stakes or emotional cost readable.",
  "Show the subject's supported intention, strategy, or next physical choice.",
  "Bring supported characters, objects, or story pressures into stronger visual relationship.",
  "Hold the strongest supported crisis pressure available in this Mini-Block evidence.",
  "Cover the principal supported confrontation, decision, or emotional collision.",
  "Give the strongest supported image or reaction its clearest visual emphasis.",
  "Show the immediate aftermath created by the preceding supported moment.",
  "Move the sequence toward its supported resolved state without inventing closure.",
  "Establish the Mini-Block exit boundary and a stable visual handoff to the next story address.",
] as const;

function boundedPosition(value: number) {
  return Math.min(25, Math.max(1, Math.trunc(Number(value) || 1)));
}

export function storyboardPositionsForScope(
  selectedPosition: number,
  scope: StoryboardGenerationScope,
): readonly number[] {
  const selected = boundedPosition(selectedPosition);
  if (scope === "single") return [selected];
  if (scope === "all25") return Array.from({ length: 25 }, (_, index) => index + 1);
  const start = Math.floor((selected - 1) / 5) * 5 + 1;
  return Array.from({ length: 5 }, (_, index) => start + index);
}

function passageWindow(
  passages: readonly StoryboardPlanningPassage[],
  position: number,
) {
  if (!passages.length) return [];
  const start = Math.min(
    passages.length - 1,
    Math.floor(((position - 1) * passages.length) / 25),
  );
  const proportionalEnd = Math.ceil((position * passages.length) / 25);
  const end = Math.min(passages.length, Math.max(start + 1, proportionalEnd));
  return passages.slice(start, end);
}

function clean(value: string, limit = 700) {
  return value.replace(/\s+/gu, " ").trim().slice(0, limit);
}

function mentionsCharacter(
  text: string,
  character: StoryboardCharacterGrounding,
) {
  const candidates = [character.name, ...(character.aliases ?? [])]
    .map((value) => value.trim())
    .filter(Boolean);
  return candidates.some((name) => {
    const escaped = name.replace(/[.*+?^$()|[\]\\]/gu, "\\$&");
    return new RegExp("\\b" + escaped + "\\b", "iu").test(text);
  });
}

function characterTruthLine(character: StoryboardCharacterGrounding) {
  return [
    character.name,
    character.pronouns ? "pronouns " + character.pronouns : "",
    character.role ? "role " + character.role : "",
    character.description,
    ...character.truthClaims.slice(0, 3),
  ].filter(Boolean).map((item) => clean(item, 420)).join("; ");
}

export function storyboardFrameBriefs(input: Readonly<{
  positions: readonly number[];
  passages: readonly StoryboardPlanningPassage[];
  characters?: readonly StoryboardCharacterGrounding[];
}>): readonly StoryboardFrameBrief[] {
  const characters = input.characters ?? [];
  return input.positions.map((rawPosition) => {
    const position = boundedPosition(rawPosition);
    const evidence = passageWindow(input.passages, position);
    const evidenceSummary = evidence.map((passage) => clean(passage.text)).filter(Boolean).join(" | ");
    const matchingCharacters = characters.filter((character) => mentionsCharacter(evidenceSummary, character));
    const approvedVisualRefs = [...new Set(matchingCharacters.flatMap((character) => character.approvedVisualRefs))];
    const identityLocks = matchingCharacters
      .map((character) => character.identityLock)
      .filter((value): value is NonNullable<StoryboardCharacterGrounding["identityLock"]> => Boolean(value));
    const identityMode = matchingCharacters.length === 0
      ? "not-applicable"
      : approvedVisualRefs.length && identityLocks.length
        ? "approved-reference"
        : "exploratory";
    const previousEvidence = passageWindow(input.passages, Math.max(1, position - 1));
    const nextEvidence = passageWindow(input.passages, Math.min(25, position + 1));
    const previousSummary = previousEvidence.map((passage) => clean(passage.text, 260)).join(" | ");
    const nextSummary = nextEvidence.map((passage) => clean(passage.text, 260)).join(" | ");
    return {
      position,
      storyFunction: POSITION_STORY_FUNCTIONS[position - 1],
      visibleChange: evidenceSummary
        ? "Make Position " + String(position).padStart(2, "0") + " visibly advance or reframe only this supported story evidence: " + evidenceSummary
        : "No direct screenplay passage is mapped to this position; use the progression function only to clarify already-established state without inventing an event.",
      evidence,
      evidenceSummary,
      characters: matchingCharacters,
      characterTruth: matchingCharacters.map(characterTruthLine).filter(Boolean).join(" | "),
      approvedVisualRefs,
      identityLocks,
      identityMode,
      continuityIn: position === 1
        ? "Mini-Block entry boundary."
        : previousSummary
          ? "Carry forward the established state from the preceding supported evidence: " + previousSummary
          : "Carry forward the established visual state from the preceding Storyboard position.",
      continuityOut: position === 25
        ? "Mini-Block exit boundary; leave a stable state for the next story address."
        : nextSummary
          ? "End in a state that can hand off to the next supported evidence: " + nextSummary
          : "End in a stable state that the next Storyboard position can continue.",
    };
  });
}
