import type { FoundationsVisualArtifact, WorldArtifactChangeKind } from "../../../core/contracts/build-progress";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import {
  assembleWorldBrief,
  buildWorldPlanLessons,
  isUsableWorldAnswer,
  worldDecisionKey,
} from "../../../core/contracts/world-plan";
import type { PPFProject } from "../../../core/project/project";

export const WORLD_WIREFRAME_FRONTIER = "Foundations + World" as const;
export const WORLD_WIREFRAME_WORKFLOW = "world-visual-narrative-wireframe-v1" as const;
export const MAX_WORLD_WIREFRAME_CHANGES = 10;

export interface WorldWireframeFramePlan {
  readonly frameNumber: number;
  readonly narrativeIntention: string;
  readonly sourceDecisionKeys: readonly string[];
  readonly worldDecisionKeys: readonly string[];
  readonly retainedFoundationArtifactIds: readonly string[];
  readonly parentArtifactId: string | null;
  readonly changeKind: Extract<WorldArtifactChangeKind, "added" | "revised">;
  readonly prompt: string;
}

type WorldDecision = {
  readonly key: string;
  readonly lessonId: string;
  readonly lessonTitle: string;
  readonly prompt: string;
  readonly value: string;
};

const WORLD_CUES = [
  "location", "place", "setting", "geography", "landscape", "environment", "weather", "climate",
  "culture", "society", "ritual", "institution", "power", "history", "rule", "constraint", "genre",
  "tone", "mood", "technology", "magic", "language", "continuity", "chronology", "world",
] as const;

function acceptedWorldDecisions(project: PPFProject, curriculum: readonly CurriculumLesson[]): readonly WorldDecision[] {
  return buildWorldPlanLessons(curriculum).flatMap((lesson) => {
    const saved = project.world.lessons[lesson.id]?.answers ?? {};
    return lesson.fields.flatMap((field) => {
      const value = saved[field.id]?.trim() ?? "";
      if (!isUsableWorldAnswer(value)) return [];
      return [{
        key: worldDecisionKey(lesson.id, field.id),
        lessonId: lesson.id,
        lessonTitle: lesson.title,
        prompt: field.prompt.replace(/\s+/g, " ").trim(),
        value,
      }];
    });
  });
}

function latestAcceptedFoundationFrames(project: PPFProject) {
  const accepted = new Set(project.build.foundations.acceptedVisualArtifactIds);
  const sorted = project.build.foundations.visualArtifacts
    .filter((artifact) => accepted.has(artifact.id) && artifact.reviewState !== "rejected")
    .slice()
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const byFrame = new Map<number, FoundationsVisualArtifact>();
  for (const artifact of sorted) {
    const frameNumber = artifact.frameNumber ?? 1;
    if (!byFrame.has(frameNumber)) byFrame.set(frameNumber, artifact);
  }
  return [...byFrame.values()].sort((left, right) => (left.frameNumber ?? 1) - (right.frameNumber ?? 1));
}

function cuesFor(decisions: readonly WorldDecision[]) {
  const text = decisions.map((decision) => `${decision.prompt} ${decision.value}`).join(" ").toLowerCase();
  return WORLD_CUES.filter((cue) => text.includes(cue));
}

function affectedFoundationFrame(
  decisions: readonly WorldDecision[],
  foundations: readonly FoundationsVisualArtifact[],
) {
  const cues = cuesFor(decisions);
  if (!cues.length) return null;
  const scored = foundations.map((artifact) => {
    const text = `${artifact.narrativeIntention ?? ""} ${artifact.prompt}`.toLowerCase();
    return {
      artifact,
      score: cues.reduce((total, cue) => total + (text.includes(cue) ? 1 : 0), 0),
    };
  }).filter((candidate) => candidate.score > 0)
    .sort((left, right) => right.score - left.score || (left.artifact.frameNumber ?? 1) - (right.artifact.frameNumber ?? 1));
  return scored[0]?.artifact ?? null;
}

