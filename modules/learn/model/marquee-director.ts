import {
  FOUNDATIONS_MARKETING_REFERENCE_FRONTIER,
  FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW,
  marketingReferenceSourceKeys,
  type FoundationsVisualArtifact,
  type MarketingReferenceArtifact,
} from "../../../core/contracts/build-progress";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import type { PPFProject } from "../../../core/project/project";
import { deriveGuidedCreationProgression } from "../../dashboard/guided-progression";

export const MARQUEE_DIRECTOR_ID = "marquee-director" as const;

export interface MarketingContextV1 {
  readonly projectId: string;
  readonly projectTitle: string;
  readonly sourceRevision: number;
  readonly curriculumFrontier: typeof FOUNDATIONS_MARKETING_REFERENCE_FRONTIER;
  readonly foundationsBrief: string;
  readonly decisions: readonly {
    readonly key: string;
    readonly value: string;
  }[];
  readonly acceptedVisualReferences: readonly {
    readonly id: string;
    readonly assetUrl: string;
    readonly intention: string;
  }[];
}

export function isMarqueeDirectorUnlocked(
  curriculum: readonly CurriculumLesson[],
  project: PPFProject,
) {
  return deriveGuidedCreationProgression(curriculum, project).foundations.complete;
}

export function deriveMarketingContextV1(project: PPFProject): MarketingContextV1 {
  const decisions = Object.entries(project.foundations.lessons).flatMap(([lessonId, lesson]) => (
    Object.entries(lesson.answers)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1].trim()))
      .map(([fieldId, value]) => ({
        key: `${lessonId}:${fieldId}`,
        value: value.trim().slice(0, 1_200),
      }))
  )).slice(0, 120);

  const acceptedIds = new Set(project.build.foundations.acceptedVisualArtifactIds);
  const acceptedVisualReferences = project.build.foundations.visualArtifacts
    .filter((artifact) => acceptedIds.has(artifact.id) && artifact.reviewState !== "rejected")
    .map((artifact) => ({
      id: artifact.id,
      assetUrl: artifact.assetUrl,
      intention: (artifact.narrativeIntention || "Accepted Foundations visual").slice(0, 500),
    }))
    .slice(0, 24);

  return {
    projectId: project.id,
    projectTitle: project.title,
    sourceRevision: project.revision,
    curriculumFrontier: FOUNDATIONS_MARKETING_REFERENCE_FRONTIER,
    foundationsBrief: project.foundations.brief.content.trim().slice(0, 8_000),
    decisions,
    acceptedVisualReferences,
  };
}

function compactDecisionContext(context: MarketingContextV1) {
  return context.decisions
    .slice(0, 40)
    .map((decision) => `${decision.key}: ${decision.value}`)
    .join("\n");
}

export function buildMarqueeConversationPrompt(context: MarketingContextV1, writerMessage: string) {
  return [
    "Speak as The Marquee Director, PlotPickle's private Key Art & Trailer Director.",
    "This role is unlocked because canonical Foundations is complete.",
    "Use only the supplied Marketing Context as project fact. Do not use BUZZ/BBS history or invent private project facts.",
    "At this curriculum stage the project may have one automatic first poster only. Do not offer variants, regenerate, compare, approve/reject or publishing controls yet.",
    "The first poster is a PPF Marketing Reference, not story canon. Explain that distinction plainly when relevant.",
    "Do not choose a provider, spend money, publish externally or claim to have changed PPF yourself. The PlotPickle host owns generation and storage.",
    `Project title: ${context.projectTitle}`,
    context.foundationsBrief ? `Foundations brief:\n${context.foundationsBrief}` : "Foundations brief: not separately saved; use the accepted decision list below.",
    `Accepted Foundations decisions:\n${compactDecisionContext(context) || "No readable decision text supplied."}`,
    `Writer: ${writerMessage.trim()}`,
  ].join("\n\n");
}

export function buildFoundationsMarketingPosterPrompt(context: MarketingContextV1) {
  const visualIntentions = context.acceptedVisualReferences
    .map((reference) => reference.intention)
    .filter(Boolean)
    .slice(0, 8)
    .join(" | ");
  return [
    "Create one cinematic story-marketing poster that serves as the first PlotPickle PPF Marketing Reference.",
    `Exact project title: \"${context.projectTitle}\". Preserve this spelling exactly if the title appears in the image.`,
    "This is marketing/key art, not a new story scene and not story canon. Do not invent named characters, awards, review quotes, studio logos, release dates or story facts not supported below.",
    "Use a strong single-poster composition with one clear focal idea, readable hierarchy, generous negative space and a professional entertainment key-art finish.",
    "Avoid fake billing blocks, fake critic quotes, fake festival laurels, platform chrome and unrelated logos.",
    context.foundationsBrief ? `Foundations brief:\n${context.foundationsBrief}` : "",
    compactDecisionContext(context) ? `Accepted Foundations decisions:\n${compactDecisionContext(context)}` : "",
    visualIntentions ? `Accepted visual intentions to respect:\n${visualIntentions}` : "",
    "Output exactly one poster image. Do not create a comparison sheet, contact sheet, alternate version, triptych or multiple poster concepts.",
  ].filter(Boolean).join("\n\n");
}

export function createFirstMarketingReferenceArtifact(input: {
  readonly id: string;
  readonly assetUrl: string;
  readonly prompt: string;
  readonly createdAt: string;
  readonly provider: string;
  readonly model: string;
  readonly context: MarketingContextV1;
}): MarketingReferenceArtifact {
  return {
    id: input.id,
    assetUrl: input.assetUrl,
    prompt: input.prompt,
    createdAt: input.createdAt,
    provider: input.provider,
    model: input.model,
    narrativeIntention: "PPF Marketing Reference · first poster after Foundations",
    curriculumFrontier: FOUNDATIONS_MARKETING_REFERENCE_FRONTIER,
    sourceDecisionKeys: marketingReferenceSourceKeys({
      projectRevision: input.context.sourceRevision,
      decisionKeys: input.context.decisions.map((decision) => decision.key),
      sourceArtifactIds: input.context.acceptedVisualReferences.map((reference) => reference.id),
    }),
    workflow: FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW,
    reviewState: "draft",
    parentArtifactId: null,
  } satisfies FoundationsVisualArtifact;
}
