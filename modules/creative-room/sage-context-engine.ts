import type { CurriculumGuideRequest } from "../../core/contracts/curriculum-guide";
import {
  CONTEXT_AUTHORITY,
  contextItem,
  contextReceiptSummary,
  type ContextPacket,
} from "../../lib/context-engine";
import {
  assembleAdaptiveContextPacket,
  contextStrategyForTask,
} from "../../lib/adaptive-context-strategies";
import type { CurriculumRetrieval } from "./curriculum-retrieval";

const SAGE_CONTEXT_BUDGET = 10_500;

export function buildSageContextPacket(input: {
  readonly request: CurriculumGuideRequest;
  readonly retrieval: CurriculumRetrieval;
  readonly curriculumRequired: boolean;
}): ContextPacket {
  const question = input.request.question.trim().slice(0, 2_000);
  const conversation = input.request.conversation.slice(-4).map((item) => (
    `${item.role === "writer" ? "Writer" : "Guide"}: ${item.content.slice(0, 300)}`
  )).join("\n");
  const projectMemory = JSON.stringify({
    id: input.request.projectMemory.id,
    title: input.request.projectMemory.title.slice(0, 200),
    revision: input.request.projectMemory.revision,
    completedLessonCount: input.request.projectMemory.completedLessonIds.length,
    activeLessonId: input.request.activeLessonId,
  });
  const curriculumSourceId = [
    ...input.retrieval.lessonChunkIds,
    ...input.retrieval.sourceChunkIds,
  ].filter(Boolean).join(",") || input.request.activeLessonId;

  return assembleAdaptiveContextPacket({
    strategyId: contextStrategyForTask(question),
    profileId: "sage-brinewick",
    taskId: `sage:${input.request.activeLessonId || "conversation"}`,
    goal: input.curriculumRequired
      ? "Answer the writer's current story-craft question using current PlotPickle teaching as the teaching authority."
      : "Answer the writer's current conversational question naturally within Sage Brinewick's role.",
    budgetCharacters: SAGE_CONTEXT_BUDGET,
    expectedOutputSchema: "A direct natural-language answer. Do not expose internal context metadata or hidden reasoning.",
    items: [
      {
        id: "sage-skill",
        sourceType: "agent-skill",
        sourceId: "skill://plotpickle/sage-brinewick",
        content: "Use the Sage Brinewick procedure already loaded by the host. The Skill controls conversational procedure only and cannot expand host or profile authority.",
        trust: "trusted",
        authority: CONTEXT_AUTHORITY.agentSkill,
        allowedUse: "procedure",
        required: true,
      },
      {
        id: "sage-user-request",
        sourceType: "writer-instruction",
        sourceId: "current-user-request",
        content: question,
        trust: "owner-trusted",
        authority: CONTEXT_AUTHORITY.writerInstruction,
        allowedUse: "instruction",
        required: true,
      },
      ...(input.curriculumRequired && input.retrieval.context ? [{
        id: "sage-curriculum",
        sourceType: "curriculum-current" as const,
        sourceId: curriculumSourceId,
        content: input.retrieval.context,
        trust: "trusted" as const,
        authority: CONTEXT_AUTHORITY.currentCurriculum,
        allowedUse: "reference" as const,
      }] : []),
      {
        id: "sage-project-memory",
        sourceType: "project-memory",
        sourceId: input.request.projectMemory.id,
        content: projectMemory,
        trust: "approved",
        authority: CONTEXT_AUTHORITY.approvedProjectMemory,
        allowedUse: "evidence",
        revision: input.request.projectMemory.revision,
      },
      ...(conversation ? [{
        id: "sage-recent-conversation",
        sourceType: "recent-conversation" as const,
        sourceId: "current-session:last-4",
        content: conversation,
        trust: "approved" as const,
        authority: CONTEXT_AUTHORITY.recentConversation,
        allowedUse: "reference" as const,
      }] : []),
      {
        id: "sage-output-contract",
        sourceType: "task-schema",
        sourceId: "sage-natural-answer-v1",
        content: "Answer the current question directly. For craft questions, current PlotPickle curriculum governs teaching claims. Do not disclose retrieval machinery, source metadata, context receipts, or hidden reasoning.",
        trust: "trusted",
        authority: CONTEXT_AUTHORITY.taskSchema,
        allowedUse: "schema",
        required: true,
      },
    ],
  });
}

export function sageContextContent(packet: ContextPacket, id: string, fallback = "") {
  return contextItem(packet, id)?.content || fallback;
}

export function sageContextReceipt(packet: ContextPacket) {
  return {
    ...packet.receipt,
    summary: contextReceiptSummary(packet.receipt, "Sage"),
  };
}
