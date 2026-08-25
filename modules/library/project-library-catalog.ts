import { createEmptyProject, normalizeFoundationProject, type PPFProject } from "../../core/project/project";

export type LibraryCatalogItem = {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly genre: string;
  readonly format: string;
  readonly visualLabel: string;
  readonly project: PPFProject;
  readonly referenceLoader?: "afterglow-v9-foundations";
};

function answeredLesson(answer: string, now: string) {
  return {
    answers: { "output-1": answer },
    proposal: null,
    proposalAcceptedAt: null,
    updatedAt: now,
  };
}

function exampleProject(input: {
  readonly id: string;
  readonly title: string;
  readonly now: string;
  readonly pitch: string;
  readonly logline: string;
  readonly experience: string;
  readonly genre: string;
  readonly world: string;
  readonly visualAssetUrl: string;
}) {
  const empty = createEmptyProject({ id: input.id, now: input.now, title: input.title });
  const foundationArtifactId = `${input.id}-foundation-reference`;
  const worldArtifactId = `${input.id}-world-reference`;
  return normalizeFoundationProject({
    ...empty,
    learning: {
      activeLessonId: "world-building",
      completedLessonIds: [
        "pitch",
        "loglines-that-carry-the-movie",
        "why-plotpickle-works-in-layers",
        "essentials-experience",
        "genres",
        "world-building",
      ],
    },
    foundations: {
      activeLessonId: "essentials-experience",
      lessons: {
        pitch: answeredLesson(input.pitch, input.now),
        "loglines-that-carry-the-movie": answeredLesson(input.logline, input.now),
        "why-plotpickle-works-in-layers": answeredLesson(input.experience, input.now),
        "essentials-experience": answeredLesson(input.experience, input.now),
      },
      brief: { content: `${input.pitch}\n\n${input.logline}\n\n${input.experience}`, savedAt: input.now },
    },
    world: {
      activeLessonId: "world-building",
      lessons: {
        genres: answeredLesson(input.genre, input.now),
        "world-building": answeredLesson(input.world, input.now),
      },
      brief: { content: input.world, savedAt: input.now },
    },
    build: {
      foundations: {
        visualArtifacts: [{
          id: foundationArtifactId,
          assetUrl: input.visualAssetUrl,
          prompt: `Packaged visual reference for ${input.title}.`,
          createdAt: input.now,
          provider: "packaged",
          model: "curated-example",
          narrativeIntention: input.experience,
          curriculumFrontier: "Foundations",
          sourceDecisionKeys: ["pitch", "logline", "experience"],
          workflow: "library-featured-example-v1",
          reviewState: "accepted",
          parentArtifactId: null,
        }],
        acceptedVisualArtifactIds: [foundationArtifactId],
      },
      world: {
        visualArtifacts: [{
          id: worldArtifactId,
          assetUrl: input.visualAssetUrl,
          prompt: `Packaged World reference for ${input.title}.`,
          createdAt: input.now,
          provider: "packaged",
          model: "curated-example",
          frameNumber: 1,
          narrativeIntention: input.world,
          curriculumFrontier: "Foundations + World",
          sourceDecisionKeys: ["pitch", "logline", "experience"],
          worldDecisionKeys: ["genres", "world-building"],
          retainedFoundationArtifactIds: [foundationArtifactId],
          workflow: "library-featured-example-v1",
          changeKind: "added",
          reviewState: "accepted",
          parentArtifactId: foundationArtifactId,
        }],
        acceptedVisualArtifactIds: [worldArtifactId],
      },
    },
  });
}

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
      description: "The complete 2023 v9 screenplay mapped into PlotPickle as the reference workflow story. Load a normal working copy through the current Foundations frontier while the immutable source remains unchanged.",
      genre: "Science Fiction · Drama",
      format: "Screenplay · v9 reference",
      visualLabel: "Pacific road · AI family",
      project: createEmptyProject({
        id: "reference-afterglow-v9-source",
        title: "Afterglow: Reflections of Sentience",
        now,
      }),
      referenceLoader: "afterglow-v9-foundations",
    },
    {
      id: "clockmakers-map",
      title: "The Clockmaker’s Map",
      description: "A complete fantasy-mystery foundation in which every repaired clock redraws one street in a city that denies it can change.",
      genre: "Fantasy · Mystery",
      format: "Novel",
      visualLabel: "Brass city",
      project: exampleProject({
        id: "example-clockmakers-map-source",
        title: "The Clockmaker’s Map",
        now,
        pitch: "An apprentice clockmaker discovers that repairing the city’s oldest mechanisms alters its streets and releases histories the ruling guild buried.",
        logline: "After one repair erases her family’s district from every official map, an exacting apprentice must reconstruct the forbidden route before the guild resets the city and traps her brother outside time.",
        experience: "A tactile mystery about memory, civic power, and learning when preservation becomes complicity.",
        genre: "Dark clockwork fantasy driven by a fair-play mystery.",
        world: "A vertical guild city whose clocks coordinate transit, law, and public memory; every mechanism has a social owner, a physical cost, and a rule that characters can test.",
        visualAssetUrl: "/assets/library/examples/clockmakers-map.svg",
      }),
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
  }));
}