function worldPrompt(input: {
  readonly project: PPFProject;
  readonly brief: string;
  readonly plan: Omit<WorldWireframeFramePlan, "prompt">;
  readonly decisions: readonly WorldDecision[];
  readonly parent: FoundationsVisualArtifact | null;
}) {
  const worldText = input.decisions.map((decision) => `- ${decision.prompt}: ${decision.value}`).join("\n");
  const parentText = input.parent
    ? [
      `PARENT FOUNDATIONS FRAME ${input.parent.frameNumber ?? 1}:`,
      input.parent.narrativeIntention ?? "Accepted Foundations visual",
      `Parent prompt: ${input.parent.prompt}`,
    ].join("\n")
    : "No accepted Foundations frame is being overwritten. This is a new World-oriented wireframe frame.";
  return [
    `Create a rough Visual Narrative Wireframe ${input.plan.changeKind === "revised" ? "revision" : "addition"} for “${input.project.title}”.`,
    `CURRENT FRONTIER: ${WORLD_WIREFRAME_FRONTIER}. This remains a low-resolution exploratory sketch, not final storyboard, Previs, or canon by generation alone.`,
    "Use only the accepted Foundations frame/context supplied below plus the accepted World decisions supplied below. Do not invent Character, Theme, Structure, Drafting, Dialogue, or later-group facts.",
    `CHANGE REASON: ${input.plan.narrativeIntention}`,
    parentText,
    "ACCEPTED WORLD DECISIONS THAT CAUSED THIS CHANGE:",
    worldText,
    "WORLD BRIEF FOR CONTEXT:",
    input.brief,
  ].join("\n\n").slice(0, 30_000);
}

/**
 * World is additive: accepted Foundations frames remain untouched. Each World lesson
 * either branches one materially related Foundations frame or adds one new world-oriented
 * frame. No future curriculum state is read, and no accepted Foundations artifact is deleted.
 */
export function buildWorldWireframePlan(
  project: PPFProject,
  curriculum: readonly CurriculumLesson[],
): readonly WorldWireframeFramePlan[] {
  const foundations = latestAcceptedFoundationFrames(project);
  const decisions = acceptedWorldDecisions(project, curriculum);
  if (!foundations.length || !decisions.length) return [];

  const lessons = buildWorldPlanLessons(curriculum);
  const brief = project.world.brief.content.trim() || assembleWorldBrief({
    projectTitle: project.title,
    lessons,
    state: project.world,
  });
  const retainedFoundationArtifactIds = foundations.map((artifact) => artifact.id);
  let nextFrameNumber = Math.max(...foundations.map((artifact) => artifact.frameNumber ?? 1)) + 1;
  const plans: WorldWireframeFramePlan[] = [];

  for (const lesson of lessons) {
    const lessonDecisions = decisions.filter((decision) => decision.lessonId === lesson.id);
    if (!lessonDecisions.length) continue;
    const parent = affectedFoundationFrame(lessonDecisions, foundations);
    const changeKind = parent ? "revised" as const : "added" as const;
    const frameNumber = parent?.frameNumber ?? nextFrameNumber++;
    const worldDecisionKeys = lessonDecisions.map((decision) => decision.key);
    const sourceDecisionKeys = [
      ...(parent?.sourceDecisionKeys ?? []),
      ...worldDecisionKeys,
    ];
    const narrativeIntention = parent
      ? `${lesson.title} changes frame ${frameNumber}: ${lessonDecisions[0].value.replace(/\s+/g, " ").trim()}`.slice(0, 300)
      : `${lesson.title} adds a World anchor: ${lessonDecisions[0].value.replace(/\s+/g, " ").trim()}`.slice(0, 300);
    const withoutPrompt = {
      frameNumber,
      narrativeIntention,
      sourceDecisionKeys,
      worldDecisionKeys,
      retainedFoundationArtifactIds,
      parentArtifactId: parent?.id ?? null,
      changeKind,
    } satisfies Omit<WorldWireframeFramePlan, "prompt">;
    plans.push({
      ...withoutPrompt,
      prompt: worldPrompt({ project, brief, plan: withoutPrompt, decisions: lessonDecisions, parent }),
    });
  }

  return plans.slice(0, MAX_WORLD_WIREFRAME_CHANGES);
}
