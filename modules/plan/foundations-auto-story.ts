import type { CurriculumLesson } from "../../core/contracts/curriculum";
import {
  assembleFoundationsBrief,
  type FoundationPlanLesson,
} from "../../core/contracts/foundation-plan";
import { applyStoryCommand } from "../../core/project/apply-command";
import type { PPFProject } from "../../core/project/project";
import {
  createLibraryUserProject,
  listLibraryProjects,
} from "../../core/storage/project-library-browser";
import { saveFoundationProject } from "../../core/storage/foundation-project-browser";
// The existing Full Story Builder is JavaScript. Keep its narrow typing local to PLAN
// rather than adding another shared lib surface just for this consumer.
// @ts-expect-error — full-story-builder.mjs intentionally has no TypeScript declaration file.
import { normalizeFullStoryBrief } from "../../lib/full-story-builder.mjs";
import { draftFoundationLesson } from "./foundations-plan-drafter";

type FullStoryBrief = {
  readonly title: string;
  readonly premise: string;
  readonly genre: string;
  readonly tone: string;
  readonly protagonist: string;
  readonly protagonistGoal: string;
  readonly opposition: string;
  readonly theme: string;
  readonly setting: string;
  readonly visualLanguage: string;
  readonly audience: string;
  readonly contentRating: string;
  readonly language: string;
  readonly projectOwner: string;
  readonly originalitySeed: string;
};

export type FoundationsAutoStoryProgress = {
  readonly stage: "creating" | "lesson" | "brief" | "complete";
  readonly message: string;
  readonly lessonIndex?: number;
  readonly lessonCount?: number;
  readonly lessonId?: string;
};

export type FoundationsAutoStoryResult = {
  readonly project: PPFProject;
  readonly seed: FullStoryBrief;
  readonly previousProjectId: string;
};

function seedContext(seed: FullStoryBrief) {
  return [
    `Original story title: ${seed.title}`,
    `Original premise: ${seed.premise}`,
    `Genre: ${seed.genre}`,
    `Tone: ${seed.tone}`,
    `Protagonist: ${seed.protagonist}`,
    `Protagonist goal: ${seed.protagonistGoal}`,
    `Opposition: ${seed.opposition}`,
    `Theme: ${seed.theme}`,
    `Setting: ${seed.setting}`,
    `Audience: ${seed.audience}`,
    `Visual language: ${seed.visualLanguage}`,
    "This is a newly generated PlotPickle story seed. Treat it as the starting canon for this new project and make every Foundations answer specific to it.",
  ].join("\n");
}

function acceptedFoundationContext(
  lessons: readonly FoundationPlanLesson[],
  activeLessonId: string,
  project: PPFProject,
) {
  return lessons.filter((lesson) => lesson.id !== activeLessonId).flatMap((lesson) => {
    const saved = project.foundations.lessons[lesson.id]?.answers ?? {};
    return lesson.fields.flatMap((field) => {
      const answer = saved[field.id]?.trim();
      return answer ? [`${lesson.title} — ${field.prompt}\n${answer}`] : [];
    });
  }).join("\n\n");
}

function originalitySeed() {
  const random = globalThis.crypto?.randomUUID?.() ?? Math.random().toString(36).slice(2);
  return `plotpickle-foundations-${new Date().toISOString()}-${random}`;
}

export async function autoCompleteNewFoundationsStory(input: {
  readonly curriculum: readonly CurriculumLesson[];
  readonly lessons: readonly FoundationPlanLesson[];
  readonly onProgress?: (progress: FoundationsAutoStoryProgress) => void;
}): Promise<FoundationsAutoStoryResult> {
  if (!input.lessons.length) throw new Error("PlotPickle could not find the Foundations curriculum lessons to auto-complete.");

  const priorProjects = listLibraryProjects();
  const previousProjectId = priorProjects[0]?.id || "";
  const seed = normalizeFullStoryBrief({ originalitySeed: originalitySeed() }) as FullStoryBrief;
  input.onProgress?.({ stage: "creating", message: `Creating a new story: ${seed.title}…` });

  let workingProject = createLibraryUserProject({
    title: seed.title,
    genre: seed.genre,
    format: "Story",
  });
  const sourceStoryContext = seedContext(seed);

  for (const [index, lesson] of input.lessons.entries()) {
    const curriculumLesson = input.curriculum.find((item) => item.id === lesson.id);
    if (!curriculumLesson) throw new Error(`PLAN could not find the curriculum guidance for ${lesson.title}.`);
    input.onProgress?.({
      stage: "lesson",
      lessonIndex: index + 1,
      lessonCount: input.lessons.length,
      lessonId: lesson.id,
      message: `Foundations ${index + 1} of ${input.lessons.length}: ${lesson.title}`,
    });

    const proposal = await draftFoundationLesson({
      projectTitle: seed.title,
      lesson,
      curriculumLesson,
      currentAnswers: {},
      priorStoryContext: acceptedFoundationContext(input.lessons, lesson.id, workingProject),
      sourceStoryContext,
    });
    const stored = applyStoryCommand(workingProject, {
      type: "foundations.proposal.store",
      lessonId: lesson.id,
      proposal,
      occurredAt: proposal.generatedAt,
    });
    const accepted = applyStoryCommand(stored, {
      type: "foundations.proposal.accept",
      lessonId: lesson.id,
      occurredAt: proposal.generatedAt,
    });
    workingProject = applyStoryCommand(accepted, {
      type: "lesson.complete",
      lessonId: lesson.id,
      occurredAt: proposal.generatedAt,
    });
    saveFoundationProject(workingProject);
  }

  input.onProgress?.({ stage: "brief", message: "Saving the completed Foundations Brief…" });
  const content = assembleFoundationsBrief({
    projectTitle: seed.title,
    lessons: input.lessons,
    state: workingProject.foundations,
  });
  workingProject = applyStoryCommand(workingProject, {
    type: "foundations.brief.save",
    content,
    occurredAt: new Date().toISOString(),
  });
  saveFoundationProject(workingProject);

  input.onProgress?.({
    stage: "complete",
    message: `${seed.title} is complete through Foundations and saved as its own story in Library.`,
  });
  return { project: workingProject, seed, previousProjectId };
}
