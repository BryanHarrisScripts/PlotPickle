import type { CurriculumLesson } from "../../core/contracts/curriculum";
import { buildFoundationCurriculum } from "./foundation-reference-lessons";
import {
  FOUNDATION_LESSON_MATERIAL,
  FOUNDATION_SEQUENCE,
} from "./foundation-course-material";

function uniqueDefinitions(
  definitions: ReadonlyArray<CurriculumLesson["definitions"][number]>,
) {
  const byTerm = new Map<string, CurriculumLesson["definitions"][number]>();
  for (const definition of definitions) {
    byTerm.set(definition.term.toLowerCase(), definition);
  }
  return [...byTerm.values()];
}

export function buildDeepFoundationCurriculum(baseLessons: readonly CurriculumLesson[]): readonly CurriculumLesson[] {
  const standalone = buildFoundationCurriculum(baseLessons);
  const byTitle = new Map(standalone.map((lesson) => [lesson.title, lesson]));

  return FOUNDATION_SEQUENCE.map((title, index) => {
    const lesson = byTitle.get(title);
    if (!lesson) throw new Error(`Foundations learning-path lesson ${title} is missing.`);
    const material = FOUNDATION_LESSON_MATERIAL[title];
    const nextTitle = FOUNDATION_SEQUENCE[index + 1];

    return {
      ...lesson,
      number: index + 1,
      // The curated material absorbs and deliberately re-homes the useful
      // concepts from the former four-lesson path. Appending the old sections
      // here would restore duplicate course maps and teach positioning,
      // screenplay execution or logline workflow before their proper lesson.
      sections: [
        ...material.sections,
        {
          heading: "Apply this to your story",
          paragraphs: [
            "Capture a defensible working answer, mark what remains uncertain, and keep this output beside the rest of the Foundation. The next lesson should test and refine this work rather than silently replacing it.",
            nextTitle
              ? `When you are ready, continue to ${nextTitle}.`
              : "When every central claim has visible evidence or a clearly recorded unknown, the Foundation is ready to guide the next module.",
          ],
          points: [...material.storyOutputs],
        },
      ],
      definitions: uniqueDefinitions([...lesson.definitions, ...material.definitions]),
      exercise: material.exercise ?? lesson.exercise,
      apply: "Active story · Foundations",
    } satisfies CurriculumLesson;
  });
}
