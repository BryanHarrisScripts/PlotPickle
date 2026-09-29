import { AFTERGLOW_V9_REFERENCE_LOGLINE } from "../../data/afterglow-reference-identity";
import { createEmptyProject, normalizeFoundationProject, type PPFProject } from "../../core/project/project";

export type LibraryFrontierCoverage = {
  readonly foundations: string;
  readonly world: string;
  readonly character: string;
  readonly structure: string;
  readonly storyboard: string;
};

export type LibraryCatalogItem = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly logline?: string;
  readonly genre: string;
  readonly format: string;
  readonly visualLabel: string;
  readonly project: PPFProject;
  readonly coverage: LibraryFrontierCoverage;
  readonly referenceLoader?: "afterglow-v9-foundations" | "afterglow-packaged-current";
};

const LOCKED_LATER_FRONTIERS = {
  character: "Not available yet",
  structure: "Locked",
  storyboard: "Locked",
} as const;

function presetProject(input: {
  readonly id: string;
  readonly title: string;
  readonly now: string;
  readonly genre: string;
  readonly foundationPrompt: string;
  readonly worldPrompt: string;
}) {
  const empty = createEmptyProject({ id: input.id, now: input.now, title: input.title });
  return normalizeFoundationProject({
    ...empty,
    foundations: {
      ...empty.foundations,
      brief: { content: input.foundationPrompt, savedAt: input.now },
    },
    world: {
      ...empty.world,
      brief: { content: input.worldPrompt, savedAt: input.now },
    },
  });
}

export function createFeaturedExamples(now: string): readonly LibraryCatalogItem[] {
  return [
    {
      id: "afterglow-v9",
      title: "Afterglow: Reflections of Sentience",
      description: "The complete 2023 v9 screenplay mapped into PlotPickle as the reference story.",
      logline: AFTERGLOW_V9_REFERENCE_LOGLINE,
      genre: "Science Fiction · Drama",
      format: "Screenplay · v9 reference",
      visualLabel: "Pacific road · AI family",
      project: createEmptyProject({
        id: "reference-afterglow-v9-source",
        title: "Afterglow: Reflections of Sentience",
        now,
      }),
      coverage: {
        foundations: "100%",
        world: "Not started",
        ...LOCKED_LATER_FRONTIERS,
      },
      referenceLoader: "afterglow-packaged-current",
    },
  ];
}

export function createGenrePresets(now: string): readonly LibraryCatalogItem[] {
  const presets = [
    {
      id: "sci-fi",
      title: "Science Fiction Starter",
      description: "Begin with one speculative change, the Human pressure it creates, and rules the story can test.",
      genre: "Science Fiction",
      visualLabel: "Orbital blue",
      foundationPrompt: "Define the protagonist, the speculative change, the visible objective, the system resisting them, and the Human cost of failure.",
      worldPrompt: "Establish the technology or changed condition, who controls it, its limits, its everyday effects, and one unintended consequence.",
    },
    {
      id: "dark-fantasy",
      title: "Dark Fantasy Starter",
      description: "Shape a dangerous wonder with coherent rules, moral cost, and a character choice at its centre.",
      genre: "Dark Fantasy",
      visualLabel: "Ember forest",
      foundationPrompt: "Define the forbidden promise, the protagonist’s need, the force collecting the cost, and the choice that makes victory morally difficult.",
      worldPrompt: "Establish the source of wonder, its cost, the institutions built around it, the taboo everyone observes, and the consequence of breaking it.",
    },
    {
      id: "cyberpunk",
      title: "Cyberpunk Starter",
      description: "Build from unequal access, compromised identity, and technology that changes who can act with power.",
      genre: "Cyberpunk",
      visualLabel: "Rain circuit",
      foundationPrompt: "Define the protagonist’s leverage, the institution that owns the system, the personal compromise required, and who pays when resistance fails.",
      worldPrompt: "Map access, surveillance, labour, body or identity technology, the informal economy, and the gap between corporate promise and lived reality.",
    },
    {
      id: "mystery",
      title: "Mystery Starter",
      description: "Start with a consequential question, a fair evidence trail, and interpretations that reveal character.",
      genre: "Mystery",
      visualLabel: "Archive green",
      foundationPrompt: "Define the central question, why this investigator cannot walk away, the opposing interpretation, the stakes, and what the answer changes.",
      worldPrompt: "Establish the social system around the mystery, who controls information, where evidence can hide, and which local rule creates pressure.",
    },
  ] as const;

  return presets.map((preset) => ({
    id: preset.id,
    title: preset.title,
    description: preset.description,
    genre: preset.genre,
    format: "Story",
    visualLabel: preset.visualLabel,
    project: presetProject({ ...preset, now, title: preset.title.replace(" Starter", "") }),
    coverage: {
      foundations: "Not started",
      world: "Not started",
      ...LOCKED_LATER_FRONTIERS,
    },
  }));
}
