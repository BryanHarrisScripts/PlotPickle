import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import {
  assembleFoundationsBrief,
  buildFoundationPlanLessons,
  isUsableFoundationAnswer,
} from "../../../core/contracts/foundation-plan";
import type { PPFProject } from "../../../core/project/project";

export const FOUNDATIONS_WIREFRAME_FRONTIER = "Foundations" as const;
export const FOUNDATIONS_WIREFRAME_WORKFLOW = "foundations-visual-narrative-wireframe-v1" as const;
export const MAX_FOUNDATIONS_WIREFRAME_FRAMES = 25;

export interface FoundationsWireframeFramePlan {
  readonly frameNumber: number;
  readonly narrativeIntention: string;
  readonly sourceDecisionKeys: readonly string[];
  readonly prompt: string;
}

type AcceptedDecision = {
  readonly key: string;
  readonly prompt: string;
  readonly value: string;
};

function acceptedDecisions(project: PPFProject, curriculum: readonly CurriculumLesson[]): readonly AcceptedDecision[] {
  const lessons = buildFoundationPlanLessons(curriculum);
  return lessons.flatMap((lesson) => {
    const saved = project.foundations.lessons[lesson.id]?.answers ?? {};
    return lesson.fields.flatMap((field) => {
      const value = saved[field.id]?.trim() ?? "";
      if (!isUsableFoundationAnswer(value)) return [];
      return [{
        key: `${lesson.id}:${field.id}`,
        prompt: field.prompt.replace(/\s+/g, " ").trim(),
        value,
      }];
    });
  });
}

function shortIntention(decision: AcceptedDecision) {
  const prompt = decision.prompt.replace(/[?.!]+$/, "");
  const value = decision.value.replace(/\s+/g, " ").trim();
  return `${prompt}: ${value}`.slice(0, 220);
}

function framePrompt(input: {
  readonly project: PPFProject;
  readonly brief: string;
  readonly frameNumber: number;
  readonly intention: string;
  readonly decisions: readonly AcceptedDecision[];
}) {
  const decisionText = input.decisions
    .map((decision) => `- ${decision.prompt}: ${decision.value}`)
    .join("\n");
  return [
    `Create frame ${input.frameNumber} of a rough Visual Narrative Wireframe for “${input.project.title}”.`,
    "This is a low-resolution exploratory sketch, not final storyboard, Previs, or story canon. Favor readable composition, mood, pressure, spatial orientation, and emotional direction over polish.",
    "Use only the accepted Foundations decisions supplied below. Do not invent named locations, character backstory, world rules, future plot beats, dialogue, captions, typography, logos, or information from World/Character/Theme/Structure or later curriculum groups.",
    `FRAME INTENTION: ${input.intention}`,
    "SOURCE ACCEPTED FOUNDATIONS DECISIONS:",
    decisionText,
    "FOUNDATIONS BRIEF FOR CONTEXT:",
    input.brief,
  ].join("\n\n").slice(0, 30_000);
}

/**
 * Derive a bounded wireframe plan from accepted Foundations answers only.
 * One orientation frame is followed by at most one frame per real saved decision.
 * The planner never pads to a target count and never reads future curriculum state.
 */
export function buildFoundationsWireframePlan(
  project: PPFProject,
  curriculum: readonly CurriculumLesson[],
): readonly FoundationsWireframeFramePlan[] {
  const decisions = acceptedDecisions(project, curriculum);
  if (!decisions.length) return [];

  const lessons = buildFoundationPlanLessons(curriculum);
  const brief = project.foundations.brief.content.trim() || assembleFoundationsBrief({
    projectTitle: project.title,
    lessons,
    state: project.foundations,
  });
  const selected = decisions.slice(0, MAX_FOUNDATIONS_WIREFRAME_FRAMES - 1);
  const orientationSources = decisions.slice(0, Math.min(4, decisions.length));
  const plans: FoundationsWireframeFramePlan[] = [];

  const orientationIntention = `Opening orientation — establish the accepted dramatic promise, tone, pressure, and audience experience for ${project.title}.`;
  plans.push({
    frameNumber: 1,
    narrativeIntention: orientationIntention,
    sourceDecisionKeys: orientationSources.map((decision) => decision.key),
    prompt: framePrompt({
      project,
      brief,
      frameNumber: 1,
      intention: orientationIntention,
      decisions: orientationSources,
    }),
  });

  selected.forEach((decision, index) => {
    const frameNumber = index + 2;
    const intention = shortIntention(decision);
    plans.push({
      frameNumber,
      narrativeIntention: intention,
      sourceDecisionKeys: [decision.key],
      prompt: framePrompt({ project, brief, frameNumber, intention, decisions: [decision] }),
    });
  });

  return plans.slice(0, MAX_FOUNDATIONS_WIREFRAME_FRAMES);
}
