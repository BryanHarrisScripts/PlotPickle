import type { LibraryPPFProject } from "../../core/storage/library-project";
import type { StoryDevelopmentFieldDefinition } from "../learn/model/story-development-fields";

export type AfterglowRecoveredWork = Readonly<{
  sourceCount: number;
  recoveredItemCount: number;
  differingValueCount: number;
  groups: ReadonlyArray<Readonly<{
    id: string;
    label: string;
    items: ReadonlyArray<Readonly<{
      groupId: string;
      id: string;
      label: string;
      kind: string;
      alternatives: ReadonlyArray<Readonly<{
        text: string;
        sources: ReadonlyArray<Readonly<{id:string;updatedAt:string}>>;
      }>>;
    }>>;
  }>>;
  packageModified: false;
  readyForHumanCommit: false;
}>;

export function inventoryAfterglowRecoveredWork(input: Readonly<{
  baseline: LibraryPPFProject;
  sources: readonly Readonly<{project:LibraryPPFProject}>[];
  fields: readonly Pick<StoryDevelopmentFieldDefinition,
    "canonicalId" | "topicId" | "lessonId" | "lessonTitle" | "fieldId">[];
}>): AfterglowRecoveredWork;
