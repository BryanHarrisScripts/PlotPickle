import type { Location, PlotPickleProject, VisualReference } from "./project";
import { approvedVisualCanon, type VisualCanonItem } from "./visual-canon";
import { effectiveContinuityLocks } from "./continuity-locks";
import { assembleVisualStoryContext } from "./visual-context";

export type WorldLookDimension = "period" | "architecture" | "geography" | "culture" | "technology" | "weather" | "light" | "palette";

export type WorldLookDraft = {
  locationId: string;
  dimensions: Record<WorldLookDimension, string>;
  proposalNotes: string;
  updatedAt: string;
};

export type WorldLookBrief = {
  location: Pick<Location, "id" | "name" | "description" | "image">;
  world: {
    period: string;
    cultures: string;
    technology: string;
    rules: string;
    history: string;
    visualLanguage: string;
  };
  dimensions: Record<WorldLookDimension, string>;
  references: VisualReference[];
  approvedCanon: VisualCanonItem[];
  continuity: ReturnType<typeof effectiveContinuityLocks>;
  storyContext: ReturnType<typeof assembleVisualStoryContext>;
  manualReferenceOnlyReady: boolean;
};

const EXTENSION_KEY = "worldLookDevelopment";
export const WORLD_LOOK_DIMENSIONS: WorldLookDimension[] = ["period", "architecture", "geography", "culture", "technology", "weather", "light", "palette"];

function text(value: unknown) { return typeof value === "string" ? value : ""; }
function record(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }

function blankDimensions(): Record<WorldLookDimension, string> {
  return {
    period: "",
    architecture: "",
    geography: "",
    culture: "",
    technology: "",
    weather: "",
    light: "",
    palette: "",
  };
}

export function readWorldLookDraft(project: PlotPickleProject, locationId: string): WorldLookDraft {
  const extensions = record(project.extensions);
  const store = record(extensions[EXTENSION_KEY]);
  const drafts = record(store.drafts);
  const raw = record(drafts[locationId]);
  const rawDimensions = record(raw.dimensions);
  const dimensions = blankDimensions();
  for (const dimension of WORLD_LOOK_DIMENSIONS) dimensions[dimension] = text(rawDimensions[dimension]);
  return {
    locationId,
    dimensions,
    proposalNotes: text(raw.proposalNotes),
    updatedAt: text(raw.updatedAt),
  };
}

export function writeWorldLookDraft(project: PlotPickleProject, draft: WorldLookDraft): PlotPickleProject {
  const extensions = record(project.extensions);
  const store = record(extensions[EXTENSION_KEY]);
  const drafts = record(store.drafts);
  return {
    ...project,
    extensions: {
      ...extensions,
      [EXTENSION_KEY]: {
        version: 1,
        ...store,
        drafts: {
          ...drafts,
          [draft.locationId]: draft,
        },
      },
    },
  };
}

function locationReferences(project: PlotPickleProject, locationId: string) {
  return project.development.visualReferences.filter((reference) =>
    reference.targetKind === "project" || (reference.targetKind === "location" && reference.targetId === locationId),
  );
}

function locationCanon(project: PlotPickleProject, locationId: string) {
  return approvedVisualCanon(project).filter((item) =>
    ["location", "palette", "style", "composition"].includes(item.kind)
    && (item.target.kind === "project" || (item.target.kind === "location" && item.target.id === locationId)),
  );
}

export function buildWorldLookBrief(project: PlotPickleProject, locationId: string): WorldLookBrief | null {
  const location = project.world.locations.find((entry) => entry.id === locationId);
  if (!location) return null;
  const draft = readWorldLookDraft(project, locationId);
  const context = assembleVisualStoryContext(project, { kind: "location", id: location.id, label: location.name || "Location" });
  return {
    location: { id: location.id, name: location.name, description: location.description, image: location.image },
    world: {
      period: project.world.period,
      cultures: project.world.cultures,
      technology: project.world.technology,
      rules: project.world.rules,
      history: project.world.history,
      visualLanguage: project.world.visualLanguage,
    },
    dimensions: draft.dimensions,
    references: locationReferences(project, locationId),
    approvedCanon: locationCanon(project, locationId),
    continuity: effectiveContinuityLocks(project, {}),
    storyContext: context,
    manualReferenceOnlyReady: true,
  };
}

export function worldVisualProposal(project: PlotPickleProject, locationId: string) {
  const brief = buildWorldLookBrief(project, locationId);
  if (!brief) return null;
  return {
    locationId,
    proposedDimensions: brief.dimensions,
    proposalOnly: true,
    worldTextMutated: false,
  };
}

export function reusableLocationVisualLanguage(project: PlotPickleProject, locationId: string) {
  const brief = buildWorldLookBrief(project, locationId);
  if (!brief) return null;
  return {
    locationId,
    approvedCanon: brief.approvedCanon,
    continuity: brief.continuity.filter((lock) => ["architecture", "palette", "weather", "time", "camera"].includes(lock.kind)),
    references: brief.references,
  };
}
