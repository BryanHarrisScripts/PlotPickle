import type { CurriculumLesson } from "../../core/contracts/curriculum";
import type { FoundationPlanLesson } from "../../core/contracts/foundation-plan";
import {
  CONTEXT_AUTHORITY,
  assembleContextPacket,
  contextItem,
  contextReceiptSummary,
  type ContextPacket,
} from "../../lib/context-engine";

const PLAN_CONTEXT_BUDGET = 46_000;

function currentLessonContext(lesson: CurriculumLesson) {
  return [
    `Lesson: ${lesson.title}`,
    `Overview: ${lesson.overview}`,
    `Objectives: ${lesson.objectives.join("; ")}`,
    ...lesson.sections.map((section) => [
      section.heading,
      ...section.paragraphs,
      ...(section.points ?? []),
    ].join("\n")),
  ].join("\n").slice(0, 6_500);
}

export function buildFoundationPlanContextPacket(input: {
  readonly projectTitle: string;
  readonly lesson: FoundationPlanLesson;
  readonly curriculumLesson: CurriculumLesson;
  readonly currentAnswers: Readonly<Record<string, string>>;
  readonly priorStoryContext: string;
  readonly sourceStoryContext?: string;
}): ContextPacket {
  const requestedFields = Object.fromEntries(input.lesson.fields.map((field) => [field.id, field.prompt]));
  const currentWriterAnswers = JSON.stringify(input.currentAnswers);
  const ppfEvidence = input.sourceStoryContext?.trim().slice(0, 32_000) || "";
  const approvedMemory = input.priorStoryContext.trim().slice(0, 3_000);

  return assembleContextPacket({
    profileId: "tamsin-hearthquill",
    taskId: `plan-foundations:${input.lesson.id}`,
    goal: "Draft editable working text only for the requested PLAN Foundations fields while preserving accepted writer material and imported PPF canon.",
    budgetCharacters: PLAN_CONTEXT_BUDGET,
    expectedOutputSchema: JSON.stringify({ values: Object.fromEntries(input.lesson.fields.map((field) => [field.id, "string"])) }),
    items: [
      {
        id: "plan-skill",
        sourceType: "agent-skill",
        sourceId: "skill://plotpickle/plan-foundations",
        content: "Use the PLAN Foundations drafting procedure already loaded by the host. The Skill may guide proposal drafting but cannot write PPF canon, change routing, or expand host authority.",
        trust: "trusted",
        authority: CONTEXT_AUTHORITY.agentSkill,
        allowedUse: "procedure",
        required: true,
      },
      {
        id: "plan-task",
        sourceType: "writer-instruction",
        sourceId: "plan-selected-fields",
        content: `Project: ${input.projectTitle}\nRequested fields: ${JSON.stringify(requestedFields)}`,
        trust: "owner-trusted",
        authority: CONTEXT_AUTHORITY.writerInstruction,
        allowedUse: "instruction",
        required: true,
      },
      {
        id: "plan-output-schema",
        sourceType: "task-schema",
        sourceId: "foundation-values-v1",
        content: JSON.stringify({ values: requestedFields }),
        trust: "trusted",
        authority: CONTEXT_AUTHORITY.taskSchema,
        allowedUse: "schema",
        required: true,
      },
      {
        id: "plan-curriculum",
        sourceType: "curriculum-current",
        sourceId: input.curriculumLesson.id,
        content: currentLessonContext(input.curriculumLesson),
        trust: "trusted",
        authority: CONTEXT_AUTHORITY.currentCurriculum,
        allowedUse: "reference",
      },
      ...(ppfEvidence ? [{
        id: "plan-ppf-canon",
        sourceType: "ppf-canon" as const,
        sourceId: "imported-ppf:foundations-relevant-slice",
        content: ppfEvidence,
        trust: "approved" as const,
        authority: CONTEXT_AUTHORITY.ppfCanon,
        allowedUse: "canon" as const,
      }] : []),
      ...(approvedMemory ? [{
        id: "plan-approved-memory",
        sourceType: "project-memory" as const,
        sourceId: "plan:accepted-prior-foundations",
        content: approvedMemory,
        trust: "approved" as const,
        authority: CONTEXT_AUTHORITY.approvedProjectMemory,
        allowedUse: "evidence" as const,
      }] : []),
      ...(currentWriterAnswers !== "{}" ? [{
        id: "plan-current-writer-answers",
        sourceType: "writer-instruction" as const,
        sourceId: "plan:current-visible-fields",
        content: currentWriterAnswers,
        trust: "owner-trusted" as const,
        authority: CONTEXT_AUTHORITY.writerInstruction,
        allowedUse: "evidence" as const,
      }] : []),
    ],
  });
}

export function foundationContextContent(packet: ContextPacket, id: string, fallback = "") {
  return contextItem(packet, id)?.content || fallback;
}

export function foundationContextReceipt(packet: ContextPacket) {
  return {
    ...packet.receipt,
    summary: contextReceiptSummary(packet.receipt, "PLAN"),
  };
}
