import type { PrevisGraphicNovelTextApproval } from "@/core/contracts/previs";
import type { FoundationsVisualArtifact } from "@/core/contracts/build-progress";
import type { PPFProject } from "@/core/project/project";
import { storyboardPassageWindowForPosition, type StoryboardPlanningPassage } from "../storyboard/storyboard-editorial-model";

export const PREVIS_FLIP_BOOK_INTERVAL_MS = 900;
export const PREVIS_GRAPHIC_NOVEL_INTERVAL_MS = 3000;

export type PrevisGraphicNovelBubble = Readonly<{
  speaker: string;
  text: string;
  style: "speech";
}>;

export type PrevisGraphicNovelPanelInput = Readonly<{
  position: number;
  assetUrl: string;
  authoritative: boolean;
  narrativeIntention: string;
  sceneNumbers: readonly string[];
  beatLabel: string;
  beatDirection: string;
  shotLabel: string;
  shotContext: string;
  passages: readonly StoryboardPlanningPassage[];
}>;

export type PrevisGraphicNovelPanel = Readonly<{
  position: number;
  assetUrl: string;
  authoritative: boolean;
  sceneLabel: string;
  beatLabel: string;
  caption: string;
  narration: string;
  shotLabel: string;
  shotContext: string;
  bubbles: readonly PrevisGraphicNovelBubble[];
}>;

function clean(value: string, maximum = 420) {
  const normalized = value.replace(/\s+/gu, " ").trim();
  if (normalized.length <= maximum) return normalized;
  return normalized.slice(0, Math.max(0, maximum - 1)).trimEnd() + "…";
}

function speakerName(value: string) {
  return clean(value.replace(/\s*\([^)]*\)\s*$/u, ""), 80);
}

export function graphicNovelSpeechBubbles(
  passages: readonly StoryboardPlanningPassage[],
  position: number,
): readonly PrevisGraphicNovelBubble[] {
  const evidence = storyboardPassageWindowForPosition(passages, position);
  const evidenceIds = new Set(evidence.map((passage) => passage.id));
  const bubbles: PrevisGraphicNovelBubble[] = [];

  for (let index = 0; index < passages.length; index += 1) {
    const passage = passages[index];
    const type = passage.type.toLocaleLowerCase();
    if ((type !== "dialogue" && type !== "dual-dialogue") || !evidenceIds.has(passage.id)) continue;

    let speaker = "";
    for (let previousIndex = index - 1; previousIndex >= 0; previousIndex -= 1) {
      const previous = passages[previousIndex];
      const previousType = previous.type.toLocaleLowerCase();
      if (previousType === "parenthetical") continue;
      if (previousType === "character") {
        speaker = speakerName(previous.text);
        break;
      }
      if (previousType === "action" || previousType === "scene-heading" || previousType === "transition") break;
    }

    const text = clean(passage.text, 180);
    if (speaker && text) bubbles.push({ speaker, text, style: "speech" });
    if (bubbles.length >= 2) break;
  }

  return bubbles;
}

export function buildPrevisGraphicNovelPanel(input: PrevisGraphicNovelPanelInput): PrevisGraphicNovelPanel {
  const sceneLabel = input.sceneNumbers.length
    ? input.sceneNumbers.map((number) => `Scene ${number}`).join(" · ")
    : "Scene not mapped";
  const beatLabel = clean(input.beatLabel, 100) || `Position ${String(input.position).padStart(2, "0")}`;
  const narrativeIntention = clean(input.narrativeIntention);
  const beatDirection = clean(input.beatDirection);
  const shotContext = clean(input.shotContext);

  const narration = input.authoritative
    ? narrativeIntention || beatDirection || shotContext || "Story detail is still emerging from the approved visual sequence."
    : "This position is not Keep / Locked and is excluded from the authoritative Graphic Novel.";

  return {
    position: input.position,
    assetUrl: input.authoritative ? input.assetUrl : "",
    authoritative: input.authoritative,
    sceneLabel,
    beatLabel,
    caption: `${sceneLabel} · ${beatLabel}`,
    narration,
    shotLabel: clean(input.shotLabel, 140) || "Shot intent open",
    shotContext,
    bubbles: input.authoritative ? graphicNovelSpeechBubbles(input.passages, input.position) : [],
  };
}

export function graphicNovelWebpExportFileName(projectTitle: string, blockNumber: number, miniBlockNumber: number) {
  const slug = projectTitle.toLowerCase().trim().replace(/[^a-z0-9]+/gu, "-").replace(/^-+|-+$/gu, "") || "plotpickle";
  return `${slug}-previs-graphic-novel-${String(blockNumber).padStart(2, "0")}-${miniBlockNumber}.webp`;
}


/**
 * PP-NARR-001 B6: one projection of the actual PPF project authority for
 * Storyboard AND Previs. Do not use a UI-only shot projection as authority:
 * Previs has no legacy-project reference and must derive the same source key.
 *
 * Entire scoped production records are included intentionally: a newly
 * authored camera, blocking, lighting, timing, or continuity property must
 * invalidate old Bubble text even if a renderer does not yet display it.
 */
