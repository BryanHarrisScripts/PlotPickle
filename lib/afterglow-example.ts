import {
  AFTERGLOW_PROJECT_ID,
  AFTERGLOW_PROJECT_TITLE,
} from "./afterglow-persistence";
import {
  cloneProject,
  createBlankCollaboration,
  type PlotPickleProject,
} from "./project";

export const AFTERGLOW_EXAMPLE_LABEL = "Afterglow — PlotPickle Example Story" as const;
export const AFTERGLOW_EXAMPLE_ACTIVE_KEY = "plotpickle.afterglow.example.active.v1" as const;
export const AFTERGLOW_EXAMPLE_SOURCE_EXTENSION = "plotpickle.afterglowExampleSource" as const;

export type AfterglowExampleSource = {
  projectId: typeof AFTERGLOW_PROJECT_ID;
  title: typeof AFTERGLOW_PROJECT_TITLE;
  copiedAt: string;
  readOnlySource: true;
};

type CopyOptions = {
  id?: string;
  now?: string;
  title?: string;
};

function generatedCopyId(now: string) {
  const timestamp = Number.isFinite(Date.parse(now)) ? Date.parse(now).toString(36) : Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 8);
  return `afterglow-copy-${timestamp}-${random}`;
}

export function isAfterglowExampleProject(value: unknown): value is PlotPickleProject {
  return Boolean(value && typeof value === "object" && (value as { id?: unknown }).id === AFTERGLOW_PROJECT_ID);
}

export function isAfterglowDerivedCopy(value: unknown): value is PlotPickleProject {
  if (!value || typeof value !== "object") return false;
  const project = value as PlotPickleProject;
  if (isAfterglowExampleProject(project)) return false;
  const source = project.extensions?.[AFTERGLOW_EXAMPLE_SOURCE_EXTENSION];
  return Boolean(source && typeof source === "object" && (source as { projectId?: unknown }).projectId === AFTERGLOW_PROJECT_ID);
}

export function afterglowCopyFileName(project: Pick<PlotPickleProject, "id">) {
  return `${project.id}.ppf`;
}

export function createAfterglowEditableCopy(
  example: PlotPickleProject,
  options: CopyOptions = {},
): PlotPickleProject {
  if (!isAfterglowExampleProject(example)) {
    throw new Error("Only the bundled Afterglow example can be copied through this boundary.");
  }

  const now = options.now || new Date().toISOString();
  const copy = cloneProject(example);
  const id = options.id?.trim() || generatedCopyId(now);
  if (id === AFTERGLOW_PROJECT_ID) {
    throw new Error("An editable Afterglow copy must receive a new project ID.");
  }

  return {
    ...copy,
    id,
    metadata: {
      ...copy.metadata,
      title: options.title?.trim() || `${copy.metadata.title} — My Copy`,
      subtitle: "Personal PlotPickle project copied from the Afterglow example",
      status: "Planning",
      createdAt: now,
      updatedAt: now,
    },
    collaboration: createBlankCollaboration(),
    extensions: {
      ...copy.extensions,
      [AFTERGLOW_EXAMPLE_SOURCE_EXTENSION]: {
        projectId: AFTERGLOW_PROJECT_ID,
        title: AFTERGLOW_PROJECT_TITLE,
        copiedAt: now,
        readOnlySource: true,
      } satisfies AfterglowExampleSource,
    },
  };
}
