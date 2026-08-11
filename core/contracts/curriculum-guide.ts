import type { CurriculumLesson } from "./curriculum";

export interface CurriculumGuideRequest {
  readonly curriculum: readonly CurriculumLesson[];
  readonly activeLessonId: string;
  readonly question: string;
}

export interface CurriculumGuideAnswer {
  readonly text: string;
  readonly sourceLessonIds: readonly string[];
}

export type CurriculumGuide = (
  request: CurriculumGuideRequest,
) => CurriculumGuideAnswer;
