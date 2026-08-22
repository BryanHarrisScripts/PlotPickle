import { createEmptyProject, type PPFProject } from "../../core/project/project";

export type FoundationsAutoStory = {
  readonly project: PPFProject;
  readonly title: string;
  readonly premise: string;
  readonly context: string;
};

const TITLE_FIRST = ["Glass", "Quiet", "Copper", "Winter", "Paper", "Hidden", "Salt", "Last"] as const;
const TITLE_SECOND = ["Orchard", "Signal", "Harbour", "Atlas", "Lantern", "Current", "Garden", "Compass"] as const;
const PROTAGONISTS = ["Mara Vale", "Theo Mercer", "Inez Sato", "Callum Quill", "Asha Moreno", "Jonah Rook", "Noor Avery", "Elian Bell"] as const;
const SETTINGS = [
  "a weather-beaten island observatory",
  "a lake town built around a silent mill",
  "a vertical city whose elevators remember every passenger",
  "a northern greenhouse settlement",
  "a coastal archive threatened by the tide",
  "a railway community at the end of its line",
] as const;
const GOALS = [
  "recover a stolen public memory before the community forgets why it exists",
  "prove why the town's failing machinery is choosing who gets to leave",
  "find the missing keeper of an archive before the next storm erases the evidence",
  "repair a forbidden signal that may be the settlement's only route to help",
] as const;
const OPPOSITION = [
  "a trusted civic keeper who believes forgetting is the only way the community can survive",
  "a respected engineer who will sacrifice a few families to preserve the larger system",
  "an elected archivist who thinks the truth will restart an old conflict",
  "a local authority determined to keep the outside world from learning what happened here",
] as const;
const THEMES = [
  "A shared future requires the courage to remember together, not the comfort of choosing the past for others.",
  "Protection without consent becomes another form of control.",
  "Belonging becomes meaningful only when people can choose the truth they must live with.",
  "Repairing a community means sharing responsibility rather than assigning blame to one keeper.",
] as const;

function randomIndexes(count: number) {
  const values = new Uint32Array(count);
  globalThis.crypto.getRandomValues(values);
  return values;
}

function pick<T>(items: readonly T[], value: number) {
  return items[value % items.length];
}

export function createFoundationsAutoStory(now = new Date().toISOString()): FoundationsAutoStory {
  const indexes = randomIndexes(8);
  const title = `The ${pick(TITLE_FIRST, indexes[0])} ${pick(TITLE_SECOND, indexes[1])}`;
  const protagonist = pick(PROTAGONISTS, indexes[2]);
  const setting = pick(SETTINGS, indexes[3]);
  const goal = pick(GOALS, indexes[4]);
  const opposition = pick(OPPOSITION, indexes[5]);
  const theme = pick(THEMES, indexes[6]);
  const premise = `In ${setting}, ${protagonist}, a practical outsider with a private reason to avoid the past, must ${goal} while ${opposition} closes every route forward.`;
  const project = createEmptyProject({
    id: globalThis.crypto.randomUUID(),
    now,
    title,
  });

  const context = [
    "PlotPickle auto-created this original working story seed for a new local Foundations project.",
    `Title: ${title}`,
    `Premise: ${premise}`,
    `Protagonist: ${protagonist}`,
    `Setting: ${setting}`,
    `Primary goal: ${goal}`,
    `Opposition: ${opposition}`,
    `Working theme: ${theme}`,
    "Treat these details as the new project's working story evidence. Fill every requested Foundations field with a concrete, internally consistent choice. Do not refer to another Human story or imported project.",
  ].join("\n");

  return { project, title, premise, context };
}
