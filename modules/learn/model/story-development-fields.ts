import { curriculumApplicationPrompts, type CurriculumLesson } from "../../../core/contracts/curriculum";
import {
  LEARN_TOPIC_SPINE,
  type LearnTopicSpineId,
} from "./story-learning-context";

export type StoryDevelopmentFieldClassification =
  | "story-decision"
  | "craft-decision"
  | "project-application-note";

export type StoryDevelopmentFieldDefinition = {
  readonly canonicalId: string;
  readonly topicId: LearnTopicSpineId;
  readonly learnTopicId: string;
  readonly lessonId: string;
  readonly lessonNumber: number;
  readonly lessonTitle: string;
  readonly fieldId: string;
  readonly prompt: string;
  readonly actionLabel: string;
  readonly classification: StoryDevelopmentFieldClassification;
};

function classification(topicId: LearnTopicSpineId): StoryDevelopmentFieldClassification {
  if (["foundations", "world", "character", "theme", "structure"].includes(topicId)) return "story-decision";
  if (["previs", "drafting", "dialogue"].includes(topicId)) return "craft-decision";
  return "project-application-note";
}

export function storyDevelopmentCanonicalId(
  topicId: LearnTopicSpineId,
  lessonId: string,
  fieldId: string,
) {
  return `${topicId}:${lessonId}:${fieldId}`;
}

export function buildStoryDevelopmentFields(
  curriculum: readonly CurriculumLesson[],
): readonly StoryDevelopmentFieldDefinition[] {
  return LEARN_TOPIC_SPINE.flatMap((topic) => curriculum
    .filter((lesson) => lesson.topic === topic.learnTopicId)
    .slice()
    .sort((left, right) => left.number - right.number)
    .flatMap((lesson) => curriculumApplicationPrompts(lesson).map((prompt, index) => {
      const fieldId = `output-${index + 1}`;
      return {
        canonicalId: storyDevelopmentCanonicalId(topic.id, lesson.id, fieldId),
        topicId: topic.id,
        learnTopicId: topic.learnTopicId,
        lessonId: lesson.id,
        lessonNumber: lesson.number,
        lessonTitle: lesson.title,
        fieldId,
        prompt,
        actionLabel: "Ask Agent",
        classification: classification(topic.id),
      } satisfies StoryDevelopmentFieldDefinition;
    })));
}

export const MIND_MAP_FIELD_PAGE_SIZE = 6;

export function storyDevelopmentFieldPageCount(
  fields: readonly StoryDevelopmentFieldDefinition[],
) {
  return Math.max(1, Math.ceil(fields.length / MIND_MAP_FIELD_PAGE_SIZE));
}

export function storyDevelopmentFieldPageForId(
  fields: readonly StoryDevelopmentFieldDefinition[],
  canonicalId: string,
) {
  const index = fields.findIndex((field) => field.canonicalId === canonicalId);
  return index < 0 ? 1 : Math.floor(index / MIND_MAP_FIELD_PAGE_SIZE) + 1;
}

export function storyDevelopmentFieldsForPage(
  fields: readonly StoryDevelopmentFieldDefinition[],
  page: number,
) {
  const pageCount = storyDevelopmentFieldPageCount(fields);
  const safePage = Math.min(Math.max(Math.trunc(page) || 1, 1), pageCount);
  const start = (safePage - 1) * MIND_MAP_FIELD_PAGE_SIZE;
  return fields.slice(start, start + MIND_MAP_FIELD_PAGE_SIZE);
}

export function storyDevelopmentFieldsForTopic(
  curriculum: readonly CurriculumLesson[],
  topicId: LearnTopicSpineId,
) {
  return buildStoryDevelopmentFields(curriculum).filter((field) => field.topicId === topicId);
}
