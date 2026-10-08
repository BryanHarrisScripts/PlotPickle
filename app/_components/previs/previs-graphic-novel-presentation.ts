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
      createdAt: artifact.createdAt,
      workflow: artifact.workflow ?? "",
      reviewState: artifact.reviewState ?? "",
      frameNumber: artifact.frameNumber ?? null,
      narrativeIntention: artifact.narrativeIntention ?? "",
      sourceDecisionKeys: artifact.sourceDecisionKeys ?? [],
      savedAndLocked: project.build.foundations.acceptedVisualArtifactIds.includes(artifact.id),
    } : null,
    authoredShots: project.production.shots
      .filter((shot) => shot.anchorRef === anchorRef && shot.order === position)
      .slice()
      .sort((left, right) => left.id.localeCompare(right.id)),
  };
}

export function graphicNovelTextSourceKey(
  panel: PrevisGraphicNovelPanel,
  passages: unknown,
  storyContext: unknown,
  sourceSnapshot?: ReturnType<typeof graphicNovelTextSourceSnapshot>,
) {
  return JSON.stringify({
    contract: "PP-NARR-001/B6-v2",
    sourceSnapshot: sourceSnapshot ?? null,
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