function normalizedBubbleStoryFacts(value: unknown): unknown {
  if (typeof value === "string") return value.trim() || null;
  if (Array.isArray(value)) {
    const values = value.map(normalizedBubbleStoryFacts).filter((item) => item !== null);
    return values.length ? values : null;
  }
  if (value && typeof value === "object") {
    const normalized = Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !["createdAt", "updatedAt", "reviewState", "roughMotionEvidenceRefs"].includes(key))
      .sort(([left], [right]) => left.localeCompare(right))
      .flatMap(([key, item]) => {
        const next = normalizedBubbleStoryFacts(item);
        return next === null ? [] : [[key, next] as const];
      });
    return normalized.length ? Object.fromEntries(normalized) : null;
  }
  return value === undefined ? null : value;
}

export function graphicNovelTextSourceSnapshot(
  project: PPFProject,
  anchorRef: string,
  position: number,
  artifact: FoundationsVisualArtifact | null,
) {
  return {
    projectId: project.id,
    anchorRef,
    position,
    image: artifact ? {
      id: artifact.id,
      assetUrl: artifact.assetUrl,
      workflow: artifact.workflow ?? "",
      reviewState: artifact.reviewState ?? "",
      frameNumber: artifact.frameNumber ?? null,
      narrativeIntention: artifact.narrativeIntention ?? "",
      savedAndLocked: project.build.foundations.acceptedVisualArtifactIds.includes(artifact.id),
    } : null,
    authoredShots: project.production.shots
      .filter((shot) => shot.anchorRef === anchorRef && shot.order === position)
      .slice()
      .sort((left, right) => left.id.localeCompare(right.id))
      .map((shot) => normalizedBubbleStoryFacts(shot)),
  };
}

/**
 * Compact *change-detection* fingerprint, not a cryptographic identity or
 * authorization token. Each independent 32-bit mixing lane contributes to
 * a 128-bit deterministic result. No source text is stored in the key.
 */
function bubbleSourceDigest(value: unknown): string {
  const serialized = JSON.stringify(value) ?? "null";
  const lanes = [0x811c9dc5, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f];
  const primes = [0x01000193, 0x1b3, 0x5bd1e995, 0x27d4eb2d];
  for (let index = 0; index < serialized.length; index += 1) {
    const unit = serialized.charCodeAt(index);
    for (let lane = 0; lane < lanes.length; lane += 1) {
      lanes[lane] = Math.imul(lanes[lane] ^ unit, primes[lane]);
    }
  }
  return lanes.map((value) => (value >>> 0).toString(16).padStart(8, "0")).join("");
}

/**
 * PP-NARR-001 B6: bounded source identity must survive encrypted PPF storage
 * whose sourceKey limit is 4,000 characters. Splitting the digests by input
 * authority allows bounded diagnostics without leaking the story or image.
 */
export function graphicNovelTextSourceKey(
  panel: PrevisGraphicNovelPanel,
  passages: unknown,
  storyContext: unknown,
  sourceSnapshot?: ReturnType<typeof graphicNovelTextSourceSnapshot>,
) {
  return JSON.stringify({
    contract: "PP-NARR-001/B6-v3",
    fingerprints: {
      address: bubbleSourceDigest({
        projectId: sourceSnapshot?.projectId ?? "",
        anchorRef: sourceSnapshot?.anchorRef ?? "",
        position: sourceSnapshot?.position ?? panel.position,
      }),
      image: bubbleSourceDigest(sourceSnapshot?.image ?? null),
      shot: bubbleSourceDigest(sourceSnapshot?.authoredShots ?? []),
      screenplay: bubbleSourceDigest(passages),
      context: bubbleSourceDigest(storyContext),
      presentation: bubbleSourceDigest({
        assetUrl: panel.assetUrl,
        caption: panel.caption,
        narration: panel.narration,
        shotLabel: panel.shotLabel,
        shotContext: panel.shotContext,
        bubbles: panel.bubbles.map((bubble) => ({ speaker: bubble.speaker, text: bubble.text })),
      }),
    },
  });
}

/** Labels only: do not place Human screenplay, Shot contents or URLs in diagnostics. */
export function graphicNovelTextStaleReasons(savedKey: string, currentKey: string): string[] {
  try {
    const saved = JSON.parse(savedKey) as {
      contract?: string;
      fingerprints?: Record<string, string>;
    };
    const current = JSON.parse(currentKey) as {
      contract?: string;
      fingerprints?: Record<string, string>;
    };
    const reasons: string[] = [];
    if (saved.contract !== current.contract) reasons.push("contract version");
    if (saved.fingerprints?.address !== current.fingerprints?.address) reasons.push("story address");
    if (saved.fingerprints?.image !== current.fingerprints?.image) reasons.push("image identity");
    if (saved.fingerprints?.shot !== current.fingerprints?.shot) reasons.push("authored Shot facts");
    if (saved.fingerprints?.screenplay !== current.fingerprints?.screenplay) reasons.push("screenplay evidence");
    if (saved.fingerprints?.context !== current.fingerprints?.context) reasons.push("story context");
    if (saved.fingerprints?.presentation !== current.fingerprints?.presentation) reasons.push("presentation source");
    return reasons.length ? reasons : ["other source identity"];
  } catch {
    return ["unreadable source identity"];
  }
}

export function approvedGraphicNovelPanel(
  panel: PrevisGraphicNovelPanel,
  approval: PrevisGraphicNovelTextApproval,
): PrevisGraphicNovelPanel {
  if (approval.noText) {
    return { ...panel, caption: "", narration: "", shotLabel: "", shotContext: "", bubbles: [] };
  }
  return {
    ...panel,
    caption: "",
    shotLabel: "",
    shotContext: "",
    narration: approval.narration,
    bubbles: approval.bubbles.map((bubble) => ({ ...bubble, style: "speech" as const })),
  };
}
