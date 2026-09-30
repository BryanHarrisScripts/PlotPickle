import { plotPickleCurriculum } from "../../../adapters/curriculum/current-catalog";
import { storyDevelopmentFieldView } from "../../../core/project/story-development";
import type { LibraryPPFProject } from "../../../core/storage/library-project";
import {
  buildStoryDevelopmentFields,
  type StoryDevelopmentFieldClassification,
} from "../../learn/model/story-development-fields";
import type { LearnTopicSpineId } from "../../learn/model/story-learning-context";

export const OUTLINE_CANONICAL_PROJECT_PROJECTION_VERSION = 1 as const;

export type OutlineCanonicalFieldProjection = Readonly<{
  canonicalId: string;
  topicId: LearnTopicSpineId;
  lessonId: string;
  fieldId: string;
  classification: StoryDevelopmentFieldClassification;
  value: string;
  acceptedSource: "human" | "agent-proposal" | null;
  updatedAt: string | null;
}>;

export type OutlineCanonicalMiniBlockProjection = Readonly<{
  id: string;
  number: number;
  ordinal: number;
  title: string;
  note: string;
  planState: string;
  planContent: string;
}>;

export type OutlineCanonicalBlockProjection = Readonly<{
  id: string;
  number: number;
  actNumber: number;
  sequenceNumber: number;
  title: string;
  note: string;
  miniBlocks: readonly OutlineCanonicalMiniBlockProjection[];
}>;

export type OutlineCanonicalProjectProjection = Readonly<{
  version: typeof OUTLINE_CANONICAL_PROJECT_PROJECTION_VERSION;
  projectId: string;
  projectRevision: number;
  projectTitle: string;
  fields: readonly OutlineCanonicalFieldProjection[];
  blocks: readonly OutlineCanonicalBlockProjection[];
}>;

/**
 * Stable read-only projection from the canonical Library project into Outline.
 *
 * The projection is derived on demand. It never persists an Outline-owned copy
 * of Foundations, World, Character, Theme, Structure, Learn-backed fields, or
 * Block/Mini-Block state.
 */
export function projectCanonicalProjectForOutline(
  project: LibraryPPFProject,
): OutlineCanonicalProjectProjection {
  const fields = buildStoryDevelopmentFields(plotPickleCurriculum).map((field) => {
    const current = storyDevelopmentFieldView(project, field);
    return {
      canonicalId: field.canonicalId,
      topicId: field.topicId,
      lessonId: field.lessonId,
      fieldId: field.fieldId,
      classification: field.classification,
      value: current.value,
      acceptedSource: current.acceptedSource,
      updatedAt: current.updatedAt,
    } satisfies OutlineCanonicalFieldProjection;
  });

  const blocks = project.structure.blocks.map((block) => ({
    id: block.id,
    number: block.number,
    actNumber: block.actNumber,
    sequenceNumber: block.sequenceNumber,
    title: block.title,
    note: block.note,
    miniBlocks: block.miniBlocks.map((mini) => ({
      id: mini.id,
      number: mini.number,
      ordinal: mini.ordinal,
      title: mini.title,
      note: mini.note,
      planState: mini.stages.plan.state,
      planContent: mini.stages.plan.content,
    })),
  })) satisfies readonly OutlineCanonicalBlockProjection[];

  return {
    version: OUTLINE_CANONICAL_PROJECT_PROJECTION_VERSION,
    projectId: project.id,
    projectRevision: project.revision,
    projectTitle: project.title,
    fields,
    blocks,
  };
}
