import { plotPickleCurriculum } from "../../../adapters/curriculum/current-catalog";
import { buildFoundationPlanLessons, createEmptyFoundationLessonAnswers } from "../../../core/contracts/foundation-plan";
import type {
  ImportedScreenplayPassage,
  ProjectSourceEvidence,
} from "../../../core/contracts/imported-screenplay-evidence";
import { createEmptyProject, type PPFProject } from "../../../core/project/project";
import type { PlotPickleProject } from "../../../lib/projects/project";

export type ImportedLibraryProject = PPFProject & {
  readonly sourceEvidence: ProjectSourceEvidence;
};

const MAX_IMPORTED_PASSAGES = 2500;

function compact(values: readonly (string | number | null | undefined)[]) {
  return values
    .map((value) => String(value ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .join(" · ");
}

function importedAnalysisForLesson(title: string, project: PlotPickleProject) {
  const key = title.toLowerCase();
  if (key.includes("anatomy")) {
    return compact([
      project.story.hook,
      project.story.catalyst,
      project.story.ending,
      `${project.screenplay.draftElements.length} screenplay passages detected`,
    ]);
  }
  if (key.includes("roadmap")) {
    return compact([
      project.story.premise,
      project.story.dramaticQuestion,
      project.development.foundations.storyEngine,
    ]);
  }
  if (key.includes("theme") || key.includes("stakes")) {
    return compact([
      project.story.theme,
      project.story.stakes,
      project.development.foundations.protagonist,
      project.development.foundations.objective,
      project.development.foundations.opposition,
    ]);
  }
  if (key.includes("pitch components") || key.includes("positioning")) {
    return compact([
      project.development.pitch.shortPitch,
      project.development.pitch.audiencePromise,
      project.development.pitch.comparableTitles,
    ]);
  }
  if (key === "the pitch" || key.includes("pitch")) {
    return compact([
      project.development.pitch.oneSentence,
      project.development.pitch.shortPitch,
      project.development.pitch.audiencePromise,
    ]);
  }
  if (key.includes("logline")) {
    return compact([
      project.story.logline,
      project.story.dramaticQuestion,
      project.story.stakes,
    ]);
  }
  if (key.includes("layers")) {
    return compact([
      project.development.foundations.storyEngine,
      "The importer created a reviewable 24-Block / 96-Mini-Block structural projection from the screenplay. Placement remains suggested until the Human reviews it.",
    ]);
  }
  if (key.includes("structure") || key.includes("dialogue") || key.includes("visual")) {
    return compact([
      project.development.foundations.storyEngine,
      project.development.dialogue.principles,
      project.world.visualLanguage,
    ]);
  }
  if (key.includes("pacing") || key.includes("tone")) {
    return compact([
      project.metadata.tone,
      `${project.metadata.targetMinutes} minute target`,
      project.development.pitch.emotionalExperience,
    ]);
  }
  if (key.includes("experience")) {
    return compact([
      project.story.premise,
      project.development.pitch.emotionalExperience,
      project.development.pitch.visualVision,
      project.development.foundations.transformation,
    ]);
  }
  return compact([project.story.premise, project.story.logline, project.story.dramaticQuestion]);
}

function importedFoundationProposals(project: PlotPickleProject, importedAt: string) {
  return Object.fromEntries(buildFoundationPlanLessons(plotPickleCurriculum).map((lesson) => {
    const analysis = importedAnalysisForLesson(lesson.title, project);
    if (!analysis) return [lesson.id, createEmptyFoundationLessonAnswers()];
    return [lesson.id, {
      ...createEmptyFoundationLessonAnswers(),
      proposal: {
        values: Object.fromEntries(lesson.fields.map((field) => [
          field.id,
          `${analysis}\n\nReview against the screenplay before accepting: ${field.prompt}`,
        ])),
        model: "Imported screenplay analysis",
        generatedAt: importedAt,
      },
      updatedAt: importedAt,
    }];
  }));
}

function sourceFormat(project: PlotPickleProject) {
  const fileName = project.screenplay.fileName.toLowerCase();
  if (fileName.endsWith(".pdf")) return "pdf";
  return project.screenplay.format;
}

function importedPassages(project: PlotPickleProject): readonly ImportedScreenplayPassage[] {
  return project.screenplay.draftElements.slice(0, MAX_IMPORTED_PASSAGES).map((element) => ({
    id: element.id,
    type: element.type,
    text: element.text,
    blockNumber: element.blockNumber,
    miniBlockNumber: element.miniBlockNumber,
    sceneNumber: element.sceneNumber,
    sceneId: element.sceneId || null,
  }));
}

/**
 * Project the existing rich screenplay/import PPF into the current modular PPF.
 * Imported interpretation stays a PLAN proposal; direct screenplay passages stay
 * source evidence. Neither path completes curriculum lessons or accepts canon.
 */
export function richPpfToLibraryProject(project: PlotPickleProject, importedAt = new Date().toISOString()): ImportedLibraryProject {
  const base = createEmptyProject({
    id: project.id,
    now: importedAt,
    title: project.metadata.title || "Imported Screenplay",
  });
  const passages = importedPassages(project);
  return {
    ...base,
    foundations: {
      ...base.foundations,
      lessons: importedFoundationProposals(project, importedAt),
    },
    sourceEvidence: {
      screenplay: {
        sourceFileName: project.screenplay.fileName,
        sourceFormat: sourceFormat(project),
        importedAt: project.screenplay.importedAt || importedAt,
        analysisStatus: project.screenplay.analysisStatus,
        totalPassageCount: project.screenplay.draftElements.length,
        storedPassageCount: passages.length,
        passagesTruncated: project.screenplay.draftElements.length > passages.length,
        passages,
      },
    },
  };
}
