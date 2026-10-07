import type { PrevisGraphicNovelTextApproval, TimelineMotionShot } from "@/core/contracts/previs";
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


export function graphicNovelTextSourceKey(
  panel: PrevisGraphicNovelPanel,
  passages: unknown,
  storyContext: unknown,
) {
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


export function currentGraphicNovelMotion(
  motions: readonly TimelineMotionShot[],
  anchorRef: string,
  position: number,
  sourceArtifactId: string,
): TimelineMotionShot | null {
  if (!anchorRef || !sourceArtifactId) return null;
  return motions
    .filter((motion) => (
      motion.anchorRef === anchorRef
      && motion.shotNumber === position
      && motion.sourceArtifactId === sourceArtifactId
      && motion.status === "succeeded"
      && Boolean(motion.outputAssetUrl)
    ))
    .sort((left, right) => (
      right.updatedAt.localeCompare(left.updatedAt)
      || right.createdAt.localeCompare(left.createdAt)
    ))[0] ?? null;
}
