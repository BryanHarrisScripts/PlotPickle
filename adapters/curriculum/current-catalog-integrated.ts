import character from "../../learn/character.json";
import collaboration from "../../learn/collaboration.json";
import dialogue from "../../learn/dialogue.json";
import drafting from "../../learn/drafting.json";
import foundations from "../../learn/foundations.json";
import industry from "../../learn/industry.json";
import index from "../../learn/index.json";
import responsibleAi from "../../learn/responsible-ai.json";
import revision from "../../learn/revision.json";
import structure from "../../learn/structure.json";
import theme from "../../learn/theme.json";
import visualStorytelling from "../../learn/visual-storytelling.json";
import world from "../../learn/world.json";
import type { CurriculumLesson } from "../../core/contracts/curriculum";
import { compareVisualWriterCurriculumOrder } from "../../core/contracts/visual-writer-progression/index";
import { FOUNDATION_SOURCE_COVERAGE } from "./foundation-content-coverage";
import { buildDeepFoundationCurriculum } from "./foundation-deep-learning";
import { FOUNDATION_PROMOTED_SOURCE_IDS } from "./foundation-reference-lessons";
import { ISSUE_1976_CANONICAL_LESSON_COUNT, withIssue1976CanonicalEnrichment } from "./issue-1976-canonical";

type TopicDocument = {
  readonly schemaVersion: string;
  readonly topic: { readonly id: string; readonly title: string };
  readonly lessonCount: number;
  readonly sourceCount: number;
  readonly lessons: readonly CurriculumLesson[];
};

const baseTopicDocuments = [
  foundations,
  industry,
  theme,
  character,
  world,
  structure,
  dialogue,
  visualStorytelling,
  drafting,
  revision,
  responsibleAi,
  collaboration,
] as readonly TopicDocument[];

for (const document of baseTopicDocuments) {
  if (document.schemaVersion !== index.schemaVersion) throw new Error(`LEARN topic ${document.topic.id} uses an unexpected schema version.`);
  if (document.lessonCount !== document.lessons.length) throw new Error(`LEARN topic ${document.topic.id} declares ${document.lessonCount} lessons but contains ${document.lessons.length}.`);
  const sourceCount = document.lessons.reduce((total, lesson) => total + lesson.sources.length, 0);
  if (document.sourceCount !== sourceCount) throw new Error(`LEARN topic ${document.topic.id} declares ${document.sourceCount} sources but contains ${sourceCount}.`);
}

const withIssue2094LearnerIntegration = (documents: readonly TopicDocument[]): readonly TopicDocument[] => documents.map((document) => {
  if (document.topic.id !== "industry") return document;
  return {
    ...document,
    lessons: document.lessons.map((lesson) => {
      if (lesson.id !== "industry") return lesson;
      return {
        ...lesson,
        sections: [
          ...lesson.sections.slice(0, 2),
          {
            heading: "What the major organizations actually do",
            paragraphs: [
              "Major film organizations are not interchangeable. WGA, DGA and SAG-AFTRA are labour organizations for writers, directors/directorial teams and performers/media professionals; IATSE represents many technicians, artisans and craftspeople. The Producers Guild of America is a professional trade association for producers rather than the labour-union equivalent of those guilds.",
              "AMPAS, BAFTA and the European Film Academy are professional or cultural academies focused on recognition and screen culture. ASC, ACE and VES are professional societies serving cinematography, editing and visual-effects communities. BFI supports and develops UK moving-image culture and funding activity; FERA advocates for European film directors; the Cinémathèque Française preserves and presents film heritage; the Motion Picture Association and cinema-exhibition trade associations represent business sectors rather than individual creative labour.",
              "These descriptions are role distinctions, not current membership, eligibility, rate or agreement advice. For a real project, verify the organization's current official information and the jurisdiction and agreement that actually apply.",
            ],
          },
          ...lesson.sections.slice(2),
        ],
        definitions: [
          ...lesson.definitions,
          {
            term: "Trade association",
            meaning: "An organization representing the shared professional or business interests of a sector or member group; it is not automatically a labour union or regulator.",
          },
          {
            term: "Professional society or academy",
            meaning: "An organization centered on a craft, profession or screen culture through recognition, education, standards, preservation or community rather than collective bargaining.",
          },
        ],
      };
    }),
  };
});

export const canonicalTopicDocuments = withIssue2094LearnerIntegration(
  withIssue1976CanonicalEnrichment(baseTopicDocuments),
);
const archive = canonicalTopicDocuments.flatMap((document) => document.lessons).sort(compareVisualWriterCurriculumOrder);
const sourceIds = archive.flatMap((lesson) => lesson.sources.map((source) => source.id));
const expectedArchiveLessons = index.lessonCount + ISSUE_1976_CANONICAL_LESSON_COUNT;
if (archive.length !== expectedArchiveLessons || archive.length !== 89) throw new Error(`Expected ${expectedArchiveLessons} PlotPickle lessons, found ${archive.length}.`);
if (sourceIds.length !== index.sourceCount || sourceIds.length !== 95 || new Set(sourceIds).size !== sourceIds.length) throw new Error(`Expected ${index.sourceCount} unique embedded lesson sources, found ${sourceIds.length}.`);

const standalonePlotPickleCurriculum: readonly CurriculumLesson[] = canonicalTopicDocuments
  .flatMap((document) => document.topic.id === "foundations" ? buildDeepFoundationCurriculum(document.lessons) : document.lessons)
  .sort(compareVisualWriterCurriculumOrder);

const standaloneFoundations = standalonePlotPickleCurriculum.filter((lesson) => lesson.topic === "foundations");
const foundationSourceIds = standaloneFoundations.flatMap((lesson) => lesson.sources.map((source) => source.id));
const standaloneSourceIds = standalonePlotPickleCurriculum.flatMap((lesson) => lesson.sources.map((source) => source.id));
if (standalonePlotPickleCurriculum.length !== 96 || standaloneFoundations.length !== 11) throw new Error(`Expected 96 presentation lessons with 11 Foundations lessons, found ${standalonePlotPickleCurriculum.length} and ${standaloneFoundations.length}.`);
if (foundationSourceIds.length !== FOUNDATION_PROMOTED_SOURCE_IDS.length || new Set(foundationSourceIds).size !== foundationSourceIds.length || FOUNDATION_PROMOTED_SOURCE_IDS.some((sourceId) => !foundationSourceIds.includes(sourceId))) throw new Error(`Expected all ${FOUNDATION_PROMOTED_SOURCE_IDS.length} canonical Foundations sources to remain attached to their presentation lessons.`);
for (const sourceId of FOUNDATION_PROMOTED_SOURCE_IDS) {
  const archiveLesson = standaloneFoundations.find((lesson) => lesson.sources.some((source) => source.id === sourceId));
  const coverage = FOUNDATION_SOURCE_COVERAGE[sourceId];
  if (!archiveLesson || !coverage || archiveLesson.title !== coverage.archiveLesson) throw new Error(`Foundations source ${sourceId} is missing its audited archive and teaching-destination coverage.`);
}
if (standaloneFoundations.some((lesson, position) => lesson.number !== position + 1)) throw new Error("Foundations presentation lessons must be numbered sequentially from 1 to 11.");
if (standaloneSourceIds.length !== 95 || new Set(standaloneSourceIds).size !== standaloneSourceIds.length) throw new Error(`Expected all 95 unique embedded presentation references, found ${standaloneSourceIds.length}.`);

export { standalonePlotPickleCurriculum as plotPickleCurriculum };
