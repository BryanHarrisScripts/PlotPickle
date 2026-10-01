import { curriculumApplicationPrompts, type CurriculumLesson } from "../../../core/contracts/curriculum";
import {
  LEARN_TOPIC_SPINE,
  type LearnTopicSpineId,
} from "./story-learning-context";

export type StoryDevelopmentFieldClassification =
  | "story-decision"
  | "craft-decision"
  | "project-application-note";

export type StoryDevelopmentAct = 1 | 2 | 3 | 4;

export type StoryDevelopmentFieldScope =
  | "project-wide"
  | "act-specific"
  | "repeatable-by-act";

export type StoryDevelopmentFieldStorageOwner =
  | "foundations"
  | "world"
  | "story-development"
  | "world+story-development-act-overrides";

export const STORY_DEVELOPMENT_ACTS: readonly StoryDevelopmentAct[] = [1, 2, 3, 4];

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
  readonly application: string;
  readonly scope: StoryDevelopmentFieldScope;
  readonly validActs: readonly StoryDevelopmentAct[];
  readonly storageOwner: StoryDevelopmentFieldStorageOwner;
  readonly scopeRationale: string;
};

function classification(topicId: LearnTopicSpineId): StoryDevelopmentFieldClassification {
  if (["foundations", "world", "character", "theme", "structure"].includes(topicId)) return "story-decision";
  if (["previs", "drafting", "dialogue"].includes(topicId)) return "craft-decision";
  return "project-application-note";
}

type ScopeDecision = Pick<
  StoryDevelopmentFieldDefinition,
  "scope" | "validActs" | "storageOwner" | "scopeRationale"
>;

const ACT_ONE_ONLY: readonly StoryDevelopmentAct[] = [1];
const ACT_FOUR_ONLY: readonly StoryDevelopmentAct[] = [4];

const CHARACTER_PROJECT_WIDE = new Set([
  "character-bible",
  "characters-engine",
  "characters-opposition",
  "characters-voiceprint",
  "characters-cast-system",
]);

const WORLD_PROJECT_WIDE = new Set([
  "genres",
  "story-bible",
  "ai-revision-representation-research",
]);

const PREVIS_PROJECT_WIDE = new Set([
  "early-visual-development",
]);

const DRAFTING_PROJECT_WIDE = new Set([
  "writing-process",
  "concept-to-draft",
  "formatting",
  "books-scripts",
  "challenges",
  "essentials-formatting",
]);

const DIALOGUE_PROJECT_WIDE = new Set([
  "ai-revision-dialogue-voiceprint",
  "dialogue-voiceprint",
]);

const REVISION_PROJECT_WIDE = new Set([
  "ai-revision-diagnose-only",
  "ai-revision-formatting-readability",
  "ai-revision-pitch-audience-language",
  "essentials-audit",
]);

function projectWide(
  storageOwner: StoryDevelopmentFieldStorageOwner,
  rationale: string,
  validActs: readonly StoryDevelopmentAct[] = STORY_DEVELOPMENT_ACTS,
): ScopeDecision {
  return { scope: "project-wide", validActs, storageOwner, scopeRationale: rationale };
}

function repeatableByAct(
  storageOwner: StoryDevelopmentFieldStorageOwner,
  rationale: string,
): ScopeDecision {
  return {
    scope: "repeatable-by-act",
    validActs: STORY_DEVELOPMENT_ACTS,
    storageOwner,
    scopeRationale: rationale,
  };
}

function actSpecific(
  validActs: readonly StoryDevelopmentAct[],
  rationale: string,
): ScopeDecision {
  return {
    scope: "act-specific",
    validActs,
    storageOwner: "story-development",
    scopeRationale: rationale,
  };
}

