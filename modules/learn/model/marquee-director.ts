import {
  FOUNDATIONS_MARKETING_REFERENCE_FRONTIER,
  FOUNDATIONS_MARKETING_REFERENCE_WORKFLOW,
  marketingReferenceSourceKeys,
  type FoundationsVisualArtifact,
  type MarketingReferenceArtifact,
} from "../../../core/contracts/build-progress";
import type { CurriculumLesson } from "../../../core/contracts/curriculum";
import type { PPFProject } from "../../../core/project/project";
import {
  buildVisualContract,
  compileVisualContractPrompt,
  type VisualContract,
} from "../../../core/visual-contract/visual-contract";
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

export function isMarqueeDirectorUnlocked(curriculum: readonly CurriculumLesson[], project: PPFProject) {
  return deriveGuidedCreationProgression(curriculum, project).foundations.complete;
}

export function deriveMarketingContextV1(project: PPFProject): MarketingContextV1 {
  const decisions = Object.entries(project.foundations.lessons).flatMap(([lessonId, lesson]) => (
    Object.entries(lesson.answers)
      .filter((entry): entry is [string, string] => typeof entry[1] === "string" && Boolean(entry[1].trim()))
      .map(([fieldId, value]) => ({ key: `${lessonId}:${fieldId}`, value: value.trim().slice(0, 1_200) }))
  )).slice(0, 120);
  const acceptedIds = new Set(project.build.foundations.acceptedVisualArtifactIds);
  const acceptedVisualReferences = project.build.foundations.visualArtifacts
    .filter((artifact) => acceptedIds.has(artifact.id) && artifact.reviewState !== "rejected")
    .map((artifact) => ({ id: artifact.id, assetUrl: artifact.assetUrl, intention: (artifact.narrativeIntention || "Accepted Foundations visual").slice(0, 500) }))
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
  return context.decisions.slice(0, 40).map((decision) => `${decision.key}: ${decision.value}`).join("\n");
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

export function buildFoundationsMarketingVisualContract(context: MarketingContextV1): VisualContract {
  const decisionText = compactDecisionContext(context);
  return buildVisualContract({
    request: "Create the first standalone PlotPickle story-marketing poster after Foundations completion.",
    hardConstraints: [
      { id: "single-poster", text: "Produce exactly one standalone poster image, never a comparison sheet, contact sheet, triptych or alternate set.", source: "project" },
      { id: "project-title", text: `The canonical project title is \"${context.projectTitle}\". If the title appears in the image, preserve this spelling exactly.`, source: "project" },
      { id: "story-authority", text: "Treat supplied Foundations decisions and brief as story authority. Do not invent named characters, story events or other canon absent from that evidence.", source: "project" },
      { id: "marketing-reference-boundary", text: "The image is marketing/key art and a PPF Marketing Reference; it does not create new story canon.", source: "project" },
      ...(context.foundationsBrief ? [{ id: "foundations-brief", text: `Respect this accepted Foundations brief: ${context.foundationsBrief}`, source: "project" as const }] : []),
      ...(decisionText ? [{ id: "foundations-decisions", text: `Respect these accepted Foundations decisions:\n${decisionText}`, source: "project" as const }] : []),
    ],
    derivedConstraints: [
      { id: "poster-hierarchy", text: "Use one clear focal idea with readable visual hierarchy and sufficient negative space for a professional story-marketing poster." },
      { id: "reference-coherence", text: "Where accepted visual references are supplied, preserve their stated visual intention rather than treating them as unrelated decoration." },
    ],
    openChoices: [
      "Choose the exact focal metaphor, framing and secondary visual detail only within the supplied story evidence.",
      "Choose restrained decorative detail needed for a coherent professional key-art finish.",
    ],
    references: context.acceptedVisualReferences.map((reference) => ({
      id: reference.id,
      assetUrl: reference.assetUrl,
      roles: ["visual-language" as const],
      intention: reference.intention,
    })),
    macroScene: ["Standalone entertainment key art; not a literal new story scene unless the supplied evidence explicitly requires one."],
    composition: ["Single-poster composition", "One clear focal idea", "Readable hierarchy", "Generous negative space"],
    textRequirements: [`Canonical title spelling if rendered: ${context.projectTitle}`],
    failureConstraints: [
      "Do not add fake billing blocks, critic quotes, awards, festival laurels, release dates, studio/platform logos or unrelated branding.",
      "Do not create multiple poster concepts or variants in one image.",
      "Do not contradict accepted Foundations facts or accepted visual-reference intentions.",
    ],
  });
}

export function buildFoundationsMarketingPosterPrompt(context: MarketingContextV1) {
  return compileVisualContractPrompt(buildFoundationsMarketingVisualContract(context));
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
