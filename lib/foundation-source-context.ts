import type { PlotPickleProject } from "./project";

export const FOUNDATION_SOURCE_CONTEXT_LIMIT = 32_000;

function clean(value: string | null | undefined, maximum = 2_000) {
  return (value ?? "").replace(/\s+/g, " ").trim().slice(0, maximum);
}

function fact(label: string, value: string | null | undefined, maximum?: number) {
  const text = clean(value, maximum);
  return text ? `${label}: ${text}` : "";
}

function characterContext(project: PlotPickleProject) {
  return project.characters.slice(0, 40).map((character) => [
    `Character: ${clean(character.name, 120) || clean(character.id, 120)}`,
    fact("Role", character.role, 240),
    fact("Description", character.description, 700),
    fact("Want", character.want, 500),
    fact("Need", character.need, 500),
    fact("Ghost", character.ghost, 500),
    fact("Fatal flaw", character.fatalFlaw, 500),
    fact("Strengths", character.strengths, 500),
    fact("Arc", character.arc, 700),
    fact("Voice", character.voice, 500),
  ].filter(Boolean).join("\n"));
}

function blockContext(project: PlotPickleProject) {
  return project.blocks.slice(0, 24).map((block) => [
    `Block ${block.number}: ${clean(block.title, 180)}`,
    fact("Purpose", block.purpose, 500),
    fact("Summary", block.summary, 900),
    fact("Goal", block.goal, 500),
    fact("Conflict", block.conflict, 500),
    fact("Choice", block.choice, 500),
    fact("Consequence", block.consequence, 500),
    fact("Emotional turn", block.emotionalTurn, 500),
  ].filter(Boolean).join("\n"));
}

/**
 * Extract only story evidence that PLAN / Foundations may read from an imported
 * .ppf. Credentials, provider configuration, collaboration metadata, asset
 * paths, and other mutable project infrastructure are deliberately excluded.
 */
export function assembleFoundationSourceContext(project: PlotPickleProject) {
  const sections = [
    [
      "PROJECT",
      fact("Title", project.metadata.title, 300),
      fact("Format", project.metadata.format, 180),
      fact("Genre", project.metadata.genre, 300),
      fact("Tone", project.metadata.tone, 500),
    ].filter(Boolean).join("\n"),
    [
      "STORY",
      fact("Premise", project.story.premise, 1_200),
      fact("Logline", project.story.logline, 1_200),
      fact("Theme", project.story.theme, 1_200),
      fact("Dramatic question", project.story.dramaticQuestion, 1_200),
      fact("Stakes", project.story.stakes, 1_200),
      fact("Ending", project.story.ending, 1_500),
      fact("Story notes", project.story.notes, 1_500),
    ].filter(Boolean).join("\n"),
    [
      "WORLD",
      fact("Ordinary world", project.world.ordinaryWorld, 1_000),
      fact("New world", project.world.newWorld, 1_000),
      fact("Period", project.world.period, 500),
      fact("Rules", project.world.rules, 1_200),
      fact("Technology", project.world.technology, 1_200),
      fact("Visual language", project.world.visualLanguage, 1_000),
    ].filter(Boolean).join("\n"),
    ["CHARACTERS", ...characterContext(project)].join("\n\n"),
    ["24-BLOCK STORY EVIDENCE", ...blockContext(project)].join("\n\n"),
  ];

  return sections.filter(Boolean).join("\n\n").slice(0, FOUNDATION_SOURCE_CONTEXT_LIMIT).trim();
}
