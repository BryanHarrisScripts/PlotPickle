import type { CurriculumKnowledgeSource, CurriculumLesson } from "./curriculum";

export interface CurriculumGuideRequest {
  readonly curriculum: readonly CurriculumLesson[];
  readonly knowledgeSources: readonly CurriculumKnowledgeSource[];
  readonly activeLessonId: string;
  readonly question: string;
  readonly conversation: readonly {
    readonly role: "writer" | "guide";
    readonly content: string;
  }[];
  readonly projectMemory: {
    readonly id: string;
    readonly title: string;
    readonly revision: number;
    readonly completedLessonIds: readonly string[];
  };
}

export interface CurriculumGuideAnswer {
  readonly text: string;
  readonly sourceLessonIds: readonly string[];
  readonly sourceReferenceIds: readonly string[];
  readonly provider: "ollama";
  readonly model: string;
}

export type CurriculumGuide = (
  request: CurriculumGuideRequest,
) => Promise<CurriculumGuideAnswer>;