export function storyDevelopmentFieldScopeDecision(
  topicId: LearnTopicSpineId,
  lessonId: string,
): ScopeDecision {
  if (topicId === "foundations") {
    return projectWide(
      "foundations",
      "Foundations are authored once as project truth and concentrated in Act 1 instead of being copied into later Acts.",
      ACT_ONE_ONLY,
    );
  }

  if (topicId === "world") {
    if (WORLD_PROJECT_WIDE.has(lessonId)) {
      return projectWide("world", "Genre, story-bible and research authority remain single project-wide World decisions.");
    }
    return repeatableByAct(
      "world+story-development-act-overrides",
      "Locations, setting conditions, world pressure and continuity can legitimately change from Act to Act while the project-wide World answer remains the fallback.",
    );
  }

  if (topicId === "character") {
    if (lessonId === "characters-choice-proof") {
      return actSpecific(ACT_FOUR_ONLY, "Ending proof is evaluated in Act 4 rather than manufactured in earlier Acts.");
    }
    if (CHARACTER_PROJECT_WIDE.has(lessonId)) {
      return projectWide("story-development", "Character identity, engine, opposition, voiceprint and cast-system decisions remain project-wide truth.");
    }
    return repeatableByAct(
      "story-development",
      "Character choices, relationships, conflict and inner-journey evidence can develop independently across Acts.",
    );
  }

  if (topicId === "theme") {
    return projectWide("story-development", "Theme, tone and motif decisions remain one project-wide dramatic argument.");
  }

  if (topicId === "structure") {
    if (lessonId === "24b-dramatic-question") {
      return actSpecific(ACT_ONE_ONLY, "The setup and central dramatic-question field is constrained to Act 1.");
    }
    if (lessonId === "24b-reflection") {
      return actSpecific(ACT_FOUR_ONLY, "Closing-image, payoff and reflection work is constrained to Act 4.");
    }
    return repeatableByAct(
      "story-development",
      "Structure, pressure, pacing, scene turns and PPPP application legitimately require independent Act answers.",
    );
  }

  if (topicId === "previs") {
    if (PREVIS_PROJECT_WIDE.has(lessonId)) {
      return projectWide("story-development", "The project visual-development approach is selected once and reused across Acts.");
    }
    return repeatableByAct(
      "story-development",
      "Visual action, PageFlow and screen-evidence decisions can be reviewed independently for each Act.",
    );
  }

  if (topicId === "drafting") {
    if (DRAFTING_PROJECT_WIDE.has(lessonId)) {
      return projectWide("story-development", "Writing-process, study and formatting choices remain project-wide craft decisions.");
    }
    return repeatableByAct(
      "story-development",
      "Draft and scene-change decisions can be developed separately for each Act.",
    );
  }

  if (topicId === "dialogue") {
    if (DIALOGUE_PROJECT_WIDE.has(lessonId)) {
      return projectWide("story-development", "Voiceprint decisions remain stable project-wide character/dialogue guidance.");
    }
    return repeatableByAct(
      "story-development",
      "Dialogue purpose, subtext, conflict, exposition and scene-turn choices can vary by Act.",
    );
  }

  if (topicId === "revision") {
    if (REVISION_PROJECT_WIDE.has(lessonId)) {
      return projectWide("story-development", "Revision method, formatting, pitch language and whole-project audit choices remain project-wide.");
    }
    return repeatableByAct(
      "story-development",
      "Structure, scene, conflict and pacing revision passes can target independent Act evidence.",
    );
  }

  if (topicId === "responsible-ai") {
    if (lessonId === "24b-ai") {
      return repeatableByAct(
        "story-development",
        "Structural-level AI assistance can be scoped independently to each Act while Human authority remains unchanged.",
      );
    }
    return projectWide("story-development", "Responsible-AI and publishing boundaries are project-wide policy decisions.");
  }

  if (topicId === "industry") {
    return projectWide("story-development", "Industry and ownership decisions apply to the project as a whole.");
  }

  return projectWide("story-development", "Collaboration roles, authority, rights and review workflow apply to the project as a whole.");
}

export function storyDevelopmentFieldsForAct(
  fields: readonly StoryDevelopmentFieldDefinition[],
  act: StoryDevelopmentAct,
) {
  return fields.filter((field) => field.validActs.includes(act));
}

export function storyDevelopmentFieldStorageId(
  field: StoryDevelopmentFieldDefinition,
  act?: StoryDevelopmentAct,
) {
  if (field.scope === "project-wide" || act === undefined) return field.canonicalId;
  return `${field.canonicalId}::act-${act}`;
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
      const scope = storyDevelopmentFieldScopeDecision(topic.id, lesson.id);
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
        application: lesson.apply,
        ...scope,
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
