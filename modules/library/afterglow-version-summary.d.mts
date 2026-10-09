import type { LibraryPPFProject } from "../../core/storage/library-project";
import type { StoryDevelopmentFieldDefinition } from "../learn/model/story-development-fields";
import type { RelevantProjectContextItem } from "../learn/model/relevant-project-context";

export type AfterglowSavedVersionSummary = Readonly<{
  completedFields: number;
  possibleFields: number;
  contextCount: number;
  noteCount: number;
  suggestionCount: number;
  topicBreakdown: ReadonlyArray<Readonly<{topicId:string;count:number}>>;
  readOnly: true;
}>;

export function summarizeAfterglowSavedVersion(input: Readonly<{
  project: LibraryPPFProject;
  fields: readonly StoryDevelopmentFieldDefinition[];
  contextForField: (field:StoryDevelopmentFieldDefinition,act:1|2|3|4)=>readonly RelevantProjectContextItem[];
}>): AfterglowSavedVersionSummary;
