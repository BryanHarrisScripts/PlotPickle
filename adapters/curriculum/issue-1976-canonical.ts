import adaptation from "../../learn/enrichment/1976-c1/adaptation-source-to-screen.json";
import professional from "../../learn/enrichment/1976-c1/professional-pitching-and-representation.json";
import sceneCraft from "../../learn/enrichment/1976-c1/scene-craft-pressure-and-turn.json";
import screenplayFormat from "../../learn/enrichment/1976-c1/screenplay-format-and-delivery.json";
import halfHourComedy from "../../learn/enrichment/1976-c2/half-hour-comedy-craft.json";
import seriesEngine from "../../learn/enrichment/1976-c2/series-engine-and-bible.json";
import seriesArchitecture from "../../learn/enrichment/1976-c2/series-episode-season-architecture.json";
import writersRoom from "../../learn/enrichment/1976-c2/writers-room-story-breaking.json";
import registry from "../../learn/enrichment/1976-canonical.json";
import type { CurriculumLesson } from "../../core/contracts/curriculum";

type StagedLesson = typeof sceneCraft.lesson;
type TopicDocument = Readonly<{
  readonly schemaVersion: string;
  readonly topic: Readonly<{ readonly id: string; readonly title: string }>;
  readonly lessonCount: number;
  readonly sourceCount: number;
  readonly lessons: readonly CurriculumLesson[];
}>;

const stagedById = new Map<string, StagedLesson>([
  [sceneCraft.lesson.id, sceneCraft.lesson],
  [screenplayFormat.lesson.id, screenplayFormat.lesson as StagedLesson],
  [adaptation.lesson.id, adaptation.lesson as StagedLesson],
  [professional.lesson.id, professional.lesson as StagedLesson],
  [seriesArchitecture.lesson.id, seriesArchitecture.lesson as StagedLesson],
  [seriesEngine.lesson.id, seriesEngine.lesson as StagedLesson],
  [writersRoom.lesson.id, writersRoom.lesson as StagedLesson],
  [halfHourComedy.lesson.id, halfHourComedy.lesson as StagedLesson],
]);

function toCanonicalLesson(entry: (typeof registry.lessons)[number]): CurriculumLesson {
  const source = stagedById.get(entry.id);
  if (!source) throw new Error(`#1976 canonical registry references missing authored lesson ${entry.id}.`);
  if (source.topic !== entry.topic) throw new Error(`#1976 canonical topic drift for ${entry.id}.`);
  return {
    id: source.id,
    number: entry.number,
    topic: source.topic,
    title: source.title,
    duration: source.duration,
    overview: source.overview,
    objectives: source.objectives,
    sections: source.sections,
    definitions: source.definitions,
    example: source.example,
    checklist: source.checklist,
    mistakes: source.mistakes,
    exercise: source.exercise,
    apply: source.apply,
    tags: source.tags,
    original: {
      number: entry.number,
      path: `PlotPickle Enrichment / #1976 / ${source.kind}`,
    },
    sources: [],
  };
}

export const ISSUE_1976_CANONICAL_LESSONS = Object.freeze(registry.lessons.map(toCanonicalLesson));
export const ISSUE_1976_CANONICAL_LESSON_COUNT = ISSUE_1976_CANONICAL_LESSONS.length;
export const ISSUE_1976_CANONICAL_REGISTRY = registry;

export function withIssue1976CanonicalEnrichment(documents: readonly TopicDocument[]): readonly TopicDocument[] {
  return documents.map((document) => {
    const additions = ISSUE_1976_CANONICAL_LESSONS.filter((lesson) => lesson.topic === document.topic.id);
    if (additions.length === 0) return document;
    return {
      ...document,
      lessonCount: document.lessonCount + additions.length,
      lessons: [...document.lessons, ...additions],
    };
  });
}
